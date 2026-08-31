/**
 * Extrai um frame aleatório de um vídeo local (arquivo) usando canvas.
 * Usado para gerar a capa de reels quando o usuário não envia uma capa.
 * Retorna null se não for possível extrair.
 */
export async function generateVideoFrame(file: File): Promise<Blob | null> {
  if (!file.type.startsWith('video/')) return null
  try {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.src = url
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    const cleanup = () => URL.revokeObjectURL(url)

    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve()
        video.onerror = () => reject(new Error('Falha ao carregar vídeo'))
        video.load()
      })

      const duration = video.duration
      if (!isFinite(duration) || duration <= 0) {
        cleanup()
        return null
      }

      // Take aleatório entre 20% e 80% da duração (evita fade in/out)
      const targetTime = duration * (0.2 + Math.random() * 0.6)
      video.currentTime = targetTime

      await new Promise<void>((resolve, reject) => {
        video.onseeked = () => resolve()
        video.onerror = () => reject(new Error('Falha ao buscar frame'))
      })

      let width = video.videoWidth
      let height = video.videoHeight
      if (width === 0 || height === 0) {
        cleanup()
        return null
      }

      const MAX = 720
      const ratio = Math.min(1, MAX / Math.max(width, height))
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        cleanup()
        return null
      }
      ctx.drawImage(video, 0, 0, width, height)

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82)
      })

      cleanup()
      return blob
    } catch {
      cleanup()
      return null
    }
  } catch {
    return null
  }
}

/**
 * Baixa um vídeo já hospedado (URL pública) e extrai um frame.
 * Falha (ex.: CORS do Google Drive) → retorna null, sem derrubar o save.
 */
export async function generateVideoFrameFromUrl(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const file = new File([blob], 'video-temp.mp4', { type: blob.type || 'video/mp4' })
    return await generateVideoFrame(file)
  } catch {
    return null
  }
}
