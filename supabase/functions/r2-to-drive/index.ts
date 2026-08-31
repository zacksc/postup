import { serve } from 'https://deno.land/std@0.170.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { decryptToken } from '../_shared/crypto.ts'

const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'
const DRIVE_URL = 'https://www.googleapis.com/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '',
)

const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID') || ''
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID') || ''
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY') || ''
const R2_BUCKET = Deno.env.get('R2_BUCKET') || 'postupstorage'

console.log('r2-to-drive function loaded. R2 config:', {
  R2_ACCOUNT_ID: R2_ACCOUNT_ID ? 'set' : 'MISSING',
  R2_ACCESS_KEY_ID: R2_ACCESS_KEY_ID ? 'set' : 'MISSING',
  R2_SECRET_ACCESS_KEY: R2_SECRET_ACCESS_KEY ? 'set' : 'MISSING',
  R2_BUCKET,
})

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

async function createR2PresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const date = new Date()
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = date.toISOString().slice(0, 10).replace(/-/g, '')

  const credential = `${R2_ACCESS_KEY_ID}/${dateStamp}/auto/s3/aws4_request`
  const canonicalUri = `/${R2_BUCKET}/${encodeURIComponent(key)}`

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

// ── S3 helpers for purge ────────────────────────────────────────────

interface S3Object { Key: string }

async function s3SignRequest(
  method: string,
  querystring: string,
  bodyHash: string,
  date: Date,
  extraHeaders?: Record<string, string>,
): Promise<Record<string, string>> {
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = date.toISOString().slice(0, 10).replace(/-/g, '')
  const credential = `${R2_ACCESS_KEY_ID}/${dateStamp}/auto/s3/aws4_request`

  const allHeaders: Record<string, string> = { host, ...extraHeaders }
  const signedHeaderKeys = Object.keys(allHeaders).sort()
  const signedHeaders = signedHeaderKeys.join(';')
  const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${allHeaders[k]}`).join('\n') + '\n'

  const canonicalRequest = [
    method,
    `/${R2_BUCKET}`,
    querystring,
    canonicalHeaders,
    signedHeaders,
    bodyHash,
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

  return {
    ...allHeaders,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': bodyHash,
    'Authorization': `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${sigHex}`,
  }
}

async function s3ListAllObjects(): Promise<S3Object[]> {
  const allObjects: S3Object[] = []
  let continuationToken = ''

  do {
    const date = new Date()
    let qs = 'list-type=2'
    if (continuationToken) qs += `&continuation-token=${encodeURIComponent(continuationToken)}`
    const headers = await s3SignRequest('GET', qs, 'UNSIGNED-PAYLOAD', date)
    const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}?${qs}`
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`R2 ListObjectsV2 falhou: ${res.status}`)
    const xml = await res.text()

    // Parse XML simples — extrai <Key>...</Key>
    const keyMatches = xml.matchAll(/<Key>([^<]+)<\/Key>/g)
    for (const m of keyMatches) allObjects.push({ Key: m[1] })

    const contMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)
    continuationToken = contMatch?.[1] || ''
  } while (continuationToken)

  return allObjects
}

async function s3DeleteObjectsBatch(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><Delete>${keys.map(k => `<Object><Key>${k}</Key></Object>`).join('')}</Delete>`
  const bodyHash = await sha256Hex(xmlBody)
  const rawMd5 = await crypto.subtle.digest('SHA-1', enc.encode(xmlBody))
  const md5B64 = btoa(String.fromCharCode(...new Uint8Array(rawMd5)))

  const date = new Date()
  const headers = await s3SignRequest('POST', 'delete', bodyHash, date, { 'content-md5': md5B64 })
  const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}?delete`
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/xml' },
    body: xmlBody,
  })
  if (!res.ok) throw new Error(`R2 DeleteObjects falhou: ${res.status}`)
  return keys.length
}

async function s3PurgeBucket(): Promise<{ deleted: number }> {
  const objects = await s3ListAllObjects()
  const keys = objects.map(o => o.Key)
  let deleted = 0
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000)
    deleted += await s3DeleteObjectsBatch(batch)
  }
  return { deleted }
}

