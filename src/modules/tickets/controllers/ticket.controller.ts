import { ticketService } from '../services/ticket.service';
import { getCurrentUserSession } from '@/modules/departments/controllers/department.controller';
import { createTicketSchema, addCommentSchema, updateTicketSchema } from '../validators/ticket.validator';
import { handleApiError, ValidationError, NotFoundError, UnauthorizedError } from '@/shared/errors/errors';
import { getPaginationParams } from '@/shared/utils/utils';
import { Priority } from '@prisma/client';
import fs from 'fs';
import path from 'path';

export class TicketController {
  async create(req: Request) {
    try {
      const session = await getCurrentUserSession();
      const body = await req.json();

      const validation = createTicketSchema.safeParse(body);
      if (!validation.success) {
        const errors: Record<string, string[]> = {};
        for (const issue of validation.error.issues) {
          const path = issue.path.join('.');
          if (!errors[path]) errors[path] = [];
          errors[path].push(issue.message);
        }
        throw new ValidationError('Erro de validação ao criar chamado', errors);
      }

      const ticket = await ticketService.createTicket(
        session.companyId,
        session.userId,
        validation.data
      );

      return Response.json(ticket, { status: 201 });
    } catch (error) {
      return handleApiError(error);
    }
  }

  async get(id: string) {
    try {
      const session = await getCurrentUserSession();
      const ticket = await ticketService.getTicketDetails(
        id,
        session.companyId,
        session.userId,
        session.role
      );
      return Response.json(ticket);
    } catch (error) {
      return handleApiError(error);
    }
  }

  async list(req: Request) {
    try {
      const session = await getCurrentUserSession();
      const url = new URL(req.url);
      const { page, limit } = getPaginationParams(url);

      const filters: any = {};
      const statusId = url.searchParams.get('statusId');
      const departmentId = url.searchParams.get('departmentId');
      const priority = url.searchParams.get('priority');
      const search = url.searchParams.get('search');
      const attendantId = url.searchParams.get('attendantId');

      if (statusId) filters.statusId = statusId;
      if (departmentId) filters.departmentId = departmentId;
      if (attendantId) filters.attendantId = attendantId;
      if (priority) filters.priority = priority as Priority;
      if (search) filters.search = search;

      const result = await ticketService.listTickets(
        session.companyId,
        session.userId,
        session.role,
        filters,
        page,
        limit
      );

      return Response.json({
        data: result.data,
        meta: {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      return handleApiError(error);
    }
  }

  async update(req: Request, id: string) {
    try {
      const session = await getCurrentUserSession();
      const body = await req.json();

      const validation = updateTicketSchema.safeParse(body);
      if (!validation.success) {
        const errors: Record<string, string[]> = {};
        for (const issue of validation.error.issues) {
          const path = issue.path.join('.');
          if (!errors[path]) errors[path] = [];
          errors[path].push(issue.message);
        }
        throw new ValidationError('Erro de validação ao atualizar chamado', errors);
      }

      const updated = await ticketService.updateTicket(
        id,
        session.userId,
        session.companyId,
        validation.data,
        session.role
      );

      return Response.json(updated);
    } catch (error) {
      return handleApiError(error);
    }
  }

  async addComment(req: Request, id: string) {
    try {
      const session = await getCurrentUserSession();
      const body = await req.json();

      const validation = addCommentSchema.safeParse(body);
      if (!validation.success) {
        throw new ValidationError('Comentário inválido.', {
          content: validation.error.issues.map((i) => i.message),
        });
      }

      const comment = await ticketService.addComment(
        id,
        session.userId,
        session.companyId,
        validation.data,
        session.role
      );

      return Response.json(comment, { status: 201 });
    } catch (error) {
      return handleApiError(error);
    }
  }

  async uploadAttachment(req: Request, id: string) {
    try {
      const session = await getCurrentUserSession();
      const formData = await req.formData();
      const file = formData.get('file') as File;

      if (!file) {
        throw new ValidationError('Nenhum arquivo enviado.');
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const attachment = await ticketService.uploadAttachment(
        id,
        session.userId,
        session.companyId,
        buffer,
        file.name,
        file.type,
        session.role
      );

      return Response.json(attachment, { status: 201 });
    } catch (error) {
      return handleApiError(error);
    }
  }
}

export const ticketController = new TicketController();
