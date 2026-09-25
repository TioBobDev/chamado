import { userProfileController } from '@/modules/users/controllers/user-profile.controller';

export async function GET(request: Request) {
  return userProfileController.getProfile(request);
}

export async function PUT(request: Request) {
  return userProfileController.updateProfile(request);
}
