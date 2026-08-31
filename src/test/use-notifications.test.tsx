import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useNotifications } from '@/hooks/use-notifications'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => {
      throw new Error('WebSocket not available: The Operation is insecure')
    }),
    removeChannel: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({ order: vi.fn(() => ({ limit: vi.fn(() => ({ data: [], error: null })) })) })),
    })),
  },
}))

function Harness() {
  const { notifications, loading } = useNotifications()
  return <div data-testid="count">{loading ? 'carregando' : notifications.length}</div>
}

describe('useNotifications com WebSocket indisponível', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('não lança erro quando o supabase.channel() lança (navegador sem WebSocket)', async () => {
    render(<Harness />)
    expect(screen.getByTestId('count')).toBeTruthy()
  })
})
