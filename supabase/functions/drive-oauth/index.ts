import { serve } from 'https://deno.land/std@0.170.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { encryptToken } from '../_shared/crypto.ts'

// Escopo: drive.file — só acessa os arquivos que o app cria. Sem acesso à Drive do usuário.
const SCOPES = 'https://www.googleapis.com/auth/drive.file'
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
)

interface TokenInfo {
  access_token: string
  refresh_token?: string
}

function getRedirectUri(callbackOrigin?: string): string {
  // O redirect_uri precisa ser o MESMO usado no `start` e no `callback`
  // (exigência do Google). O front informa a própria origem; a env vira fallback
  // para quem ainda não atualizou o client.
  const origin = callbackOrigin?.trim()
  if (origin) return `${origin.replace(/\/+$/, '')}/drive/callback`
  return Deno.env.get('GOOGLE_REDIRECT_URI') || ''
}

async function exchangeCode(code: string, redirectUri: string): Promise<TokenInfo> {
  const params = new URLSearchParams({
    client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
    client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  })
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token exchange failed: ${res.status} ${err}`)
  }
  return res.json() as Promise<TokenInfo>
}

async function getGoogleInfo(accessToken: string) {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return {}
    return await res.json()
  } catch {
    return {}
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })

  // Usuário autenticado no PostUp = dono do refresh_token.
  const authHeader = req.headers.get('Authorization') || ''
  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_ANON_KEY') || '',
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
  if (userError || !user) return json({ error: 'Não autorizado. Faça login no PostUp primeiro.' }, 401)

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  // action=start → devolve a URL do Google (front redireciona o usuário)
  if (action === 'start') {
    const body = await req.json().catch(() => ({}))
    const redirectUri = getRedirectUri(body.callbackOrigin)
    if (!redirectUri) return json({ error: 'GOOGLE_REDIRECT_URI não configurada' }, 500)
    const params = new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state: user.id,
    })
    return json({ url: `${AUTH_URL}?${params.toString()}` })
  }

  // action=callback → recebe o code, troca por refresh_token e persiste
  if (req.method === 'POST' && action === 'callback') {
    try {
      const { code, callbackOrigin, state } = await req.json()
      if (!code) return json({ success: false, error: 'code é obrigatório' })
      if (state && state !== user.id) return json({ success: false, error: 'state inválido' })

      const redirectUri = getRedirectUri(callbackOrigin)
      const tokenInfo = await exchangeCode(code, redirectUri)
      if (!tokenInfo.refresh_token) {
        return json({ success: false, error: 'Google não retornou refresh_token. Revogue o acesso no Google e tente de novo.' })
      }

      const info = await getGoogleInfo(tokenInfo.access_token)
      const encrypted = await encryptToken(tokenInfo.refresh_token)

      const { error: rpcError } = await supabase.rpc('upsert_drive_connection', {
        p_user: user.id,
        p_google_uid: info.id ?? '',
        p_email: info.email ?? '',
        p_drive_name: info.name ?? '',
        p_refresh_token: encrypted,
      })
      if (rpcError) throw rpcError

      return json({ success: true })
    } catch (err) {
      // Sempre 200 para o client conseguir ler `data.error` (o supabase.functions.invoke
      // descarta o corpo em não-2xx). rpcError do supabase-js não é `instanceof Error`.
      const msg = err instanceof Error
        ? err.message
        : (err && typeof err === 'object' && 'message' in err)
          ? String((err as { message: unknown }).message)
          : 'Falha ao conectar Google Drive'
      return json({ success: false, error: msg })
    }
  }

  return json({ error: 'Método não suportado' }, 405)
})