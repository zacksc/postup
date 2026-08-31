/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'

const RECOVERY_KEY = 'postup_recovery'
const SIGNUP_ENABLED = false // false = pré-lançamento: cadastros bloqueados

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isRecoverySession: boolean
  signIn: (email: string, password: string, cfToken?: string) => Promise<{ error?: string; code?: string }>
  signUp: (email: string, password: string, name: string, cfToken?: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error?: string }>
  updatePassword: (password: string) => Promise<{ error?: string }>
  checkEmailExists: (email: string) => Promise<boolean>
  signupEnabled: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRecoverySession, setIsRecoverySession] = useState(() => sessionStorage.getItem(RECOVERY_KEY) === '1')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
      setSession(session)
      setUser(session?.user ?? null)

      if (event === 'PASSWORD_RECOVERY') {
        sessionStorage.setItem(RECOVERY_KEY, '1')
        setIsRecoverySession(true)
      } else if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        sessionStorage.removeItem(RECOVERY_KEY)
        setIsRecoverySession(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function verifyTurnstile(token: string): Promise<{ error?: string; code?: string }> {
    const { data, error } = await supabase.functions.invoke('verify-turnstile', {
      body: { token },
    })
    if (error) return { error: 'Falha na verificação de segurança. Tente novamente.', code: 'turnstile_failed' }
    if (!data?.success) {
      const reason: string = data?.error || ''
      if (reason.includes('timeout-or-duplicate')) {
        return { error: 'Verificação de segurança expirada. Resolva o captcha novamente.', code: 'turnstile_failed' }
      }
      if (reason.includes('invalid-input-response')) {
        return { error: 'Captcha inválido. Resolva o captcha novamente.', code: 'turnstile_failed' }
      }
      return { error: 'Falha na verificação de segurança. Tente novamente.', code: 'turnstile_failed' }
    }
    return {}
  }

  async function signIn(email: string, password: string, cfToken?: string) {
    if (cfToken) {
      const verify = await verifyTurnstile(cfToken)
      if (verify.error) return verify
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message, code: error.code }
    return {}
  }

  async function signUp(email: string, password: string, name: string, cfToken?: string) {
    if (!SIGNUP_ENABLED) {
      return { error: 'Cadastros estão temporariamente fechados para pré-lançamento.' }
    }
    if (cfToken) {
      const verify = await verifyTurnstile(cfToken)
      if (verify.error) return verify
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })
    if (error) return { error: error.message }
    return {}
  }

  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/redefinir-senha',
    })
    if (error) return { error: error.message }
    return {}
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { error: error.message }
    sessionStorage.removeItem(RECOVERY_KEY)
    setIsRecoverySession(false)
    return {}
  }

  async function checkEmailExists(email: string) {
    const { data } = await supabase.rpc('check_email_exists', { p_email: email })
    return data ?? false
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, isRecoverySession, signIn, signUp, signOut, resetPassword, updatePassword, checkEmailExists, signupEnabled: SIGNUP_ENABLED }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
