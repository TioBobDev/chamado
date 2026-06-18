import { getCurrentUserSession } from '@/modules/departments/controllers/department.controller';
import { handleApiError, UnauthorizedError } from '@/shared/errors/errors';
import { prisma } from '@/shared/database/database';

export async function GET() {
  try {
    const session = await getCurrentUserSession();

    // Restringe apenas a administradores e auditores
    if (!['Administrador', 'Auditor'].includes(session.role)) {
      throw new UnauthorizedError('Acesso negado aos logs de auditoria do sistema.');
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        companyId: session.companyId,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // limita aos últimos 100 logs
    });

    return Response.json(logs);
  } catch (error) {
    return handleApiError(error);
  }
}
