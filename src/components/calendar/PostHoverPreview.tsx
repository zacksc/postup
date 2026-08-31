import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { MediaPreview } from '@/components/post/MediaPreview'

const STATUS_CLASS: Record<string, string> = {
  aprovado: 'bg-success/10 text-success border-success/20',
  aguardando: 'bg-warning/10 text-warning border-warning/20',
  alteracao: 'bg-destructive/10 text-destructive border-destructive/20',
  em_alteracao: 'bg-destructive/10 text-destructive border-destructive/20',
  rascunho: 'bg-muted/10 text-muted-foreground border-muted/20',
  publicado: 'bg-primary/10 text-primary border-primary/20',
}

const STATUS_LABEL: Record<string, string> = {
  aprovado: 'Aprovado',
  aguardando: 'Aguardando',
  alteracao: 'Alteração',
  em_alteracao: 'Alteração',
  rascunho: 'Rascunho',
  publicado: 'Publicado',
}

interface PostHoverPreviewProps {
  mediaUrl?: string | null
  mediaType?: 'image' | 'video'
  title: string
  subtitle?: string
  caption?: string
  status?: string
  color?: string
  children: ReactNode
}

const GAP = 14
const CARD_WIDTH = 224
const CARD_HEIGHT = 330

// Preview flutuante que segue o cursor do mouse, renderizado via portal no <body>
// para nunca ser cortado por overflow ou coberto por outro stacking context.
export function PostHoverPreview({
  mediaUrl,
  mediaType,
  title,
  subtitle,
  caption,
  status,
  color,
  children,
}: PostHoverPreviewProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function show() {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setOpen(true)
  }

  function handleMove(e: React.MouseEvent) {
    let x = e.clientX + GAP
    let y = e.clientY + GAP
    if (x + CARD_WIDTH > window.innerWidth - 8) x = Math.max(8, e.clientX - CARD_WIDTH - GAP)
    if (y + CARD_HEIGHT > window.innerHeight - 8) y = Math.max(8, e.clientY - CARD_HEIGHT - GAP)
    setPos({ x, y })
  }

  function scheduleHide() {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setOpen(false), 100)
  }

  const label = status ? STATUS_LABEL[status] : undefined
  const statusClass = status ? STATUS_CLASS[status] : undefined

  return (
    <div ref={wrapRef} className="w-full" onMouseEnter={show} onMouseMove={handleMove} onMouseLeave={scheduleHide}>
      {children}
      {open && createPortal(
        <div
          className="fixed z-[100] w-56 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xl"
          style={{ left: pos.x, top: pos.y }}
          onMouseEnter={() => { if (hideTimer.current) clearTimeout(hideTimer.current) }}
          onMouseLeave={scheduleHide}
        >
          <div className="aspect-square w-full bg-muted">
            {mediaUrl ? (
              <MediaPreview url={mediaUrl} mediaType={mediaType} className="h-full w-full" controls={mediaType === 'video'} autoPlay={mediaType === 'video'} />
            ) : (
              <div className="flex h-full items-center justify-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
                Sem mídia
              </div>
            )}
          </div>
          <div className="space-y-1.5 p-2.5">
            <div className="flex items-center gap-2">
              {color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
              <span className="truncate text-xs font-semibold">{title}</span>
            </div>
            {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
            {caption && (
              <p className="line-clamp-2 text-[11px] leading-snug text-foreground/80">{caption}</p>
            )}
            {label && (
              <span className={cn('inline-block rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider', statusClass)}>
                {label}
              </span>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
