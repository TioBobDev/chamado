import { userRepository } from '@/modules/users/repositories/user.repository';
import { security, UserSessionPayload } from '@/shared/security/security';
import { UnauthorizedError } from '@/shared/errors/errors';

export class AuthService {
  async authenticate(email: string, password: string): Promise<{ token: string; user: UserSessionPayload }> {
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

    const token = security.signToken(payload);

    return {
      token,
      user: payload,
    };
  }
}

export const authService = new AuthService();
