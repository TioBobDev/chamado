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
    const exists = await departmentRepository.exists(departmentId);
    if (!exists) {
      throw new NotFoundError('Departamento não encontrado.');
    }
    const cleanCategoryId = categoryId && categoryId !== 'null' && categoryId !== 'undefined' ? categoryId : null;
    return departmentRepository.getCustomFieldsByDepartment(departmentId, cleanCategoryId);
  }
}

export const departmentService = new DepartmentService();
