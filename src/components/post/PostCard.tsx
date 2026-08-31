import { cn, formatDateShort } from '@/lib/utils'
import { Calendar, Image as ImageIcon, Video, Layers } from 'lucide-react'
import { MediaPreview } from '@/components/post/MediaPreview'

// 1. A Interface Central do Domínio (O Contrato do que é um Post)
export interface Post {
  id: string;
  type: 'reels' | 'carrossel' | 'foto' | 'stories' | 'design';
  caption?: string;
  scheduled_at: string;
  status: 'aprovado' | 'aguardando' | 'em_alteracao' | 'rascunho' | 'publicado';
  client?: {
    name: string;
    color?: string;
  };
  files?: { url: string; mediaType?: 'image' | 'video' }[];
}

export interface PostCardProps {
  post: Post;
  variant?: 'list' | 'compact' | 'carousel' | 'kanban';
  className?: string;
  onClick?: () => void;
}

// O Record<Post['status'], ...> obriga você a tipar TODAS as opções possíveis de status.
const statusConfig: Record<Post['status'], { color: string; label: string }> = {
  aprovado: { color: 'bg-success/10 text-success border-success/20', label: 'Aprovado' },
  aguardando: { color: 'bg-warning/10 text-warning border-warning/20', label: 'Aguardando' },
  em_alteracao: { color: 'bg-destructive/10 text-destructive border-destructive/20', label: 'Alterar' },
  rascunho: { color: 'bg-muted/10 text-muted-foreground border-muted/20', label: 'Rascunho' },
  publicado: { color: 'bg-primary/10 text-primary border-primary/20', label: 'Publicado' },
}

const typeIcons = {
  reels: Video,
  carrossel: Layers,
  foto: ImageIcon,
  stories: Video,
  design: ImageIcon,
}

export function PostCard({ 
  post, 
  variant = 'list', 
  className, 
  onClick 
}: PostCardProps) {
  const { type, caption, scheduled_at, status, files, client } = post
  
  const StatusBadge = statusConfig[status] || statusConfig.rascunho
  const TypeIcon = typeIcons[type] || ImageIcon

  const isList = variant === 'list'
  const isCompact = variant === 'compact'
  const isKanban = variant === 'kanban'

  return (
    <div 
      onClick={onClick}
      className={cn(
        "group relative flex overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/50 cursor-pointer",
        isList && "flex-row h-28 w-full p-3 gap-4",
        isCompact && "flex-row h-16 w-full p-2 gap-3 items-center",
        isKanban && "flex-col w-full p-3 gap-3", // Preparando o terreno para o KanbanColumn depois
        className
      )}
    >
      <div className={cn(
        "relative shrink-0 overflow-hidden rounded-lg bg-secondary",
        isList && "h-full w-20",
        isCompact && "h-12 w-12",
        isKanban && "h-32 w-full"
      )}>
        {files?.[0]?.url ? (
          <MediaPreview url={files[0].url} mediaType={files[0].mediaType} thumbnail className="h-full w-full" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
            <TypeIcon size={isCompact ? 16 : 24} />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between py-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {client?.name || 'Sem cliente'}
          </p>
          {!isCompact && (
            <span className={cn(
              "whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              StatusBadge.color
            )}>
              {StatusBadge.label}
            </span>
          )}
        </div>

        <p className={cn(
          "truncate text-muted-foreground", 
          isList ? "text-xs mt-1" : "text-[11px]",
          isKanban && "mt-2 whitespace-normal line-clamp-2" // No kanban a legenda pode ter 2 linhas
        )}>
          {caption || "Nenhuma legenda informada..."}
        </p>

        {!isCompact && (
          <div className="mt-auto pt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar size={13} />
              <span>{scheduled_at ? formatDateShort(scheduled_at) : 'Sem data'}</span>
            </div>
            {isList && (
              <div className="flex items-center gap-1.5">
                <TypeIcon size={13} />
                <span className="capitalize">{type}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}