import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { subscribeRealtime } from '@/lib/realtime'
import { cn, getInitials, sanitize, isVideoUrl } from '@/lib/utils'
import { PlatformPreview } from '@/components/post/PlatformPreview'
import { Brand } from '@/components/layout/Brand'
import type { PostPreviewData } from '@/components/post/preview-types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Check, MessageSquare, Clock, Send, Image as ImageIcon, Video, Layers, AlertCircle, Loader2, PenLine, Grid3x3 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import IgProfileMockup from '@/components/instagram/IgProfileMockup'

type PostStatus = 'rascunho' | 'aguardando' | 'alteracao' | 'aprovado' | 'publicado'

interface FeedbackMsg {
  id: string
  author_role: string
  author_name: string
  message: string
  created_at: string
  type: 'message' | 'log' | string
}

interface FeedbackRow extends FeedbackMsg {
  post_id: string
}

interface PostItem {
  id: string
  type: 'reels' | 'carrossel' | 'foto' | 'stories' | 'design'
  caption: string
  status: PostStatus
  scheduledAt: string
  clientName: string
  clientHandle: string
  clientColor: string
  mediaUrl: string | null
  mediaUrls: string[]
  feedbacks: FeedbackMsg[]
}

interface PostRow {
  id: string
  post_type: PostItem['type'] | null
  caption: string | null
  status: PostStatus | null
  scheduled_at: string
  client_handle: string | null
  media_urls: string[] | null
}

const STATUS_LABELS: Record<PostStatus, string> = {
  rascunho: 'Rascunho',
  aguardando: 'Pendente',
  alteracao: 'Alteração',
  aprovado: 'Aprovado',
  publicado: 'Publicado',
}

const TYPE_ICONS: Record<string, typeof ImageIcon> = {
  reels: Video,
  carrossel: Layers,
  foto: ImageIcon,
  stories: Video,
  design: ImageIcon,
}

const TYPE_LABELS: Record<string, string> = {
  reels: 'Reels',
  carrossel: 'Carrossel',
  foto: 'Foto',
  stories: 'Stories',
  design: 'Design',
}

function postToPreview(post: PostItem): PostPreviewData {
  return {
    client: { name: post.clientName, handle: post.clientHandle, color: post.clientColor },
    type: post.type,
    caption: post.caption,
    scheduledAt: post.scheduledAt ? new Date(post.scheduledAt) : null,
    files: post.mediaUrls.map(url => ({ url, mediaType: isVideoUrl(url) ? 'video' : 'image' })),
    status: post.status,
  }
}

function StatusPill({ status }: { status: PostStatus }) {
  const colors: Record<string, string> = {
    aguardando: 'bg-amber-50 text-amber-700 border-amber-200',
    aprovado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    alteracao: 'bg-rose-50 text-rose-700 border-rose-200',
    rascunho: 'bg-secondary text-muted-foreground border-border',
    publicado: 'bg-primary/10 text-primary border-primary/20',
  }
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-md border', colors[status] || colors.aguardando)}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function typeIcon(type: string, size = 18) {
  const Icon = TYPE_ICONS[type] || ImageIcon
  return <Icon size={size} />
}

