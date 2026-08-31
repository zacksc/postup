/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './use-auth'
import type { Team, TeamMember, MemberPermission, TeamMemberRole } from '@/types/app'

interface TeamContextType {
  teams: Team[]
  currentTeam: Team | null
  members: TeamMember[]
  permissions: MemberPermission[]
  loading: boolean
  setCurrentTeam: (team: Team | null) => void
  createTeam: (name: string) => Promise<Team | null>
  inviteMember: (email: string, role: TeamMemberRole) => Promise<{ error?: string }>
  updateMemberRole: (memberId: string, role: TeamMemberRole) => Promise<void>
  removeMember: (memberId: string) => Promise<void>
  setPermission: (memberId: string, resourceType: 'page' | 'client', resourceId: string, canView: boolean, canEdit: boolean) => Promise<void>
  getMembersForClient: (clientId: string) => Promise<TeamMember[]>
}

const TeamContext = createContext<TeamContextType | undefined>(undefined)

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [teams, setTeams] = useState<Team[]>([])
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [permissions, setPermissions] = useState<MemberPermission[]>([])
  const [loading, setLoading] = useState(true)

  const loadTeams = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const { data: ownedTeams } = await supabase
      .from('teams')
      .select('*')
      .eq('owner_id', user.id)

    const { data: memberTeams } = await supabase
      .from('teams')
      .select('*, team_members!inner(*)')
      .eq('team_members.user_id', user.id)
      .eq('team_members.status', 'active')

    const allTeams = [...(ownedTeams || []), ...(memberTeams || [])]
    const unique = allTeams.filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i)
    setTeams(unique as Team[])

    if (unique.length > 0 && !currentTeam) {
      setCurrentTeam(unique[0] as Team)
    }
    setLoading(false)
  }, [user, currentTeam])

  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTeams([])
      setCurrentTeam(null)
      setMembers([])
      setPermissions([])
      setLoading(false)
      return
    }
    loadTeams()
  }, [user, loadTeams])

  const loadMembers = useCallback(async (teamId: string) => {
    const [membersRes, permsRes] = await Promise.all([
      supabase.from('team_members').select('*').eq('team_id', teamId),
      supabase.from('member_permissions').select('*, team_members!inner(*)').eq('team_members.team_id', teamId),
    ])
    if (membersRes.data) setMembers(membersRes.data as TeamMember[])
    if (permsRes.data) setPermissions(permsRes.data as MemberPermission[])
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (currentTeam) loadMembers(currentTeam.id)
  }, [currentTeam, loadMembers])

  async function createTeam(name: string) {
    if (!user) return null
    const { data, error } = await supabase
      .from('teams')
      .insert([{ name, owner_id: user.id }])
      .select()
      .single()

    if (!error && data) {
      // Add owner as admin member
      await supabase.from('team_members').insert([{
        team_id: data.id,
        user_id: user.id,
        role: 'admin',
        status: 'active',
      }])
      await loadTeams()
      setCurrentTeam(data as Team)
      return data as Team
    }
    return null
  }

  async function inviteMember(email: string, role: TeamMemberRole) {
    if (!currentTeam || !user) return { error: 'No team selected' }
    // Look up user by email via RPC (requires admin API for direct lookup)
    const { error } = await supabase.rpc('invite_team_member', {
      p_team_id: currentTeam.id,
      p_email: email,
      p_role: role,
      p_invited_by: user.id,
    })

    if (error) return { error: error.message }
    await loadMembers(currentTeam.id)
    return {}
  }

  async function updateMemberRole(memberId: string, role: TeamMemberRole) {
    if (!currentTeam) return
    await supabase.from('team_members').update({ role }).eq('id', memberId)
    await loadMembers(currentTeam.id)
  }

  async function removeMember(memberId: string) {
    if (!currentTeam) return
    await supabase.from('team_members').delete().eq('id', memberId)
    await loadMembers(currentTeam.id)
  }

  async function setPermission(memberId: string, resourceType: 'page' | 'client', resourceId: string, canView: boolean, canEdit: boolean) {
    await supabase.from('member_permissions').upsert({
      member_id: memberId,
      resource_type: resourceType,
      resource_id: resourceId,
      can_view: canView,
      can_edit: canEdit,
    }, { onConflict: 'member_id,resource_type,resource_id' })
    if (currentTeam) await loadMembers(currentTeam.id)
  }

  async function getMembersForClient(clientId: string) {
    if (!currentTeam) return []
    const { data } = await supabase
      .from('member_permissions')
      .select('team_members!inner(*)')
      .eq('resource_type', 'client')
      .eq('resource_id', clientId)
      .eq('team_members.team_id', currentTeam.id)
    if (data) {
      return (data as unknown as { team_members: TeamMember }[]).map(r => r.team_members)
    }
    return []
  }

  return (
    <TeamContext.Provider value={{
      teams, currentTeam, members, permissions, loading,
      setCurrentTeam, createTeam, inviteMember,
      updateMemberRole, removeMember, setPermission, getMembersForClient,
    }}>
      {children}
    </TeamContext.Provider>
  )
}

export function useTeams() {
  const ctx = useContext(TeamContext)
  if (!ctx) throw new Error('useTeams must be used within TeamProvider')
  return ctx
}
