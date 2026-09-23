const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || 'mysql://root:123456@localhost:3306/chamado';
const adapter = new PrismaMariaDb(dbUrl);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- LIMPANDO E RESETANDO BANCO DE DADOS ---');

  // 1. Limpeza Completa das Tabelas via DELETE
  const tables = [
    'ticket_custom_values',
    'ticket_attachments',
    'ticket_comments',
    'ticket_history',
    'notifications',
    'audit_logs',
    'password_reset_tokens',
    'tickets',
    'ticket_custom_fields',
    'sla_rules',
    'workflow_transitions',
    'workflow_steps',
    'workflows',
    'ticket_categories',
    'user_teams',
    'teams',
    'user_departments',
    'departments',
    'ticket_status',
    'users',
    'role_permissions',
    'permissions',
    'roles',
    'companies',
  ];

  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');
  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM \`${table}\`;`);
    } catch (e) {
      // Ignora erro se tabela não existir
    }
  }
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
  console.log('✓ Tabelas limpas com sucesso.');

  // 2. Criar Empresa Principal
  const company = await prisma.company.upsert({
    where: { id: 'company-default-id' },
    update: { name: 'Canção Nova Cuiabá', active: true },
    create: {
      id: 'company-default-id',
      name: 'Canção Nova Cuiabá',
      active: true,
    },
  });
  console.log(`✓ Empresa "${company.name}" configurada.`);

  // 3. Criar Perfis (Roles)
  const roles = [
    { id: 'role-admin', name: 'Administrador', description: 'Acesso total às configurações do sistema' },
    { id: 'role-manager', name: 'Coordenador', description: 'Vê e interage com todos os chamados do setor' },
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
  console.log('✓ Perfis de acesso criados.');

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

  // 5. Vincular Permissões aos Perfis
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
  console.log('✓ Permissões vinculadas aos perfis.');

  // 6. Status Padrão para Chamados (3 Estados Consolidados)
  const statuses = [
    { id: 'status-aberto', name: 'Aberto', color: '#3b82f6', isInitial: true, isFinal: false },
    { id: 'status-atendimento', name: 'Em Atendimento', color: '#f59e0b', isInitial: false, isFinal: false },
    { id: 'status-encerrado', name: 'Encerrado', color: '#10b981', isInitial: false, isFinal: true },
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
        companyId: company.id,
      },
    });
  }
  console.log('✓ Status de chamados configurados.');

  // 7. Criar Setores e Categorias Base
  const deptTI = await prisma.department.create({
    data: {
      name: 'Tecnologia da Informação',
      companyId: company.id,
      categories: {
        create: [
          { name: 'Acesso Remoto', companyId: company.id },
          { name: 'Problema no Equipamento', companyId: company.id },
          { name: 'Erro no Sistema', companyId: company.id },
          { name: 'Rede e Conectividade', companyId: company.id },
        ],
      },
    },
    include: { categories: true },
  });

  const deptRH = await prisma.department.create({
    data: {
      name: 'Recursos Humanos',
      companyId: company.id,
      categories: {
        create: [
          { name: 'Admissão de Colaborador', companyId: company.id },
          { name: 'Folha de Pagamento', companyId: company.id },
          { name: 'Férias', companyId: company.id },
        ],
      },
    },
    include: { categories: true },
  });

  const deptFinanceiro = await prisma.department.create({
    data: {
      name: 'Financeiro',
      companyId: company.id,
      categories: {
        create: [
          { name: 'Reembolso de Despesas', companyId: company.id },
          { name: 'Pagamento de Fornecedor', companyId: company.id },
          { name: 'Nota Fiscal', companyId: company.id },
        ],
      },
    },
    include: { categories: true },
  });

  console.log('✓ Setores e Categorias criados: TI, RH, Financeiro.');

  // 8. Criar Campos Dinâmicos de Exemplo Vinculados a Categorias
  const catAcessoRemoto = deptTI.categories.find((c) => c.name === 'Acesso Remoto');
  if (catAcessoRemoto) {
    await prisma.ticketCustomField.create({
      data: {
        name: 'Endereço IP para Acesso Remoto',
        type: 'TEXT',
        departmentId: deptTI.id,
        categoryId: catAcessoRemoto.id,
        companyId: company.id,
        isRequired: true,
      },
    });
  }

  const catHardware = deptTI.categories.find((c) => c.name === 'Problema no Equipamento');
  if (catHardware) {
    await prisma.ticketCustomField.create({
      data: {
        name: 'Tipo de Equipamento',
        type: 'SELECT',
        options: 'Notebook, Desktop, Monitor, Impressora',
        departmentId: deptTI.id,
        categoryId: catHardware.id,
        companyId: company.id,
        isRequired: true,
      },
    });
  }

  console.log('✓ Campos dinâmicos vinculados a categorias criados.');

  // 9. Cadastrar Usuários Default (Senha: Admin@123456)
  const defaultPassword = 'Admin@123456';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const defaultUsers = [
    {
      name: 'Christoffer',
      email: 'crop_raphael@hotmail.com',
      roleId: 'role-admin',
      deptId: deptTI.id,
    },
    {
      name: 'Administrador Canção Nova',
      email: 'admin@cancaonovacuiaba.com.br',
      roleId: 'role-admin',
      deptId: deptTI.id,
    },
    {
      name: 'Coordenador Operacional',
      email: 'coordenador@cancaonovacuiaba.com.br',
      roleId: 'role-manager',
      deptId: deptTI.id,
    },
    {
      name: 'Atendente Suporte TI',
      email: 'atendente@cancaonovacuiaba.com.br',
      roleId: 'role-attendant',
      deptId: deptTI.id,
    },
    {
      name: 'Solicitante Exemplo',
      email: 'solicitante@cancaonovacuiaba.com.br',
      roleId: 'role-requester',
      deptId: deptRH.id,
    },
    {
      name: 'Auditor do Sistema',
      email: 'auditor@cancaonovacuiaba.com.br',
      roleId: 'role-auditor',
      deptId: deptFinanceiro.id,
    },
  ];

  for (const u of defaultUsers) {
    const user = await prisma.user.create({
      data: {
        name: u.name,
        email: u.email,
        passwordHash,
        roleId: u.roleId,
        companyId: company.id,
        active: true,
        changePasswordRequired: false,
      },
    });

    // Vincula ao departamento
    await prisma.userDepartment.create({
      data: {
        userId: user.id,
        departmentId: u.deptId,
      },
    });
  }

  console.log('\n================================================================');
  console.log('🎉 BANCO DE DADOS RESETADO E USUÁRIOS CRIADOS COM SUCESSO!');
  console.log('================================================================');
  console.log('Senha padrão para todos os usuários:', defaultPassword);
  console.log('\nContas cadastradas:');
  for (const u of defaultUsers) {
    console.log(`• ${u.name.padEnd(26)} | ${u.email.padEnd(36)} | Perfil: ${u.roleId}`);
  }
  console.log('================================================================\n');
}

main()
  .catch((e) => {
    console.error('Erro ao resetar banco:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
