import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres.').max(100),
  email: z.string().email('E-mail inválido.'),
  currentPassword: z.string().optional().or(z.literal('')),
  newPassword: z.string().optional().or(z.literal('')),
  confirmNewPassword: z.string().optional().or(z.literal('')),
}).refine((data) => {
  if (data.newPassword && data.newPassword.length > 0) {
    if (!data.currentPassword || data.currentPassword.length === 0) {
      return false;
    }
  }
  return true;
}, {
  message: 'Para alterar a senha, informe sua senha atual.',
  path: ['currentPassword'],
}).refine((data) => {
  if (data.newPassword && data.newPassword.length > 0) {
    if (data.newPassword.length < 6) {
      return false;
    }
  }
  return true;
}, {
  message: 'A nova senha deve ter no mínimo 6 caracteres.',
  path: ['newPassword'],
}).refine((data) => {
  if (data.newPassword && data.newPassword.length > 0) {
    if (data.newPassword !== data.confirmNewPassword) {
      return false;
    }
  }
  return true;
}, {
  message: 'A confirmação de senha não confere.',
  path: ['confirmNewPassword'],
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
