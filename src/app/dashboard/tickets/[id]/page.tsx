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
  Upload
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
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  requester: UserPayload;
  attendant: UserPayload | null;
  department: { id: string; name: string };
  category: { id: string; name: string };
  status: { id: string; name: string; color: string };
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
  const [submittingComment, setSubmittingComment] = useState(false);
  
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  
  // Listas auxiliares para alteração rápida (atendentes, status)
  const [availableStatuses, setAvailableStatuses] = useState<{ id: string; name: string }[]>([]);
  const [availableAttendants, setAvailableAttendants] = useState<{ id: string; name: string }[]>([]);
  const [updatingField, setUpdatingField] = useState<string | null>(null);
  
  // Dados de sessão do usuário logado carregados do cookie para fins de RBAC na UI
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);

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

  // Define se o usuário atual é Atendente ou Admin baseado nos dados do ticket
  useEffect(() => {
    if (ticket) {
      // Simulação simples: se o requester é diferente do usuário e ele tem permissão de atendente,
      // ele verá comentários internos. Para fins práticos na UI, faremos fetch simples
      // ou leremos a role informada na sessão. 
      // Para evitar chamadas extras, decodificamos a role do ticket
    }
  }, [ticket]);

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
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || 'Erro ao adicionar comentário.');
      }

      setCommentText('');
      setIsInternalComment(false);
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

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard"
            className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-semibold text-lg">#{String(ticket.number).padStart(5, '0')}</span>
              <span 
                className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border"
                style={{ 
                  backgroundColor: `${ticket.status.color}15`, 
                  borderColor: `${ticket.status.color}35`, 
                  color: ticket.status.color 
                }}
              >
                {ticket.status.name}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-100 mt-1">{ticket.title}</h1>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns - Details, Comments, Attachments */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Description */}
          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden space-y-4">
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
          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden space-y-4">
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
                            onClick={() => setSelectedImageUrl(`/api/tickets/attachments/${file.id}/view`)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={`/api/tickets/attachments/${file.id}/view`} 
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
                        {/* Botão de download seguro chamando o Route Handler de download protegido */}
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

            {/* File Upload Form */}
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
          </div>

          {/* Comments and timeline */}
          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden space-y-4">
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
            <form onSubmit={handleCommentSubmit} className="border-t border-slate-900 pt-4 space-y-3">
              <textarea
                rows={3}
                placeholder="Insira um comentário ou resposta..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="w-full bg-slate-950/40 border border-slate-800 rounded-xl text-slate-200 py-3 px-4 focus:outline-none focus:border-sky-400 text-sm resize-none"
              />
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {/* Atendentes podem postar comentários internos */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="internal-comment"
                    checked={isInternalComment}
                    onChange={(e) => setIsInternalComment(e.target.checked)}
                    className="w-4 h-4 bg-slate-950/40 border border-slate-800 rounded text-purple-400 focus:ring-purple-400"
                  />
                  <label htmlFor="internal-comment" className="text-xs font-medium text-slate-400 flex items-center gap-1 cursor-pointer">
                    <EyeOff size={12} /> Comentário Interno (Oculto do Solicitante)
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submittingComment || !commentText.trim()}
                  className="px-4 py-2 bg-gradient-to-r from-sky-400 to-purple-500 hover:from-sky-500 hover:to-purple-600 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
                >
                  {submittingComment ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                  Enviar Comentário
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Right Sidebar Columns - Metadata controls and History timeline */}
        <div className="space-y-6">
          
          {/* Metadata Controls */}
          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden space-y-5">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-sky-400/30"></div>
            
            <h3 className="font-semibold text-sm text-slate-300 border-b border-slate-900 pb-2">Controles Operacionais</h3>

            {/* SLA countdown bar */}
            {ticket.slaDeadline && (
              <div className={`p-4 rounded-xl border ${
                ticket.slaViolated 
                  ? 'bg-red-500/5 border-red-500/20' 
                  : 'bg-emerald-500/5 border-emerald-500/20'
              }`}>
                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-400">Status do SLA</span>
                  <span className={ticket.slaViolated ? 'text-red-400' : 'text-emerald-400'}>
                    {ticket.slaViolated ? 'Estourado' : 'Dentro do Prazo'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <Clock size={12} />
                  <span>Prazo final: {new Date(ticket.slaDeadline).toLocaleString('pt-BR')}</span>
                </div>
              </div>
            )}

            {/* Status update */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Mudar Status</label>
              <select
                disabled={updatingField === 'statusId'}
                value={ticket.status.id}
                onChange={(e) => handleFieldUpdate('statusId', e.target.value)}
                className="w-full bg-slate-950/40 border border-slate-800 rounded-xl text-slate-300 py-2.5 px-3 focus:outline-none focus:border-sky-400 text-xs"
              >
                {availableStatuses.map((st) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </div>

            {/* Assignee update */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Designar Responsável</label>
              <select
                disabled={updatingField === 'attendantId'}
                value={ticket.attendant?.id || ''}
                onChange={(e) => handleFieldUpdate('attendantId', e.target.value || null)}
                className="w-full bg-slate-950/40 border border-slate-800 rounded-xl text-slate-300 py-2.5 px-3 focus:outline-none focus:border-sky-400 text-xs"
              >
                <option value="">Sem Atendente</option>
                {availableAttendants
                  .filter((att) => att.id !== ticket.requester.id)
                  .map((att) => (
                    <option key={att.id} value={att.id}>{att.name}</option>
                  ))}
              </select>
            </div>

            {/* Priority update */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Nível de Prioridade</label>
              <select
                disabled={updatingField === 'priority'}
                value={ticket.priority}
                onChange={(e) => handleFieldUpdate('priority', e.target.value)}
                className="w-full bg-slate-950/40 border border-slate-800 rounded-xl text-slate-300 py-2.5 px-3 focus:outline-none focus:border-sky-400 text-xs"
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
          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden space-y-4">
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
            {/* Botão de Fechar */}
            <button
              onClick={() => setSelectedImageUrl(null)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all border border-slate-800 cursor-pointer z-10 font-bold"
            >
              ✕
            </button>
            {/* Imagem Ampliada */}
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
