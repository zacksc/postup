import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Upload, Check, X, Play, Layers, Circle, Image as ImageIcon, Eye, Loader2, CircleCheck, Hourglass, Send, AlertTriangle, FileText } from 'lucide-react'
import { cn, isVideoUrl, hasCoverInMediaUrls } from '@/lib/utils'
import { getUserStorageSettings } from '@/lib/media-storage'
import { AnimatedButton } from '@/components/ui/animated-button'
import { MediaPreview } from '@/components/post/MediaPreview'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard'
import { UnsavedChangesDialog } from '@/components/post/UnsavedChangesDialog'
import { startPostSaveJob, subscribePostSaveJobs, type PostSaveJob } from '@/lib/post-save-job'
import { savePostDraft, loadPostDraft, clearPostDraft } from '@/lib/post-draft'
import { PlatformPreview } from '@/components/post/PlatformPreview'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { TimeSelect } from '@/components/ui/time-select'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { Client } from '@/types/client'
import type { PostVersion } from '@/types/post'

const POST_TYPES = [
  { value: 'reels', label: 'Reels', icon: Play },
  { value: 'carrossel', label: 'Carrossel', icon: Layers },
  { value: 'stories', label: 'Stories', icon: Circle },
  { value: 'foto', label: 'Foto', icon: ImageIcon },
]

