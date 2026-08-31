import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Edit3, Target, RefreshCw, AlertCircle, ExternalLink, Phone, Mail, User, Camera, Palette, Type, TrendingUp, Archive, MessageSquare, RotateCcw, FileText } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { cn, resolveThumbMedia } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MonthlyReport } from '@/components/client/MonthlyReport'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { MediaPreview } from '@/components/post/MediaPreview'
import type { Client } from '@/types/client'

type MonthProgress = { total: number; publicado: number; aprovado: number; aguardando: number; alteracao: number; rascunho: number }

interface ClientPostRow {
  id: string
  post_type: string | null
  status: string | null
  scheduled_at: string | null
  media_urls: string[] | null
}

export default function ClientDetail() {
  const navigate = useNavigate()
  const { clientId } = useParams()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [postCount, setPostCount] = useState(0)
  const [monthlyProgress, setMonthlyProgress] = useState<Record<string, MonthProgress>>({})
  const [clientPosts, setClientPosts] = useState<ClientPostRow[]>([])
  const [showReport, setShowReport] = useState(false)

  const carregarCliente = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).single()
      if (error) throw error
      setClient(data)

      const { data: posts } = await supabase.from('posts').select('*').eq('client_id', clientId).order('scheduled_at', { ascending: false })
      if (posts) {
        setClientPosts(posts)
        setPostCount(posts.length)

        const months: Record<string, MonthProgress> = {}
        ;(posts as ClientPostRow[]).forEach(p => {
          if (!p.scheduled_at) return
          const key = format(new Date(p.scheduled_at), 'yyyy-MM')
          if (!months[key]) months[key] = { total: 0, publicado: 0, aprovado: 0, aguardando: 0, alteracao: 0, rascunho: 0 }
          months[key].total++
          const s = (p.status || 'rascunho') as keyof MonthProgress
          if (months[key][s] !== undefined) months[key][s]++
        })
        setMonthlyProgress(months)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar cliente'
      setError(message)
      toast.error('Não foi possível carregar os dados do cliente')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    carregarCliente()
  }, [clientId, carregarCliente])

  async function handleArchive() {
    if (!clientId) return
    try {
      const { error } = await supabase.from('clients').update({ archived_at: new Date().toISOString() }).eq('id', clientId)
      if (error) throw error
      setClient(prev => prev ? { ...prev, archived_at: new Date().toISOString() } : prev)
      toast('Cliente arquivado', {
        description: `${client?.name} foi arquivado.`,
        duration: 6000,
        action: {
          label: 'Desfazer',
          onClick: async () => {
            await supabase.from('clients').update({ archived_at: null }).eq('id', clientId)
            setClient(prev => prev ? { ...prev, archived_at: null } : prev)
            toast.success(`${client?.name} foi restaurado.`)
          },
        },
      })
    } catch {
      toast.error('Não foi possível arquivar o cliente.')
    }
  }

  async function handleUnarchive() {
    if (!clientId) return
    try {
      await supabase.from('clients').update({ archived_at: null }).eq('id', clientId)
      setClient(prev => prev ? { ...prev, archived_at: null } : prev)
      toast.success(`${client?.name} foi restaurado.`)
    } catch {
      toast.error('Não foi possível restaurar o cliente.')
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="max-w-7xl mx-auto p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="p-4 bg-destructive/10 rounded-full">
          <AlertCircle size={32} className="text-destructive" />
        </div>
        <h2 className="text-lg font-bold">Erro ao carregar cliente</h2>
        <p className="text-sm text-muted-foreground">{error || 'Cliente não encontrado'}</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate('/clientes')}>
            <ArrowLeft size={16} /> Voltar
          </Button>
          <Button onClick={carregarCliente}>
            <RefreshCw size={16} /> Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  if (client.archived_at) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8 flex flex-col gap-6 pb-24">
        <button
          onClick={() => navigate('/clientes')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-fit"
        >
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="flex flex-col items-center justify-center py-20 px-4 border-2 border-dashed border-border rounded-3xl text-center bg-secondary/20 gap-4">
          <Archive size={48} className="text-muted-foreground opacity-30" />
          <div>
            <h2 className="text-xl font-bold mb-1">Cliente arquivado</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              {client.name} foi arquivado em {format(new Date(client.archived_at), "dd/MM/yy HH:mm", { locale: ptBR })}.
              Você pode restaurar o cliente para acessar seu conteúdo.
            </p>
          </div>
          <Button onClick={handleUnarchive} variant="outline" className="gap-2">
            <RotateCcw size={16} /> Restaurar cliente
          </Button>
        </div>
      </div>
    )
  }

  const allLinks: { title: string; url: string }[] = []
  if (client.links?.canva) allLinks.push({ title: 'Canva', url: client.links.canva })
  if (client.links?.drive) allLinks.push({ title: 'Google Drive', url: client.links.drive })
  if (client.links?.linktree) allLinks.push({ title: 'Linktree', url: client.links.linktree })
  const customLinks = (client.links as unknown as { custom?: { title?: string; url?: string }[] }).custom
  if (Array.isArray(customLinks)) {
    for (const link of customLinks) {
      if (link.title && link.url) allLinks.push({ title: link.title, url: link.url })
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 flex flex-col gap-6 pb-24">
      <button
        onClick={() => navigate('/clientes')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-fit"
      >
        <ArrowLeft size={16} /> Voltar
      </button>

      <div className="flex items-center justify-between bg-card p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-muted to-muted-foreground shrink-0">
            {client.profile_photo ? (
              <img src={client.profile_photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-bold text-2xl">{client.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{client.name}</h1>
            <p className="text-muted-foreground">{client.handle ? `@${client.handle.replace('@', '')}` : ''}</p>
            {client.bio && <p className="text-sm text-muted-foreground mt-1 max-w-md">{client.bio}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ConfirmModal
            trigger={
              <button className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors">
                <Archive size={16} /> Arquivar
              </button>
            }
            title="Arquivar cliente"
            description={`Tem certeza que deseja arquivar ${client.name}? O cliente e todos os seus dados serão ocultados.`}
            confirmLabel="Arquivar"
            confirmVariant="destructive"
            onConfirm={handleArchive}
          />
          <button
            onClick={() => navigate(`/chat?client=${clientId}`)}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageSquare size={16} /> Chat
          </button>
          <button
            onClick={() => setShowReport(true)}
            className="flex items-center gap-2 px-4 py-2 border border-border text-sm font-medium hover:bg-secondary transition-colors"
          >
            <FileText size={16} /> Relatório
          </button>
          <button
            onClick={() => navigate(`/clientes/${clientId}/editar`)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
          >
            <Edit3 size={16} /> Editar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          {client.brand_tone && (
            <div className="bg-card p-6 rounded-2xl border">
              <h3 className="font-bold mb-4">Tom de Voz</h3>
              <p className="text-sm text-muted-foreground">{client.brand_tone}</p>
            </div>
          )}

          {client.contacts && client.contacts.length > 0 && (
            <div className="bg-card p-6 rounded-2xl border">
              <h3 className="font-bold mb-4 flex items-center gap-2"><User size={18} /> Contatos</h3>
              <div className="space-y-3">
                {client.contacts.map((contact, i) => (
                  <div key={i} className="flex flex-col gap-1 p-3 bg-secondary/20 rounded-xl">
                    <p className="font-medium text-sm">{contact.name}</p>
                    {contact.role && <p className="text-xs text-muted-foreground">{contact.role}</p>}
                    <div className="flex gap-3 mt-1">
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-xs text-primary hover:underline">
                          <Mail size={12} /> {contact.email}
                        </a>
                      )}
                      {contact.phone && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone size={12} /> {contact.phone}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {allLinks.length > 0 && (
            <div className="bg-card p-6 rounded-2xl border">
              <h3 className="font-bold mb-4 flex items-center gap-2"><ExternalLink size={18} /> Links</h3>
              <div className="space-y-2">
                {allLinks.map((link, i) => (
                  <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <ExternalLink size={14} /> {link.title}
                  </a>
                ))}
              </div>

              {client.links?.meetings && client.links.meetings.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="font-medium text-sm">Reuniões</p>
                  {client.links.meetings.map((meeting, i) => (
                    <a key={i} href={meeting.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                      <ExternalLink size={14} /> {meeting.title || meeting.url}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Posts grid - Instagram preview style */}
          {clientPosts.length > 0 && (
            <div className="bg-card p-6 rounded-2xl border">
              <h3 className="font-bold mb-4 flex items-center gap-2"><Camera size={16} /> Posts</h3>
              <div className="grid grid-cols-3 gap-1 rounded-xl overflow-hidden border border-border">
                {clientPosts.slice(0, 9).map(p => (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/posts/${p.id}`)}
                    className="aspect-square bg-muted overflow-hidden cursor-pointer hover:opacity-80 transition-opacity relative group"
                  >
                    {(() => {
                      const { url: thumbUrl, poster: thumbPoster } = resolveThumbMedia(p.media_urls)
                      return thumbUrl ? (
                        <MediaPreview url={thumbUrl} poster={thumbPoster} thumbnail className="w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground/40 text-[10px] uppercase">{p.post_type || 'foto'}</div>
                      )
                    })()}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                      <span className={cn("text-[8px] px-1 py-0.5 rounded font-bold text-white", {
                        'bg-emerald-500': p.status === 'aprovado',
                        'bg-amber-500': p.status === 'aguardando',
                        'bg-rose-500': p.status === 'alteracao',
                        'bg-blue-500': p.status === 'publicado',
                        'bg-muted-foreground': p.status === 'rascunho',
                      })}>
                        {p.status === 'publicado' ? 'Pub' : p.status === 'aprovado' ? 'Ok' : p.status === 'aguardando' ? 'Pend' : p.status === 'alteracao' ? 'Alt' : 'Ras'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {clientPosts.length > 9 && (
                <button onClick={() => navigate(`/cronograma`)} className="text-xs font-medium text-primary mt-3 hover:underline">
                  Ver todos os {clientPosts.length} posts
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-primary/5 p-6 rounded-2xl border border-primary/20">
            <h3 className="font-bold mb-4 flex items-center gap-2"><Target size={16} /> Métricas</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card rounded-xl p-3 border border-border">
                  <p className="text-lg font-bold">{postCount}</p>
                  <p className="text-[10px] text-muted-foreground">Posts no total</p>
                </div>
                <div className="bg-card rounded-xl p-3 border border-border">
                  <p className="text-lg font-bold">{client.followers ?? '—'}</p>
                  <p className="text-[10px] text-muted-foreground">Seguidores</p>
                </div>
                <div className="bg-card rounded-xl p-3 border border-border">
                  <p className="text-lg font-bold">{client.following ?? '—'}</p>
                  <p className="text-[10px] text-muted-foreground">Seguindo</p>
                </div>
                <div className="bg-card rounded-xl p-3 border border-border">
                  <p className="text-lg font-bold">{client.handle ? `@${client.handle.replace('@', '')}` : '—'}</p>
                  <p className="text-[10px] text-muted-foreground">Instagram</p>
                </div>
              </div>
            </div>
          </div>

          {client.branding && (client.branding.logos?.length > 0 || client.branding.palette?.length > 0 || client.branding.fonts?.length > 0) && (
            <div className="bg-card p-6 rounded-2xl border">
              <h3 className="font-bold mb-4 flex items-center gap-2"><Palette size={16} /> Identidade Visual</h3>
              <div className="space-y-4">
                {client.branding.logos?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Logotipos</p>
                    <div className="flex flex-wrap gap-3">
                      {client.branding.logos.map((logo, i) => (
                        <div key={i} className="w-16 h-16 rounded-xl border border-border overflow-hidden bg-secondary/10">
                          <img src={logo} alt="" className="w-full h-full object-contain" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {client.branding.palette?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Paleta de cores</p>
                    <div className="flex flex-wrap gap-2">
                      {client.branding.palette.map((color, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-8 h-8 rounded-lg border border-border" style={{ backgroundColor: color }} />
                          <span className="text-[10px] font-mono text-muted-foreground">{color}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {client.branding.fonts?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Type size={12} /> Fontes</p>
                    <div className="flex flex-wrap gap-2">
                      {client.branding.fonts.map((font, i) => (
                        <span key={i} className="text-xs bg-secondary/30 px-2.5 py-1 rounded-lg border border-border">{font}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {Object.keys(monthlyProgress).length > 0 && (
            <div className="bg-card p-6 rounded-2xl border">
              <h3 className="font-bold mb-4 flex items-center gap-2"><TrendingUp size={16} /> Progresso mensal</h3>
              <div className="space-y-3">
                {Object.entries(monthlyProgress).sort(([a], [b]) => b.localeCompare(a)).slice(0, 6).map(([month, data]) => {
                  const pct = data.total > 0 ? Math.round((data.publicado / data.total) * 100) : 0
                  return (
                    <div key={month} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium capitalize">{format(new Date(month + '-01'), "MMM yyyy", { locale: ptBR })}</span>
                        <span className="text-muted-foreground">{data.total} posts · {pct}% publicado</span>
                      </div>
                      <div className="flex h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                        <div className="bg-blue-500 h-full" style={{ width: `${(data.publicado / Math.max(data.total, 1)) * 100}%` }} />
                        <div className="bg-emerald-500 h-full" style={{ width: `${(data.aprovado / Math.max(data.total, 1)) * 100}%` }} />
                        <div className="bg-orange-500 h-full" style={{ width: `${(data.aguardando / Math.max(data.total, 1)) * 100}%` }} />
                        <div className="bg-red-500 h-full" style={{ width: `${(data.alteracao / Math.max(data.total, 1)) * 100}%` }} />
                        <div className="bg-muted-foreground h-full" style={{ width: `${(data.rascunho / Math.max(data.total, 1)) * 100}%` }} />
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-muted-foreground">
                        <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> {data.publicado} publicado</span>
                        <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {data.aprovado} aprovado</span>
                        <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-orange-500" /> {data.aguardando} pendente</span>
                        <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500" /> {data.alteracao} alteração</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <MonthlyReport
        clientId={clientId || ''}
        clientName={client?.name || 'Cliente'}
        open={showReport}
        onClose={() => setShowReport(false)}
      />
    </div>
  )
}
