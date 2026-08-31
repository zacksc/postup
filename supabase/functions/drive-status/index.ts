import { serve } from 'https://deno.land/std@0.170.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { decryptToken } from '../_shared/crypto.ts'

const DRIVE_URL = 'https://www.googleapis.com/drive/v3'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
)

async function getAccessTokenFor(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('user_drive_connections')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data?.refresh_token) throw new Error('drive_not_connected')

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
  if (!res.ok) throw new Error('Não foi possível renovar o token do Google')
  const info = await res.json()
  return info.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })

  const authHeader = req.headers.get('Authorization') || ''
  const client = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_ANON_KEY') || '',
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: userError } = await client.auth.getUser()
  if (userError || !user) return json({ error: 'Não autorizado' }, 401)

  const { data: conn, error: connError } = await supabase
    .from('user_drive_connections')
    .select('id, email, drive_name, created_at')
    .eq('user_id', user.id)
    .maybeSingle()
  if (connError || !conn) return json({ connected: false })

  // Busca quota real do Drive do usuário
  let quota = { limit: 0, used: 0, percent: 0 }
  try {
    const accessToken = await getAccessTokenFor(user.id)
    const res = await fetch(`${DRIVE_URL}/about?fields=storageQuota`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.ok) {
      const about = await res.json()
      const { limit = 0, usage = 0 } = about?.storageQuota ?? {}
      quota = { limit, used: usage, percent: limit > 0 ? Math.round((usage / limit) * 100) : 0 }
    }
  } catch { /* quota indisponível não quebra o status */ }

  return json({ connected: true, email: conn.email, driveName: conn.drive_name, quota })
})