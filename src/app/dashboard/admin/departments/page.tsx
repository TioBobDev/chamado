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
  HelpCircle,
  Plus,
  X
} from 'lucide-react';
import { apiFetch } from '@/shared/utils/api';

interface DeptData {
  id: string;
  name: string;
  teams: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  customFields: {
    id: string;
    name: string;
    type: string;
    isRequired: boolean;
    options: string | null;
    categoryId?: string | null;
    category?: { id: string; name: string } | null;
  }[];
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
  const [fieldOptionsList, setFieldOptionsList] = useState<string[]>([]);
  const [optionInput, setOptionInput] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldDeptId, setNewFieldDeptId] = useState('');
  const [newFieldCategoryId, setNewFieldCategoryId] = useState('');
  const [fieldFormError, setFieldFormError] = useState<string | null>(null);
  const [fieldFormSuccess, setFieldFormSuccess] = useState<string | null>(null);

  // Carregar dados de topologia
  const loadTopology = async () => {
    try {
      const res = await apiFetch('/api/departments');
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
    const trimmed = newDeptName.trim();
    if (!trimmed) return;
    
    clearMessages();

    // Verificação de duplicidade de nome no client-side
    const duplicate = departments.some(
      (d) => d.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      setErrorMsg(`Já existe um setor cadastrado com o nome "${trimmed}".`);
      return;
    }

    setSubmitting(true);

    try {
      const res = await apiFetch('/api/admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Erro ao cadastrar setor.');

      setSuccessMsg(`Setor "${trimmed}" cadastrado com sucesso!`);
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
    const trimmedCat = newCatName.trim();
    if (!trimmedCat || !newCatDeptId) return;

    clearMessages();

    // Verificação de duplicidade na categoria do setor
    const targetDept = departments.find((d) => d.id === newCatDeptId);
    if (
      targetDept?.categories.some(
        (c) => c.name.trim().toLowerCase() === trimmedCat.toLowerCase()
      )
    ) {
      setErrorMsg(`A categoria "${trimmedCat}" já existe neste setor.`);
      return;
    }

    setSubmitting(true);

    try {
      const res = await apiFetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedCat, departmentId: newCatDeptId }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Erro ao cadastrar categoria.');

      setSuccessMsg(`Categoria "${trimmedCat}" cadastrada com sucesso!`);
      setNewCatName('');
      setNewCatDeptId('');
      await loadTopology();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Gestão de opções para Checkbox e Seleção
  const handleAddOption = () => {
    if (!optionInput.trim()) return;
    const splitItems = optionInput
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    setFieldOptionsList((prev) => {
      const uniqueNew = splitItems.filter((it) => !prev.includes(it));
      return [...prev, ...uniqueNew];
    });
    setOptionInput('');
  };

  const handleRemoveOption = (indexToRemove: number) => {
    setFieldOptionsList((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Cadastro de Campo Personalizado
  const handleCreateCustomField = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldFormError(null);
    setFieldFormSuccess(null);
    clearMessages();

    if (!newFieldName.trim()) {
      setFieldFormError('Por favor, informe o Nome da Informação (Label).');
      return;
    }

    if (!newFieldDeptId) {
      setFieldFormError('Por favor, selecione o Setor do Chamado.');
      return;
    }

    const isOptionsType = newFieldType === 'SELECT' || newFieldType === 'CHECKBOX';

    // Captura opções das tags e qualquer texto que o usuário digitou no input no momento
    const pendingOptions = optionInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const mergedOptions = Array.from(new Set([...fieldOptionsList, ...pendingOptions]));

    if (isOptionsType && mergedOptions.length === 0) {
      setFieldFormError('Informe pelo menos uma opção para o campo de Checkbox/Seleção.');
      return;
    }

    setSubmitting(true);

    try {
      const optionsPayload = isOptionsType ? mergedOptions.join(', ') : null;

      const res = await apiFetch(`/api/admin/departments/${newFieldDeptId}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFieldName.trim(),
          type: newFieldType,
          options: optionsPayload,
          isRequired: newFieldRequired,
          categoryId: newFieldCategoryId && newFieldCategoryId.trim() !== '' ? newFieldCategoryId : null,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Erro ao cadastrar campo personalizado.');

      const successText = `Campo personalizado "${newFieldName}" cadastrado com sucesso!`;
      setFieldFormSuccess(successText);
      setSuccessMsg(successText);
      setNewFieldName('');
      setNewFieldType('TEXT');
      setNewFieldOptions('');
      setFieldOptionsList([]);
      setOptionInput('');
      setNewFieldRequired(false);
      setNewFieldDeptId('');
      setNewFieldCategoryId('');
      await loadTopology();
    } catch (err: any) {
      setFieldFormError(err.message || 'Erro ao cadastrar campo personalizado.');
      setErrorMsg(err.message || 'Erro ao cadastrar campo personalizado.');
    } finally {
      setSubmitting(false);
    }
  };

  // Exclusão/Inativação de Campo Personalizado
  const handleDeleteCustomField = async (deptId: string, fieldId: string, fieldName: string) => {
    if (!confirm(`Tem certeza que deseja remover o campo personalizado "${fieldName}"?`)) return;

    clearMessages();
    try {
      const res = await apiFetch(`/api/admin/departments/${deptId}/fields?fieldId=${fieldId}`, {
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
          <form onSubmit={handleCreateDepartment} className="glass-panel p-4 sm:p-6 rounded-2xl relative overflow-hidden space-y-4">
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
          <form onSubmit={handleCreateCategory} className="glass-panel p-4 sm:p-6 rounded-2xl relative overflow-hidden space-y-4">
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
          <form onSubmit={handleCreateCustomField} className="glass-panel p-4 sm:p-6 rounded-2xl relative overflow-hidden space-y-4">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-amber-400/40"></div>
            <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-1.5">
              <PlusCircle size={16} className="text-amber-400" /> Cadastrar Campo Específico (Setor)
            </h3>
            
            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 uppercase font-semibold">Nome da Informação (Label)</label>
              <input
                type="text"
                placeholder="Ex: Formato, Tamanho, Sistema Operacional"
                value={newFieldName}
                onChange={(e) => {
                  setNewFieldName(e.target.value);
                  setFieldFormError(null);
                  setFieldFormSuccess(null);
                }}
                className="w-full bg-slate-950/40 border border-slate-800 rounded-lg text-slate-200 py-2 px-3 focus:outline-none focus:border-sky-400 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 uppercase font-semibold">Tipo do Campo</label>
              <select
                value={newFieldType}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewFieldType(val);
                  if (val !== 'SELECT' && val !== 'CHECKBOX') {
                    setFieldOptionsList([]);
                    setOptionInput('');
                  }
                }}
                className="w-full bg-slate-950/40 border border-slate-800 rounded-lg text-slate-300 py-2 px-3 focus:outline-none focus:border-sky-400 text-xs"
              >
                <option value="TEXT">Texto Livre</option>
                <option value="NUMBER">Número</option>
                <option value="SELECT">Seleção (Múltiplas Opções)</option>
                <option value="CHECKBOX">Checkbox</option>
                <option value="DATE">Data</option>
                <option value="BOOLEAN">Booleano (Sim/Não)</option>
              </select>
            </div>

            {(newFieldType === 'SELECT' || newFieldType === 'CHECKBOX') && (
              <div className="space-y-2 p-3 bg-slate-950/50 rounded-xl border border-slate-800/80 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] text-slate-300 uppercase font-semibold">
                    {newFieldType === 'CHECKBOX' ? 'Opções do Checkbox' : 'Opções de Seleção'}
                  </label>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {fieldOptionsList.length} {fieldOptionsList.length === 1 ? 'opção' : 'opções'}
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={
                      newFieldType === 'CHECKBOX'
                        ? 'Ex: Presencial, Online (ou tecle Enter)'
                        : 'Ex: Notebook, Desktop (ou tecle Enter)'
                    }
                    value={optionInput}
                    onChange={(e) => setOptionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOption();
                      }
                    }}
                    className="flex-1 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-200 py-1.5 px-3 focus:outline-none focus:border-amber-400 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                  >
                    <Plus size={14} /> Adicionar
                  </button>
                </div>

                {fieldOptionsList.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {fieldOptionsList.map((opt, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 text-xs bg-slate-900 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-lg"
                      >
                        {newFieldType === 'CHECKBOX' && (
                          <span className="w-2 h-2 rounded-sm border border-amber-400/80 bg-amber-400/20 inline-block"></span>
                        )}
                        <span>{opt}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          className="text-slate-400 hover:text-red-400 transition-colors ml-0.5 cursor-pointer"
                          title={`Remover "${opt}"`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-amber-400/80 italic">
                    {newFieldType === 'CHECKBOX'
                      ? 'Adicione N opções que os usuários poderão selecionar via checkbox.'
                      : 'Adicione as opções que aparecerão na lista de seleção.'}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 uppercase font-semibold">Setor do Chamado</label>
              <select
                value={newFieldDeptId}
                onChange={(e) => {
                  setNewFieldDeptId(e.target.value);
                  setNewFieldCategoryId('');
                  setFieldFormError(null);
                  setFieldFormSuccess(null);
                }}
                className="w-full bg-slate-950/40 border border-slate-800 rounded-lg text-slate-300 py-2 px-3 focus:outline-none focus:border-sky-400 text-xs"
              >
                <option value="">Selecione o setor...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 uppercase font-semibold">Categoria de Chamado</label>
              <select
                disabled={!newFieldDeptId}
                value={newFieldCategoryId}
                onChange={(e) => setNewFieldCategoryId(e.target.value)}
                className="w-full bg-slate-950/40 border border-slate-800 rounded-lg text-slate-300 py-2 px-3 focus:outline-none focus:border-sky-400 text-xs disabled:opacity-40"
              >
                <option value="">Todas as Categorias do Setor</option>
                {departments.find((d) => d.id === newFieldDeptId)?.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
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

            {fieldFormError && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-200 text-xs flex items-center gap-2 animate-fadeIn">
                <XCircle size={15} className="shrink-0 text-red-400" />
                <span className="font-medium">{fieldFormError}</span>
              </div>
            )}

            {fieldFormSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                <span className="font-medium">{fieldFormSuccess}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-amber-950/20"
            >
              {submitting ? <Loader2 className="animate-spin inline mr-1" size={13} /> : null}
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
                          <div key={cf.id} className="flex justify-between items-center text-xs text-slate-400 bg-slate-950/20 px-2 py-1.5 rounded border border-slate-900/40 group hover:border-slate-800/40 transition-colors">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <span className="font-medium text-slate-300">{cf.name}</span>
                              {cf.isRequired && (
                                <span className="text-[8px] bg-red-500/10 text-red-400 border border-red-500/20 px-1 py-0.2 rounded font-bold uppercase">*</span>
                              )}
                              {cf.category ? (
                                <span className="text-[9px] bg-purple-500/15 text-purple-300 border border-purple-500/25 px-1.5 py-0.2 rounded font-medium">
                                  {cf.category.name}
                                </span>
                              ) : (
                                <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-medium">
                                  Geral
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 shrink-0">
                              {/* Display Type Badge */}
                              <span className="text-[8px] bg-slate-900 text-slate-500 border border-slate-800 px-1.5 py-0.2 rounded font-semibold uppercase">
                                {cf.type}
                              </span>

                              {cf.options && (
                                <span
                                  className="text-[8px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded font-medium"
                                  title={`Opções: ${cf.options}`}
                                >
                                  {cf.options.split(',').length} opç.
                                </span>
                              )}

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
