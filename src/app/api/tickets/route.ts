import { ticketController } from '@/modules/tickets/controllers/ticket.controller';

export async function GET(request: Request) {
  return ticketController.list(request);
}

export async function POST(request: Request) {
  return ticketController.create(request);
}
