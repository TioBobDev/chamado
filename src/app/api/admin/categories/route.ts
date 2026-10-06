import { getCurrentUserSession } from '@/modules/departments/controllers/department.controller';
import { handleApiError, UnauthorizedError, ValidationError, ConflictError } from '@/shared/errors/errors';
import { prisma } from '@/shared/database/database';

export async function POST(request: Request) {
  try {
    const session = await getCurrentUserSession();
    
    // Apenas Administrador pode criar categorias
    if (session.role !== 'Administrador') {
      throw new UnauthorizedError('Acesso negado. Apenas administradores podem cadastrar categorias.');
    }

    const { name, departmentId } = await request.json();
    
    if (!name || name.trim().length < 2) {
      throw new ValidationError('O nome da categoria deve possuir pelo menos 2 caracteres.');
    }
    if (!departmentId) {
      throw new ValidationError('O departamento associado é obrigatório.');
    }

    // Valida se o departamento existe na mesma empresa
    const dept = await prisma.department.findFirst({
      where: { id: departmentId, companyId: session.companyId },
    });
    
    if (!dept) {
      throw new ValidationError('O departamento selecionado é inválido.');
    }

    const trimmedCat = name.trim();
    const existingCat = await prisma.ticketCategory.findFirst({
      where: {
        departmentId,
        companyId: session.companyId,
        name: trimmedCat,
      },
    });

    if (existingCat) {
      if (existingCat.active) {
        throw new ConflictError(`Já existe uma categoria cadastrada com o nome "${trimmedCat}" neste setor.`);
      } else {
        const reactivated = await prisma.ticketCategory.update({
          where: { id: existingCat.id },
          data: { active: true },
        });
        return Response.json(reactivated, { status: 200 });
      }
    }

    const newCategory = await prisma.ticketCategory.create({
      data: {
        name: trimmedCat,
        departmentId,
        companyId: session.companyId,
      },
    });

    return Response.json(newCategory, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
