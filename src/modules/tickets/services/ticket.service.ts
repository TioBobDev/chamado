import { ticketRepository, TicketListFilters } from '../repositories/ticket.repository';
import { prisma } from '@/shared/database/database';
import { storageService } from '@/shared/storage/storage';
import { CreateTicketInput, AddCommentInput, UpdateTicketInput } from '../validators/ticket.validator';
import { NotFoundError, UnauthorizedError, ValidationError } from '@/shared/errors/errors';
import { logger } from '@/shared/logger/logger';
import { Priority } from '@prisma/client';
import { workflowService } from '@/modules/workflows/services/workflow.service';
import { notificationService } from '@/modules/notifications/services/notification.service';
import { slaConfigService } from '@/modules/sla/services/sla-config.service';

export class TicketService {
  async createTicket(companyId: string, requesterId: string, input: CreateTicketInput) {
    // Validar se o usuário responde pelo setor do chamado
    const userInDept = await prisma.userDepartment.findUnique({
      where: {
        userId_departmentId: {
          userId: requesterId,
          departmentId: input.departmentId,
        },
      },
    });

    if (userInDept) {
      throw new ValidationError('Você não pode abrir chamados para um setor ao qual você responde.');
    }

    // 1. Encontrar status inicial
    let initialStatus = await prisma.ticketStatus.findFirst({
      where: { companyId, isInitial: true, active: true },
    });
    
    if (!initialStatus) {
      initialStatus = await prisma.ticketStatus.findFirst({
        where: { companyId, active: true },
      });
      if (!initialStatus) {
        throw new ValidationError('Nenhum status de chamado foi configurado para a empresa.');
      }
    }

    // 2. Calcular SLA (Hierarquia: Categoria/Atividade -> Setor -> Criticidade Global)
    let slaDeadline: Date | null = null;
    const slaRule = await slaConfigService.resolveEffectiveSlaRule(
      companyId,
      input.departmentId,
      input.categoryId,
      input.priority
    );

    if (slaRule) {
      slaDeadline = new Date(Date.now() + slaRule.resolutionTimeMinutes * 60 * 1000);
    }

    // 3. Criar ticket
    const ticket = await ticketRepository.create({
      title: input.title,
      description: input.description,
      requesterId,
      companyId,
      departmentId: input.departmentId,
      categoryId: input.categoryId,
      priority: input.priority,
      statusId: initialStatus.id,
      slaDeadline,
    });

    // 4. Salvar campos customizados (se fornecidos)
    if (input.customFields && input.customFields.length > 0) {
      await ticketRepository.saveCustomValues(ticket.id, input.customFields);
    }

    // 5. Adicionar ao Histórico
    await ticketRepository.addHistory({
      ticketId: ticket.id,
      userId: requesterId,
      action: 'Abertura de Chamado',
      newValue: `Chamado #${ticket.number} aberto com status ${initialStatus.name}`,
    });

    // 6. Registrar Log de Auditoria
    await prisma.auditLog.create({
      data: {
        companyId,
        userId: requesterId,
        action: 'CREATE_TICKET',
        entityName: 'Ticket',
        entityId: ticket.id,
        details: JSON.stringify({ number: ticket.number, title: ticket.title }),
      },
    });

    logger.info(`Chamado criado: #${ticket.number}`, { userId: requesterId, companyId });

    await notificationService.notifyTicketChange(ticket.id, 'Abertura de Chamado', `O chamado #${ticket.number} foi criado com sucesso.`);

    return ticket;
  }

  private async checkTicketInteractionPermission(
    ticketId: string,
    userId: string,
    companyId: string,
    role: string
  ) {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket || ticket.companyId !== companyId) {
      throw new NotFoundError('Chamado não encontrado.');
    }

    if (role === 'Administrador' || role === 'Auditor') {
      return ticket;
    }

    if (role === 'Coordenador' || role === 'Gestor') {
      const userDepts = await prisma.userDepartment.findMany({
        where: { userId },
        select: { departmentId: true },
      });
      const departmentIds = userDepts.map((ud) => ud.departmentId);
      
      const isAllowed = 
        ticket.requesterId === userId || 
        departmentIds.includes(ticket.departmentId);

      if (!isAllowed) {
        throw new UnauthorizedError('Você não tem permissão para acessar ou interagir com este chamado (fora do seu setor).');
      }
      return ticket;
    }

