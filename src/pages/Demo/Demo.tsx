import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { MonthView } from '@/components/calendar/MonthView'
import { Button } from '@/components/ui/button'
import { AppAvatar } from '@/components/ui/avatar'
import { Brand } from '@/components/layout/Brand'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Bell,
  Sparkles,
  LogIn,
  UserPlus,
  Layers,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Users,
  MessageSquare,
  FileText,
  CheckCircle2,
  ChevronRight,
  Plus,
  CalendarDays,
  ListTodo,
  Home,
  PanelLeftClose,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Post } from '@/types/post'

const NAV_ITEMS_MOCK: { label: string; icon: LucideIcon; key: string }[] = [
  { label: 'Home', icon: Home, key: 'home' },
  { label: 'Cronograma', icon: CalendarDays, key: 'cronograma' },
  { label: 'Clientes', icon: Users, key: 'clientes' },
  { label: 'Tarefas', icon: ListTodo, key: 'feedbacks' },
  { label: 'Chat', icon: MessageSquare, key: 'chat' },
]

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'bg-gray-400' },
  aguardando: { label: 'Pendente', color: 'bg-amber-500' },
  alteracao: { label: 'Alteração', color: 'bg-rose-500' },
  aprovado: { label: 'Aprovado', color: 'bg-emerald-500' },
  publicado: { label: 'Publicado', color: 'bg-blue-500' },
}

const CLIENTS = [
  { name: 'Ana Beauty', color: '#e87979', handle: '@anabeauty' },
  { name: 'Studio Fit', color: '#34d399', handle: '@studiofit' },
  { name: 'Café & Co.', color: '#fbbf24', handle: '@cafeeCo' },
]

function buildMockPosts(): Post[] {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const schedule = (day: number, hour: number) => new Date(year, month, day, hour, 0)

  return [
    { id: 'mock-1', clientId: 'c1', clientName: 'Ana Beauty', clientColor: CLIENTS[0].color, clientHandle: CLIENTS[0].handle, type: 'foto', status: 'aprovado', caption: 'Look verão 2026 ☀️ #beauty', scheduledAt: schedule(8, 9), files: [], feedbackCount: 2, version: 3 },
    { id: 'mock-2', clientId: 'c1', clientName: 'Ana Beauty', clientColor: CLIENTS[0].color, clientHandle: CLIENTS[0].handle, type: 'reels', status: 'aguardando', caption: 'Tutorial maquiagem', scheduledAt: schedule(10, 14), files: [], feedbackCount: 1, version: 2 },
    { id: 'mock-3', clientId: 'c2', clientName: 'Studio Fit', clientColor: CLIENTS[1].color, clientHandle: CLIENTS[1].handle, type: 'carrossel', status: 'alteracao', caption: '5 exercícios para definir o abdomen', scheduledAt: schedule(10, 10), files: [], feedbackCount: 3, version: 4 },
    { id: 'mock-4', clientId: 'c2', clientName: 'Studio Fit', clientColor: CLIENTS[1].color, clientHandle: CLIENTS[1].handle, type: 'foto', status: 'publicado', caption: 'Transformação em 3 meses', scheduledAt: schedule(5, 11), files: [], version: 1 },
    { id: 'mock-5', clientId: 'c3', clientName: 'Café & Co.', clientColor: CLIENTS[2].color, clientHandle: CLIENTS[2].handle, type: 'design', status: 'aprovado', caption: 'Novo smoothie da casa', scheduledAt: schedule(15, 8), files: [], feedbackCount: 1, version: 2 },
    { id: 'mock-6', clientId: 'c3', clientName: 'Café & Co.', clientColor: CLIENTS[2].color, clientHandle: CLIENTS[2].handle, type: 'stories', status: 'rascunho', caption: 'Promoção café + pão de queijo', scheduledAt: schedule(18, 7), files: [], version: 1 },
    { id: 'mock-7', clientId: 'c1', clientName: 'Ana Beauty', clientColor: CLIENTS[0].color, clientHandle: CLIENTS[0].handle, type: 'foto', status: 'aprovado', caption: 'Make para festa 🎉', scheduledAt: schedule(22, 16), files: [], feedbackCount: 1, version: 2 },
    { id: 'mock-8', clientId: 'c2', clientName: 'Studio Fit', clientColor: CLIENTS[1].color, clientHandle: CLIENTS[1].handle, type: 'reels', status: 'aguardando', caption: 'Desafio 30 dias', scheduledAt: schedule(25, 10), files: [], version: 1 },
  ]
}

