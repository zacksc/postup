import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { forwardRef, useEffect, useImperativeHandle } from 'react'
import LoginPage from '@/pages/Login/Login'

const { captchaState } = vi.hoisted(() => ({
  captchaState: { autoPass: true, resetCount: 0 },
}))

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    session: null,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPassword: vi.fn(),
    checkEmailExists: vi.fn().mockResolvedValue(true),
    signupEnabled: true,
  })),
}))

vi.mock('@/components/TurnstileWidget', () => ({
  TurnstileWidget: forwardRef(({ onSuccess }: { onSuccess: (token: string) => void; onError?: (code: string) => void }, ref) => {
    useImperativeHandle(ref, () => ({
      reset: () => {
        captchaState.resetCount += 1
      },
    }))
    useEffect(() => {
      if (captchaState.autoPass) onSuccess('test-token')
    })
    return null
  }),
}))

function renderLogin() {
  return render(
    <BrowserRouter>
      <LoginPage />
    </BrowserRouter>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    captchaState.autoPass = true
    captchaState.resetCount = 0
  })

  it('renders the login form', () => {
    renderLogin()
    expect(screen.getByAltText('PostUp')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('seu@email.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })

  it('has a link to sign up', () => {
    renderLogin()
    const link = screen.getByText('Cadastre-se')
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', '/cadastro')
  })

  it('has a link to forgot password', () => {
    renderLogin()
    const link = screen.getByText('Esqueceu a senha?')
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', '/esqueci-senha')
  })

  it('toggles password visibility', async () => {
    const user = userEvent.setup()
    renderLogin()
    const passwordInput = screen.getByPlaceholderText('••••••••')
    expect(passwordInput).toHaveAttribute('type', 'password')

    const toggleButton = screen.getAllByRole('button')[0]
    await user.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'text')
  })

  it('keeps the submit button disabled until the captcha resolves', async () => {
    captchaState.autoPass = false
    const user = userEvent.setup()
    renderLogin()

    const submit = screen.getByRole('button', { name: /entrar/i })
    expect(submit).toBeDisabled()

    await user.type(screen.getByPlaceholderText('seu@email.com'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'senha123')
    expect(submit).toBeDisabled()
    expect(screen.getByText(/Resolva a verificação de segurança acima para liberar/)).toBeInTheDocument()
  })

  it('enables the submit button once a captcha token is available', async () => {
    const user = userEvent.setup()
    renderLogin()

    const submit = screen.getByRole('button', { name: /entrar/i })
    await user.type(screen.getByPlaceholderText('seu@email.com'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'senha123')
    expect(submit).toBeEnabled()
  })

  it('shows password error when email exists', async () => {
    const { useAuth } = await import('@/hooks/use-auth')
    const mockSignIn = vi.fn().mockResolvedValue({ error: 'Invalid login credentials' })
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      isRecoverySession: false,
      signIn: mockSignIn,
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
      updatePassword: vi.fn(),
      checkEmailExists: vi.fn().mockResolvedValue(true),
      signupEnabled: true,
    })

    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByPlaceholderText('seu@email.com'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrong')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByText('A senha está incorreta. Tente novamente.')).toBeInTheDocument()
  })

  it('shows email-not-registered error when email does not exist', async () => {
    const { useAuth } = await import('@/hooks/use-auth')
    const mockSignIn = vi.fn().mockResolvedValue({ error: 'Invalid login credentials' })
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      isRecoverySession: false,
      signIn: mockSignIn,
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
      updatePassword: vi.fn(),
      checkEmailExists: vi.fn().mockResolvedValue(false),
      signupEnabled: true,
    })

    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByPlaceholderText('seu@email.com'), 'naoexiste@test.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrong')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByText('Este email ou nome de utilizador ainda não está registado.')).toBeInTheDocument()
  })

  it('shows the captcha error instead of masking it as a wrong password', async () => {
    const { useAuth } = await import('@/hooks/use-auth')
    const mockCheckEmailExists = vi.fn().mockResolvedValue(true)
    const mockSignIn = vi.fn().mockResolvedValue({
      error: 'Verificação de segurança expirada. Resolva o captcha novamente.',
      code: 'turnstile_failed',
    })
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      isRecoverySession: false,
      signIn: mockSignIn,
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
      updatePassword: vi.fn(),
      checkEmailExists: mockCheckEmailExists,
      signupEnabled: true,
    })

    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByPlaceholderText('seu@email.com'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'correta')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByText('Verificação de segurança expirada. Resolva o captcha novamente.')).toBeInTheDocument()
    expect(screen.queryByText('A senha está incorreta. Tente novamente.')).not.toBeInTheDocument()
    expect(mockCheckEmailExists).not.toHaveBeenCalled()
  })

  it('resets the captcha widget after a failed attempt and re-enables the submit button', async () => {
    const { useAuth } = await import('@/hooks/use-auth')
    const mockSignIn = vi.fn().mockResolvedValue({ error: 'Invalid login credentials' })
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      isRecoverySession: false,
      signIn: mockSignIn,
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
      updatePassword: vi.fn(),
      checkEmailExists: vi.fn().mockResolvedValue(true),
      signupEnabled: true,
    })

    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByPlaceholderText('seu@email.com'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrong')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByText('A senha está incorreta. Tente novamente.')).toBeInTheDocument()
    expect(captchaState.resetCount).toBe(1)
    expect(await screen.findByRole('button', { name: /entrar/i })).toBeEnabled()
  })

  it('offers password reset after 3 failed attempts', async () => {
    const { useAuth } = await import('@/hooks/use-auth')
    const mockSignIn = vi.fn().mockResolvedValue({ error: 'Invalid login credentials' })
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      isRecoverySession: false,
      signIn: mockSignIn,
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
      updatePassword: vi.fn(),
      checkEmailExists: vi.fn().mockResolvedValue(true),
      signupEnabled: true,
    })

    const user = userEvent.setup()
    renderLogin()

    const emailInput = screen.getByPlaceholderText('seu@email.com')
    const passInput = screen.getByPlaceholderText('••••••••')
    const submit = screen.getByRole('button', { name: /entrar/i })

    for (let i = 0; i < 3; i++) {
      await user.clear(emailInput)
      await user.type(emailInput, 'test@test.com')
      await user.clear(passInput)
      await user.type(passInput, 'wrong')
      await user.click(submit)
    }

    expect(await screen.findByText(/Foram feitas 3 tentativas/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Enviar link de redefinição/i })).toBeInTheDocument()
  })
})
