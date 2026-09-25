'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Filter, AlertCircle, Clock, ChevronLeft, ChevronRight, PlusCircle, CheckCircle2, PauseCircle } from 'lucide-react';
import { formatDateTime } from '@/shared/utils/utils';
import { apiFetch } from '@/shared/utils/api';

interface Ticket {
  id: string;
  number: number;
  title: string;
  department: { name: string };
  category: { name: string };
  status: { id: string; name: string; color: string; isFinal?: boolean };
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  slaDeadline: string | null;
  slaViolated: boolean;
  slaPausedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [statusId, setStatusId] = useState('');
  const [priority, setPriority] = useState('');
  
  // Status auxiliares carregados
  const [statuses, setStatuses] = useState<{ id: string; name: string }[]>([]);
  
  // Paginação
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;

  // Carregar status para o filtro
  useEffect(() => {
    // Busca departamentos e consequentemente traz os status no seed ou podemos fazer rota,
    // mas para simplificar faremos um fetch rápido
    apiFetch('/api/departments')
      .then((res) => res.json())
      .then((depts) => {
        // Coleta status únicos cadastrados na empresa
        const allStatusesMap: Record<string, string> = {};
        depts.forEach((dept: any) => {
          if (dept.company && dept.company.ticketStatuses) {
            dept.company.ticketStatuses.forEach((st: any) => {
              allStatusesMap[st.id] = st.name;
            });
          }
        });
        
        // Fallback fixo se vazio
        const loadedStatuses = Object.entries(allStatusesMap).map(([id, name]) => ({ id, name }));
        if (loadedStatuses.length > 0) {
          setStatuses(loadedStatuses);
        } else {
          setStatuses([
            { id: 'status-aberto', name: 'Aberto' },
            { id: 'status-atendimento', name: 'Em Atendimento' },
            { id: 'status-aguardando-solicitante', name: 'Aguardando resposta do solicitante' },
            { id: 'status-encerrado', name: 'Encerrado' },
          ]);
        }
      })
      .catch(() => {
        // Fallback em caso de erro na API de departamentos
        setStatuses([
          { id: 'status-aberto', name: 'Aberto' },
          { id: 'status-atendimento', name: 'Em Atendimento' },
          { id: 'status-aguardando-solicitante', name: 'Aguardando resposta do solicitante' },
          { id: 'status-encerrado', name: 'Encerrado' },
        ]);
      });
  }, []);

  // Carregar chamados
  const loadTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (search) params.append('search', search);
      if (statusId) params.append('statusId', statusId);
      if (priority) params.append('priority', priority);

      const response = await apiFetch(`/api/tickets?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Falha ao carregar os chamados.');
      }
      const result = await response.json();
      setTickets(result.data);
      setTotalPages(result.meta.totalPages || 1);
    } catch (err: any) {
      setError(err.message || 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [page, statusId, priority]);

  // Filtro de digitação com delay
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadTickets();
  };

  // Cores de prioridade personalizadas
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
      return <span className="text-slate-500 text-xs">-</span>;
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

    const remMins = Math.floor(diffMs / 60000);
    const remHours = Math.floor(remMins / 60);
    const remDays = Math.floor(remHours / 24);
    const isUrgentNotice = remHours < 2;

    let remText = '';
    if (remDays > 0) {
      remText = `${remDays}d ${remHours % 24}h restam`;
    } else if (remHours > 0) {
      remText = `${remHours}h ${remMins % 60}m restam`;
    } else {
      remText = `${remMins}m restam`;
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

  return (
    <div className="space-y-6">
      {/* Page Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Chamados Solicitados</h1>
          <p className="text-sm text-slate-400">Consulte, pesquise e acompanhe os seus chamados em tempo real.</p>
        </div>
        <Link 
          href="/dashboard/tickets/new" 
          className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-400 to-purple-500 hover:from-sky-500 hover:to-purple-600 text-white font-medium px-4 py-2.5 rounded-xl transition-all glow-primary hover:glow-accent text-sm w-fit cursor-pointer"
        >
          <PlusCircle size={18} /> Novo Chamado
        </Link>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder="Pesquisar por título ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950/40 border border-slate-950 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-400 text-sm"
            />
          </div>
          <button 
            type="submit"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-slate-200 rounded-lg text-sm transition-all cursor-pointer font-medium"
          >
            Buscar
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Select */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap"><Filter size={14} className="inline mr-1" /> Status:</span>
            <select
              value={statusId}
              onChange={(e) => { setStatusId(e.target.value); setPage(1); }}
              className="bg-slate-950/40 border border-slate-950 rounded-lg text-slate-300 py-1.5 px-3 text-xs focus:outline-none focus:border-sky-400"
            >
              <option value="">Todos</option>
              {statuses.map((st) => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          </div>

          {/* Priority Select */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap"><Filter size={14} className="inline mr-1" /> Prioridade:</span>
            <select
              value={priority}
              onChange={(e) => { setPriority(e.target.value); setPage(1); }}
              className="bg-slate-950/40 border border-slate-950 rounded-lg text-slate-300 py-1.5 px-3 text-xs focus:outline-none focus:border-sky-400"
            >
              <option value="">Todas</option>
              <option value="LOW">Baixa</option>
              <option value="MEDIUM">Média</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tickets Table Grid */}
      <div className="glass-panel rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-sky-400 border-t-transparent animate-spin"></div>
            Buscando registros...
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-400 text-sm flex items-center justify-center gap-2">
            <AlertCircle size={20} /> {error}
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Nenhum chamado localizado para os filtros informados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-950/30 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Número</th>
                  <th className="py-4 px-6">Assunto</th>
                  <th className="py-4 px-6">Departamento</th>
                  <th className="py-4 px-6">Categoria</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Prioridade</th>
                  <th className="py-4 px-6">SLA Resolução</th>
                  <th className="py-4 px-6">Atualizado em</th>
                  <th className="py-4 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/40 text-sm text-slate-300">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-900/10 transition-colors group">
                    <td className="py-4 px-6 font-semibold text-slate-400">
                      #{String(t.number).padStart(5, '0')}
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-200">
                      {t.title}
                    </td>
                    <td className="py-4 px-6 text-slate-400">
                      {t.department.name}
                    </td>
                    <td className="py-4 px-6 text-slate-400 font-light">
                      {t.category.name}
                    </td>
                    <td className="py-4 px-6">
                      <span 
                        className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border"
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
                    <td className="py-4 px-6 text-slate-500 text-xs">
                      {formatDateTime(t.updatedAt)}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Link 
                        href={`/dashboard/tickets/${t.id}`}
                        className="text-xs font-medium text-sky-400 hover:text-sky-300 bg-sky-500/5 border border-sky-500/10 hover:border-sky-500/30 px-3 py-1.5 rounded-lg transition-all"
                      >
                        Detalhar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 bg-slate-950/20 border-t border-slate-900 flex items-center justify-between gap-4">
            <span className="text-xs text-slate-500">
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-slate-700/50 transition-all cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-slate-700/50 transition-all cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