const mockActivities = [
  { author: 'Marina Costa', role: 'gestor', action: 'respondeu ao feedback', client: 'Ana Beauty', color: 'bg-primary' },
  { author: 'Carlos Lima', role: 'cliente', action: 'aprovou o post', client: 'Carlos Lima', color: 'bg-rose-400' },
  { author: 'Você', role: 'gestor', action: 'criou nova versão', client: 'Studio Fit', color: 'bg-primary' },
  { author: 'Sistema', role: 'Sistema', action: 'post publicado com sucesso', client: 'Loja Aurora', color: 'bg-gray-400' },
]

const mockCards: { title: string; status: string; priority: string; deadline: string }[] = [
  { title: 'Alterar cor do post do Studio Fit', status: 'aberto', priority: 'alta', deadline: new Date(Date.now() + 86400000).toISOString() },
  { title: 'Inserir logo na foto do Café & Co.', status: 'aberto', priority: 'media', deadline: new Date(Date.now() + 172800000).toISOString() },
]

export default function DemoPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [timeLeft, setTimeLeft] = useState(300)
  const [activeView, setActiveView] = useState('home')
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date())
  const guardRef = useRef<HTMLDivElement>(null)
  const timerExpiredRef = useRef(false)

  const mockPosts = useMemo(() => buildMockPosts(), [])

  const referenceDate = useMemo(() => new Date(), [])
  const monthStart = startOfMonth(referenceDate)
  const monthEnd = endOfMonth(monthStart)
  const days = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) })

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/home', { replace: true })
    }
  }, [user, authLoading, navigate])

  const showModal = useCallback(() => {
    timerExpiredRef.current = true
    setModalOpen(true)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          showModal()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [showModal])

  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return

    function isMutationAction(el: HTMLElement): boolean {
      const text = el.textContent?.toLowerCase() || ''
      const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || ''
      const id = el.id?.toLowerCase() || ''

      const createWords = [
        'novo post', 'novo', 'criar', 'salvar', 'enviar', 'publicar',
        'assinar', 'começar grátis', 'adicionar', 'cadastrar',
      ]
      const match = createWords.some(w => text.includes(w) || ariaLabel.includes(w) || id.includes(w))
      if (match) return true

      const tag = el.tagName.toLowerCase()
      const type = el.getAttribute('type')?.toLowerCase()
      if (tag === 'button' && type === 'submit') return true
      if (tag === 'input' && ['submit', 'button'].includes(type || '')) return true

      return false
    }

    function handleCapture(e: MouseEvent) {
      if (timerExpiredRef.current) return

      const target = e.target as HTMLElement
      const inModal = target.closest('[data-slot="dialog-content"], [data-slot="dialog-overlay"]')
      if (inModal) return

      const actionEl = target.closest<HTMLElement>('button, a, [role="button"], input, textarea, select')
      if (!actionEl) return

      if (actionEl.closest('[data-demo-nav]')) return

      if (isMutationAction(actionEl)) {
        e.stopPropagation()
        e.preventDefault()
        showModal()
      }
    }

    root.addEventListener('click', handleCapture, { capture: true })
    return () => root.removeEventListener('click', handleCapture, { capture: true })
  }, [showModal])

  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return

    function handleSubmit(e: SubmitEvent) {
      if (timerExpiredRef.current) return
      e.preventDefault()
      e.stopPropagation()
      showModal()
    }

    root.addEventListener('submit', handleSubmit, { capture: true })
    return () => root.removeEventListener('submit', handleSubmit, { capture: true })
  }, [showModal])

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60)
    const sec = s % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  const getPostsForDay = (day: Date) => mockPosts.filter(p => isSameDay(new Date(p.scheduledAt), day))

  const totalPosts = mockPosts.length
  const statusCounts = mockPosts.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1
    return acc
  }, {})
  const pendingCount = statusCounts.aguardando || 0
  const approvedCount = statusCounts.aprovado || 0
  const alteracaoCount = statusCounts.alteracao || 0
  const publishedCount = statusCounts.publicado || 0
  const pendencias = mockPosts.filter(p => !['aprovado', 'publicado', 'rascunho'].includes(p.status))
  const openCards = mockCards.filter(c => c.status !== 'aprovado').length
  const overdueCards = mockCards.filter(c => new Date(c.deadline) < new Date() && c.status !== 'aprovado').length

  return (
    <div className="flex h-screen bg-background" ref={guardRef}>
      {/* Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col z-50 h-screen bg-card border-r border-border sticky top-0 transition-all duration-300',
          sidebarExpanded ? 'w-56 px-4' : 'w-16 items-center',
        )}
      >
        <div className={cn('flex items-center w-full h-14 mb-4', sidebarExpanded ? 'justify-between' : 'justify-center')}>
          {sidebarExpanded ? (
            <>
              <Brand variant="text" height={24} />
              <PanelLeftClose size={18} className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors" onClick={() => setSidebarExpanded(false)} />
            </>
          ) : (
            <Brand variant="icon" height={28} className="cursor-pointer" onClick={() => setSidebarExpanded(true)} />
          )}
        </div>

        <button
          className={cn(
            'flex items-center justify-center gap-2 mb-6 rounded-xl bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover transition-all',
            sidebarExpanded ? 'w-full h-10' : 'w-10 h-10',
          )}
        >
          <Plus size={18} />
          {sidebarExpanded && <span className="text-sm font-medium">Novo Post</span>}
        </button>

        <nav className="flex flex-col gap-1 w-full">
          {NAV_ITEMS_MOCK.map((item) => {
            const Icon = item.icon
            const isActive = activeView === item.key
            return (
              <button
                key={item.key}
                data-demo-nav
                onClick={() => setActiveView(item.key)}
                className={cn(
                  'flex items-center h-10 rounded-xl transition-all duration-200',
                  sidebarExpanded ? 'justify-start px-3 gap-3' : 'justify-center w-10 mx-auto',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground font-medium',
                )}
              >
                <Icon size={20} strokeWidth={isActive ? 2 : 1.75} className="shrink-0" />
                {sidebarExpanded && <span className="text-sm truncate">{item.label}</span>}
              </button>
            )
          })}
        </nav>

        <div className="flex-1" />

        <div className="w-full pt-4 border-t border-border mt-4">
          <button
            className={cn(
              'flex items-center h-10 rounded-xl transition-all duration-200',
              sidebarExpanded ? 'justify-start px-3 gap-3' : 'justify-center w-10 mx-auto',
              'text-muted-foreground hover:bg-secondary/80 hover:text-foreground font-medium',
            )}
          >
            <Settings size={20} strokeWidth={1.75} className="shrink-0" />
            {sidebarExpanded && <span className="text-sm">Ajustes</span>}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-40 flex items-center h-14 px-4 gap-3 bg-card border-b border-border w-full">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              Demonstração
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {formatTime(timeLeft)}
            </span>
          </div>

          <div className="flex-1" />

          <Button size="icon" variant="ghost">
            <Bell size={18} strokeWidth={1.75} />
          </Button>

          <AppAvatar name="Visitante" size="sm" color="#374151" />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {activeView === 'home' && (
            <div className="flex flex-col gap-6 p-4 md:p-8 max-w-[1800px] mx-auto pb-24">
              <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold">Olá, Visitante!</h1>
                <p className="text-sm text-muted-foreground">Visão geral dos posts e métricas do mês</p>
              </header>

              {/* Métricas */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard icon={Layers} label="Total de posts" value={totalPosts} color="bg-primary/10 text-primary" />
                <MetricCard icon={Clock} label="Pendentes" value={pendingCount} color="bg-amber-500/10 text-amber-600" />
                <MetricCard icon={CheckCircle} label="Aprovados" value={approvedCount} color="bg-emerald-500/10 text-emerald-600" />
                <MetricCard icon={AlertCircle} label="Alterações" value={alteracaoCount} color="bg-rose-500/10 text-rose-600" />
                <MetricCard icon={TrendingUp} label="Publicados" value={publishedCount} color="bg-blue-500/10 text-blue-600" />
                <MetricCard icon={Users} label="Clientes" value={CLIENTS.length} color="bg-gray-100 text-gray-600" />
                <MetricCard icon={MessageSquare} label="Feedbacks" value={mockActivities.length} color="bg-sky-500/10 text-sky-600" />
                <MetricCard icon={FileText} label="Cards abertos" value={openCards} color="bg-orange-500/10 text-orange-600" />
              </div>

              {/* Status bars */}
              <section className="bg-card border border-border rounded-xl p-5">
                <h2 className="text-sm font-bold mb-4">Posts por status</h2>
                <div className="flex flex-col gap-3">
                  {Object.entries(STATUS_MAP).map(([key, meta]) => {
                    const count = statusCounts[key] || 0
                    const pct = totalPosts > 0 ? (count / totalPosts) * 100 : 0
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <div className={cn('w-2 h-2 rounded-full shrink-0', meta.color)} />
                        <span className="text-xs text-muted-foreground w-20 shrink-0">{meta.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-secondary/50 overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all duration-500', meta.color)} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-semibold w-8 text-right">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* Calendar + sidebar */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
                <div className="bg-card border border-border rounded-xl p-4">
                  <MonthView
                    days={days}
                    referenceDate={referenceDate}
                    selectedDay={selectedDay}
                    getPostsForDay={getPostsForDay}
                    onDayClick={(day) => setSelectedDay(day)}
                    onDayDoubleClick={(day) => navigate(`/posts/novo?date=${day.toISOString().split('T')[0]}`)}
                    onPostClick={() => {}}
                  />
                </div>

                <aside className="flex flex-col gap-4">
                  {overdueCards > 0 && (
                    <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle size={16} className="text-destructive" />
                        <span className="text-sm font-semibold text-destructive">Cards atrasados</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{overdueCards} cards passaram do prazo</p>
                      <button className="text-xs font-bold text-destructive mt-2 flex items-center gap-1 hover:underline">
                        Ver cards <ChevronRight size={12} />
                      </button>
                    </div>
                  )}

                  <section>
                    <h3 className="text-sm font-bold text-muted-foreground uppercase mb-3 flex items-center gap-2">
                      <AlertCircle size={16} className="text-warning" /> Pendências
                    </h3>
                    <div className="flex flex-col gap-2">
                      {pendencias.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma pendência.</p>
                      ) : (
                        pendencias.slice(0, 3).map(p => (
                          <div key={p.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 hover:shadow-sm transition-shadow">
                            <div className={cn('w-2 h-2 rounded-full shrink-0',
                              p.status === 'aguardando' ? 'bg-amber-500' : 'bg-rose-500'
                            )} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{p.clientName}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {p.status === 'aguardando' ? 'Pendente · Aguardando aprovação' : 'Alteração solicitada'}
                              </p>
                            </div>
                            <CheckCircle2 size={14} className="text-muted-foreground/40 shrink-0" />
                          </div>
                        ))
                      )}
                    </div>
                    {pendencias.length > 3 && (
                      <button className="text-xs font-bold text-primary mt-2 flex items-center gap-1 hover:underline">
                        Ver mais <ChevronRight size={14} />
                      </button>
                    )}
                  </section>

                  <section>
                    <h3 className="text-sm font-bold text-muted-foreground uppercase mb-3 flex items-center gap-2">
                      <MessageSquare size={16} /> Atividades
                    </h3>
                    <div className="flex flex-col gap-1.5">
                      {mockActivities.map((a, i) => (
                        <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0', a.color)}>
                            <MessageSquare size={12} className="text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium truncate">{a.author}</span>
                              <span className={cn(
                                'text-[9px] px-1 py-0.5 rounded font-medium',
                                a.role === 'cliente' && 'bg-rose-100 text-rose-700',
                                a.role === 'Sistema' && 'bg-gray-100 text-gray-600',
                                a.role === 'gestor' && 'bg-blue-100 text-blue-700',
                              )}>
                                {a.role}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground/80 mt-0.5">{a.action}</p>
                            <p className="text-[10px] text-muted-foreground/60">{a.client}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button className="text-xs font-bold text-primary mt-2 flex items-center gap-1 hover:underline">
                      Ver todas as atividades <ChevronRight size={14} />
                    </button>
                  </section>
                </aside>
              </div>
            </div>
          )}

          {activeView === 'cronograma' && (
            <div className="flex flex-col gap-6 p-4 md:p-8 max-w-[1800px] mx-auto">
              <header>
                <h1 className="text-2xl font-bold">Cronograma</h1>
                <p className="text-sm text-muted-foreground">Visualize todos os posts agendados</p>
              </header>
              <div className="bg-card border border-border rounded-xl p-4">
                <MonthView
                  days={days}
                  referenceDate={referenceDate}
                  selectedDay={selectedDay}
                  getPostsForDay={getPostsForDay}
                    onDayClick={(day) => setSelectedDay(day)}
                    onDayDoubleClick={(day) => navigate(`/posts/novo?date=${day.toISOString().split('T')[0]}`)}
                    onPostClick={() => {}}
                />
              </div>
            </div>
          )}

          {activeView === 'clientes' && (
            <div className="flex flex-col gap-6 p-4 md:p-8 max-w-[1800px] mx-auto">
              <header className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Clientes</h1>
                  <p className="text-sm text-muted-foreground">{CLIENTS.length} clientes cadastrados</p>
                </div>
              </header>
              <div className="grid md:grid-cols-3 gap-4">
                {CLIENTS.map((c) => (
                  <div key={c.name} className="bg-card border border-border rounded-xl p-5 hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: c.color }}>
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{c.name}</p>
                        <p className="text-[11px] text-muted-foreground">{c.handle}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      <span>Posts no mês: {mockPosts.filter(p => p.clientName === c.name).length}</span>
                      <span>Status: Ativo</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === 'feedbacks' && (
            <div className="flex flex-col gap-6 p-4 md:p-8 max-w-[1800px] mx-auto">
              <header>
                <h1 className="text-2xl font-bold">Feedbacks</h1>
                <p className="text-sm text-muted-foreground">Cards de feedback e solicitações dos clientes</p>
              </header>
              <div className="grid md:grid-cols-2 gap-4">
                {mockCards.map((card) => (
                  <div key={card.title} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn(
                        'text-[10px] font-bold px-1.5 py-0.5 rounded uppercase',
                        card.priority === 'alta' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning',
                      )}>
                        {card.priority}
                      </span>
                      <span className="text-[10px] text-muted-foreground">Aberto</span>
                    </div>
                    <p className="text-sm font-medium">{card.title}</p>
                  </div>
                ))}
                {mockCards.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-2 text-center py-8">Nenhum feedback pendente.</p>
                )}
              </div>
            </div>
          )}

          {activeView === 'chat' && (
            <div className="flex flex-col gap-6 p-4 md:p-8 max-w-[1800px] mx-auto">
              <header>
                <h1 className="text-2xl font-bold">Chat</h1>
                <p className="text-sm text-muted-foreground">Conversas com seus clientes</p>
              </header>
              <div className="bg-card border border-border rounded-xl p-6 text-center">
                <MessageSquare size={32} className="mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Selecione um cliente para iniciar uma conversa</p>
                <div className="flex flex-col gap-2 mt-4 max-w-sm mx-auto">
                  {CLIENTS.map((c) => (
                    <div key={c.name} className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors text-left">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: c.color }}>
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">Clique para conversar</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Bottom nav (mobile) */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around h-16 bg-card border-t border-border md:hidden">
          {NAV_ITEMS_MOCK.map((item) => {
            const Icon = item.icon
            const isActive = activeView === item.key
            return (
              <button
                key={item.key}
                data-demo-nav
                onClick={() => setActiveView(item.key)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon size={22} strokeWidth={isActive ? 2 : 1.75} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
              <Sparkles size={24} className="text-primary" />
            </div>
            <DialogTitle className="text-center text-lg">
              Crie sua conta grátis
            </DialogTitle>
            <DialogDescription className="text-center">
              Crie uma conta no PostUp para usar todas as funcionalidades.
              Leva menos de 1 minuto e não precisa de cartão de crédito.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 pt-2">
            <Button size="lg" onClick={() => navigate('/cadastro')} className="gap-2">
              <UserPlus size={18} />
              Criar Conta Grátis
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/login')} className="gap-2">
              <LogIn size={18} />
              Entrar na minha conta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: number; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', color)}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  )
}
