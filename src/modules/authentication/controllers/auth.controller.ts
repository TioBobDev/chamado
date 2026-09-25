import { authService } from '../services/auth.service';
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../validators/auth.validator';
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

      // Detecta se a requisição provém de um dispositivo móvel ou PWA
      const userAgent = req.headers.get('user-agent') || '';
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent) 
        || (body && (body.isMobile === true || body.isPwa === true));

      const { email, password } = validation.data;
      const { token, user } = await authService.authenticate(email, password, isMobile);

      // Define a duração da sessão: 30 dias para celulares/PWA, 8 horas para desktop
      const maxAge = isMobile 
        ? 60 * 60 * 24 * 30 // 30 dias
        : 60 * 60 * 8;      // 8 horas

      // Define o cookie de sessão HTTP-Only seguro
      const cookieName = process.env.COOKIE_NAME || 'chamado_session';
      const cookieStore = await cookies();
      cookieStore.set(cookieName, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge,
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

  async forgotPassword(req: Request) {
    try {
      const body = await req.json();
      const validation = forgotPasswordSchema.safeParse(body);

      if (!validation.success) {
        const errors: Record<string, string[]> = {};
        for (const issue of validation.error.issues) {
          const path = issue.path.join('.');
          if (!errors[path]) {
            errors[path] = [];
          }
          errors[path].push(issue.message);
        }
        throw new ValidationError('Erro de validação ao solicitar redefinição de senha', errors);
      }

      const { email } = validation.data;
      const result = await authService.requestPasswordReset(email);

      return Response.json(result);
    } catch (error) {
      return handleApiError(error);
    }
  }

  async resetPassword(req: Request) {
    try {
      const body = await req.json();
      const validation = resetPasswordSchema.safeParse(body);

      if (!validation.success) {
        const errors: Record<string, string[]> = {};
        for (const issue of validation.error.issues) {
          const path = issue.path.join('.');
          if (!errors[path]) {
            errors[path] = [];
          }
          errors[path].push(issue.message);
        }
        throw new ValidationError('Erro de validação ao redefinir senha', errors);
      }

      const { token, password } = validation.data;
      const result = await authService.resetPassword(token, password);

      return Response.json(result);
    } catch (error) {
      return handleApiError(error);
    }
  }
}

export const authController = new AuthController();

