import { userProfileController } from '@/modules/users/controllers/user-profile.controller';

export async function POST(request: Request) {
  return userProfileController.uploadAvatar(request);
}

export async function DELETE(request: Request) {
  return userProfileController.removeAvatar(request);
}
