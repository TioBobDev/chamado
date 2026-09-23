import { getCurrentUserSession } from '@/modules/departments/controllers/department.controller';
import { handleApiError, UnauthorizedError, ValidationError } from '@/shared/errors/errors';
import { prisma } from '@/shared/database/database';
import { security } from '@/shared/security/security';
import { emailService } from '@/shared/email/email.service';

export async function GET(request: Request) {
  try {
    const session = await getCurrentUserSession();
    
    if (session.role !== 'Administrador') {
      throw new UnauthorizedError('Acesso negado.');
    }

    const url = new URL(request.url);
    const search = url.searchParams.get('search');

    const where: any = { companyId: session.companyId };
    
    if (search && search.trim() !== '') {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        role: true,
        departments: {
          select: {
            departmentId: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Remove os hashes de senhas antes de trafegar pela rede
    const safeUsers = users.map(({ passwordHash, ...rest }) => rest);

    return Response.json(safeUsers);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentUserSession();
    
    if (session.role !== 'Administrador') {
      throw new UnauthorizedError('Acesso negado. Apenas administradores podem cadastrar usuários.');
    }

    const { name, email, roleId, departmentIds } = await request.json();

    if (!name || name.trim().length < 2) {
      throw new ValidationError('O nome deve possuir pelo menos 2 caracteres.');
    }
    if (!email || !email.includes('@')) {
      throw new ValidationError('Insira um endereço de e-mail válido.');
    }
    if (!roleId) {
      throw new ValidationError('O perfil de acesso (Role) é obrigatório.');
    }

    // Verifica duplicidade de e-mail
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    
    if (existingUser) {
      throw new ValidationError('Este endereço de e-mail já está sendo utilizado.');
    }

    // Criptografa a senha default "usuario123"
    const defaultPassword = 'usuario123';
    const passwordHash = await security.hashPassword(defaultPassword);

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        roleId,
        companyId: session.companyId,
        active: true,
        changePasswordRequired: true,
        departments: {
          create: (departmentIds || []).map((deptId: string) => ({
            departmentId: deptId,
          })),
        },
      },
      include: {
        departments: true,
      },
    });

    // Dispara e-mail de boas-vindas com os dados de acesso (sem bloquear a resposta)
    emailService.sendWelcomeEmail(
      newUser.email,
      newUser.name,
      defaultPassword
    ).catch((err) => {
      console.error('[EMAIL] Falha ao enviar e-mail de boas-vindas:', err);
    });

    const { passwordHash: _, ...safeUser } = newUser;
    return Response.json(safeUser, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