export default function ClienteFluxoPage() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [client, setClient] = useState<{ id: string; name: string; handle: string; color: string } | null>(null)
  const [posts, setPosts] = useState<PostItem[]>([])
  const [fbMessages, setFbMessages] = useState<Record<string, string>>({})
  const [showIgPreview, setShowIgPreview] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'fb' } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string, type: 'ok' | 'fb') {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, type })
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }

  const initials = useMemo(() => client ? getInitials(client.name) : '?', [client])

  const approvedCount = useMemo(() => posts.filter(p => p.status === 'aprovado').length, [posts])
  const pendingCount = useMemo(() => posts.filter(p => p.status === 'aguardando').length, [posts])
  const progressPct = posts.length > 0 ? Math.round((approvedCount / posts.length) * 100) : 0

  const fetchPosts = useCallback(async (clientId: string, clientName: string, clientHandle: string, clientColor: string) => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('client_id', clientId)
        .order('scheduled_at', { ascending: true })

      if (error) throw error

      const postIds = (data || []).map(p => p.id)
      let feedbackMap: Record<string, FeedbackMsg[]> = {}

      if (postIds.length > 0) {
        const { data: fbData } = await supabase
          .from('post_feedbacks')
          .select('id, post_id, author_role, author_name, message, created_at, type')
          .in('post_id', postIds)
          .order('created_at', { ascending: true })

        if (fbData) {
          feedbackMap = (fbData as FeedbackRow[]).reduce((acc: Record<string, FeedbackMsg[]>, fb) => {
            if (!acc[fb.post_id]) acc[fb.post_id] = []
            acc[fb.post_id].push(fb)
            return acc
          }, {})
        }
      }

      const mapped: PostItem[] = ((data || []) as PostRow[]).map((p) => ({
        id: p.id,
        type: p.post_type || 'foto',
        caption: p.caption || '',
        status: p.status || 'aguardando',
        scheduledAt: p.scheduled_at,
        clientName,
        clientHandle: clientHandle || p.client_handle || '',
        clientColor,
        mediaUrl: p.media_urls?.[0] || null,
        mediaUrls: p.media_urls || [],
        feedbacks: feedbackMap[p.id] || [],
      }))

      setPosts(mapped.length > 0 ? mapped : mockPosts)
    } catch {
      setPosts(mockPosts)
    }
  }, [])

  const authenticate = useCallback(async (t: string) => {
    setLoading(true)
    setError(null)

    // Try to find client by review_token (UUID)
    const { data: clientData } = await supabase
      .from('clients')
      .select('id, name, handle, branding')
      .eq('review_token', t)
      .maybeSingle()

    if (clientData) {
      const color = (clientData.branding as { palette?: string[] } | null)?.palette?.[0] || '#374151'
      setClient({
        id: clientData.id,
        name: clientData.name,
        handle: clientData.handle || `@${clientData.name.toLowerCase().replace(/\s+/g, '')}`,
        color,
      })
      await fetchPosts(clientData.id, clientData.name, clientData.handle || '', color)
      setLoading(false)
      return
    }

    // Fallback: try old handle-based token format (backwards compat)
    if (t.includes('-')) {
      const handlePart = t.split('-')[0]
      const { data: fallbackClient } = await supabase
        .from('clients')
        .select('id, name, handle, branding')
        .ilike('handle', `%${handlePart}%`)
        .maybeSingle()

      if (fallbackClient) {
        const color = (fallbackClient.branding as { palette?: string[] } | null)?.palette?.[0] || '#374151'
        setClient({
          id: fallbackClient.id,
          name: fallbackClient.name,
          handle: fallbackClient.handle || `@${fallbackClient.name.toLowerCase().replace(/\s+/g, '')}`,
          color,
        })
        await fetchPosts(fallbackClient.id, fallbackClient.name, fallbackClient.handle || '', color)
        setLoading(false)
        return
      }
    }

    // No client found — use mock data
    const clientInfo = mockClient()
    setClient({
      id: 'mock',
      name: clientInfo.name,
      handle: clientInfo.handle,
      color: clientInfo.color,
    })
    setPosts(mockPosts)
    setLoading(false)
  }, [fetchPosts])

  useEffect(() => {
    if (token) authenticate(token)
  }, [token, authenticate])

  // Real-time feedback subscription
  const realtimePostIds = useMemo(() =>
    posts.filter(p => !p.id.startsWith('mock-')).map(p => p.id),
    [posts]
  )

  const realtimePostIdsKey = realtimePostIds.join(',')

  useEffect(() => {
    if (realtimePostIdsKey === '') return

    const channel = subscribeRealtime(() =>
      supabase
        .channel('cliente-fluxo-feedbacks')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'post_feedbacks', filter: `post_id=in.(${realtimePostIdsKey})` },
          (payload) => {
            const fb = payload.new as FeedbackRow
            setPosts(prev => prev.map(p =>
              p.id === fb.post_id
                ? { ...p, feedbacks: [...p.feedbacks, { id: fb.id, author_role: fb.author_role, author_name: fb.author_name, message: fb.message, created_at: fb.created_at, type: fb.type }] }
                : p
            ))
            if (fb.author_role !== 'cliente' && fb.type === 'message') {
              showToast(`${fb.author_name}: ${fb.message.slice(0, 80)}`, 'fb')
            }
          },
        ),
    )

    return () => { if (channel) supabase.removeChannel(channel) }
  }, [realtimePostIdsKey])

  async function handleApprove(postId: string) {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: 'aprovado' } : p))
    try {
      await supabase.rpc('approve_post', { p_post_id: postId, p_review_token: token })
    } catch { /* ignora erro do RPC */ }
    showToast('Post aprovado!', 'ok')
  }

  async function handleUndoApprove(postId: string) {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: 'aguardando' } : p))
    try {
      await supabase.rpc('undo_approve_post', { p_post_id: postId, p_review_token: token })
    } catch { /* ignora erro do RPC */ }
    showToast('Aprovação desfeita', 'ok')
  }

  async function handleSendFeedback(postId: string) {
    const msg = fbMessages[postId]
    if (!sanitize(msg)) return
    const newMsg: FeedbackMsg = {
      id: crypto.randomUUID(),
      author_role: 'cliente',
      author_name: client?.name || 'Cliente',
      message: sanitize(msg),
      created_at: new Date().toISOString(),
      type: 'message',
    }
    setPosts(prev => prev.map(p => p.id === postId ? {
      ...p,
      status: p.status === 'aguardando' ? 'alteracao' : p.status,
      feedbacks: [...p.feedbacks, newMsg],
    } : p))
    setFbMessages(prev => ({ ...prev, [postId]: '' }))
    try {
      await supabase.rpc('send_client_feedback', {
        p_post_id: postId,
        p_review_token: token,
        p_message: sanitize(msg),
        p_author_name: client?.name || 'Cliente',
      })
      try {
        await supabase.from('posts').update({ is_feedback: true }).eq('id', postId)
      } catch { /* tag é cosmética */ }
      showToast('Mensagem enviada!', 'fb')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar'
      showToast(message, 'fb')
    }
  }

  async function handleApproveAll() {
    const pendentes = posts.filter(p => p.status === 'aguardando')
    setPosts(prev => prev.map(p => p.status === 'aguardando' ? { ...p, status: 'aprovado' } : p))
    try {
      if (pendentes.length > 0) {
        await supabase.rpc('approve_all_posts', { p_review_token: token })
      }
    } catch { /* ignora erro do RPC */ }
    showToast('Todos os posts aprovados!', 'ok')
  }

  function handleRequestChange(postId: string) {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: p.status === 'aprovado' ? p.status : 'alteracao' } : p))
    const isDesktop = window.matchMedia('(min-width: 768px)').matches
    const el = document.getElementById(`fb-input-${isDesktop ? 'd' : 'm'}-${postId}`)
    if (el) {
      el.focus()
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  function scheduledTime(s: string) {
    if (!s) return ''
    try {
      return format(new Date(s), "dd/MM 'às' HH:mm", { locale: ptBR })
    } catch {
      return s
    }
  }

  function msgTime(s: string) {
    try { return format(new Date(s), "HH:mm") } catch { return '' }
  }

  /* ── LOADING SCREEN ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={24} className="text-destructive" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Link inválido</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Este link de review não é válido. Verifique o link com seu social media.
          </p>
        </div>
      </div>
    )
  }

  /* ── TOAST ── */
  const toastColors = toast?.type === 'ok'
    ? 'border-emerald-500/40 text-emerald-400'
    : 'border-rose-500/30 text-rose-400'

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* ── DESKTOP VIEW ── */}
      <div className="hidden md:block max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white border border-border rounded-xl p-5 flex items-center gap-4 mb-5 shadow-sm">
          <div className="w-[52px] h-[52px] rounded-full bg-gradient-to-br from-muted to-muted-foreground flex items-center justify-center shrink-0 text-lg font-bold text-white">
            {initials}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold tracking-tight">{client?.name} · Posts de {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}</h2>
            <p className="text-sm text-muted-foreground">Revise e aprove os posts antes da data de publicação.</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground">{approvedCount} de {posts.length} aprovados</span>
            <div className="w-[120px] h-1.5 bg-[#e8eaef] rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
        {/* Posts list */}
        <div className="flex flex-col gap-6 items-center">
          {posts.map((post, i) => (
            <div key={post.id} className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm w-full max-w-[360px]">
              {/* Preview hero */}
              <div className="bg-black flex items-center justify-center">
                <PlatformPreview platform="instagram" post={postToPreview(post)} />
              </div>

              {/* Info compacto + agendamento */}
              <div className="px-4 py-2 flex items-center justify-between border-b border-border">
                <span className="text-[11px] font-semibold text-black">{client?.handle}</span>
                <span className="text-[9px] text-muted-foreground">{TYPE_LABELS[post.type] || post.type}</span>
              </div>
              <div className="px-4 py-2 flex items-center gap-1 text-[9px] text-muted-foreground/60">
                <Clock size={10} /> Agendado para {scheduledTime(post.scheduledAt)}
              </div>

              {/* Review do sistema */}
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Post {i + 1} de {posts.length}</span>
                  <StatusPill status={post.status} />
                </div>

                  {post.status === 'aprovado' ? (
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center">
                          <Check size={14} className="text-white" />
                        </div>
                        <span className="text-sm font-semibold text-emerald-800">Post aprovado</span>
                      </div>
                      <button onClick={() => handleUndoApprove(post.id)} className="text-xs text-emerald-700 underline hover:no-underline">
                        Editar
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleApprove(post.id)} className="py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
                          <Check size={14} /> Aprovar post
                        </button>
                        <button
                          onClick={() => handleRequestChange(post.id)}
                          className={cn(
                            'py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border',
                            post.status === 'alteracao'
                              ? 'bg-rose-50 border-rose-300 text-rose-700'
                              : 'bg-white border-border text-muted-foreground hover:border-rose-300 hover:text-rose-700'
                          )}
                        >
                          <PenLine size={13} /> {post.status === 'alteracao' ? 'Alteração solicitada' : 'Solicitar alteração'}
                        </button>
                      </div>

                      {post.feedbacks.filter(fb => fb.type !== 'log').length > 0 && (
                        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto border border-border rounded-xl p-2.5 bg-[#f8f9fb]">
                          {post.feedbacks.filter(fb => fb.type !== 'log').map(fb => {
                            const isClient = fb.author_role === 'cliente'
                            return (
                              <div key={fb.id} className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] px-2.5 py-1.5 rounded-xl text-xs leading-relaxed ${isClient ? 'bg-primary/10 text-right' : 'bg-white border border-border'}`}>
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="font-semibold text-[10px] text-muted-foreground">{isClient ? 'Você' : fb.author_name}</span>
                                    <span className="text-[9px] text-muted-foreground/60">{msgTime(fb.created_at)}</span>
                                  </div>
                                  <p className="text-[13px]">{fb.message}</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      <div className="flex items-end gap-2">
                        <textarea
                          id={`fb-input-d-${post.id}`}
                          value={fbMessages[post.id] || ''}
                          onChange={e => setFbMessages(prev => ({ ...prev, [post.id]: e.target.value }))}
                          placeholder="Digite sua mensagem..."
                          rows={1}
                          className="flex-1 bg-[#f1f3f7] border border-border rounded-lg p-2 text-xs outline-none resize-none min-h-[32px] leading-relaxed focus:border-primary transition-colors"
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendFeedback(post.id) } }}
                        />
                        <button
                          onClick={() => handleSendFeedback(post.id)}
                          disabled={!fbMessages[post.id]?.trim()}
                          className="p-2 rounded-lg bg-primary text-white disabled:opacity-40 shrink-0"
                        >
                          <Send size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-3 sticky top-6">
            <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
              <h3 className="text-xs font-semibold mb-3 uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Grid3x3 size={13} /> Prévia do perfil
              </h3>
              <IgProfileMockup
                client={{
                  name: client?.name || 'Cliente',
                  handle: client?.handle,
                  profilePhoto: null,
                  followers: null,
                  following: null,
                  bio: null,
                }}
                posts={posts.map(p => ({ id: p.id, mediaUrl: p.mediaUrl, postType: p.type, status: p.status }))}
                width={264}
              />
            </div>
            <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
              <h3 className="text-xs font-semibold mb-3 uppercase tracking-wider text-muted-foreground">
                Resumo de {format(new Date(), 'MMMM', { locale: ptBR })}
              </h3>
              {posts.map((post) => (
                <div key={post.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-b-0 text-xs">
                  <span className="text-muted-foreground">
                    {typeIcon(post.type, 12)} {TYPE_LABELS[post.type]} · {post.scheduledAt ? format(new Date(post.scheduledAt), 'dd/MM') : '—'}
                  </span>
                  <StatusPill status={post.status} />
                </div>
              ))}
            </div>
            {pendingCount > 0 && (
              <button onClick={handleApproveAll} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
                <Check size={15} /> Aprovar todos pendentes
              </button>
            )}
            <div className="bg-white border border-border rounded-xl p-4 shadow-sm text-xs text-muted-foreground leading-relaxed space-y-2">
              <strong className="text-foreground block">Como aprovar</strong>
              <p>Clique em <strong className="text-foreground">Aprovar post</strong> para confirmar cada conteúdo.</p>
              <p>Se precisar de ajustes, toque em <strong className="text-foreground">Solicitar alteração</strong> e descreva o que mudar.</p>
            </div>
          </div>
        </div>

        <div className="text-center py-5 text-[11px] text-muted-foreground">
          Powered by <Brand variant="text" height={12} className="inline-block align-middle" />
        </div>
      </div>

      {/* ── MOBILE VIEW ── */}
      <div className="md:hidden max-w-md mx-auto min-h-screen bg-[#f8f9fb]">
        {/* Header */}
        <div className="bg-white border-b border-border px-4 py-3.5 flex items-center gap-2.5 sticky top-0 z-40 shadow-sm">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-muted to-muted-foreground flex items-center justify-center text-xs font-bold text-white">
            {initials}
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold tracking-tight">{client?.name}</div>
            <div className="text-[11px] text-muted-foreground">
              {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })} · {pendingCount} posts para revisar
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[10px] text-muted-foreground">{approvedCount}/{posts.length} aprovados</span>
            <div className="w-[60px] h-1 bg-[#e8eaef] rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 overflow-x-auto bg-white border-b border-border hide-scrollbar">
          {posts.map((post, i) => (
            <button
              key={post.id}
              onClick={() => {
                const el = document.getElementById(`mob-post-${post.id}`)
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className={cn(
                'px-4 py-2.5 text-[11px] font-medium whitespace-nowrap border-b-2 shrink-0 transition-colors',
                post.status === 'aprovado' ? 'text-emerald-600 border-emerald-500' : 'text-muted-foreground border-transparent'
              )}
            >
              Post {i + 1}{post.status === 'aprovado' ? <Check size={12} className="inline ml-0.5" /> : ''}
            </button>
          ))}
        </div>

        {/* Posts list */}
        <div className="p-3.5 flex flex-col gap-3.5">
          <button onClick={() => setShowIgPreview(true)} className="w-full py-2.5 rounded-xl bg-white border border-border text-xs font-semibold text-primary flex items-center justify-center gap-1.5 shadow-sm hover:bg-primary/5 transition-colors">
            <Grid3x3 size={15} /> Ver prévia do perfil no Instagram
          </button>
          {posts.map((post, i) => (
            <div key={post.id} id={`mob-post-${post.id}`} className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
              {/* Preview hero */}
              <div className="bg-black flex items-center justify-center">
                <PlatformPreview platform="instagram" post={postToPreview(post)} />
              </div>

              {/* Info compacto + agendamento */}
              <div className="px-4 py-2 flex items-center justify-between border-b border-border">
                <span className="text-[11px] font-semibold text-black">{client?.handle}</span>
                <span className="text-[9px] text-muted-foreground">{TYPE_LABELS[post.type] || post.type}</span>
              </div>
              <div className="px-4 py-2 flex items-center gap-1 text-[9px] text-muted-foreground/60">
                <Clock size={10} /> Agendado para {scheduledTime(post.scheduledAt)}
              </div>

              {/* Review do sistema */}
              <div className="p-3.5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Post {i + 1} de {posts.length}</span>
                  <StatusPill status={post.status} />
                </div>
                {post.status === 'aprovado' ? (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center">
                        <Check size={12} className="text-white" />
                      </div>
                      <span className="text-xs font-semibold text-emerald-800">Post aprovado</span>
                    </div>
                    <button onClick={() => handleUndoApprove(post.id)} className="text-[11px] text-emerald-700 underline hover:no-underline">
                      Editar
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <button onClick={() => handleApprove(post.id)} className="py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
                        <Check size={13} /> Aprovar
                      </button>
                      <button
                        onClick={() => handleRequestChange(post.id)}
                        className={cn(
                          'py-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border',
                          post.status === 'alteracao'
                            ? 'bg-rose-50 border-rose-300 text-rose-700'
                            : 'bg-white border-border text-muted-foreground hover:border-rose-300 hover:text-rose-700'
                        )}
                      >
                        <PenLine size={13} /> Alteração
                      </button>
                    </div>

                    {post.feedbacks.filter(fb => fb.type !== 'log').length > 0 && (
                      <div className="flex flex-col gap-1.5 mb-2 max-h-40 overflow-y-auto border border-border rounded-lg p-2 bg-[#f8f9fb]">
                        {post.feedbacks.filter(fb => fb.type !== 'log').map(fb => {
                          const isClient = fb.author_role === 'cliente'
                          return (
                            <div key={fb.id} className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[85%] px-2.5 py-1.5 rounded-lg text-xs leading-relaxed ${isClient ? 'bg-primary/10 text-right' : 'bg-white border border-border'}`}>
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="font-semibold text-[10px] text-muted-foreground">{isClient ? 'Você' : fb.author_name}</span>
                                  <span className="text-[9px] text-muted-foreground/60">{msgTime(fb.created_at)}</span>
                                </div>
                                <p className="text-[13px]">{fb.message}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <div className="flex items-end gap-2">
                      <textarea
                        id={`fb-input-m-${post.id}`}
                        value={fbMessages[post.id] || ''}
                        onChange={e => setFbMessages(prev => ({ ...prev, [post.id]: e.target.value }))}
                        placeholder="Digite sua mensagem..."
                        rows={1}
                        className="flex-1 bg-[#f1f3f7] border border-border rounded-lg p-2 text-xs outline-none resize-none min-h-[32px] leading-relaxed focus:border-primary transition-colors"
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendFeedback(post.id) } }}
                      />
                      <button
                        onClick={() => handleSendFeedback(post.id)}
                        disabled={!fbMessages[post.id]?.trim()}
                        className="p-2 rounded-lg bg-primary text-white disabled:opacity-40 shrink-0"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="bg-white border-t border-border px-4 py-4 mt-1">
          <h3 className="text-sm font-semibold mb-3">Resumo de {format(new Date(), 'MMMM', { locale: ptBR })}</h3>
          {posts.map((post) => (
            <div key={post.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-b-0 text-xs">
              <span className="text-muted-foreground">{typeIcon(post.type, 12)} {TYPE_LABELS[post.type]} · {post.scheduledAt ? format(new Date(post.scheduledAt), 'dd/MM') : '—'}</span>
              <StatusPill status={post.status} />
            </div>
          ))}
          {pendingCount > 0 && (
            <button onClick={handleApproveAll} className="w-full mt-3 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
              <Check size={15} /> Aprovar todos os posts pendentes
            </button>
          )}
        </div>

        <div className="text-center py-4 text-[11px] text-muted-foreground">
          Powered by <Brand variant="text" height={12} className="inline-block align-middle" />
        </div>
      </div>

      {/* Modal — Prévia do perfil no Instagram */}
      <Dialog open={showIgPreview} onOpenChange={setShowIgPreview}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Grid3x3 size={18} /> Prévia do perfil no Instagram</DialogTitle>
          </DialogHeader>
          <div className="py-2 flex justify-center overflow-y-auto max-h-[70vh]">
            <IgProfileMockup
              client={{
                name: client?.name || 'Cliente',
                handle: client?.handle,
                profilePhoto: null,
                followers: null,
                following: null,
                bio: null,
              }}
              posts={posts.map(p => ({ id: p.id, mediaUrl: p.mediaUrl, postType: p.type, status: p.status }))}
              width={330}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg flex items-center gap-1.5 transition-all duration-300',
          toastColors,
          'bg-[#1a1d2e] border'
        )}>
          {toast.type === 'ok' ? <Check size={14} /> : <MessageSquare size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function mockClient() {
  const colors = ['#f472b6', '#9ca3af', '#34d399', '#f59e0b', '#60a5fa']
  const names = ['Loja Aurora', 'Studio Bella', 'Tech Hub', 'Café Central', 'Fit Club']
  const handles = ['@lojaaurora', '@studiobella', '@techhub', '@cafecentral', '@fitclub']
  const i = Math.floor(Math.random() * names.length)
  return { name: names[i], handle: handles[i], color: colors[i] }
}

const mockPosts: PostItem[] = [
  {
    id: 'mock-1', type: 'reels',
    caption: 'Nova coleção de verão chegou! Confira os looks incríveis que preparamos para você brilhar nessa temporada. #moda #verao',
    status: 'aguardando',
    scheduledAt: new Date(Date.now() + 86400000 * 3).toISOString(),
    clientName: mockClient().name, clientHandle: mockClient().handle,
    clientColor: mockClient().color, mediaUrl: null, mediaUrls: [],
    feedbacks: [],
  },
  {
    id: 'mock-2', type: 'carrossel',
    caption: '5 looks para usar na praia. Qual é o seu favorito? Salva esse post para inspiração! #beach #summer',
    status: 'aguardando',
    scheduledAt: new Date(Date.now() + 86400000 * 5).toISOString(),
    clientName: mockClient().name, clientHandle: mockClient().handle,
    clientColor: mockClient().color, mediaUrl: null, mediaUrls: [],
    feedbacks: [],
  },
  {
    id: 'mock-3', type: 'foto',
    caption: 'Look do dia. Camisa floral + calça branca = perfeição total. Tudo disponível no site! #lookdodia',
    status: 'aguardando',
    scheduledAt: new Date(Date.now() + 86400000 * 7).toISOString(),
    clientName: mockClient().name, clientHandle: mockClient().handle,
    clientColor: mockClient().color, mediaUrl: null, mediaUrls: [],
    feedbacks: [],
  },
  {
    id: 'mock-4', type: 'stories',
    caption: 'Promoção relâmpago! 30% off em toda a coleção verão até meia-noite. Corre!',
    status: 'aprovado',
    scheduledAt: new Date(Date.now() + 86400000 * 9).toISOString(),
    clientName: mockClient().name, clientHandle: mockClient().handle,
    clientColor: mockClient().color, mediaUrl: null, mediaUrls: [],
    feedbacks: [],
  },
]
