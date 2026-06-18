import { departmentController } from '@/modules/departments/controllers/department.controller';

export async function GET(request: Request) {
  return departmentController.listDepartments(request);
}
