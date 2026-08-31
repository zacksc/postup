import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ChevronRight, ChevronLeft, AlertCircle, Layers, Clock, CheckCircle, 
  TrendingUp, Users, MessageSquare, FileText,
  CheckCircle2, Pencil, RefreshCw, Plus, RotateCcw,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CountUp } from '@/components/ui/CountUp'
import { Skeleton } from '@/components/ui/skeleton'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns'
import { PostCard, type Post as PostCardPost } from '@/components/post/PostCard'
import { MonthView } from '@/components/calendar/MonthView'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { cn, isVideoUrl } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Post } from '@/types/post'
import type { PostStatus, PostType } from '@/components/ui/status-badge'
import type { FeedbackCard } from '@/types/feedback'

interface PostRow {
  id: string
  client_id: string | null
  client_name: string
  client_color: string | null
  client_handle: string | null
  post_type: string | null
  scheduled_at: string
  caption: string | null
  status: string | null
  media_urls: string[] | null
}

interface ActivityRow {
  id: string
  author_role: string
  author_name: string
  message: string
  type: string
  created_at: string
  posts: { id: string; client_name: string; client_color: string } | null
}

function getActionMeta(author_role: string, type: string, message: string): { icon: LucideIcon; label: string; color: string } {
  if (type === 'message' || (author_role === 'cliente' && !message.includes('aprovou'))) {
    return {
      icon: MessageSquare,
      label: author_role === 'cliente' ? 'Cliente enviou mensagem' : 'Gestor respondeu',
      color: author_role === 'cliente' ? 'bg-rose-400' : 'bg-primary',
    }
  }
  if (message.includes('aprovou') || message.includes('aprovado')) {
    return { icon: CheckCircle2, label: 'Post aprovado', color: 'bg-emerald-400' }
  }
  if (message.includes('alteração') || message.includes('Alteração')) {
    return { icon: Pencil, label: 'Alteração solicitada', color: 'bg-amber-400' }
  }
  if (message.includes('restaurou')) {
    return { icon: RotateCcw, label: 'Versão restaurada', color: 'bg-muted-foreground' }
  }
  if (message.includes('criou')) {
    return { icon: Plus, label: 'Versão criada', color: 'bg-sky-400' }
  }
  if (message.includes('desfez')) {
    return { icon: RotateCcw, label: 'Aprovação desfeita', color: 'bg-orange-400' }
  }
  return { icon: RefreshCw, label: 'Atualização', color: 'bg-muted-foreground' }
}

