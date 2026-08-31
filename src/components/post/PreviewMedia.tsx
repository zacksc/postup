import { useEffect, useRef, useState } from 'react'
import { cn, isVideoUrl } from '@/lib/utils'
import { AlertCircle, ChevronLeft, ChevronRight, Eye, EyeOff, Image as ImageIcon, Volume2, VolumeX } from 'lucide-react'
import { MediaLightbox, type LightboxItem } from '@/components/post/MediaLightbox'
import type { PreviewFile } from '@/components/post/preview-types'

interface PreviewMediaProps {
  /** Mídia REAL do post (sem a capa — a capa tem botão próprio). */
  files: PreviewFile[]
  /** Capa separada do post (imagem). Botão "Capa" aparece quando presente. */
  coverUrl?: string | null
  className?: string
  alt?: string
  poster?: string
  /** Offset vertical dos controles (ex.: "top-12" em previews verticais que têm header no topo). */
  overlayTopClass?: string
  /**
   * Quando true, todos os overlays são visíveis (mute, capa, carrossel).
   * Quando false ("modo limpo"), só o botão olho permanece — limpa a vista
   * para ver a mídia sem interferência visual.
   */
  actionsVisible: boolean
  onToggleActions: () => void
  /** Carrossel controlado (Stories usa para sincronizar as barras de progresso). */
  index?: number
  onIndexChange?: (index: number) => void
}

/**
 * Camada de mídia compartilhada por TODAS as previews (IG feed, Stories, Reels,
 * TikTok), usada também no fluxo do cliente.
 *
 * Comportamentos:
  *  - Vídeo toca mudo por padrão; botão de mute liga o som.
 *  - Clique na mídia abre em TELA CHEIA (lightbox).
 *  - Múltiplas mídias → carrossel com setas e contador (a capa NÃO entra no carrossel).
 *  - Botão "Capa" alterna inline entre a capa e a mídia real (sem lightbox).
 *  - Botão "esconder tudo" (olho) remove TODOS os overlays — controles, setas,
 *    contador — deixando só a mídia crua. Clica de novo para restaurar.
 */
