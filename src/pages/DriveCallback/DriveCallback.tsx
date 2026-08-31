import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function DriveCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true
    const code = params.get('code')
    const state = params.get('state')
    const error = params.get('error')

    async function finish() {
      if (error) {
        navigate('/perfil?drive=error', { replace: true })
        return
      }
      if (!code) {
        navigate('/perfil?drive=error', { replace: true })
        return
      }
      const { data } = await supabase.functions.invoke(
        'drive-oauth?action=callback',
        { body: { code, state, callbackOrigin: window.location.origin } },
      )
      if (data?.success) {
        navigate('/perfil?drive=success', { replace: true })
      } else {
        const msg = data?.error || 'Erro desconhecido'
        navigate(`/perfil?drive=error&driveMsg=${encodeURIComponent(msg)}`, { replace: true })
      }
    }
    finish()
  }, [params, navigate])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Loader2 size={28} className="animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Conectando seu Google Drive...</p>
    </div>
  )
}