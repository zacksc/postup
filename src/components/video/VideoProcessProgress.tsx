import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import type { VideoJob } from '@/hooks/use-video-process'

interface VideoProcessProgressProps {
  job: VideoJob | null
  isProcessing: boolean
  error: string | null
}

/**
 * Exibe progresso do processamento de vídeo.
 * Mostra status: na fila → processando → completo/erro
 */
export function VideoProcessProgress({ 
  job, 
  isProcessing, 
  error 
}: VideoProcessProgressProps) {
  if (!job && !isProcessing && !error) return null

  const statusConfig = {
    queued: {
      icon: <Loader2 size={16} className="animate-spin text-blue-500" />,
      label: 'Na fila',
      color: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    processing: {
      icon: <Loader2 size={16} className="animate-spin text-primary" />,
      label: 'Processando',
      color: 'text-primary bg-primary/5 border-primary/20',
    },
    completed: {
      icon: <CheckCircle size={16} className="text-green-500" />,
      label: 'Concluído',
      color: 'text-green-600 bg-green-50 border-green-200',
    },
    error: {
      icon: <XCircle size={16} className="text-red-500" />,
      label: 'Erro',
      color: 'text-red-600 bg-red-50 border-red-200',
    },
  }

  const status = job?.status || (isProcessing ? 'processing' : 'error')
  const config = statusConfig[status]

  return (
    <div className={`rounded-xl border p-4 ${config.color}`}>
      <div className="flex items-center gap-3">
        {config.icon}
        <div className="flex-1">
          <p className="text-sm font-semibold">
            {config.label}
            {job?.message && ` — ${job.message}`}
          </p>
          
          {status === 'processing' && job?.progress !== undefined && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span>Progresso</span>
                <span>{job.progress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </div>
          )}

          {status === 'completed' && job?.appUrl && (
            <p className="mt-2 text-xs">
              Vídeo disponível para visualização
            </p>
          )}

          {status === 'error' && error && (
            <p className="mt-2 text-xs text-red-600">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
