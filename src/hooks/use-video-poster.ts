import { useState, useEffect, useRef } from 'react'

/**
 * Extrai um frame de um vídeo remoto como poster (data-URL).
 * Retorna null enquanto não estiver pronto ou se a URL for null.
 * Cria um <video> hidden, avança para 1s, desenha num canvas e revoga o stream.
 */
export function useVideoPoster(url: string | null): string | null {
  const [poster, setPoster] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const prevUrl = useRef<string | null>(null)

  useEffect(() => {
    if (url === prevUrl.current) return
    prevUrl.current = url

    // Limpa estado anterior
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.removeAttribute('src')
      videoRef.current.load()
      videoRef.current = null
    }
    setPoster(null)

    if (!url) return
    // Drive não envia CORS — extração via canvas é impossível; retorna null
    // para não gerar erros CORS no console (MediaPreview já usa driveThumbUrl como fallback).
    if (/drive\.google\.com|googleusercontent\.com/.test(url)) return
    const videoUrl = url

    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    videoRef.current = video

    let cancelled = false

    async function extract() {
      try {
        video.src = videoUrl
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve()
          video.onerror = () => reject(new Error('video load failed'))
        })

        if (cancelled) return

        // Avança para 1s ou 25% da duração (o que for menor)
        video.currentTime = Math.min(1, video.duration * 0.25)
        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve()
        })

        if (cancelled) return

        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 360
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7)

        if (!cancelled) setPoster(dataUrl)
      } catch {
        // Silently fail — o poster fica null e o componente usa fallback
      } finally {
        try {
          const stream = video.srcObject as MediaStream | null
          if (stream) {
            stream.getTracks().forEach(t => t.stop())
          }
        } catch { /* ignore */ }
      }
    }

    extract()

    return () => {
      cancelled = true
      if (videoRef.current === video) videoRef.current = null
      try {
        video.pause()
        video.removeAttribute('src')
        video.load()
      } catch { /* ignore */ }
    }
  }, [url])

  return poster
}
