import { useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'

export interface UnsavedGuard {
  /** true quando uma navegação foi bloqueada e o diálogo deve aparecer */
  blocked: boolean
  /** continua a navegação pendente (sair mesmo assim) */
  proceed: () => void
  /** cancela a navegação pendente (continuar editando) */
  reset: () => void
  /** desliga/religa o bloqueio — útil para liberar o navigate() interno do salvar */
  setEnabled: (enabled: boolean) => void
}

/**
 * Bloqueia navegação interna (useBlocker) e saída da página/refresh
 * (beforeunload) enquanto `when` for true.
 */
export function useUnsavedGuard(when: boolean): UnsavedGuard {
  const enabledRef = useRef(when)

  useEffect(() => {
    enabledRef.current = when
  }, [when])

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!enabledRef.current) return false
    if (currentLocation.pathname !== nextLocation.pathname) return true
    return currentLocation.search !== nextLocation.search
  })

  useEffect(() => {
    if (!when) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [when])

  return {
    blocked: blocker.state === 'blocked',
    proceed: () => blocker.proceed?.(),
    reset: () => blocker.reset?.(),
    setEnabled: (enabled: boolean) => {
      enabledRef.current = enabled
    },
  }
}
