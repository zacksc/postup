import { ChevronLeft, ChevronRight, Plus, Grid3X3, X, Calendar, Inbox, Clock, Play, Layers, Image as ImageIcon, Circle, Paintbrush, FileText, Trash2, Loader2, CheckSquare, type LucideIcon } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge, type PostStatus } from '@/components/ui/status-badge'
import { PostCard, type Post as PostCardPost } from '@/components/post/PostCard'
import { MediaPreview } from '@/components/post/MediaPreview'
import { CalendarPostCard } from '@/components/calendar/CalendarPostCard'
import { WeekTimeGrid } from '@/components/calendar/WeekTimeGrid'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { cn, resolveThumbMedia } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, addMonths, subMonths, isSameMonth, addWeeks, subWeeks } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { deleteAllPosts } from '@/lib/post-delete'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/ui/confirm-modal'

const CLIENT_COLORS = ['#f472b6', '#34d399', '#fb923c', '#60a5fa', '#9ca3af', '#f87171']
const CLIENT_COLOR_BG: Record<string, string> = {}

function getClientColor(id: string, index: number) {
  if (!CLIENT_COLOR_BG[id]) CLIENT_COLOR_BG[id] = CLIENT_COLORS[index % CLIENT_COLORS.length]
  return CLIENT_COLOR_BG[id]
}

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const TYPE_ICONS: Record<string, LucideIcon> = {
  reels: Play,
  carrossel: Layers,
  foto: ImageIcon,
  stories: Circle,
  design: Paintbrush,
}
function typeIcon(type: string, size = 16) {
  const Icon = TYPE_ICONS[type.toLowerCase()] || ImageIcon
  return <Icon size={size} />
}

interface PostItem {
  id: string
  clientName: string
  clientColor: string
  clientHandle: string
  type: string
  caption: string
  scheduledAt: Date
  status: string
  mediaUrls: string[]
  feedbackCount?: number
  profilePhoto?: string
}

interface PostRow {
  id: string
  client_name: string | null
  client_color: string | null
  client_handle: string | null
  post_type: string | null
  caption: string | null
  scheduled_at: string
  status: string | null
  media_urls: string[] | null
}

interface ClientInfo { id: string; name: string; color: string }

