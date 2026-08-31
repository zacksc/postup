import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { MediaLightbox } from '@/components/post/MediaLightbox'
import { ArrowLeft, Edit3, Check, Pencil, Upload, Send, Loader2, RotateCcw, Trash2, ChevronRight, MessageCircle, Download, Archive, FileDown } from 'lucide-react'
import { cn, sanitize, isVideoUrl } from '@/lib/utils'
import { AnimatedButton } from '@/components/ui/animated-button'
import { DraggableSheet } from '@/components/ui/draggable-sheet'
import { compressPostMediaAndReupload } from '@/lib/compress-image'
import { PlatformPreview } from '@/components/post/PlatformPreview'
import { Skeleton } from '@/components/ui/skeleton'
import { useFeedbacks } from '@/hooks/use-feedbacks'
import { useFeedbackCards } from '@/hooks/use-feedback-cards'
import { FeedbackThread } from '@/components/feedback/FeedbackThread'
import { FeedbackCardModal } from '@/components/feedback/FeedbackCardModal'
import { downloadMediaAsZip, downloadAllMedia } from '@/lib/media-download'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { supabase } from '@/lib/supabase'
import { deletePost } from '@/lib/post-delete'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Post, PostVersion } from '@/types/post'
import type { PostType } from '@/components/ui/status-badge'
import type { FeedbackCardFull } from '@/types/feedback'

const STATUS_META: Record<string, { label: string; class: string }> = {
  rascunho: { label: 'Rascunho', class: 'bg-muted/10 text-muted-foreground border-muted/20' },
  aguardando: { label: 'Aguardando', class: 'bg-warning/10 text-warning border-warning/20' },
  alteracao: { label: 'Em Alteração', class: 'bg-destructive/10 text-destructive border-destructive/20' },
  aprovado: { label: 'Aprovado', class: 'bg-success/10 text-success border-success/20' },
  publicado: { label: 'Publicado', class: 'bg-primary/10 text-primary border-primary/20' },
}

const LOG_MAP: Record<string, string> = {
  alteracao: 'Gestor solicitou alteração no post',
  aprovado: 'Gestor aprovou o post',
  publicado: 'Post foi publicado',
}

