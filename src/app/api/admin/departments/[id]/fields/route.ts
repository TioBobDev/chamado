import { getCurrentUserSession } from '@/modules/departments/controllers/department.controller';
import { handleApiError, UnauthorizedError, ValidationError, AppError } from '@/shared/errors/errors';
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

    const validTypes = ['TEXT', 'NUMBER', 'SELECT', 'DATE', 'BOOLEAN', 'CHECKBOX'];
    if (!type || !validTypes.includes(type)) {
      throw new ValidationError('Tipo de campo inválido.');
    }

    const isOptionField = type === 'SELECT' || type === 'CHECKBOX';
    if (isOptionField && (!options || !options.trim())) {
      throw new ValidationError('Informe pelo menos uma opção para o campo de seleção/checkbox.');
    }

    // Cria o campo dinâmico
    let newField;
    try {
      newField = await prisma.ticketCustomField.create({
        data: {
          name: name.trim(),
          type: type as CustomFieldType,
          options: isOptionField ? options.trim() : null,
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
    } catch (createErr: any) {
      console.warn('[FALLBACK SQL] Falha no Prisma create, tentando inserção SQL direta:', createErr.message);
      const fieldId = crypto.randomUUID();
      const targetCatId = categoryId && categoryId.trim() !== '' ? categoryId : null;
      const cleanOptions = isOptionField ? options.trim() : null;

      await prisma.$executeRawUnsafe(
        `INSERT INTO ticket_custom_fields (id, name, type, options, department_id, category_id, company_id, is_required, active, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(3), NOW(3))`,
        fieldId,
        name.trim(),
        type,
        cleanOptions,
        departmentId,
        targetCatId,
        session.companyId,
        isRequired ? 1 : 0
      );

      newField = {
        id: fieldId,
        name: name.trim(),
        type,
        options: cleanOptions,
        isRequired: !!isRequired,
        departmentId,
        categoryId: targetCatId,
        companyId: session.companyId,
        active: true,
        category: null,
      };
    }

    return Response.json(newField, { status: 201 });
  } catch (error: any) {
    console.error('[ERRO API CAMPOS]:', error);
    if (error instanceof AppError) {
      return handleApiError(error);
    }
    return Response.json(
      { message: error?.message || 'Ocorreu um erro interno no servidor.' },
      { status: 500 }
    );
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
