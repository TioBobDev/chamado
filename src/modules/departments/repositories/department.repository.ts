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
        },
        customFields: {
          where: { active: true },
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
        },
        customFields: {
          where: { active: true },
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

  async getCustomFieldsByDepartment(departmentId: string) {
    return prisma.ticketCustomField.findMany({
      where: { departmentId, active: true },
      orderBy: { name: 'asc' },
    });
  }
}

export const departmentRepository = new DepartmentRepository();
