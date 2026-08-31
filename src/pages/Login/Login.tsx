import { useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, LogIn, KeyRound, Mail, AlertTriangle } from 'lucide-react'
import { AnimatedButton } from '@/components/ui/animated-button'
import { useAuth } from '@/hooks/use-auth'
import { Brand } from '@/components/layout/Brand'
import { TurnstileWidget, type TurnstileWidgetHandle } from '@/components/TurnstileWidget'

const MAX_ATTEMPTS = 3

export default function LoginPage() {
  const navigate = useNavigate()
  const { signIn, resetPassword, checkEmailExists, signupEnabled } = useAuth()
  const turnstileRef = useRef<TurnstileWidgetHandle>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cfToken, setCfToken] = useState('')
  const [turnstileError, setTurnstileError] = useState('')
  const [attempts, setAttempts] = useState(0)

  const [resetEmail, setResetEmail] = useState('')
  const [resetSending, setResetSending] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await signIn(email, password, cfToken)
      if (!result.error) {
        navigate('/home')
        return
      }
      if (result.code === 'email_not_confirmed') {
        setError('Seu email ainda não foi confirmado. Verifique sua caixa de entrada (e o spam) para confirmar antes de entrar.')
      } else if (result.code === 'turnstile_failed') {
        setError(result.error ?? 'Não foi possível concluir a verificação de segurança. Tente novamente.')
      } else {
        const exists = await checkEmailExists(email)
        setError(exists ? 'A senha está incorreta. Tente novamente.' : 'Este email ou nome de utilizador ainda não está registado.')
      }
      setAttempts(prev => prev + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao entrar. Tente novamente.')
    } finally {
      // Token do Turnstile é de uso único: descartar e gerar um novo a cada tentativa
      setLoading(false)
      setCfToken('')
      turnstileRef.current?.reset()
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setResetError('')
    setResetSending(true)
    const result = await resetPassword(resetEmail)
    setResetSending(false)
    if (result.error) {
      setResetError(result.error)
    } else {
      setResetSent(true)
    }
  }

  const showResetOffer = attempts >= MAX_ATTEMPTS

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-2">
          <Brand variant="text" height={420} className="mx-auto" />
        </div>

        <form onSubmit={handleSubmit} className="-translate-y-32 bg-card border rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
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

          <div className="grid gap-2">
            <label className="text-sm font-medium">Senha</label>
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

          <AnimatedButton type="submit" loading={loading} disabled={!cfToken} className="gap-2 w-full">
            {!loading && <LogIn size={16} />}
            Entrar
          </AnimatedButton>

          {!cfToken && !loading && !turnstileError && (
            <p className="text-xs text-muted-foreground -mt-1 text-center">
              Resolva a verificação de segurança acima para liberar o botão de entrar.
            </p>
          )}

          {turnstileError && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              {turnstileError}
            </div>
          )}

          <TurnstileWidget
            ref={turnstileRef}
            onSuccess={setCfToken}
            onError={() => {
              setCfToken('')
              setTurnstileError(
                'Não foi possível concluir a verificação de segurança. Desative VPN/antivírus que bloqueiem o desafio, tente em uma aba anônima e recarregue a página.',
              )
            }}
          />

          {showResetOffer ? (
            <div className="border-t pt-4 flex flex-col gap-3">
              {resetSent ? (
                <div className="bg-primary/10 text-primary text-sm p-3 rounded-xl flex items-start gap-2">
                  <Mail size={16} className="shrink-0 mt-0.5" />
                  <span>
                    Enviamos um link de redefinição para <strong>{resetEmail}</strong>. Verifique sua caixa de entrada (e o spam) e siga o link para criar uma nova senha.
                  </span>
                </div>
              ) : (
                <>
                  <div className="text-sm text-muted-foreground flex items-start gap-2">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>
                      Foram feitas {attempts} tentativas. Se esqueceu a senha, informe seu email abaixo e enviaremos um link para redefini-la.
                    </span>
                  </div>

                  {resetError && (
                    <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl">
                      {resetError}
                    </div>
                  )}

                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Email para redefinição</label>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      placeholder={email || 'seu@email.com'}
                      required
                      className="w-full p-2.5 bg-background border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <AnimatedButton type="button" variant="outline" onClick={handleReset} loading={resetSending} className="gap-2">
                    {!resetSending && <KeyRound size={16} />}
                    Enviar link de redefinição
                  </AnimatedButton>
                </>
              )}
            </div>
          ) : (
            <Link to="/esqueci-senha" className="text-sm text-center text-muted-foreground hover:text-foreground">
              Esqueceu a senha? <span className="text-primary font-medium hover:underline">Redefina aqui</span>
            </Link>
          )}

          <p className="text-sm text-center text-muted-foreground">
            {signupEnabled ? (
              <>
                Não tem conta?{' '}
                <Link to="/cadastro" className="text-primary font-medium hover:underline">
                  Cadastre-se
                </Link>
              </>
            ) : (
              <span className="text-muted-foreground">Cadastros fechados para pré-lançamento.</span>
            )}
          </p>
        </form>
      </div>
    </div>
  )
}
