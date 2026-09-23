'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, LogOut, Download } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';
import PwaInstallModal from '@/components/PwaInstallModal';
import { withBasePath } from '@/shared/utils/api';

export interface SidebarLink {
  href: string;
  label: string;
  icon: React.ReactNode;
  rolesAllowed?: string[];
}

interface DashboardShellProps {
  session: {
    name: string;
    role: string;
    email?: string;
  };
  links: SidebarLink[];
  children: React.ReactNode;
}

export default function DashboardShell({ session, links, children }: DashboardShellProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const pathname = usePathname();

  // Fecha o drawer mobile ao mudar de rota
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Captura evento de instalação PWA (Chrome/Edge/Android)
  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Detecta se está em dispositivo móvel e exibe popup automático (se ainda não instalado e não dispensado)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    const mobile =
      window.innerWidth < 768 ||
      /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);

    setIsMobileDevice(mobile);

    // Se já estiver instalado como PWA ou não for celular, não exibe o modal automático
    if (isStandalone || !mobile) return;

    // Se o usuário já dispensou antes, não exibe automaticamente
    const dismissed = localStorage.getItem('lumen_pwa_dismissed');
    if (dismissed) return;

    // Delay de 1.5s após entrar para exibição fluida
    const timer = setTimeout(() => {
      setIsModalOpen(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Renderiza conteúdo do menu lateral
  const renderSidebarContent = (isMobile = false) => (
    <div className="flex flex-col h-full justify-between">
      <div>
        {/* Logo Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-900/80">
          <Link 
            href="/dashboard" 
            className="flex items-center justify-center w-full"
            onClick={() => isMobile && setIsMobileOpen(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={withBasePath('/logo_lumen_branco.png')} 
              alt="Lumen Logo" 
              className="h-16 md:h-20 object-contain"
            />
          </Link>
          {isMobile && (
            <button
              onClick={() => setIsMobileOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-900/50 md:hidden ml-2"
              aria-label="Fechar menu"
            >
              <X size={22} />
            </button>
          )}
        </div>

        {/* User Profile Card */}
        <div className="p-3 mx-3 my-3 rounded-xl bg-slate-900/60 border border-slate-800/50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-400 to-purple-500 flex items-center justify-center font-bold text-slate-900 text-sm shrink-0 shadow-md">
            {session.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="overflow-hidden min-w-0">
            <h4 className="font-medium text-sm text-slate-200 truncate">{session.name}</h4>
            <span className="inline-block bg-sky-500/10 text-sky-400 text-[10px] px-2 py-0.5 rounded-full font-semibold border border-sky-500/20 mt-0.5">
              {session.role}
            </span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="px-3 space-y-1.5 mt-2">
          {links.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => isMobile && setIsMobileOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/25 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                <span className={isActive ? 'text-sky-400' : 'text-slate-500'}>
                  {link.icon}
                </span>
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Sidebar */}
      <div className="p-3 border-t border-slate-900/80 space-y-2">
        {/* Botão de Instalação PWA (se disponível no navegador ou celular) */}
        {(isInstallable || isMobileDevice) && (
          <button
            onClick={() => {
              if (isMobile) setIsMobileOpen(false);
              setIsModalOpen(true);
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 bg-gradient-to-r from-sky-500/15 to-purple-500/15 border border-sky-500/20 text-sky-300 hover:text-sky-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            <Download size={18} />
            Instalar Aplicativo (PWA)
          </button>
        )}

        <a
          href={withBasePath('/api/auth/logout')}
          className="flex items-center gap-3 px-3.5 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all text-sm font-medium"
        >
          <LogOut size={18} />
          Sair da Conta
        </a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#090d16] text-slate-100 relative">
      {/* 1. Sidebar Desktop Fixa */}
      <aside className="w-64 border-r border-slate-900/80 bg-[#0b0f19] hidden md:flex md:flex-col justify-between shrink-0 sticky top-0 h-screen z-30">
        {renderSidebarContent(false)}
      </aside>

      {/* 2. Drawer Mobile com Backdrop Blur */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop Escuro com Blur */}
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />

          {/* Gaveta Lateral */}
          <div className="relative w-72 max-w-[85vw] bg-[#0b0f19] border-r border-slate-800 z-50 flex flex-col h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}

      {/* 3. Área Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Responsivo */}
        <header className="h-16 border-b border-slate-900/80 flex items-center justify-between px-4 sm:px-6 md:px-8 bg-[#090d16]/90 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            {/* Botão Hambúrguer Mobile */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-2 -ml-1 text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 rounded-xl md:hidden transition-colors"
              aria-label="Abrir menu de navegação"
            >
              <Menu size={22} />
            </button>

            <h2 className="font-semibold text-base sm:text-lg text-slate-200 truncate">
              Painel Operacional
            </h2>
          </div>

          {/* Notificações e Ações */}
          <div className="flex items-center gap-2 sm:gap-4">
            <NotificationBell />
          </div>
        </header>

        {/* Conteúdo com Padding Fluido */}
        <main className="flex-1 p-3 sm:p-5 md:p-6 lg:p-8 overflow-y-auto min-w-0">
          {children}
        </main>
      </div>

      {/* Modal Popup de Instalação PWA para Celular */}
      <PwaInstallModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        deferredPrompt={deferredPrompt}
        onInstallSuccess={() => {
          setIsInstallable(false);
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}
