/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './use-auth'
import type { Profile, NotificationPreferences, UserStats } from '@/types/app'

interface ProfileContextType {
  profile: Profile | null
  notifPrefs: NotificationPreferences | null
  stats: UserStats | null
  loading: boolean
  updateProfile: (data: Partial<Profile>) => Promise<void>
  updateNotifPrefs: (data: Partial<NotificationPreferences>) => Promise<void>
  refreshStats: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const [profileRes, prefsRes, statsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('notification_preferences').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('user_stats').select('*').eq('user_id', user.id).maybeSingle(),
    ])

    if (profileRes.data) setProfile(profileRes.data as Profile)
    if (prefsRes.data) setNotifPrefs(prefsRes.data as NotificationPreferences)
    if (statsRes.data) setStats(statsRes.data as UserStats)

    // Auto-create notification_prefs if none exists
    if (!prefsRes.data) {
      const { data: newPrefs } = await supabase
        .from('notification_preferences')
        .insert([{ user_id: user.id }])
        .select()
        .maybeSingle()
      if (newPrefs) setNotifPrefs(newPrefs as NotificationPreferences)
    }

    // Refresh stats lazily
    await supabase.rpc('refresh_user_stats', { p_user_id: user.id })
    const { data: freshStats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (freshStats) setStats(freshStats as UserStats)

    setLoading(false)
  }, [user])

  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfile(null)
      setNotifPrefs(null)
      setStats(null)
      setLoading(false)
      return
    }
    loadData()
  }, [user, loadData])

  async function updateProfile(data: Partial<Profile>) {
    if (!user) return
    const { error } = await supabase.from('profiles').update(data).eq('id', user.id)
    if (!error && profile) setProfile({ ...profile, ...data })
  }

  async function updateNotifPrefs(data: Partial<NotificationPreferences>) {
    if (!user) return
    const { error } = await supabase
      .from('notification_preferences')
      .update(data)
      .eq('user_id', user.id)
    if (!error && notifPrefs) setNotifPrefs({ ...notifPrefs, ...data })
  }

  async function refreshStats() {
    if (!user) return
    await supabase.rpc('refresh_user_stats', { p_user_id: user.id })
    const { data } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', user.id)
      .single()
    if (data) setStats(data as UserStats)
  }

  return (
    <ProfileContext.Provider value={{ profile, notifPrefs, stats, loading, updateProfile, updateNotifPrefs, refreshStats }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider')
  return ctx
}
