'use client';

import React, { useEffect, useState } from 'react';
import { Bell, BellOff, CheckCircle2, AlertCircle, Smartphone, Send, Loader2 } from 'lucide-react';
import { apiFetch } from '@/shared/utils/api';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationManager() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      checkSubscription();
    } else {
      setIsSupported(false);
      setLoading(false);
    }
  }, []);

  const checkSubscription = async () => {
    try {
      setLoading(true);
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (err) {
      console.error('Erro ao verificar inscrição push:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    try {
      setActionLoading(true);
      setMessage(null);

      // 1. Solicita permissão nativa
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setMessage({
          type: 'error',
          text: 'Permissão para notificações negada no navegador. Habilite nas configurações do seu celular.',
        });
        return;
      }

      // 2. Obtém a chave pública VAPID
      const keyRes = await apiFetch('/api/notifications/push/public-key');
      const { publicKey } = await keyRes.json();
      if (!publicKey) {
        throw new Error('Chave pública de push não configurada no servidor.');
      }

      // 3. Registra no PushManager do navegador/celular
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // 4. Salva a inscrição no backend
      const res = await apiFetch('/api/notifications/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Falha ao salvar inscrição no servidor.');
      }

      setIsSubscribed(true);
      setMessage({
        type: 'success',
        text: 'Notificações push ativadas com sucesso neste aparelho!',
      });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message || 'Erro ao ativar notificações.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    try {
      setActionLoading(true);
      setMessage(null);

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await apiFetch('/api/notifications/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      setMessage({
        type: 'success',
        text: 'Notificações desativadas para este aparelho.',
      });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message || 'Erro ao desativar notificações.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestPush = async () => {
    try {
      setTestLoading(true);
      setMessage(null);

      const res = await apiFetch('/api/notifications/push/test', {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Falha ao enviar notificação de teste.');
      }

      setMessage({
        type: 'success',
        text: data.message || 'Notificação enviada! Verifique a tela do seu aparelho.',
      });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message || 'Falha no teste de notificação.',
      });
    } finally {
      setTestLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-center gap-3">
        <Smartphone size={20} className="text-slate-500 shrink-0" />
        <span>Seu navegador ou dispositivo atual não oferece suporte nativo a notificações Web Push.</span>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4 relative overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
            isSubscribed 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-slate-800/60 border-slate-700/50 text-slate-400'
          }`}>
            {isSubscribed ? <Bell size={20} /> : <BellOff size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-slate-200">Notificações no Celular & PWA</h4>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isSubscribed 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {isSubscribed ? 'ATIVADAS' : 'DESATIVADAS'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Receba alertas sonoros e com vibração quando seus chamados forem atualizados, mesmo com o app fechado.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isSubscribed ? (
            <>
              <button
                type="button"
                onClick={handleTestPush}
                disabled={testLoading || actionLoading}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                title="Dispara um teste instantâneo para o celular"
              >
                {testLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Testar no Celular
              </button>
              <button
                type="button"
                onClick={handleUnsubscribe}
                disabled={actionLoading}
                className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-semibold rounded-xl border border-red-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                Desativar
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={loading || actionLoading}
              className="px-4 py-2 bg-gradient-to-r from-sky-500 to-purple-600 hover:from-sky-400 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-500/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Smartphone size={14} />}
              Ativar neste Aparelho
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
            : 'bg-red-500/10 border-red-500/20 text-red-300'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{message.text}</span>
        </div>
      )}
    </div>
  );
}
