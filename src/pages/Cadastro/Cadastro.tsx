import { useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, UserPlus, Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { Brand } from '@/components/layout/Brand'
import { TurnstileWidget, type TurnstileWidgetHandle } from '@/components/TurnstileWidget'

export default function CadastroPage() {
  const navigate = useNavigate()
  const { signUp, signupEnabled } = useAuth()
  const turnstileRef = useRef<TurnstileWidgetHandle>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [cfToken, setCfToken] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await signUp(email, password, name, cfToken)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao criar a conta. Tente novamente.')
    } finally {
      // Token do Turnstile é de uso único: descartar e gerar um novo a cada tentativa
      setLoading(false)
      setCfToken('')
      turnstileRef.current?.reset()
    }
  }

  if (!signupEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
        <div className="w-full max-w-sm text-center bg-card border rounded-2xl p-8 shadow-sm">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-primary" />
          </div>
          <Brand variant="icon" height={40} className="mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Em breve</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Os cadastros estão temporariamente fechados para o pré-lançamento.
            <br />
            Se você já tem uma conta, pode entrar normalmente.
          </p>
          <Button onClick={() => navigate('/login')}>Ir para Login</Button>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
        <div className="w-full max-w-sm text-center bg-card border rounded-2xl p-8 shadow-sm">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserPlus size={24} className="text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">Conta criada!</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Verifique seu email para confirmar o cadastro.
          </p>
          <Button onClick={() => navigate('/login')}>Ir para Login</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Brand variant="text" height={32} className="mx-auto" />
          <p className="text-muted-foreground mt-2">Crie sua conta</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl">
              {error}
            </div>
          )}

          <div className="grid gap-2">
            <label className="text-sm font-medium">Nome Completo</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Seu nome"
              required
              className="w-full p-2.5 bg-background border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

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

          <div className="grid gap-2">
            <label className="text-sm font-medium">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
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

          <Button type="submit" disabled={loading} className="gap-2">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            Criar Conta
          </Button>

          <TurnstileWidget ref={turnstileRef} onSuccess={setCfToken} />

          <p className="text-sm text-center text-muted-foreground">
            Já tem conta?{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Faça login
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
