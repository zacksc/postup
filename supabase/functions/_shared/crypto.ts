// Criptografia AES-GCM para o refresh_token do Google Drive.
// A chave (DRIVE_ENCRYPTION_KEY) vive só no edge function (variável de ambiente),
// nunca no bundle do front. Formato criptografado: base64(iv) + ':' + base64(ciphertext).

const enc = new TextEncoder()

async function getKey(): Promise<CryptoKey> {
  const raw = Deno.env.get('DRIVE_ENCRYPTION_KEY')
  if (!raw) throw new Error('DRIVE_ENCRYPTION_KEY não configurada')
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(raw))
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function encryptToken(plain: string): Promise<string> {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain))
  const ivB64 = btoa(String.fromCharCode(...iv))
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(cipher)))
  return `${ivB64}:${ctB64}`
}

export async function decryptToken(payload: string): Promise<string> {
  const [ivB64, ctB64] = payload.split(':')
  if (!ivB64 || !ctB64) throw new Error('Token criptografado inválido')
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0))
  const ct = Uint8Array.from(atob(ctB64), c => c.charCodeAt(0))
  const key = await getKey()
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new TextDecoder().decode(plain)
}