export function Cronograma() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [posts, setPosts] = useState<PostItem[]>([])
  const [view, setView] = useState<'month' | 'week'>('month')
  const [refDate, setRefDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date())
  const [panelMode, setPanelMode] = useState<'summary' | 'day'>('summary')
  const [activeClients, setActiveClients] = useState<Set<string>>(new Set())
  const [mobilePreview, setMobilePreview] = useState<PostItem | null>(null)
  const [mobileDaySheet, setMobileDaySheet] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [archivedClients, setArchivedClients] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const clients = useMemo(() => {
    const map = new Map<string, ClientInfo>()
    posts.forEach((p) => {
      if (!map.has(p.clientName)) {
        map.set(p.clientName, { id: p.clientName, name: p.clientName, color: getClientColor(p.clientName, map.size) })
      }
    })
    return Array.from(map.values())
  }, [posts])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (clients.length > 0 && activeClients.size === 0) {
      setActiveClients(new Set(clients.map(c => c.id)))
    }
  }, [clients, activeClients.size])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    fetchPosts()
  }, [])

  useEffect(() => {
    const dateParam = searchParams.get('date')
    if (dateParam) {
      const d = new Date(dateParam + 'T00:00:00')
      if (!isNaN(d.getTime())) {
        setSelectedDay(d)
        setRefDate(d)
        const dp = posts.filter(p => isSameDay(new Date(p.scheduledAt), d))
        setPanelMode(dp.length > 0 ? 'day' : 'summary')
      }
    }
  }, [searchParams, posts])

  async function fetchPosts() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchErr } = await supabase.from('posts').select('*').order('scheduled_at', { ascending: true })
      if (fetchErr) throw fetchErr
      if (data) setPosts((data as PostRow[]).map((p) => ({
        id: p.id,
        clientName: p.client_name || 'Cliente',
        clientColor: p.client_color || '#374151',
        clientHandle: p.client_handle || '',
        type: (p.post_type || 'foto').toLowerCase(),
        caption: p.caption || '',
        scheduledAt: new Date(p.scheduled_at),
        status: p.status || 'aguardando',
        mediaUrls: p.media_urls || [],
        feedbackCount: 0,
      })))

      const { data: clientsData } = await supabase.from('clients').select('name, archived_at, profile_photo')
      if (clientsData) {
        setArchivedClients(new Set(clientsData.filter(c => c.archived_at).map(c => c.name)))
        const profilePhotoMap = new Map(clientsData.map(c => [c.name, c.profile_photo]))
        setPosts(prev => prev.map(p => ({ ...p, profilePhoto: profilePhotoMap.get(p.clientName) || undefined })))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar posts')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteAll() {
    setDeleting(true)
    try {
      await deleteAllPosts()
      setPosts([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao apagar posts')
    } finally {
      setDeleting(false)
    }
  }

  const today = new Date()
  const monthStart = startOfMonth(refDate)
  const monthEnd = endOfMonth(monthStart)
  const days = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) })

  const weekStart = startOfWeek(refDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  function getPostsForDay(day: Date) {
    return posts.filter(p => isSameDay(new Date(p.scheduledAt), day) && activeClients.has(p.clientName))
  }

  const stats = useMemo(() => {
    const filtered = posts.filter(p => activeClients.has(p.clientName))
    return {
      total: filtered.length,
      aprovados: filtered.filter(p => ['aprovado', 'publicado'].includes(p.status)).length,
      pendentes: filtered.filter(p => ['aguardando', 'alteracao'].includes(p.status)).length,
      publicados: filtered.filter(p => p.status === 'publicado').length,
    }
  }, [posts, activeClients])

  const alertPosts = useMemo(() => {
    return posts.filter(p => ['aguardando', 'alteracao'].includes(p.status) && activeClients.has(p.clientName))
  }, [posts, activeClients])

  function handleDayClick(day: Date) {
    setSelectedDay(day)
    const dp = getPostsForDay(day)
    setPanelMode(dp.length > 0 ? 'day' : 'summary')
    if (window.innerWidth < 768) setMobileDaySheet(true)
  }

  function handlePostClick(id: string) {
    navigate(`/posts/${id}`)
  }

  function toggleClient(id: string) {
    const next = new Set(activeClients)
    if (next.has(id) && next.size > 1) next.delete(id)
    else next.add(id)
    setActiveClients(next)
    setPanelMode('summary')
    setSelectedDay(null)
  }

  const periodLabel = view === 'month'
    ? format(refDate, "MMMM yyyy", { locale: ptBR })
    : `${format(weekStart, "dd/MM")} – ${format(weekEnd, "dd/MM/yy")}`

  const numWeeks = Math.ceil(days.length / 7)

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <button onClick={() => fetchPosts()} className="text-sm text-primary hover:underline">
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* HEADER */}
      <header className="h-14 border-b border-border flex items-center px-3 md:px-6 gap-2 md:gap-3 shrink-0 bg-card">
        <h1 className="text-sm md:text-base font-bold flex items-center gap-2 shrink-0">
          <Calendar size={18} className="shrink-0" /> Cronograma
        </h1>
      </header>

      {/* Controls bar: navigation, view toggle, grid, new post */}
      <div className="flex items-center gap-2 px-3 md:px-6 py-2 border-b border-border bg-card shrink-0 md:hidden">
        <div className="flex items-center gap-0.5 md:gap-1">
          <button onClick={() => setRefDate(view === 'month' ? subMonths(refDate, 1) : subWeeks(refDate, 1))} className="p-1 hover:bg-secondary rounded-lg text-muted-foreground">
            <ChevronLeft size={15} />
          </button>
          <span className="text-xs md:text-sm font-semibold min-w-[80px] md:min-w-[140px] text-center capitalize">{periodLabel}</span>
          <button onClick={() => setRefDate(view === 'month' ? addMonths(refDate, 1) : addWeeks(refDate, 1))} className="p-1 hover:bg-secondary rounded-lg text-muted-foreground">
            <ChevronRight size={15} />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => navigate('/grid/geral')} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-2.5 py-1.5 border border-border rounded-lg transition-colors">
            <Grid3X3 size={14} /> Grid
          </button>
          <button onClick={() => navigate('/posts/import')} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-2.5 py-1.5 border border-border rounded-lg transition-colors">
            <FileText size={14} /> Importar
          </button>
          <Button size="sm" onClick={() => navigate('/posts/novo')} className="h-7 md:h-8 text-[11px] md:text-xs font-bold gap-1 px-2 md:px-3">
            <Plus size={13} /> Novo Post
          </Button>
          {posts.length > 0 && (
            <ConfirmModal
              trigger={
                <button disabled={deleting} className="flex items-center gap-1.5 text-xs font-medium text-destructive hover:text-destructive px-2 py-1.5 border border-destructive/30 rounded-lg transition-colors disabled:opacity-50">
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Apagar
                </button>
              }
              title="Apagar todos os posts?"
              description="Todos os posts, suas mídias no Supabase Storage e no Google Drive, e todos os feedbacks serão apagados permanentemente. Essa ação não pode ser desfeita."
              confirmLabel={deleting ? 'Apagando...' : 'Apagar tudo'}
              confirmVariant="destructive"
              onConfirm={handleDeleteAll}
              loading={deleting}
            />
          )}
        </div>
      </div>

      {/* Mobile view toggle */}
      <div className="md:hidden flex items-center gap-1 px-3 py-2 border-b border-border bg-card">
        <button onClick={() => setView('month')} className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all text-center", view === 'month' ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground')}>Mensal</button>
        <button onClick={() => setView('week')} className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all text-center", view === 'week' ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground')}>Semanal</button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row">
        {/* MAIN — Calendar */}
        <div className="flex-1 flex flex-col p-3 md:p-5 gap-3">
          {/* Controls + Client chips */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Navigation */}
            <div className="hidden md:flex items-center gap-0.5">
              <button onClick={() => setRefDate(view === 'month' ? subMonths(refDate, 1) : subWeeks(refDate, 1))} className="p-1 hover:bg-secondary rounded-lg text-muted-foreground">
                <ChevronLeft size={15} />
              </button>
              <span className="text-xs md:text-sm font-semibold min-w-[80px] md:min-w-[140px] text-center capitalize">{periodLabel}</span>
              <button onClick={() => setRefDate(view === 'month' ? addMonths(refDate, 1) : addWeeks(refDate, 1))} className="p-1 hover:bg-secondary rounded-lg text-muted-foreground">
                <ChevronRight size={15} />
              </button>
            </div>

            {/* Client chips */}
            {clients.filter(c => !archivedClients.has(c.name)).map(c => {
              const active = activeClients.has(c.id)
              return (
                <button
                  key={c.id}
                  onClick={() => toggleClient(c.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium border transition-all",
                    active ? 'text-foreground' : 'text-muted-foreground border-border opacity-50'
                  )}
                  style={active ? { backgroundColor: `${c.color}18`, borderColor: `${c.color}40` } : {}}
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                  {c.name}
                </button>
              )
            })}

            {/* Spacer */}
            <div className="hidden md:block flex-1" />

            {/* View toggle + Grid + New post (desktop) */}
            <div className="hidden md:flex items-center gap-2">
              <div className="bg-secondary rounded-lg p-0.5 border border-border">
                <button onClick={() => setView('month')} className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all", view === 'month' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>Mensal</button>
                <button onClick={() => setView('week')} className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all", view === 'week' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>Semanal</button>
              </div>
              <button onClick={() => navigate('/grid/geral')} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-2.5 py-1.5 border border-border rounded-lg transition-colors">
                <Grid3X3 size={14} /> Grid
              </button>
              <Button size="sm" onClick={() => navigate('/posts/novo')} className="h-7 md:h-8 text-[11px] md:text-xs font-bold gap-1 px-2 md:px-3">
                <Plus size={13} /> Novo Post
              </Button>
              {posts.length > 0 && (
                <>
                  {!selectMode ? (
                    <button 
                      onClick={() => setSelectMode(true)}
                      className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-2.5 py-1.5 border border-border rounded-lg transition-colors"
                    >
                      <CheckSquare size={14} /> Selecionar posts
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          const allIds = posts.map(p => p.id)
                          const allSelected = allIds.every(id => selectedIds.has(id))
                          setSelectedIds(allSelected ? new Set() : new Set(allIds))
                        }}
                        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-2.5 py-1.5 border border-border rounded-lg transition-colors"
                      >
                        <CheckSquare size={14} /> {selectedIds.size === posts.length ? 'Desmarcar tudo' : 'Selecionar tudo'}
                      </button>
                      {selectedIds.size > 0 && (
                        <ConfirmModal
                          trigger={
                            <button disabled={deleting} className="flex items-center gap-1.5 text-xs font-medium text-destructive hover:text-destructive px-2.5 py-1.5 border border-destructive/30 rounded-lg transition-colors disabled:opacity-50">
                              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Apagar ({selectedIds.size})
                            </button>
                          }
                          title={`Apagar ${selectedIds.size} posts?`}
                          description="Os posts selecionados serão apagados permanentemente. Essa ação não pode ser desfeita."
                          confirmLabel={deleting ? 'Apagando...' : 'Apagar'}
                          confirmVariant="destructive"
                          onConfirm={async () => {
                            setDeleting(true)
                            try {
                              for (const id of selectedIds) {
                                await supabase.from('posts').delete().eq('id', id)
                              }
                              toast.success(`${selectedIds.size} posts apagados`)
                              setSelectedIds(new Set())
                              setSelectMode(false)
                              fetchPosts()
                            } catch {
                              toast.error('Erro ao apagar posts')
                            } finally {
                              setDeleting(false)
                            }
                          }}
                          loading={deleting}
                        />
                      )}
                      <button 
                        onClick={() => { setSelectMode(false); setSelectedIds(new Set()) }}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Calendar grid */}
          <div className="flex-1 min-h-0" onClick={() => { setSelectedDay(null); setPanelMode('summary') }}>
            {view === 'month' ? (
              <div className="grid grid-cols-7 gap-px bg-border border border-border rounded-xl overflow-hidden md:h-full shadow-sm" style={{ gridTemplateRows: `auto repeat(${numWeeks}, 1fr)` }}>
                {DAY_NAMES.map(d => (
                  <div key={d} className="bg-card px-2 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-center">{d}</div>
                ))}
                {days.map((day, i) => {
                  const dp = getPostsForDay(day)
                  const isToday = isSameDay(day, today)
                  const isSelected = selectedDay && isSameDay(day, selectedDay)
                  const isCurrentMonth = isSameMonth(day, refDate)
                  const dayNum = day.getDate()
                  return (
                    <div
                      key={i}
                      onClick={(e) => { e.stopPropagation(); handleDayClick(day) }}
                      className={cn(
                        "bg-card p-1.5 cursor-pointer transition-colors flex flex-col gap-0.5 overflow-hidden",
                        "aspect-square md:aspect-auto",
                        isSelected && "bg-muted/40 ring-1 ring-primary ring-inset",
                        !isCurrentMonth && "opacity-30"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 flex items-center justify-center text-xs font-medium shrink-0",
                        isToday && "bg-primary text-primary-foreground rounded-full"
                      )}>
                        {dayNum}
                      </div>
                      {/* Mobile: bolinhas indicativas */}
                      <div className="md:hidden flex items-center gap-1 flex-wrap">
                        {dp.slice(0, 3).map(p => (
                          <div
                            key={p.id}
                            onClick={(e) => { e.stopPropagation(); handlePostClick(p.id) }}
                            className="w-2 h-2 rounded-full cursor-pointer transition-transform hover:scale-125"
                            style={{ backgroundColor: p.clientColor }}
                          />
                        ))}
                        {dp.length > 3 && (
                          <span className="text-[8px] text-muted-foreground">+{dp.length - 3}</span>
                        )}
                      </div>
                      {/* Desktop: mini-cards com informações */}
                      <div className="hidden md:flex flex-col gap-0.5 overflow-hidden flex-1 min-h-0">
                        {(() => {
                          const sorted = [...dp].sort((a, b) => {
                            const urgencyOrder: Record<string, number> = { alteracao: 0, aguardando: 1 }
                            const ua = urgencyOrder[a.status] ?? 2
                            const ub = urgencyOrder[b.status] ?? 2
                            if (ua !== ub) return ua - ub
                            return a.scheduledAt.getTime() - b.scheduledAt.getTime()
                          })
                          return sorted.slice(0, 3).map(p => (
                            <CalendarPostCard
                              key={p.id}
                              post={p}
                              onClick={() => handlePostClick(p.id)}
                              selectMode={selectMode}
                              selected={selectedIds.has(p.id)}
                              onToggleSelect={() => {
                                setSelectedIds(prev => {
                                  const next = new Set(prev)
                                  if (next.has(p.id)) next.delete(p.id)
                                  else next.add(p.id)
                                  return next
                                })
                              }}
                            />
                          ))
                        })()}
                        {dp.length > 3 && (
                          <div className="text-[9px] font-medium text-muted-foreground px-1 hover:text-foreground cursor-pointer" onClick={(e) => { e.stopPropagation(); handleDayClick(day) }}>
                            +{dp.length - 3} mais
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <WeekTimeGrid
                days={weekDays}
                posts={posts.filter(p => activeClients.has(p.clientName)).map(p => ({
                  id: p.id,
                  clientName: p.clientName,
                  clientColor: p.clientColor,
                  type: p.type,
                  caption: p.caption,
                  scheduledAt: p.scheduledAt,
                  status: p.status,
                  mediaUrls: p.mediaUrls,
                }))}
                onPostClick={handlePostClick}
                onSlotClick={(day, hour) => {
                  const dateStr = day.toISOString().split('T')[0]
                  const timeStr = `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.round((hour % 1) * 60)).padStart(2, '0')}`
                  navigate(`/posts/novo?date=${dateStr}&time=${timeStr}`)
                }}
              />
            )}
          </div>
        </div>

        {/* PANEL — Sidebar */}
        <aside className="hidden md:flex w-[320px] border-l border-border bg-card flex-col overflow-hidden shrink-0">
          <div className="px-4 py-3 border-b border-border shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {panelMode === 'summary' ? 'Visão geral' : (selectedDay && isSameDay(selectedDay, today) ? 'Hoje' : 'Dia selecionado')}
            </p>
            <p className="text-sm font-semibold mt-0.5">
              {panelMode === 'summary' && format(refDate, "MMMM yyyy", { locale: ptBR })}
              {panelMode === 'day' && selectedDay && format(selectedDay, "d 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
          <div className="flex-1 p-4 space-y-4">
            {/* SUMMARY */}
            {panelMode === 'summary' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-secondary/30 border border-border rounded-xl p-3">
                    <p className="text-xl font-bold">{stats.total}</p>
                    <p className="text-[10px] text-muted-foreground">Criados</p>
                  </div>
                  <div className="bg-secondary/30 border border-border rounded-xl p-3">
                    <p className="text-xl font-bold text-emerald-500">{stats.aprovados}</p>
                    <p className="text-[10px] text-muted-foreground">Aprovados</p>
                  </div>
                  <div className="bg-secondary/30 border border-border rounded-xl p-3">
                    <p className="text-xl font-bold text-orange-500">{stats.pendentes}</p>
                    <p className="text-[10px] text-muted-foreground">Pendentes</p>
                  </div>
                  <div className="bg-secondary/30 border border-border rounded-xl p-3">
                    <p className="text-xl font-bold text-blue-500">{stats.publicados}</p>
                    <p className="text-[10px] text-muted-foreground">Publicados</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Precisam de atenção</p>
                  {alertPosts.length > 0 ? (
                    <div className="space-y-2">
                      {alertPosts.map(p => (
                        <PostCard
                          key={p.id}
                          post={{
                            id: p.id,
                            type: p.type as PostCardPost['type'],
                            caption: p.caption,
                            scheduled_at: format(p.scheduledAt, 'yyyy-MM-dd'),
                            status: (p.status === 'alteracao' ? 'em_alteracao' : p.status) as PostCardPost['status'],
                            client: { name: p.clientName, color: p.clientColor },
                            files: p.mediaUrls.map(url => ({ url })),
                          }}
                          variant="list"
                          onClick={() => handlePostClick(p.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-6">Nada pendente</p>
                  )}
                </div>
              </>
            )}

            {/* DAY */}
            {panelMode === 'day' && selectedDay && (
              <>
                {getPostsForDay(selectedDay).length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {getPostsForDay(selectedDay).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handlePostClick(p.id)}
                        className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
                      >
                        <div className="flex gap-2 p-2">
                          <div className="shrink-0 w-16 md:w-20 aspect-square rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                            {(() => {
                              const { url: thumbUrl, poster: thumbPoster } = resolveThumbMedia(p.mediaUrls)
                              return thumbUrl ? (
                                <MediaPreview url={thumbUrl} poster={thumbPoster} thumbnail className="w-full h-full" />
                              ) : (
                                <span className="text-lg opacity-30">{typeIcon(p.type, 20)}</span>
                              )
                            })()}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold truncate">{p.clientName}</span>
                              <span className="text-[9px] font-mono text-muted-foreground ml-auto shrink-0 flex items-center gap-1">
                                <Clock size={10} />
                                {format(p.scheduledAt, 'HH:mm')}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">{p.caption}</p>
                            <div className="flex items-center gap-1.5 pt-0.5">
                              <span className={cn("text-[8px] px-1.5 py-0.5 rounded font-bold border", {
                                'bg-blue-500/10 text-blue-500 border-blue-500/20': p.status === 'publicado',
                                'bg-emerald-500/10 text-emerald-500 border-emerald-500/20': p.status === 'aprovado',
                                'bg-orange-500/10 text-orange-500 border-orange-500/20': p.status === 'aguardando',
                                'bg-red-500/10 text-red-500 border-red-500/20': p.status === 'alteracao',
                                'bg-muted/10 text-muted-foreground border-muted/20': p.status === 'rascunho',
                              })}>
                                {p.status === 'publicado' ? 'Publicado' : p.status === 'aprovado' ? 'Aprovado' : p.status === 'aguardando' ? 'Aguardando' : p.status === 'alteracao' ? 'Alteração' : 'Rascunho'}
                              </span>
                              <span className="text-[8px] text-muted-foreground uppercase tracking-wider bg-secondary/30 px-1.5 py-0.5 rounded">{p.type}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
                    <Inbox size={40} className="opacity-30" />
                    <p className="text-xs text-center">Nenhum post agendado<br />para este dia.</p>
                    <button onClick={() => navigate(`/posts/novo?date=${format(selectedDay, 'yyyy-MM-dd')}`)} className="text-xs font-medium text-primary border border-dashed border-primary/30 rounded-lg px-4 py-2 hover:bg-primary/5 transition-colors">
                      <Plus size={14} /> Criar post para {format(selectedDay, "dd/MM")}
                    </button>
                  </div>
                )}
              </>
            )}

          </div>
        </aside>

      {/* MOBILE — bottom sheet do dia */}
      <BottomSheet
        open={mobileDaySheet}
        onOpenChange={(open) => { if (!open) setMobileDaySheet(false) }}
        title={selectedDay ? format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR }) : ''}
      >
        {selectedDay && (() => {
          const dayPosts = getPostsForDay(selectedDay)
          if (dayPosts.length === 0) {
            return (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">Nenhum post agendado para este dia.</p>
                <Button size="sm" onClick={() => { setMobileDaySheet(false); navigate(`/posts/novo?date=${format(selectedDay, 'yyyy-MM-dd')}`) }}>
                  <Plus size={14} /> Criar post para {format(selectedDay, "dd/MM")}
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
                    type: p.type as PostCardPost['type'],
                    caption: p.caption,
                    scheduled_at: format(p.scheduledAt, 'yyyy-MM-dd'),
                    status: (p.status === 'alteracao' ? 'em_alteracao' : p.status) as PostCardPost['status'],
                    client: { name: p.clientName, color: p.clientColor },
                    files: p.mediaUrls.map(url => ({ url })),
                  }}
                  variant="list"
                  onClick={() => { setMobileDaySheet(false); setMobilePreview(p) }}
                />
              ))}
            </div>
          )
        })()}
      </BottomSheet>
      </div>

      {/* MOBILE — post preview dialog */}
      <Dialog open={!!mobilePreview} onOpenChange={(open) => { if (!open) setMobilePreview(null) }}>
        <DialogContent className="max-w-sm p-0 gap-0 rounded-2xl overflow-hidden">
          {mobilePreview && (
            <div className="flex flex-col">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <StatusBadge status={mobilePreview.status as PostStatus} />
                <button onClick={() => setMobilePreview(null)} className="p-1 hover:bg-secondary rounded-full text-muted-foreground">
                  <X size={16} />
                </button>
              </div>
              <div className="px-4 pb-4">
                <PostCard
                  post={{
                    id: mobilePreview.id,
                    type: mobilePreview.type as PostCardPost['type'],
                    caption: mobilePreview.caption,
                    scheduled_at: format(mobilePreview.scheduledAt, 'yyyy-MM-dd'),
                    status: mobilePreview.status as PostCardPost['status'],
                    client: { name: mobilePreview.clientName, color: mobilePreview.clientColor },
                    files: mobilePreview.mediaUrls.map(url => ({ url })),
                  }}
                  variant="list"
                  onClick={() => { setMobilePreview(null); navigate(`/posts/${mobilePreview.id}`) }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
