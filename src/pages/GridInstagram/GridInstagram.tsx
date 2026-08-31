import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Client } from '@/types/client'
import { useAuth } from '@/hooks/use-auth'
import { cn, isVideoUrl, resolveThumbMedia } from '@/lib/utils'
import { compressPostMediaAndReupload } from '@/lib/compress-image'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { MediaPreview } from '@/components/post/MediaPreview'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Play, Layers, Image, Circle, Paintbrush, Link, Calendar, Tag, Copy, RefreshCw, MessageSquare, Camera, Edit3, Upload, Check, MousePointer2, ChevronRight, Loader2, Grid3x3, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FeedbackDialog } from '@/components/feedback/FeedbackDialog'
import IgProfileMockup from '@/components/instagram/IgProfileMockup'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'

interface GridPost {
  id: string
  client_id: string
  client_name: string
  status: string
  post_type: string
  caption: string
  scheduled_at: string
  media_urls: string[]
}

const BASE_URL = import.meta.env.VITE_APP_URL || window.location.origin

const TYPE_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  reels: Play,
  carrossel: Layers,
  foto: Image,
  stories: Circle,
  design: Paintbrush,
}
function typeIcon(type: string, size = 16) {
  const Icon = TYPE_ICONS[type.toLowerCase()] || Image
  return <Icon size={size} />
}
const STATUS_COLORS: Record<string, string> = {
  publicado: '#60a5fa',
  aprovado: '#34d399',
  aguardando: '#fb923c',
  alteracao: '#f87171',
  rascunho: '#6b7080',
}
const STATUS_LABELS: Record<string, string> = {
  publicado: 'Publicado', aprovado: 'Aprovado', aguardando: 'Aguardando', alteracao: 'Em alteração', rascunho: 'Rascunho',
}
const STATUS_CLASS: Record<string, string> = {
  publicado: 'bg-blue-500', aprovado: 'bg-emerald-500', aguardando: 'bg-orange-500', alteracao: 'bg-red-500', rascunho: 'bg-muted-foreground',
}

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(new Date().getFullYear(), i, 1)
  return { value: i, label: format(d, 'MMMM yyyy', { locale: ptBR }) }
})

