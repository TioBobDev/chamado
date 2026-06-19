import { getCurrentUserSession } from '@/modules/departments/controllers/department.controller';
import { handleApiError } from '@/shared/errors/errors';
import { prisma } from '@/shared/database/database';

export async function GET() {
  try {
    const session = await getCurrentUserSession();

    const notifications = await prisma.notification.findMany({
      where: {
        userId: session.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId: session.userId,
        read: false,
      },
    });

    return Response.json({ notifications, unreadCount });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getCurrentUserSession();
    
    // Opcionalmente podemos receber no body quais ids marcar como lido,
    // mas marcar todas como lidas é o comportamento padrão simplificado.
    await prisma.notification.updateMany({
      where: {
        userId: session.userId,
        read: false,
      },
      data: {
        read: true,
      },
    });

    return Response.json({ success: true, message: 'Notificações marcadas como lidas.' });
  } catch (error) {
    return handleApiError(error);
  }
}
