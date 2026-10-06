import { getCurrentUserSession } from '@/modules/departments/controllers/department.controller';
import { handleApiError, UnauthorizedError, ValidationError, ConflictError } from '@/shared/errors/errors';
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

    const trimmedName = name.trim();

    // Valida se já existe um setor com o mesmo nome na empresa
    const existingDept = await prisma.department.findFirst({
      where: {
        companyId: session.companyId,
        name: trimmedName,
      },
    });

    if (existingDept) {
      if (existingDept.active) {
        throw new ConflictError(`Já existe um setor cadastrado com o nome "${trimmedName}".`);
      } else {
        // Se estava inativo, reativa o setor existente
        const reactivated = await prisma.department.update({
          where: { id: existingDept.id },
          data: { active: true },
        });
        return Response.json(reactivated, { status: 200 });
      }
    }

    const newDept = await prisma.department.create({
      data: {
        name: trimmedName,
        companyId: session.companyId,
        active: true,
      },
    });

    return Response.json(newDept, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
