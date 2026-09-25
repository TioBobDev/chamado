import { prisma } from '@/shared/database/database';
import { Priority } from '@prisma/client';
import { 
  UpdateSlaRuleInput, 
  CreateCategorySlaRuleInput, 
  UpdateCategorySlaRuleInput 
} from '../validators/sla.validator';
import { ValidationError, NotFoundError } from '@/shared/errors/errors';

export const DEFAULT_ITIL_SLA_CONFIGS: Record<
  Priority,
  { name: string; responseTimeMinutes: number; resolutionTimeMinutes: number }
> = {
  [Priority.URGENT]: {
    name: 'SLA Crítico / Urgente (ITIL)',
    responseTimeMinutes: 30, // 30 minutos
    resolutionTimeMinutes: 240, // 4 horas
  },
  [Priority.HIGH]: {
    name: 'SLA Alta Prioridade (ITIL)',
    responseTimeMinutes: 60, // 1 hora
    resolutionTimeMinutes: 480, // 8 horas
  },
  [Priority.MEDIUM]: {
    name: 'SLA Média Prioridade (ITIL)',
    responseTimeMinutes: 120, // 2 horas
    resolutionTimeMinutes: 1440, // 24 horas (1 dia)
  },
  [Priority.LOW]: {
    name: 'SLA Baixa Prioridade (ITIL)',
    responseTimeMinutes: 480, // 8 horas
    resolutionTimeMinutes: 4320, // 72 horas (3 dias)
  },
};

const PRIORITY_ORDER: Priority[] = [
  Priority.URGENT,
  Priority.HIGH,
  Priority.MEDIUM,
  Priority.LOW,
];

