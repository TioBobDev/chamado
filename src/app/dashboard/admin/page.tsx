'use client';

import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Loader2, 
  PlusCircle, 
  UserPlus, 
  Mail, 
  CheckCircle2, 
  XCircle,
  Search,
  UserCheck,
  UserX,
  Edit2,
  X
} from 'lucide-react';

interface UserData {
  id: string;
  name: string;
  email: string;
  active: boolean;
  roleId: string;
  role: { name: string };
  departments?: { departmentId: string }[];
  createdAt: string;
}

interface RoleData {
  id: string;
  name: string;
}

interface DeptData {
  id: string;
  name: string;
}

export default function UsersManagementPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [departments, setDepartments] = useState<DeptData[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Mensagens de Feedback
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // States do Usuário (Cadastro / Edição)
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRoleId, setNewUserRoleId] = useState('');
  const [newUserActive, setNewUserActive] = useState(true);
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);

  // Busca de usuários
  const [userSearchText, setUserSearchText] = useState('');

  // Carregar dados de usuários, perfis e setores
  const loadUsersRolesAndDepts = async (search = '') => {
    setLoadingUsers(true);
    try {
      const queryParams = search ? `?search=${encodeURIComponent(search)}` : '';
      const [resUsers, resRoles, resDepts] = await Promise.all([
        fetch(`/api/admin/users${queryParams}`),
        fetch('/api/admin/roles'),
        fetch('/api/departments'),
      ]);

      if (resUsers.ok) {
        const usersData = await resUsers.json();
        setUsers(usersData);
      }
      if (resRoles.ok) {
        const rolesData = await resRoles.json();
        setRoles(rolesData);
      }
      if (resDepts.ok) {
        const deptsData = await resDepts.json();
        setDepartments(deptsData);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadUsersRolesAndDepts().then(() => setLoading(false));
  }, []);

  const clearMessages = () => {
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  // Cadastro ou Edição de Usuário
  const handleUserFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserRoleId) return;

    clearMessages();
    setSubmitting(true);

    try {
      const isEditing = !!editingUser;
      const url = isEditing ? `/api/admin/users/${editingUser.id}` : '/api/admin/users';
      const method = isEditing ? 'PATCH' : 'POST';

      const payload: any = {
        name: newUserName,
        email: newUserEmail,
        roleId: newUserRoleId,
        departmentIds: selectedDeptIds,
      };

      // Só envia senha se for edição e estiver preenchida
      if (isEditing && newUserPassword && newUserPassword.trim() !== '') {
        payload.password = newUserPassword;
      }
      
      if (isEditing) {
        payload.active = newUserActive;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Erro ao salvar usuário.');

      setSuccessMsg(`Usuário "${newUserName}" ${isEditing ? 'atualizado' : 'cadastrado'} com sucesso!`);
      
      // Reseta states
      setEditingUser(null);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRoleId('');
      setNewUserActive(true);
      setSelectedDeptIds([]);

      await loadUsersRolesAndDepts(userSearchText);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Alterna o status ativo/inativo rapidamente
  const handleToggleUserActive = async (user: UserData) => {
    clearMessages();
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !user.active }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Erro ao alterar status.');

      setSuccessMsg(`Status do usuário "${user.name}" atualizado com sucesso.`);
      
      // Se estiver editando o usuário ativo, atualiza o state correspondente
      if (editingUser?.id === user.id) {
        setNewUserActive(!user.active);
      }

      await loadUsersRolesAndDepts(userSearchText);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Carrega usuário no formulário esquerdo para edição
  const startEditing = (user: UserData) => {
    clearMessages();
    setEditingUser(user);
    setNewUserName(user.name);
    setNewUserEmail(user.email);
    setNewUserPassword(''); // deixa em branco
    setNewUserRoleId(user.roleId);
    setNewUserActive(user.active);
    setSelectedDeptIds(user.departments?.map((d: any) => d.departmentId) || []);
  };

  // Cancela edição e volta para o modo cadastro
  const cancelEditing = () => {
    setEditingUser(null);
    setNewUserName('');
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserRoleId('');
    setNewUserActive(true);
    setSelectedDeptIds([]);
  };

  // Dispara a busca
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadUsersRolesAndDepts(userSearchText);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-400 gap-3">
        <Loader2 className="animate-spin text-sky-400" size={32} />
        Buscando dados de usuários...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Users className="text-sky-400" /> Gerenciamento de Usuários
        </h1>
        <p className="text-sm text-slate-400">Gerencie as contas de usuários associadas e controle perfis de acesso (RBAC).</p>
      </div>

      {/* Feedback Alerts */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-sm flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 size={18} /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-sm flex items-center gap-2 animate-fadeIn">
          <XCircle size={18} /> {errorMsg}
        </div>
      )}

      {/* Users Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* User Form Column (Switches between CREATE and EDIT) */}
        <div className="lg:col-span-1">
          <form onSubmit={handleUserFormSubmit} className="glass-panel p-6 rounded-2xl relative overflow-hidden space-y-4">
            {/* Highlight bar matches status */}
            <div 
              className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${
                editingUser ? 'from-amber-400 to-amber-500' : 'from-sky-400 to-purple-500'
              }`}
            ></div>
            
            <div className="flex items-center justify-between border-b border-slate-900 pb-2">
              <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-1.5">
                {editingUser ? (
                  <>
                    <Edit2 size={18} className="text-amber-400" /> Editar Conta Usuário
                  </>
                ) : (
                  <>
                    <UserPlus size={18} className="text-sky-400" /> Cadastrar Novo Usuário
                  </>
                )}
              </h3>
              {editingUser && (
                <button 
                  type="button" 
                  onClick={cancelEditing}
                  className="p-1 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-900 transition-all cursor-pointer"
                  title="Cancelar Edição"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 uppercase font-semibold">Nome Completo</label>
              <input
                type="text"
                placeholder="Ex: João da Silva"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="w-full bg-slate-950/40 border border-slate-800 rounded-lg text-slate-200 py-2.5 px-3 focus:outline-none focus:border-sky-400 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 uppercase font-semibold">E-mail Corporativo</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-500">
                  <Mail size={14} />
                </span>
                <input
                  type="email"
                  placeholder="nome@empresa.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full pl-8 pr-3 bg-slate-950/40 border border-slate-800 rounded-lg text-slate-200 py-2.5 px-3 focus:outline-none focus:border-sky-400 text-xs"
                />
              </div>
            </div>

            {editingUser && (
              <div className="space-y-1 animate-fadeIn">
                <label className="block text-[10px] text-slate-400 uppercase font-semibold">
                  Senha (Deixe em branco p/ manter)
                </label>
                <input
                  type="password"
                  placeholder="•••••••• (Inalterada)"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full bg-slate-950/40 border border-slate-800 rounded-lg text-slate-200 py-2.5 px-3 focus:outline-none focus:border-sky-400 text-xs"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 uppercase font-semibold">Perfil de Acesso (RBAC)</label>
              <select
                value={newUserRoleId}
                onChange={(e) => setNewUserRoleId(e.target.value)}
                className="w-full bg-slate-950/40 border border-slate-800 rounded-lg text-slate-300 py-2.5 px-3 focus:outline-none focus:border-sky-400 text-xs"
              >
                <option value="">Selecione...</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>

            {/* Setores/Departamentos do Atendente */}
            <div className="space-y-2 pt-2 border-t border-slate-900">
              <label className="block text-[10px] text-slate-400 uppercase font-semibold">Setores aos quais responde</label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {departments.map((dept) => {
                  const isChecked = selectedDeptIds.includes(dept.id);
                  
                  return (
                    <div key={dept.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`dept-chk-${dept.id}`}
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDeptIds([...selectedDeptIds, dept.id]);
                          } else {
                            setSelectedDeptIds(selectedDeptIds.filter((id) => id !== dept.id));
                          }
                        }}
                        className="w-4 h-4 bg-slate-950/40 border border-slate-800 rounded text-sky-400 focus:ring-sky-400 cursor-pointer"
                      />
                      <label htmlFor={`dept-chk-${dept.id}`} className="text-xs text-slate-400 cursor-pointer select-none">
                        {dept.name}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            {editingUser && (
              <div className="flex items-center gap-3 py-2 border-t border-slate-900 pt-3">
                <input
                  type="checkbox"
                  id="edit-user-active"
                  checked={newUserActive}
                  onChange={(e) => setNewUserActive(e.target.checked)}
                  className="w-4 h-4 bg-slate-950/40 border border-slate-800 rounded text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="edit-user-active" className="text-xs font-medium text-slate-400 cursor-pointer">
                  Conta Ativa (Desmarque para inativar acesso)
                </label>
              </div>
            )}

            <div className="flex gap-2">
              {editingUser && (
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 font-bold text-xs rounded-lg transition-all cursor-pointer"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={submitting || !newUserName.trim() || !newUserEmail.trim() || !newUserRoleId}
                className={`flex-1 py-2.5 px-4 font-bold text-xs rounded-lg transition-all disabled:opacity-40 cursor-pointer ${
                  editingUser 
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 glow-primary' 
                    : 'bg-gradient-to-r from-sky-400 to-purple-500 hover:from-sky-500 hover:to-purple-600 text-white glow-primary hover:glow-accent'
                }`}
              >
                {submitting ? <Loader2 className="animate-spin inline mr-1" size={12} /> : null}
                {editingUser ? 'Salvar Edição' : 'Criar Usuário'}
              </button>
            </div>
          </form>
        </div>

        {/* List & Search Users Column */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Search Input bar */}
          <form onSubmit={handleSearchSubmit} className="glass-panel p-4 rounded-xl flex gap-2">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder="Buscar usuário por nome ou e-mail..."
                value={userSearchText}
                onChange={(e) => setUserSearchText(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-950/40 border border-slate-950 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-400 text-xs"
              />
            </div>
            <button 
              type="submit"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Pesquisar
            </button>
          </form>

          {/* Users Table */}
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="p-4 bg-slate-950/20 border-b border-slate-900">
              <h4 className="font-semibold text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users size={14} /> Contas de Usuários Cadastradas
              </h4>
            </div>

            {loadingUsers ? (
              <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                <Loader2 className="animate-spin text-sky-400" size={20} />
                Buscando dados de usuários...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-900 bg-slate-950/30 font-semibold text-slate-500 uppercase">
                      <th className="py-3 px-5">Nome</th>
                      <th className="py-3 px-5">E-mail</th>
                      <th className="py-3 px-5">Perfil</th>
                      <th className="py-3 px-5">Status</th>
                      <th className="py-3 px-5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/30 text-slate-300">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-900/10 transition-colors">
                        <td className="py-3 px-5 font-medium text-slate-200">
                          {user.name}
                        </td>
                        <td className="py-3 px-5 text-slate-400">
                          {user.email}
                        </td>
                        <td className="py-3 px-5">
                          <span className="bg-sky-500/5 text-sky-400 border border-sky-500/10 px-2 py-0.5 rounded font-medium text-[10px]">
                            {user.role.name}
                          </span>
                        </td>
                        <td className="py-3 px-5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[9px] border ${
                            user.active 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}>
                            {user.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-right flex justify-end gap-2">
                          {/* Ativar / Inativar button */}
                          <button
                            onClick={() => handleToggleUserActive(user)}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              user.active 
                                ? 'text-red-400 hover:text-red-300 bg-red-500/5 border-red-500/10 hover:border-red-500/20' 
                                : 'text-emerald-400 hover:text-emerald-300 bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/20'
                            }`}
                            title={user.active ? "Inativar Usuário" : "Ativar Usuário"}
                          >
                            {user.active ? <UserX size={14} /> : <UserCheck size={14} />}
                          </button>
                          
                          {/* Editar button */}
                          <button
                            onClick={() => startEditing(user)}
                            className="p-1.5 text-amber-400 hover:text-amber-300 bg-amber-500/5 border border-amber-500/10 hover:border-amber-500/20 rounded-lg transition-all cursor-pointer"
                            title="Editar Detalhes"
                          >
                            <Edit2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
