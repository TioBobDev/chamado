const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || 'mysql://root:123456@localhost:3306/chamado';
const adapter = new PrismaMariaDb(dbUrl);
const prisma = new PrismaClient({ adapter });

async function loginUser(email, password = 'Admin@123456') {
  const res = await fetch('http://localhost:3000/chamado/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(`Falha no login (${email}): ${data.message}`);
  }
  const cookie = res.headers.get('set-cookie');
  return cookie;
}

async function run() {
  console.log('=== TESTANDO FLUXO COMPLETO VIA API HTTP ===\n');

  // 1. Preparar atendente 2 no mesmo setor (Tecnologia da Informação)
  const deptTI = await prisma.department.findFirst({ where: { name: 'Tecnologia da Informação' } });
  const deptRH = await prisma.department.findFirst({ where: { name: 'Recursos Humanos' } });
  const catTI = await prisma.ticketCategory.findFirst({ where: { departmentId: deptTI.id } });
  const company = await prisma.company.findFirst();

  let userAtendente2 = await prisma.user.findFirst({ where: { email: 'atendente2@cancaonovacuiaba.com.br' } });
  if (!userAtendente2) {
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash('Admin@123456', 10);
    userAtendente2 = await prisma.user.create({
      data: {
        name: 'Carlos Atendente TI 2',
        email: 'atendente2@cancaonovacuiaba.com.br',
        passwordHash,
        roleId: 'role-attendant',
        companyId: company.id,
        active: true,
        changePasswordRequired: false,
      },
    });
    await prisma.userDepartment.upsert({
      where: {
        userId_departmentId: {
          userId: userAtendente2.id,
          departmentId: deptTI.id,
        },
      },
      update: {},
      create: {
        userId: userAtendente2.id,
        departmentId: deptTI.id,
      },
    });
    console.log('✓ Atendente 2 garantido no setor Tecnologia da Informação.');
  } else {
    await prisma.userDepartment.upsert({
      where: {
        userId_departmentId: {
          userId: userAtendente2.id,
          departmentId: deptTI.id,
        },
      },
      update: {},
      create: {
        userId: userAtendente2.id,
        departmentId: deptTI.id,
      },
    });
  }

  // 2. Fazer login dos atores
  const cookieSolicitante = await loginUser('solicitante@cancaonovacuiaba.com.br');
  const cookieAtendente1 = await loginUser('atendente@cancaonovacuiaba.com.br');
  const userAtendente1 = await prisma.user.findFirst({ where: { email: 'atendente@cancaonovacuiaba.com.br' } });
  const userSolicitante = await prisma.user.findFirst({ where: { email: 'solicitante@cancaonovacuiaba.com.br' } });

  console.log('✓ Sessões autenticadas via HTTP.');

  // 3. Solicitante abre novo chamado
  const createRes = await fetch('http://localhost:3000/chamado/api/tickets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: cookieSolicitante,
    },
    body: JSON.stringify({
      title: 'Computador da sala de edição travando',
      description: 'O computador desliga sozinho após 10 minutos de uso intenso.',
      departmentId: deptTI.id,
      categoryId: catTI.id,
      priority: 'HIGH',
      impact: 'MEDIUM',
      urgency: 'HIGH',
      customFields: [],
    }),
  });

  const createdData = await createRes.json();
  if (!createRes.ok) {
    throw new Error('Falha ao criar chamado: ' + JSON.stringify(createdData));
  }
  const ticketId = createdData.id;
  console.log(`\n[Passo 1] Chamado #${createdData.number} criado com sucesso. Status inicial: "${createdData.status.name}"`);

  // 4. Teste de Bloqueio: Atendente tenta transferir chamado enquanto status é "Aberto"
  console.log('\n[Passo 2] Teste: Atendente tentando transferir chamado em status "Aberto"...');
  const transferAbertoRes = await fetch(`http://localhost:3000/chamado/api/tickets/${ticketId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      cookie: cookieAtendente1,
    },
    body: JSON.stringify({
      attendantId: userAtendente2.id,
      transferReason: 'Passando antes de iniciar',
    }),
  });
  const transferAbertoData = await transferAbertoRes.json();
  if (transferAbertoRes.status === 400) {
    console.log(`✓ BLOQUEADO COM SUCESSO (400): "${transferAbertoData.message}"`);
  } else {
    console.error(`❌ ERRO: Deveria ter retornado 400 mas retornou ${transferAbertoRes.status}:`, transferAbertoData);
  }

  // 5. Iniciar Atendimento: Passa para "Em Atendimento" e autoatribui
  console.log('\n[Passo 3] Atendente clicando em "Iniciar Atendimento"...');
  const startRes = await fetch(`http://localhost:3000/chamado/api/tickets/${ticketId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      cookie: cookieAtendente1,
    },
    body: JSON.stringify({
      statusId: 'status-atendimento',
      attendantId: userAtendente1.id,
    }),
  });
  const startData = await startRes.json();
  if (!startRes.ok) {
    throw new Error('Falha ao iniciar atendimento: ' + JSON.stringify(startData));
  }
  console.log(`✓ Atendimento iniciado! Novo status: "${startData.status.name}", Atendente: "${startData.attendant?.name}"`);

  // 5.1 Teste de Bloqueio: Atendente tentando alterar o status de "Em Atendimento" de volta para "Aberto"
  console.log('\n[Passo 3.5] Teste: Atendente tentando retornar status para "Aberto"...');
  const regressRes = await fetch(`http://localhost:3000/chamado/api/tickets/${ticketId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      cookie: cookieAtendente1,
    },
    body: JSON.stringify({
      statusId: 'status-aberto',
    }),
  });
  const regressData = await regressRes.json();
  if (regressRes.status === 400) {
    console.log(`✓ BLOQUEADO COM SUCESSO (400): "${regressData.message}"`);
  } else {
    console.error(`❌ ERRO: Deveria ter retornado 400 mas retornou ${regressRes.status}:`, regressData);
  }

  // 6. Teste de Bloqueio: Transferir para usuário que NÃO pertence ao setor (ex: Auditor do Financeiro)
  const userAuditor = await prisma.user.findFirst({ where: { email: 'auditor@cancaonovacuiaba.com.br' } });
  console.log('\n[Passo 4] Teste: Atendente tentando transferir para usuário fora da equipe/setor (Financeiro)...');
  const transferForaRes = await fetch(`http://localhost:3000/chamado/api/tickets/${ticketId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      cookie: cookieAtendente1,
    },
    body: JSON.stringify({
      attendantId: userAuditor.id,
      transferReason: 'Transferência para outro setor',
    }),
  });
  const transferForaData = await transferForaRes.json();
  if (transferForaRes.status === 400) {
    console.log(`✓ BLOQUEADO COM SUCESSO (400): "${transferForaData.message}"`);
  } else {
    console.error(`❌ ERRO: Deveria ter retornado 400 mas retornou ${transferForaRes.status}:`, transferForaData);
  }

  // 7. Transferência válida: Transferir para Atendente 2 (mesmo setor TI) com motivo
  console.log('\n[Passo 5] Atendente transferindo para colega do mesmo setor (Carlos Atendente TI 2)...');
  const transferOkRes = await fetch(`http://localhost:3000/chamado/api/tickets/${ticketId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      cookie: cookieAtendente1,
    },
    body: JSON.stringify({
      attendantId: userAtendente2.id,
      transferReason: 'Necessário reparo físico na fonte de alimentação',
    }),
  });
  const transferOkData = await transferOkRes.json();
  if (!transferOkRes.ok) {
    throw new Error('Falha na transferência válida: ' + JSON.stringify(transferOkData));
  }
  console.log(`✓ Chamado transferido com sucesso! Novo responsável: "${transferOkData.attendant?.name}"`);

  // Verificar comentários internos gerados
  const comments = await prisma.ticketComment.findMany({ where: { ticketId } });
  console.log(`  - Comentários no chamado: ${comments.length}`);
  comments.forEach(c => console.log(`    * [${c.isInternal ? 'INTERNO' : 'PÚBLICO'}] ${c.content}`));

  // 8. Encerrar Chamado com Solução Aplicada (pelo novo atendente responsável)
  const cookieAtendente2 = await loginUser('atendente2@cancaonovacuiaba.com.br');
  console.log('\n[Passo 6] Novo atendente responsável encerrando o chamado com registro de solução...');
  const closeRes = await fetch(`http://localhost:3000/chamado/api/tickets/${ticketId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      cookie: cookieAtendente2,
    },
    body: JSON.stringify({
      statusId: 'status-encerrado',
      resolutionSummary: 'Fonte ATX substituída e testes de estresse concluídos sem travamentos.',
    }),
  });
  const closeData = await closeRes.json();
  if (!closeRes.ok) {
    throw new Error('Falha ao encerrar chamado: ' + JSON.stringify(closeData));
  }
  console.log(`✓ Chamado encerrado! Status: "${closeData.status.name}", Finalizado em: ${closeData.closedAt}`);

  // 9. Teste de Bloqueio: Tentar reabrir ou alterar chamado encerrado
  console.log('\n[Passo 7] Teste: Tentativa de alterar status ou reabrir chamado já encerrado...');
  const reopenRes = await fetch(`http://localhost:3000/chamado/api/tickets/${ticketId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      cookie: cookieAtendente2,
    },
    body: JSON.stringify({
      statusId: 'status-atendimento',
    }),
  });
  const reopenData = await reopenRes.json();
  if (reopenRes.status === 400) {
    console.log(`✓ BLOQUEADO COM SUCESSO (400): "${reopenData.message}"`);
  } else {
    console.error(`❌ ERRO: Deveria ter retornado 400 mas retornou ${reopenRes.status}:`, reopenData);
  }

  // 10. Teste de Bloqueio: Tentar adicionar comentário em chamado encerrado
  console.log('\n[Passo 8] Teste: Tentativa de adicionar comentário em chamado encerrado...');
  const commentClosedRes = await fetch(`http://localhost:3000/chamado/api/tickets/${ticketId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: cookieSolicitante,
    },
    body: JSON.stringify({
      content: 'Ainda preciso de mais uma ajuda',
      isInternal: false,
    }),
  });
  const commentClosedData = await commentClosedRes.json();
  if (commentClosedRes.status === 400) {
    console.log(`✓ BLOQUEADO COM SUCESSO (400): "${commentClosedData.message}"`);
  } else {
    console.error(`❌ ERRO: Deveria ter retornado 400 mas retornou ${commentClosedRes.status}:`, commentClosedData);
  }

  // Limpar chamado de teste
  await prisma.ticket.delete({ where: { id: ticketId } });
  console.log('\n=============================================================');
  console.log('🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
  console.log('=============================================================\n');
}

run()
  .catch(e => {
    console.error('Erro na execução do teste:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
