import { z } from 'zod';
import { Priority, Severity } from '@prisma/client';

export const createTicketSchema = z.object({
  title: z.string().min(5, 'O título deve conter pelo menos 5 caracteres.'),
  description: z.string().min(10, 'A descrição deve conter pelo menos 10 caracteres.'),
  departmentId: z.string().min(1, 'ID de departamento inválido.'),
  categoryId: z.string().min(1, 'ID de categoria inválido.'),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  impact: z.nativeEnum(Severity).default(Severity.MEDIUM),
  urgency: z.nativeEnum(Severity).default(Severity.MEDIUM),
  customFields: z
    .array(
      z.object({
        fieldId: z.string().min(1),
        value: z.string().min(1, 'O valor é obrigatório para campos definidos.'),
      })
    )
    .optional()
    .default([]),
});

export const addCommentSchema = z.object({
  content: z.string().min(1, 'O comentário não pode ser vazio.'),
  isInternal: z.boolean().default(false),
});

export const updateTicketSchema = z.object({
  statusId: z.string().min(1).optional(),
  teamId: z.string().nullable().optional(),
  attendantId: z.string().nullable().optional(),
  priority: z.nativeEnum(Priority).optional(),
  transferReason: z.string().optional(),
  resolutionSummary: z.string().optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type AddCommentInput = z.infer<typeof addCommentSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
