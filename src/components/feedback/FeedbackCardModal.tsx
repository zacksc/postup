import { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { DraggableSheet } from '@/components/ui/draggable-sheet'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  X, Check, Plus, ChevronLeft, ChevronRight,
  Trash2, Image, Link, Send, AlertCircle,
  Calendar, Pencil, File,
} from 'lucide-react'
import { cn, sanitize, isVideoUrl } from '@/lib/utils'
import { MediaPreview } from '@/components/post/MediaPreview'
import { compressImage } from '@/lib/compress-image'
import { uploadMedia } from '@/lib/media-storage'
import { toast } from 'sonner'
import type {
  FeedbackCardFull,
  FeedbackCardStatus,
  FeedbackCardAttachment,
  FeedbackCardChecklistItem,
  FeedbackCardComment,
  Tag,
} from '@/types/feedback'
import type { PostFile } from '@/types/post'

interface FeedbackCardActions {
  createCard: (postId: string, data: {
    title: string
    description: string
    deadline: string
    requested_at: string
    priority: 'normal' | 'urgente'
    status: FeedbackCardStatus
    version_name?: string
    tags?: Tag[]
  }) => Promise<FeedbackCardFull | null>
  updateCard: (cardId: string, data: Partial<{
    title: string
    description: string
    deadline: string
    priority: 'normal' | 'urgente'
    status: FeedbackCardStatus
    tags: Tag[]
  }>) => Promise<unknown>
  addAttachment: (cardId: string, type: 'image' | 'link', url: string, name?: string) => Promise<unknown>
  removeAttachment: (attachmentId: string) => Promise<void>
  addChecklistItem: (cardId: string, text: string) => Promise<unknown>
  toggleChecklistItem: (itemId: string, checked: boolean) => Promise<void>
  removeChecklistItem: (itemId: string) => Promise<void>
  addComment: (cardId: string, author_role: string, author_name: string, message: string) => Promise<unknown>
}

