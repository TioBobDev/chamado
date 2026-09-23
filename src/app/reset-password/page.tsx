'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Lock, Loader2, CheckCircle2, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/shared/utils/api';

interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormData>();

  const watchedPassword = watch('password');

  if (!token) {
    return (
      <div className="space-y-6">
        <div className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-slate-200 text-sm space-y-3">
          <div className="flex items-center gap-2.5 text-amber-400 font-semibold">
            <AlertCircle size={20} className="shrink-0" />
            <span>Link Incompleto ou Inválido</span>
          </div>
          <p className="text-slate-300 leading-relaxed text-sm">
            Nenhum token de validação foi identificado nesta URL. Certifique-se de que copiou o link completo recebido por e-mail.
          </p>
        </div>

        <Link
          href="/forgot-password"
          className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-400 to-purple-500 hover:from-sky-500 hover:to-purple-600 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all text-sm"
        >
          <RefreshCw size={16} /> Solicitar Novo Link
        </Link>
      </div>
    );
  }

  const onSubmit = async (data: ResetPasswordFormData) => {
    setError(null);
    setLoading(true);

    try {
      const response = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Falha ao redefinir a senha.');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao redefinir sua senha.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-6">
        <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-slate-200 text-sm space-y-3 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 size={28} />
          </div>
          <h2 className="text-lg font-bold text-white">Senha Alterada com Sucesso!</h2>
          <p className="text-slate-300 leading-relaxed text-sm">
            Sua nova credencial já está ativa no sistema. Você já pode fazer login na plataforma corporativa.
          </p>
        </div>

        <Link
          href="/login"
          className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-400 to-purple-500 hover:from-sky-500 hover:to-purple-600 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all glow-primary text-sm font-semibold"
        >
          Acessar o Painel de Login <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          {(error.includes('expirou') || error.includes('utilizado') || error.includes('inválido')) && (
            <Link
              href="/forgot-password"
              className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 underline font-medium pt-1"
            >
              Clique aqui para solicitar um novo link de redefinição
            </Link>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Nova Senha
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Lock size={18} />
          </span>
          <input
            type="password"
            placeholder="No mínimo 6 caracteres"
            {...register('password', {
              required: 'A nova senha é obrigatória.',
              minLength: { value: 6, message: 'A senha deve ter pelo menos 6 caracteres.' },
            })}
            className="w-full pl-10 pr-4 py-3 bg-slate-950/40 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all text-sm"
          />
        </div>
        {errors.password && (
          <span className="text-xs text-red-400 mt-1 block">{errors.password.message}</span>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Confirmar Nova Senha
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Lock size={18} />
          </span>
          <input
            type="password"
            placeholder="Repita a nova senha"
            {...register('confirmPassword', {
              required: 'Confirmação de senha é obrigatória.',
              validate: (val) => val === watchedPassword || 'As senhas não coincidem.',
            })}
            className="w-full pl-10 pr-4 py-3 bg-slate-950/40 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all text-sm"
          />
        </div>
        {errors.confirmPassword && (
          <span className="text-xs text-red-400 mt-1 block">{errors.confirmPassword.message}</span>
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
            Salvar Nova Senha <ArrowRight size={16} />
          </>
        )}
      </button>

      <div className="pt-2 text-center">
        <Link
          href="/login"
          className="text-xs text-slate-400 hover:text-sky-300 transition-colors"
        >
          Voltar para o Login
        </Link>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
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
          <h1 className="text-2xl font-bold tracking-tight text-white">Criar Nova Senha</h1>
          <p className="text-sm text-slate-400 mt-1 text-center">
            Defina uma nova senha segura para sua conta
          </p>
        </div>

        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-3">
              <Loader2 className="animate-spin text-sky-400" size={28} />
              <span className="text-xs">Carregando formulário...</span>
            </div>
          }
        >
          <ResetPasswordContent />
        </Suspense>

        <div className="mt-8 text-center text-xs text-slate-500 space-y-1">
          <p>© 2026 ChamadoFlow.</p>
          <p className="text-[10px] text-slate-600">Ambiente Seguro e Monitorado para Auditoria</p>
        </div>
      </div>
    </div>
  );
}
