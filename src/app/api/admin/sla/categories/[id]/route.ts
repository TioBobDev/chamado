import { slaConfigController } from '@/modules/sla/controllers/sla-config.controller';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return slaConfigController.updateCategoryRule(request, id);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return slaConfigController.deleteCategoryRule(request, id);
}
