import { supabase } from '@/lib/supabase'
import { uploadMedia, uploadOriginalToDrive, uploadMediaToDriveFallback } from '@/lib/media-storage'
import { compressImage } from '@/lib/compress-image'
import { generateVideoFrame, generateVideoFrameFromUrl } from '@/lib/video-frame'
import { sanitize } from '@/lib/utils'
import { clearPostDraft } from '@/lib/post-draft'

/**
 * Salvamento de post em SEGUNDO PLANO (decisão: permite sair da tela durante o
 * envio).
 *
 * O job roda fora do ciclo de vida do componente (módulo + worker próprio), então
 * navegar para outra página NÃO cancela a compressão/upload do post. O progresso
 * é emitido via `subscribePostSaveJobs` para uma notificação fixa no canto
 * (PostSaveProgressToast) e a conclusão limpa o rascunho do IndexedDB.
 *
 * Diferença de comportamento vs. fluxo antigo: a dedup interativa do Drive
 * (substituir/manter os dois/cancelar) não existe em background — os arquivos
 * usam nomes com timestamp único, então não há colisão (equivalentes a
 * "manter os dois").
 */

export interface PostSaveMedia {
  id: string
  url: string
  file?: File
  existing?: boolean
  mediaType: 'image' | 'video'
}

export interface PostSaveParams {
  clientId: string
  clientName: string
  clientHandle: string
  clientColor: string
  postType: string
  platform: string
  date: string
  time: string
  caption: string
  status: string
  compressVideos: boolean | null
  mediaItems: PostSaveMedia[]
  cover: PostSaveMedia | null
  userId: string | null
  isEditing: boolean
  editId?: string
  version?: number
  selectedVersionId?: string
  newVersionName?: string
}

export type PostSavePhase = 'compress' | 'upload' | 'save' | 'done' | 'error'

export interface PostSaveJob {
  jobId: string
  phase: PostSavePhase
  /** 0..1 — ponderado entre compressão + upload + gravação no banco. */
  progress: number
  message: string
  mediaIndex: number
  mediaTotal: number
  /** Timestamp (ms) de início do job — usado para estimar o tempo restante. */
  startedAt?: number
  /** Preenchido quando `phase === 'done'`. */
  postId?: string
  /** Rota de destino após o sucesso (ex.: /posts/:id). */
  destination?: string
  error?: string
}

type Listener = (job: PostSaveJob) => void

const listeners = new Set<Listener>()
const jobs = new Map<string, PostSaveJob>()
let jobCounter = 0

function emit(job: PostSaveJob) {
  jobs.set(job.jobId, job)
  for (const listener of listeners) listener(job)
}

function setJob(job: PostSaveJob, patch: Partial<PostSaveJob>): PostSaveJob {
  const next = { ...job, ...patch }
  emit(next)
  return next
}

export function startPostSaveJob(params: PostSaveParams): string {
  const jobId = `post-${Date.now()}-${jobCounter++}`
  const initial: PostSaveJob = {
    jobId,
    phase: 'compress',
    progress: 0,
    message: 'Iniciando envio...',
    startedAt: Date.now(),
    mediaIndex: 0,
    mediaTotal: params.mediaItems.length,
  }
  emit(initial)
  void runPostSave(initial, params)
  return jobId
}

export function subscribePostSaveJobs(listener: Listener): () => void {
  listeners.add(listener)
  for (const job of jobs.values()) listener(job)
  return () => listeners.delete(listener)
}

export function getPostSaveJob(jobId: string): PostSaveJob | undefined {
  return jobs.get(jobId)
}

/* ------------------------------------------------------------------ */
/* Compressão via Worker dedicado (sobrevive à navegação)              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Execução do job                                                     */
/* ------------------------------------------------------------------ */

