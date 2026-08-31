import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface VideoJob {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'error'
  progress: number
  message: string
  appUrl?: string
  clientUrl?: string
  error?: string
  createdAt: string
  completedAt?: string
}

interface UseVideoProcessReturn {
  /** Enfileira um vídeo para processamento */
  processVideo: (file: File, postId?: string, folderPath?: string) => Promise<string | null>
  /** Retorna status de um job específico */
  getJobStatus: (jobId: string) => Promise<VideoJob | null>
  /** Job atual sendo processado */
  currentJob: VideoJob | null
  /** Se está processando */
  isProcessing: boolean
  /** Erro */
  error: string | null
}

/**
 * Hook para processamento de vídeos via Cloudflare Container.
 * 
 * Fluxo:
 * 1. Browser envia vídeo para o Worker (via Supabase Edge Function)
 * 2. Worker salva no R2 e enfileira na Queue
 * 3. Container processa com ffmpeg (2 versões: App + Cliente)
 * 4. Container atualiza status no Supabase (Realtime)
 * 5. Hook recebe atualizações em tempo real
 */
export function useVideoProcess(): UseVideoProcessReturn {
  const [currentJob, setCurrentJob] = useState<VideoJob | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Inscreve-se em atualizações Realtime do job atual
  useEffect(() => {
    if (!currentJob?.id) return

    const channel = supabase
      .channel(`video-job:${currentJob.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'video_jobs',
          filter: `id=eq.${currentJob.id}`,
        },
        (payload) => {
          const updated = payload.new as Record<string, unknown>
          setCurrentJob({
            id: updated.id as string,
            status: updated.status as VideoJob['status'],
            progress: updated.progress as number,
            message: (updated.message as string) || '',
            appUrl: updated.app_url as string | undefined,
            clientUrl: updated.client_url as string | undefined,
            error: updated.error as string | undefined,
            createdAt: updated.created_at as string,
            completedAt: updated.completed_at as string | undefined,
          })

          // Para de processar quando completar ou errar
          if (updated.status === 'completed' || updated.status === 'error') {
            setIsProcessing(false)
            if (updated.status === 'error') {
              setError((updated.error as string) || 'Erro ao processar vídeo')
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentJob?.id])

  const getJobStatus = useCallback(async (jobId: string): Promise<VideoJob | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return null

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-job-status?jobId=${jobId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      )

      if (!response.ok) return null

      return await response.json()
    } catch {
      return null
    }
  }, [])

  const processVideo = useCallback(async (file: File, postId?: string, folderPath?: string): Promise<string | null> => {
    setIsProcessing(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Não autenticado')

      // 1. Sobe o vídeo no R2 via presigned URL
      const r2Key = `video-jobs/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`

      // Obtém presigned URL do edge function
      const presignRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/r2-to-drive?action=presign`,
        {
          method: 'POST',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ key: r2Key, mimeType: file.type || 'video/mp4' }),
        }
      )
      const presignData = await presignRes.json()
      if (!presignData.uploadUrl) throw new Error('Falha ao obter URL de upload')

      // Upload direto pro R2
      const putRes = await fetch(presignData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'video/mp4' },
        body: file,
      })
      if (!putRes.ok) throw new Error(`Falha ao enviar pro R2: ${putRes.status}`)

      // 2. Chama edge function para iniciar processamento no Render
      const processRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-process`,
        {
          method: 'POST',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            r2Key,
            postId,
            originalName: file.name,
            mimeType: file.type || 'video/mp4',
            folderPath,
          }),
        }
      )

      if (!processRes.ok) {
        const data = await processRes.json()
        throw new Error(data.error || 'Erro ao iniciar processamento')
      }

      const { jobId } = await processRes.json()

      // Busca status inicial do job
      const job = await getJobStatus(jobId)
      if (job) setCurrentJob(job)

      return jobId
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(message)
      setIsProcessing(false)
      return null
    }
  }, [])

  return {
    processVideo,
    getJobStatus,
    currentJob,
    isProcessing,
    error,
  }
}
