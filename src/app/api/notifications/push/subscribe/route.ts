import { getCurrentUserSession } from '@/modules/departments/controllers/department.controller';
import { handleApiError, ValidationError } from '@/shared/errors/errors';
import { pushNotificationService } from '@/modules/notifications/services/push-notification.service';

export async function POST(request: Request) {
  try {
    const session = await getCurrentUserSession();
    const body = await request.json();

    if (!body?.subscription?.endpoint || !body?.subscription?.keys?.p256dh || !body?.subscription?.keys?.auth) {
      throw new ValidationError('Objeto de inscrição Push inválido ou incompleto.');
    }

    const userAgent = request.headers.get('user-agent') || undefined;

    const saved = await pushNotificationService.saveSubscription(
      session.userId,
      body.subscription,
      userAgent
    );

    return Response.json({
      success: true,
      message: 'Dispositivo cadastrado com sucesso para notificações push.',
      subscriptionId: saved.id,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
