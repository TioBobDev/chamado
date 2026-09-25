import { getCurrentUserSession } from '@/modules/departments/controllers/department.controller';
import { handleApiError, UnauthorizedError, ValidationError } from '@/shared/errors/errors';
import { prisma } from '@/shared/database/database';
import { security, UserSessionPayload } from '@/shared/security/security';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const session = await getCurrentUserSession();
    const { password } = await request.json();

    if (!password || password.trim().length < 6) {
      throw new ValidationError('A nova senha deve conter pelo menos 6 caracteres.');
    }

    // 1. Hashear nova senha
    const passwordHash = await security.hashPassword(password);

    // 2. Atualizar usuário no banco (registrando a nova senha e removendo a flag)
    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: {
        passwordHash,
        changePasswordRequired: false,
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    // 3. Montar novo payload e regerar token de sessão atualizado
    const permissions = updatedUser.role.permissions.map((rp) => rp.permission.name);
    
    const newPayload: UserSessionPayload = {
      userId: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role.name,
      permissions,
      companyId: updatedUser.companyId,
      changePasswordRequired: false, // Desmarcada
    };

    const userAgent = request.headers.get('user-agent') || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
    const maxAge = isMobile ? 60 * 60 * 24 * 30 : 60 * 60 * 8;

    const token = security.signToken(newPayload, isMobile ? '30d' : undefined);
    const cookieName = process.env.COOKIE_NAME || 'chamado_session';
    const cookieStore = await cookies();
    
    cookieStore.set(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge,
      path: '/',
    });

    // 4. Log de auditoria
    await prisma.auditLog.create({
      data: {
        companyId: updatedUser.companyId,
        userId: updatedUser.id,
        action: 'CHANGE_PASSWORD_FIRST_LOGIN',
        entityName: 'User',
        entityId: updatedUser.id,
        details: 'Usuário alterou a senha temporária no primeiro acesso.',
      },
    });

    return Response.json({ success: true, message: 'Senha atualizada com sucesso!' });
  } catch (error) {
    return handleApiError(error);
  }
}
