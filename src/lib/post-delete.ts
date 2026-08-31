import { supabase } from '@/lib/supabase'

/**
 * Deleção de post (D21/D22):
 *  - Apaga arquivos de EXIBIÇÃO do bucket Supabase `posts-media` (media_urls).
 *  - Apaga arquivos ORIGINAIS do Google Drive do usuário (original_urls).
 *  - Apaga o post — as FKs de feedback/versões/cards têm ON DELETE CASCADE.
 */

function extractDriveFileId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname !== 'drive.google.com' && !u.hostname.endsWith('.googleusercontent.com')) return null
    const id = u.searchParams.get('id')
    return id || null
  } catch {
    return null
  }
}

function extractStoragePath(url: string): string | null {
  const marker = '/storage/v1/object/public/posts-media/'
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  const path = url.slice(idx + marker.length).split('?')[0]
  return path || null
}

async function deleteFromSupabaseStorage(path: string): Promise<void> {
  await supabase.storage.from('posts-media').remove([path])
}

async function deleteDriveFiles(fileIds: string[]): Promise<number> {
  let removed = 0
  for (const fileId of fileIds) {
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
      'drive-upload?action=delete',
      { body: { fileId } },
    )
    if (!error && data?.ok) removed++
  }
  return removed
}

/**
 * Apaga mídias de um post: exibição (Supabase) + originais (Drive).
 * Aceita listas de URLs (display e/ou original) — deduplica e apaga cada arquivo.
 */
export async function deletePostMedia(
  displayUrls: string[],
  originalUrls?: string[],
): Promise<{ removed: number }> {
  const allUrls = [...displayUrls, ...(originalUrls || [])]
  const driveIds: string[] = []
  const storagePaths: string[] = []

  for (const url of allUrls) {
    if (!url) continue
    const driveId = extractDriveFileId(url)
    if (driveId) {
      if (!driveIds.includes(driveId)) driveIds.push(driveId)
    } else {
      const path = extractStoragePath(url)
      if (path && !storagePaths.includes(path)) storagePaths.push(path)
    }
  }

  let removed = 0
  removed += await deleteDriveFiles(driveIds)
  for (const path of storagePaths) {
    await deleteFromSupabaseStorage(path)
    removed++
  }
  return { removed }
}

export async function deletePost(postId: string): Promise<void> {
  const { data: post } = await supabase
    .from('posts')
    .select('media_urls, original_urls')
    .eq('id', postId)
    .single()
  const displayUrls: string[] = post?.media_urls || []
  const originalUrls: string[] = post?.original_urls || []
  if (displayUrls.length > 0 || originalUrls.length > 0) {
    await deletePostMedia(displayUrls, originalUrls)
  }
  const { error } = await supabase.from('posts').delete().eq('id', postId)
  if (error) throw error
}

// ── Bulk delete global ──────────────────────────────────────────────

async function deleteDriveFilesConcurrent(
  fileIds: string[],
  concurrency = 4,
): Promise<number> {
  let removed = 0
  const queue = [...fileIds]
  async function worker() {
    while (queue.length > 0) {
      const fileId = queue.shift()!
      try {
        const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
          'drive-upload?action=delete',
          { body: { fileId } },
        )
        if (!error && data?.ok) removed++
      } catch {
        // tolera 404 / erros — arquivo pode já ter sido apagado
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, fileIds.length) }, () => worker()))
  return removed
}

export interface DeleteAllResult {
  posts: number
  driveFiles: number
  storageFiles: number
}

/**
 * Apaga TODOS os posts: mídias (Drive + Supabase Storage) e registros.
 * Retorna contagens para feedback na UI.
 */
export async function deleteAllPosts(): Promise<DeleteAllResult> {
  const { data: posts, error: fetchErr } = await supabase
    .from('posts')
    .select('id, media_urls, original_urls')
  if (fetchErr) throw fetchErr
  const allPosts = posts || []

  // Agrega e deduplica fileIds do Drive e paths do Storage
  const driveIdSet = new Set<string>()
  const storagePathSet = new Set<string>()

  for (const post of allPosts) {
    const allUrls = [
      ...((post.media_urls as string[]) || []),
      ...((post.original_urls as string[]) || []),
    ]
    for (const url of allUrls) {
      if (!url) continue
      const driveId = extractDriveFileId(url)
      if (driveId) {
        driveIdSet.add(driveId)
      } else {
        const path = extractStoragePath(url)
        if (path) storagePathSet.add(path)
      }
    }
  }

  // Apaga do Supabase Storage em lotes de ≤100
  const storagePaths = Array.from(storagePathSet)
  let storageRemoved = 0
  for (let i = 0; i < storagePaths.length; i += 100) {
    const batch = storagePaths.slice(i, i + 100)
    const { error } = await supabase.storage.from('posts-media').remove(batch)
    if (!error) storageRemoved += batch.length
  }

  // Apaga do Drive com concorrência limitada
  const driveIds = Array.from(driveIdSet)
  const driveRemoved = await deleteDriveFilesConcurrent(driveIds, 4)

  // Apaga todos os posts — CASCADE remove feedbacks/versões/cards
  const { error: delErr } = await supabase.from('posts').delete().neq('id', '')
  if (delErr) throw delErr

  return {
    posts: allPosts.length,
    driveFiles: driveRemoved,
    storageFiles: storageRemoved,
  }
}
