import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import DOMPurify from 'dompurify'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

export function sanitize(input: string, maxLength = 2000): string {
  if (!input) return ''
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] }).trim().slice(0, maxLength)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value)
}

const VIDEO_EXT_RE = /\.(mp4|mov|webm|m4v|ogv|avi)$/i

export function isVideoUrl(url: string): boolean {
  if (!url) return false
  const clean = url.split(/[?#]/)[0]
  if (VIDEO_EXT_RE.test(clean)) return true
  // Drive URLs não têm extensão — verificamos o parâmetro type=video
  try {
    const parsed = new URL(url)
    if (parsed.searchParams.get('type') === 'video') return true
  } catch { /* URL inválida — ignora */ }
  return false
}

// Cache para detectar tipo de mídia via HEAD request
const mediaTypeCache = new Map<string, 'image' | 'video'>()

/**
 * Detecta o tipo de mídia de uma URL fazendo um HEAD request leve.
 * Útil para URLs do Drive que não têm extensão.
 * Cacheia o resultado para não repetir requests.
 */
export async function detectMediaType(url: string): Promise<'image' | 'video'> {
  if (mediaTypeCache.has(url)) return mediaTypeCache.get(url)!

  try {
    const res = await fetch(url, { method: 'HEAD', mode: 'no-cors' })
    const contentType = res.headers.get('content-type') || ''
    const isVideo = contentType.startsWith('video/')
    mediaTypeCache.set(url, isVideo ? 'video' : 'image')
    return isVideo ? 'video' : 'image'
  } catch {
    // CORS pode bloquear HEAD — assume imagem
    mediaTypeCache.set(url, 'image')
    return 'image'
  }
}

/**
 * Detecta se media_urls começa com uma capa (imagem) seguida de vídeo.
 * Convenção: em posts de vídeo/reels, media_urls = [capa, vídeo].
 */
export function hasCoverInMediaUrls(mediaUrls: (string | null | undefined)[] | null | undefined): boolean {
  if (!mediaUrls || mediaUrls.length < 2) return false
  if (isVideoUrl(mediaUrls[0] || '')) return false
  return mediaUrls.slice(1).some(u => !!u && isVideoUrl(u))
}

/**
 * Separa a capa (primeira imagem de media_urls quando há vídeo depois) do restante
 * da mídia real. Retorna a capa separada para o preview não tratá-la como item do
 * carrossel — a capa vira um botão à parte na preview.
 */
export function splitCoverMedia(mediaUrls: (string | null | undefined)[] | null | undefined): {
  coverUrl: string | null
  media: string[]
} {
  if (!hasCoverInMediaUrls(mediaUrls)) {
    return { coverUrl: null, media: (mediaUrls || []).filter(Boolean) as string[] }
  }
  const urls = (mediaUrls || []).filter(Boolean) as string[]
  return { coverUrl: urls[0], media: urls.slice(1) }
}

/** Extrai o file ID de uma URL do Google Drive. */
export function getDriveFileId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes('drive.google.com')) return null
    return parsed.searchParams.get('id')
  } catch {
    return null
  }
}

/**
 * Resolve a mídia a exibir em miniaturas (grid/cronograma) a partir de
 * media_urls. Na convenção `[capa, ...vídeos]`, mostra o vídeo com a capa
 * como poster (thumbnail); senão, usa o primeiro item como está.
 */
export function resolveThumbMedia(mediaUrls: (string | null | undefined)[] | null | undefined): {
  url: string | null
  poster: string | undefined
} {
  const urls = (mediaUrls || []).filter(Boolean) as string[]
  if (urls.length === 0) return { url: null, poster: undefined }
  if (hasCoverInMediaUrls(urls)) {
    const videoIndex = urls.findIndex(u => isVideoUrl(u))
    return { url: urls[videoIndex >= 0 ? videoIndex : 1], poster: urls[0] }
  }
  return { url: urls[0], poster: undefined }
}

/**
 * Monta a URL de embed do Drive (player nativo) para vídeos.
 * Funciona mesmo para arquivos grandes que o `uc?export=download` serve como
 * página HTML de vírus — o player do Drive lida com isso internamente.
 */
export function driveVideoEmbedUrl(url: string): string | null {
  const id = getDriveFileId(url)
  if (!id) return null
  return `https://drive.google.com/file/d/${id}/preview`
}

export function getInitials(name: string): string {
  if (!name) return ''

  const words = name.trim().split(' ')

  if (words.length === 1) {
    // Nome único: pega as duas primeiras letras
    return words[0].slice(0, 2).toUpperCase()
  }

  // Múltiplas palavras: primeira letra de cada uma, máximo 2
  return words
    .slice(0, 2)
    .map((word: string) => word[0])
    .join('')
    .toUpperCase()
}