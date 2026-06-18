import { prisma } from '@/shared/database/database';
import { ValidationError } from '@/shared/errors/errors';

export class WorkflowService {
  /**
   * Valida se uma transição de status é permitida pelo workflow e retorna atualizações automáticas de rotas (equipe).
   */
  async validateAndRouteTransition(ticketId: string, targetStatusId: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { status: true },
    });

    if (!ticket) {
      throw new ValidationError('Chamado não encontrado para validação de workflow.');
    }

    // 1. Encontrar workflow ativo para o departamento
    const workflow = await prisma.workflow.findFirst({
      where: { departmentId: ticket.departmentId, active: true },
      include: {
        steps: true,
      },
    });

    if (!workflow) {
      // Sem workflow configurado, transição liberada por padrão
      return {};
    }

    // 2. Localizar o passo correspondente ao status atual
    const currentStep = workflow.steps.find((step) => step.statusId === ticket.statusId);
    if (!currentStep) {
      // Se o status atual não faz parte do fluxo desenhado, permite transição
      return {};
    }

    // 3. Validar se o status de destino está na lista de próximos status permitidos
    const allowedStatusIds = currentStep.nextStatusIds
      ? currentStep.nextStatusIds.split(',').map((id) => id.trim())
      : [];

    if (!allowedStatusIds.includes(targetStatusId)) {
      const targetStatus = await prisma.ticketStatus.findUnique({
        where: { id: targetStatusId },
      });
      throw new ValidationError(
        `Transição não permitida: não é possível passar do status "${ticket.status.name}" para "${targetStatus?.name || 'Status Desconhecido'}".`
      );
    }

    // 4. Aplicar roteamento automático de equipe se o próximo passo exigir
    const nextStep = workflow.steps.find((step) => step.statusId === targetStatusId);
    const automaticUpdates: any = {};

    if (nextStep) {
      if (nextStep.assignedTeamId) {
        automaticUpdates.teamId = nextStep.assignedTeamId;
        // Limpa o atendente para que a equipe pegue da fila
        automaticUpdates.attendantId = null;
      }
    }

    return automaticUpdates;
  }
}

export const workflowService = new WorkflowService();
