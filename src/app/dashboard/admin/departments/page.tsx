'use client';

import React, { useEffect, useState } from 'react';
import { 
  FolderCheck, 
  Loader2, 
  PlusCircle, 
  CheckCircle2, 
  XCircle,
  Trash2,
  FileSpreadsheet,
  Briefcase,
  HelpCircle
} from 'lucide-react';

interface DeptData {
  id: string;
  name: string;
  teams: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  customFields: { id: string; name: string; type: string; isRequired: boolean; options: string | null }[];
}

export default function SectorsAndCategoriesPage() {
  const [departments, setDepartments] = useState<DeptData[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Mensagens de Feedback
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // States do Cadastro de Setor
  const [newDeptName, setNewDeptName] = useState('');

  // States do Cadastro de Categoria
  const [newCatName, setNewCatName] = useState('');
  const [newCatDeptId, setNewCatDeptId] = useState('');

  // States do Cadastro de Campo Customizado
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('TEXT');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldDeptId, setNewFieldDeptId] = useState('');

  // Carregar dados de topologia
  const loadTopology = async () => {
    try {
      const res = await fetch('/api/departments');
      if (res.ok) {
        const data = await res.json();
        setDepartments(data);
      }
    } catch (err) {
      console.error('Erro ao carregar setores e categorias:', err);
    }
  };

  useEffect(() => {
    loadTopology().then(() => setLoading(false));
  }, []);

  const clearMessages = () => {
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  // Cadastro de Setor
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    
    clearMessages();
    setSubmitting(true);

    try {
      const res = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDeptName }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Erro ao cadastrar setor.');

      setSuccessMsg(`Setor "${newDeptName}" cadastrado com sucesso!`);
      setNewDeptName('');
      await loadTopology();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Cadastro de Categoria
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || !newCatDeptId) return;

    clearMessages();
    setSubmitting(true);

    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName, departmentId: newCatDeptId }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Erro ao cadastrar categoria.');

      setSuccessMsg(`Categoria "${newCatName}" cadastrada com sucesso!`);
      setNewCatName('');
      setNewCatDeptId('');
      await loadTopology();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Cadastro de Campo Personalizado
  const handleCreateCustomField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldName.trim() || !newFieldType || !newFieldDeptId) return;

    clearMessages();
    setSubmitting(true);

    try {
      const res = await fetch(`/api/admin/departments/${newFieldDeptId}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFieldName,
          type: newFieldType,
          options: newFieldType === 'SELECT' ? newFieldOptions : null,
          isRequired: newFieldRequired,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Erro ao cadastrar campo personalizado.');

      setSuccessMsg(`Campo personalizado "${newFieldName}" cadastrado com sucesso!`);
      setNewFieldName('');
      setNewFieldType('TEXT');
      setNewFieldOptions('');
      setNewFieldRequired(false);
      setNewFieldDeptId('');
      await loadTopology();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Exclusão/Inativação de Campo Personalizado
  const handleDeleteCustomField = async (deptId: string, fieldId: string, fieldName: string) => {
    if (!confirm(`Tem certeza que deseja remover o campo personalizado "${fieldName}"?`)) return;

    clearMessages();
    try {
      const res = await fetch(`/api/admin/departments/${deptId}/fields?fieldId=${fieldId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Erro ao remover campo personalizado.');

      setSuccessMsg(`Campo "${fieldName}" removido com sucesso.`);
      await loadTopology();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-400 gap-3">
        <Loader2 className="animate-spin text-sky-400" size={32} />
        Carregando gerenciador de setores e categorias...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Briefcase className="text-sky-400" /> Setores, Categorias & Campos Dinâmicos
        </h1>
        <p className="text-sm text-slate-400">
          Gerencie a estrutura organizacional de departamentos, as categorias de atendimento e os campos de informação dinâmicos de cada setor.
        </p>
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

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Creation Forms */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Create Department Form */}
          <form onSubmit={handleCreateDepartment} className="glass-panel p-6 rounded-2xl relative overflow-hidden space-y-4">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-sky-400/40"></div>
            <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-1.5">
              <PlusCircle size={16} className="text-sky-400" /> Cadastrar Novo Setor
            </h3>
            
            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 uppercase font-semibold">Nome do Setor / Departamento</label>
              <input
                type="text"
                placeholder="Ex: Recursos Humanos, Jurídico, TI"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                className="w-full bg-slate-950/40 border border-slate-800 rounded-lg text-slate-200 py-2 px-3 focus:outline-none focus:border-sky-400 text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !newDeptName.trim()}
              className="w-full py-2 px-4 bg-gradient-to-r from-sky-400 to-sky-500 hover:from-sky-500 hover:to-sky-600 text-slate-950 font-bold text-xs rounded-lg transition-all cursor-pointer disabled:opacity-40"
            >
              {submitting ? <Loader2 className="animate-spin inline mr-1" size={12} /> : null}
              Criar Setor
            </button>
          </form>

          {/* Create Category Form */}
          <form onSubmit={handleCreateCategory} className="glass-panel p-6 rounded-2xl relative overflow-hidden space-y-4">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-purple-400/40"></div>
            <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-1.5">
              <PlusCircle size={16} className="text-purple-400" /> Cadastrar Categoria
            </h3>
            
            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 uppercase font-semibold">Nome da Categoria de Chamado</label>
              <input
                type="text"
                placeholder="Ex: Admissão de Funcionário, Troca de Computador"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="w-full bg-slate-950/40 border border-slate-800 rounded-lg text-slate-200 py-2 px-3 focus:outline-none focus:border-sky-400 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 uppercase font-semibold">Setor Responsável</label>
              <select
                value={newCatDeptId}
                onChange={(e) => setNewCatDeptId(e.target.value)}
                className="w-full bg-slate-950/40 border border-slate-800 rounded-lg text-slate-300 py-2 px-3 focus:outline-none focus:border-sky-400 text-xs"
              >
                <option value="">Selecione...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting || !newCatName.trim() || !newCatDeptId}
              className="w-full py-2 px-4 bg-gradient-to-r from-purple-400 to-purple-500 hover:from-purple-500 hover:to-purple-600 text-white font-bold text-xs rounded-lg transition-all cursor-pointer disabled:opacity-40"
            >
              {submitting ? <Loader2 className="animate-spin inline mr-1" size={12} /> : null}
              Criar Categoria
            </button>
          </form>

          {/* Create Custom Field Form */}
          <form onSubmit={handleCreateCustomField} className="glass-panel p-6 rounded-2xl relative overflow-hidden space-y-4">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-amber-400/40"></div>
            <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-1.5">
              <PlusCircle size={16} className="text-amber-400" /> Cadastrar Campo Específico (Setor)
            </h3>
            
            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 uppercase font-semibold">Nome da Informação (Label)</label>
              <input
                type="text"
                placeholder="Ex: Endereço IP, Modelo do Monitor, CPF"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                className="w-full bg-slate-950/40 border border-slate-800 rounded-lg text-slate-200 py-2 px-3 focus:outline-none focus:border-sky-400 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 uppercase font-semibold">Tipo do Campo</label>
              <select
                value={newFieldType}
                onChange={(e) => setNewFieldType(e.target.value)}
                className="w-full bg-slate-950/40 border border-slate-800 rounded-lg text-slate-300 py-2 px-3 focus:outline-none focus:border-sky-400 text-xs"
              >
                <option value="TEXT">Texto Livre</option>
                <option value="NUMBER">Número</option>
                <option value="SELECT">Seleção (Múltiplas Opções)</option>
                <option value="DATE">Data</option>
                <option value="BOOLEAN">Booleano (Sim/Não)</option>
              </select>
            </div>

            {newFieldType === 'SELECT' && (
              <div className="space-y-1 animate-fadeIn">
                <label className="block text-[10px] text-slate-400 uppercase font-semibold">Opções de Seleção (separadas por vírgula)</label>
                <input
                  type="text"
                  placeholder="Ex: Notebook, Desktop, Servidor"
                  value={newFieldOptions}
                  onChange={(e) => setNewFieldOptions(e.target.value)}
                  className="w-full bg-slate-950/40 border border-slate-800 rounded-lg text-slate-200 py-2 px-3 focus:outline-none focus:border-sky-400 text-xs"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 uppercase font-semibold">Setor do Chamado</label>
              <select
                value={newFieldDeptId}
                onChange={(e) => setNewFieldDeptId(e.target.value)}
                className="w-full bg-slate-950/40 border border-slate-800 rounded-lg text-slate-300 py-2 px-3 focus:outline-none focus:border-sky-400 text-xs"
              >
                <option value="">Selecione...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                id="field-required"
                checked={newFieldRequired}
                onChange={(e) => setNewFieldRequired(e.target.checked)}
                className="w-4 h-4 bg-slate-950/40 border border-slate-800 rounded text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="field-required" className="text-xs text-slate-400 cursor-pointer select-none">
                Preenchimento Obrigatório
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting || !newFieldName.trim() || !newFieldDeptId}
              className="w-full py-2 px-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-all cursor-pointer disabled:opacity-40"
            >
              {submitting ? <Loader2 className="animate-spin inline mr-1" size={12} /> : null}
              Criar Campo
            </button>
          </form>

        </div>

        {/* Column 2: Sectors / Departments List Cards */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {departments.map((dept) => (
              <div key={dept.id} className="glass-panel p-5 rounded-2xl relative overflow-hidden space-y-4 hover:border-slate-800/80 transition-all flex flex-col justify-between">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-slate-800"></div>
                
                <div className="space-y-4">
                  {/* Department Name Header */}
                  <h4 className="font-bold text-slate-200 flex items-center gap-1.5 border-b border-slate-900 pb-2">
                    <FolderCheck className="text-sky-400" size={18} /> {dept.name}
                  </h4>

                  {/* Categories Area */}
                  <div className="space-y-2">
                    <span className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Categorias de Chamados:</span>
                    {dept.categories.length === 0 ? (
                      <span className="text-[10px] text-slate-600 italic block pl-1">Nenhuma categoria configurada.</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {dept.categories.map((c) => (
                          <span key={c.id} className="text-[10px] text-slate-300 bg-slate-900/40 px-2.5 py-0.5 rounded border border-slate-800/60 font-medium">
                            {c.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Custom Fields Area */}
                  <div className="space-y-2 pt-2 border-t border-slate-900/40">
                    <span className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Campos Específicos do Setor:</span>
                    {dept.customFields.length === 0 ? (
                      <span className="text-[10px] text-slate-600 italic block pl-1">Nenhum campo personalizado cadastrado.</span>
                    ) : (
                      <div className="space-y-1.5">
                        {dept.customFields.map((cf) => (
                          <div key={cf.id} className="flex justify-between items-center text-xs text-slate-400 bg-slate-950/20 px-2 py-1 rounded border border-slate-900/40 group hover:border-slate-800/40 transition-colors">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-slate-300">{cf.name}</span>
                              {cf.isRequired && (
                                <span className="text-[8px] bg-red-500/10 text-red-400 border border-red-500/20 px-1 py-0.2 rounded font-bold uppercase">*</span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {/* Display Type Badge */}
                              <span className="text-[8px] bg-slate-900 text-slate-500 border border-slate-800 px-1.5 py-0.2 rounded font-semibold uppercase">
                                {cf.type}
                              </span>

                              {/* Delete Custom Field Button */}
                              <button
                                onClick={() => handleDeleteCustomField(dept.id, cf.id, cf.name)}
                                className="text-slate-600 hover:text-red-400 transition-colors p-0.5 cursor-pointer opacity-40 group-hover:opacity-100"
                                title={`Remover campo "${cf.name}"`}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 text-[10px] text-slate-600 flex items-center gap-1 italic border-t border-slate-900/40 mt-2">
                  <HelpCircle size={10} /> O preenchimento destes campos será exigido na abertura de chamado para este setor.
                </div>

              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
