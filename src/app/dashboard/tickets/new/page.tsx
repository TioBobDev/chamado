'use client';

import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Save, FilePlus2, CheckCircle2, Paperclip, X, PlusCircle } from 'lucide-react';
import Link from 'next/link';

interface Department {
  id: string;
  name: string;
  categories: { id: string; name: string }[];
}

interface CustomField {
  id: string;
  name: string;
  type: 'TEXT' | 'NUMBER' | 'SELECT' | 'DATE' | 'BOOLEAN';
  options: string | null;
  isRequired: boolean;
}

interface FormValues {
  title: string;
  description: string;
  departmentId: string;
  categoryId: string;
  priority: string;
  impact: string;
  urgency: string;
  customFields: Record<string, string>;
}

export default function NewTicketPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingFields, setLoadingFields] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError: setFormError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      priority: 'MEDIUM',
      impact: 'MEDIUM',
      urgency: 'MEDIUM',
      customFields: {},
    },
  });

  const watchedDeptId = watch('departmentId');

  // Carrega os departamentos no início
  useEffect(() => {
    fetch('/api/departments?excludeMyDepartments=true')
      .then((res) => res.json())
      .then((data) => {
        setDepartments(data);
        setLoadingConfig(false);
      })
      .catch(() => {
        setError('Erro ao carregar dados do formulário.');
        setLoadingConfig(false);
      });
  }, []);

  // Monitora a troca de departamento para carregar categorias e campos dinâmicos
  useEffect(() => {
    if (!watchedDeptId) {
      setSelectedDept(null);
      setCustomFields([]);
      return;
    }

    const dept = departments.find((d) => d.id === watchedDeptId) || null;
    setSelectedDept(dept);
    
    // Reseta categoria antiga selecionada
    setValue('categoryId', '');

    // Carregar campos customizados
    setLoadingFields(true);
    fetch(`/api/departments/${watchedDeptId}/fields`)
      .then((res) => res.json())
      .then((fields) => {
        setCustomFields(fields);
        setLoadingFields(false);
      })
      .catch(() => {
        setLoadingFields(false);
      });
  }, [watchedDeptId, departments, setValue]);

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    setError(null);

    // Mapear campos dinâmicos do objeto Record para array [{ fieldId, value }]
    const customFieldsArray = Object.entries(data.customFields || {})
      .filter(([_, value]) => value !== undefined && value !== '')
      .map(([fieldId, value]) => ({
        fieldId,
        value: String(value),
      }));

    const payload = {
      title: data.title,
      description: data.description,
      departmentId: data.departmentId,
      categoryId: data.categoryId,
      priority: data.priority,
      impact: data.impact,
      urgency: data.urgency,
      customFields: customFieldsArray,
    };

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.errors) {
          // Marca erros individuais no react-hook-form
          Object.entries(result.errors).forEach(([field, messages]) => {
            const message = Array.isArray(messages) ? messages[0] : String(messages);
            setFormError(field as any, { type: 'server', message });
          });

          // Monta lista descritiva para exibir no alerta de topo
          const errorList = Object.values(result.errors)
            .map((messages: any) => `• ${Array.isArray(messages) ? messages[0] : messages}`)
            .join('\n');
          throw new Error(`Erro de validação:\n${errorList}`);
        }
        throw new Error(result.message || 'Erro ao abrir o chamado.');
      }

      // Upload do arquivo anexo se selecionado
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const attachRes = await fetch(`/api/tickets/${result.id}/attachments`, {
          method: 'POST',
          body: formData,
        });

        if (!attachRes.ok) {
          const attachResult = await attachRes.json();
          throw new Error(attachResult.message || 'Chamado criado, mas erro ao anexar a imagem.');
        }
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Erro de conexão.');
      setSubmitting(false);
    }
  };

  if (loadingConfig) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
        <Loader2 className="animate-spin text-sky-400" size={32} />
        Carregando formulários...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header & Back link */}
      <div className="flex items-center gap-4">
        <Link 
          href="/dashboard"
          className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition-all cursor-pointer"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Abrir Novo Chamado</h1>
          <p className="text-sm text-slate-400">Preencha os detalhes e informe sua necessidade.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm whitespace-pre-line">
          {error}
        </div>
      )}

      {/* Main Form Card */}
      <form onSubmit={handleSubmit(onSubmit)} className="glass-panel p-8 rounded-2xl relative overflow-hidden space-y-6">
        {/* Glow border */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-sky-400 to-purple-500"></div>

        <div className="flex items-center gap-2 text-sky-400 border-b border-slate-900 pb-4 mb-4">
          <FilePlus2 size={20} />
          <h3 className="font-semibold">Informações Gerais</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Department Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Departamento Destinatário <span className="text-red-400">*</span>
            </label>
            <select
              {...register('departmentId', { required: 'Selecione o departamento.' })}
              className="w-full bg-slate-950/40 border border-slate-800 rounded-xl text-slate-200 py-3 px-4 focus:outline-none focus:border-sky-400 text-sm"
            >
              <option value="">Selecione...</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {errors.departmentId && (
              <span className="text-xs text-red-400 mt-1 block">{errors.departmentId.message}</span>
            )}
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Categoria do Chamado <span className="text-red-400">*</span>
            </label>
            <select
              disabled={!watchedDeptId}
              {...register('categoryId', { required: 'Selecione a categoria.' })}
              className="w-full bg-slate-950/40 border border-slate-800 rounded-xl text-slate-200 py-3 px-4 focus:outline-none focus:border-sky-400 text-sm disabled:opacity-40"
            >
              <option value="">Selecione...</option>
              {selectedDept?.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.categoryId && (
              <span className="text-xs text-red-400 mt-1 block">{errors.categoryId.message}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-900 pt-6">
          {/* Priority */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Prioridade</label>
            <select
              {...register('priority')}
              className="w-full bg-slate-950/40 border border-slate-800 rounded-xl text-slate-200 py-2.5 px-4 focus:outline-none focus:border-sky-400 text-sm"
            >
              <option value="LOW">Baixa</option>
              <option value="MEDIUM">Média</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </select>
          </div>

          {/* Impact */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Impacto</label>
            <select
              {...register('impact')}
              className="w-full bg-slate-950/40 border border-slate-800 rounded-xl text-slate-200 py-2.5 px-4 focus:outline-none focus:border-sky-400 text-sm"
            >
              <option value="LOW">Baixo</option>
              <option value="MEDIUM">Médio</option>
              <option value="HIGH">Alto</option>
            </select>
          </div>

          {/* Urgency */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Urgência</label>
            <select
              {...register('urgency')}
              className="w-full bg-slate-950/40 border border-slate-800 rounded-xl text-slate-200 py-2.5 px-4 focus:outline-none focus:border-sky-400 text-sm"
            >
              <option value="LOW">Baixa</option>
              <option value="MEDIUM">Média</option>
              <option value="HIGH">Alta</option>
            </select>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2 border-t border-slate-900 pt-6">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Título / Assunto Resumido <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            placeholder="Ex: Falha na VPN corporativa ou Solicitação de acesso"
            {...register('title', { required: 'O título é obrigatório.' })}
            className="w-full bg-slate-950/40 border border-slate-800 rounded-xl text-slate-200 py-3 px-4 focus:outline-none focus:border-sky-400 text-sm"
          />
          {errors.title && (
            <span className="text-xs text-red-400 mt-1 block">{errors.title.message}</span>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Detalhamento da Solicitação <span className="text-red-400">*</span>
          </label>
          <textarea
            rows={5}
            placeholder="Descreva detalhadamente o seu problema ou requisição..."
            {...register('description', { required: 'A descrição é obrigatória.' })}
            className="w-full bg-slate-950/40 border border-slate-800 rounded-xl text-slate-200 py-3 px-4 focus:outline-none focus:border-sky-400 text-sm resize-none"
          />
          {errors.description && (
            <span className="text-xs text-red-400 mt-1 block">{errors.description.message}</span>
          )}
        </div>

        {/* DYNAMIC CUSTOM FIELDS SECTION */}
        {watchedDeptId && (
          <div className="border-t border-slate-900 pt-6 space-y-4">
            <div className="flex items-center gap-2 text-purple-400">
              <CheckCircle2 size={20} />
              <h3 className="font-semibold text-sm">Informações Específicas do Departamento</h3>
            </div>

            {loadingFields ? (
              <div className="py-4 text-xs text-slate-500 animate-pulse">Carregando campos do setor...</div>
            ) : customFields.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Sem perguntas adicionais para este setor.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {customFields.map((field) => {
                  const requiredRule = field.isRequired ? 'Este campo é obrigatório.' : false;
                  
                  return (
                    <div key={field.id} className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        {field.name} {field.isRequired && <span className="text-red-400">*</span>}
                      </label>

                      {/* TEXT input */}
                      {field.type === 'TEXT' && (
                        <input
                          type="text"
                          placeholder="Digite aqui..."
                          {...register(`customFields.${field.id}`, { required: requiredRule })}
                          className="w-full bg-slate-950/40 border border-slate-800 rounded-xl text-slate-200 py-3 px-4 focus:outline-none focus:border-sky-400 text-sm"
                        />
                      )}

                      {/* NUMBER input */}
                      {field.type === 'NUMBER' && (
                        <input
                          type="number"
                          placeholder="0"
                          {...register(`customFields.${field.id}`, { required: requiredRule })}
                          className="w-full bg-slate-950/40 border border-slate-800 rounded-xl text-slate-200 py-3 px-4 focus:outline-none focus:border-sky-400 text-sm"
                        />
                      )}

                      {/* DATE input */}
                      {field.type === 'DATE' && (
                        <input
                          type="date"
                          {...register(`customFields.${field.id}`, { required: requiredRule })}
                          className="w-full bg-slate-950/40 border border-slate-800 rounded-xl text-slate-200 py-3 px-4 focus:outline-none focus:border-sky-400 text-sm"
                        />
                      )}

                      {/* SELECT dropdown */}
                      {field.type === 'SELECT' && (
                        <select
                          {...register(`customFields.${field.id}`, { required: requiredRule })}
                          className="w-full bg-slate-950/40 border border-slate-800 rounded-xl text-slate-200 py-3 px-4 focus:outline-none focus:border-sky-400 text-sm"
                        >
                          <option value="">Selecione...</option>
                          {field.options?.split(',').map((opt) => (
                            <option key={opt.trim()} value={opt.trim()}>{opt.trim()}</option>
                          ))}
                        </select>
                      )}

                      {/* BOOLEAN checkbox */}
                      {field.type === 'BOOLEAN' && (
                        <div className="flex items-center gap-3 py-2">
                          <input
                            type="checkbox"
                            {...register(`customFields.${field.id}`)}
                            className="w-5 h-5 bg-slate-950/40 border border-slate-800 rounded text-sky-400 focus:ring-sky-400"
                          />
                          <span className="text-sm text-slate-300">Confirmar/Ativar</span>
                        </div>
                      )}

                      {errors.customFields?.[field.id] && (
                        <span className="text-xs text-red-400 mt-1 block">
                          {errors.customFields[field.id]?.message}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ATTACHMENT SECTION */}
        <div className="border-t border-slate-900 pt-6 space-y-4">
          <div className="flex items-center gap-2 text-sky-400">
            <Paperclip size={20} />
            <h3 className="font-semibold text-sm">Anexo de Imagem (Opcional)</h3>
          </div>
          
          <div className="space-y-2">
            <p className="text-xs text-slate-400">Se desejar, anexe uma imagem (print screen ou foto) para ajudar na resolução do problema (limite de 10MB).</p>
            
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-950/40 border border-slate-800 hover:border-sky-400 rounded-xl text-xs font-medium text-slate-300 hover:text-slate-100 transition-all cursor-pointer select-none">
                <PlusCircle size={14} className="text-sky-400" /> Selecionar Imagem
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSelectedFile(file);
                  }}
                  className="hidden"
                />
              </label>

              {selectedFile && (
                <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-800/60 px-3 py-1.5 rounded-xl text-xs text-slate-300 animate-fadeIn">
                  <span className="truncate max-w-[200px] font-medium">{selectedFile.name}</span>
                  <span className="text-[10px] text-slate-500">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="p-0.5 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                    title="Remover arquivo"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 bg-gradient-to-r from-sky-400 to-purple-500 hover:from-sky-500 hover:to-purple-600 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all glow-primary hover:glow-accent disabled:opacity-50 disabled:cursor-not-allowed text-sm mt-8 cursor-pointer"
        >
          {submitting ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <>
              <Save size={18} /> Gravar e Registrar Chamado
            </>
          )}
        </button>
      </form>
    </div>
  );
}
