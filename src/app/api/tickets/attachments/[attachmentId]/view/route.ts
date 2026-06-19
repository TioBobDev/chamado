import { ticketRepository } from '@/modules/tickets/repositories/ticket.repository';
import { getCurrentUserSession } from '@/modules/departments/controllers/department.controller';
import { handleApiError, NotFoundError, UnauthorizedError } from '@/shared/errors/errors';
import { storageService } from '@/shared/storage/storage';
import { prisma } from '@/shared/database/database';
import fs from 'fs';

export async function GET(
  request: Request,
  context: { params: Promise<{ attachmentId: string }> }
) {
  try {
    const { attachmentId } = await context.params;
    
    // 1. Validar sessão atual
    const session = await getCurrentUserSession();

    // 2. Localizar registro do anexo
    const attachment = await ticketRepository.findAttachmentById(attachmentId);
    if (!attachment) {
      throw new NotFoundError('Anexo não encontrado.');
    }

    // 3. Garantir consistência de tenant (multiempresa)
    if (attachment.ticket.companyId !== session.companyId) {
      throw new UnauthorizedError('Acesso negado a este anexo.');
    }

    // 4. Validação de visibilidade baseada em Perfil (RBAC)
    const ticket = attachment.ticket;
    const role = session.role;
    const userId = session.userId;
    let isAllowed = false;

    if (role === 'Administrador' || role === 'Auditor') {
      isAllowed = true;
    } else if (role === 'Coordenador' || role === 'Gestor') {
      const userDepts = await prisma.userDepartment.findMany({
        where: { userId },
        select: { departmentId: true },
      });
      const departmentIds = userDepts.map((ud) => ud.departmentId);
      isAllowed = ticket.requesterId === userId || departmentIds.includes(ticket.departmentId);
    } else if (role === 'Atendente') {
      isAllowed = ticket.attendantId === userId || ticket.requesterId === userId;
    } else if (role === 'Solicitante') {
      isAllowed = ticket.requesterId === userId;
    }

    if (!isAllowed) {
      throw new UnauthorizedError('Você não tem permissão para acessar os anexos deste chamado.');
    }

    // 5. Encontrar caminho no disco físico
    const localPath = storageService.getLocalPath(attachment.path);
    if (!fs.existsSync(localPath)) {
      throw new NotFoundError('O arquivo físico não foi encontrado no servidor.');
    }

    // 6. Ler o arquivo e retornar como streaming de resposta binária com cabeçalhos apropriados
    const fileBuffer = await fs.promises.readFile(localPath);
    
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.name)}"`,
        'Content-Length': attachment.size.toString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
