import { getCurrentUserSession } from '@/modules/departments/controllers/department.controller';
import { handleApiError, ValidationError } from '@/shared/errors/errors';
import { userProfileService } from '../services/user-profile.service';
import { updateProfileSchema } from '../validators/user-profile.validator';

export class UserProfileController {
  async getProfile(req: Request) {
    try {
      const session = await getCurrentUserSession();
      const profile = await userProfileService.getProfile(session.userId);
      return Response.json(profile);
    } catch (error) {
      return handleApiError(error);
    }
  }

  async updateProfile(req: Request) {
    try {
      const session = await getCurrentUserSession();
      const body = await req.json();

      const validation = updateProfileSchema.safeParse(body);
      if (!validation.success) {
        const errors: Record<string, string[]> = {};
        for (const issue of validation.error.issues) {
          const path = issue.path.join('.');
          if (!errors[path]) errors[path] = [];
          errors[path].push(issue.message);
        }
        throw new ValidationError('Erro na validação do perfil.', errors);
      }

      const updatedUser = await userProfileService.updateProfile(
        session.userId,
        session.companyId,
        validation.data
      );

      return Response.json({
        success: true,
        message: 'Dados do perfil atualizados com sucesso.',
        user: updatedUser,
      });
    } catch (error) {
      return handleApiError(error);
    }
  }

  async uploadAvatar(req: Request) {
    try {
      const session = await getCurrentUserSession();
      const formData = await req.formData();
      const file = (formData.get('file') || formData.get('avatar')) as File | null;

      if (!file) {
        throw new ValidationError('Nenhum arquivo de imagem foi enviado.');
      }

      const arrayBuffer = await file.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      const result = await userProfileService.uploadAvatar(
        session.userId,
        session.companyId,
        fileBuffer,
        file.name,
        file.type
      );

      return Response.json({
        success: true,
        message: 'Foto de perfil atualizada com sucesso!',
        avatarUrl: result.avatarUrl,
      });
    } catch (error) {
      return handleApiError(error);
    }
  }

  async removeAvatar(req: Request) {
    try {
      const session = await getCurrentUserSession();
      await userProfileService.removeAvatar(session.userId, session.companyId);

      return Response.json({
        success: true,
        message: 'Foto de perfil removida com sucesso.',
      });
    } catch (error) {
      return handleApiError(error);
    }
  }
}

export const userProfileController = new UserProfileController();
