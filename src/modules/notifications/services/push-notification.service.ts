import webpush from 'web-push';
import { prisma } from '@/shared/database/database';
import { logger } from '@/shared/logger/logger';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BC-35iTT2XD-ovAbw6rZfyVrsrEb_nYPD1gTrsDZyL9OYwkjZK0eqWuC1eDaWlhOoCd3-uKXs4nCocMBB30E548';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'D37eoxLkHn8vPIzMWq1kExi866ietO6CT1OK77rCRz0';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:suporte@lumenchamados.com.br';

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
  logger.error('[WEBPUSH] Erro ao configurar chaves VAPID', { error: String(err) });
}

export interface PushPayload {
  title: string;
  message: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
}

export class PushNotificationService {
  /**
   * Retorna a chave pública VAPID para uso no navegador
   */
  getPublicKey(): string {
    return VAPID_PUBLIC_KEY;
  }

  /**
   * Salva ou atualiza a inscrição Push de um dispositivo do usuário
   */
  async saveSubscription(
    userId: string,
    subscription: {
      endpoint: string;
      keys: {
        p256dh: string;
        auth: string;
      };
    },
    userAgent?: string
  ) {
    const existing = await prisma.pushSubscription.findFirst({
      where: {
        userId,
        endpoint: subscription.endpoint,
      },
    });

    if (existing) {
      return prisma.pushSubscription.update({
        where: { id: existing.id },
        data: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userAgent: userAgent || existing.userAgent,
          updatedAt: new Date(),
        },
      });
    }

    return prisma.pushSubscription.create({
      data: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
      },
    });
  }

  /**
   * Remove a inscrição Push de um dispositivo
   */
  async removeSubscription(userId: string, endpoint: string) {
    const existing = await prisma.pushSubscription.findFirst({
      where: {
        userId,
        endpoint,
      },
    });

    if (existing) {
      await prisma.pushSubscription.delete({
        where: { id: existing.id },
      });
    }
  }

  /**
   * Dispara uma notificação Web Push para todos os dispositivos cadastrados do usuário
   */
  async sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (!subscriptions || subscriptions.length === 0) {
      return 0;
    }

    const jsonPayload = JSON.stringify({
      title: payload.title || 'Lumen Chamados',
      message: payload.message,
      url: payload.url || '/dashboard',
      tag: payload.tag || 'lumen-ticket',
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/icon-192x192.png',
    });

    let sentCount = 0;

    await Promise.all(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, jsonPayload);
          sentCount++;
        } catch (error: any) {
          logger.warn(`[WEBPUSH] Falha ao enviar push para inscrição ${sub.id}`, {
            statusCode: error?.statusCode,
            message: error?.message,
          });

          // Se a inscrição expirou ou o usuário revogou a permissão no navegador (404 ou 410 Gone)
          if (error?.statusCode === 404 || error?.statusCode === 410) {
            try {
              await prisma.pushSubscription.delete({ where: { id: sub.id } });
              logger.info(`[WEBPUSH] Inscrição expirada removida do banco: ${sub.id}`);
            } catch {}
          }
        }
      })
    );

    return sentCount;
  }
}

export const pushNotificationService = new PushNotificationService();
