import { supabase } from '@/lib/supabase'
import { buildFolderPath, DEFAULT_FOLDER_TEMPLATE, DEFAULT_ROOT_FOLDER, type FolderContext } from '@/lib/drive-folders'

/**
 * Camada de mídia — decisão de display vs. original:
 * - DISPLAY (cards, previews, lightbox): SEMPRE no bucket público `posts-media`
 *   do Supabase. URLs públicas, confiáveis, sem virus-scan.
 * - ORIGINAL (download de originais): Google Drive (quando o usuário conectou).
 *   Upload via edge function (server-side, sem CORS).
 *
 * `uploadMedia()` → retorna URL do Supabase (display).
 * `uploadOriginalToDrive()` → retorna URL do Drive (original, ou null).
 * `uploadMediaWithOriginal()` → combina ambos: `{ url, originalUrl }`.
 *
 * Fluxo de pastas (D21): ao informar `options.context` (cliente/data/tipo/
 * sequência/plataforma), o upload no Drive cria a hierarquia do template.
 */

export type { FolderContext }

interface DriveStart {
  sessionUri?: string
  error?: string
}

/**
 * Provider por usuário: o app usa o Google Drive de QUEM ESTÁ LOGADO, se ele
 * conectou a própria conta (tabela user_drive_connections, RLS permite o usuário
 * ver a própria linha). Sem conexão → Supabase.
 *
 * `VITE_STORAGE_PROVIDER=supabase` força o bucket Supabase mesmo com Drive
 * conectado — usado para testar o storage do Supabase antes de migrar para o
 * Cloudflare R2 (D19). `VITE_STORAGE_PROVIDER=r2` usa o fluxo R2→Drive
 * (upload temporário pro R2, depois processa pro Google Drive). Qualquer outro
 * valor/não definido mantém o fluxo atual.
 */
const FORCED_PROVIDER = import.meta.env.VITE_STORAGE_PROVIDER

async function hasDriveConnection(): Promise<boolean> {
  if (FORCED_PROVIDER === 'supabase') return false
  const { data } = await supabase
    .from('user_drive_connections')
    .select('id')
    .maybeSingle()
  return Boolean(data)
}

/**
 * Settings do fluxo de pastas do usuário (D21): template, pasta raiz e os valores
 * fixos de agência/equipe usados pelos placeholders {agencia}/{equipe}.
 * Sem registro → defaults. Cache em memória por sessão para uploads em lote não
 * consultarem o banco a cada arquivo.
 */
interface StorageSettings {
  folderTemplate: string
  rootFolder: string
  agencia: string
  equipe: string
  /** true → comprime vídeos antes de enviar; false → envia o original. */
  compressVideos: boolean
}

let storageCache: StorageSettings | undefined

export async function getUserStorageSettings(): Promise<StorageSettings> {
  if (storageCache !== undefined) return storageCache
  const { data } = await supabase
    .from('user_storage_settings')
    .select('folder_template, root_folder, agencia, equipe, compress_videos')
    .maybeSingle()
  const row = data as {
    folder_template?: string | null
    root_folder?: string | null
    agencia?: string | null
    equipe?: string | null
    compress_videos?: boolean | null
  } | null
  storageCache = {
    folderTemplate: row?.folder_template || DEFAULT_FOLDER_TEMPLATE,
    rootFolder: row?.root_folder || DEFAULT_ROOT_FOLDER,
    agencia: row?.agencia || '',
    equipe: row?.equipe || '',
    compressVideos: row?.compress_videos !== false,
  }
  return storageCache
}

/** Invalida o cache (chamado ao salvar as settings em Configurações → Armazenamento). */
export function resetFolderTemplateCache(): void {
  storageCache = undefined
}

/**
 * Upload via edge function proxy (server-side). O bytes do arquivo
 * passam pelo Supabase Edge Function, que encaminha ao Google Drive.
 * Esta é a única via funcional: o upload direto do browser ao Google
 * falha com CORS na prática.
 *
 * Limite de body: ~50 MB (Pró plan). Para arquivos maiores, é
 * necessário comprimir o vídeo (compressPostMediaAndReupload)
 * ou subir manualmente no Google Drive.
 */
