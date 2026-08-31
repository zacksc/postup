import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'

export interface TurnstileWidgetHandle {
  reset: () => void
}

interface TurnstileWidgetProps {
  onSuccess: (token: string) => void
  onError?: (code: string) => void
}

const FALLBACK_KEY = '1x00000000000000000000AA'

function friendlyError(code: string): string {
  if (code === 'timeout' || code === 'expired') {
    return 'A verificação de segurança expirou. Resolva novamente.'
  }
  return `Falha na verificação de segurança (código ${code}). Recarregue a página e tente novamente.`
}

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(function TurnstileWidget(
  { onSuccess, onError },
  ref,
) {
  const turnstileRef = useRef<TurnstileInstance | undefined>(null)
  const [widgetError, setWidgetError] = useState<string | null>(null)
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || FALLBACK_KEY

  useImperativeHandle(ref, () => ({
    reset: () => turnstileRef.current?.reset(),
  }))

  return (
    <div>
      <Turnstile
        ref={turnstileRef}
        siteKey={siteKey}
        onSuccess={token => {
          setWidgetError(null)
          onSuccess(token)
        }}
        onError={error => {
          setWidgetError(error)
          console.error('[Turnstile] erro do widget:', error)
          onError?.(error)
        }}
        onTimeout={() => {
          console.warn('[Turnstile] timeout — resolva novamente')
          onError?.('timeout')
        }}
        onExpire={() => {
          console.warn('[Turnstile] token expirado — resolva novamente')
          onError?.('expired')
        }}
        onUnsupported={() => console.warn('[Turnstile] navegador sem suporte')}
        onWidgetLoad={id => console.log('[Turnstile] widget renderizado:', id)}
        onLoadScript={() => console.log('[Turnstile] script carregado')}
        options={{ theme: 'auto' }}
        style={{ minHeight: 65 }}
      />
      {widgetError !== null && (
        <p className="text-xs text-destructive mt-1">
          {friendlyError(widgetError)}
        </p>
      )}
    </div>
  )
})