async function getR2Object(key: string): Promise<Blob> {
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const url = `https://${host}/${R2_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`
  const date = new Date()
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = date.toISOString().slice(0, 10).replace(/-/g, '')

  const credential = `${R2_ACCESS_KEY_ID}/${dateStamp}/auto/s3/aws4_request`
  // SigV4: encode cada segmento mantendo as barras reais do key (chaves aninhadas).
  const canonicalUri = `/${R2_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`
  const queryParams = `X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(credential)}&X-Amz-Date=${amzDate}&X-Amz-Expires=3600&X-Amz-SignedHeaders=host`

  const canonicalRequest = [
    'GET',
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

  const res = await fetch(`${url}?${queryParams}&X-Amz-Signature=${sigHex}`)
  if (!res.ok) throw new Error(`Falha ao baixar do R2: ${res.status} ${res.statusText}`)
  return await res.blob()
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

async function googleError(res: Response): Promise<string> {
  try {
    const body = await res.clone().json()
    return body?.error?.message || `Falha na API do Google (${res.status})`
  } catch {
    return `Falha na API do Google (${res.status})`
  }
}

async function getOrCreateFolder(
  userId: string,
  accessToken: string,
  chainPath: string,
  segment: string,
  parentId: string | null,
  create = true,
): Promise<string | null> {
  const cached = await supabase
    .from('drive_folders')
    .select('folder_id')
    .eq('user_id', userId)
    .eq('path', chainPath)
    .maybeSingle()

  if (cached.data?.folder_id) {
    const check = await fetch(`${DRIVE_URL}/files/${cached.data.folder_id}?fields=id,mimeType`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (check.ok) {
      const meta = await check.json()
      if (meta.mimeType === FOLDER_MIME) return meta.id
    }
    await supabase.from('drive_folders').delete().eq('user_id', userId).eq('path', chainPath)
  }

  if (!create) return null

  const body = JSON.stringify({
    name: segment,
    mimeType: FOLDER_MIME,
    parents: parentId ? [parentId] : [],
  })
  const res = await fetch(`${DRIVE_URL}/files?fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body,
  })
  if (!res.ok) throw new Error(await googleError(res))
  const created = await res.json()

  await supabase
    .from('drive_folders')
    .upsert({ user_id: userId, path: chainPath, folder_id: created.id }, { onConflict: 'user_id,path', ignoreDuplicates: true })
  return created.id
}

async function resolveFolderChain(
  userId: string,
  accessToken: string,
  folderPath: string,
  create = true,
): Promise<string[]> {
  const segments = folderPath.split('/').map(s => s.trim()).filter(Boolean)
  if (segments.length === 0) return []
  let parentId: string | null = null
  let chain = ''
  for (const segment of segments) {
    chain = chain ? `${chain}/${segment}` : segment
    const id = await getOrCreateFolder(userId, accessToken, chain, segment, parentId, create)
    if (!id) return []
    parentId = id
  }
  return parentId ? [parentId] : []
}

async function uploadToDrive(
  file: Blob,
  name: string,
  accessToken: string,
  folderPath?: string,
  userId?: string,
): Promise<{ fileId: string; url: string }> {
  const parents = folderPath
    ? await resolveFolderChain(userId || '', accessToken, folderPath)
    : []

  const metadata = { name, parents: parents.length > 0 ? parents : undefined }
  const res = await fetch(`${UPLOAD_URL}?uploadType=resumable&fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': file.type || 'application/octet-stream',
      'X-Upload-Content-Length': String(file.size),
    },
    body: JSON.stringify(metadata),
  })
  if (!res.ok) throw new Error(await googleError(res))
  const sessionUri = res.headers.get('Location')
  if (!sessionUri) throw new Error('Google não retornou session URI')

  const CHUNK_SIZE = 8 * 1024 * 1024
  let start = 0
  let fileId: string | null = null

  while (start < file.size) {
    const end = Math.min(start + CHUNK_SIZE - 1, file.size - 1)
    const chunk = file.slice(start, end + 1)
    const contentRange = `bytes ${start}-${end}/${file.size}`
    const putRes = await fetch(sessionUri, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'Content-Length': String(end - start + 1),
        'Content-Range': contentRange,
        Authorization: `Bearer ${accessToken}`,
      },
      body: chunk,
    })
    // 308 Resume Incomplete = chunk intermediário OK (Google ainda montando o arquivo);
    // 200 = último chunk, resposta traz os metadados com o id.
    if (putRes.status !== 200 && putRes.status !== 308) {
      throw new Error(await googleError(putRes) || `Upload ao Drive falhou (${putRes.status})`)
    }
    if (putRes.status === 200) {
      const text = await putRes.text()
      const meta = text ? JSON.parse(text) : null
      if (meta?.id) fileId = meta.id
    }
    start = end + 1
  }

  if (!fileId) throw new Error('Google não retornou o id do arquivo')

  await fetch(`${DRIVE_URL}/files/${fileId}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })

  const getRes = await fetch(`${DRIVE_URL}/files/${fileId}?fields=webContentLink,webViewLink,id`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const fileData = await getRes.json()

  return {
    fileId,
    url: fileData.webContentLink || `https://drive.google.com/uc?id=${fileData.id}&export=download`,
  }
}

