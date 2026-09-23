import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Insira um e-mail válido.'),
  password: z.string().min(6, 'A senha deve possuir no mínimo 6 caracteres.'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email('Insira um e-mail válido.'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token de redefinição é obrigatório.'),
  password: z.string().min(6, 'A nova senha deve possuir no mínimo 6 caracteres.'),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
