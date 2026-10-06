'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Search, 
  Filter, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Layers, 
  UserCheck, 
  PauseCircle, 
  ChevronLeft, 
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { apiFetch } from '@/shared/utils/api';

interface Ticket {
  id: string;
  number: number;
  title: string;
  requester: { id: string; name: string };
  attendant: { id: string; name: string } | null;
  department: { name: string };
  category: { name: string };
  status: { id: string; name: string; color: string; isFinal?: boolean };
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  slaDeadline: string | null;
  slaViolated: boolean;
  slaPausedAt?: string | null;
  createdAt: string;
}

const DEFAULT_STATUSES = [
  { id: 'status-aberto', name: 'Aberto' },
  { id: 'status-atendimento', name: 'Em Atendimento' },
  { id: 'status-aguardando-solicitante', name: 'Aguardando resposta do solicitante' },
  { id: 'status-encerrado', name: 'Encerrado' },
];

const PAGE_LIMIT = 5;

export default function TicketQueuePage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [statusId, setStatusId] = useState('');
  const [priority, setPriority] = useState('');

  // Paginação (5 por página)
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTickets, setTotalTickets] = useState(0);

  // Contadores analíticos da fila geral
  const [metrics, setMetrics] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    violated: 0,
  });

  // Lista de status carregada para os filtros
  const [statuses, setStatuses] = useState<{ id: string; name: string }[]>(DEFAULT_STATUSES);

  useEffect(() => {
    // Carrega dados da sessão do usuário
    apiFetch('/api/auth/me')
      .then((res) => res.json())
      .then((user) => {
        if (user && user.id) {
          setCurrentUser(user);
        }
      })
      .catch((err) => console.error('Erro ao obter sessão:', err));

    // Carrega filtros de status com ordenação lógica do sistema
    apiFetch('/api/tickets/statuses')
      .then((res) => {
        if (!res.ok) throw new Error('Falha ao obter status');
        return res.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        const orderWeight: Record<string, number> = {
          'status-aberto': 1,
          'Aberto': 1,
          'status-atendimento': 2,
          'Em Atendimento': 2,
          'status-aguardando-solicitante': 3,
          'Aguardando resposta do solicitante': 3,
          'status-encerrado': 4,
          'Encerrado': 4,
        };

        const sorted = [...list].sort((a, b) => {
          const wA = orderWeight[a.id] ?? orderWeight[a.name] ?? 99;
          const wB = orderWeight[b.id] ?? orderWeight[b.name] ?? 99;
          return wA - wB;
        });

        if (sorted.length > 0) {
          setStatuses(sorted);
        }
      })
      .catch((err) => {
        console.warn('Usando status padrão de fallback:', err);
      });

    // Carrega métricas gerais da fila
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const response = await apiFetch('/api/tickets?limit=1000');
      if (response.ok) {
        const result = await response.json();
        const allTickets = (result.data || []) as Ticket[];
        const now = Date.now();
        const total = result.meta?.total ?? allTickets.length;
        const open = allTickets.filter((t) => t.status.name === 'Aberto').length;
        const inProgress = allTickets.filter((t) => t.status.name === 'Em Atendimento').length;
        const violated = allTickets.filter((t) => {
          const isClosed = t.status.name === 'Encerrado' || t.status.isFinal;
          const isPaused = t.status.name === 'Aguardando resposta do solicitante' || t.status.id === 'status-aguardando-solicitante' || !!t.slaPausedAt;
          if (isClosed || isPaused) return false;
          const deadline = t.slaDeadline ? new Date(t.slaDeadline).getTime() : null;
          return t.slaViolated || (deadline !== null && now > deadline);
        }).length;

        setMetrics({ total, open, inProgress, violated });
      }
    } catch (err) {
      console.error('Erro ao calcular métricas da fila:', err);
    }
  };

  const loadQueue = async (targetPage = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(PAGE_LIMIT),
      });

      if (search.trim()) params.append('search', search.trim());
      if (statusId) params.append('statusId', statusId);
      if (priority) params.append('priority', priority);

      const response = await apiFetch(`/api/tickets?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Falha ao carregar fila de chamados.');
      }

      const result = await response.json();
      const loadedTickets = (result.data || []) as Ticket[];
      setTickets(loadedTickets);

      if (result.meta) {
        setTotalTickets(result.meta.total || 0);
        setTotalPages(Math.max(1, result.meta.totalPages || 1));
      } else {
        setTotalTickets(loadedTickets.length);
        setTotalPages(Math.ceil(loadedTickets.length / PAGE_LIMIT) || 1);
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue(page);
  }, [page, statusId, priority]);

  const handleStatusChange = (newStatusId: string) => {
    setStatusId(newStatusId);
    setPage(1);
  };

  const handlePriorityChange = (newPriority: string) => {
    setPriority(newPriority);
    setPage(1);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadQueue(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusId('');
    setPriority('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(search.trim() || statusId || priority);

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'URGENT':
        return <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-xs px-2.5 py-0.5 rounded-full font-medium">Urgente</span>;
      case 'HIGH':
        return <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs px-2.5 py-0.5 rounded-full font-medium">Alta</span>;
      case 'MEDIUM':
        return <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs px-2.5 py-0.5 rounded-full font-medium">Média</span>;
      default:
        return <span className="bg-slate-500/10 text-slate-400 border border-slate-500/20 text-xs px-2.5 py-0.5 rounded-full font-medium">Baixa</span>;
    }
  };

  const getSlaBadge = (ticket: Ticket) => {
    if (!ticket.slaDeadline) {
      return <span className="text-slate-600">-</span>;
    }

    const now = Date.now();
    const deadline = new Date(ticket.slaDeadline).getTime();
    const isClosed = ticket.status.name === 'Encerrado' || ticket.status.isFinal;
    const isPaused = ticket.status.name === 'Aguardando resposta do solicitante' || ticket.status.id === 'status-aguardando-solicitante' || !!ticket.slaPausedAt;
    const isViolated = !isPaused && (ticket.slaViolated || (now > deadline && !isClosed));
    const diffMs = deadline - now;

    if (isClosed) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 font-medium">
          <CheckCircle2 size={11} /> Resolvido
        </span>
      );
    }

    if (isPaused) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20 font-medium">
          <PauseCircle size={11} /> SLA Pausado
        </span>
      );
    }

    if (isViolated) {
      const lateMins = Math.floor(Math.abs(diffMs) / 60000);
      const lateHours = Math.floor(lateMins / 60);
      const lateText = lateHours > 0 ? `${lateHours}h ${lateMins % 60}m` : `${lateMins}m`;

      return (
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center gap-1 text-red-400 text-xs font-semibold bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20 w-fit">
            <AlertCircle size={11} /> Estourado
          </span>
          <span className="text-[10px] text-red-400/80 font-mono">
            Atrasado há {lateText}
          </span>
        </div>
      );
    }

    // Tempo restante
    const remMins = Math.floor(diffMs / 60000);
    const remHours = Math.floor(remMins / 60);
    const remDays = Math.floor(remHours / 24);
    const isUrgentNotice = remHours < 2;

    let remText = '';
    if (remDays > 0) {
      remText = `${remDays}d ${remHours % 24}h restantes`;
    } else if (remHours > 0) {
      remText = `${remHours}h ${remMins % 60}m restantes`;
    } else {
      remText = `${remMins} min restantes`;
    }

    return (
      <div className="flex flex-col gap-0.5">
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border w-fit font-medium ${
          isUrgentNotice 
            ? 'text-amber-300 bg-amber-500/10 border-amber-500/30' 
            : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
        }`}>
          <Clock size={11} /> {isUrgentNotice ? 'Atenção' : 'No Prazo'}
        </span>
        <span className="text-[10px] text-slate-400 font-mono">
          {remText}
        </span>
      </div>
    );
  };

  const openStatusId = statuses.find((s) => s.name === 'Aberto')?.id || 'status-aberto';
  const inProgressStatusId = statuses.find((s) => s.name === 'Em Atendimento')?.id || 'status-atendimento';

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Layers className="text-sky-400" /> Fila de Atendimento Multissetorial
        </h1>
        <p className="text-sm text-slate-400">Painel operacional para triagem, designação de responsabilidade e SLA.</p>
      </div>

      {/* Metrics Row (Cards interativos de atalho rápido) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Card */}
        <button
          type="button"
          onClick={() => handleStatusChange('')}
          className={`glass-panel p-4 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer hover:border-sky-500/40 ${
            statusId === '' ? 'ring-1 ring-sky-500/50 bg-sky-500/5' : ''
          }`}
        >
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Fila Geral</span>
            <span className="text-2xl font-bold text-slate-100 mt-1 block">{metrics.total}</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
            <Layers size={20} />
          </div>
        </button>

        {/* Open Card */}
        <button
          type="button"
          onClick={() => handleStatusChange(openStatusId)}
          className={`glass-panel p-4 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer hover:border-amber-500/40 ${
            statusId === openStatusId ? 'ring-1 ring-amber-500/50 bg-amber-500/5' : ''
          }`}
        >
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Aguardando Triagem</span>
            <span className="text-2xl font-bold text-slate-100 mt-1 block">{metrics.open}</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
            <Clock size={20} />
          </div>
        </button>

        {/* In Progress Card */}
        <button
          type="button"
          onClick={() => handleStatusChange(inProgressStatusId)}
          className={`glass-panel p-4 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer hover:border-purple-500/40 ${
            statusId === inProgressStatusId ? 'ring-1 ring-purple-500/50 bg-purple-500/5' : ''
          }`}
        >
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Em Atendimento</span>
            <span className="text-2xl font-bold text-slate-100 mt-1 block">{metrics.inProgress}</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
            <UserCheck size={20} />
          </div>
        </button>

        {/* Violated Card */}
        <div className="glass-panel p-4 rounded-xl flex items-center justify-between border-red-500/20">
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Estouraram o SLA</span>
            <span className="text-2xl font-bold text-red-400 mt-1 block">{metrics.violated}</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400">
            <AlertTriangle size={20} />
          </div>
        </div>

      </div>

      {/* Filters Toolbar */}
      <div className="glass-panel p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder="Pesquisar por assunto ou solicitante..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950/40 border border-slate-950 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-400 text-sm"
            />
          </div>
          <button 
            type="submit"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-slate-200 rounded-lg text-sm transition-all cursor-pointer font-medium"
          >
            Filtrar
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
              <Filter size={14} className="inline mr-1" /> Status:
            </span>
            <select
              value={statusId}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="bg-slate-950/40 border border-slate-950 rounded-lg text-slate-300 py-1.5 px-3 text-xs focus:outline-none focus:border-sky-400 cursor-pointer"
            >
              <option value="">Todos</option>
              {statuses.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
              <Filter size={14} className="inline mr-1" /> Prioridade:
            </span>
            <select
              value={priority}
              onChange={(e) => handlePriorityChange(e.target.value)}
              className="bg-slate-950/40 border border-slate-950 rounded-lg text-slate-300 py-1.5 px-3 text-xs focus:outline-none focus:border-sky-400 cursor-pointer"
            >
              <option value="">Todas</option>
              <option value="URGENT">Urgente</option>
              <option value="HIGH">Alta</option>
              <option value="MEDIUM">Média</option>
              <option value="LOW">Baixa</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5"
              title="Limpar todos os filtros"
            >
              <RotateCcw size={12} /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* Queue Table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-sky-400 border-t-transparent animate-spin"></div>
            Buscando fila de atendimentos...
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-400 text-sm">
            Erro: {error}
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            {hasActiveFilters
              ? 'Nenhum chamado localizado com os filtros selecionados.'
              : 'Fila vazia! Nenhum chamado aguardando atendimento.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-950/30 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Número</th>
                  <th className="py-4 px-6">Assunto</th>
                  <th className="py-4 px-6">Solicitante</th>
                  <th className="py-4 px-6">Setor / Categoria</th>
                  <th className="py-4 px-6">Atendente</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Prioridade</th>
                  <th className="py-4 px-6">SLA Resolução</th>
                  <th className="py-4 px-6 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/40 text-sm text-slate-300">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-900/10 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-500">
                      #{String(t.number).padStart(5, '0')}
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-200">
                      {t.title}
                    </td>
                    <td className="py-4 px-6 text-slate-400">
                      {t.requester.name}
                    </td>
                    <td className="py-4 px-6 text-slate-500">
                      {t.department.name} • {t.category.name}
                    </td>
                    <td className="py-4 px-6 text-slate-400 font-light">
                      {t.attendant?.name || (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full font-medium">
                          Aguardando
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span 
                        className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium border"
                        style={{ 
                          backgroundColor: `${t.status.color}15`, 
                          borderColor: `${t.status.color}35`, 
                          color: t.status.color 
                        }}
                      >
                        {t.status.name}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {getPriorityBadge(t.priority)}
                    </td>
                    <td className="py-4 px-6">
                      {getSlaBadge(t)}
                    </td>
                    <td className="py-4 px-6 text-right">
                      {currentUser && t.requester.id === currentUser.id ? (
                        <Link 
                          href={`/dashboard/tickets/${t.id}`}
                          className="text-xs font-medium text-slate-400 hover:text-slate-300 bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-lg transition-all"
                        >
                          Visualizar
                        </Link>
                      ) : (
                        <Link 
                          href={`/dashboard/tickets/${t.id}`}
                          className="text-xs font-medium text-sky-400 hover:text-sky-300 bg-sky-500/5 border border-sky-500/10 hover:border-sky-500/30 px-3 py-1.5 rounded-lg transition-all"
                        >
                          Atender
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer (5 itens por página) */}
        {!loading && !error && totalTickets > 0 && (
          <div className="p-4 bg-slate-950/40 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400">
              Mostrando <span className="font-semibold text-slate-200">{(page - 1) * PAGE_LIMIT + 1}</span> a{' '}
              <span className="font-semibold text-slate-200">{Math.min(page * PAGE_LIMIT, totalTickets)}</span> de{' '}
              <span className="font-semibold text-slate-200">{totalTickets}</span> chamados
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft size={14} /> Anterior
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => {
                    const isActive = num === page;
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setPage(num)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                            : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer"
                >
                  Próxima <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
