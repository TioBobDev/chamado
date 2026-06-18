import { authService } from '../services/auth.service';
import { loginSchema } from '../validators/auth.validator';
import { handleApiError, ValidationError } from '@/shared/errors/errors';
import { cookies } from 'next/headers';

export class AuthController {
  async login(req: Request) {
    try {
      const body = await req.json();
      const validation = loginSchema.safeParse(body);

      if (!validation.success) {
        const errors: Record<string, string[]> = {};
        for (const issue of validation.error.issues) {
          const path = issue.path.join('.');
          if (!errors[path]) {
            errors[path] = [];
          }
          errors[path].push(issue.message);
        }
        throw new ValidationError('Erro de validação de dados de login', errors);
      }

      const { email, password } = validation.data;
      const { token, user } = await authService.authenticate(email, password);

      // Define o cookie de sessão HTTP-Only seguro
      const cookieName = process.env.COOKIE_NAME || 'chamado_session';
      const cookieStore = await cookies();
      cookieStore.set(cookieName, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 8, // 8 horas
        path: '/',
      });

      return Response.json({ success: true, user });
    } catch (error) {
      return handleApiError(error);
    }
  }

  async logout() {
    try {
      const cookieName = process.env.COOKIE_NAME || 'chamado_session';
      const cookieStore = await cookies();
      cookieStore.set(cookieName, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0, // Expira imediatamente
        path: '/',
      });
      return Response.json({ success: true, message: 'Logout efetuado com sucesso.' });
    } catch (error) {
      return handleApiError(error);
    }
  }
}

export const authController = new AuthController();
