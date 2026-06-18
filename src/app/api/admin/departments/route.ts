import { getCurrentUserSession } from '@/modules/departments/controllers/department.controller';
import { handleApiError, UnauthorizedError, ValidationError } from '@/shared/errors/errors';
import { prisma } from '@/shared/database/database';

export async function POST(request: Request) {
  try {
    const session = await getCurrentUserSession();
    
    // Apenas Administrador pode criar setores
    if (session.role !== 'Administrador') {
      throw new UnauthorizedError('Acesso negado. Apenas administradores podem cadastrar setores.');
    }

    const { name } = await request.json();
    
    if (!name || name.trim().length < 2) {
      throw new ValidationError('O nome do setor deve possuir pelo menos 2 caracteres.');
    }

    const newDept = await prisma.department.create({
      data: {
        name: name.trim(),
        companyId: session.companyId,
      },
    });

    return Response.json(newDept, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
