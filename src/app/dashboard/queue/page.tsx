'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Filter, AlertTriangle, CheckCircle, Clock, Layers, UserCheck } from 'lucide-react';
import { formatDateTime } from '@/shared/utils/utils';

interface Ticket {
  id: string;
  number: number;
  title: string;
  requester: { name: string };
  attendant: { name: string } | null;
  department: { name: string };
  category: { name: string };
  status: { id: string; name: string; color: string };
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  slaDeadline: string | null;
  slaViolated: boolean;
  createdAt: string;
}

export default function TicketQueuePage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [statusId, setStatusId] = useState('');
  const [priority, setPriority] = useState('');
  
  // Contadores analíticos
  const [metrics, setMetrics] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    violated: 0,
  });

  // Lista de status carregada para os filtros
  const [statuses, setStatuses] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    // Carrega filtros de status
    fetch('/api/departments')
      .then((res) => res.json())
      .then((depts) => {
        const statusList: { id: string; name: string }[] = [];
        depts.forEach((dept: any) => {
          if (dept.company && dept.company.ticketStatuses) {
            dept.company.ticketStatuses.forEach((st: any) => {
              if (!statusList.some((s) => s.id === st.id)) {
                statusList.push({ id: st.id, name: st.name });
              }
            });
          }
        });
        setStatuses(statusList);
      });
  }, []);

  const loadQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '50', // traz uma fila operacional maior
      });

      if (search) params.append('search', search);
      if (statusId) params.append('statusId', statusId);
      if (priority) params.append('priority', priority);

      const response = await fetch(`/api/tickets?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Falha ao carregar fila de chamados.');
      }
      
      const result = await response.json();
      const loadedTickets = result.data as Ticket[];
      setTickets(loadedTickets);

      // Calcular métricas rápidas em cima da listagem carregada
      const total = loadedTickets.length;
      const open = loadedTickets.filter((t) => t.status.name === 'Aberto').length;
      const inProgress = loadedTickets.filter((t) => t.status.name === 'Em Atendimento').length;
      const violated = loadedTickets.filter((t) => t.slaViolated).length;
      
      setMetrics({ total, open, inProgress, violated });

    } catch (err: any) {
      setError(err.message || 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [statusId, priority]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadQueue();
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'URGENT':
        return <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-xs px-2 py-0.5 rounded-full">Urgente</span>;
      case 'HIGH':
        return <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs px-2 py-0.5 rounded-full font-medium">Alta</span>;
      case 'MEDIUM':
        return <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs px-2 py-0.5 rounded-full font-medium">Média</span>;
      default:
        return <span className="bg-slate-500/10 text-slate-400 border border-slate-500/20 text-xs px-2 py-0.5 rounded-full font-medium">Baixa</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Layers className="text-sky-400" /> Fila de Atendimento Multissetorial
        </h1>
        <p className="text-sm text-slate-400">Painel operacional para triagem, designação de responsabilidade e SLA.</p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Card */}
        <div className="glass-panel p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Fila Geral</span>
            <span className="text-2xl font-bold text-slate-100 mt-1 block">{metrics.total}</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
            <Layers size={20} />
          </div>
        </div>

        {/* Open Card */}
        <div className="glass-panel p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Aguardando Triagem</span>
            <span className="text-2xl font-bold text-slate-100 mt-1 block">{metrics.open}</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
            <Clock size={20} />
          </div>
        </div>

        {/* In Progress Card */}
        <div className="glass-panel p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Em Atendimento</span>
            <span className="text-2xl font-bold text-slate-100 mt-1 block">{metrics.inProgress}</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
            <UserCheck size={20} />
          </div>
        </div>

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

      {/* Filters */}
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap"><Filter size={14} className="inline mr-1" /> Status:</span>
            <select
              value={statusId}
              onChange={(e) => setStatusId(e.target.value)}
              className="bg-slate-950/40 border border-slate-950 rounded-lg text-slate-300 py-1.5 px-3 text-xs focus:outline-none focus:border-sky-400"
            >
              <option value="">Todos</option>
              {statuses.map((st) => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap"><Filter size={14} className="inline mr-1" /> Prioridade:</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
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
            Fila vazia! Nenhum chamado aguardando atendimento.
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
                      {t.attendant?.name || <span className="text-amber-500/80 italic text-xs">Aguardando...</span>}
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
                      {t.slaDeadline ? (
                        t.slaViolated ? (
                          <span className="inline-flex items-center gap-1 text-red-400 text-xs font-semibold bg-red-500/5 px-2 py-0.5 rounded-md border border-red-500/10">
                            Estourado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-xs bg-emerald-500/5 px-2 py-0.5 rounded-md border border-emerald-500/10">
                            Ok • {new Date(t.slaDeadline).toLocaleDateString('pt-BR')}
                          </span>
                        )
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Link 
                        href={`/dashboard/tickets/${t.id}`}
                        className="text-xs font-medium text-sky-400 hover:text-sky-300 bg-sky-500/5 border border-sky-500/10 hover:border-sky-500/30 px-3 py-1.5 rounded-lg transition-all"
                      >
                        Atender
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
