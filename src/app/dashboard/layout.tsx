import React from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { security } from '@/shared/security/security';
import Link from 'next/link';
import NotificationBell from '@/components/NotificationBell';
import { 
  FileText, 
  PlusCircle, 
  Layers, 
  ShieldAlert, 
  LogOut, 
  User as UserIcon,
  Bell,
  Briefcase,
  Users
} from 'lucide-react';

interface SidebarLink {
  href: string;
  label: string;
  icon: React.ReactNode;
  rolesAllowed: string[];
}

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
  const links: SidebarLink[] = [
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

  const filteredLinks = links.filter((link) => link.rolesAllowed.includes(session.role));

  if (isChangePassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090d16] text-slate-100 p-4">
        <div className="w-full">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#090d16] text-slate-100 relative">
      {/* Sidebar - Efeito Vidro */}
      <aside className="w-64 border-r border-slate-900 bg-[#0b0f19] flex flex-col justify-between shrink-0">
        <div>
          {/* Logo */}
          <div className="flex items-center justify-center px-6 py-4 border-b border-slate-900">
            <Link href="/dashboard" className="flex items-center justify-center w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/logo_lumen_branco.png" 
                alt="Lumen Logo" 
                className="h-20 object-contain"
              />
            </Link>
          </div>

          {/* User Profile Card */}
          <div className="p-4 mx-3 my-4 rounded-xl bg-slate-900/50 border border-slate-800/40 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-400 to-purple-500 flex items-center justify-center font-bold text-slate-900 text-sm">
              {session.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <h4 className="font-medium text-sm text-slate-200 truncate">{session.name}</h4>
              <span className="inline-block bg-sky-500/10 text-sky-400 text-[10px] px-2 py-0.5 rounded-full font-semibold border border-sky-500/20 mt-0.5">
                {session.role}
              </span>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="px-3 space-y-1">
            {filteredLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-slate-200 hover:bg-slate-900/30 rounded-xl transition-all text-sm group"
              >
                <span className="text-slate-500 group-hover:text-sky-400 transition-colors">
                  {link.icon}
                </span>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Footer Sidebar */}
        <div className="p-4 border-t border-slate-900">
          <a
            href="/api/auth/logout"
            className="flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/5 rounded-xl transition-all text-sm font-medium"
          >
            <LogOut size={20} />
            Sair da Conta
          </a>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-900 flex items-center justify-between px-8 bg-[#090d16]/80 backdrop-blur-md sticky top-0 z-10">
          <h2 className="font-semibold text-lg text-slate-200">Painel Operacional</h2>

          {/* Notifications and Profile Icon */}
          <div className="flex items-center gap-4">
            <NotificationBell />
          </div>
        </header>

        {/* Content Wrapper */}
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
