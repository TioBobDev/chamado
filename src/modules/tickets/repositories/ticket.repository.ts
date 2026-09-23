import { prisma } from '@/shared/database/database';
import { Prisma, Priority, Severity } from '@prisma/client';

export interface TicketListFilters {
  requesterId?: string;
  attendantId?: string;
  departmentId?: string;
  statusId?: string;
  priority?: Priority;
  search?: string;
}

export class TicketRepository {
  async create(data: Prisma.TicketUncheckedCreateInput) {
    return prisma.ticket.create({
      data,
      include: {
        status: true,
        category: true,
      },
    });
  }

  async findById(id: string) {
    return prisma.ticket.findUnique({
      where: { id },
      include: {
        requester: { select: { id: true, name: true, email: true, role: { select: { name: true } } } },
        attendant: { select: { id: true, name: true, email: true } },
        department: true,
        category: true,
        status: true,
        team: true,
        comments: {
          include: {
            user: { select: { id: true, name: true, email: true, role: { select: { name: true } } } },
          },
          orderBy: { createdAt: 'asc' },
        },
        history: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        attachments: {
          include: {
            uploadedBy: { select: { id: true, name: true } },
          },
        },
        customValues: {
          include: {
            field: true,
          },
        },
      },
    });
  }

  async list(companyId: string, userId: string, role: string, filters: TicketListFilters, skip = 0, limit = 10) {
    let visibilityCondition: Prisma.TicketWhereInput = {};

    if (role === 'Administrador' || role === 'Auditor') {
      visibilityCondition = {};
    } else if (role === 'Coordenador' || role === 'Gestor') {
      const userDepts = await prisma.userDepartment.findMany({
        where: { userId },
        select: { departmentId: true },
      });
      const departmentIds = userDepts.map((ud) => ud.departmentId);

      visibilityCondition = {
        OR: [
          { departmentId: { in: departmentIds } },
          { requesterId: userId },
        ],
      };
    } else if (role === 'Atendente') {
      const userDepts = await prisma.userDepartment.findMany({
        where: { userId },
        select: { departmentId: true },
      });
      const departmentIds = userDepts.map((ud) => ud.departmentId);

      visibilityCondition = {
        OR: [
          { attendantId: userId },
          { requesterId: userId },
          {
            departmentId: { in: departmentIds },
            attendantId: null,
          },
        ],
      };
    } else {
      visibilityCondition = {
        requesterId: userId,
      };
    }

    const where: Prisma.TicketWhereInput = {
      AND: [
        { companyId },
        visibilityCondition,
      ],
    };

    if (filters.requesterId) {
      (where.AND as Prisma.TicketWhereInput[]).push({ requesterId: filters.requesterId });
    }
    if (filters.attendantId) {
      (where.AND as Prisma.TicketWhereInput[]).push({ attendantId: filters.attendantId });
    }
    if (filters.departmentId) {
      (where.AND as Prisma.TicketWhereInput[]).push({ departmentId: filters.departmentId });
    }
    if (filters.statusId) {
      (where.AND as Prisma.TicketWhereInput[]).push({ statusId: filters.statusId });
    }
    if (filters.priority) {
      (where.AND as Prisma.TicketWhereInput[]).push({ priority: filters.priority });
    }
    if (filters.search) {
      (where.AND as Prisma.TicketWhereInput[]).push({
        OR: [
          { title: { contains: filters.search } },
          { description: { contains: filters.search } },
        ],
      });
    }

    const [data, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        include: {
          requester: { select: { id: true, name: true } },
          attendant: { select: { id: true, name: true } },
          department: true,
          category: true,
          status: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    return { data, total };
  }

  async update(id: string, data: Prisma.TicketUncheckedUpdateInput) {
    return prisma.ticket.update({
      where: { id },
      data,
      include: {
        status: true,
        attendant: true,
        team: true,
      },
    });
  }

  async saveCustomValues(ticketId: string, values: { fieldId: string; value: string }[]) {
    if (values.length === 0) return;
    
    await prisma.$transaction(
      values.map((v) =>
        prisma.ticketCustomValue.upsert({
          where: {
            ticketId_fieldId: {
              ticketId,
              fieldId: v.fieldId,
            },
          },
          update: { value: v.value },
          create: {
            ticketId,
            fieldId: v.fieldId,
            value: v.value,
          },
        })
      )
    );
  }

  async addComment(data: Prisma.TicketCommentUncheckedCreateInput) {
    return prisma.ticketComment.create({
      data,
      include: {
        user: { select: { id: true, name: true } },
      },
    });
  }

  async addHistory(data: Prisma.TicketHistoryUncheckedCreateInput) {
    return prisma.ticketHistory.create({
      data,
    });
  }

  async addAttachment(data: Prisma.TicketAttachmentUncheckedCreateInput) {
    return prisma.ticketAttachment.create({
      data,
    });
  }

  async findAttachmentById(id: string) {
    return prisma.ticketAttachment.findUnique({
      where: { id },
      include: {
        ticket: true,
      },
    });
  }
}

export const ticketRepository = new TicketRepository();
