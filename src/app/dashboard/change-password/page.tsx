'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, ShieldAlert, KeyRound } from 'lucide-react';

interface ChangePasswordForm {
  password: string;
  confirmPassword: string;
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ChangePasswordForm>();

  const watchedPassword = watch('password');

  const onSubmit = async (data: ChangePasswordForm) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: data.password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erro ao redefinir a senha.');
      }

      setSuccess(true);
      
      // Pequeno delay para exibir mensagem de sucesso antes do redirecionamento
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Erro de conexão.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 space-y-6">
      <div className="glass-panel p-8 rounded-2xl relative overflow-hidden space-y-6">
        {/* Glow border top */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400 to-purple-500"></div>

        {/* Warning Indicator */}
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3 text-amber-200">
          <ShieldAlert className="shrink-0 mt-0.5" size={20} />
          <div className="space-y-1">
            <h4 className="font-semibold text-xs uppercase tracking-wider">Redefinição Necessária</h4>
            <p className="text-xs text-slate-300 font-light leading-relaxed">
              Esta é uma nova conta criada com senha temporária (`usuario123`). Por motivos de segurança, você deve escolher uma senha pessoal para prosseguir.
            </p>
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-100 flex items-center justify-center gap-2">
            <KeyRound className="text-sky-400" /> Cadastrar Senha Pessoal
          </h2>
          <p className="text-xs text-slate-400 mt-1">Sua nova senha deve possuir pelo menos 6 caracteres.</p>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-xs">
            {error}
          </div>
        )}

        {success ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-500/15 border border-emerald-500/25 rounded-full flex items-center justify-center mx-auto text-emerald-400 animate-bounce">
              ✓
            </div>
            <h3 className="font-semibold text-slate-200 text-sm">Senha Atualizada!</h3>
            <p className="text-xs text-slate-400">Você será redirecionado ao painel...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            
            {/* New Password */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Nova Senha
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  {...register('password', {
                    required: 'A nova senha é obrigatória.',
                    minLength: { value: 6, message: 'A nova senha deve possuir pelo menos 6 caracteres.' }
                  })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/40 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-400 text-xs"
                />
              </div>
              {errors.password && (
                <span className="text-xs text-red-400 mt-1 block">{errors.password.message}</span>
              )}
            </div>

            {/* Confirm New Password */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  placeholder="Repita a nova senha"
                  {...register('confirmPassword', {
                    required: 'A confirmação é obrigatória.',
                    validate: (value) => value === watchedPassword || 'As senhas não coincidem.'
                  })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/40 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-400 text-xs"
                />
              </div>
              {errors.confirmPassword && (
                <span className="text-xs text-red-400 mt-1 block">{errors.confirmPassword.message}</span>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-sky-400 to-purple-500 hover:from-sky-500 hover:to-purple-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all glow-primary hover:glow-accent disabled:opacity-40 cursor-pointer"
            >
              {loading ? <Loader2 className="animate-spin" size={14} /> : null}
              Salvar e Entrar no Painel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
