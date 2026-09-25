import { slaConfigController } from '@/modules/sla/controllers/sla-config.controller';

export async function GET(request: Request) {
  return slaConfigController.listCategoryRules(request);
}

export async function POST(request: Request) {
  return slaConfigController.createCategoryRule(request);
}
