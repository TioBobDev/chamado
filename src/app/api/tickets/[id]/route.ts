import { ticketController } from '@/modules/tickets/controllers/ticket.controller';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return ticketController.get(id);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return ticketController.update(request, id);
}
