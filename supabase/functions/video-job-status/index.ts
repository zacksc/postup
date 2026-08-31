import { serve } from 'https://deno.land/std@0.170.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '',
)

/**
 * Edge Function: video-job-status
 * 
 * Gerencia status de jobs de processamento de vídeo.
 * - GET: Retorna status de um job específico
 * - PATCH: Atualiza status do job (usado pelo Container)
 */

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
  const jobId = url.searchParams.get('jobId')

  // GET: Retorna status do job
  if (req.method === 'GET' && jobId) {
    const { user } = await getAuthUser(req)
    if (!user) return json({ error: 'Não autorizado' }, 401)

    const { data, error } = await supabase
      .from('video_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      return json({ error: 'Job não encontrado' }, 404)
    }

    return json({
      id: data.id,
      status: data.status,
      progress: data.progress,
      message: data.message,
      appUrl: data.app_url,
      clientUrl: data.client_url,
      error: data.error,
      createdAt: data.created_at,
      completedAt: data.completed_at,
    })
  }

  // PATCH: Atualiza status do job (usado pelo Container via service key)
  if (req.method === 'PATCH' && jobId) {
    // Verifica se é service key (Container) ou user (validação)
    const authHeader = req.headers.get('Authorization') || ''
    const isServiceKey = authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '')

    if (!isServiceKey) {
      const { user } = await getAuthUser(req)
      if (!user) return json({ error: 'Não autorizado' }, 401)
    }

    const body = await req.json()
    const updateData: Record<string, unknown> = {}

    if (body.status !== undefined) updateData.status = body.status
    if (body.progress !== undefined) updateData.progress = body.progress
    if (body.message !== undefined) updateData.message = body.message
    if (body.app_url !== undefined) updateData.app_url = body.app_url
    if (body.client_url !== undefined) updateData.client_url = body.client_url
    if (body.error !== undefined) updateData.error = body.error
    if (body.status === 'completed' || body.status === 'error') {
      updateData.completed_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('video_jobs')
      .update(updateData)
      .eq('id', jobId)

    if (error) {
      console.error('Erro ao atualizar job:', error)
      return json({ error: 'Erro ao atualizar job' }, 500)
    }

    return json({ success: true })
  }

  return json({ error: 'Método não suportado' }, 405)
})
