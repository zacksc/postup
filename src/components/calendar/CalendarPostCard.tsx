import { format } from 'date-fns'
import { Play, Images, Camera, Circle, Paintbrush, CheckSquare, Square, type LucideIcon } from 'lucide-react'
import { MediaPreview } from '@/components/post/MediaPreview'
import { PostHoverPreview } from '@/components/calendar/PostHoverPreview'
import { resolveThumbMedia, cn } from '@/lib/utils'

const TYPE_ICONS: Record<string, LucideIcon> = {
  reels: Play,
  carrossel: Images,
  foto: Camera,
  stories: Circle,
  design: Paintbrush,
}

const STATUS_BG: Record<string, string> = {
  publicado: 'bg-blue-500/15',
  aprovado: 'bg-emerald-500/15',
  aguardando: 'bg-orange-500/15',
  alteracao: 'bg-red-500/15',
  rascunho: 'bg-muted-foreground/15',
}

const STATUS_BORDER: Record<string, string> = {
  publicado: 'border-blue-500/30',
  aprovado: 'border-emerald-500/30',
  aguardando: 'border-orange-500/30',
  alteracao: 'border-red-500/30',
  rascunho: 'border-muted-foreground/30',
}

interface CalendarPostItem {
  id: string
  clientName: string
  clientColor: string
  type: string
  caption: string
  scheduledAt: Date
  status: string
  mediaUrls: string[]
  profilePhoto?: string
}

interface CalendarPostCardProps {
  post: CalendarPostItem
  onClick?: () => void
  selectMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}

export function CalendarPostCard({ post, onClick, selectMode, selected, onToggleSelect }: CalendarPostCardProps) {
  const Icon = TYPE_ICONS[post.type.toLowerCase()] || Camera
  const { url: thumbUrl, poster: thumbPoster } = resolveThumbMedia(post.mediaUrls)
  const initial = post.clientName.charAt(0).toUpperCase()
  const captionPreview = post.caption ? post.caption.split(' ').slice(0, 4).join(' ') + (post.caption.split(' ').length > 4 ? '...' : '') : ''

  return (
    <div className="relative group">
      {selectMode && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect?.() }}
          className={cn(
            "absolute -top-1 -left-1 z-20 w-4 h-4 rounded-sm flex items-center justify-center transition-colors",
            selected ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'
          )}
        >
          {selected ? <CheckSquare size={10} /> : <Square size={10} />}
        </button>
      )}
      <PostHoverPreview
        mediaUrl={thumbUrl}
        mediaType={thumbPoster ? 'video' : 'image'}
        title={post.clientName}
        subtitle={format(post.scheduledAt, 'HH:mm')}
        caption={post.caption}
        status={post.status}
        color={post.clientColor}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onClick?.() }}
          className={cn(
            "w-full text-left relative flex transition-all duration-200 border overflow-hidden h-[52px] rounded-lg",
            "hover:shadow-md hover:-translate-y-0.5",
          STATUS_BG[post.status] || 'bg-muted-foreground/15',
          STATUS_BORDER[post.status] || 'border-muted-foreground/30',
          )}
        >
          {/* Avatar no canto superior esquerdo */}
          <div className="absolute top-1 left-1 z-10">
            {post.profilePhoto ? (
              <img src={post.profilePhoto} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
            ) : (
              <div
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[6px] font-bold text-white"
                style={{ backgroundColor: post.clientColor }}
              >
                {initial}
              </div>
            )}
          </div>

          {/* Conteúdo à esquerda */}
          <div className="flex-1 min-w-0 flex flex-col justify-between px-1.5 py-1 pl-5">
            <span className="text-[8px] font-semibold truncate text-foreground">
              {post.clientName.split(' ')[0]}
            </span>
            {captionPreview && (
              <span className="text-[7px] text-muted-foreground truncate leading-tight block">
                {captionPreview}
              </span>
            )}
            <div className="flex items-center gap-1">
              <Icon size={6} className="text-muted-foreground shrink-0" />
              <span className="text-[7px] font-mono text-muted-foreground">{format(post.scheduledAt, 'HH:mm')}</span>
            </div>
          </div>

          {/* Mídia à direita */}
          {thumbUrl && (
            <div className="w-12 h-full shrink-0 overflow-hidden bg-muted">
              <MediaPreview url={thumbUrl} poster={thumbPoster} thumbnail className="w-full h-full object-cover" />
            </div>
          )}
        </button>
      </PostHoverPreview>
    </div>
  )
}
