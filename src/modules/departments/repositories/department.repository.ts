import { prisma } from '@/shared/database/database';
import { Prisma } from '@prisma/client';

export class DepartmentRepository {
  async listByCompany(companyId: string) {
    return prisma.department.findMany({
      where: { companyId, active: true },
      include: {
        teams: {
          where: { active: true },
        },
        categories: {
          where: { active: true },
          include: {
            slaRules: {
              where: { active: true },
              select: {
                id: true,
                name: true,
                priority: true,
                responseTimeMinutes: true,
                resolutionTimeMinutes: true,
                active: true,
              },
            },
          },
        },
        customFields: {
          where: { active: true },
          include: {
            category: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return prisma.department.findUnique({
      where: { id },
      include: {
        teams: {
          where: { active: true },
        },
        categories: {
          where: { active: true },
          include: {
            slaRules: {
              where: { active: true },
              select: {
                id: true,
                name: true,
                priority: true,
                responseTimeMinutes: true,
                resolutionTimeMinutes: true,
                active: true,
              },
            },
          },
        },
        customFields: {
          where: { active: true },
          include: {
            category: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async create(data: Prisma.DepartmentUncheckedCreateInput) {
    return prisma.department.create({ data });
  }

  async createTeam(data: Prisma.TeamUncheckedCreateInput) {
    return prisma.team.create({ data });
  }

  async createCategory(data: Prisma.TicketCategoryUncheckedCreateInput) {
    return prisma.ticketCategory.create({ data });
  }

  async createCustomField(data: Prisma.TicketCustomFieldUncheckedCreateInput) {
    return prisma.ticketCustomField.create({ data });
  }

  async getCustomFieldsByDepartment(departmentId: string, categoryId?: string | null) {
    const where: Prisma.TicketCustomFieldWhereInput = {
      departmentId,
      active: true,
    };

    if (categoryId) {
      where.OR = [
        { categoryId },
        { categoryId: null },
      ];
    }

    return prisma.ticketCustomField.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }
}

export const departmentRepository = new DepartmentRepository();
