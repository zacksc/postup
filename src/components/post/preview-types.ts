/**
 * Tipos compartilhados entre todas as previews de post (IG feed, Stories,
 * Reels, TikTok) — usadas no fluxo do gestor E no fluxo do cliente.
 *
 * Regras de mídia:
 *  - `files` são a MÍDIA REAL (imagens/vídeos do post), SEM a capa.
 *  - `coverUrl` (opcional) é a capa separada; o preview não trata a capa como
 *    item do carrossel — ela tem um botão próprio "ver capa".
 */
import { splitCoverMedia, isVideoUrl } from '@/lib/utils'

export interface PreviewFile {
  url: string
  mediaType?: 'image' | 'video'
}

export interface PostPreviewData {
  client?: { name: string; handle: string; color: string; profilePhoto?: string }
  type: string
  caption: string
  scheduledAt: Date | null
  files?: PreviewFile[]
  coverUrl?: string | null
  status?: string
}

export function previewFiles(post: PostPreviewData): PreviewFile[] {
  return post.files || []
}

export function previewCoverUrl(post: PostPreviewData): string | null {
  return post.coverUrl ?? null
}

/**
 * Resolve a mídia real e a capa da preview a partir do post:
 *  - Se `coverUrl` foi informado explicitamente (NovoPost passa a capa separada),
 *    usa `files` como está.
 *  - Senão, aplica a convenção do banco (media_urls = [capa, ...mídias]):
 *    extrai a capa e devolve só a mídia real para o carrossel.
 */
export function resolvePreviewMedia(post?: PostPreviewData | null): {
  files: PreviewFile[]
  coverUrl: string | null
} {
  if (!post) return { files: [], coverUrl: null }
  const raw = post.files || []
  if (post.coverUrl) return { files: raw, coverUrl: post.coverUrl }
  const { coverUrl, media } = splitCoverMedia(raw.map(f => f.url))
  if (!coverUrl) return { files: raw, coverUrl: null }
  return {
    files: media.map(url => ({ url, mediaType: isVideoUrl(url) ? 'video' : 'image' })),
    coverUrl,
  }
}
