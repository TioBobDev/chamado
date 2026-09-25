import { z } from 'zod';
import { Priority } from '@prisma/client';

export const updateSlaRuleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'O nome da regra deve conter pelo menos 2 caracteres.'),
  priority: z.nativeEnum(Priority),
  responseTimeMinutes: z.number().int().positive('O tempo de resposta deve ser maior que 0 minutos.'),
  resolutionTimeMinutes: z.number().int().positive('O tempo de resolução deve ser maior que 0 minutos.'),
  active: z.boolean().default(true),
});

export const updateSlaRulesBatchSchema = z.object({
  rules: z.array(updateSlaRuleSchema).min(1, 'Pelo menos uma regra deve ser enviada.'),
});

export const createCategorySlaRuleSchema = z.object({
  name: z.string().min(2, 'O nome da regra deve conter pelo menos 2 caracteres.'),
  departmentId: z.string().min(1, 'O setor deve ser informado.'),
  categoryId: z.string().min(1, 'A categoria / atividade deve ser informada.'),
  priority: z.nativeEnum(Priority).optional().nullable(),
  responseTimeMinutes: z.number().int().positive('O tempo de resposta deve ser maior que 0 minutos.'),
  resolutionTimeMinutes: z.number().int().positive('O tempo de resolução deve ser maior que 0 minutos.'),
  active: z.boolean().default(true),
});

export const updateCategorySlaRuleSchema = z.object({
  name: z.string().min(2, 'O nome da regra deve conter pelo menos 2 caracteres.').optional(),
  departmentId: z.string().min(1, 'O setor deve ser informado.').optional(),
  categoryId: z.string().min(1, 'A categoria / atividade deve ser informada.').optional(),
  priority: z.nativeEnum(Priority).optional().nullable(),
  responseTimeMinutes: z.number().int().positive('O tempo de resposta deve ser maior que 0 minutos.').optional(),
  resolutionTimeMinutes: z.number().int().positive('O tempo de resolução deve ser maior que 0 minutos.').optional(),
  active: z.boolean().optional(),
});

export type UpdateSlaRuleInput = z.infer<typeof updateSlaRuleSchema>;
export type UpdateSlaRulesBatchInput = z.infer<typeof updateSlaRulesBatchSchema>;
export type CreateCategorySlaRuleInput = z.infer<typeof createCategorySlaRuleSchema>;
export type UpdateCategorySlaRuleInput = z.infer<typeof updateCategorySlaRuleSchema>;
