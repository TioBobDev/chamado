import { getCurrentUserSession } from '@/modules/departments/controllers/department.controller';
import { handleApiError } from '@/shared/errors/errors';

export async function GET() {
  try {
    const session = await getCurrentUserSession();
    return Response.json({
      id: session.userId,
      name: session.name,
      email: session.email,
      role: session.role,
      permissions: session.permissions,
      companyId: session.companyId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