async function getAuthUser(req: Request): Promise<{ user: { id: string } | null }> {
  const authHeader = req.headers.get('Authorization') || ''
  try {
    const client = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user) return { user: null }
    return { user: { id: user.id } }
  } catch (e) {
    console.error('getAuthUser error:', e)
    return { user: null }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  // Serviços internos (Container) usam service role key + userId no body
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const authHeader = req.headers.get('Authorization') || ''
  const isServiceAuth = authHeader === `Bearer ${serviceKey}`

  let userId: string | null = null
  if (isServiceAuth) {
    // Container: lê userId do body
    const body = await req.clone().json().catch(() => ({}))
    userId = body.userId || null
  } else {
    const { user } = await getAuthUser(req)
    userId = user?.id || null
  }
  if (!userId) return json({ error: 'Não autorizado' }, 401)

  if (req.method === 'POST' && action === 'presign') {
    try {
      const { key, mimeType } = await req.json()
      if (!key || !mimeType) return json({ error: 'key e mimeType são obrigatórios' }, 400)

      if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        return json({ error: 'Credenciais do R2 não configuradas na edge function' }, 500)
      }

      const uploadUrl = await createR2PresignedUrl(key)
      return json({ uploadUrl, key })
    } catch (err) {
      console.error('presign error:', err)
      return json({ error: err instanceof Error ? err.message : 'Falha ao gerar URL de upload' }, 500)
    }
  }

  if (req.method === 'POST' && action === 'process') {
    try {
      const { key, name, folderPath } = await req.json()
      if (!key || !name) return json({ error: 'key e name são obrigatórios' }, 400)

      if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        return json({ error: 'Credenciais do R2 não configuradas na edge function' }, 500)
      }

      const accessToken = await getAccessTokenFor(userId)

      const blob = await getR2Object(key)
      const driveResult = await uploadToDrive(blob, name, accessToken, folderPath, userId)

      const verifyRes = await fetch(`${DRIVE_URL}/files/${driveResult.fileId}?fields=id,name,size`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!verifyRes.ok) throw new Error('Falha ao verificar arquivo no Drive')

      const verified = await verifyRes.json()
      if (!verified.id) throw new Error('Arquivo não encontrado no Drive após upload')

      // NÃO deleta do R2 — mantém o arquivo para preview
      // await deleteR2Object(key)

      return json({
        url: driveResult.url,
        fileId: driveResult.fileId,
        verified: true,
      })
    } catch (err) {
      console.error('process error:', err)
      return json({ error: err instanceof Error ? err.message : 'Falha ao processar upload' }, 500)
    }
  }

  // action=purge → apaga todos os objetos do bucket R2 (legado)
  if (req.method === 'POST' && action === 'purge') {
    try {
      const { confirm } = await req.json().catch(() => ({}))
      if (!confirm) return json({ error: 'Envie confirm: true para confirmar o purge' }, 400)

      if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        return json({ error: 'Credenciais do R2 não configuradas na edge function' }, 500)
      }

      const { deleted } = await s3PurgeBucket()
      return json({ ok: true, deleted })
    } catch (err) {
      console.error('purge error:', err)
      return json({ error: err instanceof Error ? err.message : 'Falha ao purge do R2' }, 500)
    }
  }

  return json({ error: 'Método não suportado' }, 405)
})
