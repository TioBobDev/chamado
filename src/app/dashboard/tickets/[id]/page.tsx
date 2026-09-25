'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Loader2, 
  User, 
  AlertCircle, 
  Clock, 
  FileText, 
  MessageSquare, 
  Paperclip, 
  History, 
  CornerDownRight,
  EyeOff,
  Send,
  Upload,
  Play,
  Users,
  CheckCircle2,
  Lock,
  PauseCircle,
  HelpCircle,
  X
} from 'lucide-react';
import Link from 'next/link';
import { formatDateTime } from '@/shared/utils/utils';
import { apiFetch, withBasePath } from '@/shared/utils/api';

interface UserPayload {
  id: string;
  name: string;
  email: string;
  role?: { name: string };
}

interface TicketDetail {
  id: string;
  number: number;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  impact: string;
  urgency: string;
  slaDeadline: string | null;
  slaViolated: boolean;
  slaPausedAt?: string | null;
  slaRule?: {
    id: string;
    name: string;
    responseTimeMinutes: number;
    resolutionTimeMinutes: number;
    priority: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  requester: UserPayload;
  attendant: UserPayload | null;
  department: { id: string; name: string };
  category: { id: string; name: string };
  status: { id: string; name: string; color: string; isFinal?: boolean };
  team: { id: string; name: string } | null;
  comments: {
    id: string;
    content: string;
    isInternal: boolean;
    createdAt: string;
    user: UserPayload;
  }[];
  history: {
    id: string;
    action: string;
    oldValue: string | null;
    newValue: string | null;
    createdAt: string;
    user: { id: string; name: string };
  }[];
  attachments: {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    createdAt: string;
    uploadedBy: { name: string };
  }[];
  customValues: {
    id: string;
    value: string;
    field: { name: string; type: string };
  }[];
}

export default function TicketDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Ações de formulários
  const [commentText, setCommentText] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [awaitRequesterResponse, setAwaitRequesterResponse] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  
  // Listas auxiliares para alteração rápida (atendentes, status)
  const [availableStatuses, setAvailableStatuses] = useState<{ id: string; name: string }[]>([]);
  const [availableAttendants, setAvailableAttendants] = useState<{ id: string; name: string }[]>([]);
  const [updatingField, setUpdatingField] = useState<string | null>(null);
  
