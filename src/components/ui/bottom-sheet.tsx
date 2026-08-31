import * as React from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
  showCloseButton?: boolean
}

// Bottom sheet — modal que desliza de baixo no mobile e vira um modal centralizado no desktop.
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  showCloseButton = true,
}: BottomSheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/40 duration-100 supports-backdrop-filter:backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] w-full flex-col rounded-t-2xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none duration-100',
            'sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[85vh] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
            'data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-6 sm:data-open:slide-in-from-bottom-0 sm:data-open:zoom-in-95',
            'data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-6 sm:data-closed:slide-out-to-bottom-0 sm:data-closed:zoom-out-95',
            className,
          )}
        >
          <div className="flex shrink-0 items-center justify-center pt-2.5 sm:hidden" aria-hidden="true">
            <div className="h-1.5 w-12 rounded-full bg-muted-foreground/25" />
          </div>
          {(title || showCloseButton) && (
            <div className="flex shrink-0 items-start justify-between gap-2 px-4 pt-2 pb-1">
              <div className="min-w-0 flex-1">
                {title && (
                  <DialogPrimitive.Title className="truncate text-base font-semibold">
                    {title}
                  </DialogPrimitive.Title>
                )}
                {description && (
                  <DialogPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
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
          )}
          <div className={cn('flex-1 overflow-y-auto px-4 pb-6 pt-2', className)}>
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
