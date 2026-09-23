import { authController } from '@/modules/authentication/controllers/auth.controller';
import { withBasePath } from '@/shared/utils/api';

function getOrigin(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  if (process.env.APP_URL) {
    try {
      return new URL(process.env.APP_URL).origin;
    } catch {
      // ignore
    }
  }

  const host = request.headers.get('host');
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    return `https://${host}`;
  }

  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  await authController.logout();
  const origin = getOrigin(request);
  return Response.redirect(new URL(withBasePath('/login'), origin));
}

export async function GET(request: Request) {
  await authController.logout();
  const origin = getOrigin(request);
  return Response.redirect(new URL(withBasePath('/login'), origin));
}
