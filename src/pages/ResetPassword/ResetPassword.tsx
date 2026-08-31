import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { Brand } from '@/components/layout/Brand'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading, isRecoverySession, updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    const result = await updatePassword(password)
    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      setDone(true)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isRecoverySession || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
        <div className="w-full max-w-sm bg-card border rounded-2xl p-6 flex flex-col gap-4 shadow-sm text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <KeyRound size={20} className="text-destructive" />
          </div>
          <p className="text-sm text-muted-foreground">
            Link inválido ou expirado. Solicite um novo link de redefinição.
          </p>
          <Link to="/esqueci-senha" className="text-sm text-primary font-medium hover:underline">
            Solicitar novo link
          </Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
        <div className="w-full max-w-sm bg-card border rounded-2xl p-6 flex flex-col gap-4 shadow-sm text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <KeyRound size={20} className="text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Senha redefinida com sucesso!</p>
          <Button onClick={() => navigate('/login')} className="gap-2">
            Ir para o login
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Brand variant="text" height={32} className="mx-auto" />
          <p className="text-muted-foreground mt-2">Defina sua nova senha</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl">
              {error}
            </div>
          )}

          <div className="grid gap-2">
            <label className="text-sm font-medium">Nova senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full p-2.5 bg-background border rounded-xl text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Confirmar senha</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full p-2.5 bg-background border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <Button type="submit" disabled={loading} className="gap-2">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            Redefinir senha
          </Button>

          <Link to="/login" className="text-sm text-center text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1">
            <ArrowLeft size={14} /> Voltar para o login
          </Link>
        </form>
      </div>
    </div>
  )
}