export default function GridInstagramPage() {
  const navigate = useNavigate()
  const { clientId } = useParams()
  const { user } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState(clientId || '')
  const [posts, setPosts] = useState<GridPost[]>([])
  const [selectedPost, setSelectedPost] = useState<GridPost | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear] = useState(new Date().getFullYear())
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [showIgPreview, setShowIgPreview] = useState(false)
  const [showNewPostConfirm, setShowNewPostConfirm] = useState(false)
  const [fbPostId, setFbPostId] = useState<string | null>(null)
  const [, setLoadingClients] = useState(true)
  const [, setLoadingPosts] = useState(true)
  const [, setErrorClients] = useState<string | null>(null)
  const [, setErrorPosts] = useState<string | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [pendingSwap, setPendingSwap] = useState<{ dragPost: GridPost; dropPost: GridPost } | null>(null)
  const [mobileNewDate, setMobileNewDate] = useState('')
  const [postTypeFilter, setPostTypeFilter] = useState<'all' | 'feed' | 'stories'>('all')

  useEffect(() => {
    let clientQuery = supabase.from('clients').select('id, name, handle, bio, followers, following, profile_photo, review_token')
    if (user) clientQuery = clientQuery.eq('user_id', user.id)
    clientQuery.then(({ data, error }) => {
      if (error) setErrorClients(error.message)
      else if (data) setClients(data as Client[])
      setLoadingClients(false)
    })
  }, [user])

  useEffect(() => {
    if (!selectedClientId || selectedClientId === 'geral') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPosts([])
      return
    }
    const monthStart = startOfMonth(new Date(selectedYear, selectedMonth))
    const monthEnd = endOfMonth(monthStart)
    let query = supabase
      .from('posts')
      .select('*')
      .eq('client_id', selectedClientId)
      .gte('scheduled_at', monthStart.toISOString())
      .lte('scheduled_at', monthEnd.toISOString())
      .order('scheduled_at', { ascending: false })
    // Filtrar por tipo de post se necessário
    if (postTypeFilter === 'feed') {
      query = query.not('post_type', 'eq', 'stories')
    } else if (postTypeFilter === 'stories') {
      query = query.eq('post_type', 'stories')
    }
    query.then(({ data, error }) => {
        if (error) setErrorPosts(error.message)
        else setPosts((data || []) as GridPost[])
        setLoadingPosts(false)
      })
  }, [selectedClientId, selectedMonth, selectedYear, postTypeFilter])

  const client = clients.find(c => c.id === selectedClientId)

  const stats = useMemo(() => {
    const total = posts.length
    const publicado = posts.filter(p => p.status === 'publicado').length
    const aprovado = posts.filter(p => p.status === 'aprovado').length
    const pendentes = posts.filter(p => ['aguardando', 'alteracao', 'rascunho'].includes(p.status)).length
    return { total, publicado, aprovado, pendentes }
  }, [posts])

  const GRID_SIZE = Math.max(12, Math.ceil(posts.length / 3) * 3)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  async function handleDndEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveDragId(null)
    if (!active || !over || active.id === over.id) return
    const dragPost = posts.find((p: GridPost) => p.id === active.id)
    const dropPost = posts.find((p: GridPost) => p.id === over.id)
    if (!dragPost || !dropPost) return
    setPendingSwap({ dragPost, dropPost })
  }

  async function executeSwap(dragPost: GridPost, dropPost: GridPost) {
    const tempDate = dragPost.scheduled_at
    const { error: err1 } = await supabase.from('posts').update({ scheduled_at: dropPost.scheduled_at, user_id: user?.id }).eq('id', dragPost.id)
    const { error: err2 } = await supabase.from('posts').update({ scheduled_at: tempDate, user_id: user?.id }).eq('id', dropPost.id)
    if (err1 || err2) {
      toast.error('Erro ao reorganizar grid')
      return
    }
    setPosts(prev => {
      const updated = [...prev]
      const aIdx = updated.findIndex((p: GridPost) => p.id === dragPost.id)
      const bIdx = updated.findIndex((p: GridPost) => p.id === dropPost.id)
      if (aIdx >= 0) updated[aIdx] = { ...updated[aIdx], scheduled_at: dropPost.scheduled_at }
      if (bIdx >= 0) updated[bIdx] = { ...updated[bIdx], scheduled_at: tempDate }
      updated.sort((a: GridPost, b: GridPost) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
      return updated
    })
    toast.success('Grid reorganizado!')
  }

  async function handleApprove() {
    if (!selectedPost) return
    await supabase.from('posts').update({ status: 'aprovado', user_id: user?.id }).eq('id', selectedPost.id)
    setPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, status: 'aprovado' } : p))
    setSelectedPost((prev: GridPost | null) => prev ? { ...prev, status: 'aprovado' } : null)
    toast.success('Post aprovado!')
  }

  async function handleMobileReschedule(newDate: string) {
    if (!selectedPost || !newDate) return
    const current = new Date(selectedPost.scheduled_at)
    const [y, m, d] = newDate.split('-').map(Number)
    current.setFullYear(y, m - 1, d)
    const { error } = await supabase.from('posts').update({ scheduled_at: current.toISOString(), user_id: user?.id }).eq('id', selectedPost.id)
    if (error) { toast.error('Erro ao reagendar'); return }
    setPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, scheduled_at: current.toISOString() } : p))
    setSelectedPost(prev => prev ? { ...prev, scheduled_at: current.toISOString() } : null)
    setMobileNewDate('')
    toast.success('Post reagendado!')
  }

  async function handleMobileSwap(target: GridPost) {
    if (!selectedPost) return
    const temp = selectedPost.scheduled_at
    const { error: e1 } = await supabase.from('posts').update({ scheduled_at: target.scheduled_at, user_id: user?.id }).eq('id', selectedPost.id)
    const { error: e2 } = await supabase.from('posts').update({ scheduled_at: temp, user_id: user?.id }).eq('id', target.id)
    if (e1 || e2) { toast.error('Erro ao trocar os dias'); return }
    setPosts(prev => {
      const updated = prev.map(p => {
        if (p.id === selectedPost.id) return { ...p, scheduled_at: target.scheduled_at }
        if (p.id === target.id) return { ...p, scheduled_at: temp }
        return p
      })
      updated.sort((a: GridPost, b: GridPost) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
      return updated
    })
    setSelectedPost(prev => prev ? { ...prev, scheduled_at: target.scheduled_at } : null)
    toast.success('Dias trocados!')
  }

  const monthLabel = format(new Date(selectedYear, selectedMonth), "'Grid de' MMMM yyyy", { locale: ptBR })

  return (
    <div className="flex flex-col h-dvh bg-background overflow-hidden">
      {/* HEADER */}
      <header className="h-14 border-b border-border flex items-center px-4 md:px-6 gap-3 shrink-0 bg-card">
        <button onClick={() => navigate('/cronograma')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} /> Voltar
        </button>
        <div className="h-4 w-px bg-border" />
        <span className="text-sm font-medium truncate">Grid Instagram</span>
        <div className="ml-auto hidden md:flex items-center gap-3">
          <Select
            value={selectedClientId}
            onValueChange={(v) => { setSelectedClientId(v); setSelectedPost(null) }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione um cliente..." />
            </SelectTrigger>
            <SelectContent>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(selectedMonth)}
            onValueChange={(v) => { setSelectedMonth(Number(v)); setSelectedPost(null) }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => (
                <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* DESKTOP LAYOUT — 3 colunas iguais */}
      <div className="hidden md:flex flex-1 min-h-0 overflow-hidden">
        {/* COL 1 — Phone mockup */}
        <div className="flex-1 min-w-0 border-r border-border flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border shrink-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{client?.name || 'Cliente'}</p>
              <p className="text-[11px] text-muted-foreground">{monthLabel} · {posts.length} posts</p>
            </div>
          </div>
          <div className="px-4 py-2 border-b border-border flex items-center gap-x-3 gap-y-1 flex-wrap shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Legenda</span>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <span key={key} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className={cn("w-2.5 h-2.5 rounded-full", STATUS_CLASS[key])} /> {label}
              </span>
            ))}
            <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tipo</span>
            <div className="flex items-center gap-1">
              {(['all', 'feed', 'stories'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setPostTypeFilter(type)}
                  className={cn(
                    "px-2 py-1 rounded text-[10px] font-medium transition-colors",
                    postTypeFilter === type
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {type === 'all' ? 'Todos' : type === 'feed' ? 'Feed' : 'Stories'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 flex justify-center p-5 overflow-y-auto bg-gradient-to-b from-primary/[0.02] to-background">
            <div className="w-[300px] shrink-0">
              {/* Phone frame */}
              <div className="rounded-[32px] overflow-hidden border-[3px] border-[#222] shadow-2xl bg-black">
                {/* Notch */}
                <div className="h-8 bg-black flex items-center justify-center relative shrink-0">
                  <div className="w-[80px] h-1 rounded-full bg-white/20" />
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[20px] bg-black rounded-b-2xl" />
                </div>
                {/* IG profile header */}
                <div className="bg-white px-4 pt-4 pb-3 shrink-0">
                  <div className="flex items-center gap-3 mb-3">
                    {client?.profile_photo ? (
                      <img src={client.profile_photo} alt="" className="w-[56px] h-[56px] rounded-full object-cover shrink-0 border-2 border-border" />
                    ) : (
                      <div className="w-[56px] h-[56px] rounded-full bg-gradient-to-br from-muted to-muted-foreground flex items-center justify-center text-white font-bold text-base shrink-0">
                        {client?.name?.charAt(0) || '?'}
                      </div>
                    )}
                    <div className="flex flex-1 justify-around">
                      <div className="flex flex-col items-center"><span className="text-[14px] font-bold text-foreground">{posts.length}</span><span className="text-[10px] text-muted-foreground">posts</span></div>
                      <div className="flex flex-col items-center"><span className="text-[14px] font-bold text-foreground">{client?.followers ?? '—'}</span><span className="text-[10px] text-muted-foreground">seg.</span></div>
                      <div className="flex flex-col items-center"><span className="text-[14px] font-bold text-foreground">{client?.following ?? '—'}</span><span className="text-[10px] text-muted-foreground">seg.</span></div>
                    </div>
                  </div>
                  <p className="text-[12px] font-bold text-black">{client?.name || 'Cliente'}</p>
                  {client?.bio && <p className="text-[11px] text-muted-foreground leading-snug mb-2">{client.bio}</p>}
                  {!client?.bio && <p className="text-[11px] text-muted-foreground leading-snug mb-2 flex items-center gap-1">Agendamento de conteúdo <Calendar size={11} /></p>}
                  <div className="w-full py-2 text-center text-[12px] font-semibold bg-primary/10 border border-primary/30 rounded-lg text-primary hover:bg-primary/20 transition-colors cursor-pointer">Seguir</div>
                </div>
                {/* IG tabs */}
                <div className="flex bg-card border-t border-border shrink-0">
                  <div className="flex-1 flex items-center justify-center py-2.5 border-b-2 border-foreground text-foreground text-lg">⊞</div>
                  <div className="flex-1 flex items-center justify-center py-2.5 text-muted-foreground"><Tag size={20} /></div>
                </div>
                {/* Grid — scrollável se > 12 posts */}
                <DndContext sensors={sensors} onDragStart={(e) => setActiveDragId(e.active.id as string)} onDragEnd={handleDndEnd}>
                  <div className="overflow-y-auto max-h-[420px] scrollbar-thin">
                    <div className="grid grid-cols-3 gap-[1px] bg-border">
                      {Array.from({ length: GRID_SIZE }).map((_, i) => {
                        const p = posts[i]
                        return (
                          <GridDroppableCell key={p?.id || `empty-${i}`} id={p?.id || `empty-${i}`} isEmpty={!p}>
                            {p ? (
                              <GridDraggablePost
                                post={p}
                                isActive={activeDragId === p.id}
                                onClick={() => setSelectedPost(p)}
                              />
                            ) : (
                              <div
                                onClick={() => setShowNewPostConfirm(true)}
                                className="aspect-[4/5] bg-secondary flex items-center justify-center text-muted-foreground border border-dashed border-border hover:bg-secondary/80 hover:text-muted-foreground transition-colors cursor-pointer"
                              >
                                <span className="text-lg">+</span>
                              </div>
                            )}
                          </GridDroppableCell>
                        )
                      })}
                    </div>
                  </div>
                  <div className="bg-card px-3 pb-3 pt-1.5 shrink-0">
                    <p className="text-[9px] text-muted-foreground text-center">Arraste os posts para reordenar o grid</p>
                  </div>
                  <DragOverlay dropAnimation={null}>
                    {activeDragId && posts.find((p: GridPost) => p.id === activeDragId) ? (
                      <PostDragOverlay post={posts.find((p: GridPost) => p.id === activeDragId)!} />
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </div>
            </div>
          </div>
        </div>

        {/* COL 2 — Overview + Stats (same width as others) */}
        <div className="flex-1 min-w-0 border-r border-border flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Visão geral</p>
            <p className="text-sm font-semibold mt-0.5">{monthLabel}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Mini grid map */}
            <section>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Mapa do grid</p>
              <DndContext sensors={sensors} onDragStart={(e) => setActiveDragId(e.active.id as string)} onDragEnd={handleDndEnd}>
                <div className="grid grid-cols-3 gap-1.5">
                  {posts.length > 0 ? posts.map((p: GridPost) => {
                    return (
                      <MapDroppableCell key={p.id} id={p.id}>
                        <MapDraggablePost
                          post={p}
                          isActive={activeDragId === p.id}
                          isSelected={selectedPost?.id === p.id}
                          onClick={() => setSelectedPost(p)}
                        />
                      </MapDroppableCell>
                    )
                  }) : (
                    <div className="col-span-3 py-8 text-center text-xs text-muted-foreground">Nenhum post neste mês</div>
                  )}
                </div>
                <DragOverlay dropAnimation={null}>
                  {activeDragId && posts.find((p: GridPost) => p.id === activeDragId) ? (
                    <PostDragOverlay post={posts.find((p: GridPost) => p.id === activeDragId)!} mini />
                  ) : null}
                </DragOverlay>
              </DndContext>
            </section>

            {/* Stats */}
            <section>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Resumo do mês</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-card border border-border rounded-lg p-3">
                  <p className="text-xl font-bold">{stats.total}</p>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-3">
                  <p className="text-xl font-bold text-blue-500">{stats.publicado}</p>
                  <p className="text-[10px] text-muted-foreground">Publicados</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-3">
                  <p className="text-xl font-bold text-emerald-500">{stats.aprovado}</p>
                  <p className="text-[10px] text-muted-foreground">Aprovados</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-3">
                  <p className="text-xl font-bold text-orange-500">{stats.pendentes}</p>
                  <p className="text-[10px] text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </section>

            {/* Link section */}
            <section>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Link do cliente</p>
              <div className="bg-card border border-border rounded-xl p-3 space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Link de aprovação</p>
                <p className="text-[11px] font-mono text-primary break-all">{BASE_URL}/review/{client?.review_token || '...'}</p>
                <div className="flex gap-2">
                  <button onClick={() => { copyToClipboard(`${BASE_URL}/review/${client?.review_token || ''}`); toast.success('Link copiado!') }} className="flex items-center justify-center gap-1.5 flex-1 py-1.5 text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors">
                    <Copy size={14} /> Copiar
                  </button>
                  <button onClick={() => setShowLinkModal(true)} className="flex items-center justify-center gap-1.5 py-1.5 px-3 text-[11px] font-medium bg-secondary border border-border rounded-lg hover:bg-muted transition-colors">
                    <RefreshCw size={14} /> Novo
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* COL 3 — Post Detail (same width) */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Post selecionado</p>
            <p className="text-sm font-semibold mt-0.5">
              {selectedPost
                ? `${selectedPost.post_type || 'Post'}`
                : 'Clique em um post'}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {selectedPost ? (
              <div className="space-y-4">
                {/* Preview card */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="aspect-square flex items-center justify-center bg-muted text-5xl relative overflow-hidden">
                    {(() => {
                      const { url: selUrl, poster: selPoster } = resolveThumbMedia(selectedPost.media_urls)
                      return selUrl ? (
                        <MediaPreview
                          url={selUrl}
                          poster={selPoster}
                          thumbnail
                          className="w-full h-full"
                          clickable
                          lightboxItems={selectedPost.media_urls.map(u => ({ url: u, mediaType: isVideoUrl(u) ? 'video' : 'image' }))}
                        />
                      ) : (
                        typeIcon(selectedPost.post_type || 'foto', 48)
                      )
                    })()}
                    {selectedPost.status !== 'publicado' && (
                      <div className="absolute inset-0 border-2 border-white/30 border-dashed rounded-none pointer-events-none" />
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-[11px] font-semibold text-primary">
                      <span className="flex items-center gap-1">{client?.name || selectedPost.client_name} · {typeIcon(selectedPost.post_type || 'foto', 12)} {selectedPost.post_type}</span>
                    </p>
                    <p className="text-xs text-foreground leading-relaxed">{selectedPost.caption}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-mono">{selectedPost.scheduled_at ? format(new Date(selectedPost.scheduled_at), "dd/MM '·' HH:mm") : '—'}</span>
                      <span className={cn("ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold border", {
                        'bg-blue-500/10 text-blue-500 border-blue-500/20': selectedPost.status === 'publicado',
                        'bg-emerald-500/10 text-emerald-500 border-emerald-500/20': selectedPost.status === 'aprovado',
                        'bg-orange-500/10 text-orange-500 border-orange-500/20': selectedPost.status === 'aguardando',
                        'bg-red-500/10 text-red-500 border-red-500/20': selectedPost.status === 'alteracao',
                        'bg-muted/10 text-muted-foreground border-muted/20': selectedPost.status === 'rascunho',
                      })}>
                        {STATUS_LABELS[selectedPost.status] || selectedPost.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  {selectedPost.status !== 'publicado' && selectedPost.status !== 'aprovado' ? (
                    <>
                      <button onClick={handleApprove} className="w-full py-2.5 bg-emerald-500 text-white text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                        <Check size={16} /> Aprovar post
                      </button>
                      <button onClick={() => setFbPostId(selectedPost.id)} className="w-full py-2.5 bg-secondary text-secondary-foreground text-sm font-bold hover:bg-muted transition-colors flex items-center justify-center gap-2">
                        <MessageSquare size={16} /> Solicitar alteração
                      </button>
                    </>
                  ) : selectedPost.status === 'aprovado' ? (
                    <div className="space-y-2">
                      <div className="text-center py-2 text-sm text-emerald-500 font-medium flex items-center justify-center gap-1"><Check size={16} /> Aprovado</div>
                      <PublishButton postId={selectedPost.id} onPublished={() => {
                        setPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, status: 'publicado' } : p))
                        setSelectedPost((prev: GridPost | null) => prev ? { ...prev, status: 'publicado' } : null)
                      }} />
                    </div>
                  ) : (
                    <div className="text-center py-3 text-sm text-blue-500 font-medium flex items-center justify-center gap-1"><Camera size={16} /> Publicado no Instagram</div>
                  )}
                  <button onClick={() => navigate(`/posts/${selectedPost.id}`)} className="w-full py-2.5 bg-secondary text-secondary-foreground text-sm font-bold hover:bg-muted transition-colors flex items-center justify-center gap-2">
                    <Edit3 size={16} /> Editar post
                  </button>
                  <button onClick={() => navigate(`/posts/novo?id=${selectedPost.id}`)} className="w-full py-2.5 bg-secondary text-secondary-foreground text-sm font-bold hover:bg-muted transition-colors flex items-center justify-center gap-2">
                    <Upload size={16} /> Enviar nova versão
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                <MousePointer2 size={48} className="opacity-30" />
                <p className="text-sm text-center">Clique em qualquer post no grid<br />para ver os detalhes aqui.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE LAYOUT */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden">
        {/* Controls mobile */}
        <div className="px-4 py-2.5 border-b border-border bg-card shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", client ? (STATUS_CLASS[posts[0]?.status] || 'bg-muted') : 'bg-muted')} />
            <p className="text-xs font-semibold flex-1 truncate">{client?.name || 'Selecione um cliente'}</p>
          </div>
          <div className="flex gap-2">
            <Select
              value={selectedClientId}
              onValueChange={(v) => { setSelectedClientId(v); setSelectedPost(null) }}
            >
              <SelectTrigger className="flex-1 min-w-0">
                <SelectValue placeholder="Selecione um cliente..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(selectedMonth)}
              onValueChange={(v) => { setSelectedMonth(Number(v)); setSelectedPost(null) }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setShowIgPreview(true)} className="flex items-center justify-center gap-1 text-[11px] px-2 py-2 rounded-lg bg-secondary text-secondary-foreground border border-border font-medium hover:bg-muted transition-colors">
              <Grid3x3 size={13} /> Prévia
            </button>
            <button onClick={() => { copyToClipboard(`${BASE_URL}/review/${client?.review_token || ''}`); toast.success('Link copiado!') }} className="flex items-center justify-center gap-1 text-[11px] px-2 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 font-medium hover:bg-primary/20 transition-colors">
              <Copy size={13} /> Copiar
            </button>
            <button onClick={() => setShowLinkModal(true)} className="flex items-center justify-center gap-1 text-[11px] px-2 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 font-medium hover:bg-primary/20 transition-colors">
              <RefreshCw size={13} /> Novo
            </button>
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{format(new Date(selectedYear, selectedMonth), 'MMMM yyyy', { locale: ptBR })} · {posts.length} posts</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className={cn("w-2 h-2 rounded-full", STATUS_CLASS[key])} /> {label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-24">
          {/* IG grid mobile */}
          <div className="grid grid-cols-3 gap-1 rounded-xl overflow-hidden bg-border p-[1px] stagger">
            {Array.from({ length: GRID_SIZE }).map((_, i) => {
              const p = posts[i]
              if (p) {
                const pType = (p.post_type || 'foto').toLowerCase()
                const { url: mediaUrl, poster: mediaPoster } = resolveThumbMedia(p.media_urls)
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPost(selectedPost?.id === p.id ? null : p)}
                    className={cn(
                      "aspect-[4/5] bg-card relative cursor-pointer overflow-hidden",
                      selectedPost?.id === p.id && "ring-2 ring-primary ring-inset"
                    )}
                  >
                    {mediaUrl ? (
                      <MediaPreview url={mediaUrl} poster={mediaPoster} thumbnail className="w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">{typeIcon(pType, 24)}</div>
                    )}
                    {p.status !== 'publicado' && <div className="absolute inset-0 border border-white/30 border-dashed pointer-events-none" />}
                    <div className={cn("absolute top-1 right-1 w-3 h-3 rounded-full border border-white/50", STATUS_CLASS[p.status] || 'bg-muted')} />
                  </div>
                )
              }
              return (
                <div key={`empty-${i}`} onClick={() => setShowNewPostConfirm(true)} className="aspect-[4/5] bg-muted/20 flex items-center justify-center text-muted-foreground/20 text-lg border border-dashed border-border cursor-pointer hover:bg-muted/40 hover:text-muted-foreground/40 transition-colors">
                  +
                </div>
              )
            })}
          </div>

          {/* Selected post detail on mobile */}
          {selectedPost && (
            <div className="mt-4 bg-card border border-border rounded-xl overflow-hidden">
              <div className="aspect-square flex items-center justify-center bg-muted text-4xl relative overflow-hidden">
                {(() => {
                  const { url: selUrl, poster: selPoster } = resolveThumbMedia(selectedPost.media_urls)
                  return selUrl ? (
                    <MediaPreview url={selUrl} poster={selPoster} thumbnail className="w-full h-full" />
                  ) : (
                    typeIcon(selectedPost.post_type || 'foto', 36)
                  )
                })()}
                {selectedPost.status !== 'publicado' && <div className="absolute inset-0 border-2 border-white/30 border-dashed pointer-events-none" />}
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase text-primary">{selectedPost.post_type}</p>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold border", {
                    'bg-blue-500/10 text-blue-500 border-blue-500/20': selectedPost.status === 'publicado',
                    'bg-emerald-500/10 text-emerald-500 border-emerald-500/20': selectedPost.status === 'aprovado',
                    'bg-orange-500/10 text-orange-500 border-orange-500/20': selectedPost.status === 'aguardando',
                    'bg-red-500/10 text-red-500 border-red-500/20': selectedPost.status === 'alteracao',
                    'bg-muted/10 text-muted-foreground border-muted/20': selectedPost.status === 'rascunho',
                  })}>
                    {STATUS_LABELS[selectedPost.status] || selectedPost.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedPost.scheduled_at && format(new Date(selectedPost.scheduled_at), "dd 'de' MMMM '·' HH:mm", { locale: ptBR })}
                </p>
                <p className="text-sm leading-relaxed">{selectedPost.caption}</p>
                <div className="flex gap-2 pt-2">
                  {selectedPost.status !== 'publicado' && selectedPost.status !== 'aprovado' && (
                    <button onClick={handleApprove} className="flex-1 py-2 bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1"><Check size={14} /> Aprovar</button>
                  )}
                  <button onClick={() => setFbPostId(selectedPost.id)} className="flex-1 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-lg flex items-center justify-center gap-1"><MessageSquare size={14} /> Feedback</button>
                </div>

                {/* Reagendar o dia */}
                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Reagendar para outro dia</p>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={mobileNewDate || (selectedPost.scheduled_at ? format(new Date(selectedPost.scheduled_at), 'yyyy-MM-dd') : '')}
                      onChange={e => setMobileNewDate(e.target.value)}
                      className="flex-1 min-w-0 text-xs bg-background border border-border rounded-lg px-2 py-2"
                    />
                    <button
                      onClick={() => handleMobileReschedule(mobileNewDate || (selectedPost.scheduled_at ? format(new Date(selectedPost.scheduled_at), 'yyyy-MM-dd') : ''))}
                      className="px-3 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-lg flex items-center gap-1"
                    >
                      <Calendar size={13} /> Salvar
                    </button>
                  </div>
                </div>

                {/* Trocar dia com outro post */}
                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Trocar dia com outro post</p>
                  {posts.filter(p => p.id !== selectedPost.id).length > 0 ? (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto">
                      {posts.filter(p => p.id !== selectedPost.id).map(p => (
                        <button
                          key={p.id}
                          onClick={() => handleMobileSwap(p)}
                          className="w-full flex items-center gap-2 p-2 rounded-lg border border-border bg-secondary/20 hover:bg-secondary transition-colors"
                        >
                          <div className="w-9 h-9 rounded-md overflow-hidden bg-muted shrink-0">
                            {(() => {
                              const { url: swapUrl, poster: swapPoster } = resolveThumbMedia(p.media_urls)
                              return swapUrl ? (
                                <MediaPreview url={swapUrl} poster={swapPoster} thumbnail className="w-full h-full" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground">{typeIcon(p.post_type || 'foto', 14)}</div>
                              )
                            })()}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-[11px] font-medium truncate">{p.client_name || 'Post'}</p>
                            <p className="text-[9px] text-muted-foreground">{p.scheduled_at ? format(new Date(p.scheduled_at), "dd/MM · HH:mm") : '—'}</p>
                          </div>
                          <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Sem outros posts neste mês para trocar.</p>
                  )}
                </div>

                <button onClick={() => navigate(`/posts/${selectedPost.id}`)} className="w-full py-2 text-xs font-medium text-muted-foreground text-center">Ver detalhes completos <ChevronRight size={14} className="inline" /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL — Link do cliente */}
      <Dialog open={showLinkModal} onOpenChange={setShowLinkModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Link size={18} /> Link de review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Cliente</label>
              <div className="flex items-center gap-2 bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-muted to-muted-foreground flex items-center justify-center text-white text-[9px] font-bold">
                  {client?.name?.charAt(0) || '?'}
                </div>
                {client?.name || 'Cliente'}
              </div>
            </div>
            <div className="bg-secondary/30 border border-dashed border-primary/30 rounded-lg p-3 space-y-1">
              <p className="text-[10px] text-muted-foreground">Link único e seguro</p>
              <p className="text-xs font-mono text-primary break-all">
                {BASE_URL}/review/{client?.review_token || '...'}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Sem PIN — o token criptográfico é a própria senha.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowLinkModal(false)}>Fechar</Button>
            <Button onClick={() => {
              copyToClipboard(`${BASE_URL}/review/${client?.review_token || ''}`)
              toast.success('Link copiado!')
              setShowLinkModal(false)
            }}>
              <Copy size={16} /> Copiar link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL — Preview no Instagram */}
      <Dialog open={showIgPreview} onOpenChange={setShowIgPreview}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Grid3x3 size={18} /> Prévia do perfil no Instagram</DialogTitle>
          </DialogHeader>
          <div className="py-2 flex justify-center">
            {client ? (
              <IgProfileMockup
                client={{
                  name: client.name,
                  handle: client.handle,
                  profilePhoto: client.profile_photo,
                  followers: client.followers,
                  following: client.following,
                  bio: client.bio,
                }}
                posts={posts.map(p => ({
                  id: p.id,
                  mediaUrl: p.media_urls?.[0] || null,
                  postType: p.post_type,
                  status: p.status,
                }))}
                width={330}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Selecione um cliente para ver a prévia.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL — Confirmar novo post */}
      <Dialog open={showNewPostConfirm} onOpenChange={setShowNewPostConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus size={18} /> Criar novo post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Este espaço do grid está vazio. Deseja criar um novo post para {client?.name || 'este cliente'}?
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowNewPostConfirm(false)}>Cancelar</Button>
            <Button onClick={() => {
              setShowNewPostConfirm(false)
              navigate('/posts/novo')
            }}>
              <Plus size={16} /> Criar novo post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FeedbackDialog
        postId={fbPostId || ''}
        open={!!fbPostId}
        onOpenChange={(v) => { if (!v) { setFbPostId(null); } }}
        onSuccess={() => {
          setPosts(prev => prev.map(p => p.id === fbPostId ? { ...p, status: 'alteracao' } : p))
          setSelectedPost((prev: GridPost | null) => prev ? { ...prev, status: 'alteracao' } : null)
        }}
      />

      {/* Swap confirmation dialog */}
      <Dialog open={!!pendingSwap} onOpenChange={(o) => { if (!o) setPendingSwap(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reorganizar grid</DialogTitle>
          </DialogHeader>
          {pendingSwap && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Deseja trocar o dia dos posts abaixo?
              </p>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                  {(() => {
                    const { url: dragUrl, poster: dragPoster } = resolveThumbMedia(pendingSwap.dragPost.media_urls)
                    return dragUrl ? (
                      <MediaPreview url={dragUrl} poster={dragPoster} thumbnail className="w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">{typeIcon(pendingSwap.dragPost.post_type, 16)}</div>
                    )
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{pendingSwap.dragPost.client_name || 'Post'}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(pendingSwap.dragPost.scheduled_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
                <ArrowLeft size={14} className="text-muted-foreground shrink-0 rotate-180" />
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                  {(() => {
                    const { url: dropUrl, poster: dropPoster } = resolveThumbMedia(pendingSwap.dropPost.media_urls)
                    return dropUrl ? (
                      <MediaPreview url={dropUrl} poster={dropPoster} thumbnail className="w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">{typeIcon(pendingSwap.dropPost.post_type, 16)}</div>
                    )
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{pendingSwap.dropPost.client_name || 'Post'}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(pendingSwap.dropPost.scheduled_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendingSwap(null)}>Cancelar</Button>
            <Button onClick={() => {
              if (pendingSwap) {
                executeSwap(pendingSwap.dragPost, pendingSwap.dropPost)
                setPendingSwap(null)
              }
            }}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ─── dnd-kit helper components ─── */

function GridDroppableCell({ id, isEmpty, children }: { id: string; isEmpty: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        isEmpty && isOver && "ring-2 ring-primary/60 ring-inset"
      )}
    >
      {children}
    </div>
  )
}

function GridDraggablePost({ post, isActive, onClick }: { post: GridPost; isActive: boolean; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: post.id })
  const pType = (post.post_type || 'foto').toLowerCase()
  const { url: mediaUrl, poster: mediaPoster } = resolveThumbMedia(post.media_urls)
  return (
    <div
      ref={setNodeRef}
      style={isDragging ? { opacity: 0.2 } : undefined}
      {...listeners}
      {...attributes}
      onClick={() => { if (!isDragging) onClick() }}
      className={cn(
        "aspect-[4/5] bg-secondary relative cursor-grab active:cursor-grabbing hover:opacity-90 overflow-hidden group touch-none",
        isActive && "ring-2 ring-primary/60"
      )}
    >
      {mediaUrl ? (
        <MediaPreview url={mediaUrl} poster={mediaPoster} thumbnail className="w-full h-full" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-lg">{typeIcon(pType, 18)}</div>
      )}
      {post.status !== 'publicado' && <div className="absolute inset-0 border-2 border-card/40 border-dashed pointer-events-none" />}
      <div className={cn("absolute top-1 right-1 w-[14px] h-[14px] rounded-full border-2 border-white shadow-sm", STATUS_CLASS[post.status] || 'bg-muted')} />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
    </div>
  )
}

function MapDroppableCell({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={cn(isOver && "ring-2 ring-primary/60 ring-inset")}>
      {children}
    </div>
  )
}

function MapDraggablePost({ post, isActive, isSelected, onClick }: { post: GridPost; isActive: boolean; isSelected: boolean; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: post.id })
  const pType = (post.post_type || 'foto').toLowerCase()
  const { url: mediaUrl, poster: mediaPoster } = resolveThumbMedia(post.media_urls)
  const bgColor = STATUS_COLORS[post.status] || '#6b7080'
  return (
    <div
      ref={setNodeRef}
      style={{ backgroundColor: `${bgColor}22`, opacity: isDragging ? 0.3 : undefined }}
      {...listeners}
      {...attributes}
      onClick={() => { if (!isDragging) onClick() }}
      className={cn(
        "aspect-[4/5] rounded-md flex flex-col relative cursor-grab active:cursor-grabbing overflow-hidden group touch-none",
        isSelected && "ring-2 ring-primary ring-offset-1",
        isActive && "ring-2 ring-primary/60"
      )}
    >
      {mediaUrl ? (
        <MediaPreview url={mediaUrl} poster={mediaPoster} thumbnail className="w-full h-full" />
      ) : (
        <div className="flex-1 flex items-center justify-center">{typeIcon(pType, 20)}</div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
        <div className="flex items-center gap-1 text-[8px] text-white">
          {typeIcon(pType, 9)}
          <span className="font-semibold truncate flex-1">{STATUS_LABELS[post.status] || post.status}</span>
          {post.scheduled_at && (
            <span className="opacity-80">{format(new Date(post.scheduled_at), "dd/MM")}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function PostDragOverlay({ post, mini }: { post: GridPost; mini?: boolean }) {
  const pType = (post.post_type || 'foto').toLowerCase()
  const { url: mediaUrl, poster: mediaPoster } = resolveThumbMedia(post.media_urls)
  return (
    <div className={cn("bg-secondary rounded-lg overflow-hidden shadow-2xl border-2 border-primary/50", mini ? "w-[80px] aspect-[4/5]" : "w-[90px] aspect-[4/5]")}>
      {mediaUrl ? (
        <MediaPreview url={mediaUrl} poster={mediaPoster} thumbnail className="w-full h-full" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">{typeIcon(pType, 20)}</div>
      )}
    </div>
  )
}

function PublishButton({ postId, onPublished }: { postId: string; onPublished: () => void }) {
  const [publishing, setPublishing] = useState(false)
  const { user } = useAuth()

  async function handlePublish() {
    if (!postId || publishing) return
    setPublishing(true)
    try {
      const { data: post } = await supabase.from('posts').select('media_urls, client_name, post_type, scheduled_at, platform').eq('id', postId).single()
      if (!post) { toast.error('Post não encontrado'); return }
      let newMediaUrls = post.media_urls || []
      if (newMediaUrls.length > 0) {
        newMediaUrls = await compressPostMediaAndReupload(newMediaUrls, {
          client: post.client_name,
          type: post.post_type,
          date: post.scheduled_at ? String(post.scheduled_at).split('T')[0] : undefined,
          plataforma: post.platform || 'instagram',
        })
      }
      const { error } = await supabase.from('posts').update({ status: 'publicado', media_urls: newMediaUrls, user_id: user?.id }).eq('id', postId)
      if (error) throw error
      toast.success('Post publicado!')
      onPublished()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao publicar')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <button
      onClick={handlePublish}
      disabled={publishing}
      className="w-full py-2 bg-primary text-primary-foreground text-sm font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-1"
    >
      {publishing ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
      {publishing ? 'Publicando...' : 'Marcar como publicado'}
    </button>
  )
}
