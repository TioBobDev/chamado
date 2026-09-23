import { authController } from '@/modules/authentication/controllers/auth.controller';
import { withBasePath } from '@/shared/utils/api';

export async function POST(request: Request) {
  await authController.logout();
  const url = new URL(request.url);
  return Response.redirect(new URL(withBasePath('/login'), url.origin));
}

export async function GET(request: Request) {
  await authController.logout();
  const url = new URL(request.url);
  return Response.redirect(new URL(withBasePath('/login'), url.origin));
}
