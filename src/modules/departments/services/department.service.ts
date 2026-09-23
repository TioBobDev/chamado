import { departmentRepository } from '../repositories/department.repository';
import { NotFoundError } from '@/shared/errors/errors';

export class DepartmentService {
  async getCompanyDepartments(companyId: string) {
    return departmentRepository.listByCompany(companyId);
  }

  async getDepartmentDetails(departmentId: string) {
    const department = await departmentRepository.findById(departmentId);
    if (!department) {
      throw new NotFoundError('Departamento não encontrado.');
    }
    return department;
  }

  async getDepartmentCustomFields(departmentId: string, categoryId?: string | null) {
    const department = await departmentRepository.findById(departmentId);
    if (!department) {
      throw new NotFoundError('Departamento não encontrado.');
    }
    return departmentRepository.getCustomFieldsByDepartment(departmentId, categoryId);
  }
}

export const departmentService = new DepartmentService();
