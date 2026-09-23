'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, Download, Share, PlusSquare, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { withBasePath } from '@/shared/utils/api';

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt?: any;
  onInstallSuccess?: () => void;
}

export default function PwaInstallModal({
  isOpen,
  onClose,
  deferredPrompt,
  onInstallSuccess,
}: PwaInstallModalProps) {
  const [activeTab, setActiveTab] = useState<'android' | 'ios'>('android');
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Detecta sistema operacional padrão
    if (typeof window !== 'undefined') {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        setActiveTab('ios');
      } else {
        setActiveTab('android');
      }
    }
  }, []);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        onInstallSuccess?.();
        onClose();
      }
    } catch (err) {
      console.error('Erro ao acionar instalação PWA:', err);
    } finally {
      setInstalling(false);
    }
  };

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lumen_pwa_dismissed', 'true');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      {/* Container Principal */}
      <div className="relative w-full max-w-md bg-[#0b0f19] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl overflow-hidden space-y-5 animate-in slide-in-from-bottom-6 duration-200">
        {/* Glow Superior */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-sky-400 via-purple-500 to-sky-400" />

        {/* Header do Modal */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-sky-500/20 to-purple-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <Smartphone size={22} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-sky-400 text-xs font-semibold uppercase tracking-wider">
                <Sparkles size={12} />
                <span>Aplicativo Móvel</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-100">
                Instale o Lumen no Celular
              </h3>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Descrição curta */}
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
          Instale o sistema para acesso rápido em tela cheia direto da tela inicial, com maior performance e estabilidade.
        </p>

        {/* Seletor de Sistema Operacional (Abas) */}
        <div className="flex p-1 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('android')}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'android'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Android (Chrome/Edge)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ios')}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'ios'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>iPhone (Safari)</span>
          </button>
        </div>

        {/* Conteúdo Específico por Sistema Operacional */}
        {activeTab === 'android' ? (
          <div className="space-y-3.5 bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl text-xs text-slate-300">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                1
              </span>
              <p className="leading-relaxed">
                Você verá o botão <strong className="text-sky-300">"Instalar Aplicativo (PWA)"</strong> no rodapé do menu lateral.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                2
              </span>
              <p className="leading-relaxed">
                Ou toque nos <strong className="text-slate-200">3 pontinhos (⋮)</strong> no canto superior do navegador e escolha <strong className="text-sky-300">"Instalar aplicativo"</strong> ou <strong className="text-sky-300">"Adicionar à tela inicial"</strong>.
              </p>
            </div>

            {/* Botão de Instalação Direta se disponível */}
            {deferredPrompt && (
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={installing}
                className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-sky-400 to-sky-500 hover:from-sky-500 hover:to-sky-600 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                <Download size={16} />
                {installing ? 'Instalando...' : 'Instalar Agora com 1 Clique'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3.5 bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl text-xs text-slate-300">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                1
              </span>
              <p className="leading-relaxed">
                No Safari do iPhone, toque no botão de <strong className="text-purple-300">Compartilhar</strong> (ícone do quadrado com seta para cima <Share size={13} className="inline mx-1 text-purple-400" /> na barra inferior).
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                2
              </span>
              <p className="leading-relaxed">
                Role o menu de opções para baixo e selecione <strong className="text-purple-300">"Adicionar à Tela de Início"</strong> (<PlusSquare size={13} className="inline mx-1 text-purple-400" />).
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                3
              </span>
              <p className="leading-relaxed">
                Toque em <strong className="text-slate-200">"Adicionar"</strong> no canto superior direito para finalizar.
              </p>
            </div>
          </div>
        )}

        {/* Rodapé de Ações */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs text-slate-500 hover:text-slate-400 transition-colors cursor-pointer"
          >
            Não mostrar novamente
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