export default function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [referenceDate, setReferenceDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date())
  const [daySheetDay, setDaySheetDay] = useState<Date | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityRow[]>([])
  const [cards, setCards] = useState<FeedbackCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function carregarDados() {
      setLoading(true)
      setError(null)
      try {
        const [postsRes, fbRes, cardsRes] = await Promise.all([
          supabase.from('posts').select('*'),
          supabase.from('post_feedbacks')
            .select('id, message, created_at, author_name, author_role, type, posts(id, client_name, client_color)')
            .order('created_at', { ascending: false }).limit(10),
          supabase.from('feedback_cards').select('id, status, priority, deadline, title, post_id').order('created_at', { ascending: false }),
        ])

        if (postsRes.error) throw postsRes.error
        if (postsRes.data) setPosts((postsRes.data as PostRow[]).map((p) => ({
          id: p.id,
          clientId: p.client_id || '',
          clientName: p.client_name,
          clientColor: p.client_color || '#374151',
          clientHandle: p.client_handle || '',
          type: p.post_type?.toLowerCase() as PostType || 'foto',
          scheduledAt: new Date(p.scheduled_at),
          caption: p.caption || '',
          status: (p.status || 'aguardando') as PostStatus,
          files: (p.media_urls || []).map((url: string, i: number) => ({
            id: `media-${i}`, url, order: i, mediaType: isVideoUrl(url) ? 'video' : 'image',
          })),
        })))

        if (fbRes.data) setRecentActivity(fbRes.data as unknown as ActivityRow[])
        if (cardsRes.data) setCards(cardsRes.data as FeedbackCard[])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }
    carregarDados()
  }, [])

  const monthStart = startOfMonth(referenceDate)
  const monthEnd = endOfMonth(monthStart)
  const days = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) })

  const handleDayClick = (day: Date) => {
    const postsDia = posts.filter(p => isSameDay(new Date(p.scheduledAt), day))
    if (window.innerWidth < 768) {
      setSelectedDay(day)
      setDaySheetDay(day)
    } else if (postsDia.length > 0) {
      navigate(`/cronograma?date=${day.toISOString().split('T')[0]}`)
    } else {
      setSelectedDay(day)
    }
  }

  const handleDayDoubleClick = (day: Date) => {
    navigate(`/posts/novo?date=${day.toISOString().split('T')[0]}`)
  }

  const totalPosts = posts.length
  const statusCounts = posts.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1
    return acc
  }, {})
  const pendingCount = statusCounts.aguardando || 0
  const approvedCount = statusCounts.aprovado || 0
  const alteracaoCount = statusCounts.alteracao || 0
  const publishedCount = statusCounts.publicado || 0
  const clientCount = new Set(posts.map(p => p.clientName)).size
  const openCards = cards.filter(c => c.status !== 'aprovado').length
  const overdueCards = cards.filter(c => new Date(c.deadline) < new Date() && c.status !== 'aprovado').length

  const pendencias = posts.filter(p => !['aprovado', 'publicado', 'rascunho'].includes(p.status))


  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-8 max-w-[1800px] mx-auto pb-24">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
          <Skeleton className="h-[520px] rounded-xl" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-56 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle size={24} className="text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <button onClick={() => window.location.reload()} className="text-sm text-primary hover:underline">
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-[1800px] mx-auto pb-24">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Olá, {user?.user_metadata?.full_name || 'Usuário'}!</h1>
        <p className="text-sm text-muted-foreground">Visão geral dos posts e métricas do mês</p>
      </header>

      {/* Calendar + sidebar (prioridade) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
        <div className="bg-card border border-border p-4 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setReferenceDate(subMonths(referenceDate, 1))} className="p-1.5 hover:bg-secondary text-muted-foreground">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold capitalize">
              {format(referenceDate, "MMMM yyyy", { locale: ptBR })}
            </span>
            <button onClick={() => setReferenceDate(addMonths(referenceDate, 1))} className="p-1.5 hover:bg-secondary text-muted-foreground">
              <ChevronRight size={16} />
            </button>
          </div>
          <MonthView
            days={days}
            referenceDate={referenceDate}
            selectedDay={selectedDay}
            getPostsForDay={(d) => posts.filter(p => isSameDay(new Date(p.scheduledAt), d))}
            onDayClick={handleDayClick}
            onDayDoubleClick={handleDayDoubleClick}
            onPostClick={(post) => navigate(`/posts/${post.id}`)}
          />
        </div>

        <aside className="flex flex-col gap-4">
          {/* Overdue alert */}
          {overdueCards > 0 && (
            <div className="bg-destructive/5 border border-destructive/20 p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={16} className="text-destructive" />
                <span className="text-sm font-semibold text-destructive">Cards atrasados</span>
              </div>
              <p className="text-xs text-muted-foreground">{overdueCards} card{overdueCards > 1 ? 's' : ''} passou do prazo</p>
              <button onClick={() => navigate('/tarefas')} className="text-xs font-bold text-destructive mt-2 flex items-center gap-1 hover:underline">
                Ver cards <ChevronRight size={12} />
              </button>
            </div>
          )}

          {/* Pendências */}
          <section>
            <h3 className="text-sm font-bold text-muted-foreground uppercase mb-3 flex items-center gap-2">
              <AlertCircle size={16} className="text-warning" /> Pendências
            </h3>
            <div className="flex flex-col gap-2">
              {pendencias.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma pendência.</p>
              ) : (
                pendencias.slice(0, 3).map(p => {
                  const postCards = cards.filter(c => c.post_id === p.id)
                  return (
                    <div key={p.id}>
                      <PostCard
                        post={{
                          id: p.id,
                          type: p.type,
                          caption: p.caption,
                          scheduled_at: p.scheduledAt.toISOString().split('T')[0],
                          status: (p.status === 'alteracao' ? 'em_alteracao' : p.status) as PostCardPost['status'],
                          client: { name: p.clientName, color: p.clientColor },
                          files: p.files,
                        }}
                        variant="list"
                        onClick={() => navigate(`/posts/${p.id}`)}
                      />
                      {postCards.length > 0 && (
                        <div className="ml-2 mt-1 space-y-1">
                          {postCards.slice(0, 2).map(c => (
                            <div key={c.id} className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] text-muted-foreground bg-secondary/30">
                              <div className={cn("w-1.5 h-1.5 shrink-0", {
                                'bg-amber-500': c.status === 'aguardando',
                                'bg-rose-500': c.status === 'alteracao',
                                'bg-emerald-500': c.status === 'aprovado',
                              })} />
                              <span className="truncate">{c.title || 'Sem título'}</span>
                              {c.deadline && (
                                <span className="text-[8px] text-muted-foreground/60 ml-auto shrink-0">
                                  {format(new Date(c.deadline), "dd/MM")}
                                </span>
                              )}
                            </div>
                          ))}
                          {postCards.length > 2 && (
                            <p className="text-[9px] text-muted-foreground ml-2.5">+{postCards.length - 2} cards</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
            {pendencias.length > 3 && (
              <button onClick={() => navigate('/tarefas')} className="text-xs font-bold text-primary mt-2 flex items-center gap-1 hover:underline">
                Ver mais <ChevronRight size={14} />
              </button>
            )}
          </section>

          {/* Recent activities */}
          <section>
            <h3 className="text-sm font-bold text-muted-foreground uppercase mb-3 flex items-center gap-2">
              <MessageSquare size={16} /> Atividades
            </h3>
            <div className="flex flex-col gap-1.5">
              {recentActivity.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma atividade recente.</p>
              ) : (
                recentActivity.slice(0, 3).map((a: ActivityRow) => {
                  const meta = getActionMeta(a.author_role, a.type, a.message)
                  const Icon = meta.icon
                  return (
                    <div
                      key={a.id}
                      className="flex items-start gap-2.5 p-2 hover:bg-secondary/50 transition-colors cursor-pointer"
                      onClick={() => a.posts?.id && navigate(`/posts/${a.posts.id}`)}
                    >
                      <div className={cn('w-7 h-7 flex items-center justify-center shrink-0', meta.color)}>
                        <Icon size={12} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium truncate">{a.author_name}</span>
                          <span className="text-[9px] px-1 py-0.5 font-medium"
                            style={{
                              backgroundColor: a.author_role === 'cliente' ? '#fce4ec' : a.author_role === 'Sistema' ? '#f0f0f0' : '#e3f2fd',
                              color: a.author_role === 'cliente' ? '#c62828' : a.author_role === 'Sistema' ? '#666' : '#1565c0',
                            }}
                          >
                            {a.author_role}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground/80 mt-0.5 line-clamp-1">
                          {meta.label}
                        </p>
                        <p className="text-[11px] text-foreground/70 truncate">
                          {a.type === 'log' ? a.message : `"${a.message.slice(0, 60)}${a.message.length > 60 ? '...' : ''}"`}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {a.created_at ? format(new Date(a.created_at), "dd/MM/yy HH:mm", { locale: ptBR }) : ''}
                          {a.posts && ` · ${a.posts.client_name}`}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              {recentActivity.length > 0 && (
                <button onClick={() => navigate('/logs')} className="text-xs font-bold text-primary mt-2 flex items-center gap-1 hover:underline">
                  Ver todas as atividades <ChevronRight size={14} />
                </button>
              )}
            </div>
          </section>
        </aside>
      </div>

      {/* Métricas (abaixo de tudo) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
        <MetricCard icon={Layers} label="Total de posts" value={totalPosts} color="bg-primary/10 text-primary" />
        <MetricCard icon={Clock} label="Pendentes" value={pendingCount} color="bg-amber-500/10 text-amber-600" />
        <MetricCard icon={CheckCircle} label="Aprovados" value={approvedCount} color="bg-emerald-500/10 text-emerald-600" />
        <MetricCard icon={AlertCircle} label="Alterações" value={alteracaoCount} color="bg-rose-500/10 text-rose-600" />
        <MetricCard icon={TrendingUp} label="Publicados" value={publishedCount} color="bg-blue-500/10 text-blue-600" />
        <MetricCard icon={Users} label="Clientes" value={clientCount} color="bg-secondary text-muted-foreground" />
        <MetricCard icon={MessageSquare} label="Feedbacks" value={recentActivity.length} color="bg-sky-500/10 text-sky-600" />
        <MetricCard icon={FileText} label="Cards abertos" value={openCards} color={overdueCards > 0 ? 'bg-destructive/10 text-destructive' : 'bg-orange-500/10 text-orange-600'} />
      </div>

      {/* Bottom sheet do dia (mobile) */}
      <BottomSheet
        open={!!daySheetDay}
        onOpenChange={(open) => { if (!open) setDaySheetDay(null) }}
        title={daySheetDay ? format(daySheetDay, "EEEE, d 'de' MMMM", { locale: ptBR }) : ''}
      >
        {daySheetDay && (() => {
          const dayPosts = posts.filter(p => isSameDay(new Date(p.scheduledAt), daySheetDay))
          if (dayPosts.length === 0) {
            return (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">Nenhum post agendado para este dia.</p>
                <Button size="sm" onClick={() => { setDaySheetDay(null); navigate(`/posts/novo?date=${format(daySheetDay, 'yyyy-MM-dd')}`) }}>
                  <Plus size={14} /> Criar post
                </Button>
              </div>
            )
          }
          return (
            <div className="flex flex-col gap-2">
              {dayPosts.map(p => (
                <PostCard
                  key={p.id}
                  post={{
                    id: p.id,
                    type: p.type,
                    caption: p.caption,
                    scheduled_at: format(p.scheduledAt, 'yyyy-MM-dd'),
                    status: (p.status === 'alteracao' ? 'em_alteracao' : p.status) as PostCardPost['status'],
                    client: { name: p.clientName, color: p.clientColor },
                    files: p.files,
                  }}
                  variant="list"
                  onClick={() => { setDaySheetDay(null); navigate(`/posts/${p.id}`) }}
                />
              ))}
            </div>
          )
        })()}
      </BottomSheet>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: number; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 lift hover:shadow-md">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', color)}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <CountUp value={value} className="text-xl font-bold" />
      </div>
    </div>
  )
}
