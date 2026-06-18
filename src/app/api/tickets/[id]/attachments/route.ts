import { ticketController } from '@/modules/tickets/controllers/ticket.controller';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return ticketController.uploadAttachment(request, id);
}
