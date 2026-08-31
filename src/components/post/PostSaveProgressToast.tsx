import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { subscribePostSaveJobs, type PostSaveJob } from '@/lib/post-save-job'

function formatEta(ms: number): string {
  const totalSec = Math.max(1, Math.round(ms / 1000))
  if (totalSec < 60) return `~${totalSec}s restantes`
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return sec > 0 ? `~${min}min ${sec}s restantes` : `~${min}min restantes`
}

function ProgressCard({ job }: { job: PostSaveJob }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const pct = Math.max(0, Math.min(1, job.progress))
  const pctLabel = `${Math.round(pct * 100)}%`
  // Estimativa do tempo restante baseada no progresso até agora (só confiável
  // quando já avançou; antes disso mostra só o percentual).
  const elapsed = job.startedAt ? now - job.startedAt : 0
  const eta = pct > 0.05 ? formatEta((elapsed / pct) * (1 - pct)) : null

  return (
    <div className="w-72 rounded-xl border border-border bg-popover p-3 shadow-lg">
      <div className="flex items-center gap-2">
        <Loader2 size={16} className="animate-spin shrink-0 text-primary" />
        <p className="text-sm font-semibold leading-tight text-popover-foreground flex-1 min-w-0 truncate">{job.message}</p>
        <span className="text-xs font-bold text-primary shrink-0 tabular-nums">{pctLabel}</span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${Math.round(Math.max(0.02, pct) * 100)}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {eta ? `${eta} · ` : ''}Você pode sair desta tela — o envio continua em segundo plano.
      </p>
    </div>
  )
}

/**
 * Notificação de progresso de salvamento de post, ancorada ACIMA dos botões de
 * ação fixos (não os sobrepõe). Vive dentro do AppShell para sobreviver à
 * navegação: quando o usuário sai da tela de "Programar Post" no meio do envio,
 * o card continua mostrando o progresso em segundo plano e avisa quando termina.
 */
export function PostSaveProgressToast() {
  const navigate = useNavigate()
  const [activeJob, setActiveJob] = useState<PostSaveJob | null>(null)

  useEffect(() => {
    return subscribePostSaveJobs((job) => {
      if (job.phase === 'done' || job.phase === 'error') {
        setActiveJob(null)
        if (job.phase === 'done') {
          toast.success('Post salvo com sucesso!', {
            description: 'O envio terminou em segundo plano e o post foi programado.',
            action: { label: 'Ver post', onClick: () => navigate(job.destination || '/cronograma') },
          })
        } else {
          toast.error('Falha ao salvar o post', {
            description: job.error,
          })
        }
        return
      }
      setActiveJob(job)
    })
  }, [navigate])

  if (!activeJob) return null

  return (
    <div className="fixed right-3 bottom-36 md:bottom-20 z-[60] animate-page">
      <ProgressCard job={activeJob} />
    </div>
  )
}
