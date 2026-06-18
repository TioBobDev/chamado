import { ticketRepository, TicketListFilters } from '../repositories/ticket.repository';
import { prisma } from '@/shared/database/database';
import { storageService } from '@/shared/storage/storage';
import { CreateTicketInput, AddCommentInput, UpdateTicketInput } from '../validators/ticket.validator';
import { NotFoundError, UnauthorizedError, ValidationError } from '@/shared/errors/errors';
import { logger } from '@/shared/logger/logger';
import { Priority } from '@prisma/client';
import { workflowService } from '@/modules/workflows/services/workflow.service';
import { notificationService } from '@/modules/notifications/services/notification.service';

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

    // 2. Calcular SLA (caso exista regra cadastrada)
    let slaDeadline: Date | null = null;
    const slaRule = await prisma.slaRule.findFirst({
      where: {
        companyId,
        active: true,
        OR: [
          { categoryId: input.categoryId, priority: input.priority },
          { departmentId: input.departmentId, priority: input.priority },
          { priority: input.priority },
        ],
      },
      orderBy: [
        { categoryId: 'desc' }, // prioriza regra de categoria
        { departmentId: 'desc' }, // depois regra de departamento
      ],
    });

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
      const isAllowed = ticket.attendantId === userId || ticket.requesterId === userId;
      if (!isAllowed) {
        throw new UnauthorizedError('Você não tem permissão para acessar ou interagir com este chamado (não atribuído a você).');
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
    return this.checkTicketInteractionPermission(ticketId, userId, companyId, role);
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

    const updates: any = {};
    const historyPromises: any[] = [];

    // Validar e registrar alteração de Status
    if (input.statusId && input.statusId !== ticket.statusId) {
      const status = await prisma.ticketStatus.findFirst({
        where: { id: input.statusId, companyId },
      });
      if (!status) throw new NotFoundError('Status de destino não encontrado.');

      // Validação do motor de workflow e atribuições automáticas de equipe
      const workflowUpdates = await workflowService.validateAndRouteTransition(ticketId, input.statusId);
      Object.assign(updates, workflowUpdates);

      updates.statusId = input.statusId;

      // Se passou para um status final, registrar data de encerramento
      if (status.isFinal) {
        updates.closedAt = new Date();
      } else {
        updates.closedAt = null;
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

    // Validar e registrar alteração de Atendente/Equipe
    if (input.attendantId !== undefined && input.attendantId !== ticket.attendantId) {
      updates.attendantId = input.attendantId;
      let oldName = ticket.attendant?.name || 'Sem atendente';
      let newName = 'Sem atendente';
      
      if (input.attendantId) {
        const attendant = await prisma.user.findFirst({
          where: { id: input.attendantId, companyId },
        });
        if (attendant) newName = attendant.name;
      }

      historyPromises.push(
        ticketRepository.addHistory({
          ticketId,
          userId,
          action: 'Alteração de Responsável',
          oldValue: oldName,
          newValue: newName,
        })
      );
    }

    // Validar e registrar alteração de Prioridade
    if (input.priority && input.priority !== ticket.priority) {
      updates.priority = input.priority;
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

    // Solicitante não pode comentar em mensagens internas
    if (userRole === 'Solicitante' && input.isInternal) {
      throw new UnauthorizedError('Solicitantes não podem adicionar comentários internos.');
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

    if (!input.isInternal) {
      await notificationService.notifyTicketChange(ticketId, 'Novo Comentário', 'Um novo comentário público foi adicionado ao seu chamado.');
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
