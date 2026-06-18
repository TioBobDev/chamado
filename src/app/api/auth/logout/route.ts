import { authController } from '@/modules/authentication/controllers/auth.controller';

export async function POST(request: Request) {
  await authController.logout();
  const url = new URL(request.url);
  return Response.redirect(new URL('/login', url.origin));
}

export async function GET(request: Request) {
  await authController.logout();
  const url = new URL(request.url);
  return Response.redirect(new URL('/login', url.origin));
}
