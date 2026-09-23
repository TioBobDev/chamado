const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || 'mysql://root:123456@localhost:3306/chamado';
const adapter = new PrismaMariaDb(dbUrl);
const prisma = new PrismaClient({ adapter });

async function apply() {
  try {
    console.log('Verificando e adicionando category_id em ticket_custom_fields...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE ticket_custom_fields 
      ADD COLUMN category_id VARCHAR(191) NULL;
    `);
    console.log('✓ Coluna category_id adicionada com sucesso!');
  } catch (err) {
    if (err.message && err.message.includes('Duplicate column')) {
      console.log('✓ A coluna category_id já existe na tabela.');
    } else {
      console.error('Erro ao adicionar coluna:', err.message);
    }
  }

  try {
    console.log('Adicionando foreign key...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE ticket_custom_fields 
      ADD CONSTRAINT ticket_custom_fields_category_id_fkey 
      FOREIGN KEY (category_id) REFERENCES ticket_categories(id) 
      ON DELETE CASCADE ON UPDATE CASCADE;
    `);
    console.log('✓ Foreign key vinculada com sucesso!');
  } catch (err) {
    if (err.message && (err.message.includes('Duplicate key') || err.message.includes('already exists'))) {
      console.log('✓ Foreign key já existe.');
    } else {
      console.log('Info FK:', err.message);
    }
  }
}

apply()
  .finally(async () => {
    await prisma.$disconnect();
  });
