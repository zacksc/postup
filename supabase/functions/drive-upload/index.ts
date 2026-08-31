import { serve } from 'https://deno.land/std@0.170.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { decryptToken } from '../_shared/crypto.ts'

const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'
const DRIVE_URL = 'https://www.googleapis.com/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

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

async function googleError(res: Response): Promise<string> {
  try {
    const body = await res.clone().json()
    return body?.error?.message || `Falha na API do Google (${res.status})`
  } catch {
    return `Falha na API do Google (${res.status})`
  }
}

/**
 * Upload de arquivo pequeno (≤ chunk size) num único PUT.
 */
async function uploadSingleChunk(sessionUri: string, file: File, accessToken: string): Promise<string> {
  const putRes = await fetch(sessionUri, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'Content-Length': String(file.size),
      Authorization: `Bearer ${accessToken}`,
    },
    body: file,
  })
  if (!putRes.ok) throw new Error(await googleError(putRes) || `Upload ao Drive falhou (${putRes.status})`)
  const meta = await putRes.json() as { id?: string }
  if (!meta.id) throw new Error('Google não retornou o id do arquivo')
  return meta.id
}

/**
 * Upload resumable em chunks: quebra o arquivo em pedaços de CHUNK_SIZE e
 * envia cada um via PUT com Content-Range. O Google monta o arquivo final.
 * Necessário porque o Supabase Edge Function tem limite de body size (~6 MB
 * no Free, ~50 MB no Pro); chunkando contornamos o limite do runtime.
 */
async function uploadResumableChunks(
  sessionUri: string,
  file: File,
  totalSize: number,
  chunkSize: number,
  accessToken: string,
): Promise<string> {
  let start = 0
  let fileId: string | null = null

  while (start < totalSize) {
    const end = Math.min(start + chunkSize - 1, totalSize - 1)
    const chunk = file.slice(start, end + 1)
    const contentRange = `bytes ${start}-${end}/${totalSize}`
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
      const meta = text ? JSON.parse(text) as { id?: string } : null
      if (meta?.id) fileId = meta.id
    }
    start = end + 1
  }

  if (!fileId) throw new Error('Google não retornou o id do arquivo')
  return fileId
}

/**
 * Resolve/cria a cadeia de pastas de `folderPath` (ex.: "Cliente/2026/08/04/stories/seq-01").
 * Usa o cache `drive_folders` (path→folder_id) para não recriar pastas nem fazer
 * files.list; verifica o id cacheado com um files.get barato e recria se sumiu.
 * drive.file: só acessa pastas que o próprio app cria — o que é exatamente o caso.
 */
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
    // id velho (pasta apagada pelo usuário) → recria e atualiza o cache
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

  // Upsert com ignoreDuplicates: dois uploads concorrentes não quebram o insert
  // do cache (a pasta já foi criada no Drive por um deles).
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

