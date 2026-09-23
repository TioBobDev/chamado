import { getCurrentUserSession } from '@/modules/departments/controllers/department.controller';
import { handleApiError, UnauthorizedError, ValidationError } from '@/shared/errors/errors';
import { prisma } from '@/shared/database/database';
import { CustomFieldType } from '@prisma/client';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentUserSession();
    if (session.role !== 'Administrador') {
      throw new UnauthorizedError('Acesso negado. Apenas administradores podem gerenciar campos personalizados.');
    }

    const { id: departmentId } = await context.params;
    const { name, type, options, isRequired, categoryId } = await request.json();

    if (!name || name.trim().length === 0) {
      throw new ValidationError('O nome do campo é obrigatório.');
    }

    if (!type || !Object.values(CustomFieldType).includes(type)) {
      throw new ValidationError('Tipo de campo inválido.');
    }

    // Cria o campo dinâmico
    const newField = await prisma.ticketCustomField.create({
      data: {
        name: name.trim(),
        type,
        options: type === CustomFieldType.SELECT ? options : null,
        isRequired: !!isRequired,
        departmentId,
        categoryId: categoryId && categoryId.trim() !== '' ? categoryId : null,
        companyId: session.companyId,
        active: true,
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    return Response.json(newField, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentUserSession();
    if (session.role !== 'Administrador') {
      throw new UnauthorizedError('Acesso negado. Apenas administradores podem gerenciar campos personalizados.');
    }

    const url = new URL(request.url);
    const fieldId = url.searchParams.get('fieldId');

    if (!fieldId) {
      throw new ValidationError('O ID do campo é obrigatório.');
    }

    // Inativa o campo personalizado (para preservar o histórico de chamados que o utilizavam)
    await prisma.ticketCustomField.update({
      where: { id: fieldId },
      data: { active: false },
    });

    return Response.json({ success: true, message: 'Campo personalizado removido com sucesso.' });
  } catch (error) {
    return handleApiError(error);
  }
}