async function uploadToGDrive(
  blob: Blob,
  name: string,
  context?: FolderContext,
): Promise<string> {
  const folderPath = await getDriveFolderPath(context)

  const { data: start, error: startErr } = await supabase.functions.invoke<DriveStart>(
    'drive-upload?action=start',
    { body: { name, mimeType: blob.type || 'application/octet-stream', folderPath } },
  )
  if (startErr || !start?.sessionUri) throw new Error(start?.error || 'Falha ao iniciar sessão de upload no Google Drive — verifique se a conta está conectada em Configurações → Armazenamento')

  const uploadBody = new FormData()
  uploadBody.append('file', blob, name)
  uploadBody.append('sessionUri', start.sessionUri)
  const { data: uploadData, error: uploadErr } = await supabase.functions.invoke<{
    url?: string
    error?: string
  }>('drive-upload?action=upload', {
    body: uploadBody,
  })
  if (uploadErr || !uploadData?.url) {
    const msg = uploadData?.error || ''
    if (msg.includes('546') || msg.includes('payload too large') || msg.includes('request entity too large') || msg.includes('body size')) {
      throw new Error('O arquivo é grande demais para o limite do servidor. Tente comprimir o vídeo ou suba manualmente no Google Drive e cole o link.')
    }
    throw new Error(msg || 'Falha ao enviar arquivo para o Google Drive — tente novamente ou conecte a conta em Configurações → Armazenamento')
  }
  return uploadData.url
}

async function uploadToSupabase(blob: Blob, path: string, upsert = false): Promise<string> {
  const { error } = await supabase.storage.from('posts-media').upload(path, blob, { upsert })
  if (error) throw new Error(describeStorageError(error) || error.message)
  const { data: { publicUrl } } = supabase.storage.from('posts-media').getPublicUrl(path)
  return publicUrl
}

/**
 * Mapeia erros de limite/quota do storage para uma mensagem clara em pt-BR.
 * Retorna `null` quando o erro não é de espaço — o chamador mantém a mensagem original.
 */
const QUOTA_PATTERNS = [
  /quota/i,
  /limit/i,
  /capacity/i,
  /storage( is|_)?( full|_exceeded)/i,
  /no space/i,
  /insufficient/i,
]

// Erros de "arquivo muito grande": o Supabase Storage (fallback sem Drive) rejeita
// objetos acima de ~50 MB com "The object exceeded the maximum allowed size".
const SIZE_PATTERNS = [
  /exceeded the maximum allowed size/i,
  /object too large/i,
  /payload too large/i,
  /maximum.*size/i,
  /request entity too large/i,
]

export function describeStorageError(error: { message?: string } | null | undefined): string | null {
  const raw = error?.message || ''
  if (SIZE_PATTERNS.some(p => p.test(raw))) {
    return 'O arquivo é maior que o limite de 50 MB do armazenamento padrão. Conecte o Google Drive em Configurações → Armazenamento para enviar arquivos grandes, ou use um vídeo mais curto/leve.'
  }
  const isQuota = QUOTA_PATTERNS.some(p => p.test(raw))
  if (!isQuota) return null
  return 'Espaço de armazenamento cheio. Libere espaço no plano do Supabase ou conecte o Google Drive em Configurações → Armazenamento.'
}

/**
  * Upload de mídia para EXIBIÇÃO (display). SEMPRE sobe no bucket Supabase
  * `posts-media` e retorna a URL pública — sem usar Drive. Esta é a URL que
  * fica em `media_urls` e é usada em <img>/<video> nos cards.
  *
  * Para o Google Drive (original para download), usar `uploadOriginalToDrive`.
  */
export async function uploadMedia(
  blob: Blob,
  pathOrName: string,
  options?: { upsert?: boolean; context?: FolderContext },
): Promise<string> {
  return uploadToSupabase(blob, pathOrName, options?.upsert)
}

/**
 * Upload do ORIGINAL no Google Drive (quando o usuário conectou a conta).
 * Retorna a URL de download do Drive, ou null se não houver conexão / erro.
 * Usado em conjunto com `uploadMedia` para preservar o arquivo original para
 * download — a URL retornada aqui vai para `original_urls`.
 *
 * `options.context` ativa o fluxo de pastas no Drive (ver drive-folders.ts).
 */
