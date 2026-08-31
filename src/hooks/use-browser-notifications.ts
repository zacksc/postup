import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { subscribeRealtime } from '@/lib/realtime'
import type { PostFeedback } from '@/types/feedback'

const LS_KEY = 'postup-browser-notifications'

export function useBrowserNotifications() {
  const [enabled, setEnabledState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || 'false') } catch { return false }
  })
  const channelRef = useRef<ReturnType<typeof supabase.channel>>(null)

  const setEnabled = useCallback(async (val: boolean) => {
    if (val && !('Notification' in window)) return
    if (val && Notification.permission === 'default') {
      const granted = await Notification.requestPermission()
      if (!granted) return
    }
    localStorage.setItem(LS_KEY, JSON.stringify(val))
    setEnabledState(val)
  }, [])

  useEffect(() => {
    if (!enabled) return
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    const channel = subscribeRealtime(() =>
      supabase
        .channel('browser-notifications')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'post_feedbacks' },
          (payload) => {
            const fb = payload.new as unknown as PostFeedback
            if (fb.author_role === 'cliente' && fb.type === 'message') {
              const title = 'Novo feedback de cliente'
              const body = `${fb.author_name}: ${fb.message.slice(0, 120)}`
              try {
                new Notification(title, { body, icon: '/vite.svg' })
              } catch {
                // fallback: some mobile browsers require service worker
              }
            }
          }
        )
        .subscribe()
    )

    if (!channel) return
    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [enabled])

  return { enabled, setEnabled }
}
