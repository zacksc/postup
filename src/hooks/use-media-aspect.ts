import { useEffect, useState } from 'react'
import { isVideoUrl } from '@/lib/utils'

/**
 * Detecta a proporção (largura / altura) real de uma mídia (imagem ou vídeo)
 * a partir de sua URL. Retorna null enquanto carrega ou se não conseguir ler.
 * Útil para fazer o preview se adaptar às proporções da mídia enviada.
 */
export function useMediaAspect(url?: string | null, mediaType?: 'image' | 'video'): number | null {
  const [aspect, setAspect] = useState<number | null>(null)

  useEffect(() => {
    if (!url) return
    let cancelled = false
    const video = mediaType === 'video' || (!mediaType && isVideoUrl(url))

    if (video) {
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.muted = true
      const onMeta = () => {
        if (!cancelled && v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight)
      }
      v.addEventListener('loadedmetadata', onMeta)
      v.src = url
      return () => {
        cancelled = true
        v.removeEventListener('loadedmetadata', onMeta)
      }
    }

    const img = new Image()
    const onLoad = () => {
      if (!cancelled && img.naturalWidth && img.naturalHeight) setAspect(img.naturalWidth / img.naturalHeight)
    }
    img.addEventListener('load', onLoad)
    img.src = url
    return () => {
      cancelled = true
      img.removeEventListener('load', onLoad)
    }
  }, [url, mediaType])

  return aspect
}
