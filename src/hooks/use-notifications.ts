import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { subscribeRealtime } from '@/lib/realtime'
import type { Notification, NotificationType } from '@/types/notifications'

const LS_KEY = 'postup-notifications-read'
const LS_UNTIL = 'postup-notifications-read-until'
const LS_CLEARED = 'postup-notifications-cleared-at'
const CHAT_READ_KEY = 'postup:chat:last-read'

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function loadReadUntil(): number {
  try {
    const raw = localStorage.getItem(LS_UNTIL)
    return raw ? new Date(raw).getTime() : 0
  } catch {
    return 0
  }
}

function loadClearedAt(): number {
  try {
    const raw = localStorage.getItem(LS_CLEARED)
    return raw ? new Date(raw).getTime() : 0
  } catch {
    return 0
  }
}

function loadChatLastRead(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CHAT_READ_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveReadId(id: string) {
  try {
    const ids = loadReadIds()
    ids.add(id)
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]))
  } catch { /* ignore */ }
}

function saveReadUntil() {
  try {
    localStorage.setItem(LS_UNTIL, new Date().toISOString())
  } catch { /* ignore */ }
}

function saveClearedAt() {
  try {
    localStorage.setItem(LS_CLEARED, new Date().toISOString())
  } catch { /* ignore */ }
}

interface FeedbackRow {
  id: string
  message: string
  created_at: string
  type: string
  author_role: string
  author_name: string
  post_id: string
  posts?: { client_name: string | null } | { client_name: string | null }[] | null
}

function parseLog(message: string): { type: NotificationType; title: string; priority: 'low' | 'medium' | 'high' } {
  const m = message || ''
  if (/solicitou altera/i.test(m)) return { type: 'alteracao', title: 'Alteração solicitada', priority: 'high' }
  if (/aprovou/i.test(m)) return { type: 'aprovado', title: 'Post aprovado', priority: 'medium' }
  if (/publicad/i.test(m)) return { type: 'publicado', title: 'Post publicado', priority: 'medium' }
  if (/criou publi|criou o post|publicação criada|criação/i.test(m)) return { type: 'versao', title: 'Publicação criada', priority: 'low' }
  if (/criou/i.test(m)) return { type: 'versao', title: 'Nova versão criada', priority: 'low' }
  return { type: 'alerta', title: 'Atividade', priority: 'medium' }
}

let channelCounter = 0

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const fetchNotifications = useCallback(async () => {
    try {
      const readIds = loadReadIds()
      const readUntil = loadReadUntil()
      const clearedAt = loadClearedAt()
      const chatLastRead = loadChatLastRead()
      const results: Notification[] = []

      const { data: feedbacks } = await supabase
        .from('post_feedbacks')
        .select('id, message, created_at, type, author_role, author_name, post_id, posts(client_name)')
        .order('created_at', { ascending: false })
        .limit(50)

      if (feedbacks) {
        for (const fb of (feedbacks as FeedbackRow[])) {
          const ts = new Date(fb.created_at)
          if (Number.isNaN(ts.getTime())) continue
          // "Limpar tudo" esconde as notificações anteriores ao clique (persistido).
          if (ts.getTime() <= clearedAt) continue
          const id = `fb-${fb.id}`
          const post = Array.isArray(fb.posts) ? fb.posts[0] : fb.posts
          const clientName = post?.client_name || fb.author_name || 'Cliente'

          let type: NotificationType
          let title: string
          let priority: 'low' | 'medium' | 'high'
          let message: string
          let actionUrl: string

          if (fb.type === 'log') {
            const parsed = parseLog(fb.message)
            type = parsed.type
            title = parsed.title
            priority = parsed.priority
            message = `${clientName} — ${(fb.message || '').slice(0, 80)}`
            actionUrl = `/posts/${fb.post_id}`
          } else if (fb.type === 'message' && fb.author_role === 'cliente') {
            type = 'message'
            title = 'Nova mensagem'
            priority = 'high'
            const text = (fb.message || '').slice(0, 60)
            message = `${clientName}: "${text}${fb.message && fb.message.length > 60 ? '...' : ''}"`
            actionUrl = `/chat?client=${fb.post_id}`
          } else {
            continue
          }

          const chatRead = chatLastRead[clientName]
          const chatReadForMsg = chatRead ? ts.getTime() <= new Date(chatRead).getTime() : false
          const isRead = readIds.has(id) || ts.getTime() <= readUntil || chatReadForMsg

          results.push({ id, type, title, message, timestamp: ts, isRead, priority, actionUrl })
        }
      }

      if (mountedRef.current) {
        setNotifications(results.slice(0, 25))
      }
    } catch {
      console.warn('Erro ao buscar notificações')
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    mountedRef.current = true
    channelCounter++
    const channelName = `notifications-${channelCounter}`

    fetchNotifications()

    const channel = subscribeRealtime(() =>
      supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'post_feedbacks' }, () => {
          fetchNotifications()
        })
        .subscribe()
    )

    // Quando o usuário lê uma conversa no Chat, as notificações de mensagem
    // correspondentes deixam de contar como não-lidas.
    const onChatRead = () => fetchNotifications()
    window.addEventListener('postup:chat-read', onChatRead)

    return () => {
      mountedRef.current = false
      if (channel) supabase.removeChannel(channel)
      window.removeEventListener('postup:chat-read', onChatRead)
    }
  }, [fetchNotifications])

  function markAsRead(id: string) {
    saveReadId(id)
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
    )
  }

  /**
   * Marca todas as notificações como lidas (zerando o contador do sino).
   * As atividades continuam no dropdown, apenas como lidas.
   */
  function markAllAsRead() {
    saveReadUntil()
    try {
      const merged = new Set([...loadReadIds(), ...notifications.map(n => n.id)])
      localStorage.setItem(LS_KEY, JSON.stringify([...merged]))
    } catch { /* ignore */ }
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  /**
   * Limpa de verdade: esconde do dropdown todas as notificações existentes.
   * Persiste `clearedAt` para que não voltem no próximo fetch — só aparecem
   * novamente as atividades novas (posteriores ao clique).
   */
  function clearAll() {
    saveClearedAt()
    saveReadUntil()
    setNotifications([])
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    refresh: fetchNotifications,
  }
}
