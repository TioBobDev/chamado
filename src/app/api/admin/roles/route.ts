import { getCurrentUserSession } from '@/modules/departments/controllers/department.controller';
import { handleApiError, UnauthorizedError } from '@/shared/errors/errors';
import { prisma } from '@/shared/database/database';

export async function GET() {
  try {
    const session = await getCurrentUserSession();
    
    if (session.role !== 'Administrador') {
      throw new UnauthorizedError('Acesso negado.');
    }

    const roles = await prisma.role.findMany({
      where: {
        name: { in: ['Administrador', 'Coordenador', 'Atendente'] }
      },
      orderBy: { name: 'asc' },
    });

    return Response.json(roles);
  } catch (error) {
    return handleApiError(error);
  }
}
