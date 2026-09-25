import { getCurrentUserSession } from '@/modules/departments/controllers/department.controller';
import { handleApiError, ValidationError } from '@/shared/errors/errors';
import { pushNotificationService } from '@/modules/notifications/services/push-notification.service';

export async function POST(request: Request) {
  try {
    const session = await getCurrentUserSession();
    const body = await request.json();

    if (!body?.endpoint) {
      throw new ValidationError('O endpoint da inscrição deve ser informado.');
    }

    await pushNotificationService.removeSubscription(session.userId, body.endpoint);

    return Response.json({
      success: true,
      message: 'Inscrição push removida com sucesso.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
