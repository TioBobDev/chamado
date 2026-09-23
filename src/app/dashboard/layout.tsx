import React from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { security } from '@/shared/security/security';
import DashboardShell, { SidebarLink } from '@/components/DashboardShell';
import { 
  FileText, 
  PlusCircle, 
  Layers, 
  ShieldAlert, 
  Briefcase,
  Users
} from 'lucide-react';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieName = process.env.COOKIE_NAME || 'chamado_session';
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;

  if (!token) {
    redirect('/login');
  }

  const session = security.verifyToken(token);
  // Redireciona caso o token esteja vencido ou corrompido
  if (!session) {
    redirect('/login');
  }

  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';
  const isChangePassword = pathname === '/dashboard/change-password';

  // Links da barra lateral mapeados por permissão de perfil
  const links: (SidebarLink & { rolesAllowed: string[] })[] = [
    {
      href: '/dashboard',
      label: 'Meus Chamados',
      icon: <FileText size={20} />,
      rolesAllowed: ['Solicitante', 'Atendente', 'Coordenador', 'Gestor', 'Administrador', 'Auditor'],
    },
    {
      href: '/dashboard/tickets/new',
      label: 'Abrir Chamado',
      icon: <PlusCircle size={20} />,
      rolesAllowed: ['Solicitante', 'Administrador'],
    },
    {
      href: '/dashboard/queue',
      label: 'Fila de Chamados',
      icon: <Layers size={20} />,
      rolesAllowed: ['Atendente', 'Coordenador', 'Gestor', 'Administrador', 'Auditor'],
    },
    {
      href: '/dashboard/admin/departments',
      label: 'Setores & Categorias',
      icon: <Briefcase size={20} />,
      rolesAllowed: ['Administrador'],
    },
    {
      href: '/dashboard/admin',
      label: 'Gerenciar Usuários',
      icon: <Users size={20} />,
      rolesAllowed: ['Administrador'],
    },
    {
      href: '/dashboard/audit',
      label: 'Logs de Auditoria',
      icon: <ShieldAlert size={20} />,
      rolesAllowed: ['Auditor', 'Administrador'],
    },
  ];

  const filteredLinks = links
    .filter((link) => link.rolesAllowed.includes(session.role))
    .map(({ rolesAllowed, ...rest }) => rest);

  if (isChangePassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090d16] text-slate-100 p-4">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    );
  }

  return (
    <DashboardShell session={session} links={filteredLinks}>
      {children}
    </DashboardShell>
  );
}
