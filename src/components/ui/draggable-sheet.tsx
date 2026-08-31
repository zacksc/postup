import * as React from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const m = window.matchMedia(query)
    setMatches(m.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    m.addEventListener('change', handler)
    return () => m.removeEventListener('change', handler)
  }, [query])
  return matches
}

interface DraggableSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
  showCloseButton?: boolean
}

type SheetState = 'sheet' | 'fullscreen' | 'dragging'

export function DraggableSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  showCloseButton = true,
}: DraggableSheetProps) {
  const [state, setState] = React.useState<SheetState>('sheet')
  const [dragY, setDragY] = React.useState(0)
  const dragStart = React.useRef(0)
  const dragStartY = React.useRef(0)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const isMobile = useMediaQuery('(max-width: 767px)')

  function handlePointerDown(e: React.PointerEvent) {
    if (!isMobile) return
    dragStart.current = e.clientY
    dragStartY.current = 0
    setState('dragging')
    contentRef.current?.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (state !== 'dragging') return
    const delta = e.clientY - dragStart.current
    dragStartY.current = delta
    setDragY(delta)
  }

  function handlePointerUp() {
    if (state !== 'dragging') return
    setState('sheet')
    setDragY(0)
    if (dragStartY.current > 80) {
      onOpenChange(false)
    } else if (dragStartY.current < -80 && isMobile) {
      setState('fullscreen')
    }
  }

  const isFull = state === 'fullscreen'
  const isDragging = state === 'dragging'

  const sheetHeight = isFull ? '100dvh' : '70vh'
  const translateY = isDragging ? Math.max(0, dragY) : 0

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { if (!o) { setState('sheet'); onOpenChange(false) }} }>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/40 duration-100 supports-backdrop-filter:backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        />
        <DialogPrimitive.Content
          ref={contentRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none duration-100',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-6',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-6',
            isMobile ? '' : 'sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[85vh] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
            className,
          )}
          style={{
            height: isMobile ? sheetHeight : undefined,
            transform: isMobile && isDragging ? `translateY(${translateY}px)` : undefined,
            transition: isDragging ? 'none' : undefined,
          }}
        >
          {/* Drag handle + close button */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 pt-3 pb-1 bg-popover/90 backdrop-blur-sm border-b border-border">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {isMobile && (
                <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
              )}
              {title && (
                <DialogPrimitive.Title className="truncate text-sm font-semibold">
                  {title}
                </DialogPrimitive.Title>
              )}
              {description && (
                <DialogPrimitive.Description className="text-[10px] text-muted-foreground truncate">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            {showCloseButton && (
              <DialogPrimitive.Close className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                <XIcon size={18} />
                <span className="sr-only">Fechar</span>
              </DialogPrimitive.Close>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-2">
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
