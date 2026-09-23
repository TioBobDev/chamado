import { authService } from './auth.service';
import { prisma } from '@/shared/database/database';
import { security } from '@/shared/security/security';
import { ValidationError } from '@/shared/errors/errors';

describe('AuthService - Password Reset Tests', () => {
  const testEmail = 'reset-test@company.com';
  let testUserId: string;

  beforeAll(async () => {
    // Cria empresa e usuário para teste
    const company = await prisma.company.upsert({
      where: { id: 'company-default-id' },
      update: {},
      create: {
        id: 'company-default-id',
        name: 'Empresa Teste',
        active: true,
      },
    });

    const role = await prisma.role.upsert({
      where: { id: 'role-test' },
      update: {},
      create: {
        id: 'role-test',
        name: 'Role Test',
      },
    });

    // Remove usuário prévio se existir
    await prisma.user.deleteMany({ where: { email: testEmail } });

    const passwordHash = await security.hashPassword('oldPassword123');
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: 'Usuário Teste Redefinição',
        passwordHash,
        roleId: role.id,
        companyId: company.id,
        active: true,
        changePasswordRequired: true,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Limpeza
    await prisma.passwordResetToken.deleteMany({ where: { userId: testUserId } });
    await prisma.auditLog.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  it('deve retornar mensagem padrão neutra quando o e-mail não existir (anti-enumeração)', async () => {
    const response = await authService.requestPasswordReset('inexistente@empresa.com');

    expect(response.success).toBe(true);
    expect(response.message).toBe(
      'Se o e-mail informado estiver cadastrado no sistema, você receberá um link para redefinir a senha.'
    );
  });

  it('deve gerar token no banco ao solicitar redefinição para um usuário existente', async () => {
    const response = await authService.requestPasswordReset(testEmail);

    expect(response.success).toBe(true);
    expect(response.message).toBe(
      'Se o e-mail informado estiver cadastrado no sistema, você receberá um link para redefinir a senha.'
    );

    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: { userId: testUserId, used: false },
    });

    expect(tokenRecord).not.toBeNull();
    expect(tokenRecord?.token).toBeDefined();
    expect(tokenRecord?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('deve redefinir a senha com sucesso quando o token for válido', async () => {
    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: { userId: testUserId, used: false },
    });
    expect(tokenRecord).not.toBeNull();

    const newPassword = 'newPassword456';
    const resetResult = await authService.resetPassword(tokenRecord!.token, newPassword);

    expect(resetResult.success).toBe(true);

    // Verifica se token foi marcado como utilizado
    const updatedToken = await prisma.passwordResetToken.findUnique({
      where: { id: tokenRecord!.id },
    });
    expect(updatedToken?.used).toBe(true);

    // Verifica se senha do usuário foi alterada
    const updatedUser = await prisma.user.findUnique({
      where: { id: testUserId },
    });
    expect(updatedUser?.changePasswordRequired).toBe(false);

    const passwordMatch = await security.comparePassword(newPassword, updatedUser!.passwordHash);
    expect(passwordMatch).toBe(true);
  });

  it('deve rejeitar tentativa de redefinir senha com token já utilizado', async () => {
    const usedTokenRecord = await prisma.passwordResetToken.findFirst({
      where: { userId: testUserId, used: true },
    });
    expect(usedTokenRecord).not.toBeNull();

    await expect(
      authService.resetPassword(usedTokenRecord!.token, 'anotherPassword789')
    ).rejects.toThrow(ValidationError);
  });

  it('deve rejeitar tentativa com token expirado', async () => {
    // Cria token com data no passado
    const expiredToken = await prisma.passwordResetToken.create({
      data: {
        token: 'token-expirado-123',
        userId: testUserId,
        expiresAt: new Date(Date.now() - 1000 * 60), // expirado há 1 minuto
        used: false,
      },
    });

    await expect(
      authService.resetPassword(expiredToken.token, 'passwordValidation123')
    ).rejects.toThrow('Este link de redefinição de senha expirou. Solicite um novo link.');
  });
});
