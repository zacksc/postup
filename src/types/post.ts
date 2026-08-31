import type { PostStatus, PostType } from '@/components/ui/status-badge'
import type { Tag } from '@/types/feedback'

// Post — representa um post vindo do banco de dados
export interface Post {
  id: string
  clientId: string
  clientName: string
  clientColor: string
  clientHandle: string
  type: PostType
  status: PostStatus
  caption: string
  scheduledAt: Date
  files: PostFile[]
  feedbackCount?: number
  version?: number
  platform?: 'instagram' | 'tiktok' | 'both'
  isFeedback?: boolean
  tags?: Tag[]
  profilePhoto?: string
}

export interface PostVersionData {
  post_type: string
  caption: string
  media_urls: string[]
  original_urls?: string[]
  scheduled_at: string
  status: string
}

export interface PostVersion {
  id: string
  post_id: string
  version_number: number
  name: string
  data: PostVersionData
  created_at: string
}

// PostFile — um arquivo de mídia anexado ao post
export interface PostFile {
  id: string
  url: string
  originalUrl?: string
  originalThumbnailUrl?: string
  thumbnailUrl?: string
  order: number
  mediaType: 'image' | 'video'
}