import { authController } from '@/modules/authentication/controllers/auth.controller';

export async function POST(request: Request) {
  return authController.forgotPassword(request);
}
