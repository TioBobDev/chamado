const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || 'mysql://root:123456@localhost:3306/chamado';
const adapter = new PrismaMariaDb(dbUrl);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.argv[2] || 'crop_raphael@hotmail.com';
  console.log(`Buscando usuário: ${email}...`);

  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });

  if (!user) {
    console.error(`Usuário com e-mail "${email}" não encontrado no banco.`);
    process.exit(1);
  }

  console.log(`Usuário encontrado: ${user.name} (Perfil atual: ${user.role.name})`);

  const adminRole = await prisma.role.findFirst({
    where: { name: 'Administrador' },
  });

  if (!adminRole) {
    console.error('Perfil "Administrador" não localizado no banco.');
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { roleId: adminRole.id },
  });

  console.log(`✓ SUCESSO: Usuário "${user.name}" (${user.email}) agora é Administrador!`);
}

main()
  .catch((e) => {
    console.error('Erro ao promover usuário:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
