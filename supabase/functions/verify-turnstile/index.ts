import { serve } from 'https://deno.land/std@0.170.0/http/server.ts'

interface VerifyRequest {
  token: string
}

interface CloudflareResponse {
  success: boolean
  'error-codes'?: string[]
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const { token } = await req.json() as VerifyRequest

    if (!token) {
      return json({ error: 'Token is required' }, 400)
    }

    const secretKey = Deno.env.get('TURNSTILE_SECRET_KEY') || '1x00000000000000000000AA'

    const formData = new FormData()
    formData.append('secret', secretKey)
    formData.append('response', token)

    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    })

    const outcome: CloudflareResponse = await result.json()

    if (!outcome.success) {
      return json({
        success: false,
        error: outcome['error-codes']?.join(', ') || 'Verification failed',
      })
    }

    return json({ success: true })
  } catch (err) {
    return json({
      success: false,
      error: err instanceof Error ? err.message : 'Internal error',
    }, 500)
  }
})
