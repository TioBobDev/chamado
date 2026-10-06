import { prisma } from '@/shared/database/database';
import { Prisma } from '@prisma/client';

export class DepartmentRepository {
  async listByCompany(companyId: string) {
    try {
      return await prisma.department.findMany({
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
    } catch (err: any) {
      console.warn('[FALLBACK SQL listByCompany]:', err?.message);
      const depts = await prisma.department.findMany({
        where: { companyId, active: true },
        include: {
          teams: { where: { active: true } },
          categories: {
            where: { active: true },
            include: {
              slaRules: { where: { active: true } },
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      const customFields = await prisma.$queryRawUnsafe<any[]>(
        `SELECT f.*, c.name as category_name 
         FROM ticket_custom_fields f 
         LEFT JOIN ticket_categories c ON f.category_id = c.id 
         WHERE f.company_id = ? AND f.active = 1`,
        companyId
      );

      return depts.map((d) => ({
        ...d,
        customFields: customFields
          .filter((cf) => cf.department_id === d.id)
          .map((cf) => ({
            id: cf.id,
            name: cf.name,
            type: cf.type,
            options: cf.options,
            isRequired: !!cf.is_required,
            categoryId: cf.category_id,
            category: cf.category_id ? { id: cf.category_id, name: cf.category_name } : null,
          })),
      })) as any;
    }
  }

  async findById(id: string) {
    try {
      return await prisma.department.findUnique({
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
    } catch (err: any) {
      console.warn('[FALLBACK SQL findById]:', err?.message);
      const dept = await prisma.department.findUnique({
        where: { id },
        include: {
          teams: { where: { active: true } },
          categories: {
            where: { active: true },
            include: {
              slaRules: { where: { active: true } },
            },
          },
        },
      });

      if (!dept) return null;

      const customFields = await prisma.$queryRawUnsafe<any[]>(
        `SELECT f.*, c.name as category_name 
         FROM ticket_custom_fields f 
         LEFT JOIN ticket_categories c ON f.category_id = c.id 
         WHERE f.department_id = ? AND f.active = 1`,
        id
      );

      return {
        ...dept,
        customFields: customFields.map((cf) => ({
          id: cf.id,
          name: cf.name,
          type: cf.type,
          options: cf.options,
          isRequired: !!cf.is_required,
          departmentId: cf.department_id,
          categoryId: cf.category_id,
          companyId: cf.company_id,
          active: !!cf.active,
          category: cf.category_id ? { id: cf.category_id, name: cf.category_name } : null,
        })),
      } as any;
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const dept = await prisma.department.findUnique({
        where: { id },
        select: { id: true, active: true },
      });
      return !!dept && dept.active;
    } catch {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, active FROM departments WHERE id = ? LIMIT 1`,
        id
      );
      return rows.length > 0 && !!rows[0].active;
    }
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
    try {
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

      return await prisma.ticketCustomField.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
      });
    } catch (err: any) {
      console.warn('[FALLBACK SQL getCustomFieldsByDepartment]:', err?.message);
      let query = `
        SELECT f.*, c.name as category_name 
        FROM ticket_custom_fields f 
        LEFT JOIN ticket_categories c ON f.category_id = c.id 
        WHERE f.department_id = ? AND f.active = 1
      `;
      const params: any[] = [departmentId];
      if (categoryId) {
        query += ` AND (f.category_id = ? OR f.category_id IS NULL)`;
        params.push(categoryId);
      }
      query += ` ORDER BY f.name ASC`;

      const rows = await prisma.$queryRawUnsafe<any[]>(query, ...params);
      return rows.map((cf) => ({
        id: cf.id,
        name: cf.name,
        type: cf.type,
        options: cf.options,
        isRequired: !!cf.is_required,
        departmentId: cf.department_id,
        categoryId: cf.category_id,
        companyId: cf.company_id,
        active: !!cf.active,
        category: cf.category_id ? { id: cf.category_id, name: cf.category_name } : null,
      })) as any;
    }
  }
}

export const departmentRepository = new DepartmentRepository();
