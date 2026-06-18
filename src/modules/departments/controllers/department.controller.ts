import { departmentService } from '../services/department.service';
import { handleApiError, UnauthorizedError } from '@/shared/errors/errors';
import { security } from '@/shared/security/security';
import { prisma } from '@/shared/database/database';
import { cookies } from 'next/headers';

export async function getCurrentUserSession() {
  const cookieName = process.env.COOKIE_NAME || 'chamado_session';
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;
  
  if (!token) {
    throw new UnauthorizedError('Sessão inválida ou não autenticada.');
  }
  
  const session = security.verifyToken(token);
  if (!session) {
    throw new UnauthorizedError('Sessão expirada ou inválida.');
  }
  
  return session;
}

export class DepartmentController {
  async listDepartments(req: Request) {
    try {
      const session = await getCurrentUserSession();
      const url = new URL(req.url);
      const excludeMyDepartments = url.searchParams.get('excludeMyDepartments') === 'true';

      let departments = await departmentService.getCompanyDepartments(session.companyId);

      if (excludeMyDepartments) {
        const userDepts = await prisma.userDepartment.findMany({
          where: { userId: session.userId },
          select: { departmentId: true },
        });
        const myDeptIds = userDepts.map((ud) => ud.departmentId);
        departments = departments.filter((d) => !myDeptIds.includes(d.id));
      }

      return Response.json(departments);
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getCustomFields(departmentId: string) {
    try {
      await getCurrentUserSession(); // Garante autenticação
      const fields = await departmentService.getDepartmentCustomFields(departmentId);
      return Response.json(fields);
    } catch (error) {
      return handleApiError(error);
    }
  }
}

export const departmentController = new DepartmentController();
