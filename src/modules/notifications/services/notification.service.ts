import { prisma } from '@/shared/database/database';
import { logger } from '@/shared/logger/logger';

export interface NotificationPayload {
  userId: string;
  title: string;
  message: string;
  type?: 'IN_APP' | 'EMAIL' | 'TEAMS' | 'SLACK';
}

export class NotificationService {
  /**
   * Envia uma notificação e salva no banco se for do tipo IN_APP.
   */
  async notify(payload: NotificationPayload) {
    const type = payload.type || 'IN_APP';

    // Registrar no banco se for in-app
    if (type === 'IN_APP') {
      await prisma.notification.create({
        data: {
          userId: payload.userId,
          title: payload.title,
          message: payload.message,
          type,
        },
      });
    }

    // Estruturado para integrações futuras
    switch (type) {
      case 'EMAIL':
        await this.dispatchEmail(payload);
        break;
      case 'TEAMS':
        await this.dispatchTeams(payload);
        break;
      case 'SLACK':
        await this.dispatchSlack(payload);
        break;
      default:
        logger.info(`Notificação In-App enviada para usuário: ${payload.userId}`);
    }
  }

  // Métodos de simulação/integração preparados
  private async dispatchEmail(payload: NotificationPayload) {
    logger.info(`[NOTIFICAÇÃO EMAIL] Para: ${payload.userId} | Assunto: ${payload.title} | Mensagem: ${payload.message}`);
    // Integração futura: Nodemailer / SES / SendGrid
  }

  private async dispatchTeams(payload: NotificationPayload) {
    logger.info(`[NOTIFICAÇÃO TEAMS] Mensagem: ${payload.message}`);
    // Integração futura: Axios webhook call
  }

  private async dispatchSlack(payload: NotificationPayload) {
    logger.info(`[NOTIFICAÇÃO SLACK] Mensagem: ${payload.message}`);
    // Integração futura: Slack API call
  }

  /**
   * Dispara alertas comuns do ciclo do chamado.
   */
  async notifyTicketChange(ticketId: string, actionName: string, detail: string) {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { requester: true, attendant: true },
      });

      if (!ticket) return;

      // 1. Notifica o Solicitante (caso a alteração não seja dele)
      await this.notify({
        userId: ticket.requesterId,
        title: `Chamado #${ticket.number}: ${actionName}`,
        message: `Seu chamado sofreu alterações: ${detail}`,
        type: 'IN_APP',
      });

      // 2. Notifica o Atendente (caso haja um designado)
      if (ticket.attendantId) {
        await this.notify({
          userId: ticket.attendantId,
          title: `Chamado #${ticket.number}: ${actionName}`,
          message: `O chamado que você atende foi modificado: ${detail}`,
          type: 'IN_APP',
        });
      }
    } catch (error) {
      logger.error('Erro ao processar notificações do chamado:', error);
    }
  }
}

export const notificationService = new NotificationService();
