import { useState } from 'react'
import { cn, isVideoUrl, getDriveFileId } from '@/lib/utils'
import { AlertCircle, Play, Maximize2 } from 'lucide-react'
import { MediaLightbox, type LightboxItem } from '@/components/post/MediaLightbox'
import { useVideoPoster } from '@/hooks/use-video-poster'

interface MediaPreviewProps {
  url?: string | null
  mediaType?: 'image' | 'video'
  className?: string
  alt?: string
  controls?: boolean
  autoPlay?: boolean
  muted?: boolean
  loop?: boolean
  poster?: string
  /**
   * Modo miniatura: vídeos viram uma imagem estática (capa enviada ou frame
   * extraído do próprio vídeo) — NUNCA autoplay na thumbnail. Usado em grids,
   * cronograma, kanban, import, etc.
   */
  thumbnail?: boolean
  clickable?: boolean
  lightboxItems?: LightboxItem[]
  onClick?: () => void
}

// Thumbnail do Drive: o <video> do Chrome recusa URLs `uc?id=...&export=download`
// de vídeos do Drive (Content-Disposition: attachment). A thumbnail sempre
// retorna JPEG e serve de fallback visual quando o <video> falha.
const driveThumbUrl = (url: string): string | null => {
  const id = getDriveFileId(url)
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w640` : null
}

export function MediaPreview({
  url,
  mediaType,
  className,
  alt = '',
  controls = false,
  autoPlay = true,
  muted = true,
  loop = true,
  poster,
  thumbnail = false,
  clickable = false,
  lightboxItems,
  onClick,
}: MediaPreviewProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [mediaFailed, setMediaFailed] = useState(false)
  const [thumbFailed, setThumbFailed] = useState(false)

  // Reseta os estados de falha quando a URL muda.
  const [lastUrl, setLastUrl] = useState(url)
  if (lastUrl !== url) {
    setLastUrl(url)
    setMediaFailed(false)
    setThumbFailed(false)
  }

  // Capa extraída do próprio vídeo (R2 e outros remotos sem thumbnail própria).
  // Chamado incondicionalmente; desliga quando já há poster explícito (se o
  // usuário enviou capa, não extrai frame).
  const autoPoster = useVideoPoster(poster ? null : (url ?? null))

  if (!url) return null

  const isVideo = mediaType === 'video' || (mediaType !== 'image' && isVideoUrl(url))
  const isDriveVideo = isVideo && !!getDriveFileId(url)
  const thumbUrl = isDriveVideo ? driveThumbUrl(url) : null
  const posterSource = poster || thumbUrl || autoPoster || undefined

  // Cascata de fallback (modo interativo):
  // 1) URL original (video/img).
  // 2) Vídeo do Drive que falhou → thumbnail JPEG do Drive.
  // 3) Vídeo remoto que falhou → frame extraído (autoPoster).
  // 4) Tudo falhou (ou sem fallback) → placeholder.
  const showThumb = mediaFailed && !!posterSource && !thumbFailed
  const showPlaceholder = mediaFailed && (!posterSource || thumbFailed)

  const items: LightboxItem[] = lightboxItems && lightboxItems.length > 0
    ? lightboxItems
    : [{ url, mediaType: isVideo ? 'video' : 'image' }]
  // Se a mídia exibida é uma capa (imagem) e existe vídeo na lista, abre direto no vídeo
  const startIndex = items.length > 1 && !isVideo
    ? Math.max(0, items.findIndex(it => it.mediaType === 'video'))
    : 0

  const videoBadge = (
    <span className="absolute bottom-1 right-1 rounded-full bg-black/50 p-0.5 text-white leading-none">
      <Play size={10} />
    </span>
  )

  let media: React.ReactNode
  if (thumbnail && isVideo) {
    // Miniatura estática: capa enviada ou frame extraído — nunca <video>.
    const content = posterSource && !thumbFailed ? (
      <img
        key={`th-${url}`}
        src={posterSource}
        alt={alt}
        className="w-full h-full object-cover"
        onError={() => setThumbFailed(true)}
      />
    ) : (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <Play size={16} className="text-muted-foreground" />
      </div>
    )
    media = (
      <div className={cn('relative overflow-hidden', clickable ? 'w-full h-full' : className)}>
        {content}
        {videoBadge}
      </div>
    )
  } else if (showThumb) {
    media = (
      <img
        key={`t-${url}`}
        src={posterSource || ''}
        alt={alt}
        className={cn('object-cover', clickable ? 'w-full h-full' : className)}
        onError={() => setThumbFailed(true)}
      />
    )
  } else if (showPlaceholder) {
    media = (
      <div className={cn('flex items-center justify-center bg-muted', clickable ? 'w-full h-full' : className)}>
        <AlertCircle size={22} className="text-muted-foreground" />
      </div>
    )
  } else if (isVideo) {
    media = (
      <video
        key={`v-${url}`}
        src={url}
        poster={posterSource}
        className={cn('object-cover', clickable ? 'w-full h-full' : className)}
        controls={controls}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        playsInline
        preload="metadata"
        onError={() => setMediaFailed(true)}
      />
    )
  } else {
    media = (
      <img
        key={`i-${url}`}
        src={url}
        alt={alt}
        className={cn('object-cover', clickable ? 'w-full h-full' : className)}
        onError={() => setMediaFailed(true)}
      />
    )
  }

  if (!clickable) return media

  return (
    <>
      <div
        className={cn('relative group cursor-zoom-in', className)}
        onClick={(e) => { e.stopPropagation(); if (onClick) onClick(); else setLightboxOpen(true) }}
      >
        {media}
        <div className="absolute top-1.5 right-1.5 bg-black/50 rounded-full p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <Maximize2 size={12} />
        </div>
      </div>
      <MediaLightbox
        key={lightboxOpen ? 'lightbox-open' : 'lightbox-closed'}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        items={items}
        startIndex={startIndex}
      />
    </>
  )
}
