import { getCurrentUserSession } from '@/modules/departments/controllers/department.controller';
import { handleApiError, ForbiddenError, ValidationError } from '@/shared/errors/errors';
import { slaConfigService } from '../services/sla-config.service';
import { 
  updateSlaRulesBatchSchema, 
  createCategorySlaRuleSchema, 
  updateCategorySlaRuleSchema 
} from '../validators/sla.validator';

export class SlaConfigController {
  async list(req: Request) {
    try {
      const session = await getCurrentUserSession();

      if (session.role !== 'Administrador') {
        throw new ForbiddenError('Apenas administradores do sistema podem acessar as regras de SLA.');
      }

      const rules = await slaConfigService.listRules(session.companyId);
      return Response.json(rules);
    } catch (error) {
      return handleApiError(error);
    }
  }

  async update(req: Request) {
    try {
      const session = await getCurrentUserSession();

      if (session.role !== 'Administrador') {
        throw new ForbiddenError('Apenas administradores do sistema podem modificar as regras de SLA.');
      }

      const body = await req.json();

      // Suporte à restauração rápida de padrões ITIL
      if (body && body.action === 'reset_itil') {
        const rules = await slaConfigService.resetToItilDefaults(session.companyId, session.userId);
        return Response.json({ success: true, message: 'Regras restauradas para o padrão ITIL.', rules });
      }

      const validation = updateSlaRulesBatchSchema.safeParse(body);
      if (!validation.success) {
        const errors: Record<string, string[]> = {};
        for (const issue of validation.error.issues) {
          const path = issue.path.join('.');
          if (!errors[path]) errors[path] = [];
          errors[path].push(issue.message);
        }
        throw new ValidationError('Erro de validação nas regras de SLA', errors);
      }

      const rules = await slaConfigService.updateRules(
        session.companyId,
        validation.data.rules,
        session.userId
      );

      return Response.json({ success: true, message: 'Regras de SLA atualizadas com sucesso.', rules });
    } catch (error) {
      return handleApiError(error);
    }
  }

  // --- MÉTODOS PARA REGRAS DE SLA POR CATEGORIA / ATIVIDADE ---

  async listCategoryRules(req: Request) {
    try {
      const session = await getCurrentUserSession();

      if (session.role !== 'Administrador') {
        throw new ForbiddenError('Apenas administradores do sistema podem acessar as regras de SLA.');
      }

      const rules = await slaConfigService.listCategoryRules(session.companyId);
      return Response.json(rules);
    } catch (error) {
      return handleApiError(error);
    }
  }

  async createCategoryRule(req: Request) {
    try {
      const session = await getCurrentUserSession();

      if (session.role !== 'Administrador') {
        throw new ForbiddenError('Apenas administradores do sistema podem criar regras de SLA por atividade.');
      }

      const body = await req.json();
      const validation = createCategorySlaRuleSchema.safeParse(body);
      if (!validation.success) {
        const errors: Record<string, string[]> = {};
        for (const issue of validation.error.issues) {
          const path = issue.path.join('.');
          if (!errors[path]) errors[path] = [];
          errors[path].push(issue.message);
        }
        throw new ValidationError('Erro de validação no cadastro de SLA por atividade', errors);
      }

      const rule = await slaConfigService.createCategoryRule(
        session.companyId,
        validation.data,
        session.userId
      );

      return Response.json({
        success: true,
        message: 'Regra de SLA por atividade criada com sucesso.',
        rule,
      });
    } catch (error) {
      return handleApiError(error);
    }
  }

  async updateCategoryRule(req: Request, ruleId: string) {
    try {
      const session = await getCurrentUserSession();

      if (session.role !== 'Administrador') {
        throw new ForbiddenError('Apenas administradores do sistema podem alterar regras de SLA por atividade.');
      }

      const body = await req.json();
      const validation = updateCategorySlaRuleSchema.safeParse(body);
      if (!validation.success) {
        const errors: Record<string, string[]> = {};
        for (const issue of validation.error.issues) {
          const path = issue.path.join('.');
          if (!errors[path]) errors[path] = [];
          errors[path].push(issue.message);
        }
        throw new ValidationError('Erro de validação na alteração de SLA por atividade', errors);
      }

      const rule = await slaConfigService.updateCategoryRule(
        session.companyId,
        ruleId,
        validation.data,
        session.userId
      );

      return Response.json({
        success: true,
        message: 'Regra de SLA por atividade atualizada com sucesso.',
        rule,
      });
    } catch (error) {
      return handleApiError(error);
    }
  }

  async deleteCategoryRule(req: Request, ruleId: string) {
    try {
      const session = await getCurrentUserSession();

      if (session.role !== 'Administrador') {
        throw new ForbiddenError('Apenas administradores do sistema podem remover regras de SLA por atividade.');
      }

      await slaConfigService.deleteCategoryRule(session.companyId, ruleId, session.userId);

      return Response.json({
        success: true,
        message: 'Regra de SLA por atividade removida com sucesso.',
      });
    } catch (error) {
      return handleApiError(error);
    }
  }
}

export const slaConfigController = new SlaConfigController();