async function runPostSave(initial: PostSaveJob, p: PostSaveParams) {
  let job = initial
  try {
    const driveContext = {
      client: p.clientName,
      date: p.date,
      type: p.postType,
      plataforma: p.platform,
      sequence: p.postType === 'stories' ? `sequencia-${Date.now()}` : undefined,
    }

    const mediaUrls: string[] = []
    const originalUrls: (string | null)[] = []
    const total = Math.max(1, p.mediaItems.filter(m => m.file).length)

    for (let i = 0; i < p.mediaItems.length; i++) {
      const item = p.mediaItems[i]
      if (!item.file) {
        if (item.existing) {
          mediaUrls.push(item.url)
          originalUrls.push(null)
        }
        continue
      }
      const file = item.file
      const isVideo = file.type.startsWith('video/')
      const fileBase = `file-${i + 1}-${Date.now()}`

      if (isVideo) {
        job = setJob(job, { phase: 'upload', mediaIndex: i, message: `Enviando vídeo ${i + 1} de ${p.mediaItems.length}...` })
        const ext = file.type.includes('mp4') ? '.mp4' : (file.name.match(/\.[^.]+$/)?.[0].toLowerCase() || '.mp4')
        const fileName = `${fileBase}${ext}`
        job = setJob(job, {
          phase: 'upload',
          mediaIndex: i,
          progress: (i + 0.95) / total,
          message: `Enviando vídeo ${i + 1} de ${p.mediaItems.length} para o armazenamento...`,
        })
        // Vídeo: display no Supabase; original no Drive.
        // Se Supabase rejeita (> 50 MB), fallback → Drive para display + original.
        let displayUrl: string
        try {
          displayUrl = await uploadMedia(file, fileName, { context: driveContext })
        } catch {
          const fallback = await uploadMediaToDriveFallback(file, fileName, { context: driveContext })
          if (!fallback) throw new Error('Vídeo excede o limite de 50 MB do armazenamento. Conecte o Google Drive em Configurações → Armazenamento para enviar vídeos grandes, ou comprima o vídeo.')
          displayUrl = fallback
        }
        const origUrl = await uploadOriginalToDrive(file, fileName, { context: driveContext })
        mediaUrls.push(displayUrl)
        originalUrls.push(origUrl || null)
      } else {
        job = setJob(job, { phase: 'compress', mediaIndex: i, message: `Comprimindo imagem ${i + 1} de ${p.mediaItems.length}...` })
        const compressed = await compressImage(file)
        const fileName = `${fileBase}.webp`
        job = setJob(job, {
          phase: 'upload',
          mediaIndex: i,
          progress: (i + 0.95) / total,
          message: `Enviando mídia ${i + 1} de ${p.mediaItems.length} para o armazenamento...`,
        })
        // Imagem: display (compressed) no Supabase + original no Drive.
        const [displayUrl, origUrl] = await Promise.all([
          uploadMedia(compressed, fileName, { context: driveContext }),
          uploadOriginalToDrive(file, fileName, { context: driveContext }),
        ])
        mediaUrls.push(displayUrl)
        originalUrls.push(origUrl || null)
      }
      job = setJob(job, { progress: (i + 1) / total })
    }

    // Capa do vídeo/reels (media_urls = [capa, vídeo])
    let finalMediaUrls = mediaUrls
    let finalOriginalUrls = originalUrls
    const hasVideo = p.mediaItems.some(m => m.mediaType === 'video')
    if (hasVideo) {
      job = setJob(job, { phase: 'upload', message: 'Preparando capa do vídeo...' })
      let coverDisplayUrl: string | null = null
      let coverOriginalUrl: string | null = null
      if (p.cover?.file) {
        const compressed = await compressImage(p.cover.file)
        const fileName = `cover-${Date.now()}.jpg`
        const [displayUrl, origUrl] = await Promise.all([
          uploadMedia(compressed, fileName, { context: driveContext }),
          uploadOriginalToDrive(p.cover.file, fileName, { context: driveContext }),
        ])
        coverDisplayUrl = displayUrl
        coverOriginalUrl = origUrl
      } else if (!p.cover) {
        const videoItem = p.mediaItems.find(m => m.mediaType === 'video')
        const frame = videoItem?.file
          ? await generateVideoFrame(videoItem.file)
          : videoItem?.url
            ? await generateVideoFrameFromUrl(videoItem.url)
            : null
        if (frame) coverDisplayUrl = await uploadMedia(frame, `cover-${Date.now()}.jpg`, { context: driveContext })
      } else if (p.cover?.existing) {
        coverDisplayUrl = p.cover.url
      }
      if (coverDisplayUrl) {
        finalMediaUrls = [coverDisplayUrl, ...mediaUrls]
        finalOriginalUrls = [coverOriginalUrl, ...originalUrls]
      }
    }

    job = setJob(job, { phase: 'save', progress: 0.99, message: 'Salvando post no banco de dados...' })

    const scheduledAt = p.status === 'rascunho' && !p.date
      ? null
      : new Date(`${p.date}T${p.time || '12:00'}`).toISOString()

    let postId = ''
    if (p.isEditing && p.editId) {
      const newVersionNumber = (p.version || 1) + 1
      const updateData: Record<string, unknown> = {
        client_id: p.clientId,
        client_name: p.clientName,
        client_handle: p.clientHandle,
        client_color: p.clientColor,
        post_type: p.postType,
        platform: p.platform,
        scheduled_at: scheduledAt,
        caption: sanitize(p.caption),
        status: p.status,
        media_urls: finalMediaUrls,
        user_id: p.userId,
      }

      if (p.selectedVersionId === 'new') {
        const currentPost = await supabase.from('posts').select('*').eq('id', p.editId).single()
        if (currentPost.data) {
          await supabase.from('post_versions').insert([{
            post_id: p.editId,
            version_number: p.version,
            name: `v${p.version}`,
            data: {
              post_type: currentPost.data.post_type,
              caption: currentPost.data.caption,
              media_urls: currentPost.data.media_urls,
              original_urls: currentPost.data.original_urls || [],
              scheduled_at: currentPost.data.scheduled_at,
              status: currentPost.data.status,
            },
          }])
        }
        updateData.version = newVersionNumber
        const name = sanitize(p.newVersionName ?? '') || `v${newVersionNumber}`
        await supabase.from('post_feedbacks').insert([{
          post_id: p.editId,
          author_role: 'gestor',
          author_name: 'Sistema',
          message: `Gestor criou ${name}: ${sanitize(p.caption).slice(0, 100)}`,
          type: 'log',
          version_name: name,
        }])
      }

      const { error } = await supabase.from('posts').update({ ...updateData, user_id: p.userId }).eq('id', p.editId)
      if (error) throw error
      // Coluna original_urls pode não existir ainda (migration pendente).
      if (finalOriginalUrls.some(Boolean)) {
        await supabase.from('posts').update({ original_urls: finalOriginalUrls, user_id: p.userId }).eq('id', p.editId)
      }
      postId = p.editId
    } else {
      const { data: createdPost, error } = await supabase
        .from('posts')
        .insert([{
          client_id: p.clientId,
          client_name: p.clientName,
          client_handle: p.clientHandle,
          client_color: p.clientColor,
          post_type: p.postType,
          platform: p.platform,
          is_feedback: false,
          scheduled_at: scheduledAt,
          caption: sanitize(p.caption),
          status: p.status,
          media_urls: finalMediaUrls,
          user_id: p.userId,
        }])
        .select('id')
        .single()

      // Coluna original_urls pode não existir ainda (migration pendente).
      // Tenta atualizar separadamente — se a coluna não existir, ignora.
      if (!error && createdPost && finalOriginalUrls.some(Boolean)) {
        await supabase.from('posts').update({ original_urls: finalOriginalUrls, user_id: p.userId }).eq('id', createdPost.id)
      }
      if (error) throw error
      if (createdPost) {
        await supabase.from('post_feedbacks').insert([{
          post_id: createdPost.id,
          author_role: 'gestor',
          author_name: 'Sistema',
          message: `Gestor criou publicação: ${sanitize(p.caption).slice(0, 100)}`,
          type: 'log',
        }])
      }
      postId = createdPost?.id
    }

    // Post salvo: o rascunho em cache (se existir) não serve mais.
    clearPostDraft(p.editId ?? null)

    setJob(job, {
      phase: 'done',
      progress: 1,
      message: 'Post salvo com sucesso!',
      postId,
      destination: p.isEditing ? `/posts/${postId}` : '/cronograma',
    })
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    const message = raw.includes('Drive') ? raw
      : raw.includes('50 MB') || raw.includes('limite') ? raw
      : raw.includes('Falha') || raw.includes('falha') ? raw
      : `Erro ao salvar post: ${raw}`
    setJob(job, { phase: 'error', message, error: message })
  }
}
