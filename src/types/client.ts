export interface Client {
  id: string
  created_at: string
  name: string
  handle: string
  responsible_user?: string | null
  metrics: Record<string, unknown>
  contacts: { name?: string; role?: string; email?: string; phone?: string }[]
  branding: {
    fonts: string[]
    logos: string[]
    palette: string[]
  }
  links: {
    canva: string
    drive: string
    linktree: string
    meetings: { title?: string; url?: string }[]
  }
  brand_tone?: string | null
  contracts: Record<string, unknown>[]
  bio?: string
  followers?: number
  following?: number
  profile_photo?: string
  review_token?: string
  archived_at?: string | null
  platform?: string
  team_id?: string | null
}

export interface ClientMonthlyMetrics {
  id: string
  client_id: string
  user_id: string
  month: string
  followers?: number
  following?: number
  new_followers?: number
  reach?: number
  impressions?: number
  profile_visits?: number
  engagement_rate?: number
  comments?: number
  saves?: number
  shares?: number
  notes?: string
  goals_next?: string
  created_at: string
  updated_at: string
}
