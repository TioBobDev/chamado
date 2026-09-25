import { prisma } from '@/shared/database/database';
import { security } from '@/shared/security/security';
import { storageService } from '@/shared/storage/storage';
import { NotFoundError, ValidationError } from '@/shared/errors/errors';
import { UpdateProfileInput } from '../validators/user-profile.validator';
import path from 'path';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

export class UserProfileService {
  /**
   * Obtém os dados completos do perfil do usuário autenticado
   */
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
        role: {
          select: { id: true, name: true, description: true },
        },
        company: {
          select: { id: true, name: true },
        },
        departments: {
          select: {
            department: {
              select: { id: true, name: true },
            },
          },
        },
        teams: {
          select: {
            team: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('Usuário não encontrado.');
    }

    return {
      ...user,
      departments: user.departments.map((d) => d.department),
      teams: user.teams.map((t) => t.team),
    };
  }

  /**
   * Atualiza dados cadastrais (nome, e-mail e opcionalmente senha)
   */
  async updateProfile(userId: string, companyId: string, data: UpdateProfileInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('Usuário não encontrado.');
    }

    // Se o e-mail foi alterado, verificar se já não está em uso por outro usuário
    if (data.email.toLowerCase() !== user.email.toLowerCase()) {
      const emailExists = await prisma.user.findFirst({
        where: {
          email: data.email.toLowerCase(),
          id: { not: userId },
        },
      });

      if (emailExists) {
        throw new ValidationError('O e-mail informado já está em uso por outra conta.');
      }
    }

    const updates: any = {
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
    };

    // Alteração opcional de senha
    if (data.newPassword && data.newPassword.trim().length > 0) {
      if (!data.currentPassword) {
        throw new ValidationError('Informe sua senha atual para definir uma nova senha.');
      }

      const isCurrentValid = await security.comparePassword(data.currentPassword, user.passwordHash);
      if (!isCurrentValid) {
        throw new ValidationError('A senha atual informada está incorreta.');
      }

      updates.passwordHash = await security.hashPassword(data.newPassword.trim());
      updates.changePasswordRequired = false;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: { select: { id: true, name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'UPDATE_USER_PROFILE',
        entityName: 'User',
        entityId: userId,
        details: JSON.stringify({
          updatedFields: Object.keys(updates).filter((k) => k !== 'passwordHash'),
          passwordChanged: !!data.newPassword,
        }),
      },
    });

    return updatedUser;
  }

  /**
   * Faz upload e vincula a foto/avatar do usuário
   */
  async uploadAvatar(
    userId: string,
    companyId: string,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string
  ) {
    if (!ALLOWED_IMAGE_TYPES.includes(mimeType.toLowerCase())) {
      throw new ValidationError('Formato inválido. Apenas imagens JPEG, PNG, WEBP ou GIF são aceitas.');
    }

    if (fileBuffer.length > MAX_AVATAR_SIZE) {
      throw new ValidationError('A foto excede o tamanho máximo permitido de 5MB.');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, avatarUrl: true },
    });

    if (!user) {
      throw new NotFoundError('Usuário não encontrado.');
    }

    // Salvar novo arquivo em storage/uploads/avatars/
    const uploadResult = await storageService.upload(
      fileBuffer,
      originalName,
      mimeType,
      'avatars'
    );

    // O arquivo relativo será por exemplo "avatars/uuid.jpg"
    const fileName = path.basename(uploadResult.path);
    const newAvatarUrl = `/api/users/avatar/${fileName}`;

    // Excluir avatar anterior do disco se for um arquivo local
    if (user.avatarUrl && user.avatarUrl.startsWith('/api/users/avatar/')) {
      const oldFileName = user.avatarUrl.replace('/api/users/avatar/', '');
      await storageService.delete(path.join('avatars', oldFileName)).catch(() => {});
    }

    // Atualizar no banco
    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: newAvatarUrl },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'UPLOAD_USER_AVATAR',
        entityName: 'User',
        entityId: userId,
        details: JSON.stringify({ fileName }),
      },
    });

    return {
      success: true,
      avatarUrl: newAvatarUrl,
    };
  }

  /**
   * Remove o avatar do usuário, voltando para o padrão com iniciais
   */
  async removeAvatar(userId: string, companyId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, avatarUrl: true },
    });

    if (!user) {
      throw new NotFoundError('Usuário não encontrado.');
    }

    if (user.avatarUrl && user.avatarUrl.startsWith('/api/users/avatar/')) {
      const fileName = user.avatarUrl.replace('/api/users/avatar/', '');
      await storageService.delete(path.join('avatars', fileName)).catch(() => {});
    }

    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'REMOVE_USER_AVATAR',
        entityName: 'User',
        entityId: userId,
        details: 'Avatar do usuário removido.',
      },
    });

    return { success: true };
  }
}

export const userProfileService = new UserProfileService();