    if (role === 'Atendente') {
      const userDepts = await prisma.userDepartment.findMany({
        where: { userId },
        select: { departmentId: true },
      });
      const departmentIds = userDepts.map((ud) => ud.departmentId);

      const isAllowed = 
        ticket.attendantId === userId || 
        ticket.requesterId === userId ||
        (departmentIds.includes(ticket.departmentId) && ticket.attendantId === null);

      if (!isAllowed) {
        throw new UnauthorizedError('Você não tem permissão para acessar ou interagir com este chamado.');
      }
      return ticket;
    }

    if (role === 'Solicitante') {
      if (ticket.requesterId !== userId) {
        throw new UnauthorizedError('Você não tem permissão para acessar ou interagir com este chamado.');
      }
      return ticket;
    }

    throw new UnauthorizedError('Perfil de acesso inválido.');
  }

  async getTicketDetails(ticketId: string, companyId: string, userId: string, role: string) {
    const ticket = await this.checkTicketInteractionPermission(ticketId, userId, companyId, role);
    const slaRule = await slaConfigService.resolveEffectiveSlaRule(
      companyId,
      ticket.departmentId,
      ticket.categoryId,
      ticket.priority
    );
    return { ...ticket, slaRule };
  }

  async listTickets(companyId: string, userId: string, role: string, filters: TicketListFilters, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    return ticketRepository.list(companyId, userId, role, filters, skip, limit);
  }

  async updateTicket(ticketId: string, userId: string, companyId: string, input: UpdateTicketInput, role: string) {
    if (role === 'Solicitante' || role === 'Auditor') {
      throw new UnauthorizedError('Seu perfil não possui permissão para alterar os atributos operacionais de um chamado.');
    }

    const ticket = await this.checkTicketInteractionPermission(ticketId, userId, companyId, role);

    // Bloqueio absoluto se o chamado já foi encerrado (Sem reabertura permitida)
    if (ticket.status.isFinal || ticket.status.name === 'Encerrado') {
      throw new ValidationError('Este chamado já foi encerrado e não pode ser reaberto ou modificado.');
    }

    const updates: any = {};
    const historyPromises: any[] = [];

    // Validar e registrar alteração de Status
    if (input.statusId && input.statusId !== ticket.statusId) {
      const status = await prisma.ticketStatus.findFirst({
        where: { id: input.statusId, companyId },
      });
      if (!status) throw new NotFoundError('Status de destino não encontrado.');

      // Bloqueio de retrocesso: se estiver Em Atendimento ou Aguardando resposta, não pode voltar para Aberto
      const isCurrentlyActive =
        ticket.status.name === 'Em Atendimento' ||
        ticket.statusId === 'status-atendimento' ||
        ticket.status.name === 'Aguardando resposta do solicitante' ||
        ticket.statusId === 'status-aguardando-solicitante' ||
        ticket.slaPausedAt !== null;
      const isTargetAberto = status.name === 'Aberto' || status.id === 'status-aberto' || status.isInitial;

      if (isCurrentlyActive && isTargetAberto) {
        throw new ValidationError('Não é permitido alterar o status para "Aberto" após o início do atendimento. Você deve transferir o atendimento para outra pessoa do setor ou encerrar o chamado.');
      }

      // Validação do motor de workflow e atribuições automáticas de equipe
      const workflowUpdates = await workflowService.validateAndRouteTransition(ticketId, input.statusId);
      Object.assign(updates, workflowUpdates);

      updates.statusId = input.statusId;

      // Gerenciar pausa e retomada de SLA ao alterar status
      const isTargetAwaiting =
        status.name === 'Aguardando resposta do solicitante' ||
        status.id === 'status-aguardando-solicitante';
      const wasAwaiting =
        ticket.status.name === 'Aguardando resposta do solicitante' ||
        ticket.statusId === 'status-aguardando-solicitante' ||
        ticket.slaPausedAt !== null;

      if (isTargetAwaiting && !wasAwaiting) {
        // Pausando SLA
        updates.slaPausedAt = new Date();
      } else if (wasAwaiting && !isTargetAwaiting) {
        // Retomando SLA
        if (!status.isFinal && ticket.slaPausedAt && ticket.slaDeadline) {
          const pausedMs = Math.max(0, Date.now() - new Date(ticket.slaPausedAt).getTime());
          updates.slaDeadline = new Date(new Date(ticket.slaDeadline).getTime() + pausedMs);
        }
        updates.slaPausedAt = null;
      }

      // Se passou para um status final, registrar data de encerramento e comentário de solução
      if (status.isFinal) {
        const closedAt = new Date();
        updates.closedAt = closedAt;
        updates.slaPausedAt = null;
        if (ticket.slaDeadline && closedAt > new Date(ticket.slaDeadline)) {
          updates.slaViolated = true;
        }

        if (input.resolutionSummary && input.resolutionSummary.trim()) {
          historyPromises.push(
            ticketRepository.addComment({
              ticketId,
              userId,
              content: `✅ Solução do chamado: ${input.resolutionSummary.trim()}`,
              isInternal: false,
            })
          );
        }
      } else {
        updates.closedAt = null;
      }

      // Rastrear 1ª resposta quando entra em atendimento
      if (status.name === 'Em Atendimento' && ticket.status.name !== 'Em Atendimento') {
        const responseMinutes = Math.max(1, Math.round((Date.now() - new Date(ticket.createdAt).getTime()) / 60000));
        const slaRule = await slaConfigService.resolveEffectiveSlaRule(
          companyId,
          ticket.departmentId,
          ticket.categoryId,
          ticket.priority
        );
        const targetResp = slaRule?.responseTimeMinutes || 120;
        const withinSla = responseMinutes <= targetResp;
        historyPromises.push(
          ticketRepository.addHistory({
            ticketId,
            userId,
            action: 'Primeira Resposta (SLA)',
            newValue: `Atendimento iniciado em ${responseMinutes} min (${withinSla ? 'Dentro da meta ITIL de ' + targetResp + ' min' : 'Excedeu meta ITIL de ' + targetResp + ' min'})`,
          })
        );
      }

      historyPromises.push(
        ticketRepository.addHistory({
          ticketId,
          userId,
          action: 'Alteração de Status',
          oldValue: ticket.status.name,
          newValue: status.name,
        })
      );
    }

    // Validar e registrar alteração ou Transferência de Atendente
    if (input.attendantId !== undefined && input.attendantId !== ticket.attendantId) {
      if (input.attendantId && input.attendantId === ticket.requesterId) {
        throw new ValidationError('O atendente não pode assumir ou ser designado para um chamado do qual ele é o solicitante.');
      }

      // Validação de Transferência de Atendimento
      const isTransfer = !!(ticket.attendantId && input.attendantId && ticket.attendantId !== input.attendantId);

      // Se for um perfil Atendente alterando o responsável:
      if (role === 'Atendente' && input.attendantId !== null) {
        const isSelfAssign = input.attendantId === userId;

        if (!isSelfAssign) {
          // 1. Só pode transferir quando o status for "Em Atendimento"
          if (ticket.status.name !== 'Em Atendimento' && ticket.statusId !== 'status-atendimento') {
            throw new ValidationError('A transferência de atendimento só é permitida quando o chamado estiver "Em Atendimento".');
          }

          // 2. Só pode transferir se for o próprio atendente atual do chamado
          if (ticket.attendantId !== userId) {
            throw new ValidationError('Você só pode transferir chamados que estão sob o seu próprio atendimento.');
          }

          // 3. Só pode transferir para alguém da MESMA equipe/setor do chamado
          const targetUserDept = await prisma.userDepartment.findFirst({
            where: {
              userId: input.attendantId,
              departmentId: ticket.departmentId,
            },
          });
          if (!targetUserDept) {
            throw new ValidationError('O chamado só pode ser transferido para membros da mesma equipe/setor.');
          }
        }
      }

      updates.attendantId = input.attendantId;
      let oldName = ticket.attendant?.name || 'Sem atendente';
      let newName = 'Sem atendente';
      
      if (input.attendantId) {
        const attendant = await prisma.user.findFirst({
          where: { id: input.attendantId, companyId },
        });
        if (attendant) newName = attendant.name;
      }

      const actionName = isTransfer ? 'Transferência de Atendimento' : 'Alteração de Responsável';
      const historyDetail = input.transferReason && input.transferReason.trim()
        ? `${newName} (Motivo: ${input.transferReason.trim()})`
        : newName;

      historyPromises.push(
        ticketRepository.addHistory({
          ticketId,
          userId,
          action: actionName,
          oldValue: oldName,
          newValue: historyDetail,
        })
      );

      // Se for transferência e tiver motivo, registrar comentário interno
      if (isTransfer && input.transferReason && input.transferReason.trim()) {
        historyPromises.push(
          ticketRepository.addComment({
            ticketId,
            userId,
            content: `🔄 Atendimento transferido para ${newName}. Motivo: ${input.transferReason.trim()}`,
            isInternal: true,
          })
        );
      }

      // Notificar novo atendente
      if (input.attendantId && isTransfer) {
        historyPromises.push(
          notificationService.notify({
            userId: input.attendantId,
            title: `Chamado #${ticket.number} transferido para você`,
            message: `O chamado #${ticket.number} foi transferido para seu atendimento por ${ticket.attendant?.name || 'um colega'}.`,
            type: 'IN_APP',
          })
        );
      }
    }

    // Validar e registrar alteração de Prioridade
    if (input.priority && input.priority !== ticket.priority) {
      updates.priority = input.priority;

      // Recalcular SLA baseado na nova prioridade e regra de atividade
      const slaRule = await slaConfigService.resolveEffectiveSlaRule(
        companyId,
        ticket.departmentId,
        ticket.categoryId,
        input.priority
      );

      if (slaRule) {
        const newDeadline = new Date(new Date(ticket.createdAt).getTime() + slaRule.resolutionTimeMinutes * 60 * 1000);
        updates.slaDeadline = newDeadline;
        updates.slaViolated = newDeadline < new Date();
      }

      historyPromises.push(
        ticketRepository.addHistory({
          ticketId,
          userId,
          action: 'Alteração de Prioridade',
          oldValue: ticket.priority,
          newValue: input.priority,
        })
      );
    }

    // Atualizar no banco
    const updatedTicket = await ticketRepository.update(ticketId, updates);

    // Salvar históricos gerados
    await Promise.all(historyPromises);

    // Registrar log global de auditoria
    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'UPDATE_TICKET',
        entityName: 'Ticket',
        entityId: ticketId,
        details: JSON.stringify(updates),
      },
    });

    await notificationService.notifyTicketChange(ticketId, 'Alteração de Chamado', 'O status ou atendente do seu chamado foi modificado.');

    return updatedTicket;
  }

  async addComment(ticketId: string, userId: string, companyId: string, input: AddCommentInput, userRole: string) {
    const ticket = await this.checkTicketInteractionPermission(ticketId, userId, companyId, userRole);

    if (ticket.status.isFinal || ticket.status.name === 'Encerrado') {
      throw new ValidationError('Não é possível adicionar comentários a um chamado que já foi encerrado.');
    }

    // Solicitante não pode comentar em mensagens internas
    if (userRole === 'Solicitante' && input.isInternal) {
      throw new UnauthorizedError('Solicitantes não podem adicionar comentários internos.');
    }

    // Se o atendente marcar para aguardar resposta do solicitante
    if (input.awaitRequesterResponse) {
      if (userRole === 'Solicitante' || ticket.requesterId === userId) {
        throw new ValidationError('O solicitante não pode marcar uma pergunta para aguardar resposta de si mesmo.');
      }
      // O comentário obrigatoriamente deve ser público para que o solicitante possa lê-lo e responder
      input.isInternal = false;
    }

    const comment = await ticketRepository.addComment({
      ticketId,
      userId,
      content: input.content,
      isInternal: input.isInternal,
    });

    await ticketRepository.addHistory({
      ticketId,
      userId,
      action: input.isInternal ? 'Comentário Interno Inserido' : 'Comentário Inserido',
      newValue: input.content.slice(0, 100) + (input.content.length > 100 ? '...' : ''),
    });

    // 1. Caso a flag de aguardar resposta do solicitante tenha sido acionada
    if (input.awaitRequesterResponse) {
      const awaitingStatus = await prisma.ticketStatus.findFirst({
        where: {
          companyId,
          OR: [
            { id: 'status-aguardando-solicitante' },
            { name: 'Aguardando resposta do solicitante' },
            { name: { contains: 'Aguardando' } },
          ],
          active: true,
        },
      });

      if (awaitingStatus) {
        const now = new Date();
        await ticketRepository.update(ticketId, {
          statusId: awaitingStatus.id,
          slaPausedAt: now,
        });

        await ticketRepository.addHistory({
          ticketId,
          userId,
          action: 'Aguardando Solicitante',
          oldValue: ticket.status.name,
          newValue: 'Status alterado para "Aguardando resposta do solicitante". SLA pausado.',
        });

        const author = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });

        await notificationService.notify({
          userId: ticket.requesterId,
          title: `Chamado #${ticket.number}: Aguardando sua resposta`,
          message: `${author?.name || 'O atendente'} solicitou informações para prosseguir com seu chamado: "${input.content.slice(0, 120)}${input.content.length > 120 ? '...' : ''}"`,
          type: 'IN_APP',
        });
      }
    } else {
      // 2. Caso o chamado estivesse em status 'Aguardando resposta do solicitante' (ou pausado) e uma resposta pública foi adicionada
      const isCurrentlyAwaiting =
        ticket.status.name === 'Aguardando resposta do solicitante' ||
        ticket.statusId === 'status-aguardando-solicitante' ||
        ticket.slaPausedAt !== null;

      if (isCurrentlyAwaiting && !input.isInternal) {
        const emAtendimentoStatus = await prisma.ticketStatus.findFirst({
          where: {
            companyId,
            OR: [
              { id: 'status-atendimento' },
              { name: 'Em Atendimento' },
            ],
            active: true,
          },
        });

        if (emAtendimentoStatus) {
          let newSlaDeadline = ticket.slaDeadline;
          let pausedMinutes = 0;

          if (ticket.slaPausedAt && ticket.slaDeadline) {
            const pausedMs = Math.max(0, Date.now() - new Date(ticket.slaPausedAt).getTime());
            pausedMinutes = Math.round(pausedMs / 60000);
            newSlaDeadline = new Date(new Date(ticket.slaDeadline).getTime() + pausedMs);
          }

          await ticketRepository.update(ticketId, {
            statusId: emAtendimentoStatus.id,
            slaDeadline: newSlaDeadline,
            slaPausedAt: null,
          });

          await ticketRepository.addHistory({
            ticketId,
            userId,
            action: 'Retomada de Atendimento',
            oldValue: ticket.status.name,
            newValue: `Resposta recebida. Status retornado para "Em Atendimento" e SLA retomado${pausedMinutes > 0 ? ` (+${pausedMinutes} min adicionados ao prazo)` : ''}.`,
          });

          if (ticket.attendantId && ticket.attendantId !== userId) {
            await notificationService.notify({
              userId: ticket.attendantId,
              title: `Chamado #${ticket.number}: Solicitante respondeu`,
              message: `${ticket.requester.name} enviou uma resposta no chamado #${ticket.number}. O atendimento foi retomado automaticamente.`,
              type: 'IN_APP',
            });
          }
        }
      }

      if (!input.isInternal) {
        await notificationService.notifyTicketChange(
          ticketId,
          'Novo Comentário',
          'Um novo comentário público foi adicionado ao seu chamado.'
        );
      }
    }

    return comment;
  }

  async uploadAttachment(
    ticketId: string,
    userId: string,
    companyId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    role: string
  ) {
    const ticket = await this.checkTicketInteractionPermission(ticketId, userId, companyId, role);

    // Fazer upload pelo StorageService
    const uploadResult = await storageService.upload(fileBuffer, fileName, mimeType);

    // Gravar dados do anexo no banco
    const attachment = await ticketRepository.addAttachment({
      ticketId,
      name: uploadResult.name,
      path: uploadResult.path,
      mimeType: uploadResult.mimeType,
      size: uploadResult.size,
      uploadedById: userId,
    });

    // Registrar no histórico do chamado
    await ticketRepository.addHistory({
      ticketId,
      userId,
      action: 'Anexo Adicionado',
      newValue: uploadResult.name,
    });

    await notificationService.notifyTicketChange(ticketId, 'Novo Anexo', `Um novo anexo foi adicionado ao seu chamado: ${uploadResult.name}`);

    return attachment;
  }
}

export const ticketService = new TicketService();
