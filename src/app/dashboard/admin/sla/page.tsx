'use client';

import React, { useEffect, useState } from 'react';
import { 
  Clock, 
  RotateCcw, 
  Save, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Flame,
  AlertCircle,
  HelpCircle,
  Info,
  ShieldCheck,
  Zap,
  Timer,
  Sliders,
  Layers,
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter,
  X,
  Briefcase,
  ChevronRight
} from 'lucide-react';
import { apiFetch } from '@/shared/utils/api';

interface SlaRuleItem {
  id: string;
  name: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  responseTimeMinutes: number;
  resolutionTimeMinutes: number;
  active: boolean;
  departmentId?: string | null;
  categoryId?: string | null;
  department?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
}

interface DepartmentData {
  id: string;
  name: string;
  categories: { id: string; name: string }[];
}

const PRIORITY_META = {
  URGENT: {
    label: 'Crítico / Urgente',
    tag: 'URGENTE',
    colorTheme: 'red',
    borderClass: 'border-red-500/30',
    topBarClass: 'bg-gradient-to-r from-red-500 to-rose-600',
    badgeClass: 'bg-red-500/10 text-red-400 border border-red-500/20',
    icon: Flame,
    defaultResp: 30, // 30 min
    defaultRes: 240, // 4 hours
    itilBenchmark: 'Meta ITIL: 1ª Resp. 30 min | Resolução 4h',
    description: 'Paradas totais de operação, falhas de segurança críticas ou indisponibilidade de serviços essenciais.',
  },
  HIGH: {
    label: 'Alta Prioridade',
    tag: 'ALTA',
    colorTheme: 'amber',
    borderClass: 'border-amber-500/30',
    topBarClass: 'bg-gradient-to-r from-amber-500 to-orange-600',
    badgeClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    icon: AlertCircle,
    defaultResp: 60, // 1h
    defaultRes: 480, // 8 hours
    itilBenchmark: 'Meta ITIL: 1ª Resp. 1h | Resolução 8h',
    description: 'Problemas que afetam múltiplos colaboradores ou processos centrais com alto impacto no negócio.',
  },
  MEDIUM: {
    label: 'Média Prioridade',
    tag: 'MÉDIA',
    colorTheme: 'sky',
    borderClass: 'border-sky-500/30',
    topBarClass: 'bg-gradient-to-r from-sky-500 to-blue-600',
    badgeClass: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
    icon: Timer,
    defaultResp: 120, // 2h
    defaultRes: 1440, // 24 hours
    itilBenchmark: 'Meta ITIL: 1ª Resp. 2h | Resolução 24h',
    description: 'Dificuldades operacionais rotineiras que não impedem a execução total do trabalho.',
  },
  LOW: {
    label: 'Baixa Prioridade',
    tag: 'BAIXA',
    colorTheme: 'emerald',
    borderClass: 'border-emerald-500/30',
    topBarClass: 'bg-gradient-to-r from-emerald-500 to-teal-600',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    icon: Zap,
    defaultResp: 480, // 8h
    defaultRes: 4320, // 72 hours
    itilBenchmark: 'Meta ITIL: 1ª Resp. 8h | Resolução 72h',
    description: 'Dúvidas pontuais, pequenas solicitações administrativas ou melhorias incrementais.',
  },
};

// Formatação humanizada para visualização
function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0 min';
  if (minutes < 60) return `${minutes} min`;
  
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  
  if (hours < 24) {
    return remMinutes > 0 ? `${hours}h ${remMinutes}min` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (remHours === 0 && remMinutes === 0) return `${days} ${days === 1 ? 'dia' : 'dias'}`;
  if (remMinutes === 0) return `${days}d ${remHours}h`;
  return `${days}d ${remHours}h ${remMinutes}m`;
}