function InstagramGlyph({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

function TikTokGlyph({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1Z" />
    </svg>
  )
}

const PLATFORM_OPTIONS = [
  { value: 'instagram', label: 'Instagram', icon: InstagramGlyph },
  { value: 'tiktok', label: 'TikTok', icon: TikTokGlyph },
]

const STATUS_OPTIONS = [
  { value: 'aguardando', label: 'Aguardando', desc: 'Post criado, ainda não enviado para aprovação do cliente.', badge: 'Aguardando', icon: Hourglass, tone: 'amber' as const },
  { value: 'aprovado', label: 'Aprovado', desc: 'O cliente aprovou o post. Pronto para publicar.', badge: 'Aprovado', icon: CircleCheck, tone: 'emerald' as const },
  { value: 'publicado', label: 'Publicado', desc: 'Já foi publicado antes e agora passou a ser rastreado.', badge: 'Publicado', icon: Send, tone: 'blue' as const },
]

const STATUS_TONE = {
  amber: {
    active: 'border-amber-500/60 bg-amber-500/10',
    dot: 'border-amber-500',
    dotInner: 'bg-amber-500',
    icon: 'text-amber-500',
    badge: 'bg-amber-500/10 text-amber-600',
  },
  emerald: {
    active: 'border-emerald-500/60 bg-emerald-500/10',
    dot: 'border-emerald-500',
    dotInner: 'bg-emerald-500',
    icon: 'text-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-600',
  },
  blue: {
    active: 'border-blue-500/60 bg-blue-500/10',
    dot: 'border-blue-500',
    dotInner: 'bg-blue-500',
    icon: 'text-blue-500',
    badge: 'bg-blue-500/10 text-blue-600',
  },
}

const STEP_TITLES = ['Selecionar cliente', 'Conteúdo', 'Mídia', 'Publicação']

interface MediaItem {
  id: string
  url: string
  file?: File
  existing?: boolean
  mediaType: 'image' | 'video'
}

function formatBytes(bytes?: number): string {
  if (bytes == null || bytes <= 0) return '—'
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

function ResizableTextarea({ value, onChange, disabled, placeholder }: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={2}
      className="w-full px-3 py-2 border rounded-lg bg-background text-sm resize-none overflow-y-auto min-h-14 max-h-40"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
    />
  )
}

function SortableMedia({ item, index, onRemove }: { item: MediaItem; index: number; onRemove: () => void }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
    return (
        <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners} className="relative aspect-square border rounded-lg overflow-hidden bg-muted cursor-grab group">
            <MediaPreview url={item.url} mediaType={item.mediaType} thumbnail className="w-full h-full" clickable lightboxItems={[{ url: item.url, mediaType: item.mediaType }]} />
            <div className="absolute top-1 left-1 bg-primary text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                {index + 1}
            </div>
            {item.file && (
              <div className="absolute bottom-1 left-1 right-1 flex justify-center">
                <span className="bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded font-mono truncate">
                  {formatBytes(item.file.size)}
                </span>
              </div>
            )}
            <button type="button" onClick={(e) => { e.preventDefault(); onRemove(); }} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <X size={12} />
            </button>
        </div>
    )
}

export default function NovoPostPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const editId = searchParams.get('id')
  const isEditing = !!editId

  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [postType, setPostType] = useState('reels')
  const [date, setDate] = useState(() => searchParams.get('date') || '')
  const [time, setTime] = useState(() => searchParams.get('time') || (isEditing ? '' : '07:00'))
  const [caption, setCaption] = useState('')
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [cover, setCover] = useState<MediaItem | null>(null)
  const [platform, setPlatform] = useState('instagram')
  const [status, setStatus] = useState('aguardando')
  const [version, setVersion] = useState(1)
  const [versions, setVersions] = useState<PostVersion[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState<string>('current')
  const [newVersionName, setNewVersionName] = useState('')
  const [viewingReadonly, setViewingReadonly] = useState(false)
  const [viewingVersionData, setViewingVersionData] = useState<PostVersion | null>(null)
  const [saving, setSaving] = useState(false)
  const [compressProgress, setCompressProgress] = useState<number | null>(null)
  const [coreLoading, setCoreLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(isEditing)
  const [compressVideos, setCompressVideos] = useState<boolean | null>(null)
  // Job de salvamento em segundo plano: enquanto roda, o usuário pode sair da
  // tela. Guardado o jobId para mostrar a tela de sucesso se ainda estiver aqui.
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [successJob, setSuccessJob] = useState<PostSaveJob | null>(null)
  const [missingDialog, setMissingDialog] = useState<{ obligatory: string[]; optional: string[]; status: string } | null>(null)
  // Wizard steps for mobile: 0=Cliente, 1=Agendamento, 2=Mídia, 3=Legenda+Status, 4=Preview
  const [wizardStep, setWizardStep] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Reset wizard step when switching between new post and edit mode
  const [prevEditId, setPrevEditId] = useState(editId)
  if (editId !== prevEditId) {
    setPrevEditId(editId)
    setWizardStep(0)
  }
  const [dirty, setDirty] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)
  const hydratedRef = useRef(false)
  const savedSnapshotRef = useRef('')

  const snapshotOf = (v: {
    clientId?: string
    postType?: string
    date?: string
    time?: string
    caption?: string
    platform?: string
    status?: string
    compressVideos?: boolean | null
    mediaItems?: MediaItem[]
    cover?: MediaItem | null
  }) => JSON.stringify({
    clientId: v.clientId ?? '',
    postType: v.postType ?? '',
    date: v.date ?? '',
    time: v.time ?? '',
    caption: v.caption ?? '',
    platform: v.platform ?? '',
    status: v.status ?? '',
    compressVideos: v.compressVideos ?? null,
    mediaItems: (v.mediaItems ?? []).map(m => ({
      id: m.id,
      mediaType: m.mediaType,
      existing: !!m.existing,
      url: m.url,
      fileSize: m.file?.size ?? null,
      fileName: m.file?.name ?? null,
    })),
    cover: v.cover ? {
      id: v.cover.id,
      mediaType: v.cover.mediaType,
      existing: !!v.cover.existing,
      url: v.cover.url,
      fileSize: v.cover.file?.size ?? null,
      fileName: v.cover.file?.name ?? null,
    } : null,
  })

  const currentSnapshot = snapshotOf({
    clientId, postType, date, time, caption, platform, status, compressVideos, mediaItems, cover,
  })
  // Ref para o done-handler do job ler o snapshot MAIS RECENTE (o efeito da
  // subscrição captura o closure do primeiro render após o job começar).
  const currentSnapshotRef = useRef(currentSnapshot)

  useEffect(() => {
    currentSnapshotRef.current = currentSnapshot
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDirty(hydratedRef.current && currentSnapshot !== savedSnapshotRef.current)
  }, [currentSnapshot])

  function markSaved() {
    savedSnapshotRef.current = currentSnapshotRef.current
    setDirty(false)
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    if (!user) return
    supabase.from('clients').select('*').eq('user_id', user.id).then(({ data }) => data && setClients(data as Client[]))
  }, [user])

  // Default de compressão vem das Configurações → Armazenamento. O usuário pode
  // trocar por post (seletor "Comprimir e enviar / Enviar sem comprimir").
  useEffect(() => {
    let active = true
    getUserStorageSettings().then(s => {
      if (active && compressVideos === null) setCompressVideos(s.compressVideos)
    })
    return () => { active = false }
  }, [compressVideos])

  // Acompanha o job de salvamento em segundo plano: atualiza o progresso na
  // barra de botão e, se o usuário permanecer na tela, mostra a tela de sucesso.
  useEffect(() => {
    if (!activeJobId) return
    return subscribePostSaveJobs(job => {
      if (job.jobId !== activeJobId) return
      if (job.phase === 'done') {
        setSaving(false)
        setCompressProgress(null)
        setCoreLoading(false)
        markSaved()
        setDraftRestored(false)
        setSaveSuccess(true)
        window.setTimeout(() => setSaveSuccess(false), 1500)
        setSuccessJob(job)
      } else if (job.phase === 'error') {
        setSaving(false)
        setCompressProgress(null)
        setCoreLoading(false)
      } else {
        setCompressProgress(job.phase === 'compress' ? job.progress : null)
        setCoreLoading(job.message.includes('Baixando o compressor'))
      }
    })
  }, [activeJobId])

  const loadEditPost = useCallback(async () => {
    const { data } = await supabase.from('posts').select('*').eq('id', editId).single()
    if (!data) { toast.error('Post não encontrado'); navigate('/cronograma'); return }

    setPostType(data.post_type || 'foto')
    setCaption(data.caption || '')
    setStatus(data.status || 'aguardando')
    setVersion(data.version || 1)
    setPlatform(data.platform || 'instagram')
    setNewVersionName(`v${(data.version || 1) + 1}`)

    // Load version snapshots
    const { data: versionData } = await supabase
      .from('post_versions')
      .select('*')
      .eq('post_id', editId)
      .order('version_number', { ascending: true })
    if (versionData) setVersions(versionData as PostVersion[])

    // Load clients first to find the matching client
    const { data: clientData } = await supabase.from('clients').select('*').eq('user_id', user?.id)
    const clientList = clientData as Client[] | null
    if (clientList) {
      setClients(clientList)
      const client = clientList.find(c => c.name === data.client_name)
      if (client) setClientId(client.id)
    }

    if (data.scheduled_at) {
      const d = new Date(data.scheduled_at)
      setDate(d.toISOString().split('T')[0])
      setTime(d.toTimeString().slice(0, 5))
    }
    if (data.media_urls?.length) {
      if (hasCoverInMediaUrls(data.media_urls)) {
        setCover({ id: Math.random().toString(36), url: data.media_urls[0], existing: true, mediaType: 'image' })
        setMediaItems(data.media_urls.slice(1).map((url: string) => ({ id: Math.random().toString(36), url, existing: true, mediaType: isVideoUrl(url) ? 'video' : 'image' })))
      } else {
        setMediaItems(data.media_urls.map((url: string) => ({ id: Math.random().toString(36), url, existing: true, mediaType: isVideoUrl(url) ? 'video' : 'image' })))
      }
    }
    setLoadingEdit(false)
  }, [editId, user, navigate])

  useEffect(() => {
    if (!editId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEditPost()
  }, [editId, loadEditPost])

  // Guard de saída sem salvar: ativa quando há alterações não salvas e o
  // usuário ainda não está vendo uma versão antiga (readonly).
  const unsavedGuard = useUnsavedGuard(dirty && !viewingReadonly && !saving)

  // Hidratação: após carregar o post de edição (ou direto para post novo),
  // restaura um rascunho salvo em cache (IndexedDB) se existir.
  useEffect(() => {
    if (isEditing && loadingEdit) return
    if (hydratedRef.current) return
    let cancelled = false
    loadPostDraft(editId).then(draft => {
      if (cancelled || !draft) {
        hydratedRef.current = true
        markSaved()
        return
      }
      const restored = {
        clientId: draft.clientId || '',
        postType: draft.postType || '',
        date: draft.date || '',
        time: draft.time || '',
        caption: draft.caption || '',
        platform: draft.platform || '',
        status: draft.status || '',
        compressVideos: draft.compressVideos,
        newVersionName: draft.newVersionName || '',
        selectedVersionId: draft.selectedVersionId || 'current',
        mediaItems: (draft.mediaItems ?? []) as MediaItem[],
        cover: (draft.cover ?? null) as MediaItem | null,
      }
      setClientId(restored.clientId)
      setPostType(restored.postType)
      setDate(restored.date)
      setTime(restored.time)
      setCaption(restored.caption)
      setPlatform(restored.platform)
      setStatus(restored.status)
      setCompressVideos(restored.compressVideos)
      setNewVersionName(restored.newVersionName)
      setSelectedVersionId(restored.selectedVersionId)
      setMediaItems(restored.mediaItems)
      setCover(restored.cover)
      setDraftRestored(true)
      hydratedRef.current = true
      savedSnapshotRef.current = snapshotOf(restored)
      setDirty(false)
    })
    return () => { cancelled = true }
  }, [isEditing, loadingEdit, editId])

  // Autosave do rascunho (debounce) sempre que houver alterações.
  useEffect(() => {
    if (!hydratedRef.current) return
    if (!dirty) return
    if (viewingReadonly) return
    const t = setTimeout(() => {
      savePostDraft(editId, {
        editId,
        savedAt: Date.now(),
        clientId,
        postType,
        date,
        time,
        caption,
        platform,
        status,
        compressVideos,
        newVersionName,
        selectedVersionId,
        mediaItems,
        cover,
      })
    }, 500)
    return () => clearTimeout(t)
  }, [dirty, editId, clientId, postType, date, time, caption, platform, status, compressVideos, newVersionName, selectedVersionId, mediaItems, cover, viewingReadonly])

  function handleDiscardDraft() {
    clearPostDraft(editId)
    setDraftRestored(false)
    if (isEditing) {
      loadEditPost()
    } else {
      setClientId('')
      setPostType('reels')
      setDate('')
      setTime('')
      setCaption('')
      setPlatform('instagram')
      setStatus('aguardando')
      setCompressVideos(null)
      setMediaItems([])
      setCover(null)
    }
    markSaved()
  }

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newItems = Array.from(e.target.files).map(file => ({ id: Math.random().toString(36), file, url: URL.createObjectURL(file), mediaType: file.type.startsWith('video/') ? 'video' as const : 'image' as const }))
      setMediaItems(prev => [...prev, ...newItems])
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active.id !== over?.id) {
      const oldIndex = mediaItems.findIndex(i => i.id === active.id)
      const newIndex = mediaItems.findIndex(i => i.id === over!.id)
      setMediaItems(arrayMove(mediaItems, oldIndex, newIndex))
    }
  }

  function handleVersionSelect(value: string) {
    setSelectedVersionId(value)
    if (value === 'current') {
      setViewingReadonly(false)
      setViewingVersionData(null)
    } else if (value === 'new') {
      setViewingReadonly(false)
      setViewingVersionData(null)
    } else {
      const snap = versions.find(v => v.id === value)
      if (snap) {
        setViewingReadonly(true)
        setViewingVersionData(snap)
      }
    }
  }

  function handleBackToEdit() {
    setSelectedVersionId('current')
    setViewingReadonly(false)
    setViewingVersionData(null)
    // Reload original post data
    if (editId) loadEditPost()
  }

  useEffect(() => {
    if (!viewingVersionData) return
    const d = viewingVersionData.data
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPostType(d.post_type || 'foto')
    setCaption(d.caption || '')
    if (d.scheduled_at) {
      const sd = new Date(d.scheduled_at)
      setDate(sd.toISOString().split('T')[0])
      setTime(sd.toTimeString().slice(0, 5))
    }
    if (d.media_urls?.length) {
      if (hasCoverInMediaUrls(d.media_urls)) {
        setCover({ id: Math.random().toString(36), url: d.media_urls[0], existing: true, mediaType: 'image' })
        setMediaItems(d.media_urls.slice(1).map((url: string) => ({ id: Math.random().toString(36), url, existing: true, mediaType: isVideoUrl(url) ? 'video' : 'image' })))
      } else {
        setMediaItems(d.media_urls.map((url: string) => ({ id: Math.random().toString(36), url, existing: true, mediaType: isVideoUrl(url) ? 'video' : 'image' })))
      }
    } else {
      setMediaItems([])
      setCover(null)
    }
  }, [viewingVersionData])

  const selectedClient = clients.find(c => c.id === clientId)
  const selectedClientColor = selectedClient?.branding?.palette?.[0] || '#374151'
  const sortedClients = useMemo(() => [...clients].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [clients])
  const selectedPlatform = PLATFORM_OPTIONS.find(p => p.value === platform) || PLATFORM_OPTIONS[0]

  const previewPost = {
    client: selectedClient ? { name: selectedClient.name, handle: selectedClient.handle, color: selectedClientColor } : undefined,
    type: postType,
    caption,
    scheduledAt: date ? new Date(`${date}T${time || '00:00'}`) : null,
    files: mediaItems,
    coverUrl: cover?.url ?? null,
    status,
  }

  // Lista os campos que estão faltando para o post ficar completo.
  // Regras:
  //  - Cliente é obrigatório (bloqueia antes de chegar aqui).
  //  - Data de agendamento e horário são OBRIGATÓRIOS (bloqueiam o salvamento).
  //  - Mídia e legenda são opcionais: avisam mas permitem prosseguir.
  //  - Stories não precisa de legenda; Publicado (backfill) não exige mídia.
  function computeMissing(effectiveStatus: string): { obligatory: string[]; optional: string[] } {
    const obligatory: string[] = []
    const optional: string[] = []
    if (!date) obligatory.push('data de agendamento')
    if (!time) obligatory.push('horário')
    if (effectiveStatus !== 'publicado' && !mediaItems.length) optional.push('mídia do post')
    if (postType !== 'stories' && !caption.trim()) optional.push('legenda')
    return { obligatory, optional }
  }

  function goToFirstMissing(allMissing: string[]) {
    if (!isMobile) return
    const first = allMissing[0]
    if (first === 'mídia do post') setWizardStep(2)
    else if (first) setWizardStep(1)
  }

  // Inicia o salvamento do post em SEGUNDO PLANO. O job roda fora do componente
  // (módulo post-save-job + worker dedicado), então o usuário pode sair da tela
  // durante o envio sem cancelar a compressão/upload. O progresso aparece na
  // notificação do cantinho (PostSaveProgressToast) e, se permanecer na tela,
  // uma tela de sucesso é exibida ao concluir.
  function handleSave(statusOverride?: string): boolean {
    const effectiveStatus = statusOverride ?? status
    if (!selectedClient) { toast.error('Selecione um cliente'); return false }
    if (effectiveStatus !== 'rascunho') {
      const { obligatory, optional } = computeMissing(effectiveStatus)
      if (obligatory.length) {
        setMissingDialog({ obligatory, optional, status: effectiveStatus })
        return false
      }
      if (optional.length && effectiveStatus !== 'publicado') {
        setMissingDialog({ obligatory, optional, status: effectiveStatus })
        return false
      }
    }
    return doSave(effectiveStatus)
  }

  function doSave(effectiveStatus: string): boolean {
    const jobId = startPostSaveJob({
      clientId,
      clientName: selectedClient!.name,
      clientHandle: selectedClient!.handle || '',
      clientColor: selectedClientColor,
      postType,
      platform,
      date,
      time,
      caption,
      status: effectiveStatus,
      compressVideos,
      mediaItems,
      cover,
      userId: user?.id || null,
      isEditing,
      editId: editId || undefined,
      version,
      selectedVersionId,
      newVersionName,
    })
    setSaving(true)
    setActiveJobId(jobId)
    return true
  }

  // Ação do diálogo "alterações não salvas": salva em segundo plano e, como o
  // handleSave não navega mais, completa a navegação pendente via proceed().
  function saveFromGuard(statusOverride: string) {
    unsavedGuard.setEnabled(false)
    const ok = handleSave(statusOverride)
    unsavedGuard.setEnabled(dirty && !viewingReadonly && !saving)
    if (ok) unsavedGuard.proceed()
    return ok
  }

  if (loadingEdit) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Carregando post...</p>
      </div>
    )
  }

  return (
    <div className="h-[calc(100dvh-3.5rem)] min-h-0 bg-background">
      <div className="flex flex-col h-[calc(100dvh-3.5rem)] min-h-0">
        <header className="hidden md:flex px-6 h-16 border-b items-center gap-3 bg-card shrink-0 z-10">
          <button onClick={() => navigate(-1)} className="p-2 -ml-1 hover:bg-secondary rounded-full shrink-0">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold tracking-tight leading-tight truncate">{isEditing ? 'Editar Post' : 'Programar Post'}</h1>
            <p className="text-xs text-muted-foreground truncate">Preencha os dados — o preview ao lado atualiza em tempo real.</p>
          </div>
          <button
            onClick={() => navigate('/posts/import')}
            className="ml-auto px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors flex items-center gap-1.5"
            title="Importar posts em lote (CSV/JSON)"
          >
            <FileText size={14} /> Importar em lote
          </button>
        </header>

        {coreLoading && (
          <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground bg-secondary/50 shrink-0">
            <Loader2 size={14} className="animate-spin" />
            <span>Baixando o compressor de vídeo na primeira vez — a próxima será instantânea. Não feche a aba.</span>
          </div>
        )}

        {draftRestored && (
          <div className="flex items-center gap-3 px-4 py-2 text-xs bg-amber-500/10 border-b border-amber-500/20 shrink-0">
            <span className="text-amber-700 font-medium">Rascunho salvo anteriormente foi recuperado.</span>
            <button
              onClick={() => setDraftRestored(false)}
              className="text-primary font-semibold hover:underline"
            >
              Usar rascunho
            </button>
            <button
              onClick={handleDiscardDraft}
              className="text-muted-foreground font-medium hover:underline"
            >
              Descartar
            </button>
          </div>
        )}

        {compressProgress != null && (
          <div className="h-0.5 bg-muted shrink-0">
            <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(compressProgress * 100)}%` }} />
          </div>
        )}

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain pb-40 md:pb-6">
            {/* Wizard header - Mobile (sticky dentro do scroll) */}
            <div className="md:hidden sticky top-0 z-10 bg-card/80 backdrop-blur-sm border-b border-border">
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => wizardStep > 0 ? setWizardStep(s => s - 1) : navigate(-1)} className="p-1.5 -ml-1.5 hover:bg-secondary rounded-full shrink-0">
                  <ArrowLeft size={18} />
                </button>
                <span className="text-sm font-bold flex-1 truncate">{STEP_TITLES[wizardStep]}</span>
                <span className="text-[11px] font-mono text-muted-foreground shrink-0">{wizardStep + 1} de 4</span>
              </div>
              <div className="px-3 pb-2 space-y-1.5">
                <div className="h-[3px] bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${((wizardStep + 1) / 4) * 100}%` }} />
                </div>
                <div className="flex items-center justify-center gap-1.5">
                  {[0, 1, 2, 3].map(step => (
                    <div key={step} className={cn("h-1.5 rounded-full transition-all duration-300", step < wizardStep ? "w-1.5 bg-primary/50" : step === wizardStep ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30")} />
                  ))}
                </div>
              </div>
            </div>
            <div className="max-w-6xl mx-auto p-3 md:p-4 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3 md:gap-4 lg:gap-[30px]">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
               {/* Cliente */}
               {(!isMobile || wizardStep === 0) && (
                 <section className="space-y-2 md:col-span-2">
                  <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 border-b pb-1">Cliente</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {sortedClients.map(c => {
                      const active = clientId === c.id
                      const color = c.branding?.palette?.[0] || '#374151'
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => !viewingReadonly && setClientId(c.id)}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all text-left",
                            active ? "border-primary/60 bg-primary/10" : "border-border hover:border-primary/30 hover:bg-muted/40",
                            viewingReadonly && 'opacity-60 cursor-default'
                          )}
                        >
                          <span
                            className="w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
                            style={{ background: color }}
                          >
                            {c.profile_photo ? <img src={c.profile_photo} alt={c.name} className="w-full h-full object-cover" /> : c.name.charAt(0)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium truncate">{c.name}</span>
                            <span className="block text-[11px] text-muted-foreground truncate">@{c.handle.replace(/^@/, '')}</span>
                          </span>
                          {active && <Check size={16} className="shrink-0 text-primary" />}
                        </button>
                      )
                    })}
                  </div>
                </section>
               )}

               {/* Agendamento */}
               {(!isMobile || wizardStep === 1) && (
                 <section className="space-y-2 md:col-span-2">
                  <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 border-b pb-1">Agendamento</h2>
                 <div className="grid grid-cols-2 gap-3">
                  <DatePicker
                    value={date}
                    onChange={setDate}
                    disabled={viewingReadonly}
                  />
                  <TimeSelect
                    value={time}
                    onChange={setTime}
                    disabled={viewingReadonly}
                  />
                </div>
              </section>
              )}

                {/* Formato do Post */}
                {(!isMobile || wizardStep === 1) && (
                  <section className="space-y-2 md:col-span-3">
                  <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 border-b pb-1">Formato do Post</h2>
                 <div className="grid grid-cols-4 gap-1.5">
                  {POST_TYPES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => !viewingReadonly && setPostType(t.value)}
                      className={cn(
                        "flex flex-col items-center gap-0.5 p-1.5 rounded-lg border transition-all",
                        postType === t.value
                          ? "border-primary/60 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                        viewingReadonly && 'opacity-60 cursor-default'
                      )}
                    >
                      <t.icon size={16} strokeWidth={2} />
                      <span className="text-[9px] font-semibold leading-none">{t.label}</span>
                    </button>
                  ))}
                 </div>
               </section>
               )}

                {/* Plataforma */}
                {(!isMobile || wizardStep === 1) && (
                  <section className="space-y-2 md:col-span-1">
                   <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 border-b pb-1">Plataforma</h2>
                  <Select value={platform} onValueChange={v => !viewingReadonly && setPlatform(v)} disabled={viewingReadonly}>
                    <SelectTrigger className="w-full data-[size=default]:h-9">
                      <SelectValue>
                        <selectedPlatform.icon size={15} />
                        <span>{selectedPlatform.label}</span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORM_OPTIONS.map(p => (
                        <SelectItem key={p.value} value={p.value}>
                          <p.icon size={16} />
                          <span>{p.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </section>
                )}

               {/* Status */}
               {(!isMobile || wizardStep === 3) && (
                 <section className="space-y-2 md:col-span-4">
                   <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 border-b pb-1">Status</h2>
                 {isMobile && (
                   <div className="p-3 border rounded-lg space-y-1 text-xs bg-muted/40">
                     <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Resumo</p>
                     <p>Cliente: <span className="font-medium">{selectedClient?.name || '—'}</span></p>
                     <p>Formato: <span className="font-medium">{POST_TYPES.find(t => t.value === postType)?.label || '—'}</span></p>
                     <p>Plataforma: <span className="font-medium">{selectedPlatform.label}</span></p>
                     <p>Agendado: <span className="font-medium">{date ? `${date} às ${time || '--:--'}` : '—'}</span></p>
                     <p>Arquivos: <span className="font-medium">{mediaItems.length}</span></p>
                   </div>
                 )}
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                  {STATUS_OPTIONS.map(s => {
                    const active = status === s.value
                    const tone = STATUS_TONE[s.tone]
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => !viewingReadonly && setStatus(s.value)}
                        className={cn(
                          "flex items-start gap-2.5 px-3 py-2 rounded-lg border transition-all text-left",
                          active
                            ? tone.active
                            : "border-border hover:border-primary/30 hover:bg-muted/40",
                          viewingReadonly && 'opacity-60 cursor-default'
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                            active ? tone.dot : 'border-muted-foreground/40'
                          )}
                        >
                          {active && <span className={cn("w-2 h-2 rounded-full", tone.dotInner)} />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-semibold">
                            <s.icon size={14} className={cn(active ? tone.icon : 'text-muted-foreground')} />
                            {s.label}
                          </span>
                          <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">{s.desc}</span>
                        </span>
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0", tone.badge)}>
                          {s.badge}
                        </span>
                      </button>
                    )
                  })}
                </div>
               </section>
               )}

               {/* Mídia */}
               {(!isMobile || wizardStep === 2) && (
                 <section className="space-y-2 md:col-span-4">
                   <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 border-b pb-1">Mídia</h2>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={viewingReadonly ? undefined : handleDragEnd}>
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                    <SortableContext items={mediaItems.map(i => i.id)} strategy={rectSortingStrategy}>
                      {mediaItems.map((item, index) => (
                        <SortableMedia key={item.id} item={item} index={index} onRemove={viewingReadonly ? () => {} : () => setMediaItems(prev => prev.filter(i => i.id !== item.id))} />
                      ))}
                    </SortableContext>
                    {!viewingReadonly && (
                      <label className="border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer aspect-square hover:bg-muted transition-colors gap-1">
                        <Upload size={18} className="text-muted-foreground" />
                        <span className="text-[9px] text-muted-foreground font-medium">Adicionar</span>
                        <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFiles} />
                      </label>
                    )}
                  </div>
                </DndContext>

                {(() => {
                  const newItems = mediaItems.filter(i => i.file)
                  if (newItems.length === 0) return null
                  const total = newItems.reduce((sum, i) => sum + (i.file?.size || 0), 0)
                  const videos = newItems.filter(i => i.mediaType === 'video')
                  return (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>{newItems.length} arquivo{newItems.length > 1 ? 's' : ''} · total {formatBytes(total)}</span>
                      {compressVideos === false && videos.length > 0 && (
                        <span className="text-amber-600 font-medium">Sem compressão: os vídeos irão no tamanho original.</span>
                      )}
                    </div>
                  )
                })()}

                {mediaItems.some(i => i.mediaType === 'video') && (
                  <div className="mt-3 p-3 border border-dashed border-border rounded-xl space-y-3">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Envio do vídeo</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => !viewingReadonly && setCompressVideos(true)}
                          className={cn(
                            "py-2 rounded-lg border text-xs font-semibold transition-all",
                            compressVideos !== false
                              ? "border-primary/60 bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/30",
                            viewingReadonly && 'opacity-60 cursor-default'
                          )}
                        >
                          Comprimir e enviar
                        </button>
                        <button
                          type="button"
                          onClick={() => !viewingReadonly && setCompressVideos(false)}
                          className={cn(
                            "py-2 rounded-lg border text-xs font-semibold transition-all",
                            compressVideos === false
                              ? "border-primary/60 bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/30",
                            viewingReadonly && 'opacity-60 cursor-default'
                          )}
                        >
                          Enviar sem comprimir
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {compressVideos === false
                          ? 'O vídeo vai no tamanho original, sem compressão. Ideal quando a compressão não estiver funcionando bem.'
                          : 'O vídeo é comprimido em segundo plano antes de enviar. Se o compressor falhar, você será avisado.'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Capa do vídeo (opcional)</p>

                    {cover ? (
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0 relative">
                          <MediaPreview url={cover.url} mediaType="image" className="w-full h-full" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-muted-foreground">
                            {cover.file ? 'Capa enviada' : 'Capa existente'}
                          </p>
                          <p className="text-[10px] text-muted-foreground/60">Enviada junto do vídeo na mesma pasta.</p>
                        </div>
                        {!viewingReadonly && (
                          <button type="button" onClick={() => setCover(null)} className="text-[11px] text-destructive hover:underline">
                            Remover
                          </button>
                        )}
                      </div>
                    ) : viewingReadonly ? (
                      <p className="text-[11px] text-muted-foreground">Sem capa personalizada.</p>
                    ) : (
                      <label className="flex flex-wrap items-center gap-2 cursor-pointer">
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs font-medium hover:bg-muted transition-colors">
                          <Upload size={14} /> Enviar capa
                        </span>
                        <span className="text-[10px] text-muted-foreground">Se não enviar, usamos um take aleatório do vídeo. A capa vai na mesma pasta do vídeo.</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) setCover({ id: Math.random().toString(36), file: f, url: URL.createObjectURL(f), mediaType: 'image' })
                          }}
                        />
                      </label>
                    )}
                    </div>
                  </div>
                )}
               </section>
               )}

               {/* Legenda */}
               {(!isMobile || wizardStep === 1) && (
                 <section className="space-y-2 md:col-span-4">
                   <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 border-b pb-1">Legenda</h2>
                 <ResizableTextarea
                   placeholder="Escreva a legenda do post..."
                   value={caption}
                   onChange={setCaption}
                   disabled={viewingReadonly}
                 />
               </section>
               )}

               {/* Versão (só aparece na edição) */}
               {isEditing && (!isMobile || wizardStep === 3) && (
                <section className="space-y-3">
                  <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b pb-2">Versão</h2>
                     <Select
                       value={selectedVersionId}
                       onValueChange={handleVersionSelect}
                       disabled={viewingReadonly}
                     >
                       <SelectTrigger className="w-full data-[size=default]:h-9">
                         <SelectValue placeholder="Selecionar versão" />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="current">Original (v{version})</SelectItem>
                         {versions.map(v => (
                           <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                         ))}
                         <SelectItem value="new">+ Criar novo</SelectItem>
                       </SelectContent>
                     </Select>
                  {viewingReadonly && viewingVersionData && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2">
                      <p className="text-xs font-semibold text-amber-600">
                        Visualizando {viewingVersionData.name} — versão anterior (somente leitura)
                      </p>
                      <button
                        onClick={handleBackToEdit}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Voltar a editar
                      </button>
                    </div>
                  )}
                  {selectedVersionId === 'new' && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Nome da nova versão:</p>
                       <input
                         value={newVersionName}
                         onChange={(e) => setNewVersionName(e.target.value)}
                         placeholder={`v${version + 1}`}
                         className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                      />
                    </div>
                  )}
                </section>
              )}

             </div>

             {/* Preview - Desktop */}
             <div className="hidden lg:flex flex-col items-center sticky top-4 h-fit gap-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Preview</p>
              <PlatformPreview platform={platform} post={previewPost} />
            </div>
          </div>
        </div>

        {/* Ações - Desktop (barra fixa) */}
        <div className="hidden md:flex items-center gap-3 border-t px-6 py-3 bg-card shrink-0">
          <button
            type="button"
            onClick={handleDiscardDraft}
            disabled={viewingReadonly}
            className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg disabled:opacity-60"
          >
            Descartar
          </button>
          <div className="flex-1" />
          <AnimatedButton
            type="button"
            variant="secondary"
            onClick={() => handleSave('rascunho')}
            disabled={saving || viewingReadonly}
          >
            Salvar como rascunho
          </AnimatedButton>
          <AnimatedButton
            type="button"
            variant="default"
            loading={saving}
            progress={compressProgress ?? undefined}
            success={saveSuccess}
            onClick={() => handleSave()}
            disabled={viewingReadonly}
          >
            {!saving && <Check size={16} />}
            {saving
              ? (coreLoading
                ? 'Preparando compressor...'
                : compressProgress != null ? `Comprimindo ${Math.round(compressProgress * 100)}%...`
                : 'Salvando...')
              : viewingReadonly ? 'Visualizando' : isEditing ? 'Salvar alterações' : status === 'publicado' ? 'Registrar publicação' : 'Agendar'}
          </AnimatedButton>
        </div>

        {/* Rodapé - Mobile (fixo acima da BottomNav) */}
        <div className="md:hidden fixed bottom-16 left-0 right-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-card border-t border-border z-20 flex gap-2">
          {wizardStep > 0 && (
            <AnimatedButton
              type="button"
              variant="secondary"
              onClick={() => setWizardStep(s => s - 1)}
              className="px-4"
            >
              <ArrowLeft size={16} /> Voltar
            </AnimatedButton>
          )}
          {wizardStep < 3 && (
            <AnimatedButton
              type="button"
              variant="default"
              onClick={() => setWizardStep(s => s + 1)}
              className="flex-1"
            >
              Continuar <ArrowRight size={16} />
            </AnimatedButton>
          )}
          {wizardStep === 3 && (
            <>
              <AnimatedButton
                type="button"
                variant="secondary"
                onClick={() => handleSave('rascunho')}
                disabled={saving || viewingReadonly}
              >
                Rascunho
              </AnimatedButton>
              <AnimatedButton
                type="button"
                variant="secondary"
                onClick={() => setShowPreview(true)}
                className="px-3"
              >
                <Eye size={16} />
              </AnimatedButton>
              <AnimatedButton
                type="button"
                variant="default"
                loading={saving}
                progress={compressProgress ?? undefined}
                success={saveSuccess}
                onClick={() => handleSave()}
                disabled={viewingReadonly}
                className="flex-1"
              >
                {!saving && <Check size={16} />}
                {saving ? 'Salvando...' : viewingReadonly ? 'Visualizando' : isEditing ? 'Salvar alterações' : status === 'publicado' ? 'Registrar publicação' : 'Agendar'}
              </AnimatedButton>
            </>
          )}
        </div>
      </div>

      {/* Preview Modal - Mobile */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col items-center py-4">
            <PlatformPreview platform={platform} post={previewPost} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Aviso de campos em falta: obrigatórios bloqueiam; opcionais alertam e prosseguem */}
      <Dialog open={!!missingDialog} onOpenChange={o => { if (!o) setMissingDialog(null) }}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={20} className="text-amber-500 shrink-0" />
              <DialogTitle className="text-lg">
                {missingDialog?.obligatory.length ? 'Faltam campos obrigatórios' : 'Faltam alguns campos'}
              </DialogTitle>
            </div>
            <DialogDescription>
              {missingDialog?.obligatory.length
                ? 'Preencha os campos obrigatórios para salvar o post:'
                : 'O post está quase pronto, mas você ainda não preencheu:'}
            </DialogDescription>
            <ul className="space-y-1.5 text-sm">
              {missingDialog?.obligatory.map(m => (
                <li key={m} className="flex items-center gap-2 font-medium">
                  <X size={14} className="text-amber-500 shrink-0" /> {m}
                  <span className="ml-auto text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 border border-amber-500/30">
                    Obrigatório
                  </span>
                </li>
              ))}
              {missingDialog?.optional.map(m => (
                <li key={m} className="flex items-center gap-2 text-muted-foreground">
                  <X size={14} className="text-amber-500 shrink-0" /> {m}
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => { const d = missingDialog; setMissingDialog(null); if (d) goToFirstMissing([...d.obligatory, ...d.optional]) }}
                className="w-full bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-bold"
              >
                Preencher
              </button>
              {!missingDialog?.obligatory.length && (
                <button
                  onClick={() => { const s = missingDialog?.status; setMissingDialog(null); if (s) doSave(s) }}
                  className="w-full bg-secondary text-secondary-foreground px-4 py-2.5 rounded-xl text-sm font-bold"
                >
                  Continuar assim mesmo
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tela de sucesso: exibida quando o usuário permanece na tela e o
          job de salvamento em segundo plano conclui. */}
      <Dialog open={!!successJob} onOpenChange={o => { if (!o) { setSuccessJob(null); setActiveJobId(null) } }}>
        <DialogContent className="max-w-sm text-center">
          <CircleCheck size={56} className="mx-auto text-green-500" />
          <DialogTitle className="text-xl">Post salvo com sucesso!</DialogTitle>
          <DialogDescription>
            Seu post foi enviado e programado em segundo plano.
          </DialogDescription>
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => navigate(successJob?.destination || '/cronograma')}
              className="w-full bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-bold"
            >
              Ver post
            </button>
            <button
              onClick={() => navigate('/cronograma')}
              className="w-full bg-secondary text-secondary-foreground px-4 py-2.5 rounded-xl text-sm font-bold"
            >
              Ir para o cronograma
            </button>
            {!isEditing && (
              <button
                onClick={() => { setSuccessJob(null); setActiveJobId(null); handleDiscardDraft() }}
                className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted"
              >
                Programar outro post
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Alerta de alterações não salvas: navegação interna bloqueada */}
      <UnsavedChangesDialog
        open={unsavedGuard.blocked}
        onClose={() => unsavedGuard.reset()}
        title="Alterações não salvas"
        description="Você tem alterações não salvas neste post. O que deseja fazer?"
        onSaveDraft={() => saveFromGuard('rascunho')}
        onLeave={() => unsavedGuard.proceed()}
        onContinue={() => unsavedGuard.reset()}
      />
    </div>
  )
}
