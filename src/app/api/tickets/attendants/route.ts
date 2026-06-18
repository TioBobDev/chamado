import { getCurrentUserSession } from '@/modules/departments/controllers/department.controller';
import { handleApiError } from '@/shared/errors/errors';
import { prisma } from '@/shared/database/database';

export async function GET(request: Request) {
  try {
    const session = await getCurrentUserSession();
    const url = new URL(request.url);
    const departmentId = url.searchParams.get('departmentId');

    const whereClause: any = {
      companyId: session.companyId,
      active: true,
      role: {
        name: { in: ['Atendente', 'Coordenador', 'Gestor', 'Administrador'] },
      },
    };

    if (departmentId) {
      whereClause.departments = {
        some: {
          departmentId: departmentId,
        },
      };
    }

    // Busca usuários com perfis aptos a atender chamados e vinculados ao setor
    const attendants = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });
    return Response.json(attendants);
  } catch (error) {
    return handleApiError(error);
  }
}
