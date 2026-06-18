import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Insira um e-mail válido.'),
  password: z.string().min(6, 'A senha deve possuir no mínimo 6 caracteres.'),
});

export type LoginInput = z.infer<typeof loginSchema>;
