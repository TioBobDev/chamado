import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Função utilitária para decodificar JWT na Edge Runtime sem dependências nativas
function decodeJwtPayload(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    // Decodifica caracteres não-ASCII corretamente
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const cookieName = process.env.COOKIE_NAME || 'chamado_session';
  const token = request.cookies.get(cookieName)?.value;
  const { pathname } = request.nextUrl;

  // 1. Verificar se a rota é do painel de controle (dashboard)
  if (pathname.startsWith('/dashboard')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const payload = decodeJwtPayload(token);
    // Token corrompido ou expirado
    if (!payload || (payload.exp && Date.now() >= payload.exp * 1000)) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete(cookieName);
      return response;
    }

    // 2. Forçar alteração de senha no primeiro acesso
    if (payload.changePasswordRequired === true && pathname !== '/dashboard/change-password') {
      return NextResponse.redirect(new URL('/dashboard/change-password', request.url));
    }

    // 3. Proteção de rotas administrativas
    if (pathname.startsWith('/dashboard/admin')) {
      const userRole = payload.role;
      if (userRole !== 'Administrador') {
        // Redireciona solicitantes/atendentes de volta ao painel comum
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  // 3. Se já estiver autenticado e tentar acessar login, envia para o dashboard
  if (pathname.startsWith('/login') && token) {
    const payload = decodeJwtPayload(token);
    if (payload && (!payload.exp || Date.now() < payload.exp * 1000)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

// Configurar o matcher para interceptar apenas rotas de interesse
export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};
