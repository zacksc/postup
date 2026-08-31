import { describe, it, expect, vi } from 'vitest'

describe('supabase client sem WebSocket', () => {
  it('createClient não lança quando o navegador não tem WebSocket (transport de fallback)', async () => {
    const originalWebSocket = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket')
    try {
      Object.defineProperty(globalThis, 'WebSocket', { value: undefined, configurable: true })
      vi.resetModules()
      const mod = await import('@/lib/supabase')
      expect(mod.supabase).toBeDefined()
      expect(typeof mod.supabase.from).toBe('function')
    } finally {
      if (originalWebSocket) {
        Object.defineProperty(globalThis, 'WebSocket', originalWebSocket)
      } else {
        delete (globalThis as { WebSocket?: unknown }).WebSocket
      }
    }
  })
})
