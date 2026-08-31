import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { User, Settings, LogOut, Camera, Loader2, Pencil, Check, BarChart3, Users, Briefcase, FileText, MessageSquare, ThumbsUp, Cloud, Plug, Unplug, ListTodo } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useProfile } from '@/hooks/use-profile'
import { useTeams } from '@/hooks/use-teams'
import { useDrive } from '@/hooks/use-drive'
import { uploadMedia } from '@/lib/media-storage'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard'
import { UnsavedChangesDialog } from '@/components/post/UnsavedChangesDialog'

export default function PerfilPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, signOut } = useAuth()
  const { profile, stats, loading, updateProfile } = useProfile()
  const { teams, members } = useTeams()
  const drive = useDrive()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [name, setName] = useState(profile?.full_name || '')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const nameChanged = editing && name.trim() !== (profile?.full_name || '')
  const unsavedGuard = useUnsavedGuard(nameChanged && !saving)

  useEffect(() => {
    const status = searchParams.get('drive')
    if (status === 'success') toast.success('Google Drive conectado!')
    if (status === 'error') {
      const msg = searchParams.get('driveMsg')
      toast.error(msg ? `Falha ao conectar o Google Drive: ${msg}` : 'Não foi possível conectar o Google Drive')
    }
  }, [searchParams])

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    await updateProfile({ full_name: name.trim() })
    setSaving(false)
    setEditing(false)
    toast.success('Nome atualizado')
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()
    const path = `avatars/${user?.id}.${ext}`
    const publicUrl = await uploadMedia(file, path, { upsert: true }).catch(() => null)
    if (!publicUrl) { toast.error('Falha no upload da foto'); return }
    await updateProfile({ avatar_url: publicUrl })
    if (profile) {
      // Also update auth metadata
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } })
    }
    toast.success('Foto atualizada')
  }

  async function handleConnectDrive() {
    setConnecting(true)
    try {
      await drive.connect()
      // O browser sai da página para o consentimento do Google; o estado não volta aqui.
    } catch {
      toast.error('Não foi possível iniciar a conexão com o Google Drive')
      setConnecting(false)
    }
  }

  async function handleDisconnectDrive() {
    setDisconnecting(true)
    await drive.disconnect()
    setDisconnecting(false)
    toast.success('Google Drive desconectado')
  }

  const statCards = [
    { label: 'Posts criados', value: stats?.total_posts ?? 0, icon: FileText, color: 'text-blue-500' },
    { label: 'Feedbacks enviados', value: stats?.total_feedbacks_given ?? 0, icon: MessageSquare, color: 'text-amber-500' },
    { label: 'Aprovados', value: stats?.total_approved ?? 0, icon: ThumbsUp, color: 'text-emerald-500' },
    { label: 'Ajustes realizados', value: stats?.total_adjustments ?? 0, icon: Pencil, color: 'text-muted-foreground' },
  ]

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-[800px] mx-auto">
      {/* Profile header */}
      <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          {/* Avatar */}
          <div className="relative group">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden ring-2 ring-border">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <User size={32} className="text-primary/40" />
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Camera size={12} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

          {/* Info */}
          <div className="flex-1 text-center md:text-left">
            {editing ? (
              <div className="flex items-center gap-2 max-w-xs">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1 text-xl font-bold bg-transparent border-b-2 border-primary outline-none px-0.5"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
                <button onClick={handleSave} disabled={saving} className="text-primary hover:text-primary/80">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <h1 className="text-2xl font-bold">{profile?.full_name || 'Sem nome'}</h1>
                <button onClick={() => { setName(profile?.full_name || ''); setEditing(true) }} className="text-muted-foreground hover:text-foreground">
                  <Pencil size={14} />
                </button>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-0.5">{user?.email}</p>
            <p className="text-xs text-muted-foreground mt-2 capitalize">
              {profile?.account_type === 'team_owner' ? 'Dono de equipe' :
               profile?.account_type === 'team_member' ? 'Membro de equipe' : 'Individual'}
            </p>

            <div className="flex items-center gap-3 mt-4 justify-center md:justify-start">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/configuracoes')}>
                <Settings size={14} /> Configurações
              </Button>
              <Button variant="ghost" size="sm" className="gap-1.5 text-destructive" onClick={signOut}>
                <LogOut size={14} /> Sair
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-2xl p-4 text-center">
            <stat.icon size={20} className={cn("mx-auto mb-1.5", stat.color)} />
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Storage: Google Drive */}
      <div className="bg-card border border-border rounded-2xl p-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Cloud size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold">Armazenamento de mídia</p>
            {drive.connected ? (
              <p className="text-xs text-muted-foreground">
                Google Drive{drive.email ? ` · ${drive.email}` : ''}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Usando o armazenamento padrão do PostUp. Conecte seu Google Drive para guardar as mídias na sua conta.</p>
            )}
            {drive.connected && drive.quota && (
              <div className="mt-2 w-40">
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min(100, drive.quota.percent)}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {(drive.quota.used / (1024 * 1024 * 1024)).toFixed(2)} GB de {drive.quota.limit > 0 ? `${(drive.quota.limit / (1024 * 1024 * 1024)).toFixed(1)} GB` : '∞'} usados
                </p>
              </div>
            )}
          </div>
        </div>
        {drive.connected ? (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDisconnectDrive} disabled={disconnecting}>
            {disconnecting ? <Loader2 size={14} className="animate-spin" /> : <Unplug size={14} />} Desconectar
          </Button>
        ) : (
          <Button size="sm" className="gap-1.5" onClick={handleConnectDrive} disabled={connecting || drive.loading}>
            {connecting || drive.loading ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />} Conectar Google Drive
          </Button>
        )}
      </div>

      {/* Teams */}
      {teams.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Briefcase size={18} className="text-muted-foreground" />
            <h2 className="text-lg font-bold">Equipes</h2>
          </div>
          <div className="space-y-2">
            {teams.map(team => (
              <div key={team.id} className="flex items-center justify-between p-3 bg-secondary/20 rounded-xl">
                <div>
                  <p className="text-sm font-medium">{team.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {team.owner_id === user?.id ? 'Dono' : 'Membro'} · {members.filter(m => m.team_id === team.id).length} membros
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => navigate('/configuracoes')}>
                  <Settings size={14} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold">Acesso Rápido</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Button variant="outline" className="flex-col gap-1 h-auto py-4" onClick={() => navigate('/home')}>
            <BarChart3 size={20} />
            <span className="text-xs">Dashboard</span>
          </Button>
          <Button variant="outline" className="flex-col gap-1 h-auto py-4" onClick={() => navigate('/clientes')}>
            <Users size={20} />
            <span className="text-xs">Clientes</span>
          </Button>
          <Button variant="outline" className="flex-col gap-1 h-auto py-4" onClick={() => navigate('/tarefas')}>
            <ListTodo size={20} />
            <span className="text-xs">Tarefas</span>
          </Button>
        </div>
      </div>

      {/* Alerta de alterações não salvas: navegação interna bloqueada */}
      <UnsavedChangesDialog
        open={unsavedGuard.blocked}
        onClose={() => unsavedGuard.reset()}
        title="Alterações não salvas"
        description="Você tem alterações não salvas no seu perfil. O que deseja fazer?"
        onLeave={() => unsavedGuard.proceed()}
        onContinue={() => unsavedGuard.reset()}
      />
    </div>
  )
}
