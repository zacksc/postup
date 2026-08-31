import { Bell, MessageSquare, Pencil, CheckCircle2, Send, FilePlus2, AlertCircle, Trash2, CheckCheck, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Notification, NotificationType } from '@/types/notifications'

const getIcon = (type: NotificationType) => {
  switch (type) {
    case 'message': return <MessageSquare size={16} className="text-blue-500" />
    case 'alteracao': return <Pencil size={16} className="text-amber-500" />
    case 'aprovado': return <CheckCircle2 size={16} className="text-emerald-500" />
    case 'publicado': return <Send size={16} className="text-muted-foreground" />
    case 'versao': return <FilePlus2 size={16} className="text-sky-500" />
    case 'alerta': return <AlertCircle size={16} className="text-red-500" />
    default: return <Bell size={16} />
  }
}

interface NotificationDropdownProps {
  notifications: Notification[]
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearAll: () => void
}

export function NotificationDropdown({ notifications, markAsRead, markAllAsRead, clearAll }: NotificationDropdownProps) {
  const navigate = useNavigate()

  function handleClick(n: typeof notifications[0]) {
    markAsRead(n.id)
    if (n.actionUrl) navigate(n.actionUrl)
  }

  return (
    <div className="w-80 bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
      <div className="p-4 border-b border-border space-y-2">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-sm">Notificações</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
            title="Limpar todas as notificações"
          >
            <Trash2 size={13} /> Limpar tudo
          </button>
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
            title="Marcar todas como lidas"
          >
            <CheckCheck size={13} /> Marcar como lidas
          </button>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground flex flex-col gap-3">
            <p>Nenhuma notificação</p>
          </div>
        ) : (
          notifications
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 10)
            .map((n) => (
            <div
              key={n.id}
              className={cn(
                'p-3 border-b border-border hover:bg-secondary/50 transition-colors flex gap-3 items-start group',
                !n.isRead && 'bg-primary/5'
              )}
            >
              <button
                onClick={() => { handleClick(n) }}
                className="flex gap-3 items-start flex-1 min-w-0 text-left"
              >
                <div className="mt-0.5 shrink-0">{getIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {format(n.timestamp, "dd/MM/yy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); markAsRead(n.id) }}
                className="shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all mt-0.5"
                title="Marcar como lida"
              >
                <X size={12} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Rodapé: acesso ao log completo do sistema */}
      <div className="p-2 border-t border-border">
        <button
          onClick={() => navigate('/logs')}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-primary hover:bg-secondary/60 transition-colors cursor-pointer"
        >
          Ver todas as notificações
        </button>
      </div>
    </div>
  )
}
