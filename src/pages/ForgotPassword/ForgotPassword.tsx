import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { Brand } from '@/components/layout/Brand'

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await resetPassword(email)
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Brand variant="text" height={32} className="mx-auto" />
          <p className="text-muted-foreground mt-2">Redefinir senha</p>
        </div>

        {sent ? (
          <div className="bg-card border rounded-2xl p-6 flex flex-col gap-4 shadow-sm text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail size={20} className="text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Enviamos um link de redefinição para <strong>{email}</strong>. Verifique sua caixa de entrada (e o spam).
            </p>
            <Link to="/login" className="text-sm text-primary font-medium hover:underline">
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-card border rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Digite seu email e enviaremos um link para redefinir sua senha.
            </p>

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl">
                {error}
              </div>
            )}

            <div className="grid gap-2">
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full p-2.5 bg-background border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <Button type="submit" disabled={loading} className="gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              Enviar link de redefinição
            </Button>

            <Link to="/login" className="text-sm text-center text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1">
              <ArrowLeft size={14} /> Voltar para o login
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
