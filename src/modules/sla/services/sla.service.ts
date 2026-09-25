import { prisma } from '@/shared/database/database';
import { logger } from '@/shared/logger/logger';

export class SlaService {
  /**
   * Varre o banco de dados marcando chamados expirados sem data de encerramento como 'violation'.
   * Retorna a quantidade de chamados sinalizados.
   */
  async checkSlaBreaches(): Promise<number> {
    const now = new Date();

    // Encontrar todos os chamados que possuem SLA, não estão finalizados, não estão pausados e passaram do prazo
    const breachedTickets = await prisma.ticket.findMany({
      where: {
        slaDeadline: { lt: now },
        closedAt: null,
        slaViolated: false,
        slaPausedAt: null,
        status: {
          name: { not: 'Aguardando resposta do solicitante' },
        },
      },
      include: {
        status: true,
      },
    });

    if (breachedTickets.length === 0) return 0;

    const ticketIds = breachedTickets.map((t) => t.id);

    // Atualiza status do SLA em lote
    await prisma.ticket.updateMany({
      where: {
        id: { in: ticketIds },
      },
      data: {
        slaViolated: true,
      },
    });

    // Registra na timeline histórica de cada um
    await Promise.all(
      breachedTickets.map((ticket) =>
        prisma.ticketHistory.create({
          data: {
            ticketId: ticket.id,
            userId: ticket.requesterId, // ou robô
            action: 'Alerta de SLA',
            newValue: 'Prazo limite de SLA para resolução foi estourado!',
          },
        })
      )
    );

    logger.warn(`SLA estourado para ${breachedTickets.length} chamados.`, {
      ticketIds,
    });

    return breachedTickets.length;
  }
}

export const slaService = new SlaService();
