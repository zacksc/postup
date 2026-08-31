export type NotificationType = 'message' | 'alteracao' | 'aprovado' | 'publicado' | 'versao' | 'alerta'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: Date
  isRead: boolean
  priority: 'low' | 'medium' | 'high'
  actionUrl?: string
}
