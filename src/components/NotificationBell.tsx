'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Bell } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Carrega as notificações do usuário
  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Erro ao buscar notificações:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Poll a cada 30 segundos para notificações novas
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Abre/fecha dropdown e marca como lidas ao abrir
  const handleToggle = async () => {
    const nextState = !isOpen;
    setIsOpen(nextState);

    if (nextState && unreadCount > 0) {
      // Otimismo no frontend: zera o contador imediatamente
      setUnreadCount(0);
      
      try {
        await fetch('/api/notifications', { method: 'PATCH' });
        // Recarrega lista para atualizar status de "read" visualmente
        fetchNotifications();
      } catch (err) {
        console.error('Erro ao marcar notificações como lidas:', err);
      }
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={handleToggle}
        className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-900/30 transition-all cursor-pointer relative"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-purple-500 rounded-full border border-[#090d16] text-[9px] font-bold text-white flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-2xl z-50 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-900 pb-2">
            <h4 className="font-semibold text-xs text-slate-300 uppercase tracking-wider">Notificações</h4>
            {unreadCount > 0 && (
              <span className="text-[10px] text-purple-400 font-medium">{unreadCount} novas</span>
            )}
          </div>

          <div className="space-y-2 pr-1">
            {notifications.length === 0 ? (
              <p className="text-center text-slate-500 text-xs py-6 italic">Você não possui notificações.</p>
            ) : (
              notifications.map((item) => (
                <div 
                  key={item.id} 
                  className={`p-3 rounded-xl border transition-colors ${
                    !item.read 
                      ? 'bg-purple-950/10 border-purple-500/10 hover:bg-purple-950/15' 
                      : 'bg-slate-900/10 border-slate-900/30 hover:bg-slate-900/20'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-xs text-slate-200 block pr-2 truncate">
                      {item.title}
                    </span>
                    <span className="text-[8px] text-slate-500 shrink-0">
                      {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-light leading-normal">
                    {item.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
