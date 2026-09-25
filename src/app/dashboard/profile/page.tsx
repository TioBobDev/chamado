'use client';

import React, { useEffect, useState, useRef } from 'react';
import { 
  User, 
  Mail, 
  Shield, 
  Building, 
  Briefcase, 
  Camera, 
  Trash2, 
  KeyRound, 
  Save, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Calendar,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { apiFetch, withBasePath } from '@/shared/utils/api';
import { useRouter } from 'next/navigation';
import PushNotificationManager from '@/components/PushNotificationManager';

interface UserProfileData {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
  role: { id: string; name: string; description?: string };
  company: { id: string; name: string };
  departments: { id: string; name: string }[];
  teams: { id: string; name: string }[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // States dos dados cadastrais
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // States de alteração de senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // States de upload do Avatar
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Feedback Messages
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const clearMessages = () => {
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  const loadProfile = async () => {
    try {
      const res = await apiFetch('/api/users/profile');
      if (!res.ok) {
        throw new Error('Falha ao carregar informações do perfil.');
      }
      const data: UserProfileData = await res.json();
      setProfile(data);
      setName(data.name);
      setEmail(data.email);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar dados do usuário.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  // Salvar Dados Cadastrais
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!name.trim()) {
      setErrorMsg('O nome não pode ficar em branco.');
      return;
    }
    if (!email.trim()) {
      setErrorMsg('O e-mail não pode ficar em branco.');
      return;
    }

    try {
      setSavingProfile(true);
      const res = await apiFetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Erro ao atualizar dados cadastrais.');
      }

      setSuccessMsg('Dados cadastrais atualizados com sucesso!');
      await loadProfile();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('user-profile-updated', {
            detail: { name: name.trim(), email: email.trim() },
          })
        );
      }
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao salvar dados.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Alterar Senha de Acesso
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!currentPassword) {
      setErrorMsg('Informe sua senha atual para continuar.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('A nova senha deve possuir pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMsg('A confirmação da nova senha não confere.');
      return;
    }

    try {
      setSavingPassword(true);
      const res = await apiFetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          currentPassword,
          newPassword,
          confirmNewPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Erro ao atualizar senha.');
      }

      setSuccessMsg('Senha alterada com sucesso! Utilize-a em seu próximo login.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao alterar senha.');
    } finally {
      setSavingPassword(false);
    }
  };

  // Upload de Foto / Avatar
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    e.target.value = '';
    clearMessages();

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WEBP ou GIF).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('A imagem não pode ultrapassar o limite de 5MB.');
      return;
    }

    try {
      setUploadingAvatar(true);
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiFetch('/api/users/profile/avatar', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Erro ao enviar foto.');
      }

      setSuccessMsg('Foto de perfil atualizada com sucesso!');
      await loadProfile();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('user-avatar-updated', {
            detail: { avatarUrl: data.avatarUrl },
          })
        );
      }
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao atualizar foto de perfil.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Remover Foto / Avatar
  const handleRemoveAvatar = async () => {
    if (!confirm('Deseja realmente remover sua foto de perfil?')) return;
    clearMessages();

    try {
      setUploadingAvatar(true);
      const res = await apiFetch('/api/users/profile/avatar', {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Erro ao remover foto.');
      }

      setSuccessMsg('Foto de perfil removida com sucesso.');
      await loadProfile();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('user-avatar-updated', {
            detail: { avatarUrl: null },
          })
        );
      }
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao remover foto.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-400 gap-3">
        <Loader2 className="animate-spin text-sky-400" size={32} />
        <span className="text-sm font-medium">Carregando seu perfil...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center text-slate-400">
        Não foi possível carregar as informações do seu perfil.
      </div>
    );
  }

  const initials = profile.name.substring(0, 2).toUpperCase();

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <User className="text-sky-400" /> Meu Perfil
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Gerencie suas informações cadastrais, foto de avatar e credenciais de segurança.
        </p>
      </div>

      {/* Feedback Messages */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-sm flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-sm flex items-center gap-2 animate-fadeIn">
          <XCircle size={18} className="text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* HERO CARD: FOTO + RESUMO */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl relative overflow-hidden border border-slate-800/80 shadow-xl">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-sky-400 via-blue-500 to-purple-500" />

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar Container with Hover Actions */}
          <div className="relative group shrink-0">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden border-2 border-slate-700/80 group-hover:border-sky-400 transition-all shadow-2xl relative bg-slate-900 flex items-center justify-center">
              {profile.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={withBasePath(profile.avatarUrl)}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-sky-500 to-purple-600 flex items-center justify-center font-bold text-slate-950 text-3xl sm:text-4xl shadow-inner">
                  {initials}
                </div>
              )}

              {/* Uploading Overlay */}
              {uploadingAvatar && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-1.5 text-sky-400">
                  <Loader2 className="animate-spin" size={24} />
                  <span className="text-[10px] font-medium text-slate-200">Enviando...</span>
                </div>
              )}
            </div>

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
            />

            {/* Quick Upload Button on Avatar Corner */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-2 -right-2 p-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl shadow-lg border-2 border-[#090d16] transition-all cursor-pointer hover:scale-105"
              title="Trocar foto de perfil"
            >
              <Camera size={16} />
            </button>
          </div>

          {/* User Meta Info */}
          <div className="flex-1 text-center sm:text-left space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-100">{profile.name}</h2>
              <span className="inline-flex items-center gap-1 self-center sm:self-auto text-xs px-2.5 py-0.5 rounded-full font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Shield size={12} /> {profile.role.name}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-400 flex items-center justify-center sm:justify-start gap-1.5">
              <Mail size={14} className="text-slate-500" /> {profile.email}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1 text-xs text-slate-400">
              <span className="flex items-center gap-1 bg-slate-950/40 px-2.5 py-1 rounded-lg border border-slate-800">
                <Building size={13} className="text-slate-500" />
                {profile.company.name}
              </span>

              <span className="flex items-center gap-1 bg-slate-950/40 px-2.5 py-1 rounded-lg border border-slate-800">
                <Calendar size={13} className="text-slate-500" />
                No sistema desde {new Date(profile.createdAt).toLocaleDateString('pt-BR')}
              </span>
            </div>

            {/* Associated Departments */}
            {profile.departments.length > 0 && (
              <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                <span className="text-[11px] text-slate-500 mr-1 flex items-center gap-1">
                  <Briefcase size={12} /> Setores:
                </span>
                {profile.departments.map((dept) => (
                  <span
                    key={dept.id}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300"
                  >
                    {dept.name}
                  </span>
                ))}
              </div>
            )}

            {/* Avatar Action Buttons */}
            <div className="flex items-center justify-center sm:justify-start gap-2 pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700/60 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Camera size={14} className="text-sky-400" />
                Carregar Nova Foto
              </button>

              {profile.avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={uploadingAvatar}
                  className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-semibold rounded-xl border border-red-500/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  title="Remover foto e voltar para as iniciais"
                >
                  <Trash2 size={14} />
                  Remover Foto
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Push Notifications Card (Celular & PWA) */}
      <PushNotificationManager />

      {/* TWO COLUMNS: DADOS CADASTRAIS & SEGURANÇA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* COLUNA 1: DADOS CADASTRAIS */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <div className="p-2 bg-sky-500/10 rounded-xl text-sky-400">
              <User size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Dados Pessoais</h3>
              <p className="text-[11px] text-slate-400">Atualize seu nome de exibição e e-mail de contato.</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            {/* Nome Completo */}
            <div className="space-y-1.5">
              <label className="block text-[11px] text-slate-400 uppercase font-semibold">
                Nome Completo *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
                required
                className="w-full bg-slate-900 border border-slate-800 rounded-xl text-slate-200 py-2.5 px-3.5 focus:outline-none focus:border-sky-400 text-xs transition-colors"
              />
            </div>

            {/* E-mail */}
            <div className="space-y-1.5">
              <label className="block text-[11px] text-slate-400 uppercase font-semibold">
                Endereço de E-mail *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@empresa.com"
                required
                className="w-full bg-slate-900 border border-slate-800 rounded-xl text-slate-200 py-2.5 px-3.5 focus:outline-none focus:border-sky-400 text-xs transition-colors"
              />
            </div>

            {/* Perfil de Acesso (Readonly) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] text-slate-400 uppercase font-semibold">
                  Perfil de Acesso
                </label>
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Lock size={10} /> Não editável
                </span>
              </div>
              <input
                type="text"
                value={profile.role.name}
                disabled
                className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl text-slate-400 py-2.5 px-3.5 text-xs cursor-not-allowed"
              />
            </div>

            {/* Empresa (Readonly) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] text-slate-400 uppercase font-semibold">
                  Organização / Empresa
                </label>
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Lock size={10} /> Não editável
                </span>
              </div>
              <input
                type="text"
                value={profile.company.name}
                disabled
                className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl text-slate-400 py-2.5 px-3.5 text-xs cursor-not-allowed"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {savingProfile ? (
                  <Loader2 className="animate-spin" size={15} />
                ) : (
                  <Save size={15} />
                )}
                Salvar Dados Pessoais
              </button>
            </div>
          </form>
        </div>

        {/* COLUNA 2: SEGURANÇA & SENHA */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400">
              <KeyRound size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Segurança de Acesso</h3>
              <p className="text-[11px] text-slate-400">Altere sua senha de autenticação para proteger sua conta.</p>
            </div>
          </div>

          <form onSubmit={handleSavePassword} className="space-y-4 text-xs">
            {/* Senha Atual */}
            <div className="space-y-1.5">
              <label className="block text-[11px] text-slate-400 uppercase font-semibold">
                Senha Atual *
              </label>
              <div className="relative">
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Informe sua senha atual"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl text-slate-200 py-2.5 pl-3.5 pr-10 focus:outline-none focus:border-purple-400 text-xs transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {showCurrentPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Nova Senha */}
            <div className="space-y-1.5">
              <label className="block text-[11px] text-slate-400 uppercase font-semibold">
                Nova Senha *
              </label>
              <div className="relative">
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl text-slate-200 py-2.5 pl-3.5 pr-10 focus:outline-none focus:border-purple-400 text-xs transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {showNewPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirmar Nova Senha */}
            <div className="space-y-1.5">
              <label className="block text-[11px] text-slate-400 uppercase font-semibold">
                Confirmar Nova Senha *
              </label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl text-slate-200 py-2.5 px-3.5 focus:outline-none focus:border-purple-400 text-xs transition-colors"
              />
            </div>

            <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
              💡 Para sua segurança, recomendamos senhas que mesclem letras maiúsculas, minúsculas, números e símbolos especiais.
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={savingPassword || !currentPassword || !newPassword}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {savingPassword ? (
                  <Loader2 className="animate-spin" size={15} />
                ) : (
                  <KeyRound size={15} />
                )}
                Atualizar Senha
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
