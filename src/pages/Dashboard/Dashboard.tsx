import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { cn, getInitials } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  FileText, Clock, CheckCircle, AlertCircle, MessageSquare,
  TrendingUp, Users, Layers, ChevronRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CountUp } from '@/components/ui/CountUp'
import { Skeleton } from '@/components/ui/skeleton'

interface PostRow {
  id: string
  status: string
  client_name: string
  client_color: string
  scheduled_at: string
  post_type: string
}

interface FbRow {
  id: string
  author_name: string
  author_role: string
  message: string
  type: string
  created_at: string
  posts: { id: string; client_name: string }[] | null
}

interface CardRow {
  id: string
  status: string
  priority: string
  deadline: string
  title: string
  post_id: string
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'bg-muted-foreground' },
  aguardando: { label: 'Pendente', color: 'bg-amber-500' },
  alteracao: { label: 'Alteração', color: 'bg-rose-500' },
  aprovado: { label: 'Aprovado', color: 'bg-emerald-500' },
  publicado: { label: 'Publicado', color: 'bg-blue-500' },
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<PostRow[]>([])
  const [feedbacks, setFeedbacks] = useState<FbRow[]>([])
  const [cards, setCards] = useState<CardRow[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [postsRes, fbRes, cardsRes] = await Promise.all([
          supabase.from('posts').select('id, status, client_name, client_color, scheduled_at, post_type'),
          supabase.from('post_feedbacks').select('id, author_name, author_role, message, type, created_at, posts(id, client_name)').order('created_at', { ascending: false }).limit(10),
          supabase.from('feedback_cards').select('id, status, priority, deadline, title, post_id').order('created_at', { ascending: false }),
        ])
        if (postsRes.data) setPosts(postsRes.data)
        if (fbRes.data) setFeedbacks(fbRes.data)
        if (cardsRes.data) setCards(cardsRes.data)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalPosts = posts.length
  const statusCounts = posts.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1
    return acc
  }, {})
  const pendingCount = statusCounts.aguardando || 0
  const approvedCount = statusCounts.aprovado || 0
  const alteracaoCount = statusCounts.alteracao || 0
  const publishedCount = statusCounts.publicado || 0

  const clientCount = new Set(posts.map(p => p.client_name)).size
  const feedbackTotal = feedbacks.length
  const openCards = cards.filter(c => c.status !== 'aprovado').length
  const overdueCards = cards.filter(c => new Date(c.deadline) < new Date() && c.status !== 'aprovado').length

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-[1400px] mx-auto pb-24">
      <header>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral dos posts e métricas do mês</p>
      </header>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
        <MetricCard icon={Layers} label="Total de posts" value={totalPosts} color="bg-primary/10 text-primary" />
        <MetricCard icon={Clock} label="Pendentes" value={pendingCount} color="bg-amber-500/10 text-amber-600" />
        <MetricCard icon={CheckCircle} label="Aprovados" value={approvedCount} color="bg-emerald-500/10 text-emerald-600" />
        <MetricCard icon={AlertCircle} label="Alterações" value={alteracaoCount} color="bg-rose-500/10 text-rose-600" />
        <MetricCard icon={TrendingUp} label="Publicados" value={publishedCount} color="bg-blue-500/10 text-blue-600" />
        <MetricCard icon={Users} label="Clientes" value={clientCount} color="bg-secondary text-muted-foreground" />
        <MetricCard icon={MessageSquare} label="Feedbacks" value={feedbackTotal} color="bg-sky-500/10 text-sky-600" />
        <MetricCard icon={FileText} label="Cards abertos" value={openCards} color={overdueCards > 0 ? 'bg-destructive/10 text-destructive' : 'bg-orange-500/10 text-orange-600'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
        {/* Posts by status */}
        <section className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-bold mb-4">Posts por status</h2>
          <div className="flex flex-col gap-3">
            {Object.entries(STATUS_MAP).map(([key, meta]) => {
              const count = statusCounts[key] || 0
              const pct = totalPosts > 0 ? (count / totalPosts) * 100 : 0
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.color.replace('bg-', '') }} />
                  <span className="text-xs text-muted-foreground w-20 shrink-0">{meta.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-secondary/50 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', meta.color)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold w-8 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </section>

        {/* Cards / Quick actions */}
        <aside className="flex flex-col gap-4">
          {/* Overdue cards alert */}
          {overdueCards > 0 && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={16} className="text-destructive" />
                <span className="text-sm font-semibold text-destructive">Cards atrasados</span>
              </div>
              <p className="text-xs text-muted-foreground">{overdueCards} card{overdueCards > 1 ? 's' : ''} passou passaram do prazo</p>
              <button onClick={() => navigate('/feedbacks')} className="text-xs font-bold text-destructive mt-2 flex items-center gap-1 hover:underline">
                Ver cards <ChevronRight size={12} />
              </button>
            </div>
          )}

          {/* Recent feedbacks */}
          <section className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Atividades recentes</h3>
            <div className="flex flex-col gap-2 stagger">
              {feedbacks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhuma atividade</p>
              ) : (
                feedbacks.map(fb => (
                  <div
                    key={fb.id}
                    className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
                    onClick={() => fb.posts?.[0]?.id && navigate(`/posts/${fb.posts[0].id}`)}
                  >
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0',
                      fb.author_role === 'cliente' ? 'bg-rose-400' : 'bg-primary'
                    )}>
                      {getInitials(fb.author_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{fb.author_name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {fb.type === 'log' ? fb.message : `"${fb.message.slice(0, 50)}${fb.message.length > 50 ? '...' : ''}"`}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {fb.created_at ? format(new Date(fb.created_at), "dd/MM/yy HH:mm", { locale: ptBR }) : ''}
                        {fb.posts?.[0] && ` · ${fb.posts[0].client_name}`}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
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
