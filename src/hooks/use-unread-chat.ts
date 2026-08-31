import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { subscribeRealtime } from '@/lib/realtime'

/**
 * Não-lidas do Chat (D23). A "leitura" é por cliente: quando o gestor abre o
 * chat de um cliente, gravamos o timestamp em localStorage; mensagens do cliente
 * (author_role = 'cliente', type = 'message') posteriores contam como não-lidas.
 * Expõe o total global (para o badge do menu) e por cliente (para a lista).
 */
const STORAGE_KEY = 'postup:chat:last-read'

interface UnreadMessage {
  id: string
  post_id: string
  client_name: string
  created_at: string
}

interface RawRow {
  id: string
  post_id: string
  created_at: string
  posts: { client_name: string | null }[] | { client_name: string | null } | null
}

function loadLastRead(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

// Nome de canal ÚNICO por instância: `useUnreadChat()` é montado em vários
// lugares (Sidebar, BottomNav, Chat) e o supabase-js reutiliza canais com o
// mesmo nome — o segundo `.on('postgres_changes')` num canal já subscrito
// lança "cannot add postgres_changes callbacks ... after subscribe()".
let unreadChannelSeq = 0

export function useUnreadChat() {
  const [unreadByClient, setUnreadByClient] = useState<Record<string, number>>({})
  const [totalUnread, setTotalUnread] = useState(0)
  const lastReadRef = useRef<Record<string, string>>(loadLastRead())
  const channelNameRef = useRef<string>(`chat-unread-${++unreadChannelSeq}`)

  const saveLastRead = useCallback((map: Record<string, string>) => {
    lastReadRef.current = map
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    } catch { /* ignore */ }
  }, [])

  const computeUnread = useCallback((rows: UnreadMessage[]) => {
    const byClient: Record<string, number> = {}
    for (const m of rows) {
      const last = lastReadRef.current[m.client_name]
      if (!last || new Date(m.created_at) > new Date(last)) {
        byClient[m.client_name] = (byClient[m.client_name] || 0) + 1
      }
    }
    setUnreadByClient(byClient)
    setTotalUnread(Object.values(byClient).reduce((a, b) => a + b, 0))
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data } = await supabase
        .from('post_feedbacks')
        .select('id, post_id, created_at, posts(client_name)')
        .eq('type', 'message')
        .eq('author_role', 'cliente')
        .order('created_at', { ascending: false })
        .limit(200)
      if (cancelled || !data) return
      const rows: UnreadMessage[] = (data as unknown as RawRow[]).map(r => {
        const post = Array.isArray(r.posts) ? r.posts[0] : r.posts
        return {
          id: r.id,
          post_id: r.post_id,
          client_name: post?.client_name || 'Cliente',
          created_at: r.created_at,
        }
      })
      computeUnread(rows)
    }

    load()
    const channel = subscribeRealtime(() =>
      supabase
        .channel(channelNameRef.current)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'post_feedbacks' }, () => load()),
    )
    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [computeUnread])

  /** Marca o chat de um cliente como lido agora. */
  const markClientRead = useCallback((clientName: string) => {
    const map = { ...lastReadRef.current, [clientName]: new Date().toISOString() }
    saveLastRead(map)
    setUnreadByClient(prev => {
      const next = { ...prev }
      delete next[clientName]
      return next
    })
    setTotalUnread(prev => Math.max(0, prev - (unreadByClient[clientName] || 0)))
    // Avisa as notificações para também marcar as mensagens desse cliente como lidas.
    window.dispatchEvent(new CustomEvent('postup:chat-read'))
  }, [saveLastRead, unreadByClient])

  return { totalUnread, unreadByClient, markClientRead }
}