export default function PostDetalhePage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user } = useAuth()
  const [post, setPost] = useState<Post | null>(null)
  const [postVersions, setPostVersions] = useState<PostVersion[]>([])
  const [restoringVersion, setRestoringVersion] = useState<string | null>(null)
  const [loadingPost, setLoadingPost] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [quickMsg, setQuickMsg] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)

  const postId = id && id.length > 20 ? id : ''
  const versionName = post ? `v${post.version || 1}` : null
  const { feedbacks, loading, sendLog } = useFeedbacks(postId, versionName)
  const { cards, loading: loadingCards, createCard: hookCreateCard, updateCard, addAttachment, removeAttachment, addChecklistItem, toggleChecklistItem, removeChecklistItem, addComment } = useFeedbackCards(postId)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [showMediaLightbox, setShowMediaLightbox] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null)
  const selectedCard = cards.find((c: { id: string }) => c.id === selectedCardId) || null

  const createCardAction = async (pid: string, data: { title: string; description: string; deadline: string; requested_at: string; priority: 'normal' | 'urgente'; status: string; version_name?: string }) => {
    const result = await hookCreateCard({
      title: data.title,
      description: data.description,
      deadline: data.deadline,
      requested_at: data.requested_at,
      version_name: data.version_name,
      priority: data.priority,
      created_by: 'Gestor',
      user_id: user?.id,
    })
    if (result) {
      await supabase.from('posts').update({ status: 'alteracao', user_id: user?.id }).eq('id', pid)
      await sendLog(`Gestor solicitou alteração: ${data.title}`)
      toast.success('Alteração solicitada')
      setSelectedCardId(result.id)
      setShowFeedbackModal(false)
      return { ...result, attachments: [], checklist: [], comments: [] } as FeedbackCardFull
    }
    return null
  }

  async function atualizarStatus(novoStatus: string) {
    if (!postId || updating) return
    setUpdating(true)
    const statusAnterior = post?.status
    setPost(p => p ? { ...p, status: novoStatus as Post['status'] } : null)

    const { error } = await supabase.from('posts').update({ status: novoStatus, user_id: user?.id }).eq('id', postId)
    if (error) {
      setPost(p => p ? { ...p, status: statusAnterior as Post['status'] } : null)
      toast.error('Erro ao atualizar status')
    } else {
      const logMsg = LOG_MAP[novoStatus]
      if (logMsg) await sendLog(logMsg)
      if (novoStatus === 'publicado') toast.success('Post publicado com sucesso!')
      else if (novoStatus === 'aprovado') toast.success('Post aprovado!')
      else toast.success('Alteração solicitada')
    }
    setUpdating(false)
  }

  useEffect(() => {
    async function carregarPost() {
      if (!postId) { setLoadingPost(false); return }
      const { data } = await supabase.from('posts').select('*').eq('id', postId).single()
      if (data) {
        const version = data.version || 1
        setPost({
          id: data.id,
          clientId: data.client_id || '',
          clientName: data.client_name,
          clientColor: data.client_color || '#374151',
          clientHandle: data.client_handle || '',
          type: data.post_type?.toLowerCase() as PostType || 'foto',
          scheduledAt: new Date(data.scheduled_at),
          caption: data.caption || '',
          status: data.status || 'aguardando',
          files: (data.media_urls || []).map((url: string, i: number) => ({
            id: `media-${i}`,
            url,
            originalUrl: (data.original_urls as string[])?.[i] || undefined,
            order: i,
            mediaType: isVideoUrl(url) ? 'video' : 'image',
          })),
          feedbackCount: feedbacks.length,
          version,
          isFeedback: Boolean(data.is_feedback),
          platform: (data.platform || 'instagram') as Post['platform'],
        })

        const { data: versionData } = await supabase
          .from('post_versions')
          .select('*')
          .eq('post_id', postId)
          .order('version_number', { ascending: true })
        if (versionData) setPostVersions(versionData)
      }
      setLoadingPost(false)
    }
    carregarPost()
  }, [postId, feedbacks.length])

  // Toast para novas mensagens do cliente em tempo real
  const fbCountRef = useRef(feedbacks.length)
  useEffect(() => {
    if (loading) return
    if (feedbacks.length > fbCountRef.current) {
      const novas = feedbacks.slice(fbCountRef.current)
      for (const fb of novas) {
        if (fb.author_role === 'cliente' && fb.type === 'message') {
          toast(`${fb.author_name}: ${fb.message.slice(0, 60)}`)
        }
      }
    }
    fbCountRef.current = feedbacks.length
  }, [feedbacks, loading])

  async function handleRestoreVersion(version: PostVersion) {
    if (!postId || restoringVersion) return
    setRestoringVersion(version.id)
    try {
      const d = version.data
      const newVersionNumber = (post?.version || 1) + 1

      await supabase.from('post_versions').insert([{
        post_id: postId,
        version_number: post?.version || 1,
        name: `v${post?.version || 1}`,
        data: {
          post_type: post?.type,
          caption: post?.caption,
          media_urls: post?.files.map(f => f.url) || [],
          scheduled_at: post?.scheduledAt?.toISOString(),
          status: post?.status,
        },
      }])

      const { error } = await supabase.from('posts').update({
        post_type: d.post_type,
        caption: sanitize(d.caption || ''),
        media_urls: d.media_urls,
        scheduled_at: d.scheduled_at,
        status: d.status,
        version: newVersionNumber,
        user_id: user?.id,
      }).eq('id', postId)

      if (error) throw error

      await sendLog(`Gestor restaurou ${version.name}`)
      toast.success(`Versão ${version.name} restaurada`)

      const { data: newPost } = await supabase.from('posts').select('*').eq('id', postId).single()
      if (newPost) {
        setPost({
          id: newPost.id,
          clientId: newPost.client_id || '',
          clientName: newPost.client_name,
          clientColor: newPost.client_color || '#374151',
          clientHandle: newPost.client_handle || '',
          type: newPost.post_type?.toLowerCase() as PostType || 'foto',
          scheduledAt: new Date(newPost.scheduled_at),
          caption: newPost.caption || '',
          status: newPost.status || 'aguardando',
          files: (newPost.media_urls || []).map((url: string, i: number) => ({
            id: `media-${i}`, url, order: i, mediaType: isVideoUrl(url) ? 'video' : 'image',
          })),
          feedbackCount: feedbacks.length,
          version: newPost.version,
        })
      }

      const { data: versionData } = await supabase
        .from('post_versions')
        .select('*')
        .eq('post_id', postId)
        .order('version_number', { ascending: true })
      if (versionData) setPostVersions(versionData)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao restaurar versão')
    } finally {
      setRestoringVersion(null)
    }
  }

  async function handleSendQuickMsg() {
    if (!sanitize(quickMsg) || !postId || sendingMsg) return
    setSendingMsg(true)
    try {
      const { error } = await supabase.from('post_feedbacks').insert([{
        post_id: postId,
        author_role: 'gestor',
        author_name: user?.user_metadata?.full_name || 'Gestor',
        message: sanitize(quickMsg),
        type: 'message',
        version_name: versionName,
      }]).select()
      if (error) throw error
      setQuickMsg('')
      toast.success('Mensagem enviada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar mensagem')
    } finally {
      setSendingMsg(false)
    }
  }



  const [publishing, setPublishing] = useState(false)
  const [publishSuccess, setPublishSuccess] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function getDeleteDescription(clientName: string, status: string) {
    return 'O post ' + clientName + ' será excluído permanentemente.' +
      (status === 'publicado' ? ' Ele já está publicado — excluí-lo não remove o conteúdo da rede social, apenas este registro.' : '') +
      (status === 'aprovado' ? ' O conteúdo ainda está agendado para publicação; excluir cancela o agendamento.' : '') +
      (status === 'aguardando' ? ' O post está aguardando — excluir cancela o agendamento.' : '') +
      ' Os arquivos de mídia também serão removidos do seu Google Drive/Storage e todos os feedbacks e versões serão apagados. Essa ação não pode ser desfeita.'
  }

  async function handleDeletePost() {
    if (!postId || deleting) return
    setDeleting(true)
    try {
      await deletePost(postId)
      toast.success('Post excluído')
      navigate('/cronograma')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir post')
    } finally {
      setDeleting(false)
    }
  }

  async function handlePublish() {
    if (!postId || publishing) return
    setPublishing(true)
    try {
      const currentMediaUrls = post?.files?.map(f => f.url) || []
      let newMediaUrls = currentMediaUrls
      if (currentMediaUrls.length > 0) {
        newMediaUrls = await compressPostMediaAndReupload(currentMediaUrls, {
          client: post?.clientName,
          type: post?.type,
          date: post?.scheduledAt ? post.scheduledAt.toISOString().split('T')[0] : undefined,
          plataforma: post?.platform,
        })
      }
      const { error } = await supabase.from('posts').update({ status: 'publicado', media_urls: newMediaUrls, user_id: user?.id }).eq('id', postId)
      if (error) throw error
      await sendLog('Post foi publicado')
      setPost(p => p ? { ...p, status: 'publicado', files: newMediaUrls.map((url, i) => ({ ...p.files[i], url })) } : null)
      setPublishSuccess(true)
      window.setTimeout(() => setPublishSuccess(false), 1500)
      toast.success('Post publicado com sucesso!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao publicar')
    } finally {
      setPublishing(false)
    }
  }

  async function handleDownloadZip() {
    if (!post || downloading) return
    setDownloading(true)
    setDownloadProgress(null)
    try {
      const mediaUrls = post.files.map(f => f.originalUrl || f.url)
      const zipName = `${sanitize(post.clientName)}_${format(new Date(post.scheduledAt), 'yyyy-MM-dd')}.zip`
      await downloadMediaAsZip(mediaUrls, zipName, (p) => setDownloadProgress(p))
      toast.success('Mídias baixadas em ZIP')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao baixar mídias')
    } finally {
      setDownloading(false)
      setDownloadProgress(null)
    }
  }

  async function handleDownloadAll() {
    if (!post || downloading) return
    setDownloading(true)
    setDownloadProgress(null)
    try {
      const mediaUrls = post.files.map(f => f.originalUrl || f.url)
      await downloadAllMedia(mediaUrls, (completed, total) => setDownloadProgress(completed / total))
      toast.success('Downloads iniciados')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao baixar mídias')
    } finally {
      setDownloading(false)
      setDownloadProgress(null)
    }
  }

  if (loadingPost) {
    return (
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_1.4fr] overflow-hidden">
        <div className="p-6 space-y-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (!post || !postId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Post não encontrado.</p>
      </div>
    )
  }

  const statusInfo = STATUS_META[post.status] || STATUS_META.rascunho

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* HEADER */}
      <header className="h-14 border-b border-border flex items-center px-4 md:px-6 gap-3 shrink-0 bg-card">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} /> Voltar
        </button>
        <div className="h-4 w-px bg-border" />
        <div className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
          <button onClick={() => navigate('/cronograma')} className="hover:text-foreground shrink-0">Cronograma</button>
          <span className="opacity-40 shrink-0"><ChevronRight size={14} /></span>
          <span className="text-foreground font-medium truncate max-w-[200px]">{post.clientName}</span>
          <span className="opacity-40 shrink-0"><ChevronRight size={14} /></span>
          <span className="truncate max-w-[120px] capitalize">{post.type} {post.scheduledAt ? new Date(post.scheduledAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}</span>
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className={cn("text-[10px] px-2.5 py-1 rounded-full uppercase font-bold border", statusInfo.class)}>
            {statusInfo.label}
          </span>
          <button
            onClick={() => navigate(`/posts/novo?id=${post.id}`)}
            className="p-2 hover:bg-secondary rounded-full text-muted-foreground hover:text-foreground transition-colors"
            title="Editar post"
          >
            <Edit3 size={16} />
          </button>
        </div>
      </header>

      {/* MAIN */}
      <div className="flex-1 flex flex-col md:grid md:grid-cols-[1fr_1.4fr] overflow-hidden">
        {/* LEFT - Preview (desktop only) */}
        <div className="hidden md:flex flex-col overflow-y-auto border-b md:border-b-0 md:border-r border-border">
          <div className="flex-none flex items-center justify-center p-4 md:p-8 bg-gradient-to-b from-primary/[0.03] to-background">
            <PlatformPreview
              platform={post.platform || 'instagram'}
              post={{
                ...post,
                client: {
                  name: post.clientName,
                  handle: post.clientHandle,
                  color: post.clientColor,
                },
              }}
              className="w-full max-w-[400px]"
            />
          </div>
        </div>

        {/* RIGHT - Details & Actions (desktop only) */}
        <aside className="hidden md:flex flex-col h-full overflow-hidden">
          {/* Fixed info + versions */}
          <div className="p-5 pb-0 space-y-5 shrink-0">
            <section>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Informações</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-secondary/30 border border-border rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cliente</p>
                  <p className="text-sm font-medium mt-0.5">{post.clientName}</p>
                </div>
                <div className="bg-secondary/30 border border-border rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipo</p>
                  <p className="text-sm font-medium capitalize mt-0.5">{post.type}</p>
                </div>
                <div className="bg-secondary/30 border border-border rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Agendado</p>
                  <p className="text-sm font-medium mt-0.5">
                    {post.scheduledAt ? new Date(post.scheduledAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </p>
                </div>
                <div className="bg-secondary/30 border border-border rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Versão</p>
                  <p className="text-sm font-medium mt-0.5">v{post.version || 1}</p>
                </div>
                <div className="col-span-2 bg-secondary/30 border border-border rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Status atual</p>
                  <span className={cn("inline-block mt-1.5 text-[10px] px-2.5 py-1 rounded-full font-bold border", statusInfo.class)}>
                    {statusInfo.label}
                  </span>
                </div>
              </div>
            </section>

            <section>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                Histórico de versões · {postVersions.length + 1}
              </p>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span className="text-[11px] font-semibold text-primary flex-1">v{post?.version || 1} · atual</span>
                  <span className="text-[9px] text-muted-foreground">
                    {post?.scheduledAt ? format(post.scheduledAt, "dd/MM/yy HH:mm", { locale: ptBR }) : ''}
                  </span>
                </div>
                {[...postVersions].reverse().map(v => (
                  <div key={v.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted/30 transition-colors group">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                    <span className="text-[11px] font-medium text-muted-foreground flex-1">{v.name}</span>
                    <span className="text-[9px] text-muted-foreground">
                      {format(new Date(v.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </span>
                    <button
                      onClick={() => handleRestoreVersion(v)}
                      disabled={restoringVersion === v.id}
                      className="p-1 rounded text-muted-foreground/40 hover:text-foreground hover:bg-background opacity-0 group-hover:opacity-100 transition-all disabled:opacity-30"
                      title="Restaurar esta versão"
                    >
                      {restoringVersion === v.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Chat card - scrollable, fills remaining space */}
          <div className="flex-1 flex flex-col overflow-hidden mx-3 my-3 rounded-xl bg-secondary/10 border border-border/50">
            <div className="flex flex-col h-full gap-3 p-3">
              {!loadingCards && cards.length > 0 && (
                <div className="space-y-1 shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Alterações · {cards.length}
                  </p>
                  {cards.map((card: { id: string; title: string; status: string; priority: string; deadline: string }) => {
                    const isOverdue = new Date(card.deadline) < new Date() && card.status !== 'aprovado'
                    return (
                      <button
                        key={card.id}
                        onClick={() => setSelectedCardId(card.id)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/60 bg-background/40 hover:bg-background/80 text-left transition-colors"
                      >
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          card.status === 'aprovado' ? 'bg-emerald-500' :
                          isOverdue ? 'bg-destructive' :
                          card.priority === 'urgente' ? 'bg-destructive' : 'bg-amber-500'
                        )} />
                        <span className={cn(
                          "text-xs flex-1 truncate",
                          card.status === 'aprovado' && 'line-through text-muted-foreground',
                          isOverdue && 'text-destructive font-medium'
                        )}>
                          {card.title}
                        </span>
                        {isOverdue && (
                          <span className="text-[9px] text-destructive font-bold uppercase shrink-0">Atrasado</span>
                        )}
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(card.deadline).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </span>
                      </button>
                    )}
                  )}
                </div>
              )}
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">
                Feedbacks · {feedbacks.length}
              </p>
              {loading ? (
                <p className="text-xs text-muted-foreground">Carregando...</p>
              ) : (
                <div className="flex-1 overflow-y-auto min-h-0">
                  <FeedbackThread feedbacks={feedbacks} />
                </div>
              )}
              <div className="shrink-0">
                <div className="flex items-end gap-2 bg-background/60 border border-border rounded-xl overflow-hidden p-1.5">
                  <textarea
                    value={quickMsg}
                    onChange={e => setQuickMsg(e.target.value)}
                    placeholder="Adicionar comentário rápido..."
                    maxLength={500}
                    rows={1}
                    className="flex-1 bg-transparent px-2 py-1.5 text-sm resize-none outline-none"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendQuickMsg() } }}
                  />
                  <button
                    onClick={handleSendQuickMsg}
                    disabled={!quickMsg.trim() || sendingMsg}
                    className="p-2 bg-primary text-primary-foreground rounded-lg shrink-0 disabled:opacity-40"
                  >
                    {sendingMsg ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Actions footer */}
          <div className="p-4 border-t border-border bg-card space-y-2 shrink-0">
            {post.status === 'aprovado' && (
              <AnimatedButton
                variant="default"
                loading={publishing}
                success={publishSuccess}
                disabled={post.status !== 'aprovado'}
                onClick={handlePublish}
                className="w-full"
              >
                {!publishing && !publishSuccess && <Check size={18} />}
                {publishing ? 'Comprimindo e publicando...' : 'Marcar como publicado'}
              </AnimatedButton>
            )}
            {post.status !== 'aprovado' && post.status !== 'publicado' && (
              <button
                disabled={updating}
                onClick={() => atualizarStatus('publicado')}
                className="w-full py-2 bg-blue-500 text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Check size={18} /> Marcar como publicado
              </button>
            )}
            <button
              disabled={updating || post.status === 'aprovado' || post.status === 'publicado'}
              onClick={() => atualizarStatus('aprovado')}
              className="w-full py-2 bg-success text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <Check size={18} /> Aprovar post
            </button>
            <button
              disabled={updating || post.status === 'publicado'}
              onClick={() => setShowFeedbackModal(true)}
              className="w-full py-2 bg-secondary text-secondary-foreground text-sm font-bold rounded-xl hover:bg-muted transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <Pencil size={18} /> Solicitar alteração
            </button>
            {post.status === 'alteracao' && (
              <button
                onClick={() => navigate(`/posts/novo?id=${post.id}`)}
                className="w-full py-2 bg-warning/10 text-warning border border-warning/20 text-sm font-bold rounded-xl hover:bg-warning/20 transition-colors flex items-center justify-center gap-2"
              >
                <Upload size={18} /> Enviar nova versão
              </button>
            )}
            <button onClick={() => navigate('/cronograma')} className="w-full py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5">
              <ArrowLeft size={15} /> Voltar ao cronograma
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={downloading || !post.files.length}
                  className="w-full py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary border border-border rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <Download size={14} /> {downloading ? 'Baixando...' : 'Baixar mídias'}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={handleDownloadZip} disabled={downloading || !post.files.length}>
                  <Archive size={14} className="mr-2" /> Compactar em ZIP
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleDownloadAll} disabled={downloading || !post.files.length}>
                  <FileDown size={14} className="mr-2" /> Baixar individualmente
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {downloadProgress != null && (
              <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(downloadProgress * 100)}%` }} />
              </div>
            )}
            <div className="pt-1">
              <ConfirmModal
                trigger={
                  <button className="w-full py-2 text-xs font-bold text-destructive/80 border border-destructive/20 rounded-xl hover:bg-destructive/10 transition-colors flex items-center justify-center gap-1.5">
                    <Trash2 size={15} /> Excluir post
                  </button>
                }
                title="Excluir post?"
                description={getDeleteDescription(post.clientName, post.status)}
                confirmLabel="Excluir definitivamente"
                confirmVariant="destructive"
                loading={deleting}
                onConfirm={() => handleDeletePost()}
              />
            </div>
          </div>
        </aside>

        {/* Mobile: List view header */}
        <div className="flex-1 md:hidden overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Media thumbnail */}
            <div className="relative rounded-xl overflow-hidden bg-black/5 border border-border aspect-video flex items-center justify-center">
              <PlatformPreview
                platform={post.platform || 'instagram'}
                post={{
                  ...post,
                  client: {
                    name: post.clientName,
                    handle: post.clientHandle,
                    color: post.clientColor,
                  },
                }}
                className="w-full h-full"
              />
            </div>

            {/* Version & info */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">v{post.version || 1}</span>
              <span className={cn("text-[10px] px-2.5 py-1 rounded-full uppercase font-bold border", statusInfo.class)}>
                {statusInfo.label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{post.clientName}</span>
              <span>·</span>
              <span className="capitalize">{post.type}</span>
              <span>·</span>
              <span>{post.scheduledAt ? new Date(post.scheduledAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'}</span>
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              {post.status === 'aprovado' && (
                <AnimatedButton
                  variant="default"
                  loading={publishing}
                  success={publishSuccess}
                  disabled={post.status !== 'aprovado'}
                  onClick={handlePublish}
                  className="w-full"
                >
                  {!publishing && !publishSuccess && <Check size={18} />}
                  {publishing ? 'Comprimindo e publicando...' : 'Marcar como publicado'}
                </AnimatedButton>
              )}
              {post.status !== 'aprovado' && post.status !== 'publicado' && (
                <button
                  disabled={updating}
                  onClick={() => atualizarStatus('publicado')}
                  className="w-full py-2 bg-blue-500 text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <Check size={18} /> Marcar como publicado
                </button>
              )}
              <button
                disabled={updating || post.status === 'aprovado' || post.status === 'publicado'}
                onClick={() => atualizarStatus('aprovado')}
                className="w-full py-2 bg-success text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Check size={18} /> Aprovar post
              </button>
              <button
                disabled={updating || post.status === 'publicado'}
                onClick={() => setShowFeedbackModal(true)}
                className="w-full py-2 bg-secondary text-secondary-foreground text-sm font-bold rounded-xl hover:bg-muted transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Pencil size={18} /> Solicitar alteração
              </button>
              {post.status === 'alteracao' && (
                <button
                  onClick={() => navigate(`/posts/novo?id=${post.id}`)}
                  className="w-full py-2 bg-warning/10 text-warning border border-warning/20 text-sm font-bold rounded-xl hover:bg-warning/20 transition-colors flex items-center justify-center gap-2"
                >
                  <Upload size={18} /> Enviar nova versão
                </button>
              )}
            </div>

            {/* Chat button */}
            <button
              type="button"
              onClick={() => setShowChat(true)}
              className="w-full py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <MessageCircle size={16} /> Chat de feedbacks
            </button>

            {/* Download buttons (mobile) */}
            {post.files.length > 0 && (
              <div className="space-y-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      disabled={downloading}
                      className="w-full py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary border border-border rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      <Download size={14} /> {downloading ? 'Baixando...' : 'Baixar mídias'}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onSelect={handleDownloadZip} disabled={downloading}>
                      <Archive size={14} className="mr-2" /> Compactar em ZIP
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={handleDownloadAll} disabled={downloading}>
                      <FileDown size={14} className="mr-2" /> Baixar individualmente
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {downloadProgress != null && (
                  <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(downloadProgress * 100)}%` }} />
                  </div>
                )}
              </div>
            )}

            {/* Back & delete */}
            <button onClick={() => navigate('/cronograma')} className="w-full py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5">
              <ArrowLeft size={15} /> Voltar ao cronograma
            </button>
            <div className="pt-1">
              <ConfirmModal
                trigger={
                  <button className="w-full py-2 text-xs font-bold text-destructive/80 border border-destructive/20 rounded-xl hover:bg-destructive/10 transition-colors flex items-center justify-center gap-1.5">
                    <Trash2 size={15} /> Excluir post
                  </button>
                }
                title="Excluir post?"
                description={getDeleteDescription(post.clientName, post.status)}
                confirmLabel="Excluir definitivamente"
                confirmVariant="destructive"
                loading={deleting}
                onConfirm={() => handleDeletePost()}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: Chat DraggableSheet */}
      <DraggableSheet
        open={showChat}
        onOpenChange={(o) => { if (!o) setShowChat(false) }}
        title="Chat de feedbacks"
        description={`${feedbacks.length} mensagens`}
      >
        <div className="flex flex-col h-full gap-3 p-3">
          {!loadingCards && cards.length > 0 && (
            <div className="space-y-1 shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Alterações · {cards.length}
              </p>
              {cards.map((card: { id: string; title: string; status: string; priority: string; deadline: string }) => {
                const isOverdue = new Date(card.deadline) < new Date() && card.status !== 'aprovado'
                return (
                  <button
                    key={card.id}
                    onClick={() => setSelectedCardId(card.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/60 bg-background/40 hover:bg-background/80 text-left transition-colors"
                  >
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      card.status === 'aprovado' ? 'bg-emerald-500' :
                      isOverdue ? 'bg-destructive' :
                      card.priority === 'urgente' ? 'bg-destructive' : 'bg-amber-500'
                    )} />
                    <span className={cn(
                      "text-xs flex-1 truncate",
                      card.status === 'aprovado' && 'line-through text-muted-foreground',
                      isOverdue && 'text-destructive font-medium'
                    )}>
                      {card.title}
                    </span>
                    {isOverdue && (
                      <span className="text-[9px] text-destructive font-bold uppercase shrink-0">Atrasado</span>
                    )}
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(card.deadline).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">
            Feedbacks · {feedbacks.length}
          </p>
          {loading ? (
            <p className="text-xs text-muted-foreground">Carregando...</p>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0">
              <FeedbackThread feedbacks={feedbacks} />
            </div>
          )}
          <div className="shrink-0">
            <div className="flex items-end gap-2 bg-background/60 border border-border rounded-xl overflow-hidden p-1.5">
              <textarea
                value={quickMsg}
                onChange={e => setQuickMsg(e.target.value)}
                placeholder="Adicionar comentário rápido..."
                maxLength={500}
                rows={1}
                className="flex-1 bg-transparent px-2 py-1.5 text-sm resize-none outline-none"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendQuickMsg() } }}
              />
              <button
                onClick={handleSendQuickMsg}
                disabled={!quickMsg.trim() || sendingMsg}
                className="p-2 bg-primary text-primary-foreground rounded-lg shrink-0 disabled:opacity-40"
              >
                {sendingMsg ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </div>
        </div>
      </DraggableSheet>

      {/* Feedback Card Modal - View existing card */}
      {post && (
        <FeedbackCardModal
          card={selectedCard}
          postId={post.id}
          postFiles={post.files}
          postCaption={post.caption}
          postType={post.type}
          clientName={post.clientName}
          open={!!selectedCard}
          onClose={() => setSelectedCardId(null)}
          actions={{
            createCard: createCardAction,
            updateCard, addAttachment, removeAttachment,
            addChecklistItem, toggleChecklistItem, removeChecklistItem,
            addComment,
          }}
          versions={postVersions.length > 0 ? postVersions.map(v => ({ name: v.name })) : undefined}
          onEditPost={() => navigate(`/posts/novo?id=${post.id}`)}
        />
      )}

      {/* Feedback Card Modal - Create new (Solicitar alteração) */}
      {post && (
        <FeedbackCardModal
          card={null}
          postId={post.id}
          postFiles={post.files}
          postCaption={post.caption}
          postType={post.type}
          clientName={post.clientName}
          open={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          actions={{
            createCard: createCardAction,
            updateCard, addAttachment, removeAttachment,
            addChecklistItem, toggleChecklistItem, removeChecklistItem,
            addComment,
          }}
          versions={postVersions.length > 0 ? postVersions.map(v => ({ name: v.name })) : undefined}
          onEditPost={() => navigate(`/posts/novo?id=${post.id}`)}
          defaultCreating
        />
      )}

      {/* Lightbox de mídia no mobile */}
      {post && (
        <MediaLightbox
          open={showMediaLightbox}
          onOpenChange={o => { if (!o) setShowMediaLightbox(false) }}
          items={(post.files || []).map(f => ({
            url: f.url,
            mediaType: f.mediaType === 'video' ? 'video' : 'image',
          }))}
          startIndex={0}
        />
      )}
    </div>
  )
}