export class SlaConfigService {
  /**
   * Lista todas as regras de SLA gerais da empresa.
   * Se alguma prioridade não possuir regra, cria automaticamente com os valores padrão ITIL.
   */
  async listRules(companyId: string) {
    const existingRules = await prisma.slaRule.findMany({
      where: {
        companyId,
        departmentId: null,
        categoryId: null,
      },
    });

    const existingPriorities = new Set(existingRules.map((r) => r.priority));

    // Se faltar alguma prioridade, cria os padrões ITIL automaticamente
    for (const priority of PRIORITY_ORDER) {
      if (!existingPriorities.has(priority)) {
        const defaultCfg = DEFAULT_ITIL_SLA_CONFIGS[priority];
        const newRule = await prisma.slaRule.create({
          data: {
            id: `sla-itil-${priority.toLowerCase()}`,
            name: defaultCfg.name,
            companyId,
            priority,
            responseTimeMinutes: defaultCfg.responseTimeMinutes,
            resolutionTimeMinutes: defaultCfg.resolutionTimeMinutes,
            active: true,
          },
        });
        existingRules.push(newRule);
      }
    }

    // Ordenar estritamente: Urgente -> Alta -> Média -> Baixa
    return existingRules.sort(
      (a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
    );
  }

  /**
   * Atualiza as regras de SLA em lote.
   */
  async updateRules(companyId: string, rules: UpdateSlaRuleInput[], userId: string) {
    if (!rules || rules.length === 0) {
      throw new ValidationError('Nenhuma regra informada para atualização.');
    }

    const updatedRules = [];

    for (const item of rules) {
      // Validação de coerência: resolução deve ser maior ou igual ao tempo de resposta
      if (item.resolutionTimeMinutes < item.responseTimeMinutes) {
        throw new ValidationError(
          `Para a prioridade ${item.priority}, o tempo de resolução (${item.resolutionTimeMinutes}m) não pode ser menor que o tempo de 1ª resposta (${item.responseTimeMinutes}m).`
        );
      }

      const rule = await prisma.slaRule.upsert({
        where: {
          id: item.id || `sla-itil-${item.priority.toLowerCase()}`,
        },
        update: {
          name: item.name,
          responseTimeMinutes: item.responseTimeMinutes,
          resolutionTimeMinutes: item.resolutionTimeMinutes,
          active: item.active,
        },
        create: {
          id: item.id || `sla-itil-${item.priority.toLowerCase()}`,
          name: item.name,
          companyId,
          priority: item.priority,
          responseTimeMinutes: item.responseTimeMinutes,
          resolutionTimeMinutes: item.resolutionTimeMinutes,
          active: item.active,
        },
      });

      updatedRules.push(rule);
    }

    // Registrar no Log de Auditoria
    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'UPDATE_SLA_RULES',
        entityName: 'SlaRule',
        details: JSON.stringify(
          rules.map((r) => ({
            priority: r.priority,
            response: `${r.responseTimeMinutes} min`,
            resolution: `${r.resolutionTimeMinutes} min`,
          }))
        ),
      },
    });

    return this.listRules(companyId);
  }

  /**
   * Restaura todas as 4 prioridades para os padrões originais ITIL.
   */
  async resetToItilDefaults(companyId: string, userId: string) {
    for (const priority of PRIORITY_ORDER) {
      const defaultCfg = DEFAULT_ITIL_SLA_CONFIGS[priority];
      await prisma.slaRule.upsert({
        where: { id: `sla-itil-${priority.toLowerCase()}` },
        update: {
          name: defaultCfg.name,
          responseTimeMinutes: defaultCfg.responseTimeMinutes,
          resolutionTimeMinutes: defaultCfg.resolutionTimeMinutes,
          active: true,
        },
        create: {
          id: `sla-itil-${priority.toLowerCase()}`,
          name: defaultCfg.name,
          companyId,
          priority,
          responseTimeMinutes: defaultCfg.responseTimeMinutes,
          resolutionTimeMinutes: defaultCfg.resolutionTimeMinutes,
          active: true,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'RESET_SLA_ITIL_DEFAULTS',
        entityName: 'SlaRule',
        details: 'Regras de SLA restauradas para os padrões oficiais ITIL.',
      },
    });

    return this.listRules(companyId);
  }

  /**
   * Lista todas as regras de SLA específicas por Atividade / Categoria
   */
  async listCategoryRules(companyId: string) {
    return prisma.slaRule.findMany({
      where: {
        companyId,
        categoryId: { not: null },
      },
      include: {
        category: {
          select: { id: true, name: true },
        },
        department: {
          select: { id: true, name: true },
        },
      },
      orderBy: [
        { department: { name: 'asc' } },
        { category: { name: 'asc' } },
      ],
    });
  }

  /**
   * Cadastra uma nova regra de SLA para uma Categoria / Atividade específica
   */
  async createCategoryRule(
    companyId: string,
    data: CreateCategorySlaRuleInput,
    userId: string
  ) {
    if (data.resolutionTimeMinutes < data.responseTimeMinutes) {
      throw new ValidationError(
        `O tempo de resolução (${data.resolutionTimeMinutes}m) não pode ser menor que o tempo de 1ª resposta (${data.responseTimeMinutes}m).`
      );
    }

    const category = await prisma.ticketCategory.findFirst({
      where: {
        id: data.categoryId,
        departmentId: data.departmentId,
        companyId,
      },
    });

    if (!category) {
      throw new NotFoundError('Categoria ou Setor não encontrado para esta empresa.');
    }

    const newRule = await prisma.slaRule.create({
      data: {
        name: data.name,
        companyId,
        departmentId: data.departmentId,
        categoryId: data.categoryId,
        priority: data.priority || Priority.MEDIUM,
        responseTimeMinutes: data.responseTimeMinutes,
        resolutionTimeMinutes: data.resolutionTimeMinutes,
        active: data.active ?? true,
      },
      include: {
        category: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'CREATE_CATEGORY_SLA_RULE',
        entityName: 'SlaRule',
        entityId: newRule.id,
        details: JSON.stringify({
          ruleId: newRule.id,
          name: newRule.name,
          category: category.name,
          responseTimeMinutes: newRule.responseTimeMinutes,
          resolutionTimeMinutes: newRule.resolutionTimeMinutes,
        }),
      },
    });

    return newRule;
  }

  /**
   * Atualiza uma regra de SLA por Categoria existente
   */
  async updateCategoryRule(
    companyId: string,
    ruleId: string,
    data: UpdateCategorySlaRuleInput,
    userId: string
  ) {
    const existing = await prisma.slaRule.findFirst({
      where: { id: ruleId, companyId, categoryId: { not: null } },
      include: { category: true },
    });

    if (!existing) {
      throw new NotFoundError('Regra de SLA por atividade não encontrada.');
    }

    const responseMins = data.responseTimeMinutes ?? existing.responseTimeMinutes;
    const resolutionMins = data.resolutionTimeMinutes ?? existing.resolutionTimeMinutes;

    if (resolutionMins < responseMins) {
      throw new ValidationError(
        `O tempo de resolução (${resolutionMins}m) não pode ser menor que o tempo de 1ª resposta (${responseMins}m).`
      );
    }

    const updated = await prisma.slaRule.update({
      where: { id: ruleId },
      data: {
        name: data.name ?? existing.name,
        departmentId: data.departmentId ?? existing.departmentId,
        categoryId: data.categoryId ?? existing.categoryId,
        priority: data.priority !== undefined ? (data.priority ?? Priority.MEDIUM) : existing.priority,
        responseTimeMinutes: responseMins,
        resolutionTimeMinutes: resolutionMins,
        active: data.active ?? existing.active,
      },
      include: {
        category: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'UPDATE_CATEGORY_SLA_RULE',
        entityName: 'SlaRule',
        entityId: ruleId,
        details: JSON.stringify({
          ruleId,
          category: existing.category?.name,
          responseTimeMinutes: updated.responseTimeMinutes,
          resolutionTimeMinutes: updated.resolutionTimeMinutes,
          active: updated.active,
        }),
      },
    });

    return updated;
  }

  /**
   * Remove uma regra de SLA por Categoria (voltando ao padrão da Criticidade)
   */
  async deleteCategoryRule(companyId: string, ruleId: string, userId: string) {
    const existing = await prisma.slaRule.findFirst({
      where: { id: ruleId, companyId, categoryId: { not: null } },
      include: { category: true },
    });

    if (!existing) {
      throw new NotFoundError('Regra de SLA por atividade não encontrada.');
    }

    await prisma.slaRule.delete({
      where: { id: ruleId },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'DELETE_CATEGORY_SLA_RULE',
        entityName: 'SlaRule',
        entityId: ruleId,
        details: JSON.stringify({
          ruleId,
          name: existing.name,
          category: existing.category?.name,
        }),
      },
    });

    return { success: true };
  }

  /**
   * Resolução Hierárquica Inteligente de SLA (Precedência):
   * 1. Categoria (Atividade) + Prioridade específica
   * 2. Categoria (Atividade) padrão
   * 3. Departamento + Prioridade
   * 4. Departamento padrão
   * 5. Fallback Global ITIL por Criticidade
   */
  async resolveEffectiveSlaRule(
    companyId: string,
    departmentId?: string | null,
    categoryId?: string | null,
    priority: Priority = Priority.MEDIUM
  ) {
    // 1. Regra específica da Categoria com a mesma Prioridade
    if (categoryId) {
      const catPriorityRule = await prisma.slaRule.findFirst({
        where: { companyId, categoryId, priority, active: true },
        include: { category: true, department: true },
      });
      if (catPriorityRule) return catPriorityRule;

      // 2. Regra geral da Categoria (independente de prioridade)
      const catGeneralRule = await prisma.slaRule.findFirst({
        where: { companyId, categoryId, active: true },
        include: { category: true, department: true },
      });
      if (catGeneralRule) return catGeneralRule;
    }

    // 3. Regra específica do Departamento com a mesma Prioridade
    if (departmentId) {
      const deptPriorityRule = await prisma.slaRule.findFirst({
        where: { companyId, departmentId, priority, active: true },
        include: { category: true, department: true },
      });
      if (deptPriorityRule) return deptPriorityRule;

      // 4. Regra geral do Departamento
      const deptGeneralRule = await prisma.slaRule.findFirst({
        where: { companyId, departmentId, categoryId: null, active: true },
        include: { category: true, department: true },
      });
      if (deptGeneralRule) return deptGeneralRule;
    }

    // 5. Fallback Global ITIL por Criticidade (sem departamento e sem categoria)
    const globalPriorityRule = await prisma.slaRule.findFirst({
      where: { companyId, priority, departmentId: null, categoryId: null, active: true },
      include: { category: true, department: true },
    });
    if (globalPriorityRule) return globalPriorityRule;

    // 6. Último recurso: qualquer regra ativa da prioridade
    return prisma.slaRule.findFirst({
      where: { companyId, priority, active: true },
      include: { category: true, department: true },
    });
  }
}

export const slaConfigService = new SlaConfigService();