async function getAuthUser(req: Request) {
  const authHeader = req.headers.get('Authorization') || ''
  const client = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_ANON_KEY') || '',
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) return null
  return user
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })

  const user = await getAuthUser(req)
  if (!user) return json({ error: 'Não autorizado' }, 401)

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  // action=check → lista arquivos já existentes na pasta de destino que contêm
  // o `name` (baseName original, ex.: "video-entrevista") no nome do arquivo.
  // Usa `contains` porque o app prefixa os arquivos com timestamp (1723...-nome.mp4).
  // O client decide se substitui, mantém os dois ou cancela. Não cria pastas.
  if (req.method === 'POST' && action === 'check') {
    try {
      const { folderPath, name } = await req.json()
      if (!folderPath || !name) return json({ error: 'folderPath e name são obrigatórios' }, 400)

      const accessToken = await getAccessTokenFor(user.id)
      // Sem criar: só retorna o id se a pasta JÁ existir (cache ou Drive).
      const parents = await resolveFolderChain(user.id, accessToken, folderPath, false)
      if (parents.length === 0) return json({ files: [] })

      const folderId = parents[0]
      const safeName = name.replace(/'/g, "\\'")
      const q = `'${folderId}' in parents and name contains '${safeName}' and trashed=false`
      const res = await fetch(
        `${DRIVE_URL}/files?q=${encodeURIComponent(q)}&fields=files(id,name,size,createdTime,modifiedTime)&pageSize=10&spaces=drive`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      if (!res.ok) throw new Error(await googleError(res))
      const data = await res.json()
      return json({ files: data.files || [] })
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'Falha ao checar arquivo no Drive' }, 500)
    }
  }

  // action=start → cria sessão resumable e devolve o sessionUri para o CLIENT fazer o PUT direto
  if (req.method === 'POST' && action === 'start') {
    try {
      const { name, mimeType, folderPath } = await req.json()
      if (!name) return json({ error: 'name é obrigatório' }, 400)

      const accessToken = await getAccessTokenFor(user.id)
      const parents = folderPath
        ? await resolveFolderChain(user.id, accessToken, String(folderPath))
        : []
      const metadata = { name, parents } // drive.file: arquivo criado pelo app
      const res = await fetch(`${UPLOAD_URL}?uploadType=resumable&fields=id`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mimeType || 'application/octet-stream',
        },
        body: JSON.stringify(metadata),
      })
      if (!res.ok) throw new Error(await googleError(res))
      const sessionUri = res.headers.get('Location')
      if (!sessionUri) throw new Error('Google não retornou session URI')
      return json({ sessionUri })
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'Falha ao iniciar upload' }, 500)
    }
  }

  // action=upload → faz o upload do arquivo diretamente do server para o Drive
  // (evita CORS no browser — o client envia o arquivo pra cá, e o server faz o PUT no Drive)
  // Suporta arquivos grandes via resumable upload em chunks de 8 MB.
  if (req.method === 'POST' && action === 'upload') {
    try {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      const sessionUri = formData.get('sessionUri') as string | null

      if (!file || !sessionUri) return json({ error: 'file e sessionUri são obrigatórios' }, 400)

      const accessToken = await getAccessTokenFor(user.id)
      const CHUNK_SIZE = 8 * 1024 * 1024 // 8 MB por chunk
      const totalSize = file.size
      const fileId = totalSize <= CHUNK_SIZE
        ? await uploadSingleChunk(sessionUri, file, accessToken)
        : await uploadResumableChunks(sessionUri, file, totalSize, CHUNK_SIZE, accessToken)

      // Torna público e pega o link de exibição
      const shareHeaders = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
      await fetch(`${DRIVE_URL}/files/${fileId}/permissions`, {
        method: 'POST',
        headers: shareHeaders,
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      })

      const res = await fetch(`${DRIVE_URL}/files/${fileId}?fields=webContentLink,webViewLink,id`, { headers: shareHeaders })
      if (!res.ok) throw new Error(await googleError(res))
      const fileData = await res.json()

      return json({
        url: fileData.webContentLink || `https://drive.google.com/uc?id=${fileData.id}&export=download`,
        fileId: fileData.id,
      })
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'Falha ao fazer upload no Drive' }, 500)
    }
  }

  // action=share → torna o arquivo público ("qualquer um com o link") e devolve a URL de exibição
  if (req.method === 'POST' && action === 'share') {
    try {
      const { fileId } = await req.json()
      if (!fileId) return json({ error: 'fileId é obrigatório' }, 400)

      const accessToken = await getAccessTokenFor(user.id)
      const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }

      await fetch(`${DRIVE_URL}/files/${fileId}/permissions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      })

      const res = await fetch(`${DRIVE_URL}/files/${fileId}?fields=webContentLink,webViewLink,id`, { headers })
      if (!res.ok) throw new Error(await googleError(res))
      const file = await res.json()

      // webContentLink é o link de download direto (funciona em <img>/<video> quando o arquivo é público)
      return json({
        url: file.webContentLink || `https://drive.google.com/uc?id=${file.id}&export=download`,
      })
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'Falha ao compartilhar arquivo' }, 500)
    }
  }

  // action=delete → apaga um arquivo do Drive do usuário dono da conexão.
  // Só apaga se o arquivo pertence ao app (escopo drive.file); o Google nega
  // (403) arquivos/pastas que o app não criou.
  if (req.method === 'POST' && action === 'delete') {
    try {
      const { fileId } = await req.json()
      if (!fileId) return json({ error: 'fileId é obrigatório' }, 400)

      const accessToken = await getAccessTokenFor(user.id)
      const res = await fetch(`${DRIVE_URL}/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok && res.status !== 404) {
        throw new Error(await googleError(res))
      }
      return json({ ok: true })
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'Falha ao excluir arquivo' }, 500)
    }
  }

  return json({ error: 'Método não suportado' }, 405)
})