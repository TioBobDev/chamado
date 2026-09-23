'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert, Loader2, AlertCircle } from 'lucide-react';
import { formatDateTime } from '@/shared/utils/utils';
import { apiFetch } from '@/shared/utils/api';

interface AuditLog {
  id: string;
  action: string;
  entityName: string;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/audit')
      .then((res) => {
        if (!res.ok) throw new Error('Não foi possível carregar os logs.');
        return res.json();
      })
      .then((data) => {
        setLogs(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-400 gap-3">
        <Loader2 className="animate-spin text-sky-400" size={32} />
        Buscando registros de auditoria...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-400 flex items-center justify-center gap-2">
        <AlertCircle size={20} /> {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <ShieldAlert className="text-purple-400" /> Logs Globais de Auditoria
        </h1>
        <p className="text-sm text-slate-400">Rastreamento de ações críticas e eventos do sistema para fins de auditoria interna.</p>
      </div>

      {/* Logs Table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Nenhum registro de auditoria gravado no momento.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-950/30 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Data / Hora</th>
                  <th className="py-4 px-6">Usuário</th>
                  <th className="py-4 px-6">Ação</th>
                  <th className="py-4 px-6">Entidade</th>
                  <th className="py-4 px-6">ID Entidade</th>
                  <th className="py-4 px-6">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/40 text-xs text-slate-300 font-mono">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/10 transition-colors">
                    <td className="py-4 px-6 text-slate-400 font-sans">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="py-4 px-6 font-sans">
                      {log.user ? (
                        <div>
                          <span className="block font-medium text-slate-200">{log.user.name}</span>
                          <span className="text-[10px] text-slate-500">{log.user.email}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">Sistema / Robô</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className="bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-400 font-sans">
                      {log.entityName}
                    </td>
                    <td className="py-4 px-6 text-slate-500 truncate max-w-[120px]">
                      {log.entityId || '-'}
                    </td>
                    <td className="py-4 px-6 text-slate-400 font-sans truncate max-w-xs" title={log.details || ''}>
                      {log.details || '-'}
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
