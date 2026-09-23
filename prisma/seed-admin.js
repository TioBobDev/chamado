const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || 'mysql://root:123456@localhost:3306/chamado';
const adapter = new PrismaMariaDb(dbUrl);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Iniciando provisionamento do Administrador e estrutura base...');

  // 1. Criar Empresa Principal
  const company = await prisma.company.upsert({
    where: { id: 'company-default-id' },
    update: {},
    create: {
      id: 'company-default-id',
      name: 'Canção Nova Cuiabá',
      active: true,
    },
  });
  console.log(`✓ Empresa "${company.name}" configurada.`);

  // 2. Perfis de Acesso (Roles)
  const roles = [
    { id: 'role-admin', name: 'Administrador', description: 'Acesso total às configurações do sistema' },
    { id: 'role-manager', name: 'Coordenador', description: 'Vê e interage com todos os chamados do setor' },
    { id: 'role-attendant', name: 'Atendente', description: 'Resolve chamados e interage com os solicitantes' },
    { id: 'role-requester', name: 'Solicitante', description: 'Abre chamados e acompanha o andamento' },
    { id: 'role-auditor', name: 'Auditor', description: 'Visualiza dados e relatórios de auditoria' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: { name: role.name, description: role.description },
      create: role,
    });
  }
  console.log('✓ Perfis de acesso criados.');

  // 3. Permissões Essenciais
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

  // 4. Mapear Permissões para o Perfil de Administrador
  await prisma.rolePermission.deleteMany({ where: { roleId: 'role-admin' } });
  for (const perm of permissions) {
    await prisma.rolePermission.create({
      data: { roleId: 'role-admin', permissionId: perm.id },
    });
  }
  console.log('✓ Permissões vinculadas ao perfil de Administrador.');

  // 5. Status Padrão para o ciclo de vida dos chamados
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
  console.log('✓ Status de chamados configurados.');

  // 6. Setor Inicial Padrão
  const defaultDept = await prisma.department.upsert({
    where: { id: 'dept-geral' },
    update: {},
    create: {
      id: 'dept-geral',
      name: 'Geral',
      companyId: 'company-default-id',
    },
  });

  // 7. Criar APENAS o Usuário Administrador
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@cancaonovacuiaba.com.br';
  const defaultPassword = process.env.ADMIN_INITIAL_PASSWORD || 'Admin@123456';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      roleId: 'role-admin',
      active: true,
    },
    create: {
      id: 'usr-admin',
      name: 'Administrador',
      email: adminEmail,
      passwordHash,
      roleId: 'role-admin',
      companyId: 'company-default-id',
      active: true,
      changePasswordRequired: false,
    },
  });

  // Vincula o administrador ao setor padrão
  await prisma.userDepartment.upsert({
    where: {
      userId_departmentId: {
        userId: adminUser.id,
        departmentId: defaultDept.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      departmentId: defaultDept.id,
    },
  });

  console.log('\n======================================================');
  console.log('✅ USUÁRIO ADMINISTRADOR CRIADO COM SUCESSO!');
  console.log(`• E-mail: ${adminEmail}`);
  console.log(`• Senha:  ${defaultPassword}`);
  console.log('======================================================\n');
}

main()
  .catch((e) => {
    console.error('Erro ao provisionar administrador:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