  // Dados de sessão do usuário logado
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string; name: string } | null>(null);

  // Estados dos modais de fluxo
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState(false);

  const loadTicket = async () => {
    try {
      const res = await apiFetch(`/api/tickets/${id}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Falha ao buscar detalhes.');
      }
      const data = await res.json();
      setTicket(data);
      
      // Busca status e atendentes disponíveis da empresa filtrados pelo setor do chamado
      Promise.all([
        apiFetch('/api/tickets/statuses').then((r) => r.json()),
        apiFetch(`/api/tickets/attendants?departmentId=${data.department.id}`).then((r) => r.json())
      ])
        .then(([statuses, attendants]) => {
          setAvailableStatuses(statuses || []);
          setAvailableAttendants(attendants || []);
        })
        .catch((err) => console.error('Erro ao buscar dados auxiliares:', err));

    } catch (err: any) {
      setError(err.message || 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
    
    // Identificar perfil do usuário logado
    apiFetch('/api/auth/me')
      .then((r) => r.json())
      .then((user) => {
        if (user && user.id) {
          setCurrentUser(user);
        }
      })
      .catch((err) => console.error('Erro ao buscar dados da sessão:', err));
  }, [id]);

  // Alterar campos rápidos (Status, Atendente, Prioridade)
  const handleFieldUpdate = async (fieldName: string, value: string | null) => {
    if (!ticket) return;
    setUpdatingField(fieldName);
    setError(null);
    
    try {
      const payload: any = {};
      if (fieldName === 'statusId') payload.statusId = value;
      if (fieldName === 'attendantId') payload.attendantId = value;
      if (fieldName === 'priority') payload.priority = value;

      const res = await apiFetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || 'Erro ao atualizar campo.');
      }

      await loadTicket();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdatingField(null);
    }
  };

  // Ação: Iniciar Atendimento (Passa de Aberto -> Em Atendimento e atribui)
  const handleStartAttendance = async () => {
    if (!ticket || !currentUser) return;
    setActionLoading(true);
    setError(null);

    try {
      // Localiza o status "Em Atendimento"
      const inProgressStatus = availableStatuses.find((s) => s.name === 'Em Atendimento');
      const payload: any = {
        statusId: inProgressStatus?.id || 'status-atendimento',
      };

      // Se não tiver atendente definido, autoatribui ao usuário logado
      if (!ticket.attendant) {
        payload.attendantId = currentUser.id;
      }

      const res = await apiFetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || 'Erro ao iniciar atendimento.');
      }

      await loadTicket();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Ação: Transferir Atendimento
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTargetId) {
      setTransferError('Selecione o atendente que receberá o chamado.');
      return;
    }

    setTransferLoading(true);
    setTransferError(null);

    try {
      const res = await apiFetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendantId: transferTargetId,
          transferReason: transferReason.trim() || undefined,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || 'Erro ao transferir atendimento.');
      }

      setShowTransferModal(false);
      setTransferTargetId('');
      setTransferReason('');
      await loadTicket();
    } catch (err: any) {
      setTransferError(err.message);
    } finally {
      setTransferLoading(false);
    }
  };

  // Ação: Encerrar Chamado
  const handleCloseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionSummary.trim()) {
      setCloseError('Por favor, informe a solução aplicada para encerrar o chamado.');
      return;
    }

    setCloseLoading(true);
    setCloseError(null);

    try {
      const closedStatus = availableStatuses.find((s) => s.name === 'Encerrado');
      const res = await apiFetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statusId: closedStatus?.id || 'status-encerrado',
          resolutionSummary: resolutionSummary.trim(),
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || 'Erro ao encerrar chamado.');
      }

      setShowCloseModal(false);
      setResolutionSummary('');
      await loadTicket();
    } catch (err: any) {
      setCloseError(err.message);
    } finally {
      setCloseLoading(false);
    }
  };

  // Enviar comentário
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/tickets/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: commentText,
          isInternal: isInternalComment,
          awaitRequesterResponse,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || 'Erro ao adicionar comentário.');
      }

      setCommentText('');
      setIsInternalComment(false);
      setAwaitRequesterResponse(false);
      await loadTicket();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Upload de Anexo
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToUpload) return;

    setUploadingFile(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);

      const res = await apiFetch(`/api/tickets/${id}/attachments`, {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || 'Erro ao fazer upload do arquivo.');
      }

      setFileToUpload(null);
      await loadTicket();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingFile(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-400 gap-3">
        <Loader2 className="animate-spin text-sky-400" size={32} />
        Buscando detalhes do chamado...
      </div>
    );
  }

  if (error && !ticket) {
    return (
      <div className="p-8 text-center text-red-400 flex items-center justify-center gap-2">
        <AlertCircle size={20} /> {error}
      </div>
    );
  }

  if (!ticket) return null;

  // Lógica de papéis e estados do chamado
  const isClosed = ticket.status.isFinal || ticket.status.name === 'Encerrado';
  const isAberto = ticket.status.name === 'Aberto';
  const isEmAtendimento = ticket.status.name === 'Em Atendimento';
  const isAguardando = ticket.status.name === 'Aguardando resposta do solicitante' || ticket.status.id === 'status-aguardando-solicitante' || !!ticket.slaPausedAt;

  const userRole = currentUser?.role || '';
  const canAct = ['Atendente', 'Coordenador', 'Administrador'].includes(userRole);
  const isRequester = ticket.requester.id === currentUser?.id;
  const isAssignedToMe = ticket.attendant?.id === currentUser?.id;
  const isManagerOrAdmin = ['Coordenador', 'Administrador'].includes(userRole);

  const canStartAttendance = isAberto && canAct && (!ticket.attendant || isAssignedToMe || isManagerOrAdmin);
  const canTransfer = (isEmAtendimento || isAguardando) && (isAssignedToMe || isManagerOrAdmin);
  const canClose = (isEmAtendimento || isAguardando) && (isAssignedToMe || isManagerOrAdmin);

  // Lista de colegas para transferência (mesmo setor, exceto o atendente atual e solicitante)
  const transferColleagues = availableAttendants.filter(
    (att) => att.id !== ticket.attendant?.id && att.id !== ticket.requester.id
  );

  // Detalhes e status do SLA ITIL
  const getSlaDetails = () => {
    if (!ticket.slaDeadline) return null;

    const deadline = new Date(ticket.slaDeadline).getTime();
    const created = new Date(ticket.createdAt).getTime();
    const isFinished = !!ticket.closedAt || isClosed;
    const finishTime = ticket.closedAt ? new Date(ticket.closedAt).getTime() : Date.now();
    const now = Date.now();
    const isPaused = isAguardando;

    const defaultMeta = {
      URGENT: { label: 'Crítico / Urgente', resp: '30 min', res: '4h' },
      HIGH: { label: 'Alta Prioridade', resp: '1h', res: '8h' },
      MEDIUM: { label: 'Média Prioridade', resp: '2h', res: '24h' },
      LOW: { label: 'Baixa Prioridade', resp: '8h', res: '72h' },
    }[ticket.priority] || { label: 'Padrão', resp: '2h', res: '24h' };

    const formatSlaMinutes = (minutes: number) => {
      if (minutes < 60) return `${minutes} min`;
      if (minutes < 1440) {
        const hours = minutes / 60;
        return Number.isInteger(hours) ? `${hours}h` : `${Math.floor(hours)}h ${minutes % 60}min`;
      }
      const days = minutes / 1440;
      const remHours = Math.floor((minutes % 1440) / 60);
      return Number.isInteger(days) ? `${days}d` : `${Math.floor(days)}d ${remHours}h`;
    };

    const itilMeta = ticket.slaRule
      ? {
          label: ticket.slaRule.name || defaultMeta.label,
          resp: formatSlaMinutes(ticket.slaRule.responseTimeMinutes),
          res: formatSlaMinutes(ticket.slaRule.resolutionTimeMinutes),
        }
      : defaultMeta;

    const formatRemaining = (ms: number) => {
      const absMs = Math.abs(ms);
      const totalMinutes = Math.floor(absMs / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      const remMinutes = totalMinutes % 60;

      if (days > 0) return `${days}d ${remHours}h`;
      if (hours > 0) return `${hours}h ${remMinutes}min`;
      return `${remMinutes} min`;
    };

    if (isFinished) {
      const resolvedInTime = finishTime <= deadline && !ticket.slaViolated;
      return {
        isFinished: true,
        isExpired: false,
        isPaused: false,
        resolvedInTime,
        statusLabel: resolvedInTime ? 'Resolvido no Prazo' : 'SLA Estourado',
        subText: resolvedInTime 
          ? `Finalizado dentro da meta de ${itilMeta.res}` 
          : `Encerrado após o limite contratual de ${itilMeta.res}`,
        deadlineFormatted: new Date(ticket.slaDeadline).toLocaleString('pt-BR'),
        progress: 100,
        itilMeta,
        colorTheme: resolvedInTime ? ('emerald' as const) : ('red' as const),
      };
    }

    if (isPaused) {
      return {
        isFinished: false,
        isExpired: false,
        isPaused: true,
        statusLabel: 'SLA Pausado',
        subText: 'Contagem pausada aguardando interação do solicitante.',
        timeText: 'Pausado (Aguardando resposta)',
        deadlineFormatted: new Date(ticket.slaDeadline).toLocaleString('pt-BR'),
        progress: Math.min(100, Math.max(0, Math.round(((now - created) / Math.max(1, deadline - created)) * 100))),
        itilMeta,
        colorTheme: 'purple' as const,
      };
    }

    const totalDuration = Math.max(1, deadline - created);
    const elapsed = Math.max(0, now - created);
    const remainingMs = deadline - now;
    const isExpired = remainingMs <= 0 || ticket.slaViolated;
    const progress = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));

    let colorTheme: 'emerald' | 'amber' | 'red' | 'purple' = 'emerald';
    if (isExpired) {
      colorTheme = 'red';
    } else if (progress > 75 || remainingMs < 60 * 60 * 1000) {
      colorTheme = 'amber';
    }

    return {
      isFinished: false,
      isExpired,
      isPaused: false,
      statusLabel: isExpired ? 'SLA Estourado' : progress > 75 ? 'Prazo Iminente' : 'Dentro do Prazo',
      timeText: isExpired 
        ? `Expirou há ${formatRemaining(remainingMs)}` 
        : `Restam ${formatRemaining(remainingMs)}`,
      deadlineFormatted: new Date(ticket.slaDeadline).toLocaleString('pt-BR'),
      progress,
      itilMeta,
      colorTheme,
    };
  };

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex items-center justify-between">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
          <Link 
            href="/dashboard/queue"
            className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition-all cursor-pointer shrink-0 mt-0.5 sm:mt-0"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-500 font-semibold text-base sm:text-lg">#{String(ticket.number).padStart(5, '0')}</span>
              <span 
                className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                style={{ 
                  backgroundColor: `${ticket.status.color}15`, 
                  borderColor: `${ticket.status.color}35`, 
                  color: ticket.status.color 
                }}
              >
                {ticket.status.name}
              </span>
              <span className="text-xs text-slate-500">
                • {ticket.department.name} &gt; {ticket.category.name}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 mt-1 break-words">{ticket.title}</h1>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">✕</button>
        </div>
      )}

      {/* Painel de Fluxo e Ações Rápidas de Atendimento */}
      {isClosed ? (
        <div className="p-4 sm:p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-emerald-300">Chamado Encerrado Definitivamente</h4>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                  FINALIZADO
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Atendimento concluído em {ticket.closedAt ? new Date(ticket.closedAt).toLocaleString('pt-BR') : 'Data não registrada'}. Este chamado está arquivado e não pode ser reaberto.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0 self-end sm:self-center">
            <Lock size={14} />
            <span>Registro travado</span>
          </div>
        </div>
      ) : isAberto ? (
        <div className="p-4 sm:p-5 rounded-2xl bg-sky-950/20 border border-sky-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <Clock size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-sky-300">Aguardando Início do Atendimento</h4>
                <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 text-[10px] font-bold border border-sky-500/20">
                  ABERTO
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {ticket.attendant 
                  ? `Responsável designado: ${ticket.attendant.name}. Clique para assumir e dar início.`
                  : 'Nenhum atendente iniciou este chamado ainda.'}
              </p>
            </div>
          </div>
          {canStartAttendance && (
            <button
              type="button"
              onClick={handleStartAttendance}
              disabled={actionLoading}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} className="fill-current" />}
              Iniciar Atendimento
            </button>
          )}
        </div>
      ) : isEmAtendimento ? (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <AlertCircle size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-amber-300">Chamado em Atendimento</h4>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">
                  EM ANDAMENTO
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Atendente responsável: <span className="text-slate-200 font-semibold">{ticket.attendant?.name || 'Não atribuído'}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
            {canTransfer && (
              <button
                type="button"
                onClick={() => {
                  setShowTransferModal(true);
                  setTransferError(null);
                }}
                className="flex-1 sm:flex-initial px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700/60 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Users size={14} />
                Transferir Atendimento
              </button>
            )}
            {canClose && (
              <button
                type="button"
                onClick={() => {
                  setShowCloseModal(true);
                  setCloseError(null);
                }}
                className="flex-1 sm:flex-initial px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <CheckCircle2 size={15} />
                Encerrar Chamado
              </button>
            )}
          </div>
        </div>
      ) : isAguardando ? (
        <div className="p-4 sm:p-5 rounded-2xl bg-purple-950/20 border border-purple-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <PauseCircle size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-purple-300">Aguardando Resposta do Solicitante</h4>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-bold border border-purple-500/20">
                  SLA PAUSADO
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRequester
                  ? 'O atendente fez uma pergunta e aguarda sua interação para prosseguir. Envie uma resposta nos comentários abaixo para retomar o atendimento.'
                  : `Aguardando retorno de ${ticket.requester.name}. O SLA de resolução está pausado e será retomado quando o solicitante responder.`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
            {canTransfer && (
              <button
                type="button"
                onClick={() => {
                  setShowTransferModal(true);
                  setTransferError(null);
                }}
                className="flex-1 sm:flex-initial px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700/60 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Users size={14} />
                Transferir Atendimento
              </button>
            )}
            {canClose && (
              <button
                type="button"
                onClick={() => {
                  setShowCloseModal(true);
                  setCloseError(null);
                }}
                className="flex-1 sm:flex-initial px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <CheckCircle2 size={15} />
                Encerrar Chamado
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns - Details, Comments, Attachments */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Description */}
          <div className="glass-panel p-4 sm:p-6 rounded-2xl relative overflow-hidden space-y-4">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-sky-400/30"></div>
            <h3 className="font-semibold text-sm text-slate-300 border-b border-slate-900 pb-2">Descrição da Solicitação</h3>
            <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{ticket.description}</p>

            {/* Custom Values */}
            {ticket.customValues.length > 0 && (
              <div className="mt-6 border-t border-slate-900 pt-4 space-y-3">
                <h4 className="font-medium text-xs text-sky-400 uppercase tracking-wider">Campos Customizados do Setor</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ticket.customValues.map((cv) => (
                    <div key={cv.id} className="p-3 bg-slate-950/20 border border-slate-900 rounded-lg">
                      <span className="block text-[10px] text-slate-500 uppercase font-semibold">{cv.field.name}</span>
                      <span className="text-sm text-slate-300 mt-0.5 block">{cv.value === 'true' ? 'Confirmado' : cv.value === 'false' ? 'Não' : cv.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Attachments Section */}
          <div className="glass-panel p-4 sm:p-6 rounded-2xl relative overflow-hidden space-y-4">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-purple-400/30"></div>
            <h3 className="font-semibold text-sm text-slate-300 border-b border-slate-900 pb-2 flex items-center gap-2">
              <Paperclip size={18} /> Anexos e Documentos
            </h3>

            {ticket.attachments.length === 0 ? (
              <p className="text-slate-500 text-xs italic">Nenhum anexo adicionado a este chamado.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ticket.attachments.map((file) => {
                  const isImage = file.mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
                  return (
                    <div key={file.id} className="p-3 bg-slate-950/20 border border-slate-900 rounded-xl flex flex-col justify-between gap-3">
                      <div className="flex gap-3 items-center overflow-hidden">
                        {isImage && (
                          <div 
                            className="w-12 h-12 rounded-lg overflow-hidden border border-slate-800 bg-slate-900/60 shrink-0 relative cursor-pointer hover:border-sky-400/50 transition-colors"
                            onClick={() => setSelectedImageUrl(withBasePath(`/api/tickets/attachments/${file.id}/view`))}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={withBasePath(`/api/tickets/attachments/${file.id}/view`)} 
                              alt={file.name} 
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="overflow-hidden">
                          <span className="block text-sm text-slate-300 truncate font-medium">{file.name}</span>
                          <span className="text-[10px] text-slate-500 block">
                            Por {file.uploadedBy.name} • {Math.round(file.size / 1024)} KB
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end border-t border-slate-900/30 pt-2">
                        {isImage && (
                          <button
                            type="button"
                            onClick={() => setSelectedImageUrl(withBasePath(`/api/tickets/attachments/${file.id}/view`))}
                            className="text-xs text-sky-400 hover:text-sky-300 bg-sky-500/5 px-2.5 py-1.5 rounded-lg border border-sky-500/10 hover:border-sky-500/20 font-medium cursor-pointer"
                          >
                            Visualizar
                          </button>
                        )}
                        <a 
                          href={withBasePath(`/api/tickets/attachments/${file.id}/download`)}
                          download
                          className="text-xs text-slate-400 hover:text-slate-300 bg-slate-900 border border-slate-800 hover:border-slate-700 px-2.5 py-1.5 rounded-lg font-medium cursor-pointer"
                        >
                          Baixar
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* File Upload Form (Apenas se o chamado não estiver encerrado) */}
            {!isClosed ? (
              <form onSubmit={handleFileUpload} className="border-t border-slate-900 pt-4 flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <input 
                    type="file" 
                    onChange={(e) => setFileToUpload(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-sky-400 hover:file:bg-slate-800 cursor-pointer"
                  />
                </div>
                <button
                  type="submit"
                  disabled={uploadingFile || !fileToUpload}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700/50 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  {uploadingFile ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                  Anexar Arquivo
                </button>
              </form>
            ) : null}
          </div>

          {/* Comments and timeline */}
          <div className="glass-panel p-4 sm:p-6 rounded-2xl relative overflow-hidden space-y-4">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-sky-400/30 to-purple-400/30"></div>
            <h3 className="font-semibold text-sm text-slate-300 border-b border-slate-900 pb-2 flex items-center gap-2">
              <MessageSquare size={18} /> Histórico de Comentários
            </h3>

            {/* List comments */}
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {ticket.comments.length === 0 ? (
                <p className="text-slate-500 text-xs italic">Nenhum comentário enviado.</p>
              ) : (
                ticket.comments.map((comment) => (
                  <div 
                    key={comment.id} 
                    className={`p-4 rounded-xl border ${
                      comment.isInternal 
                        ? 'bg-purple-950/10 border-purple-500/20' 
                        : 'bg-slate-950/20 border-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-300">
                          {comment.user.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-slate-300">{comment.user.name}</span>
                        {comment.isInternal && (
                          <span className="bg-purple-500/10 text-purple-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-purple-500/20 flex items-center gap-1">
                            <EyeOff size={10} /> Interno
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500">{formatDateTime(comment.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-300 font-light leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Add Comment Input Form */}
            {!isClosed ? (
              <form onSubmit={handleCommentSubmit} className="border-t border-slate-900 pt-4 space-y-3">
                <textarea
                  rows={3}
                  placeholder="Insira um comentário ou resposta..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="w-full bg-slate-950/40 border border-slate-800 rounded-xl text-slate-200 py-3 px-4 focus:outline-none focus:border-sky-400 text-sm resize-none"
                />
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Atendentes podem postar comentários internos */}
                    {canAct && !isRequester && (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="internal-comment"
                          checked={isInternalComment}
                          disabled={awaitRequesterResponse}
                          onChange={(e) => {
                            setIsInternalComment(e.target.checked);
                            if (e.target.checked) setAwaitRequesterResponse(false);
                          }}
                          className="w-4 h-4 bg-slate-950/40 border border-slate-800 rounded text-purple-400 focus:ring-purple-400 cursor-pointer disabled:opacity-40"
                        />
                        <label htmlFor="internal-comment" className="text-xs font-medium text-slate-400 flex items-center gap-1 cursor-pointer">
                          <EyeOff size={12} /> Comentário Interno
                        </label>
                      </div>
                    )}

                    {/* Flag: Aguardar resposta do solicitante */}
                    {canAct && !isRequester && (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="await-requester-response"
                          checked={awaitRequesterResponse}
                          disabled={isInternalComment}
                          onChange={(e) => {
                            setAwaitRequesterResponse(e.target.checked);
                            if (e.target.checked) setIsInternalComment(false);
                          }}
                          className="w-4 h-4 bg-slate-950/40 border border-slate-800 rounded text-purple-400 focus:ring-purple-400 cursor-pointer disabled:opacity-40"
                        />
                        <label 
                          htmlFor="await-requester-response" 
                          className={`text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
                            awaitRequesterResponse ? 'text-purple-300 font-semibold' : 'text-slate-400'
                          }`}
                        >
                          <HelpCircle size={13} className={awaitRequesterResponse ? 'text-purple-400' : 'text-slate-400'} />
                          Aguardar resposta do solicitante
                          <span className="text-[10px] text-purple-400/90 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 font-normal hidden sm:inline">
                            Pausa SLA
                          </span>
                        </label>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submittingComment || !commentText.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-sky-400 to-purple-500 hover:from-sky-500 hover:to-purple-600 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    {submittingComment ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                    Enviar Comentário
                  </button>
                </div>
              </form>
            ) : (
              <div className="border-t border-slate-900 pt-3 text-center text-xs text-slate-500 italic">
                Chamado encerrado. O envio de novos comentários foi desabilitado.
              </div>
            )}
          </div>

        </div>

        {/* Right Sidebar Columns - Metadata controls and History timeline */}
        <div className="space-y-6">
          
          {/* Metadata Controls */}
          <div className="glass-panel p-4 sm:p-6 rounded-2xl relative overflow-hidden space-y-5">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-sky-400/30"></div>
            
            <h3 className="font-semibold text-sm text-slate-300 border-b border-slate-900 pb-2 flex items-center justify-between">
              <span>Controles Operacionais</span>
              {isClosed && <span className="text-[10px] text-slate-500 font-normal">Bloqueado</span>}
            </h3>

            {/* SLA ITIL Widget */}
            {(() => {
              const sla = getSlaDetails();
              if (!sla) return null;

              return (
                <div className={`p-4 rounded-xl border relative overflow-hidden transition-all ${
                  sla.colorTheme === 'purple'
                    ? 'bg-purple-500/10 border-purple-500/30'
                    : sla.colorTheme === 'red'
                    ? 'bg-red-500/10 border-red-500/30'
                    : sla.colorTheme === 'amber'
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-emerald-500/10 border-emerald-500/30'
                }`}>
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <span className="flex items-center gap-1.5 text-slate-200">
                      {sla.colorTheme === 'purple' ? (
                        <PauseCircle size={13} className="text-purple-400" />
                      ) : (
                        <Clock size={13} className={
                          sla.colorTheme === 'red' ? 'text-red-400' : sla.colorTheme === 'amber' ? 'text-amber-400' : 'text-emerald-400'
                        } />
                      )}
                      SLA ITIL • {sla.itilMeta.res}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      sla.colorTheme === 'purple'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : sla.colorTheme === 'red'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : sla.colorTheme === 'amber'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {sla.statusLabel}
                    </span>
                  </div>

                  {!sla.isFinished ? (
                    <>
                      {/* Barra de Progresso */}
                      <div className="w-full bg-slate-950/60 rounded-full h-1.5 my-2.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            sla.colorTheme === 'purple'
                              ? 'bg-purple-400 animate-pulse'
                              : sla.colorTheme === 'red'
                              ? 'bg-red-500'
                              : sla.colorTheme === 'amber'
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                          }`}
                          style={{ width: `${sla.progress}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className={`font-semibold ${
                          sla.colorTheme === 'purple' ? 'text-purple-300' : sla.colorTheme === 'red' ? 'text-red-400' : sla.colorTheme === 'amber' ? 'text-amber-300' : 'text-emerald-400'
                        }`}>
                          {sla.timeText}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Limite: {sla.deadlineFormatted}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="mt-2 text-[11px] flex flex-col gap-1">
                      <span className={sla.colorTheme === 'emerald' ? 'text-emerald-300 font-medium' : 'text-red-300 font-medium'}>
                        {sla.subText}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Limite estabelecido: {sla.deadlineFormatted}
                      </span>
                    </div>
                  )}

                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>1ª Resposta: <strong>{sla.itilMeta.resp}</strong></span>
                    <span>Resolução: <strong>{sla.itilMeta.res}</strong></span>
                  </div>
                </div>
              );
            })()}

            {/* Status do Chamado */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Status do Chamado</label>
              {isAguardando ? (
                <div className="space-y-1.5">
                  <div className="w-full bg-slate-950/40 border border-purple-500/30 rounded-xl text-purple-300 py-2.5 px-3 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-2 font-semibold">
                      <PauseCircle size={14} className="text-purple-400" />
                      Aguardando Solicitante
                    </span>
                    <span className="text-[10px] text-purple-400/90 bg-purple-400/10 px-2 py-0.5 rounded-full border border-purple-400/20 font-medium">
                      Pausado
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block leading-relaxed">
                    Aguardando resposta do solicitante. O status retornará para &quot;Em Atendimento&quot; automaticamente assim que houver resposta.
                  </span>
                </div>
              ) : isEmAtendimento ? (
                <div className="space-y-1.5">
                  <div className="w-full bg-slate-950/40 border border-amber-500/30 rounded-xl text-amber-300 py-2.5 px-3 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-2 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                      Em Atendimento
                    </span>
                    <span className="text-[10px] text-amber-400/90 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20 font-medium">
                      Ativo
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block leading-relaxed">
                    Não pode retornar para &quot;Aberto&quot;. Transfira para outro colega ou encerre o chamado.
                  </span>
                </div>
              ) : isClosed ? (
                <div className="space-y-1.5">
                  <div className="w-full bg-slate-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 py-2.5 px-3 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 size={14} className="text-emerald-400" />
                      Encerrado
                    </span>
                    <span className="text-[10px] text-emerald-400/90 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20 font-medium">
                      Finalizado
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block leading-relaxed">
                    Chamado encerrado definitivamente.
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="w-full bg-slate-950/40 border border-sky-500/30 rounded-xl text-sky-300 py-2.5 px-3 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-2 font-semibold">
                      <Clock size={14} className="text-sky-400" />
                      Aberto
                    </span>
                    <span className="text-[10px] text-sky-400/90 bg-sky-400/10 px-2 py-0.5 rounded-full border border-sky-400/20 font-medium">
                      Aguardando
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block leading-relaxed">
                    Clique em &quot;Iniciar Atendimento&quot; no topo para assumir.
                  </span>
                </div>
              )}
            </div>

            {/* Assignee update (Desabilitado se encerrado) */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Responsável</label>
              <select
                disabled={isClosed || updatingField === 'attendantId' || !isManagerOrAdmin}
                value={ticket.attendant?.id || ''}
                onChange={(e) => handleFieldUpdate('attendantId', e.target.value || null)}
                className="w-full bg-slate-950/40 border border-slate-800 rounded-xl text-slate-300 py-2.5 px-3 focus:outline-none focus:border-sky-400 text-xs disabled:opacity-50"
              >
                <option value="">Sem Atendente</option>
                {availableAttendants
                  .filter((att) => att.id !== ticket.requester.id)
                  .map((att) => (
                    <option key={att.id} value={att.id}>{att.name}</option>
                  ))}
              </select>
              {!isManagerOrAdmin && !isClosed && (
                <span className="text-[10px] text-slate-500 block">
                  {canTransfer ? 'Use o botão "Transferir Atendimento" para passar a demanda.' : 'Apenas coordenadores podem reatribuir livremente.'}
                </span>
              )}
            </div>

            {/* Priority update (Desabilitado se encerrado) */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Nível de Prioridade</label>
              <select
                disabled={isClosed || updatingField === 'priority' || !canAct}
                value={ticket.priority}
                onChange={(e) => handleFieldUpdate('priority', e.target.value)}
                className="w-full bg-slate-950/40 border border-slate-800 rounded-xl text-slate-300 py-2.5 px-3 focus:outline-none focus:border-sky-400 text-xs disabled:opacity-50"
              >
                <option value="LOW">Baixa</option>
                <option value="MEDIUM">Média</option>
                <option value="HIGH">Alta</option>
                <option value="URGENT">Urgente</option>
              </select>
            </div>

            {/* Information Meta */}
            <div className="border-t border-slate-900 pt-4 text-xs space-y-2 text-slate-400 font-light">
              <div className="flex justify-between">
                <span>Solicitante:</span>
                <span className="font-semibold text-slate-300">{ticket.requester.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Setor / Categoria:</span>
                <span className="font-semibold text-sky-400">{ticket.department.name} / {ticket.category.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Data Abertura:</span>
                <span>{new Date(ticket.createdAt).toLocaleDateString('pt-BR')}</span>
              </div>
              {ticket.closedAt && (
                <div className="flex justify-between">
                  <span>Encerramento:</span>
                  <span className="text-emerald-400 font-semibold">{new Date(ticket.closedAt).toLocaleDateString('pt-BR')}</span>
                </div>
              )}
            </div>

          </div>

          {/* History/Audit Timeline */}
          <div className="glass-panel p-4 sm:p-6 rounded-2xl relative overflow-hidden space-y-4">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-purple-400/30"></div>
            <h3 className="font-semibold text-sm text-slate-300 border-b border-slate-900 pb-2 flex items-center gap-2">
              <History size={18} /> Linha do Tempo (Auditoria)
            </h3>

            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
              {ticket.history.map((log) => (
                <div key={log.id} className="relative pl-5 border-l border-slate-800 pb-1 text-xs">
                  {/* Timeline point */}
                  <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-sky-400"></div>
                  
                  <div className="flex justify-between font-semibold text-slate-400 mb-0.5">
                    <span>{log.action}</span>
                    <span className="text-[9px] text-slate-600 font-normal">{new Date(log.createdAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-light">
                    Por: {log.user.name}
                  </div>
                  {(log.oldValue || log.newValue) && (
                    <div className="bg-slate-950/20 p-2 rounded-lg border border-slate-900 mt-1 space-y-0.5 text-[10px]">
                      {log.oldValue && (
                        <div className="text-red-400 font-light truncate">De: <span className="font-semibold">{log.oldValue}</span></div>
                      )}
                      {log.newValue && (
                        <div className="text-emerald-400 font-light">Para: <span className="font-semibold">{log.newValue}</span></div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Modal: Transferir Atendimento */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-sky-400">
                <Users size={20} />
                <h3 className="font-bold text-base text-slate-100">Transferir Atendimento</h3>
              </div>
              <button 
                onClick={() => setShowTransferModal(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Você pode transferir este chamado para outro membro do setor <strong className="text-sky-300">{ticket.department.name}</strong>. O status permanecerá em atendimento e o novo atendente será notificado.
            </p>

            {transferError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-300 text-xs rounded-xl">
                {transferError}
              </div>
            )}

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Novo Atendente Responsável *
                </label>
                <select
                  required
                  value={transferTargetId}
                  onChange={(e) => setTransferTargetId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 py-2.5 px-3 text-xs focus:outline-none focus:border-sky-400"
                >
                  <option value="">Selecione um colega do setor...</option>
                  {transferColleagues.map((colleague) => (
                    <option key={colleague.id} value={colleague.id}>
                      {colleague.name}
                    </option>
                  ))}
                </select>
                {transferColleagues.length === 0 && (
                  <span className="text-[10px] text-amber-400 mt-1 block">
                    Nenhum outro atendente cadastrado no setor {ticket.department.name}.
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Motivo da Transferência (Registrado no histórico)
                </label>
                <textarea
                  rows={3}
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="Ex: Demanda requer conhecimentos específicos de rede que o colega domina..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 py-2.5 px-3 text-xs focus:outline-none focus:border-sky-400 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  disabled={transferLoading}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={transferLoading || !transferTargetId}
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {transferLoading ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                  Confirmar Transferência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Encerrar Chamado */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 size={20} />
                <h3 className="font-bold text-base text-slate-100">Encerrar Chamado</h3>
              </div>
              <button 
                onClick={() => setShowCloseModal(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>
                <strong>Importante:</strong> Após encerrado, este chamado <u>não poderá ser reaberto</u>. Certifique-se de que a demanda foi totalmente resolvida.
              </span>
            </div>

            {closeError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-300 text-xs rounded-xl">
                {closeError}
              </div>
            )}

            <form onSubmit={handleCloseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Solução Aplicada *
                </label>
                <textarea
                  required
                  rows={4}
                  value={resolutionSummary}
                  onChange={(e) => setResolutionSummary(e.target.value)}
                  placeholder="Descreva de forma clara como a solicitação foi resolvida..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 py-2.5 px-3 text-xs focus:outline-none focus:border-emerald-400 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  disabled={closeLoading}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={closeLoading || !resolutionSummary.trim()}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {closeLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Confirmar Encerramento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal para visualizar imagens */}
      {selectedImageUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 cursor-pointer"
          onClick={() => setSelectedImageUrl(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[85vh] overflow-hidden bg-slate-950 border border-slate-800 rounded-2xl p-2 flex flex-col items-center shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedImageUrl(null)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all border border-slate-800 cursor-pointer z-10 font-bold"
            >
              ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={selectedImageUrl} 
              alt="Visualização do Anexo" 
              className="max-w-full max-h-[78vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
