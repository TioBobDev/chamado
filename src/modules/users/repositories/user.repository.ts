import { prisma } from '@/shared/database/database';
import { Prisma } from '@prisma/client';

export class UserRepository {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        company: true,
      },
    });
  }

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        company: true,
        teams: {
          include: {
            team: true,
          },
        },
      },
    });
  }

  async create(data: Prisma.UserUncheckedCreateInput) {
    return prisma.user.create({
      data,
    });
  }

  async listByCompany(companyId: string) {
    return prisma.user.findMany({
      where: { companyId },
      include: {
        role: true,
        company: true,
        teams: {
          include: {
            team: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async update(id: string, data: Prisma.UserUncheckedUpdateInput) {
    return prisma.user.update({
      where: { id },
      data,
    });
  }
}

export const userRepository = new UserRepository();
