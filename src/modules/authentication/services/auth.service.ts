import { userRepository } from '@/modules/users/repositories/user.repository';
import { security, UserSessionPayload } from '@/shared/security/security';
import { UnauthorizedError, ValidationError } from '@/shared/errors/errors';
import { prisma } from '@/shared/database/database';
import { emailService } from '@/shared/email/email.service';
import crypto from 'crypto';

export class AuthService {
  async authenticate(
    email: string, 
    password: string, 
    isMobile: boolean = false
  ): Promise<{ token: string; user: UserSessionPayload }> {
    const user = await userRepository.findByEmail(email);

    if (!user) {
      throw new UnauthorizedError('Credenciais inválidas. Verifique seu e-mail e senha.');
    }

    if (!user.active) {
      throw new UnauthorizedError('Esta conta de usuário foi desativada. Entre em contato com o administrador.');
    }

    const passwordMatch = await security.comparePassword(password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedError('Credenciais inválidas. Verifique seu e-mail e senha.');
    }

    // Mapear permissões do usuário
    const permissions = user.role.permissions.map((rp) => rp.permission.name);

    const payload: UserSessionPayload = {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      permissions,
      companyId: user.companyId,
      changePasswordRequired: user.changePasswordRequired,
    };

    // Para celulares/PWA o token dura 30 dias; no desktop dura as 8 horas normais de expediente
    const token = security.signToken(payload, isMobile ? '30d' : undefined);

    return {
      token,
      user: payload,
    };
  }

  /**
   * Solicita a recuperação de senha por e-mail.
   * Retorna mensagem padrão neutra para segurança (anti-enumeração de usuários).
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const standardMessage = 'Se o e-mail informado estiver cadastrado no sistema, você receberá um link para redefinir a senha.';

    const user = await userRepository.findByEmail(normalizedEmail);

    // Se o usuário não existir ou estiver inativo, não revela e retorna a mensagem padrão
    if (!user || !user.active) {
      return { success: true, message: standardMessage };
    }

    // 1. Invalida tokens anteriores não utilizados do mesmo usuário
    await prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        used: false,
      },
      data: {
        used: true,
      },
    });

    // 2. Gera novo token aleatório e seguro
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hora de validade

    // 3. Salva token na tabela
    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    // 4. Dispara e-mail com o link de recuperação
    await emailService.sendPasswordResetEmail(user.email, user.name, token);

    // 5. Registra log de auditoria
    await prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entityName: 'User',
        entityId: user.id,
        details: `Solicitação de redefinição de senha gerada para o e-mail: ${user.email}`,
      },
    });

    return {
      success: true,
      message: standardMessage,
    };
  }

  /**
   * Valida o token e define uma nova senha para o usuário.
   */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    if (!token || token.trim() === '') {
      throw new ValidationError('Token de redefinição não fornecido.');
    }

    if (!newPassword || newPassword.trim().length < 6) {
      throw new ValidationError('A nova senha deve possuir no mínimo 6 caracteres.');
    }

    // 1. Busca token no banco
    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetRecord) {
      throw new ValidationError('O link de redefinição de senha é inválido ou já foi utilizado.');
    }

    if (resetRecord.used) {
      throw new ValidationError('Este link de redefinição de senha já foi utilizado anteriormente.');
    }

    // 2. Verifica se expirou
    if (new Date() > resetRecord.expiresAt) {
      throw new ValidationError('Este link de redefinição de senha expirou. Solicite um novo link.');
    }

    // 3. Verifica se a conta está ativa
    if (!resetRecord.user.active) {
      throw new ValidationError('A conta vinculada a este e-mail está inativa. Contate o suporte.');
    }

    // 4. Hasheia a nova senha
    const passwordHash = await security.hashPassword(newPassword);

    // 5. Atualiza usuário e remove obrigatoriedade de troca de senha
    await prisma.user.update({
      where: { id: resetRecord.userId },
      data: {
        passwordHash,
        changePasswordRequired: false,
      },
    });

    // 6. Invalida o token marcando como utilizado
    await prisma.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: {
        used: true,
      },
    });

    // 7. Registra auditoria
    await prisma.auditLog.create({
      data: {
        companyId: resetRecord.user.companyId,
        userId: resetRecord.userId,
        action: 'PASSWORD_RESET_COMPLETED',
        entityName: 'User',
        entityId: resetRecord.userId,
        details: 'Senha redefinida com sucesso a partir de link de e-mail.',
      },
    });

    return {
      success: true,
      message: 'Sua senha foi redefinida com sucesso! Agora você já pode fazer login.',
    };
  }
}

export const authService = new AuthService();

