import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltam as variáveis de ambiente do Supabase. Verifique o ficheiro .env.local')
}

class NoopWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  readyState = NoopWebSocket.CLOSED
  binaryType = ''
  timeout = 0
  onopen: ((event?: unknown) => void) | null = null
  onerror: ((event?: unknown) => void) | null = null
  onmessage: ((event?: unknown) => void) | null = null
  onclose: ((event?: unknown) => void) | null = null
  readonly url: string
  readonly protocols: string | string[] | undefined

  constructor(url: string, protocols?: string | string[]) {
    this.url = url
    this.protocols = protocols
  }

  send(): void {}
  close(): void {}
}

const realtimeTransport =
  typeof WebSocket !== 'undefined' ? WebSocket : (NoopWebSocket as unknown as typeof WebSocket)

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { transport: realtimeTransport },
})