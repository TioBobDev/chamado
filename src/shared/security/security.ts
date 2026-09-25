import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'segredo_padrao_chamados_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

export interface UserSessionPayload {
  userId: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  companyId: string;
  avatarUrl?: string | null;
  changePasswordRequired?: boolean;
}

export const security = {
  /**
   * Hasheia uma senha limpa usando bcrypt.
   */
  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  },

  /**
   * Compara uma senha limpa com um hash bcrypt.
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  },

  /**
   * Assina um token JWT com as informações do usuário.
   */
  signToken(payload: UserSessionPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
  },

  /**
   * Verifica um token JWT e extrai o payload. Retorna null se for inválido ou expirado.
   */
  verifyToken(token: string): UserSessionPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as UserSessionPayload;
    } catch {
      return null;
    }
  },
};
