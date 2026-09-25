import { getCurrentUserSession } from '@/modules/departments/controllers/department.controller';
import { handleApiError } from '@/shared/errors/errors';
import { pushNotificationService } from '@/modules/notifications/services/push-notification.service';

export async function POST() {
  try {
    const session = await getCurrentUserSession();

    const count = await pushNotificationService.sendPushToUser(session.userId, {
      title: '🔔 Teste de Notificação Lumen',
      message: 'Suas notificações móveis estão configuradas e ativas com sucesso!',
      url: '/dashboard',
      tag: 'test-push',
    });

    return Response.json({
      success: true,
      message: count > 0 
        ? `Notificação disparada com sucesso para ${count} dispositivo(s).` 
        : 'Nenhum dispositivo cadastrado encontrado para este usuário. Ative as notificações no aparelho primeiro.',
      sentCount: count,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
