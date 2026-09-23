'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, ForgotPasswordInput } from '@/modules/authentication/validators/auth.validator';
import { Mail, Loader2, ArrowLeft, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Não foi possível processar a solicitação.');
      }

      setSuccessMessage(
        result.message ||
          'Se o e-mail informado estiver cadastrado no sistema, você receberá um link para redefinir a senha.'
      );
    } catch (err: any) {
      setError(err.message || 'Falha ao solicitar recuperação de senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/60 border border-slate-800 backdrop-blur-xl p-8 rounded-2xl shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-400 to-purple-500 flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-sky-500/20 mb-3">
            CF
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Recuperação de Senha</h1>
          <p className="text-sm text-slate-400 mt-1 text-center">
            Informe seu e-mail corporativo para receber o link de redefinição
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2.5">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage ? (
          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-slate-200 text-sm space-y-3">
              <div className="flex items-center gap-2.5 text-sky-400 font-semibold">
                <CheckCircle2 size={20} className="shrink-0" />
                <span>Solicitação Registrada</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-sm">
                {successMessage}
              </p>
              <div className="pt-2 border-t border-sky-500/20 text-xs text-slate-400 space-y-1">
                <p>• O link possui validade de <strong>1 hora</strong>.</p>
                <p>• Verifique também a pasta de <em>Spam</em> ou <em>Lixo Eletrônico</em>.</p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setSuccessMessage(null)}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl text-sm transition-colors cursor-pointer"
              >
                Informar outro e-mail
              </button>

              <Link
                href="/login"
                className="w-full py-3 px-4 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white font-medium rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <ArrowLeft size={16} /> Voltar para o Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                E-mail Cadastrado
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  placeholder="nome@empresa.com"
                  {...register('email')}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/40 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all text-sm"
                />
              </div>
              {errors.email && (
                <span className="text-xs text-red-400 mt-1 block">{errors.email.message}</span>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-400 to-purple-500 hover:from-sky-500 hover:to-purple-600 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all glow-primary hover:glow-accent disabled:opacity-50 disabled:cursor-not-allowed text-sm mt-4 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  Enviar Link de Redefinição <Send size={16} />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-sky-300 transition-colors"
              >
                <ArrowLeft size={14} /> Voltar para a tela de login
              </Link>
            </div>
          </form>
        )}

        <div className="mt-8 text-center text-xs text-slate-500 space-y-1">
          <p>© 2026 ChamadoFlow.</p>
          <p className="text-[10px] text-slate-600">Ambiente Seguro e Monitorado para Auditoria</p>
        </div>
      </div>
    </div>
  );
}