export async function uploadOriginalToDrive(
  blob: Blob,
  pathOrName: string,
  options?: { context?: FolderContext },
): Promise<string | null> {
  if (FORCED_PROVIDER === 'supabase') return null
  if (!(await hasDriveConnection())) return null
  const name = pathOrName.split('/').pop() || pathOrName
  try {
    return await uploadToGDrive(blob, name, options?.context)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[uploadOriginalToDrive] Original não salvo no Drive (${name}): ${msg}`)
    return null
  }
}

/**
 * Upload combinado: display (Supabase) + original (Drive quando conectado).
 * Retorna `{ url, originalUrl }` — `url` é sempre a URL de exibição (Supabase);
 * `originalUrl` é a URL do Drive (ou `null` se sem conexão / erro).
 *
 * Para imagens: displayBlob = webp comprimido; originalBlob = arquivo original.
 * Para vídeos: ambos podem ser o mesmo blob (upload duplicado para preservar
 * original no Drive); se o blob for > 50 MB, o upload no Supabase pode falhar
 * — nesse caso, o chamador deve usar `uploadMediaToDriveFallback`.
 */
export async function uploadMediaWithOriginal(
  displayBlob: Blob,
  originalBlob: Blob,
  pathOrName: string,
  options?: { upsert?: boolean; context?: FolderContext },
): Promise<{ url: string; originalUrl: string | null }> {
  const [url, originalUrl] = await Promise.all([
    uploadMedia(displayBlob, pathOrName, options),
    uploadOriginalToDrive(originalBlob, pathOrName, options),
  ])
  return { url, originalUrl }
}

/**
 * Upload de mídia ao Drive quando o Supabase não comporta (vídeos > 50 MB).
 * Retorna a URL do Drive como display E original (fallback para vídeos grandes).
 * Chamador deve armazenar em `media_urls` e `original_urls` a mesma URL.
 */
export async function uploadMediaToDriveFallback(
  blob: Blob,
  pathOrName: string,
  options?: { context?: FolderContext },
): Promise<string | null> {
  return uploadOriginalToDrive(blob, pathOrName, options)
}

export interface DriveFileInfo {
  id: string
  name: string
  size?: number
  createdTime?: string
  modifiedTime?: string
}

/**
 * Checa se já existe um arquivo com o MESMO NOME BASE na pasta de destino do Drive
 * (resolvida a partir do `context`). A busca usa `name contains` porque o app
 * prefixa os arquivos com timestamp (`1723...-video.mp4`); passando o baseName
 * original ("video"), encontra uploads antigos do mesmo arquivo. Retorna vazio
 * quando não há duplicata, a pasta ainda não existe ou o Drive está desconectado.
 * Não cria pastas (checagem é read-only).
 */
export async function checkDriveFile(
  name: string,
  context?: FolderContext,
): Promise<DriveFileInfo[]> {
  if (!(await hasDriveConnection())) return []
  const folderPath = await getDriveFolderPath(context)
  if (!folderPath) return []
  const { data, error } = await supabase.functions.invoke<{ files?: DriveFileInfo[]; error?: string }>(
    'drive-upload?action=check',
    { body: { folderPath, name } },
  )
  if (error || !data) return []
  return data.files || []
}

/**
 * Apaga um arquivo do Drive do usuário (action=delete da edge). Usado quando o
 * usuário decide SUBSTITUIR uma duplicata — apaga a antiga após o upload da nova.
 */
export async function deleteDriveFile(fileId: string): Promise<void> {
  await supabase.functions.invoke('drive-upload?action=delete', { body: { fileId } })
}

/**
 * Monta o caminho de pastas (sem a pasta raiz do provider) a partir do `context`,
 * com as mesmas regras do upload. Retorna `undefined` quando o contexto é vazio.
 */
export async function getDriveFolderPath(context?: FolderContext): Promise<string | undefined> {
  if (!context || !(context.client || context.date || context.type || context.sequence || context.plataforma)) {
    return undefined
  }
  const settings = await getUserStorageSettings()
  const inner = buildFolderPath(settings.folderTemplate, {
    ...context,
    agencia: settings.agencia || context.agencia,
    equipe: settings.equipe || context.equipe,
  })
  return settings.rootFolder ? `${settings.rootFolder}/${inner}` : inner
}
