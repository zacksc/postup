import type { RealtimeChannel } from '@supabase/supabase-js'

export function subscribeRealtime(build: () => RealtimeChannel): RealtimeChannel | null {
  try {
    const channel = build()
    channel.subscribe()
    return channel
  } catch (err) {
    console.warn('[realtime] indisponível neste navegador; sem atualizações ao vivo.', err)
    return null
  }
}
