export type AccountType = 'individual' | 'team_owner' | 'team_member'

export interface Profile {
  id: string
  full_name: string
  phone: string
  birthday: string | null
  address: Record<string, string>
  account_type: AccountType
  avatar_url: string
  created_at: string
  updated_at: string
}

export type TeamMemberRole = 'admin' | 'editor' | 'viewer'
export type TeamMemberStatus = 'pending' | 'active' | 'declined'

export interface Team {
  id: string
  name: string
  owner_id: string
  created_at: string
  updated_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role: TeamMemberRole
  invited_by: string | null
  status: TeamMemberStatus
  created_at: string
}

export interface MemberPermission {
  id: string
  member_id: string
  resource_type: 'page' | 'client'
  resource_id: string
  can_view: boolean
  can_edit: boolean
  created_at: string
}

export interface NotificationPreferences {
  user_id: string
  email_notifications: boolean
  push_notifications: boolean
  feedback_alerts: boolean
  post_approvals: boolean
  contract_alerts: boolean
  created_at: string
  updated_at: string
}

export type PlatformType = 'instagram' | 'tiktok'

export interface PlatformAccount {
  id: string
  client_id: string
  platform: PlatformType
  handle: string
  profile_photo: string
  metrics: Record<string, unknown>
  last_synced: string | null
  created_at: string
  updated_at: string
}

export interface UserStats {
  user_id: string
  total_posts: number
  total_feedbacks_given: number
  total_approved: number
  total_adjustments: number
  updated_at: string
}
