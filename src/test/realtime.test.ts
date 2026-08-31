import { describe, it, expect, vi, beforeEach } from 'vitest'
import { subscribeRealtime } from '@/lib/realtime'
import type { RealtimeChannel } from '@supabase/supabase-js'

const subscribeMock = vi.fn()
const fakeChannel = { subscribe: subscribeMock } as unknown as RealtimeChannel

describe('subscribeRealtime', () => {
  beforeEach(() => {
    subscribeMock.mockClear()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('subscribes and returns the channel when WebSocket is available', () => {
    const channel = subscribeRealtime(() => fakeChannel)
    expect(channel).toBe(fakeChannel)
    expect(subscribeMock).toHaveBeenCalledTimes(1)
  })

  it('returns null instead of throwing when WebSocket is unavailable', () => {
    const channel = subscribeRealtime(() => {
      throw new Error('WebSocket not available: The Operation is insecure')
    })
    expect(channel).toBeNull()
    expect(subscribeMock).not.toHaveBeenCalled()
  })
})
