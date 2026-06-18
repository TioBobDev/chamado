import { getCurrentUserSession } from '@/modules/departments/controllers/department.controller';
import { handleApiError, UnauthorizedError, ValidationError, NotFoundError } from '@/shared/errors/errors';
import { prisma } from '@/shared/database/database';
import { security } from '@/shared/security/security';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentUserSession();
    
    // Apenas administradores podem editar usuários
    if (session.role !== 'Administrador') {
      throw new UnauthorizedError('Acesso negado. Apenas administradores podem editar usuários.');
    }

    const { id } = await context.params;
    const body = await request.json();
    const { name, email, password, roleId, active, departmentIds } = body;

    const user = await prisma.user.findFirst({
      where: { id, companyId: session.companyId },
    });

    if (!user) {
      throw new NotFoundError('Usuário não encontrado.');
    }

    const updates: any = {};

    if (name !== undefined) {
      if (name.trim().length < 2) {
        throw new ValidationError('O nome deve possuir pelo menos 2 caracteres.');
      }
      updates.name = name.trim();
    }

    if (email !== undefined) {
      if (!email.includes('@')) {
        throw new ValidationError('Insira um e-mail válido.');
      }
      const emailLower = email.toLowerCase().trim();
      if (emailLower !== user.email) {
        // Verifica se o novo e-mail já existe
        const existing = await prisma.user.findUnique({
          where: { email: emailLower },
        });
        if (existing) {
          throw new ValidationError('Este e-mail já está sendo utilizado.');
        }
        updates.email = emailLower;
      }
    }

    if (password !== undefined && password !== '') {
      if (password.length < 6) {
        throw new ValidationError('A senha de acesso deve possuir pelo menos 6 caracteres.');
      }
      updates.passwordHash = await security.hashPassword(password);
    }

    if (roleId !== undefined) {
      updates.roleId = roleId;
    }

    if (active !== undefined) {
      updates.active = active;
    }

    if (departmentIds !== undefined) {
      updates.departments = {
        deleteMany: {},
        create: (departmentIds || []).map((deptId: string) => ({
          departmentId: deptId,
        })),
      };
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updates,
      include: {
        role: true,
        departments: {
          select: {
            departmentId: true,
          },
        },
      },
    });

    const { passwordHash: _, ...safeUser } = updatedUser;
    return Response.json(safeUser);
  } catch (error) {
    return handleApiError(error);
  }
}
