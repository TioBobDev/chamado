import { slaConfigController } from '@/modules/sla/controllers/sla-config.controller';

export async function GET(request: Request) {
  return slaConfigController.list(request);
}

export async function PUT(request: Request) {
  return slaConfigController.update(request);
}
