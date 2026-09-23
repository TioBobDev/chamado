const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || 'mysql://root:123456@localhost:3306/chamado';
const adapter = new PrismaMariaDb(dbUrl);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- CONSOLIDANDO STATUS DE CHAMADOS PARA 3 ESTADOS ---');

  // Buscar empresa padrão
  const company = await prisma.company.findFirst();
  if (!company) {
    console.error('Nenhuma empresa encontrada.');
    return;
  }
  const companyId = company.id;

  // 1. Criar ou atualizar os 3 status canônicos
  const canonicalStatuses = [
    { id: 'status-aberto', name: 'Aberto', color: '#3b82f6', isInitial: true, isFinal: false },
    { id: 'status-atendimento', name: 'Em Atendimento', color: '#f59e0b', isInitial: false, isFinal: false },
    { id: 'status-encerrado', name: 'Encerrado', color: '#10b981', isInitial: false, isFinal: true },
  ];

  for (const s of canonicalStatuses) {
    await prisma.ticketStatus.upsert({
      where: { id: s.id },
      update: {
        name: s.name,
        color: s.color,
        isInitial: s.isInitial,
        isFinal: s.isFinal,
        active: true,
      },
      create: {
        id: s.id,
        name: s.name,
        color: s.color,
        isInitial: s.isInitial,
        isFinal: s.isFinal,
        active: true,
        companyId,
      },
    });
    console.log(`✓ Status "${s.name}" (${s.id}) configurado.`);
  }

  // 2. Migrar chamados de status legados
  // Resolvido / Fechado -> status-encerrado
  const migratedToEncerrado = await prisma.ticket.updateMany({
    where: {
      statusId: { in: ['status-resolvido', 'status-fechado'] },
    },
    data: {
      statusId: 'status-encerrado',
    },
  });
  console.log(`✓ ${migratedToEncerrado.count} chamados migrados para "Encerrado".`);

  // Aguardando Retorno -> status-atendimento
  const migratedToAtendimento = await prisma.ticket.updateMany({
    where: {
      statusId: 'status-aguardando',
    },
    data: {
      statusId: 'status-atendimento',
    },
  });
  console.log(`✓ ${migratedToAtendimento.count} chamados migrados para "Em Atendimento".`);

  // 3. Remover ou desativar status antigos
  const obsoleteStatusIds = ['status-resolvido', 'status-fechado', 'status-aguardando'];
  for (const obsId of obsoleteStatusIds) {
    try {
      await prisma.ticketStatus.delete({
        where: { id: obsId },
      });
      console.log(`✓ Status legado "${obsId}" removido.`);
    } catch (e) {
      // Se tiver restrição, apenas desativa
      await prisma.ticketStatus.updateMany({
        where: { id: obsId },
        data: { active: false },
      });
      console.log(`✓ Status legado "${obsId}" desativado.`);
    }
  }

  console.log('--- CONSOLIDAÇÃO CONCLUÍDA COM SUCESSO ---');
}

main()
  .catch((e) => {
    console.error('Erro ao consolidar status:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
