import { serve } from 'https://deno.land/std@0.170.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { decryptToken } from '../_shared/crypto.ts'

/**
 * Migração única: vídeos que estão no Google Drive (servidos como
 * octet-stream/attachment, que o Chrome não toca em <video>) passam a ser
 * servidos pela URL pública do bucket R2.
 *
 * Para cada post com media_urls contendo um vídeo do Drive (type=video):
 *  1. Baixa o arquivo do Drive (API oficial, alt=media — evita a página de
 *     confirmação do Google para arquivos grandes).
 *  2. Envia pro R2 (chave estável `posts/{userId}/{fileId}{ext}`, idempotente).
 *  3. Troca a URL no media_urls do post por `${R2_PUBLIC_URL}/${key}`.
 *
 * O arquivo NÃO é removido do Drive — o Drive continua sendo o storage canônico.
 * A execução é manual: chamar com a service role key.
 *   curl -X POST "$SUPABASE_URL/functions/v1/migrate-drive-videos" \
 *     -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
 *     -d '{ "postIds": ["..."] }'   // opcional — sem postIds processa todos
 *   -d '{ "dryRun": true }'         // opcional — lista sem gravar
 */

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '',
)

const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID') || ''
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID') || ''
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY') || ''
const R2_BUCKET = Deno.env.get('R2_BUCKET') || 'postupstorage'
const R2_PUBLIC_URL = (Deno.env.get('R2_PUBLIC_URL') || '').replace(/\/$/, '')

const DRIVE_URL = 'https://www.googleapis.com/drive/v3'

interface TokenInfo {
  access_token: string
}

const enc = new TextEncoder()

async function hmacSha256(key: Uint8Array | ArrayBuffer, data: string): Promise<Uint8Array> {
  const keyData = key instanceof ArrayBuffer ? new Uint8Array(key) : key
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data))
  return new Uint8Array(sig)
}

async function sha256Hex(data: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(data))
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** URL pré-assinada de PUT no R2 (mesmo esquema do r2-to-drive). */
async function createR2PresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const date = new Date()
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = date.toISOString().slice(0, 10).replace(/-/g, '')

  const credential = `${R2_ACCESS_KEY_ID}/${dateStamp}/auto/s3/aws4_request`
  // SigV4: encode cada segmento mantendo as barras reais do key (encoding correto
  // para chaves aninhadas — encodeURIComponent(key) quebraria com `%2F`).
  const canonicalUri = `/${R2_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`
  const queryParams = `X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(credential)}&X-Amz-Date=${amzDate}&X-Amz-Expires=${expiresIn}&X-Amz-SignedHeaders=host`

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    queryParams,
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    `${dateStamp}/auto/s3/aws4_request`,
    await sha256Hex(canonicalRequest),
  ].join('\n')

  const kDate = await hmacSha256(enc.encode(`AWS4${R2_SECRET_ACCESS_KEY}`), dateStamp)
  const kRegion = await hmacSha256(kDate, 'auto')
  const kService = await hmacSha256(kRegion, 's3')
  const signingKey = await hmacSha256(kService, 'aws4_request')
  const signature = await hmacSha256(signingKey, stringToSign)
  const sigHex = Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join('')

  return `https://${host}/${R2_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}?${queryParams}&X-Amz-Signature=${sigHex}`
}

async function putR2Object(key: string, blob: Blob, contentType: string): Promise<void> {
  const uploadUrl = await createR2PresignedUrl(key)
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  })
  if (!res.ok) throw new Error(`Falha ao enviar pro R2: ${res.status} ${res.statusText}`)
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

function getDriveVideoFileId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes('drive.google.com')) return null
    // Só migra URLs marcadas como vídeo (imagens do Drive continuam como estão)
    if (parsed.searchParams.get('type') !== 'video') return null
    return parsed.searchParams.get('id')
  } catch {
    return null
  }
}

function extFor(mimeType: string, name: string): string {
  const fromName = name.match(/\.[a-zA-Z0-9]+$/)?.[0].toLowerCase()
  if (fromName) return fromName
  if (mimeType === 'video/quicktime') return '.mov'
  if (mimeType === 'video/mp4') return '.mp4'
  if (mimeType === 'video/webm') return '.webm'
  if (mimeType === 'video/x-msvideo') return '.avi'
  return '.mp4'
}

function sanitizeKeySegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '')
}

async function downloadFromDrive(accessToken: string, fileId: string): Promise<{ blob: Blob; name: string; mimeType: string }> {
  const metaRes = await fetch(`${DRIVE_URL}/files/${fileId}?fields=id,name,mimeType,size`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!metaRes.ok) throw new Error(`Falha ao obter metadados do arquivo (${metaRes.status})`)
  const meta = await metaRes.json()

  const dlRes = await fetch(`${DRIVE_URL}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!dlRes.ok) throw new Error(`Falha ao baixar arquivo do Drive (${dlRes.status})`)

  return { blob: await dlRes.blob(), name: meta.name || fileId, mimeType: meta.mimeType || 'application/octet-stream' }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const authHeader = req.headers.get('Authorization') || ''

  function isServiceRoleJwt(token: string): boolean {
    try {
      const payload = JSON.parse(new TextDecoder().decode(
        Uint8Array.from(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
      ))
      return payload.role === 'service_role' && payload.ref === (Deno.env.get('SUPABASE_URL') || '').match(/https:\/\/([^.]+)\./)?.[1]
    } catch {
      return false
    }
  }

  const authorized =
    req.method === 'POST' &&
    (authHeader === `Bearer ${serviceKey}` ||
      (authHeader.startsWith('Bearer ') && isServiceRoleJwt(authHeader.slice(7))))
  if (!authorized) {
    return json({ error: 'Não autorizado' }, 401)
  }

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_PUBLIC_URL) {
    return json({ error: 'Credenciais do R2 ou R2_PUBLIC_URL não configuradas na edge function' }, 500)
  }

  try {
    const { postIds, dryRun } = await req.json().catch(() => ({}))

    let query = supabase.from('posts').select('id,user_id,media_urls').not('media_urls', 'is', null)
    if (Array.isArray(postIds) && postIds.length > 0) {
      query = query.in('id', postIds)
    }
    const { data: posts, error: postsErr } = await query
    if (postsErr) throw postsErr
    if (!posts) return json({ error: 'Nenhum post retornado' }, 500)

    const summary: {
      scanned: number
      migrated: number
      skipped: number
      errors: Array<{ postId: string; url: string; error: string }>
      posts: Array<{ postId: string; mediaUrls: string[] }>
    } = { scanned: posts.length, migrated: 0, skipped: 0, errors: [], posts: [] }

    for (const post of posts as Array<{ id: string; user_id: string | null; media_urls: string[] | null }>) {
      const urls = Array.isArray(post.media_urls) ? [...post.media_urls] : []
      let changed = false
      const newUrls: string[] = []

      for (const url of urls) {
        const fileId = getDriveVideoFileId(url)
        if (!fileId) {
          newUrls.push(url)
          continue
        }

        try {
          if (!post.user_id) {
            summary.skipped++
            newUrls.push(url)
            continue
          }

          const accessToken = await getAccessTokenFor(post.user_id)
          const { blob, name, mimeType } = await downloadFromDrive(accessToken, fileId)

          const ext = extFor(mimeType, name)
          const base = sanitizeKeySegment(name.replace(/\.[^.]+$/, ''))
          const key = `posts/${post.user_id}/${fileId}-${base}${ext}`

          if (!dryRun) {
            await putR2Object(key, blob, mimeType)
          }

          const r2Url = `${R2_PUBLIC_URL}/${encodeURIComponent(key)}`
          newUrls.push(r2Url)
          changed = true
        } catch (err) {
          summary.errors.push({ postId: post.id, url, error: err instanceof Error ? err.message : String(err) })
          newUrls.push(url)
        }
      }

      if (changed && !dryRun) {
        const { error: updateErr } = await supabase.from('posts').update({ media_urls: newUrls }).eq('id', post.id)
        if (updateErr) {
          summary.errors.push({ postId: post.id, url: post.id, error: updateErr.message })
        } else {
          summary.migrated++
        }
      } else if (changed) {
        summary.migrated++
      }
      if (changed) summary.posts.push({ postId: post.id, mediaUrls: newUrls })
    }

    return json(summary)
  } catch (err) {
    console.error('migrate-drive-videos error:', err)
    return json({ error: err instanceof Error ? err.message : 'Falha na migração' }, 500)
  }
})
