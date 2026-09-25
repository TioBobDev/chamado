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
  return res.headers.get('set-cookie');
}

async function run() {
  console.log('=== TESTANDO FLUXO: AGUARDANDO RESPOSTA DO SOLICITANTE E PAUSA DE SLA ===\n');

  // Buscar departamento e categoria
  const deptTI = await prisma.department.findFirst({ where: { name: 'Tecnologia da Informação' } });
  const catTI = await prisma.ticketCategory.findFirst({ where: { departmentId: deptTI.id } });
  const userSolicitante = await prisma.user.findFirst({ where: { email: 'solicitante@cancaonovacuiaba.com.br' } });
  const userAtendente = await prisma.user.findFirst({ where: { email: 'atendente@cancaonovacuiaba.com.br' } });

  // 1. Login dos atores
  const cookieSolicitante = await loginUser('solicitante@cancaonovacuiaba.com.br');
  const cookieAtendente = await loginUser('atendente@cancaonovacuiaba.com.br');
  console.log('✓ Sessões autenticadas.');

  // 2. Solicitante abre novo chamado
  const createRes = await fetch('http://localhost:3000/chamado/api/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookieSolicitante },
    body: JSON.stringify({
      title: 'Monitor piscando e sem sinal',
      description: 'O monitor da bancada 4 desliga intermitentemente.',
      departmentId: deptTI.id,
      categoryId: catTI.id,
      priority: 'HIGH',
      impact: 'MEDIUM',
      urgency: 'HIGH',
    }),
  });
  const created = await createRes.json();
  if (!createRes.ok) throw new Error('Erro ao criar chamado: ' + JSON.stringify(created));
  const ticketId = created.id;
  console.log(`[Passo 1] Chamado #${created.number} criado. Status: "${created.status.name}", SLA Deadline: ${created.slaDeadline}`);

  // 3. Atendente inicia atendimento
  const startRes = await fetch(`http://localhost:3000/chamado/api/tickets/${ticketId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', cookie: cookieAtendente },
    body: JSON.stringify({
      statusId: 'status-atendimento',
      attendantId: userAtendente.id,
    }),
  });
  const startData = await startRes.json();
  if (!startRes.ok) throw new Error('Erro ao iniciar atendimento: ' + JSON.stringify(startData));
  console.log(`[Passo 2] Atendimento iniciado. Status: "${startData.status.name}", Atendente: "${startData.attendant?.name}"`);

  const initialDeadline = new Date(startData.slaDeadline).getTime();

  // 4. Atendente posta pergunta acionando flag 'awaitRequesterResponse: true'
  console.log('\n[Passo 3] Atendente enviando pergunta com flag "Aguardar resposta do solicitante"...');
  const askRes = await fetch(`http://localhost:3000/chamado/api/tickets/${ticketId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookieAtendente },
    body: JSON.stringify({
      content: 'Qual é o número de patrimônio fixado atrás do monitor?',
      isInternal: false,
      awaitRequesterResponse: true,
    }),
  });
  const askData = await askRes.json();
  if (!askRes.ok) throw new Error('Erro ao enviar pergunta: ' + JSON.stringify(askData));
  console.log('✓ Comentário adicionado:', askData.content);

  // 5. Verificar estado do chamado após pergunta
  const ticketAfterAsk = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { status: true },
  });
  console.log(`✓ Status atualizado automaticamente para: "${ticketAfterAsk.status.name}" (ID: ${ticketAfterAsk.statusId})`);
  console.log(`✓ SLA pausado em: ${ticketAfterAsk.slaPausedAt}`);

  if (ticketAfterAsk.status.name !== 'Aguardando resposta do solicitante') {
    throw new Error(`Esperava status "Aguardando resposta do solicitante", mas obteve "${ticketAfterAsk.status.name}"`);
  }
  if (!ticketAfterAsk.slaPausedAt) {
    throw new Error('slaPausedAt deveria estar preenchido, mas está nulo');
  }

  // Verificar notificação criada para o solicitante
  const notif = await prisma.notification.findFirst({
    where: { userId: userSolicitante.id },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`✓ Notificação gerada para o solicitante: "${notif?.title}" - "${notif?.message}"`);

  // Aguardar 2 segundos para simular tempo de resposta e extensão de SLA
  console.log('\n[Passo 4] Simulando pausa de 2 segundos...');
  await new Promise((r) => setTimeout(r, 2000));

  // 6. Solicitante responde ao chamado
  console.log('[Passo 5] Solicitante respondendo ao chamado...');
  const replyRes = await fetch(`http://localhost:3000/chamado/api/tickets/${ticketId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookieSolicitante },
    body: JSON.stringify({
      content: 'O patrimônio é PAT-88421.',
      isInternal: false,
    }),
  });
  const replyData = await replyRes.json();
  if (!replyRes.ok) throw new Error('Erro ao responder: ' + JSON.stringify(replyData));
  console.log('✓ Resposta enviada:', replyData.content);

  // 7. Verificar retomada automática do atendimento e extensão de SLA
  const ticketAfterReply = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { status: true },
  });
  console.log(`✓ Status retornado automaticamente para: "${ticketAfterReply.status.name}" (ID: ${ticketAfterReply.statusId})`);
  console.log(`✓ slaPausedAt após resposta: ${ticketAfterReply.slaPausedAt}`);

  const newDeadline = new Date(ticketAfterReply.slaDeadline).getTime();
  const deadlineDiff = newDeadline - initialDeadline;
  console.log(`✓ Novo SLA Deadline: ${ticketAfterReply.slaDeadline} (Estendido em ${deadlineDiff}ms)`);

  if (ticketAfterReply.status.name !== 'Em Atendimento') {
    throw new Error(`Esperava retorno para "Em Atendimento", mas obteve "${ticketAfterReply.status.name}"`);
  }
  if (ticketAfterReply.slaPausedAt !== null) {
    throw new Error('slaPausedAt deveria ser null após retomada');
  }
  if (deadlineDiff <= 0) {
    throw new Error('slaDeadline deveria ter sido estendido pelo tempo pausado');
  }

  // Verificar histórico
  const histories = await prisma.ticketHistory.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
  });
  console.log('\nHistórico registrado:');
  histories.forEach((h) => console.log(`  • [${h.action}] ${h.newValue}`));

  // 8. Limpar ticket de teste
  await prisma.ticket.delete({ where: { id: ticketId } });
  console.log('\n=============================================================');
  console.log('🎉 TESTE DO FLUXO COMPLETO CONCLUÍDO COM 100% DE SUCESSO!');
  console.log('=============================================================\n');
}

run()
  .catch((e) => {
    console.error('❌ Falha no teste:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
