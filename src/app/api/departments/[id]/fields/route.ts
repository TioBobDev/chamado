import { departmentController } from '@/modules/departments/controllers/department.controller';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return departmentController.getCustomFields(id);
}
