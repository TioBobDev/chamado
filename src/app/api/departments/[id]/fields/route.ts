import { departmentController } from '@/modules/departments/controllers/department.controller';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const categoryId = url.searchParams.get('categoryId');
  return departmentController.getCustomFields(id, categoryId);
}
