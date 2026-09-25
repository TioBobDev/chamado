const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || 'mysql://root:123456@localhost:3306/chamado';
const adapter = new PrismaMariaDb(dbUrl);
const prisma = new PrismaClient({ adapter });

async function seedSlaRules() {
  console.log('=== CADASTRANDO REGRAS DE SLA PADRÃO ITIL ===\n');

  const company = await prisma.company.findFirst();
  if (!company) {
    console.error('Nenhuma empresa encontrada.');
    return;
  }

  const itilRules = [
    {
      id: 'sla-itil-urgent',
      name: 'SLA Crítico / Urgente (ITIL)',
      priority: 'URGENT',
      responseTimeMinutes: 30, // 30 minutos
      resolutionTimeMinutes: 240, // 4 horas
      departmentId: null,
      categoryId: null,
      active: true,
      companyId: company.id,
    },
    {
      id: 'sla-itil-high',
      name: 'SLA Alta Prioridade (ITIL)',
      priority: 'HIGH',
      responseTimeMinutes: 60, // 1 hora
      resolutionTimeMinutes: 480, // 8 horas (1 dia útil)
      departmentId: null,
      categoryId: null,
      active: true,
      companyId: company.id,
    },
    {
      id: 'sla-itil-medium',
      name: 'SLA Média Prioridade (ITIL)',
      priority: 'MEDIUM',
      responseTimeMinutes: 120, // 2 horas
      resolutionTimeMinutes: 1440, // 24 horas (1 dia corrido)
      departmentId: null,
      categoryId: null,
      active: true,
      companyId: company.id,
    },
    {
      id: 'sla-itil-low',
      name: 'SLA Baixa Prioridade (ITIL)',
      priority: 'LOW',
      responseTimeMinutes: 480, // 8 horas
      resolutionTimeMinutes: 4320, // 72 horas (3 dias úteis)
      departmentId: null,
      categoryId: null,
      active: true,
      companyId: company.id,
    },
  ];

  for (const rule of itilRules) {
    await prisma.slaRule.upsert({
      where: { id: rule.id },
      update: {
        name: rule.name,
        priority: rule.priority,
        responseTimeMinutes: rule.responseTimeMinutes,
        resolutionTimeMinutes: rule.resolutionTimeMinutes,
        active: true,
      },
      create: rule,
    });
    console.log(`✓ Regra de SLA [${rule.priority}] cadastrada: Resposta ${rule.responseTimeMinutes}min / Resolução ${rule.resolutionTimeMinutes / 60}h`);
  }

  console.log('\n=== REGRAS DE SLA ITIL CONFIGURADAS COM SUCESSO! ===\n');
}

seedSlaRules()
  .catch((e) => {
    console.error('Erro ao cadastrar regras de SLA:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