interface FeedbackCardModalProps {
  card: FeedbackCardFull | null
  postId: string
  postFiles: PostFile[]
  postCaption: string
  postType: string
  clientName: string
  clientHandle?: string
  scheduledAt?: string
  open: boolean
  onClose: () => void
  actions: FeedbackCardActions
  onEditPost?: () => void
  defaultCreating?: boolean
  versions?: { name: string }[]
  statusLabels?: Record<string, string>
  isStandalone?: boolean
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDeadline(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_ORDER: FeedbackCardStatus[] = ['aguardando', 'alteracao', 'aprovado']
const STATUS_LABEL_DEFAULTS: Record<FeedbackCardStatus, string> = {
  aguardando: 'Aguardando',
  alteracao: 'Em Andamento',
  aprovado: 'Aprovado',
}
export function FeedbackCardModal({
  card, postId, postFiles, postCaption, postType, clientName, clientHandle, scheduledAt,
  open, onClose, actions, onEditPost, defaultCreating, versions, statusLabels, isStandalone,
}: FeedbackCardModalProps) {
  const STATUS_LABEL: Record<string, string> = {
    ...STATUS_LABEL_DEFAULTS,
    ...(statusLabels || {}),
  }
  const [mediaIndex, setMediaIndex] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const [newChecklistText, setNewChecklistText] = useState('')
  const [newCommentText, setNewCommentText] = useState('')
  const commentInputRef = useRef<HTMLTextAreaElement>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (open && defaultCreating && !card) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsCreating(true)
    }
  }, [open, defaultCreating, card])
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formRequestedAt, setFormRequestedAt] = useState(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  })
  const [formDeadline, setFormDeadline] = useState('')
  const [formPriority, setFormPriority] = useState<'normal' | 'urgente'>('normal')
  const [formStatus, setFormStatus] = useState<FeedbackCardStatus>('aguardando')
  const [formVersionName, setFormVersionName] = useState('')
  const [formTags, setFormTags] = useState<Tag[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#374151')
  const [pendingAttachments, setPendingAttachments] = useState<{ file: File; preview: string }[]>([])
  const [pendingChecklist, setPendingChecklist] = useState<string[]>([])
  const [newPendingChecklist, setNewPendingChecklist] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function resetForm() {
    setIsCreating(false)
    setFormTitle('')
    setFormDescription('')
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    setFormRequestedAt(now.toISOString().slice(0, 16))
    setFormDeadline('')
    setFormPriority('normal')
    setFormStatus('aguardando')
    setFormVersionName('')
    setFormTags([])
    setNewTagName('')
    setNewTagColor('#374151')
    setPendingAttachments([])
    setPendingChecklist([])
    setNewPendingChecklist('')
  }

  function startCreating() {
    setIsCreating(true)
  }

  async function handleCreateCard() {
    if (!sanitize(formTitle) || !sanitize(formDescription) || !formDeadline) return
    setCreating(true)
    const result = await actions.createCard(isStandalone ? '' : postId, {
      title: sanitize(formTitle),
      description: sanitize(formDescription),
      deadline: new Date(formDeadline).toISOString(),
      requested_at: new Date(formRequestedAt).toISOString(),
      priority: formPriority,
      status: formStatus,
      version_name: formVersionName || undefined,
      tags: formTags,
    })
    if (result) {
      for (const item of pendingChecklist) {
        await actions.addChecklistItem(result.id, item)
      }
      for (const { file } of pendingAttachments) {
        const compressed = await compressImage(file, { maxDimension: 1200, quality: 0.75 })
        const fileName = `attachments/${result.id}/${Date.now()}_${file.name.replace(/\.[^.]+$/, '')}.webp`
        try {
          const publicUrl = await uploadMedia(compressed, fileName)
          await actions.addAttachment(result.id, 'image', publicUrl, file.name)
        } catch (err) {
          console.error('Upload error:', err)
        }
      }
      setIsCreating(false)
    }
    setCreating(false)
  }

  const allMedia = postFiles.filter(f => f.mediaType === 'image' || f.mediaType === 'video')
  const currentMedia = allMedia[mediaIndex]

  const handleMarkDone = () => {
    if (!card) return
    const next: FeedbackCardStatus = card.status === 'aprovado' ? 'aguardando' : 'aprovado'
    actions.updateCard(card.id, { status: next })
  }

  const handleAddChecklist = async () => {
    if (!card) return
    const text = sanitize(newChecklistText)
    if (!text) return
    await actions.addChecklistItem(card.id, text)
    setNewChecklistText('')
  }


  const handleAddComment = async () => {
    if (!card) return
    const text = sanitize(newCommentText)
    if (!text) return
    await actions.addComment(card.id, 'gestor', 'Gestor', text)
    setNewCommentText('')
    commentInputRef.current?.focus()
  }

  const currentlyUrgent = card?.priority === 'urgente'
  const isOverdue = card ? new Date(card.deadline) < new Date() && card.status !== 'aprovado' : false

  return (
    <>
      {defaultCreating ? (
        <DraggableSheet open={open} onOpenChange={(o: boolean) => { if (!o) onClose() }} title="Novo card de feedback">
          <div className="overflow-y-auto p-5 space-y-5">
            {/* Create form */}
            {allMedia.length > 0 && (
              <div className="flex gap-4">
                <div className="relative shrink-0 w-[180px] h-[180px] rounded-xl overflow-hidden bg-black/5 border border-border">
                  <img
                    src={currentMedia?.url}
                    alt=""
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => setShowPreview(true)}
                  />
                  {allMedia.length > 1 && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMediaIndex(i => (i - 1 + allMedia.length) % allMedia.length) }}
                        className="absolute left-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-black/40 text-white hover:bg-black/60"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMediaIndex(i => (i + 1) % allMedia.length) }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-black/40 text-white hover:bg-black/60"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  {formPriority === 'urgente' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-destructive/10 text-destructive border-destructive/20 flex items-center gap-1 w-fit mb-1">
                      <AlertCircle size={10} /> Urgente
                    </span>
                  )}
                  <p className="text-sm font-semibold">{clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {clientHandle ? `@${clientHandle}` : `@${clientName.replace(/\s+/g, '').toLowerCase()}`}
                  </p>
                  {scheduledAt && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(scheduledAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  <p className="text-xs leading-relaxed line-clamp-4 text-muted-foreground">
                    {postCaption || 'Sem legenda'}
                  </p>
                </div>
              </div>
            )}
            {allMedia.length > 1 && (
              <div className="flex gap-1.5">
                {allMedia.map((media, i) => (
                  <button
                    key={i}
                    onClick={() => setMediaIndex(i)}
                    className={cn(
                      "w-10 h-10 rounded-lg overflow-hidden border-2 shrink-0 transition-all",
                      i === mediaIndex ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
                    )}
                  >
                    <MediaPreview url={media.url} mediaType={media.mediaType} thumbnail className="w-full h-full" />
                  </button>
                ))}
              </div>
            )}

            <p className="text-sm font-semibold">{clientName} · Novo card</p>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Título *</p>
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Ex: Ajustar cor do texto"
                className="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Descrição *</p>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Descreva a alteração necessária..."
                rows={3}
                className="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Data solicitada</p>
                <input
                  type="datetime-local"
                  value={formRequestedAt}
                  onChange={(e) => setFormRequestedAt(e.target.value)}
                  className="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Prazo *</p>
                <input
                  type="datetime-local"
                  value={formDeadline}
                  onChange={(e) => setFormDeadline(e.target.value)}
                  className="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Versão</p>
                <Select value={formVersionName || '__all__'} onValueChange={(v) => setFormVersionName(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todas as versões" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as versões</SelectItem>
                    {versions?.map(v => (
                      <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Prioridade</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setFormPriority('normal')}
                    className={cn(
                      "flex-1 text-[11px] px-2 py-1.5 rounded-lg font-bold border transition-colors",
                      formPriority === 'normal'
                        ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                        : 'bg-secondary/30 text-muted-foreground border-border hover:border-muted-foreground/30'
                    )}
                  >
                    Normal
                  </button>
                  <button
                    onClick={() => setFormPriority('urgente')}
                    className={cn(
                      "flex-1 text-[11px] px-2 py-1.5 rounded-lg font-bold border transition-colors",
                      formPriority === 'urgente'
                        ? 'bg-destructive/10 text-destructive border-destructive/30'
                        : 'bg-secondary/30 text-muted-foreground border-border hover:border-muted-foreground/30'
                    )}
                  >
                    Urgente
                  </button>
                </div>
              </div>
            </div>

            {/* Status - segmented control style like view mode */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Status</p>
              <div className="flex gap-0.5 bg-secondary/30 rounded-lg p-0.5 border border-border w-fit">
                {STATUS_ORDER.map((s) => (
                  <button
                    key={s}
                    onClick={() => setFormStatus(s)}
                    className={cn(
                      "text-[10px] px-2.5 py-1 rounded-md font-bold transition-all",
                      formStatus === s
                        ? 'bg-card text-foreground shadow-sm border'
                        : 'text-muted-foreground/50 hover:text-foreground'
                    )}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Attachments - working */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Anexos · {pendingAttachments.length}
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary"
                >
                  <Plus size={14} />
                </button>
              </div>
              {pendingAttachments.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {pendingAttachments.map((att, i) => (
                    <div key={i} className="group relative rounded-lg border border-border overflow-hidden bg-secondary/20 aspect-square">
                      {att.preview ? (
                        <img src={att.preview} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground">
                          <File size={20} />
                          <span className="text-[8px] truncate max-w-full px-1">{att.file.name}</span>
                        </div>
                      )}
                      <button
                        onClick={() => setPendingAttachments(prev => prev.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files
                  if (files) {
                    Array.from(files).forEach(file => {
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error(`${file.name} excede 5MB`)
                        return
                      }
                      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
                      setPendingAttachments(prev => [...prev, { file, preview }])
                    })
                  }
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                multiple
              />
            </div>

            {/* Checklist - working */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Checklist · {pendingChecklist.filter(() => false).length}/{pendingChecklist.length}
              </p>
              <div className="space-y-1">
                {pendingChecklist.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 group">
                    <div className="w-4 h-4 rounded border-2 border-muted-foreground/30 shrink-0" />
                    <span className="text-sm flex-1">{item}</span>
                    <button
                      onClick={() => setPendingChecklist(prev => prev.filter((_, j) => j !== i))}
                      className="p-0.5 rounded text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  value={newPendingChecklist}
                  onChange={(e) => setNewPendingChecklist(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newPendingChecklist.trim()) {
                      setPendingChecklist(prev => [...prev, newPendingChecklist.trim()])
                      setNewPendingChecklist('')
                    }
                  }}
                  placeholder="Adicionar item..."
                  className="flex-1 bg-transparent border-b border-border py-1 text-xs outline-none focus:border-primary"
                />
                <button
                  onClick={() => {
                    if (newPendingChecklist.trim()) {
                      setPendingChecklist(prev => [...prev, newPendingChecklist.trim()])
                      setNewPendingChecklist('')
                    }
                  }}
                  disabled={!newPendingChecklist.trim()}
                  className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleCreateCard}
                disabled={creating || !formTitle.trim() || !formDescription.trim() || !formDeadline}
                className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-40"
              >
                {creating ? 'Criando...' : 'Criar card'}
              </button>
              <button
                onClick={resetForm}
                className="py-2 px-4 border border-border rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
          </div>
        </DraggableSheet>
      ) : (
        <Dialog open={open} onOpenChange={(o: boolean) => { if (!o) onClose() }}>
        <DialogContent className="max-w-full sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0" showCloseButton={false} aria-describedby={undefined}>
          <DialogTitle className="sr-only">Card de feedback — {clientName}</DialogTitle>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
            <p className="text-xs text-muted-foreground">
              {clientName} · {postType}
            </p>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary text-muted-foreground">
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_280px] overflow-hidden">
            <div className="overflow-y-auto p-5 space-y-5">
              {!card && !isCreating ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4 text-center">
                  <div className="w-full max-w-md">
                    {allMedia.length > 0 && (
                      <div className="relative rounded-xl overflow-hidden bg-black/5 border border-border mb-4">
                        <div className="h-[280px] relative flex items-center justify-center bg-gradient-to-b from-black/20 to-black/60">
                          {currentMedia && (
                            <MediaPreview
                              url={currentMedia?.url}
                              mediaType={currentMedia?.mediaType}
                              className="w-full h-full object-cover cursor-pointer"
                              poster={currentMedia?.thumbnailUrl}
                              onClick={() => setShowPreview(true)}
                            />
                          )}
                          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
                            <p className="text-white text-xs leading-relaxed line-clamp-3">
                              {postCaption || 'Sem legenda'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    <p className="text-sm font-semibold text-muted-foreground mb-1">Nenhum card de feedback</p>
                    <p className="text-xs text-muted-foreground/70 mb-4">
                      Crie um card para acompanhar alterações deste post.
                    </p>
                    <button
                      onClick={startCreating}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90"
                    >
                      <Plus size={14} /> Criar card de feedback
                    </button>
                    {onEditPost && (
                      <button
                        onClick={onEditPost}
                        className="inline-flex items-center gap-2 px-4 py-2 mt-2 border border-border text-muted-foreground rounded-lg text-xs font-medium hover:text-foreground"
                      >
                        <Pencil size={14} /> Editar post
                      </button>
                    )}
                  </div>
                </div>
              ) : !card && isCreating ? (
                <div className="space-y-4">
                  {/* Media preview - same as view mode */}
                  {allMedia.length > 0 && (
                    <div className="flex gap-4">
                      <div className="relative shrink-0 w-[180px] h-[180px] rounded-xl overflow-hidden bg-black/5 border border-border">
                        {currentMedia && (
                          <MediaPreview
                            url={currentMedia?.url}
                            mediaType={currentMedia?.mediaType}
                            className="w-full h-full object-cover cursor-pointer"
                            poster={currentMedia?.thumbnailUrl}
                            onClick={() => setShowPreview(true)}
                          />
                        )}
                        {allMedia.length > 1 && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); setMediaIndex(i => (i - 1 + allMedia.length) % allMedia.length) }}
                              className="absolute left-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-black/40 text-white hover:bg-black/60"
                            >
                              <ChevronLeft size={14} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setMediaIndex(i => (i + 1) % allMedia.length) }}
                              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-black/40 text-white hover:bg-black/60"
                            >
                              <ChevronRight size={14} />
                            </button>
                          </>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        {formPriority === 'urgente' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-destructive/10 text-destructive border-destructive/20 flex items-center gap-1 w-fit mb-1">
                            <AlertCircle size={10} /> Urgente
                          </span>
                        )}
                        <p className="text-sm font-semibold">{clientName}</p>
                        <p className="text-xs text-muted-foreground">
                          {clientHandle ? `@${clientHandle}` : `@${clientName.replace(/\s+/g, '').toLowerCase()}`}
                        </p>
                        {scheduledAt && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(scheduledAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                        <p className="text-xs leading-relaxed line-clamp-4 text-muted-foreground">
                          {postCaption || 'Sem legenda'}
                        </p>
                      </div>
                    </div>
                  )}
                  {allMedia.length > 1 && (
                    <div className="flex gap-1.5">
                      {allMedia.map((media, i) => (
                        <button
                          key={i}
                          onClick={() => setMediaIndex(i)}
                          className={cn(
                            "w-10 h-10 rounded-lg overflow-hidden border-2 shrink-0 transition-all",
                            i === mediaIndex ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
                          )}
                        >
                          <MediaPreview url={media.url} mediaType={media.mediaType} thumbnail className="w-full h-full" />
                        </button>
                      ))}
                    </div>
                  )}

                  <p className="text-sm font-semibold">{clientName} · Novo card</p>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Título *</p>
                    <input
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="Ex: Ajustar cor do texto"
                      className="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Descrição *</p>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Descreva a alteração necessária..."
                      rows={3}
                      className="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Data solicitada</p>
                      <input
                        type="datetime-local"
                        value={formRequestedAt}
                        onChange={(e) => setFormRequestedAt(e.target.value)}
                        className="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Prazo *</p>
                      <input
                        type="datetime-local"
                        value={formDeadline}
                        onChange={(e) => setFormDeadline(e.target.value)}
                        className="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Versão</p>
                      <Select value={formVersionName || '__all__'} onValueChange={(v) => setFormVersionName(v === '__all__' ? '' : v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Todas as versões" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Todas as versões</SelectItem>
                          {versions?.map(v => (
                            <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Prioridade</p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setFormPriority('normal')}
                          className={cn(
                            "flex-1 text-[11px] px-2 py-1.5 rounded-lg font-bold border transition-colors",
                            formPriority === 'normal'
                              ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                              : 'bg-secondary/30 text-muted-foreground border-border hover:border-muted-foreground/30'
                          )}
                        >
                          Normal
                        </button>
                        <button
                          onClick={() => setFormPriority('urgente')}
                          className={cn(
                            "flex-1 text-[11px] px-2 py-1.5 rounded-lg font-bold border transition-colors",
                            formPriority === 'urgente'
                              ? 'bg-destructive/10 text-destructive border-destructive/30'
                              : 'bg-secondary/30 text-muted-foreground border-border hover:border-muted-foreground/30'
                          )}
                        >
                          Urgente
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Status - segmented control style like view mode */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Status</p>
                    <div className="flex gap-0.5 bg-secondary/30 rounded-lg p-0.5 border border-border w-fit">
                      {STATUS_ORDER.map((s) => (
                        <button
                          key={s}
                          onClick={() => setFormStatus(s)}
                          className={cn(
                            "text-[10px] px-2.5 py-1 rounded-md font-bold transition-all",
                            formStatus === s
                              ? 'bg-card text-foreground shadow-sm border'
                              : 'text-muted-foreground/50 hover:text-foreground'
                          )}
                        >
                          {STATUS_LABEL[s]}
                        </button>
                      ))}
                    </div>
                  </div>

            {/* Tags */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {formTags.map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium border" style={{ backgroundColor: `${tag.color}18`, borderColor: `${tag.color}40`, color: tag.color }}>
                    {tag.name}
                    <button onClick={() => setFormTags(formTags.filter((_, j) => j !== i))} className="hover:opacity-70"><X size={10} /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)} className="w-7 h-7 border border-border cursor-pointer" />
                <input value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder="Nome da tag" className="flex-1 bg-secondary/30 border border-border px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary" onKeyDown={e => { if (e.key === 'Enter' && newTagName.trim()) { setFormTags([...formTags, { name: newTagName.trim(), color: newTagColor }]); setNewTagName('') } }} />
                <button onClick={() => { if (newTagName.trim()) { setFormTags([...formTags, { name: newTagName.trim(), color: newTagColor }]); setNewTagName('') } }} className="px-2 py-1 bg-secondary border border-border text-xs font-medium hover:bg-muted transition-colors"><Plus size={12} /></button>
              </div>
            </div>

            {/* Attachments - working */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Anexos · {pendingAttachments.length}
                      </p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    {pendingAttachments.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {pendingAttachments.map((att, i) => (
                          <div key={i} className="group relative rounded-lg border border-border overflow-hidden bg-secondary/20 aspect-square">
                            {att.preview ? (
                              <img src={att.preview} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground">
                                <File size={20} />
                                <span className="text-[8px] truncate max-w-full px-1">{att.file.name}</span>
                              </div>
                            )}
                            <button
                              onClick={() => setPendingAttachments(prev => prev.filter((_, j) => j !== i))}
                              className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files
                        if (files) {
                          Array.from(files).forEach(file => {
                            if (file.size > 5 * 1024 * 1024) {
                              toast.error(`${file.name} excede 5MB`)
                              return
                            }
                            const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
                            setPendingAttachments(prev => [...prev, { file, preview }])
                          })
                        }
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      multiple
                    />
                  </div>

                  {/* Checklist - working */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                      Checklist · {pendingChecklist.filter(() => false).length}/{pendingChecklist.length}
                    </p>
                    <div className="space-y-1">
                      {pendingChecklist.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 group">
                          <div className="w-4 h-4 rounded border-2 border-muted-foreground/30 shrink-0" />
                          <span className="text-sm flex-1">{item}</span>
                          <button
                            onClick={() => setPendingChecklist(prev => prev.filter((_, j) => j !== i))}
                            className="p-0.5 rounded text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        value={newPendingChecklist}
                        onChange={(e) => setNewPendingChecklist(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newPendingChecklist.trim()) {
                            setPendingChecklist(prev => [...prev, newPendingChecklist.trim()])
                            setNewPendingChecklist('')
                          }
                        }}
                        placeholder="Adicionar item..."
                        className="flex-1 bg-transparent border-b border-border py-1 text-xs outline-none focus:border-primary"
                      />
                      <button
                        onClick={() => {
                          if (newPendingChecklist.trim()) {
                            setPendingChecklist(prev => [...prev, newPendingChecklist.trim()])
                            setNewPendingChecklist('')
                          }
                        }}
                        disabled={!newPendingChecklist.trim()}
                        className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={handleCreateCard}
                      disabled={creating || !formTitle.trim() || !formDescription.trim() || !formDeadline}
                      className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-40"
                    >
                      {creating ? 'Criando...' : 'Criar card'}
                    </button>
                    <button
                      onClick={resetForm}
                      className="py-2 px-4 border border-border rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : card ? (
                <>
              {/* Media + Info Row */}
              {allMedia.length > 0 && (
                <>
                  <div className="flex gap-4">
                    <div className="relative shrink-0 w-[180px] h-[180px] rounded-xl overflow-hidden bg-black/5 border border-border">
                      {currentMedia && (
                        <MediaPreview
                          url={currentMedia?.url}
                          mediaType={currentMedia?.mediaType}
                          className="w-full h-full object-cover cursor-pointer"
                          poster={currentMedia?.thumbnailUrl}
                          onClick={() => setShowPreview(true)}
                        />
                      )}
                      {allMedia.length > 1 && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); setMediaIndex(i => (i - 1 + allMedia.length) % allMedia.length) }}
                            className="absolute left-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-black/40 text-white hover:bg-black/60"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setMediaIndex(i => (i + 1) % allMedia.length) }}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-black/40 text-white hover:bg-black/60"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      {currentlyUrgent && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-destructive/10 text-destructive border-destructive/20 flex items-center gap-1 w-fit mb-1">
                          <AlertCircle size={10} /> Urgente
                        </span>
                      )}
                      <p className="text-sm font-semibold">{clientName}</p>
                      <p className="text-xs text-muted-foreground">
                        {clientHandle ? `@${clientHandle}` : `@${clientName.replace(/\s+/g, '').toLowerCase()}`}
                      </p>
                      {scheduledAt && (
                        <p className="text-xs text-muted-foreground">
                          {new Date(scheduledAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      <p className="text-xs leading-relaxed line-clamp-4 text-muted-foreground">
                        {postCaption || 'Sem legenda'}
                      </p>
                    </div>
                  </div>
                  {allMedia.length > 1 && (
                    <div className="flex gap-1.5">
                      {allMedia.map((media, i) => (
                        <button
                          key={i}
                          onClick={() => setMediaIndex(i)}
                          className={cn(
                            "w-10 h-10 rounded-lg overflow-hidden border-2 shrink-0 transition-all",
                            i === mediaIndex ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
                          )}
                        >
                          <MediaPreview url={media.url} mediaType={media.mediaType} thumbnail className="w-full h-full" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Title + Check */}
              <div className="flex items-start gap-2">
                <button
                  onClick={handleMarkDone}
                  className={cn(
                    "mt-0.5 p-0.5 rounded-full border transition-colors shrink-0",
                    card.status === 'aprovado'
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-muted-foreground/30 text-muted-foreground/30 hover:border-emerald-400 hover:text-emerald-400'
                  )}
                >
                  <Check size={14} />
                </button>
                <div className="min-w-0 flex-1">
                  <h2 className={cn(
                    "text-base font-semibold",
                    card.status === 'aprovado' && 'line-through text-muted-foreground'
                  )}>
                    {card.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {/* Status badges as selectable group */}
                    <div className="flex gap-0.5 bg-secondary/30 rounded-lg p-0.5 border border-border">
                      {STATUS_ORDER.map((s) => (
                        <button
                          key={s}
                          onClick={() => actions.updateCard(card.id, { status: s })}
                          className={cn(
                            "text-[10px] px-2.5 py-1 rounded-md font-bold transition-all",
                            card.status === s
                              ? 'bg-card text-foreground shadow-sm border'
                              : 'text-muted-foreground/50 hover:text-foreground'
                          )}
                        >
                          {STATUS_LABEL[s]}
                        </button>
                      ))}
                    </div>
                    {/* Version badge */}
                    {card.version_name && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-muted/30 text-muted-foreground border-border">
                        {card.version_name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    {card.requested_at && (
                      <span className="text-muted-foreground">
                        Solicitada: {formatDeadline(card.requested_at)}
                      </span>
                    )}
                    <span className={cn(
                      "flex items-center gap-1",
                      isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground'
                    )}>
                      <Calendar size={12} />
                      Prazo: {formatDeadline(card.deadline)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Descrição</p>
                <div className="bg-secondary/30 border border-border rounded-lg p-3 text-sm leading-relaxed">
                  {card.description}
                </div>
              </div>

              {/* Tags */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {(card.tags || []).map((tag, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border" style={{ backgroundColor: tag.color + '20', borderColor: tag.color + '40', color: tag.color }}>
                      {tag.name}
                      <button onClick={() => {
                        const newTags = (card.tags || []).filter((_, idx) => idx !== i)
                        actions.updateCard(card.id, { tags: newTags })
                      }} className="ml-0.5 hover:opacity-70">×</button>
                    </span>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={e => setNewTagColor(e.target.value)}
                      className="w-5 h-5 rounded cursor-pointer border-0 p-0"
                    />
                    <input
                      value={newTagName}
                      onChange={e => setNewTagName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newTagName.trim()) {
                          const newTags = [...(card.tags || []), { name: newTagName.trim(), color: newTagColor }]
                          actions.updateCard(card.id, { tags: newTags })
                          setNewTagName('')
                        }
                      }}
                      placeholder="Nova tag..."
                      className="text-[10px] w-16 bg-transparent outline-none"
                    />
                    <button
                      onClick={() => {
                        if (newTagName.trim()) {
                          const newTags = [...(card.tags || []), { name: newTagName.trim(), color: newTagColor }]
                          actions.updateCard(card.id, { tags: newTags })
                          setNewTagName('')
                        }
                      }}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >+</button>
                  </div>
                </div>
              </div>

              {/* Audit trail */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                {card.created_by && (
                  <span>Criado por <strong>{card.created_by}</strong></span>
                )}
                <span>{formatDateTime(card.created_at)}</span>
                {card.completed_at && (
                  <span className="text-emerald-500">Concluído em {formatDateTime(card.completed_at)}</span>
                )}
              </div>

              {/* Attachments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Anexos · {card.attachments.length}
                  </p>
                  <AddAttachmentButton cardId={card.id} onAdd={actions.addAttachment} />
                </div>
                {card.attachments.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {card.attachments.map((att: FeedbackCardAttachment) => (
                      <div key={att.id} className="group relative rounded-lg border border-border overflow-hidden bg-secondary/20 aspect-square">
                        {att.type === 'image' ? (
                          <img src={att.url} alt={att.name || ''} className="w-full h-full object-cover" />
                        ) : (
                          <a href={att.url} target="_blank" rel="noreferrer" className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground p-2">
                            <Link size={20} />
                            <span className="text-[10px] truncate max-w-full">{att.name || att.url}</span>
                          </a>
                        )}
                        <button
                          onClick={() => actions.removeAttachment(att.id)}
                          className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Checklist */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Checklist · {card.checklist.filter((i: FeedbackCardChecklistItem) => i.checked).length}/{card.checklist.length}
                </p>
                <div className="space-y-1">
                  {card.checklist.map((item: FeedbackCardChecklistItem) => (
                    <div key={item.id} className="flex items-center gap-2 group">
                      <button
                        onClick={() => actions.toggleChecklistItem(item.id, !item.checked)}
                        className={cn(
                          "w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors",
                          item.checked
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-muted-foreground/30 hover:border-emerald-400'
                        )}
                      >
                        {item.checked && <Check size={10} />}
                      </button>
                      <span className={cn(
                        "text-sm flex-1",
                        item.checked && 'line-through text-muted-foreground'
                      )}>
                        {item.text}
                      </span>
                      <button
                        onClick={() => actions.removeChecklistItem(item.id)}
                        className="p-0.5 rounded text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddChecklist() }}
                    placeholder="Adicionar item..."
                    className="flex-1 bg-transparent border-b border-border py-1 text-xs outline-none focus:border-primary"
                  />
                  <button
                    onClick={handleAddChecklist}
                    disabled={!newChecklistText.trim()}
                    className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Edit post button */}
              {onEditPost && (
                <Button onClick={onEditPost} variant="outline" className="w-full gap-2">
                  <Pencil size={14} /> Editar post
                </Button>
              )}
                </>
              ) : null}
            </div>

            {/* RIGHT PANEL - Comments */}
            {card && (
            <div className="border-t md:border-t-0 md:border-l border-border flex flex-col overflow-hidden bg-muted/20">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4 py-3 border-b border-border shrink-0">
                Comentários · {card!.comments.length}
              </p>
              <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                {card!.comments.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">Nenhum comentário ainda</p>
                )}
                {card!.comments.map((comment: FeedbackCardComment) => (
                  <div key={comment.id} className="text-sm">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-semibold text-foreground">{comment.author_name}</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-muted-foreground">{formatDateTime(comment.created_at)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{comment.message}</p>
                  </div>
                ))}
              </div>
              <div className="shrink-0 border-t border-border p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={commentInputRef}
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment() }
                    }}
                    placeholder="Escreva um comentário..."
                    rows={1}
                    className="flex-1 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs resize-none outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newCommentText.trim()}
                    className="p-2 bg-primary text-primary-foreground rounded-lg shrink-0 disabled:opacity-40"
                  >
                    <Send size={12} />
                  </button>
                </div>
              </div>
            </div>
            )}
          </div>
        </DialogContent>
       </Dialog>
       )}

       {/* Media Preview Modal */}
      <Dialog open={showPreview} onOpenChange={(o: boolean) => { if (!o) setShowPreview(false) }}>
        <DialogContent className="max-w-full sm:max-w-4xl max-h-[90vh] overflow-hidden p-0 gap-0" showCloseButton={false} aria-describedby={undefined}>
          <DialogTitle className="sr-only">Preview de mídia</DialogTitle>
          <div className="relative flex items-center justify-center bg-black/90 min-h-[60vh]">
             {currentMedia?.mediaType === 'video' || isVideoUrl(currentMedia?.url || '') ? (
              <video src={currentMedia?.url} controls autoPlay className="max-w-full max-h-[85vh]" />
            ) : (
              <img src={currentMedia?.url} alt="" className="max-w-full max-h-[85vh] object-contain" />
            )}
            {allMedia.length > 1 && (
              <>
                <button
                  onClick={() => setMediaIndex(i => (i - 1 + allMedia.length) % allMedia.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/25"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  onClick={() => setMediaIndex(i => (i + 1) % allMedia.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/25"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}
            <button
              onClick={() => setShowPreview(false)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-white/10 text-white hover:bg-white/25"
            >
              <X size={20} />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function AddAttachmentButton({ cardId, onAdd }: { cardId: string; onAdd: FeedbackCardActions['addAttachment'] }) {
  const [open, setOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkName, setLinkName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file, { maxDimension: 1200, quality: 0.75 })
    const fileName = `attachments/${cardId}/${Date.now()}_${file.name.replace(/\.[^.]+$/, '')}.webp`
    const publicUrl = await uploadMedia(compressed, fileName).catch(() => null)
    if (!publicUrl) { console.error('Upload error'); return }
    await onAdd(cardId, 'image', publicUrl, file.name)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleAddLink = async () => {
    if (!linkUrl.trim()) return
    await onAdd(cardId, 'link', linkUrl.trim(), linkName.trim() || undefined)
    setLinkUrl('')
    setLinkName('')
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary"
      >
        <Plus size={14} />
      </button>
      {open && (
        <div className="absolute top-6 right-0 z-10 w-56 bg-popover border border-border rounded-lg shadow-lg p-3 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Adicionar anexo</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-secondary"
          >
            <Image size={12} /> Imagem
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <div className="border-t border-border pt-2 space-y-1.5">
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="URL do link"
              className="w-full bg-secondary/30 border border-border rounded px-2 py-1 text-xs outline-none"
            />
            <input
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              placeholder="Nome (opcional)"
              className="w-full bg-secondary/30 border border-border rounded px-2 py-1 text-xs outline-none"
            />
            <button
              onClick={handleAddLink}
              disabled={!linkUrl.trim()}
              className="w-full py-1 bg-primary text-primary-foreground rounded text-xs font-medium disabled:opacity-40"
            >
              Adicionar link
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
