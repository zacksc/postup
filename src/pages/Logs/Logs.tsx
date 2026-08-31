import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  MessageSquare, CheckCircle2, Pencil, RefreshCw, Plus,
  RotateCcw, Loader2, AlertCircle, ArrowLeft,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface LogRow {
  id: string
  post_id: string
  author_role: string
  author_name: string
  message: string
  type: string
  created_at: string
  posts: { id: string; client_name: string; client_color: string } | null
}

function getActionMeta(author_role: string, type: string, message: string): { icon: LucideIcon; label: string; color: string } {
  if (type === 'message') {
    return {
      icon: MessageSquare,
      label: author_role === 'cliente' ? 'Cliente enviou mensagem' : 'Gestor respondeu',
      color: author_role === 'cliente' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600',
    }
  }
  if (message.includes('aprovou') || message.includes('aprovado')) {
    return { icon: CheckCircle2, label: 'Post aprovado', color: 'bg-emerald-100 text-emerald-600' }
  }
  if (message.includes('alteração') || message.includes('Alteração')) {
    return { icon: Pencil, label: 'Alteração solicitada', color: 'bg-amber-100 text-amber-600' }
  }
  if (message.includes('restaurou')) {
    return { icon: RotateCcw, label: 'Versão restaurada', color: 'bg-secondary text-muted-foreground' }
  }
  if (message.includes('criou')) {
    return { icon: Plus, label: 'Versão criada', color: 'bg-sky-100 text-sky-600' }
  }
  if (message.includes('desfez')) {
    return { icon: RotateCcw, label: 'Aprovação desfeita', color: 'bg-orange-100 text-orange-600' }
  }
  return { icon: RefreshCw, label: 'Atualização', color: 'bg-secondary text-muted-foreground' }
}

export default function LogsPage() {
  const navigate = useNavigate()
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const { data, error: err } = await supabase
          .from('post_feedbacks')
          .select('*, posts(id, client_name, client_color)')
          .order('created_at', { ascending: false })
        if (err) throw err
        setLogs((data as LogRow[]) || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar logs')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle size={18} />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-[900px] mx-auto pb-24">
      <header className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-secondary rounded-full">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold">Histórico de Atividades</h1>
          <p className="text-sm text-muted-foreground">{logs.length} registros</p>
        </div>
      </header>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex flex-col gap-0">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro encontrado</p>
          ) : (
            logs.map((item, idx) => {
              const meta = getActionMeta(item.author_role, item.type, item.message)
              const Icon = meta.icon
              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex gap-4 py-3.5 cursor-pointer hover:bg-secondary/30 transition-colors rounded-lg px-3 -mx-3',
                    idx < logs.length - 1 && 'border-b border-border/50'
                  )}
                  onClick={() => item.post_id && navigate(`/posts/${item.post_id}`)}
                >
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center gap-0.5">
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0', meta.color)}>
                      <Icon size={14} />
                    </div>
                    {idx < logs.length - 1 && <div className="w-px flex-1 bg-border/50 min-h-[12px]" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold">{item.author_name}</span>
                      <span className={cn(
                        'text-[9px] px-1.5 py-0.5 rounded font-medium',
                        item.author_role === 'cliente' ? 'bg-rose-100 text-rose-700' :
                        item.author_role === 'Sistema' ? 'bg-secondary text-muted-foreground' :
                        'bg-blue-100 text-blue-700'
                      )}>
                        {item.author_role}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {item.created_at ? format(new Date(item.created_at), "dd/MM/yy HH:mm", { locale: ptBR }) : ''}
                      </span>
                    </div>

                    <p className="text-sm mt-1">{item.message}</p>

                    {item.posts && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: item.posts.client_color || '#374151' }}
                        />
                        <span className="text-[11px] text-muted-foreground">{item.posts.client_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
