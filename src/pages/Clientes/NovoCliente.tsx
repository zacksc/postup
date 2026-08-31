import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Upload, Building, Palette, Link2, Plus, Trash2, Camera, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn, sanitize } from '@/lib/utils'
import { compressImage } from '@/lib/compress-image'
import { uploadMedia } from '@/lib/media-storage'
import { toast } from 'sonner'
import ImageCropperModal from '@/components/modals/ImageCropperModal'
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard'
import { UnsavedChangesDialog } from '@/components/post/UnsavedChangesDialog'

interface CustomLink {
  title: string
  url: string
}

interface Contact {
  name: string
  role: string
  email: string
  phone: string
}

type TabId = 'geral' | 'branding' | 'recursos'

export default function NovoClientePage() {
  const navigate = useNavigate()
  const { clientId } = useParams()
  const { user } = useAuth()
  const isEditing = !!clientId
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [loadingClient, setLoadingClient] = useState(isEditing)
  const [activeTab, setActiveTab] = useState<TabId>('geral')

  const [cropOpen, setCropOpen] = useState(false)
  const [cropImageUrl, setCropImageUrl] = useState('')
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null)

  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [bio, setBio] = useState('')
  const [followers, setFollowers] = useState('')
  const [following, setFollowing] = useState('')
  const [profilePhoto, setProfilePhoto] = useState('')
  const [brandTone, setBrandTone] = useState('')

  const [brandingFonts, setBrandingFonts] = useState<string[]>([])
  const [brandingLogos, setBrandingLogos] = useState<string[]>([])
  const [brandingPalette, setBrandingPalette] = useState<string[]>([])

  const [customLinks, setCustomLinks] = useState<CustomLink[]>([])
  const [canva, setCanva] = useState('')
  const [drive, setDrive] = useState('')
  const [linktree, setLinktree] = useState('')
  const [meetings, setMeetings] = useState<{ title: string; url: string }[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])

  // Detecção de alterações não salvas (guard de navegação)
  const [dirty, setDirty] = useState(false)
  const hydratedRef = useRef(false)
  const savedSnapshotRef = useRef('')

  const snapshotOf = (v: {
    name: string; handle: string; bio: string
    followers: string; following: string; profilePhoto: string; brandTone: string
    brandingFonts: string[]; brandingLogos: string[]; brandingPalette: string[]
    customLinks: CustomLink[]; canva: string; drive: string; linktree: string
    meetings: { title: string; url: string }[]; contacts: Contact[]
  }) => JSON.stringify({
    name: v.name, handle: v.handle, bio: v.bio,
    followers: v.followers, following: v.following, profilePhoto: v.profilePhoto, brandTone: v.brandTone,
    brandingFonts: v.brandingFonts, brandingLogos: v.brandingLogos, brandingPalette: v.brandingPalette,
    customLinks: v.customLinks, canva: v.canva, drive: v.drive, linktree: v.linktree,
    meetings: v.meetings, contacts: v.contacts,
  })

  const currentSnapshot = snapshotOf({
    name, handle, bio, followers, following, profilePhoto, brandTone,
    brandingFonts, brandingLogos, brandingPalette, customLinks, canva, drive, linktree, meetings, contacts,
  })

  // Baseline: depois do carregamento (ou direto no form novo), marca o estado atual como "salvo".
  useEffect(() => {
    if (loadingClient) return
    if (hydratedRef.current) return
    hydratedRef.current = true
    savedSnapshotRef.current = currentSnapshot
  }, [loadingClient])

  useEffect(() => {
    if (!hydratedRef.current) return
    setDirty(currentSnapshot !== savedSnapshotRef.current)
  }, [currentSnapshot])

  function markSaved() {
    savedSnapshotRef.current = currentSnapshot
    setDirty(false)
  }

  const unsavedGuard = useUnsavedGuard(dirty && !loading)

  useEffect(() => {
    if (!clientId) return
    setLoadingClient(true)
    supabase.from('clients').select('*').eq('id', clientId).single().then(({ data, error }) => {
      if (error) {
        toast.error('Erro ao carregar dados do cliente')
        navigate('/clientes')
        return
      }
      if (!data) return
      setName(data.name || '')
      setHandle(data.handle || '')
      setBio(data.bio || '')
      setFollowers(data.followers ? String(data.followers) : '')
      setFollowing(data.following ? String(data.following) : '')
      setProfilePhoto(data.profile_photo || '')
      setBrandTone(data.brand_tone || '')
      setBrandingFonts(Array.isArray(data.branding?.fonts) ? data.branding.fonts : [])
      setBrandingLogos(Array.isArray(data.branding?.logos) ? data.branding.logos : [])
      setBrandingPalette(Array.isArray(data.branding?.palette) ? data.branding.palette : [])
      setCanva(data.links?.canva || '')
      setDrive(data.links?.drive || '')
      setLinktree(data.links?.linktree || '')
      setMeetings(Array.isArray(data.links?.meetings) ? data.links.meetings : [])
      setCustomLinks(Array.isArray(data.links?.custom) ? data.links.custom : [])
      setContacts(Array.isArray(data.contacts) ? data.contacts : [])
      setLoadingClient(false)
    })
  }, [clientId, navigate])

  async function uploadFile(file: File): Promise<string> {
    const compressed = await compressImage(file, { maxDimension: 800, quality: 0.78 })
    const fileName = `clients/${Date.now()}-${file.name.replace(/\.[^.]+$/, '')}.webp`
    return uploadMedia(compressed, fileName)
  }

  async function uploadCropped(blob: Blob) {
    setLoading(true)
    try {
      const file = new File([blob], pendingPhotoFile?.name || 'photo.jpg', { type: 'image/jpeg' })
      const url = await uploadFile(file)
      setProfilePhoto(url)
      toast.success('Upload concluído!')
    } catch {
      toast.error('Erro ao fazer upload')
    } finally {
      setLoading(false)
    }
  }

  function handleFilePick(files: FileList | null, target: 'photo' | 'logo') {
    if (!files || files.length === 0) return
    if (target === 'photo') {
      setPendingPhotoFile(files[0])
      setCropImageUrl(URL.createObjectURL(files[0]))
      setCropOpen(true)
    } else {
      setLoading(true)
      uploadFile(files[0]).then(url => {
        setBrandingLogos(prev => [...prev, url])
        toast.success('Upload concluído!')
      }).catch(() => toast.error('Erro ao fazer upload')).finally(() => setLoading(false))
    }
  }

  function addCustomLink() {
    setCustomLinks([...customLinks, { title: '', url: '' }])
  }

  function updateCustomLink(index: number, field: keyof CustomLink, value: string) {
    setCustomLinks(customLinks.map((l, i) => i === index ? { ...l, [field]: value } : l))
  }

  function removeCustomLink(index: number) {
    setCustomLinks(customLinks.filter((_, i) => i !== index))
  }

  function addFont() {
    setBrandingFonts([...brandingFonts, ''])
  }

  function updateFont(index: number, value: string) {
    setBrandingFonts(brandingFonts.map((f, i) => i === index ? value : f))
  }

  function removeFont(index: number) {
    setBrandingFonts(brandingFonts.filter((_, i) => i !== index))
  }

  function addColor() {
    setBrandingPalette([...brandingPalette, '#000000'])
  }

  function updateColor(index: number, value: string) {
    setBrandingPalette(brandingPalette.map((c, i) => i === index ? value : c))
  }

  function removeColor(index: number) {
    setBrandingPalette(brandingPalette.filter((_, i) => i !== index))
  }

  function addMeeting() {
    setMeetings([...meetings, { title: '', url: '' }])
  }

  function updateMeeting(index: number, field: keyof { title: string; url: string }, value: string) {
    setMeetings(meetings.map((m, i) => i === index ? { ...m, [field]: value } : m))
  }

  function removeMeeting(index: number) {
    setMeetings(meetings.filter((_, i) => i !== index))
  }

  function addContact() {
    setContacts([...contacts, { name: '', role: '', email: '', phone: '' }])
  }

  function updateContact(index: number, field: keyof Contact, value: string) {
    setContacts(contacts.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  function removeContact(index: number) {
    setContacts(contacts.filter((_, i) => i !== index))
  }

  async function handleSave(): Promise<boolean> {
    if (!name.trim()) {
      toast.error('O nome da marca é obrigatório')
      return false
    }

    setLoading(true)
    try {
      const payload = {
        name: sanitize(name.trim()),
        handle: sanitize(handle.trim()),
        bio: sanitize(bio.trim()) || null,
        followers: followers ? Number(followers) : 0,
        following: following ? Number(following) : 0,
        profile_photo: profilePhoto.trim() || null,
        brand_tone: sanitize(brandTone.trim()) || null,
        branding: {
          fonts: brandingFonts.filter(Boolean).map(f => sanitize(f)),
          logos: brandingLogos,
          palette: brandingPalette.filter(Boolean),
        },
        links: {
          canva: sanitize(canva.trim()),
          drive: sanitize(drive.trim()),
          linktree: sanitize(linktree.trim()),
          meetings: meetings.map(m => ({ ...m, title: sanitize(m.title || ''), url: sanitize(m.url || '') })),
          custom: customLinks.map(l => ({ ...l, title: sanitize(l.title || ''), url: sanitize(l.url || '') })),
        },
        contacts: contacts.map(c => ({
          ...c,
          name: sanitize(c.name || ''),
          role: sanitize(c.role || ''),
          email: sanitize(c.email || ''),
          phone: sanitize(c.phone || ''),
        })),
        metrics: {},
        contracts: [],
      }

      if (isEditing) {
        const { error } = await supabase.from('clients').update(payload).eq('id', clientId)
        if (error) throw error
        toast.success('Cliente atualizado com sucesso!')
        markSaved()
        navigate(`/clients/${clientId}`)
      } else {
        const { error } = await supabase.from('clients').insert([{ ...payload, user_id: user?.id }])
        if (error) throw error
        toast.success('Cliente cadastrado com sucesso!')
        markSaved()
        navigate('/clientes')
      }
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar cliente'
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'geral', label: 'Dados Básicos', icon: Building },
    { id: 'branding', label: 'Identidade', icon: Palette },
    { id: 'recursos', label: 'Recursos', icon: Link2 },
  ]

  if (loadingClient) {
    return (
      <div className="max-w-3xl mx-auto p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 size={32} className="animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Carregando cliente...</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-8 pb-24">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => handleFilePick(e.target.files, 'photo')}
      />
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => handleFilePick(e.target.files, 'logo')}
      />

      <ImageCropperModal
        open={cropOpen}
        onOpenChange={setCropOpen}
        imageUrl={cropImageUrl}
        onCropComplete={uploadCropped}
        title="Redimensionar foto do cliente"
      />

      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate(isEditing ? `/clients/${clientId}` : '/clientes')}>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold">{isEditing ? 'Editar Cliente' : 'Novo Cliente'}</h1>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabId)}
              className={cn(
                "flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-6">
          {activeTab === 'geral' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 bg-secondary rounded-full flex items-center justify-center border border-border overflow-hidden shrink-0">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Button variant="outline" disabled={loading} onClick={() => fileInputRef.current?.click()}>
                    {loading ? 'Enviando...' : 'Alterar Foto'}
                  </Button>
                  <p className="text-[10px] text-muted-foreground">Faça upload da logo ou foto do cliente</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome da Marca *</label>
                  <Input placeholder="Ex: Postup Studio" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Instagram Handle</label>
                  <Input placeholder="@handle" value={handle} onChange={e => setHandle(e.target.value)} />
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-sm font-medium flex items-center gap-2"><Camera size={16} /> Perfil do Instagram</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Seguidores</label>
                    <Input type="number" placeholder="0" value={followers} onChange={e => setFollowers(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Seguindo</label>
                    <Input type="number" placeholder="0" value={following} onChange={e => setFollowing(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Bio</label>
                    <Input placeholder="Bio do Instagram" value={bio} onChange={e => setBio(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Tom de Voz</label>
                <Textarea placeholder="Como a marca se comunica?" className="min-h-[100px]" value={brandTone} onChange={e => setBrandTone(e.target.value)} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Contatos</label>
                  <Button variant="outline" size="sm" onClick={addContact} className="gap-1">
                    <Plus size={14} /> Adicionar
                  </Button>
                </div>
                {contacts.map((contact, i) => (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-2 p-3 bg-secondary/20 rounded-xl border border-border">
                    <Input placeholder="Nome" value={contact.name} onChange={e => updateContact(i, 'name', e.target.value)} />
                    <Input placeholder="Cargo" value={contact.role} onChange={e => updateContact(i, 'role', e.target.value)} />
                    <Input placeholder="Email" value={contact.email} onChange={e => updateContact(i, 'email', e.target.value)} />
                    <div className="flex gap-2">
                      <Input placeholder="Telefone" value={contact.phone} onChange={e => updateContact(i, 'phone', e.target.value)} />
                      <Button variant="ghost" size="icon" onClick={() => removeContact(i)} className="shrink-0 text-destructive">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'branding' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Logotipos</label>
                  <Button variant="outline" size="sm" disabled={loading} onClick={() => logoInputRef.current?.click()} className="gap-1">
                    <Upload size={14} /> Upload
                  </Button>
                </div>
                {brandingLogos.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum logotipo cadastrado.</p>
                )}
                <div className="flex flex-wrap gap-3">
                  {brandingLogos.map((logo, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-xl border border-border overflow-hidden bg-secondary/20 group">
                      <img src={logo} alt="" className="w-full h-full object-contain" />
                      <button
                        onClick={() => setBrandingLogos(brandingLogos.filter((_, j) => j !== i))}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Cores da marca</label>
                  <Button variant="outline" size="sm" onClick={addColor} className="gap-1">
                    <Plus size={14} /> Adicionar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-3">
                  {brandingPalette.map((color, i) => (
                    <div key={i} className="flex items-center gap-2 bg-secondary/20 rounded-lg px-3 py-1.5 border border-border">
                      <input
                        type="color"
                        value={color}
                        onChange={e => updateColor(i, e.target.value)}
                        className="w-8 h-8 rounded-lg border border-border cursor-pointer bg-transparent"
                      />
                      <Input
                        value={color}
                        onChange={e => updateColor(i, e.target.value)}
                        className="w-24 h-8 text-xs font-mono"
                        placeholder="#000000"
                      />
                      <button onClick={() => removeColor(i)} className="text-destructive hover:opacity-70">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Fontes</label>
                  <Button variant="outline" size="sm" onClick={addFont} className="gap-1">
                    <Plus size={14} /> Adicionar
                  </Button>
                </div>
                {brandingFonts.map((font, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input placeholder="Ex: Montserrat, Roboto, Playfair Display" value={font} onChange={e => updateFont(i, e.target.value)} />
                    <Button variant="ghost" size="icon" onClick={() => removeFont(i)} className="shrink-0 text-destructive">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'recursos' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-2">
                <label className="text-sm font-medium">Canva</label>
                <Input placeholder="Link do Canva" value={canva} onChange={e => setCanva(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Google Drive</label>
                <Input placeholder="Link do Drive" value={drive} onChange={e => setDrive(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Linktree</label>
                <Input placeholder="Link do Linktree" value={linktree} onChange={e => setLinktree(e.target.value)} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Links personalizados</label>
                  <Button variant="outline" size="sm" onClick={addCustomLink} className="gap-1">
                    <Plus size={14} /> Adicionar
                  </Button>
                </div>
                {customLinks.map((link, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input placeholder="Título do link" value={link.title} onChange={e => updateCustomLink(i, 'title', e.target.value)} />
                    <Input placeholder="URL" value={link.url} onChange={e => updateCustomLink(i, 'url', e.target.value)} />
                    <Button variant="ghost" size="icon" onClick={() => removeCustomLink(i)} className="shrink-0 text-destructive">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Reuniões</label>
                  <Button variant="outline" size="sm" onClick={addMeeting} className="gap-1">
                    <Plus size={14} /> Adicionar
                  </Button>
                </div>
                {meetings.map((meeting, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input placeholder="Título" value={meeting.title} onChange={e => updateMeeting(i, 'title', e.target.value)} />
                    <Input placeholder="URL" value={meeting.url} onChange={e => updateMeeting(i, 'url', e.target.value)} />
                    <Button variant="ghost" size="icon" onClick={() => removeMeeting(i)} className="shrink-0 text-destructive">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border flex justify-end gap-3 bg-secondary/10">
          <Button variant="outline" onClick={() => navigate(isEditing ? `/clients/${clientId}` : '/clientes')}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading} className="gap-2">
            <Save size={18} />
            {loading ? 'Salvando...' : isEditing ? 'Atualizar Cliente' : 'Salvar Cliente'}
          </Button>
        </div>
      </div>

      {/* Alerta de alterações não salvas: navegação interna bloqueada */}
      <UnsavedChangesDialog
        open={unsavedGuard.blocked}
        onClose={() => unsavedGuard.reset()}
        title="Alterações não salvas"
        description="Você tem alterações não salvas neste cliente. O que deseja fazer?"
        onLeave={() => unsavedGuard.proceed()}
        onContinue={() => unsavedGuard.reset()}
      />
    </div>
  )
}
