const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || 'mysql://root:123456@localhost:3306/chamado';
const adapter = new PrismaMariaDb(dbUrl);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Iniciando carga de dados iniciais (Seed)...');

  // 1. Criptografar senha padrão para usuários de teste
  const passwordHash = await bcrypt.hash('password123', 10);

  // 2. Criar Empresa Principal (Multiempresa / Tenant)
  const company = await prisma.company.upsert({
    where: { id: 'company-default-id' },
    update: {},
    create: {
      id: 'company-default-id',
      name: 'Empresa Demo Corp',
      active: true,
    },
  });
  console.log('Empresa demo cadastrada.');

  // 3. Criar Perfis (Roles)
  const roles = [
    { id: 'role-admin', name: 'Administrador', description: 'Acesso total às configurações do sistema' },
    { id: 'role-manager', name: 'Coordenador', description: 'Vê e Interage com todos os chamados do setor' },
    { id: 'role-attendant', name: 'Atendente', description: 'Resolve chamados e interage com os solicitantes' },
    { id: 'role-requester', name: 'Solicitante', description: 'Abre chamados e acompanha o andamento' },
    { id: 'role-auditor', name: 'Auditor', description: 'Apenas visualiza dados e logs de auditoria' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: { name: role.name, description: role.description },
      create: role,
    });
  }
  console.log('Perfis (Roles) cadastrados.');

  // 4. Criar Permissões
  const permissions = [
    { id: 'perm-config', name: 'config_system', description: 'Configurar definições globais' },
    { id: 'perm-users', name: 'manage_users', description: 'Gerenciar usuários do sistema' },
    { id: 'perm-workflows', name: 'create_workflows', description: 'Cadastrar fluxos e regras' },
    { id: 'perm-tickets-create', name: 'create_tickets', description: 'Abrir chamados' },
    { id: 'perm-tickets-update', name: 'update_tickets', description: 'Atualizar dados de chamados' },
    { id: 'perm-tickets-view-all', name: 'view_all_tickets', description: 'Visualizar todos os chamados da empresa' },
    { id: 'perm-comments-add', name: 'add_comments', description: 'Adicionar comentários nos chamados' },
    { id: 'perm-audit', name: 'view_audit_logs', description: 'Visualizar logs de auditoria' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { id: perm.id },
      update: { description: perm.description },
      create: perm,
    });
  }
  console.log('Permissões cadastradas.');

  // 5. Vincular Permissões aos Perfis (RolePermission)
  // Limpa vínculos antigos para evitar duplicidade no seed
  await prisma.rolePermission.deleteMany({});

  const rolePermissionsMap = {
    'role-admin': ['perm-config', 'perm-users', 'perm-workflows', 'perm-tickets-create', 'perm-tickets-update', 'perm-tickets-view-all', 'perm-comments-add', 'perm-audit'],
    'role-manager': ['perm-tickets-create', 'perm-tickets-update', 'perm-tickets-view-all', 'perm-comments-add', 'perm-audit'],
    'role-attendant': ['perm-tickets-create', 'perm-tickets-update', 'perm-tickets-view-all', 'perm-comments-add'],
    'role-requester': ['perm-tickets-create', 'perm-comments-add'],
    'role-auditor': ['perm-tickets-view-all', 'perm-audit'],
  };

  for (const [roleId, permIds] of Object.entries(rolePermissionsMap)) {
    for (const permissionId of permIds) {
      await prisma.rolePermission.create({
        data: { roleId, permissionId },
      });
    }
  }
  console.log('Mapeamento de perfis e permissões concluído.');

  // 6. Cadastrar Usuários de Teste (um para cada perfil)
  const users = [
    { id: 'usr-admin', name: 'Admin do Sistema', email: 'admin@company.com', roleId: 'role-admin' },
    { id: 'usr-manager', name: 'Coordenador Demo', email: 'coordenador@company.com', roleId: 'role-manager' },
    { id: 'usr-attendant', name: 'Atendente N1', email: 'atendente@company.com', roleId: 'role-attendant' },
    { id: 'usr-requester', name: 'Solicitante Demo', email: 'solicitante@company.com', roleId: 'role-requester' },
    { id: 'usr-auditor', name: 'Auditor Fiscal', email: 'auditor@company.com', roleId: 'role-auditor' },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: { name: u.name, email: u.email, roleId: u.roleId },
      create: {
        id: u.id,
        name: u.name,
        email: u.email,
        passwordHash,
        roleId: u.roleId,
        companyId: 'company-default-id',
        active: true,
        changePasswordRequired: false,
      },
    });
  }
  console.log('Usuários de demonstração criados (Senha comum: password123).');

  // 7. Departamentos
  const departments = [
    { id: 'dept-ti', name: 'Tecnologia da Informação' },
    { id: 'dept-rh', name: 'Recursos Humanos' },
    { id: 'dept-fin', name: 'Financeiro' },
  ];

  for (const d of departments) {
    await prisma.department.upsert({
      where: { id: d.id },
      update: { name: d.name },
      create: {
        id: d.id,
        name: d.name,
        companyId: 'company-default-id',
      },
    });
  }
  console.log('Departamentos cadastrados.');

  // 8. Equipes (Teams)
  const teams = [
    { id: 'team-suporte-n1', name: 'Suporte N1', departmentId: 'dept-ti' },
    { id: 'team-infra', name: 'Infraestrutura', departmentId: 'dept-ti' },
    { id: 'team-dev', name: 'Desenvolvimento', departmentId: 'dept-ti' },
    { id: 'team-rh-geral', name: 'Atendimento RH', departmentId: 'dept-rh' },
  ];

  for (const t of teams) {
    await prisma.team.upsert({
      where: { id: t.id },
      update: { name: t.name },
      create: {
        id: t.id,
        name: t.name,
        departmentId: t.departmentId,
      },
    });
  }
  console.log('Equipes cadastradas.');

  // 9. Vincular Atendente na equipe Suporte N1
  await prisma.userTeam.upsert({
    where: { userId_teamId: { userId: 'usr-attendant', teamId: 'team-suporte-n1' } },
    update: {},
    create: { userId: 'usr-attendant', teamId: 'team-suporte-n1' },
  });
  console.log('Vínculo de atendente em equipes configurado.');

  // 9.1 Vincular Usuários aos Setores (UserDepartment)
  const userDepts = [
    { userId: 'usr-admin', departmentId: 'dept-ti' },
    { userId: 'usr-admin', departmentId: 'dept-rh' },
    { userId: 'usr-admin', departmentId: 'dept-fin' },
    { userId: 'usr-attendant', departmentId: 'dept-ti' },
    { userId: 'usr-manager', departmentId: 'dept-rh' },
  ];

  for (const ud of userDepts) {
    await prisma.userDepartment.upsert({
      where: { userId_departmentId: { userId: ud.userId, departmentId: ud.departmentId } },
      update: {},
      create: ud,
    });
  }
  console.log('Vínculo de atendentes em setores configurado.');

  // 10. Status de Chamados (TicketStatus)
  const statuses = [
    { id: 'status-aberto', name: 'Aberto', color: '#3b82f6', isInitial: true, isFinal: false },
    { id: 'status-atendimento', name: 'Em Atendimento', color: '#f59e0b', isInitial: false, isFinal: false },
    { id: 'status-aguardando', name: 'Aguardando Retorno', color: '#8b5cf6', isInitial: false, isFinal: false },
    { id: 'status-resolvido', name: 'Resolvido', color: '#10b981', isInitial: false, isFinal: false },
    { id: 'status-fechado', name: 'Fechado', color: '#6b7280', isInitial: false, isFinal: true },
  ];

  for (const s of statuses) {
    await prisma.ticketStatus.upsert({
      where: { id: s.id },
      update: { name: s.name, color: s.color, isInitial: s.isInitial, isFinal: s.isFinal },
      create: {
        id: s.id,
        name: s.name,
        color: s.color,
        isInitial: s.isInitial,
        isFinal: s.isFinal,
        companyId: 'company-default-id',
      },
    });
  }
  console.log('Status de chamados cadastrados.');

  // 11. Categorias de Chamados (TicketCategory)
  const categories = [
    { id: 'cat-equip', name: 'Problema no Equipamento', departmentId: 'dept-ti' },
    { id: 'cat-sistema', name: 'Erro no Sistema', departmentId: 'dept-ti' },
    { id: 'cat-folha', name: 'Folha de Pagamento', departmentId: 'dept-rh' },
    { id: 'cat-ferias', name: 'Férias', departmentId: 'dept-rh' },
  ];

  for (const c of categories) {
    await prisma.ticketCategory.upsert({
      where: { id: c.id },
      update: { name: c.name },
      create: {
        id: c.id,
        name: c.name,
        departmentId: c.departmentId,
        companyId: 'company-default-id',
      },
    });
  }
  console.log('Categorias cadastradas.');

  // 12. Campos Customizados (TicketCustomField)
  const customFields = [
    { id: 'cf-ip', name: 'Endereço IP do Equipamento', type: 'TEXT', isRequired: false, departmentId: 'dept-ti' },
    { id: 'cf-sistema-nome', name: 'Sistema Afetado', type: 'TEXT', isRequired: true, departmentId: 'dept-ti' },
    { id: 'cf-hw-tipo', name: 'Tipo de Hardware', type: 'SELECT', options: 'Notebook,Desktop,Monitor,Periférico', isRequired: true, departmentId: 'dept-ti' },
    { id: 'cf-colaborador-nome', name: 'Nome do Colaborador Afetado', type: 'TEXT', isRequired: true, departmentId: 'dept-rh' },
    { id: 'cf-doc-tipo', name: 'Tipo de Documento Requerido', type: 'SELECT', options: 'Holerite,Informe de Rendimentos,Comprovante de Férias', isRequired: true, departmentId: 'dept-rh' },
  ];

  for (const cf of customFields) {
    await prisma.ticketCustomField.upsert({
      where: { id: cf.id },
      update: { name: cf.name, type: cf.type, options: cf.options, isRequired: cf.isRequired },
      create: {
        id: cf.id,
        name: cf.name,
        type: cf.type,
        options: cf.options,
        isRequired: cf.isRequired,
        departmentId: cf.departmentId,
        companyId: 'company-default-id',
      },
    });
  }
  console.log('Campos customizados cadastrados.');

  // 13. Regras de SLA (SlaRule)
  const slaRules = [
    { id: 'sla-ti-alta', name: 'TI Alta Prioridade', priority: 'HIGH', responseTimeMinutes: 30, resolutionTimeMinutes: 240, departmentId: 'dept-ti' },
    { id: 'sla-ti-media', name: 'TI Média Prioridade', priority: 'MEDIUM', responseTimeMinutes: 120, resolutionTimeMinutes: 480, departmentId: 'dept-ti' },
    { id: 'sla-rh-geral', name: 'RH SLA Padrão', priority: 'MEDIUM', responseTimeMinutes: 240, resolutionTimeMinutes: 1440, departmentId: 'dept-rh' },
  ];

  for (const rule of slaRules) {
    await prisma.slaRule.upsert({
      where: { id: rule.id },
      update: { responseTimeMinutes: rule.responseTimeMinutes, resolutionTimeMinutes: rule.resolutionTimeMinutes },
      create: {
        id: rule.id,
        name: rule.name,
        priority: rule.priority,
        responseTimeMinutes: rule.responseTimeMinutes,
        resolutionTimeMinutes: rule.resolutionTimeMinutes,
        departmentId: rule.departmentId,
        companyId: 'company-default-id',
      },
    });
  }
  console.log('Regras de SLA configuradas.');

  // 14. Workflows e WorkflowSteps
  // Workflow TI
  const wfTi = await prisma.workflow.upsert({
    where: { id: 'wf-ti' },
    update: { active: true },
    create: {
      id: 'wf-ti',
      name: 'Fluxo Padrão TI',
      departmentId: 'dept-ti',
      companyId: 'company-default-id',
      active: true,
    },
  });

  const wfTiSteps = [
    { id: 'wf-ti-step1', workflowId: 'wf-ti', name: 'Triagem Inicial', statusId: 'status-aberto', sequence: 1, nextStatusIds: 'status-atendimento,status-fechado' },
    { id: 'wf-ti-step2', workflowId: 'wf-ti', name: 'Em Atendimento', statusId: 'status-atendimento', sequence: 2, nextStatusIds: 'status-aguardando,status-resolvido', assignedTeamId: 'team-suporte-n1' },
    { id: 'wf-ti-step3', workflowId: 'wf-ti', name: 'Aguardando Cliente', statusId: 'status-aguardando', sequence: 3, nextStatusIds: 'status-atendimento,status-resolvido' },
    { id: 'wf-ti-step4', workflowId: 'wf-ti', name: 'Verificação Solução', statusId: 'status-resolvido', sequence: 4, nextStatusIds: 'status-fechado,status-atendimento' },
    { id: 'wf-ti-step5', workflowId: 'wf-ti', name: 'Fechado', statusId: 'status-fechado', sequence: 5, nextStatusIds: 'status-aberto' },
  ];

  for (const step of wfTiSteps) {
    await prisma.workflowStep.upsert({
      where: { id: step.id },
      update: { name: step.name, sequence: step.sequence, nextStatusIds: step.nextStatusIds, assignedTeamId: step.assignedTeamId },
      create: step,
    });
  }
  console.log('Workflow de TI cadastrado.');

  console.log('Carga de dados de demonstração concluída com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro ao rodar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
