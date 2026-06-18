import { getCurrentUserSession } from '@/modules/departments/controllers/department.controller';
import { handleApiError } from '@/shared/errors/errors';
import { prisma } from '@/shared/database/database';

export async function GET(request: Request) {
  try {
    const session = await getCurrentUserSession();
    const statuses = await prisma.ticketStatus.findMany({
      where: { companyId: session.companyId, active: true },
      orderBy: { name: 'asc' },
    });
    return Response.json(statuses);
  } catch (error) {
    return handleApiError(error);
  }
}
