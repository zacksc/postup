import { serve } from 'https://deno.land/std@0.170.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { decryptToken } from '../_shared/crypto.ts'

const DRIVE_URL = 'https://www.googleapis.com/drive/v3'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
)

interface TokenInfo {
  access_token: string
}

async function getAccessTokenFor(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('user_drive_connections')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data?.refresh_token) throw new Error('Google Drive não conectado')

  const refreshToken = await decryptToken(data.refresh_token)
  const params = new URLSearchParams({
    client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
    client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  if (!res.ok) throw new Error('Falha ao renovar acesso ao Google Drive')
  const info = await res.json() as TokenInfo
  return info.access_token
}

function extractDriveFileId(url: string): string | null {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('drive.google.com')) return null
    return u.searchParams.get('id')
  } catch {
    return null
  }
}

/**
 * Download de arquivo do Google Drive via API (alt=media) — contorna
 * a página HTML de virus-scan que o browser recebe.
 * Limita a 50 MB para evitar OOM no edge runtime.
 */
async function downloadFromDrive(fileId: string, accessToken: string): Promise<Blob> {
  const res = await fetch(`${DRIVE_URL}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Falha ao baixar do Drive: ${res.status}`)
  const contentLength = parseInt(res.headers.get('content-length') || '0', 10)
  if (contentLength > 50 * 1024 * 1024) {
    throw new Error(`Arquivo muito grande (${Math.round(contentLength / 1024 / 1024)} MB) para backfill`)
  }
  return await res.blob()
}

function extFromMime(mime: string): string {
  if (mime.includes('video/mp4')) return '.mp4'
  if (mime.includes('video/quicktime')) return '.mov'
  if (mime.includes('video/webm')) return '.webm'
  if (mime.includes('image/jpeg')) return '.jpg'
  if (mime.includes('image/png')) return '.png'
  if (mime.includes('image/webp')) return '.webp'
  return ''
}

/**
 * Backfill de mídias: copia arquivos do Google Drive para o bucket Supabase
 * `posts-media`, atualizando `media_urls` (display) e preenchendo `original_urls`.
 *
 * Uso:
 *   POST /functions/v1/media-backfill            — dry-run (apenas preview)
 *   POST /functions/v1/media-backfill?execute=true — executa o backfill
 *   GET  /functions/v1/media-backfill             — status (posts restantes)
 *
 * Autenticação: requer token de usuário autenticado.
 * Limite: processa até 50 posts por chamada (chamar repetidamente).
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })

  const authHeader = req.headers.get('Authorization') || ''
  const client = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_ANON_KEY') || '',
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authErr } = await client.auth.getUser()
  if (authErr || !user) return json({ error: 'Não autorizado' }, 401)

  const url = new URL(req.url)
  const execute = url.searchParams.get('execute') === 'true'
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100)

  // 1. Contar posts sem original_urls (backfill candidates)
  const { count: totalRemaining } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .or('original_urls.is.null,original_urls.eq.[]')

  if (req.method === 'GET' || !execute) {
    return json({
      remaining: totalRemaining || 0,
      message: execute ? 'Nenhum post para processar' : `Execute com ?execute=true para processar ${totalRemaining || 0} posts`,
    })
  }

  // 2. Buscar posts sem original_urls (candidatos a backfill)
  const { data: posts, error: queryErr } = await supabase
    .from('posts')
    .select('id, media_urls, original_urls')
    .or('original_urls.is.null,original_urls.eq.[]')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (queryErr) return json({ error: queryErr.message }, 500)
  if (!posts || posts.length === 0) return json({ processed: 0, message: 'Nenhum post com URLs do Drive' })

  let accessToken: string
  try {
    accessToken = await getAccessTokenFor(user.id)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Falha ao acessar Drive' }, 500)
  }

  let processed = 0
  let skipped = 0
  let errors = 0
  const details: Array<{ postId: string; status: string; message?: string }> = []

  for (const post of posts) {
    const mediaUrls: string[] = post.media_urls || []

    // Skip posts that don't have any Drive URLs (already on Supabase)
    const hasDriveUrl = mediaUrls.some(u => u.includes('drive.google.com'))
    if (!hasDriveUrl) {
      skipped++
      // Mark as "backfilled" with empty originals (no Drive originals to preserve)
      if (!post.original_urls || post.original_urls.length === 0) {
        await supabase.from('posts').update({ original_urls: [] }).eq('id', post.id)
      }
      continue
    }

    const existingOriginals: string[] = post.original_urls || []
    const newDisplayUrls: string[] = []
    const newOriginalUrls: string[] = []
    let changed = false

    for (let i = 0; i < mediaUrls.length; i++) {
      const url = mediaUrls[i]
      const fileId = extractDriveFileId(url)

      if (!fileId) {
        // URL não é do Drive — manter como está
        newDisplayUrls.push(url)
        newOriginalUrls.push(existingOriginals[i] || '')
        continue
      }

      // Já tem original preservado? Pular
      if (existingOriginals[i]) {
        newDisplayUrls.push(url)
        newOriginalUrls.push(existingOriginals[i])
        continue
      }

      try {
        // Baixar do Drive via API (contorna virus-scan)
        const blob = await downloadFromDrive(fileId, accessToken)
        const mime = blob.type || 'application/octet-stream'
        const ext = extFromMime(mime) || '.bin'
        const storagePath = `backfill/${post.id}-${i}${ext}`

        // Upload ao Supabase
        const { error: uploadErr } = await supabase.storage
          .from('posts-media')
          .upload(storagePath, blob, { contentType: mime })

        if (uploadErr) throw new Error(uploadErr.message)

        const { data: { publicUrl } } = supabase.storage
          .from('posts-media')
          .getPublicUrl(storagePath)

        newDisplayUrls.push(publicUrl)
        newOriginalUrls.push(url) // URL do Drive vira original
        changed = true
      } catch (err) {
        // Erro neste arquivo: manter URL original
        console.error(`Backfill error post=${post.id} url=${url}:`, err)
        newDisplayUrls.push(url)
        newOriginalUrls.push(url)
        errors++
        details.push({ postId: post.id, status: 'error', message: err instanceof Error ? err.message : 'erro desconhecido' })
      }
    }

    if (changed) {
      const { error: updateErr } = await supabase
        .from('posts')
        .update({
          media_urls: newDisplayUrls,
          original_urls: newOriginalUrls,
        })
        .eq('id', post.id)

      if (updateErr) {
        console.error(`DB update error post=${post.id}:`, updateErr)
        errors++
        details.push({ postId: post.id, status: 'db_error', message: updateErr.message })
      } else {
        processed++
        details.push({ postId: post.id, status: 'ok' })
      }
    } else {
      skipped++
    }
  }

  return json({
    processed,
    skipped,
    errors,
    totalRemaining: (totalRemaining || 0) - processed,
    details,
  })
})