export default function SlaAdminPage() {
  const [activeTab, setActiveTab] = useState<'global' | 'categories'>('global');

  // Regras Globais por Criticidade
  const [globalRules, setGlobalRules] = useState<SlaRuleItem[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState(true);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [resettingGlobal, setResettingGlobal] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Regras por Atividade / Categoria
  const [categoryRules, setCategoryRules] = useState<SlaRuleItem[]>([]);
  const [loadingCategoryRules, setLoadingCategoryRules] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');

  // Topologia de Setores e Categorias
  const [departments, setDepartments] = useState<DepartmentData[]>([]);

  // Modal de Criação / Edição de Regra por Atividade
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [savingModal, setSavingModal] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Form State do Modal
  const [formDeptId, setFormDeptId] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formName, setFormName] = useState('');
  const [formPriority, setFormPriority] = useState<string>(''); // Vazio = Todas as criticidades
  const [formResponseTime, setFormResponseTime] = useState<number>(30);
  const [formResolutionTime, setFormResolutionTime] = useState<number>(120);
  const [formActive, setFormActive] = useState<boolean>(true);

  // Mensagens globais de feedback
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Carregar regras globais
  const loadGlobalRules = async () => {
    try {
      setLoadingGlobal(true);
      const res = await apiFetch('/api/admin/sla');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Erro ao carregar as regras de SLA.');
      }
      const data: SlaRuleItem[] = await res.json();
      setGlobalRules(data);
      setHasChanges(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha na comunicação com o servidor.');
    } finally {
      setLoadingGlobal(false);
    }
  };

  // Carregar regras por categoria
  const loadCategoryRules = async () => {
    try {
      setLoadingCategoryRules(true);
      const res = await apiFetch('/api/admin/sla/categories');
      if (res.ok) {
        const data = await res.json();
        setCategoryRules(data);
      }
    } catch (err) {
      console.error('Erro ao carregar regras por categoria:', err);
    } finally {
      setLoadingCategoryRules(false);
    }
  };

  // Carregar lista de setores e categorias
  const loadDepartments = async () => {
    try {
      const res = await apiFetch('/api/departments');
      if (res.ok) {
        const data = await res.json();
        setDepartments(data);
      }
    } catch (err) {
      console.error('Erro ao carregar setores:', err);
    }
  };

  useEffect(() => {
    loadGlobalRules();
    loadCategoryRules();
    loadDepartments();
  }, []);

  const clearMessages = () => {
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  // --- HANDLERS DAS REGRAS GLOBAIS ---

  const handleGlobalRuleChange = (
    priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW',
    field: keyof SlaRuleItem,
    value: any
  ) => {
    clearMessages();
    setHasChanges(true);
    setGlobalRules((prev) =>
      prev.map((r) => {
        if (r.priority !== priority) return r;
        return {
          ...r,
          [field]: value,
        };
      })
    );
  };

  const handleSaveGlobal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    clearMessages();

    for (const r of globalRules) {
      if (!r.name.trim()) {
        setErrorMsg(`O nome do SLA para "${PRIORITY_META[r.priority].label}" não pode ficar vazio.`);
        return;
      }
      if (r.responseTimeMinutes <= 0) {
        setErrorMsg(`O tempo de 1ª resposta para "${PRIORITY_META[r.priority].label}" deve ser maior que 0 minutos.`);
        return;
      }
      if (r.resolutionTimeMinutes <= 0) {
        setErrorMsg(`O tempo de resolução para "${PRIORITY_META[r.priority].label}" deve ser maior que 0 minutos.`);
        return;
      }
      if (r.resolutionTimeMinutes < r.responseTimeMinutes) {
        setErrorMsg(
          `Para o nível "${PRIORITY_META[r.priority].label}", o tempo de resolução (${formatDuration(r.resolutionTimeMinutes)}) não pode ser inferior ao tempo de 1ª resposta (${formatDuration(r.responseTimeMinutes)}).`
        );
        return;
      }
    }

    try {
      setSavingGlobal(true);
      const res = await apiFetch('/api/admin/sla', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: globalRules }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Erro ao salvar regras de SLA.');
      }

      setSuccessMsg('Regras globais de SLA atualizadas com sucesso!');
      setGlobalRules(data.rules || globalRules);
      setHasChanges(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao salvar as regras de SLA.');
    } finally {
      setSavingGlobal(false);
    }
  };

  const handleResetItil = async () => {
    if (!confirm('Deseja realmente restaurar todas as 4 regras de SLA para os padrões oficiais ITIL (30min/4h, 1h/8h, 2h/24h, 8h/72h)?')) {
      return;
    }

    clearMessages();
    try {
      setResettingGlobal(true);
      const res = await apiFetch('/api/admin/sla', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_itil' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Erro ao restaurar padrões ITIL.');
      }

      setSuccessMsg('Padrões ITIL restaurados com sucesso em todas as regras globais!');
      setGlobalRules(data.rules);
      setHasChanges(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao restaurar padrões ITIL.');
    } finally {
      setResettingGlobal(false);
    }
  };

  // --- HANDLERS DAS REGRAS POR ATIVIDADE / CATEGORIA ---

  const openCreateModal = () => {
    clearMessages();
    setModalMode('create');
    setEditingRuleId(null);
    setFormDeptId('');
    setFormCategoryId('');
    setFormName('');
    setFormPriority('');
    setFormResponseTime(30);
    setFormResolutionTime(120);
    setFormActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (rule: SlaRuleItem) => {
    clearMessages();
    setModalMode('edit');
    setEditingRuleId(rule.id);
    setFormDeptId(rule.departmentId || '');
    setFormCategoryId(rule.categoryId || '');
    setFormName(rule.name);
    setFormPriority(rule.priority || '');
    setFormResponseTime(rule.responseTimeMinutes);
    setFormResolutionTime(rule.resolutionTimeMinutes);
    setFormActive(rule.active);
    setIsModalOpen(true);
  };

  const handleDeptSelectInModal = (deptId: string) => {
    setFormDeptId(deptId);
    setFormCategoryId('');
  };

  const handleCategorySelectInModal = (catId: string) => {
    setFormCategoryId(catId);
    const dept = departments.find((d) => d.id === formDeptId);
    const cat = dept?.categories.find((c) => c.id === catId);
    if (cat && (!formName || formName.startsWith('SLA - '))) {
      setFormName(`SLA - ${cat.name}`);
    }
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!formDeptId) {
      setErrorMsg('Selecione o Setor responsável.');
      return;
    }
    if (!formCategoryId) {
      setErrorMsg('Selecione a Categoria / Atividade.');
      return;
    }
    if (!formName.trim()) {
      setErrorMsg('Informe um nome descritivo para a regra de SLA.');
      return;
    }
    if (formResponseTime <= 0) {
      setErrorMsg('O tempo de 1ª resposta deve ser maior que 0 minutos.');
      return;
    }
    if (formResolutionTime <= 0) {
      setErrorMsg('O tempo de resolução deve ser maior que 0 minutos.');
      return;
    }
    if (formResolutionTime < formResponseTime) {
      setErrorMsg(
        `O tempo de resolução (${formatDuration(formResolutionTime)}) não pode ser menor que o tempo de resposta (${formatDuration(formResponseTime)}).`
      );
      return;
    }

    try {
      setSavingModal(true);
      const payload: any = {
        name: formName,
        departmentId: formDeptId,
        categoryId: formCategoryId,
        priority: formPriority || undefined,
        responseTimeMinutes: formResponseTime,
        resolutionTimeMinutes: formResolutionTime,
        active: formActive,
      };

      if (modalMode === 'create') {
        const res = await apiFetch('/api/admin/sla/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Erro ao cadastrar regra por atividade.');

        setSuccessMsg(`Regra de SLA "${formName}" cadastrada com sucesso!`);
      } else {
        const res = await apiFetch(`/api/admin/sla/categories/${editingRuleId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Erro ao atualizar regra por atividade.');

        setSuccessMsg(`Regra de SLA "${formName}" atualizada com sucesso!`);
      }

      setIsModalOpen(false);
      await loadCategoryRules();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao salvar regra por atividade.');
    } finally {
      setSavingModal(false);
    }
  };

  const handleDeleteCategoryRule = async (rule: SlaRuleItem) => {
    if (!confirm(`Deseja realmente excluir a regra de SLA "${rule.name}"? Os chamados desta atividade voltarão a respeitar o padrão geral da criticidade.`)) {
      return;
    }

    clearMessages();
    try {
      const res = await apiFetch(`/api/admin/sla/categories/${rule.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro ao excluir regra.');

      setSuccessMsg(`Regra de SLA "${rule.name}" removida com sucesso.`);
      await loadCategoryRules();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao excluir regra.');
    }
  };

  const handleToggleCategoryRuleActive = async (rule: SlaRuleItem) => {
    clearMessages();
    try {
      const res = await apiFetch(`/api/admin/sla/categories/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !rule.active }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erro ao alternar status da regra.');
      }
      setCategoryRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r))
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao alterar status.');
    }
  };

  // Filtragem das regras por categoria
  const filteredCategoryRules = categoryRules.filter((r) => {
    const matchesDept = selectedDeptFilter ? r.departmentId === selectedDeptFilter : true;
    const searchLower = categorySearch.toLowerCase();
    const matchesSearch =
      !categorySearch ||
      r.name.toLowerCase().includes(searchLower) ||
      (r.category?.name && r.category.name.toLowerCase().includes(searchLower)) ||
      (r.department?.name && r.department.name.toLowerCase().includes(searchLower));
    return matchesDept && matchesSearch;
  });

  if (loadingGlobal) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-400 gap-3">
        <Loader2 className="animate-spin text-sky-400" size={32} />
        <span className="text-sm font-medium">Carregando parametrização de SLA...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/10 border border-sky-500/20 rounded-xl text-sky-400">
              <Clock size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">
                Parametrização & Gestão de SLA
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Defina os tempos limites de primeira resposta e resolução técnica (padrões globais ou específicos por atividade).
              </p>
            </div>
          </div>
        </div>

        {/* Global Tab Actions */}
        {activeTab === 'global' ? (
          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              type="button"
              onClick={handleResetItil}
              disabled={resettingGlobal || savingGlobal}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-slate-100 text-xs font-semibold rounded-xl border border-slate-700/60 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Restaurar valores de fábrica ITIL"
            >
              {resettingGlobal ? (
                <Loader2 className="animate-spin text-slate-400" size={15} />
              ) : (
                <RotateCcw size={15} />
              )}
              Padrões ITIL
            </button>

            <button
              type="button"
              onClick={() => handleSaveGlobal()}
              disabled={savingGlobal || resettingGlobal}
              className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-sky-500/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {savingGlobal ? (
                <Loader2 className="animate-spin" size={15} />
              ) : (
                <Save size={15} />
              )}
              Salvar Regras
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-sky-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus size={16} />
              Novo SLA por Atividade
            </button>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('global')}
          className={`pb-3 px-4 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'global'
              ? 'border-sky-400 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders size={16} />
          Padrões Globais por Criticidade
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
            4 Níveis ITIL
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`pb-3 px-4 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'categories'
              ? 'border-sky-400 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers size={16} />
          SLAs por Atividade (Categorias)
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono">
            {categoryRules.length}
          </span>
        </button>
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

      {/* TAB 1: PADRÕES GLOBAIS POR CRITICIDADE */}
      {activeTab === 'global' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Changes Alert Banner */}
          {hasChanges && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                <span>Você realizou alterações nas regras globais que ainda não foram salvas.</span>
              </div>
              <button
                onClick={() => handleSaveGlobal()}
                disabled={savingGlobal}
                className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                Salvar Agora
              </button>
            </div>
          )}

          {/* Grid of Global SLA Rules Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const).map((priorityKey) => {
              const rule = globalRules.find((r) => r.priority === priorityKey) || {
                id: `sla-itil-${priorityKey.toLowerCase()}`,
                name: PRIORITY_META[priorityKey].label,
                priority: priorityKey,
                responseTimeMinutes: PRIORITY_META[priorityKey].defaultResp,
                resolutionTimeMinutes: PRIORITY_META[priorityKey].defaultRes,
                active: true,
              };
              const meta = PRIORITY_META[priorityKey];
              const IconComponent = meta.icon;

              const responsePresets = priorityKey === 'URGENT' 
                ? [15, 30, 45, 60]
                : priorityKey === 'HIGH'
                ? [30, 60, 90, 120]
                : priorityKey === 'MEDIUM'
                ? [60, 120, 180, 240]
                : [120, 240, 480, 720];

              const resolutionPresets = priorityKey === 'URGENT'
                ? [120, 240, 360, 480]
                : priorityKey === 'HIGH'
                ? [240, 480, 720, 1440]
                : priorityKey === 'MEDIUM'
                ? [720, 1440, 2880, 4320]
                : [1440, 2880, 4320, 7200];

              const isResolutionInvalid = rule.resolutionTimeMinutes < rule.responseTimeMinutes;

              return (
                <div
                  key={priorityKey}
                  className={`glass-panel p-5 sm:p-6 rounded-2xl relative overflow-hidden border ${meta.borderClass} space-y-5 transition-all hover:shadow-lg`}
                >
                  <div className={`absolute top-0 left-0 right-0 h-[3px] ${meta.topBarClass}`} />

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${meta.badgeClass}`}>
                        <IconComponent size={22} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-slate-100">{meta.label}</h2>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${meta.badgeClass}`}>
                            {meta.tag}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                          {meta.description}
                        </p>
                      </div>
                    </div>

                    {/* Active Toggle Switch with Fix */}
                    <label className="flex items-center gap-2 cursor-pointer shrink-0" title="Ativar ou desativar regra">
                      <span className="text-[11px] font-medium text-slate-400">
                        {rule.active ? 'Ativa' : 'Inativa'}
                      </span>
                      <div className="relative inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={rule.active}
                          onChange={(e) => handleGlobalRuleChange(priorityKey, 'active', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="relative w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
                      </div>
                    </label>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] text-slate-400 uppercase font-semibold tracking-wider">
                      Identificação do SLA
                    </label>
                    <input
                      type="text"
                      value={rule.name}
                      onChange={(e) => handleGlobalRuleChange(priorityKey, 'name', e.target.value)}
                      placeholder="Nome descritivo da regra"
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-xl text-slate-200 py-2 px-3.5 text-xs focus:outline-none focus:border-sky-400 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {/* 1ª Resposta */}
                    <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <Clock size={14} className="text-sky-400" /> 1ª Resposta
                        </span>
                        <span className="text-xs font-bold text-sky-400">
                          {formatDuration(rule.responseTimeMinutes)}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={rule.responseTimeMinutes}
                            onChange={(e) =>
                              handleGlobalRuleChange(
                                priorityKey,
                                'responseTimeMinutes',
                                Math.max(1, parseInt(e.target.value) || 1)
                              )
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg text-slate-200 py-1.5 px-3 text-xs font-mono focus:outline-none focus:border-sky-400"
                          />
                          <span className="text-xs text-slate-400 shrink-0 font-medium">minutos</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-wrap pt-0.5">
                        <span className="text-[10px] text-slate-500 mr-1">Atalhos:</span>
                        {responsePresets.map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => handleGlobalRuleChange(priorityKey, 'responseTimeMinutes', mins)}
                            className={`text-[10px] px-2 py-0.5 rounded border transition-all cursor-pointer ${
                              rule.responseTimeMinutes === mins
                                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                            }`}
                          >
                            {formatDuration(mins)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Resolução Técnica */}
                    <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <ShieldCheck size={14} className="text-emerald-400" /> Resolução Final
                        </span>
                        <span className="text-xs font-bold text-emerald-400">
                          {formatDuration(rule.resolutionTimeMinutes)}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={rule.resolutionTimeMinutes}
                            onChange={(e) =>
                              handleGlobalRuleChange(
                                priorityKey,
                                'resolutionTimeMinutes',
                                Math.max(1, parseInt(e.target.value) || 1)
                              )
                            }
                            className={`w-full bg-slate-900 border rounded-lg text-slate-200 py-1.5 px-3 text-xs font-mono focus:outline-none ${
                              isResolutionInvalid
                                ? 'border-red-500/70 focus:border-red-400'
                                : 'border-slate-800 focus:border-sky-400'
                            }`}
                          />
                          <span className="text-xs text-slate-400 shrink-0 font-medium">minutos</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-wrap pt-0.5">
                        <span className="text-[10px] text-slate-500 mr-1">Atalhos:</span>
                        {resolutionPresets.map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => handleGlobalRuleChange(priorityKey, 'resolutionTimeMinutes', mins)}
                            className={`text-[10px] px-2 py-0.5 rounded border transition-all cursor-pointer ${
                              rule.resolutionTimeMinutes === mins
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                            }`}
                          >
                            {formatDuration(mins)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {isResolutionInvalid && (
                    <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                      <AlertTriangle size={15} className="shrink-0" />
                      <span>
                        Atenção: O tempo de resolução não pode ser menor que o tempo de primeira resposta.
                      </span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Info size={13} className="text-slate-400" />
                      {meta.itilBenchmark}
                    </span>
                    <span className="font-mono text-slate-400">
                      Total: {rule.resolutionTimeMinutes}m
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: SLAS POR ATIVIDADE (CATEGORIAS) */}
      {activeTab === 'categories' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Informative Callout */}
          <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-sky-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-500/20 rounded-xl text-sky-400 shrink-0">
                <Info size={18} />
              </div>
              <p className="leading-relaxed">
                <strong className="text-white">Precedência de Atividade:</strong> Quando um chamado é registrado com uma categoria configurada nesta lista (ex: <em>&ldquo;Troca de Lâmpada&rdquo;</em>), o prazo específico desta regra sobrepõe o SLA genérico da criticidade.
              </p>
            </div>
            <button
              onClick={openCreateModal}
              className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-semibold shrink-0 cursor-pointer shadow-sm transition-all"
            >
              + Adicionar Regra
            </button>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex-1 flex flex-col sm:flex-row items-center gap-2">
              <div className="relative w-full sm:w-72">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar por atividade ou setor..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-sky-400"
                />
              </div>

              <div className="relative w-full sm:w-56">
                <Filter size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <select
                  value={selectedDeptFilter}
                  onChange={(e) => setSelectedDeptFilter(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-sky-400"
                >
                  <option value="">Todos os Setores</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* List of Category Rules */}
          {loadingCategoryRules ? (
            <div className="flex flex-col items-center justify-center p-16 text-slate-400 gap-2">
              <Loader2 className="animate-spin text-sky-400" size={24} />
              <span className="text-xs">Carregando regras por atividade...</span>
            </div>
          ) : filteredCategoryRules.length === 0 ? (
            <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center space-y-3">
              <div className="w-12 h-12 bg-slate-900 border border-slate-800 text-slate-500 rounded-2xl flex items-center justify-center mx-auto">
                <Layers size={24} />
              </div>
              <h3 className="text-sm font-semibold text-slate-300">
                Nenhum SLA por atividade encontrado
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {categorySearch || selectedDeptFilter
                  ? 'Nenhuma regra corresponde aos filtros selecionados.'
                  : 'Cadastre tempos específicos para atividades que fogem do padrão geral da criticidade (ex: Troca de Lâmpada com resolução de 30 minutos).'}
              </p>
              {!categorySearch && !selectedDeptFilter && (
                <button
                  onClick={openCreateModal}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus size={15} /> Cadastrar Primeiro SLA por Atividade
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCategoryRules.map((rule) => {
                return (
                  <div
                    key={rule.id}
                    className="glass-panel p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700/80 relative overflow-hidden space-y-4 transition-all hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">
                          <Briefcase size={12} className="text-sky-400" />
                          <span>{rule.department?.name || 'Setor'}</span>
                          <ChevronRight size={10} className="text-slate-600" />
                          <span className="text-slate-200 font-semibold">{rule.category?.name || 'Geral'}</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-100">{rule.name}</h4>
                      </div>

                      {/* Toggle Active */}
                      <label className="flex items-center cursor-pointer shrink-0" title="Ativar ou desativar regra">
                        <div className="relative inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={rule.active}
                            onChange={() => handleToggleCategoryRuleActive(rule)}
                            className="sr-only peer"
                          />
                          <div className="relative w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-sky-500"></div>
                        </div>
                      </label>
                    </div>

                    {/* Metric Cards */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="p-2.5 bg-slate-950/40 border border-slate-800/60 rounded-xl space-y-1">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 uppercase font-semibold">
                          <Clock size={11} className="text-sky-400" /> 1ª Resp.
                        </span>
                        <span className="text-xs font-bold text-slate-200 block">
                          {formatDuration(rule.responseTimeMinutes)}
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-950/40 border border-slate-800/60 rounded-xl space-y-1">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 uppercase font-semibold">
                          <ShieldCheck size={11} className="text-emerald-400" /> Resolução
                        </span>
                        <span className="text-xs font-bold text-emerald-400 block">
                          {formatDuration(rule.resolutionTimeMinutes)}
                        </span>
                      </div>
                    </div>

                    {/* Card Footer: Priority filter tag + Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-900/80 text-xs">
                      <span className="text-[11px] text-slate-400">
                        {rule.priority ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
                            Criticidade: {PRIORITY_META[rule.priority]?.label || rule.priority}
                          </span>
                        ) : (
                          <span className="text-[10px] text-sky-400 font-medium">
                            Qualquer criticidade
                          </span>
                        )}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(rule)}
                          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
                          title="Editar regra"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteCategoryRule(rule)}
                          className="p-1.5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                          title="Excluir regra"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Architecture & Governance Informative Banner */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 bg-slate-950/30 space-y-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <HelpCircle size={15} className="text-sky-400" /> Entenda a Hierarquia do SLA no Sistema
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400 leading-relaxed">
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/60">
            <span className="block font-semibold text-slate-200 mb-1">1º Nível: Por Atividade</span>
            Se houver uma regra cadastrada para a Categoria do chamado (ex: &ldquo;Troca de Lâmpada&rdquo;), o prazo desta atividade prevalece imediatamente.
          </div>
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/60">
            <span className="block font-semibold text-slate-200 mb-1">2º Nível: Fallback Global</span>
            Caso a atividade não possua SLA customizado, o chamado adota a parametrização geral correspondente à sua criticidade (Urgente, Alta, Média ou Baixa).
          </div>
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/60">
            <span className="block font-semibold text-slate-200 mb-1">Pausa & Auditoria</span>
            Todas as regras respeitam a pausa de SLA quando em &ldquo;Aguardando resposta do solicitante&rdquo;, e qualquer alteração é registrada no Log de Auditoria.
          </div>
        </div>
      </div>

      {/* MODAL: CRIAR / EDITAR SLA POR ATIVIDADE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel w-full max-w-lg p-6 rounded-2xl border border-slate-800 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Layers size={18} className="text-sky-400" />
                {modalMode === 'create' ? 'Cadastrar SLA por Atividade' : 'Editar SLA por Atividade'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4 text-xs">
              {/* Setor */}
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 uppercase font-semibold">
                  Setor / Departamento *
                </label>
                <select
                  value={formDeptId}
                  onChange={(e) => handleDeptSelectInModal(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl text-slate-200 py-2 px-3 focus:outline-none focus:border-sky-400"
                  required
                >
                  <option value="">Selecione o Setor...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Categoria / Atividade */}
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 uppercase font-semibold">
                  Categoria / Atividade Específica *
                </label>
                <select
                  value={formCategoryId}
                  onChange={(e) => handleCategorySelectInModal(e.target.value)}
                  disabled={!formDeptId}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl text-slate-200 py-2 px-3 focus:outline-none focus:border-sky-400 disabled:opacity-40"
                  required
                >
                  <option value="">
                    {formDeptId ? 'Selecione a Categoria...' : 'Selecione o Setor primeiro'}
                  </option>
                  {departments
                    .find((d) => d.id === formDeptId)
                    ?.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Nome da Regra */}
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 uppercase font-semibold">
                  Nome da Regra de SLA *
                </label>
                <input
                  type="text"
                  placeholder="Ex: SLA - Troca de Lâmpada (Atividade Rápida)"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl text-slate-200 py-2 px-3 focus:outline-none focus:border-sky-400"
                  required
                />
              </div>

              {/* Criticidade Aplicável */}
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 uppercase font-semibold">
                  Criticidade Padrão da Atividade
                </label>
                <select
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl text-slate-200 py-2 px-3 focus:outline-none focus:border-sky-400"
                >
                  <option value="">Qualquer Criticidade (Livre para o Solicitante)</option>
                  <option value="LOW">Baixa Prioridade (Fixa no chamado)</option>
                  <option value="MEDIUM">Média Prioridade (Fixa no chamado)</option>
                  <option value="HIGH">Alta Prioridade (Fixa no chamado)</option>
                  <option value="URGENT">Crítico / Urgente (Fixa no chamado)</option>
                </select>
                <p className="text-[10px] text-slate-500">
                  {formPriority 
                    ? '🔒 O solicitante terá esta criticidade preenchida e travada automaticamente ao abrir o chamado.' 
                    : '🔓 O solicitante poderá escolher a criticidade livremente na abertura do chamado.'}
                </p>
              </div>

              {/* Métricas: Resposta e Resolução */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* 1ª Resposta */}
                <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                      <Clock size={13} className="text-sky-400" /> 1ª Resposta
                    </span>
                    <span className="text-xs font-bold text-sky-400 font-mono">
                      {formatDuration(formResponseTime)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      value={formResponseTime}
                      onChange={(e) => setFormResponseTime(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg text-slate-200 py-1 px-2.5 font-mono text-xs focus:outline-none focus:border-sky-400"
                    />
                    <span className="text-slate-400 text-[11px]">min</span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {[15, 30, 60, 120].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setFormResponseTime(m)}
                        className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                          formResponseTime === m
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {formatDuration(m)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resolução */}
                <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                      <ShieldCheck size={13} className="text-emerald-400" /> Resolução
                    </span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      {formatDuration(formResolutionTime)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      value={formResolutionTime}
                      onChange={(e) => setFormResolutionTime(Math.max(1, parseInt(e.target.value) || 1))}
                      className={`w-full bg-slate-900 border rounded-lg text-slate-200 py-1 px-2.5 font-mono text-xs focus:outline-none ${
                        formResolutionTime < formResponseTime
                          ? 'border-red-500/80 focus:border-red-400'
                          : 'border-slate-800 focus:border-sky-400'
                      }`}
                    />
                    <span className="text-slate-400 text-[11px]">min</span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {[30, 60, 120, 240, 480, 1440].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setFormResolutionTime(m)}
                        className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                          formResolutionTime === m
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {formatDuration(m)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Status Ativo */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-300">Regra ativa no sistema</span>
                <label className="flex items-center cursor-pointer">
                  <div className="relative inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={formActive}
                      onChange={(e) => setFormActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="relative w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-sky-500"></div>
                  </div>
                </label>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={savingModal}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold border border-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingModal || formResolutionTime < formResponseTime}
                  className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-sky-500/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingModal ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                  {modalMode === 'create' ? 'Cadastrar Regra' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
