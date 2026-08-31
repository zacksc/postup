import { serve } from 'https://deno.land/std@0.170.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '',
)

const RENDER_URL = Deno.env.get('RENDER_VIDEO_URL') || ''
const RENDER_API_KEY = Deno.env.get('RENDER_VIDEO_API_KEY') || ''
const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID') || ''
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID') || ''
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY') || ''
const R2_BUCKET = Deno.env.get('R2_BUCKET') || 'postupstorage'

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
  } catch {
    return { user: null }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const { user } = await getAuthUser(req)
    if (!user) return json({ error: 'Não autorizado' }, 401)

    const body = await req.json()
    const { r2Key, postId, originalName, mimeType, folderPath } = body

    if (!r2Key) return json({ error: 'r2Key é obrigatório' }, 400)

    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // Cria job no Supabase
    const { error: insertErr } = await supabase
      .from('video_jobs')
      .insert({
        id: jobId,
        user_id: user.id,
        post_id: postId || '',
        r2_key: r2Key,
        original_name: originalName || 'video.mp4',
        mime_type: mimeType || 'video/mp4',
        size: 0,
        status: 'queued',
        progress: 0,
        message: 'Enviado para processamento...',
        created_at: new Date().toISOString(),
      })

    if (insertErr) {
      console.error('Erro ao criar job:', insertErr)
      return json({ error: 'Erro ao criar job' }, 500)
    }

    // Chama o Render service
    if (!RENDER_URL) {
      await supabase.from('video_jobs').update({ status: 'error', message: 'Render service não configurado' }).eq('id', jobId)
      return json({ error: 'Render service não configurado' }, 500)
    }

    console.log(`[${jobId}] Chamando Render: ${RENDER_URL}`)
    const renderRes = await fetch(`${RENDER_URL}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RENDER_API_KEY}`,
      },
      body: JSON.stringify({
        jobId,
        r2Key,
        userId: user.id,
        postId: postId || '',
        r2AccountId: R2_ACCOUNT_ID,
        r2AccessKeyId: R2_ACCESS_KEY_ID,
        r2SecretAccessKey: R2_SECRET_ACCESS_KEY,
        r2Bucket: R2_BUCKET,
        supabaseUrl: Deno.env.get('SUPABASE_URL') || '',
        supabaseKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
        folderPath: folderPath || undefined,
      }),
    })

    if (!renderRes.ok) {
      const errText = await renderRes.text()
      console.error('Render error:', errText)
      await supabase.from('video_jobs').update({ status: 'error', message: `Render: ${errText}` }).eq('id', jobId)
      return json({ error: `Render service erro: ${errText}` }, 500)
    }

    console.log(`[${jobId}] Job enviado para Render`)
    return json({ jobId, status: 'queued', message: 'Job enviado para processamento' })
  } catch (err) {
    console.error('Erro:', err)
    return json({ error: 'Erro ao processar' }, 500)
  }
})