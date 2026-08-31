import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import { downloadMediaUrl } from '@/lib/media-download'
import { driveVideoEmbedUrl, getDriveFileId } from '@/lib/utils'

export interface LightboxItem {
  url: string
  mediaType: 'image' | 'video'
}

interface MediaLightboxProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: LightboxItem[]
  startIndex?: number
}

export function MediaLightbox({ open, onOpenChange, items, startIndex = 0 }: MediaLightboxProps) {
  const [index, setIndex] = useState(startIndex)
  const [lastStartIndex, setLastStartIndex] = useState(startIndex)

  // Ajusta o índice durante o render quando o item de abertura muda
  // (padrão recomendado para derivar estado de prop).
  if (startIndex !== lastStartIndex) {
    setLastStartIndex(startIndex)
    setIndex(startIndex)
  }

  // Navegação pelo teclado: ← / → trocam a mídia (Esc fecha via Dialog).
  useEffect(() => {
    if (!open || items.length < 2) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') setIndex(i => (i - 1 + items.length) % items.length)
      else if (e.key === 'ArrowRight') setIndex(i => (i + 1) % items.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, items.length])

  if (items.length === 0) return null

  const safeIndex = Math.min(Math.max(index, 0), items.length - 1)
  const current = items[safeIndex]
  const poster = items.find(it => it.mediaType === 'image')?.url

  const prev = () => setIndex(i => (i - 1 + items.length) % items.length)
  const next = () => setIndex(i => (i + 1) % items.length)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100%-1rem)] sm:max-w-3xl bg-black/95 ring-white/10 p-0 overflow-hidden"
      >
        <DialogTitle className="sr-only">Mídia do post</DialogTitle>
        <DialogDescription className="sr-only">Visualização da mídia em tela cheia</DialogDescription>

        <div className="relative flex items-center justify-center min-h-[60vh] max-h-[85vh]">
          {current.mediaType === 'video' ? (
            // Vídeos do Google Drive não tocam num <video> (o Chrome recusa o
            // Content-Disposition: attachment do `uc?id=...&export=download`).
            // Para esses, usamos o player de embed nativo do Drive.
            getDriveFileId(current.url) ? (
              <iframe
                key={current.url}
                src={driveVideoEmbedUrl(current.url) || ''}
                title="Player do Google Drive"
                allow="autoplay; fullscreen"
                allowFullScreen
                className="max-w-full max-h-[85vh] w-auto h-auto aspect-video border-0"
              />
            ) : (
              <video
                key={current.url}
                src={current.url}
                poster={poster}
                className="max-w-full max-h-[85vh] w-auto h-auto object-contain"
                controls
                autoPlay
                playsInline
              />
            )
          ) : (
            <img key={current.url} src={current.url} alt="" className="max-w-full max-h-[85vh] w-auto h-auto object-contain" />
          )}

          <button
            aria-label="Baixar mídia"
            onClick={() => void downloadMediaUrl(current.url)}
            className="absolute top-2 right-12 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
          >
            <Download size={18} />
          </button>

          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-2 right-2 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
          >
            <X size={18} />
          </button>

          {items.length > 1 && (
            <>
              <button aria-label="Mídia anterior" onClick={prev} className="absolute left-2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors">
                <ChevronLeft size={22} />
              </button>
              <button aria-label="Próxima mídia" onClick={next} className="absolute right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors">
                <ChevronRight size={22} />
              </button>
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[11px] px-2 py-0.5 rounded">
                {safeIndex + 1}/{items.length}
              </span>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
