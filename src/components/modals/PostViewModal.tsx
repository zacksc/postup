import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, Calendar, Clock, Camera, Film } from 'lucide-react'
import { MediaPreview } from '@/components/post/MediaPreview'
import { cn, isVideoUrl, resolveThumbMedia } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  aguardando: 'A Fazer',
  alteracao: 'Em Andamento',
  aprovado: 'Aprovado',
  publicado: 'Publicado',
}

const STATUS_COLORS: Record<string, string> = {
  rascunho: 'bg-gray-400/15 text-gray-600 border-gray-400/30',
  aguardando: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
  alteracao: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  aprovado: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  publicado: 'bg-primary/15 text-primary border-primary/30',
}

interface PostViewModalProps {
  open: boolean
  onClose: () => void
  post: {
    id: string
    clientName: string
    clientHandle: string
    clientColor: string
    type: string
    caption: string
    scheduled_at: string
    status: string
    media_urls: string[]
    platform?: string
  } | null
}

export function PostViewModal({ open, onClose, post }: PostViewModalProps) {
  const [mediaIndex, setMediaIndex] = useState(0)

  if (!open || !post) return null

  const media = post.media_urls || []
  const hasMultiple = media.length > 1
  const currentUrl = media[mediaIndex]
  const { poster } = resolveThumbMedia(media)
  const isVideo = currentUrl ? isVideoUrl(currentUrl) : false

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-card w-full max-w-lg rounded-xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: post.clientColor }}
            >
              {post.clientName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-sm font-bold">{post.clientName}</h2>
              {post.clientHandle && (
                <p className="text-[10px] text-muted-foreground">@{post.clientHandle}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Media */}
        {media.length > 0 && (
          <div className="relative bg-black aspect-square max-h-[400px]">
            <MediaPreview
              url={currentUrl}
              mediaType={isVideo ? 'video' : 'image'}
              className="w-full h-full object-contain"
              poster={poster}
            />
            {hasMultiple && (
              <>
                <button
                  onClick={() => setMediaIndex(i => (i - 1 + media.length) % media.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setMediaIndex(i => (i + 1) % media.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {media.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setMediaIndex(i)}
                      className={cn(
                        "w-1.5 h-1.5 rounded-full transition-colors",
                        i === mediaIndex ? "bg-white" : "bg-white/40"
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {/* Status + Type + Platform */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-full font-bold border",
              STATUS_COLORS[post.status] || 'bg-gray-400/15 text-gray-600 border-gray-400/30'
            )}>
              {STATUS_LABELS[post.status] || post.status}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-secondary/30 text-muted-foreground border border-border">
              {post.type}
            </span>
            {post.platform && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-secondary/30 text-muted-foreground border border-border flex items-center gap-1">
                {post.platform === 'instagram' ? <Camera size={10} /> : <Film size={10} />}
                {post.platform}
              </span>
            )}
          </div>

          {/* Schedule */}
          {post.scheduled_at && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {format(new Date(post.scheduled_at), "dd 'de' MMMM", { locale: ptBR })}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {format(new Date(post.scheduled_at), 'HH:mm')}
              </span>
            </div>
          )}

          {/* Caption */}
          {post.caption && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Legenda</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.caption}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
