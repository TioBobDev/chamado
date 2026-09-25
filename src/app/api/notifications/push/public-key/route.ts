import { pushNotificationService } from '@/modules/notifications/services/push-notification.service';

export async function GET() {
  const publicKey = pushNotificationService.getPublicKey();
  return Response.json({ publicKey });
}