export function PreviewMedia({
  files,
  coverUrl,
  className,
  alt = '',
  poster,
  overlayTopClass = 'top-2',
  actionsVisible,
  onToggleActions,
  index: controlledIndex,
  onIndexChange,
}: PreviewMediaProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [internalIndex, setInternalIndex] = useState(0)
  const [soundOn, setSoundOn] = useState(false)
  const [inView, setInView] = useState(true)
  const [showCover, setShowCover] = useState(false)
  const [lightbox, setLightbox] = useState<{ kind: 'media' | 'cover'; index: number } | null>(null)

  const setIndex = (i: number) => {
    if (controlledIndex === undefined) setInternalIndex(i)
    onIndexChange?.(i)
  }

  // "Em foco" = visível na viewport. Fora de foco → pausa o vídeo.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const muted = !soundOn

  // React não propaga `muted` como propriedade do <video> — aplica via ref.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted
  }, [muted])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (inView) v.play().catch(() => {})
    else v.pause()
  }, [inView])

  const count = files.length
  const currentIndex = controlledIndex ?? internalIndex
  const safeIndex = Math.min(Math.max(currentIndex, 0), Math.max(count - 1, 0))
  const current = files[safeIndex]

  // Fallback inteligente: se a URL não é reconhecida como vídeo/imagem,
  // tenta ambos os modos de renderização
  const [mediaFailed, setMediaFailed] = useState(false)

  const isVideo = current
    ? current.mediaType === 'video' || (current.mediaType !== 'image' && isVideoUrl(current.url))
    : false

  const next = () => { setIndex((currentIndex + 1) % count); setMediaFailed(false) }
  const prev = () => { setIndex((currentIndex - 1 + count) % count); setMediaFailed(false) }

  // Qual URL exibir no retângulo principal: capa ou mídia real.
  const displayUrl = showCover && coverUrl ? coverUrl : current?.url
  // Se falhou como imagem, tenta como vídeo (e vice-versa)
  const displayIsVideo = showCover && coverUrl
    ? false
    : mediaFailed
      ? !isVideo  // Inverte o tipo se falhou
      : isVideo
  const displayAlt = showCover && coverUrl ? 'Capa do post' : alt
  // Capa do post como poster do vídeo (thumbnail enquanto carrega/antes do play).
  const videoPoster = coverUrl || poster || undefined

  const lightboxItems: LightboxItem[] = files.map(f => ({
    url: f.url,
    mediaType: f.mediaType === 'video' || (f.mediaType !== 'image' && isVideoUrl(f.url)) ? 'video' : 'image',
  }))

  const handleMediaClick = () => {
    if (showCover && coverUrl) {
      setLightbox({ kind: 'cover', index: 0 })
    } else {
      setLightbox({ kind: 'media', index: safeIndex })
    }
  }

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      aria-label="Abrir mídia em tela cheia"
      className={cn('relative overflow-hidden cursor-zoom-in', className)}
      onClick={handleMediaClick}
      onKeyDown={e => {
        if (e.key === 'Enter') handleMediaClick()
      }}
    >
      {displayUrl && !mediaFailed && (
        displayIsVideo ? (
          <video
            key={`v-${displayUrl}`}
            ref={videoRef}
            src={displayUrl}
            poster={videoPoster}
            className="w-full h-full object-cover"
            autoPlay
            muted={muted}
            loop
            playsInline
            preload="metadata"
            onError={() => setMediaFailed(true)}
          />
        ) : (
          <img
            key={`i-${displayUrl}`}
            src={displayUrl}
            alt={displayAlt}
            className="w-full h-full object-cover"
            onError={() => setMediaFailed(true)}
          />
        )
      )}

      {/* Fallback: quando a mídia não carrega */}
      {(!displayUrl || mediaFailed) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted gap-2">
          <AlertCircle size={24} className="text-muted-foreground" />
          <p className="text-xs text-muted-foreground text-center px-4">
            Mídia não disponível
            {displayUrl && (
              <span className="block text-[10px] mt-1 opacity-60 truncate max-w-[200px]">
                {displayUrl.split('?')[0].split('/').pop()}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Controles (topo direito): olho (limpar tudo) · som · capa · carrossel */}
      <div
        className={cn('absolute right-2 z-20 flex flex-col items-center gap-1.5', overlayTopClass)}
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onToggleActions}
          title={actionsVisible ? 'Ocultar tudo' : 'Mostrar controles'}
          className="p-1.5 rounded-full bg-black/45 hover:bg-black/70 text-white transition-colors"
        >
          {actionsVisible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        {actionsVisible && (
          <>
            <button
              type="button"
              onClick={() => setSoundOn(s => !s)}
              title={muted ? 'Ativar som' : 'Silenciar'}
              className="p-1.5 rounded-full bg-black/45 hover:bg-black/70 text-white transition-colors"
            >
              {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            {coverUrl && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setShowCover(v => !v) }}
                title={showCover ? 'Ver mídia' : 'Ver capa'}
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/45 hover:bg-black/70 text-white text-[9px] font-semibold transition-colors"
              >
                <ImageIcon size={12} /> {showCover ? 'Mídia' : 'Capa'}
              </button>
            )}
            {count > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Mídia anterior"
                  onClick={e => { e.stopPropagation(); prev() }}
                  className="p-1 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Próxima mídia"
                  onClick={e => { e.stopPropagation(); next() }}
                  className="p-1 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
                <span className="bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none">
                  {safeIndex + 1}/{count}
                </span>
              </>
            )}
          </>
        )}
      </div>

      {lightbox && (
        <MediaLightbox
          key={lightbox.kind}
          open={!!lightbox}
          onOpenChange={o => { if (!o) setLightbox(null) }}
          items={lightbox.kind === 'cover' ? [{ url: coverUrl || '', mediaType: 'image' }] : lightboxItems}
          startIndex={lightbox.kind === 'cover' ? 0 : safeIndex}
        />
      )}
    </div>
  )
}