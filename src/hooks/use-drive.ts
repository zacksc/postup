import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './use-auth'

interface DriveQuota {
  limit: number
  used: number
  percent: number
}

interface DriveConnection {
  connected: boolean
  email?: string | null
  driveName?: string | null
  quota?: DriveQuota | null
  loading: boolean
}

export function useDrive(): DriveConnection & {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  refresh: () => Promise<void>
} {
  const { user } = useAuth()
  const [connected, setConnected] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [driveName, setDriveName] = useState<string | null>(null)
  const [quota, setQuota] = useState<DriveQuota | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) {
      setConnected(false)
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke<DriveConnection>('drive-status')
      if (error || !data?.connected) {
        setConnected(false)
        setEmail(null)
        setDriveName(null)
        setQuota(null)
        return
      }
      setConnected(true)
      setEmail(data.email ?? null)
      setDriveName(data.driveName ?? null)
      setQuota(data.quota ?? null)
    } finally {
      setLoading(false)
    }
  }, [user])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    refresh()
  }, [refresh])

  const connect = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('drive-oauth?action=start', {
      body: { callbackOrigin: window.location.origin },
    })
    if (error || !data?.url) {
      throw new Error('Não foi possível iniciar a conexão com o Google Drive')
    }
    // Redireciona para o consentimento do Google; depois volta para /drive/callback
    window.location.href = data.url as string
  }, [])

  const disconnect = useCallback(async () => {
    if (!user) return
    // Não desautoriza o app no Google (não temos token do app), apenas remove a conexão
    await supabase.rpc('delete_drive_connection', { p_user: user.id })
    setConnected(false)
    setEmail(null)
    setDriveName(null)
    setQuota(null)
  }, [user])

  return { connected, email, driveName, quota, loading, connect, disconnect, refresh }
}