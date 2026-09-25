const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || 'mysql://root:123456@localhost:3306/chamado';
const adapter = new PrismaMariaDb(dbUrl);
const prisma = new PrismaClient({ adapter });

async function apply() {
  console.log('=== APLICANDO MIGRAÇÕES PENDENTES NO BANCO ===');

  // 1. Coluna category_id em ticket_custom_fields
  try {
    console.log('1. Verificando category_id em ticket_custom_fields...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE ticket_custom_fields 
      ADD COLUMN category_id VARCHAR(191) NULL;
    `);
    console.log('✓ Coluna category_id adicionada com sucesso!');
  } catch (err) {
    if (err.message && (err.message.includes('Duplicate column') || err.message.includes('already exists'))) {
      console.log('✓ A coluna category_id já existe.');
    } else {
      console.log('Info category_id:', err.message);
    }
  }

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE ticket_custom_fields 
      ADD CONSTRAINT ticket_custom_fields_category_id_fkey 
      FOREIGN KEY (category_id) REFERENCES ticket_categories(id) 
      ON DELETE CASCADE ON UPDATE CASCADE;
    `);
    console.log('✓ Foreign key de category_id vinculada com sucesso!');
  } catch (err) {
    if (err.message && (err.message.includes('Duplicate key') || err.message.includes('already exists'))) {
      console.log('✓ Foreign key já existe.');
    } else {
      console.log('Info FK category_id:', err.message);
    }
  }

  // 2. Coluna avatar_url na tabela users
  try {
    console.log('2. Verificando avatar_url em users...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users 
      ADD COLUMN avatar_url VARCHAR(500) NULL;
    `);
    console.log('✓ Coluna avatar_url adicionada com sucesso!');
  } catch (err) {
    if (err.message && (err.message.includes('Duplicate column') || err.message.includes('already exists'))) {
      console.log('✓ A coluna avatar_url já existe.');
    } else {
      console.log('Info avatar_url:', err.message);
    }
  }

  // 3. Tabela push_subscriptions para Notificações Web Push
  try {
    console.log('3. Verificando tabela push_subscriptions...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id VARCHAR(191) PRIMARY KEY,
        user_id VARCHAR(191) NOT NULL,
        endpoint VARCHAR(1000) NOT NULL,
        p256dh TEXT NOT NULL,
        auth VARCHAR(255) NOT NULL,
        user_agent VARCHAR(500) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        INDEX idx_push_user_id (user_id),
        CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ Tabela push_subscriptions verificada/criada com sucesso!');
  } catch (err) {
    console.log('Info push_subscriptions:', err.message);
  }

  // 4. Coluna sla_paused_at na tabela tickets
  try {
    console.log('4. Verificando sla_paused_at em tickets...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE tickets 
      ADD COLUMN sla_paused_at DATETIME(3) NULL;
    `);
    console.log('✓ Coluna sla_paused_at adicionada com sucesso em tickets!');
  } catch (err) {
    if (err.message && (err.message.includes('Duplicate column') || err.message.includes('already exists'))) {
      console.log('✓ A coluna sla_paused_at já existe em tickets.');
    } else {
      console.log('Info sla_paused_at:', err.message);
    }
  }

  // 5. Status canônico "Aguardando resposta do solicitante"
  try {
    console.log('5. Verificando status "Aguardando resposta do solicitante"...');
    const company = await prisma.company.findFirst();
    if (company) {
      await prisma.ticketStatus.upsert({
        where: { id: 'status-aguardando-solicitante' },
        update: {
          name: 'Aguardando resposta do solicitante',
          color: '#8b5cf6',
          active: true,
        },
        create: {
          id: 'status-aguardando-solicitante',
          name: 'Aguardando resposta do solicitante',
          color: '#8b5cf6',
          isInitial: false,
          isFinal: false,
          active: true,
          companyId: company.id,
        },
      });
      console.log('✓ Status "Aguardando resposta do solicitante" configurado com sucesso!');
    }
  } catch (err) {
    console.log('Info status:', err.message);
  }

  console.log('=== MIGRAÇÕES CONCLUÍDAS COM SUCESSO! ===\n');
}

apply()
  .catch((err) => {
    console.error('Erro na migração:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
