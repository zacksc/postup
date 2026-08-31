import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { subscribeRealtime } from '@/lib/realtime'
import { cn, sanitize } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageSquare, Send, ArrowLeft, Loader2, Search, ExternalLink, ChevronDown, ChevronRight, Users, Archive, Pencil, Check, Edit3 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { useUnreadChat } from '@/hooks/use-unread-chat'

interface PostInfo {
  id: string
  clientName: string
  clientColor: string
  postType: string
  status: string
  caption: string
  scheduled_at: string | null
}

interface Message {
  id: string
  post_id: string
  author_role: string
  author_name: string
  message: string
  created_at: string
  type: string
}

interface PostRow {
  id: string
  client_name: string
  client_color: string
  post_type: string
  status: string
  caption: string
  scheduled_at: string | null
}

export default function ChatPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { unreadByClient, markClientRead } = useUnreadChat()
  const [posts, setPosts] = useState<PostInfo[]>([])
  const [messagesByPost, setMessagesByPost] = useState<Record<string, Message[]>>({})
  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [inputText, setInputText] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [showAllClients, setShowAllClients] = useState(false)
  const [archivedClients, setArchivedClients] = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadData()
    const channel = subscribeRealtime(() =>
      supabase
        .channel('chat-messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_feedbacks' }, () => {
          loadData()
        }),
    )
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messagesByPost, selectedPostId])

  const allClients = useMemo(() => {
    const map = new Map<string, { name: string; color: string; postIds: string[] }>()
    posts.forEach(p => {
      if (!map.has(p.clientName)) map.set(p.clientName, { name: p.clientName, color: p.clientColor, postIds: [] })
      map.get(p.clientName)!.postIds.push(p.id)
    })
    return Array.from(map.values())
  }, [posts])

  const clients = useMemo(() => {
    if (showAllClients) return allClients
    return allClients.filter(c =>
      c.postIds.some(pid => (messagesByPost[pid] || []).length > 0)
    )
  }, [allClients, messagesByPost, showAllClients])

  useEffect(() => {
    const clientParam = searchParams.get('client')
    if (clientParam) {
      const client = clients.find(() => {
        const p = posts.find(pp => pp.id === clientParam)
        return p?.clientName
      })
      if (client) setSelectedClient(client.name)
    }
  }, [searchParams, posts, clients])

  async function loadData() {
    const { data: postsData } = await supabase
      .from('posts')
      .select('id, client_name, client_color, post_type, status, caption, scheduled_at')
      .order('scheduled_at', { ascending: false })

    if (!postsData) { setLoading(false); return }

    const postIds = postsData.map(p => p.id)
    const { data: feedbacks } = await supabase
      .from('post_feedbacks')
      .select('*')
      .in('post_id', postIds)
      .eq('type', 'message')
      .order('created_at', { ascending: true })

    setPosts((postsData as PostRow[]).map(p => ({
      id: p.id,
      clientName: p.client_name || 'Cliente',
      clientColor: p.client_color || '#374151',
      postType: p.post_type || 'foto',
      status: p.status,
      caption: p.caption || '',
      scheduled_at: p.scheduled_at,
    })))

    if (feedbacks) {
      const grouped: Record<string, Message[]> = {}
      ;(feedbacks as Message[]).forEach(f => {
        if (!grouped[f.post_id]) grouped[f.post_id] = []
        grouped[f.post_id].push(f)
      })
      setMessagesByPost(grouped)
    }
    setLoading(false)

    const { data: clientsData } = await supabase.from('clients').select('name, archived_at')
    if (clientsData) {
      setArchivedClients(new Set(clientsData.filter(c => c.archived_at).map(c => c.name)))
    }
  }

  function getClientMessages(clientName: string): Message[] {
    const clientPosts = posts.filter(p => p.clientName === clientName)
    const all: Message[] = []
    clientPosts.forEach(p => {
      const msgs = messagesByPost[p.id] || []
      all.push(...msgs)
    })
    return all.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedClientMessages = selectedClient ? getClientMessages(selectedClient) : []

  const displayMessages = selectedPostId
    ? (messagesByPost[selectedPostId] || [])
    : selectedClientMessages

  async function handleSend() {
    if (!inputText.trim() || !selectedClient || sending) return
    setSending(true)
    const name = user?.user_metadata?.full_name || 'Gestor'

    const targetPostId = selectedPostId || posts.find(p => p.clientName === selectedClient)?.id
    if (!targetPostId) { setSending(false); return }

    try {
      await supabase.from('post_feedbacks').insert([{
        post_id: targetPostId,
        author_role: 'gestor',
        author_name: name,
        message: sanitize(inputText.trim()),
        type: 'message',
      }])
      setInputText('')
      loadData()
    } catch {
      toast.error('Erro ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }

  const [postAction, setPostAction] = useState<string | null>(null)

  /** Ações rápidas do gestor dentro do chat, no contexto do post atual. */
  async function runPostAction(action: 'alteracao' | 'aprovado' | 'publicado', postId: string) {
    if (postAction) return
    setPostAction(action)
    try {
      if (action === 'alteracao') {
        const { error } = await supabase.from('posts').update({ status: 'alteracao', is_feedback: true, user_id: user?.id }).eq('id', postId)
        if (error) throw error
        await supabase.from('post_feedbacks').insert([{
          post_id: postId,
          author_role: 'gestor',
          author_name: user?.user_metadata?.full_name || 'Gestor',
          message: 'Gestor solicitou alteração no post',
          type: 'log',
        }])
        toast.success('Alteração solicitada')
      } else if (action === 'aprovado') {
        const { error } = await supabase.from('posts').update({ status: 'aprovado', user_id: user?.id }).eq('id', postId)
        if (error) throw error
        await supabase.from('post_feedbacks').insert([{
          post_id: postId,
          author_role: 'gestor',
          author_name: user?.user_metadata?.full_name || 'Gestor',
          message: 'Gestor aprovou o post',
          type: 'log',
        }])
        toast.success('Post aprovado')
      } else {
        const { error } = await supabase.from('posts').update({ status: 'publicado', user_id: user?.id }).eq('id', postId)
        if (error) throw error
        await supabase.from('post_feedbacks').insert([{
          post_id: postId,
          author_role: 'gestor',
          author_name: user?.user_metadata?.full_name || 'Gestor',
          message: 'Post foi publicado',
          type: 'log',
        }])
        toast.success('Post publicado')
      }
      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro na ação do post')
    } finally {
      setPostAction(null)
    }
  }

  function openClient(name: string) {
    setSelectedClient(name)
    setSelectedPostId(null)
    markClientRead(name)
  }

  if (loading) {
    return (
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[300px_1fr] overflow-hidden">
        <div className="border-r border-border p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
        <div className="flex items-center justify-center">
          <Skeleton className="h-64 w-64 rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-background">
      {/* Client list */}
      <div className={cn(
        "w-full md:w-[340px] border-r border-border flex flex-col bg-card shrink-0",
        selectedClient && "hidden md:flex"
      )}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold flex items-center gap-2"><MessageSquare size={18} /> Chat</h1>
            <button
              onClick={() => setShowAllClients(!showAllClients)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                showAllClients ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
              )}
            >
              <Users size={14} /> Contatos
            </button>
          </div>
          <div className="relative mt-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg text-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto stagger">
          {filteredClients.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {showAllClients
                ? (searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado')
                : (searchTerm ? 'Nenhum cliente encontrado' : 'Nenhuma conversa ativa')}
            </div>
          ) : (
            filteredClients.map(client => {
              const unread = unreadByClient[client.name] || 0
              const lastMsg = getClientMessages(client.name).slice(-1)[0]
              const archived = archivedClients.has(client.name)
              return (
                <button
                  key={client.name}
                  onClick={() => openClient(client.name)}
                  className={cn(
                    "w-full flex items-start gap-3 p-4 border-b border-border/50 hover:bg-secondary/30 transition-colors text-left",
                    selectedClient === client.name && "bg-secondary/40",
                    archived && "opacity-60"
                  )}
                >
                  <div className="relative shrink-0">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: archived ? '#888' : client.color }}
                    >
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    {unread > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center leading-none shadow">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold truncate">{client.name}</span>
                        {archived && <Archive size={10} className="text-muted-foreground/60 shrink-0" />}
                      </div>
                      {unread > 0 && (
                        <span className="text-[10px] font-bold text-destructive shrink-0">{unread} nova{unread !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    {lastMsg && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{lastMsg.message}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {client.postIds.slice(0, 3).map(pid => {
                        const p = posts.find(pp => pp.id === pid)
                        if (!p) return null
                        const hasMsgs = (messagesByPost[pid] || []).length > 0
                        return (
                          <span
                            key={pid}
                            className={cn(
                              "text-[8px] px-1 py-0.5 rounded font-medium",
                              hasMsgs ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {p.postType} {hasMsgs ? `(${(messagesByPost[pid] || []).length})` : ''}
                          </span>
                        )
                      })}
                      {client.postIds.length > 3 && (
                        <span className="text-[8px] text-muted-foreground">+{client.postIds.length - 3}</span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Message thread */}
      <div className={cn(
        "flex-1 flex flex-col",
        !selectedClient && "hidden md:flex"
      )}>
        {selectedClient ? (
          <>
            <div className="flex items-center gap-3 p-4 border-b border-border bg-card shrink-0">
              <button onClick={() => { setSelectedClient(null); setSelectedPostId(null) }} className="md:hidden p-1 hover:bg-secondary rounded">
                <ArrowLeft size={18} />
              </button>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: clients.find(c => c.name === selectedClient)?.color || '#374151' }}
              >
                {selectedClient.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{selectedClient}</p>
                <p className="text-[10px] text-muted-foreground">{displayMessages.length} mensagens</p>
              </div>
              {selectedPostId && (
                <Button variant="ghost" size="icon" onClick={() => navigate(`/posts/${selectedPostId}`)}>
                  <ExternalLink size={16} />
                </Button>
              )}
            </div>

            {/* Post selector */}
            <div className="flex gap-1 px-4 py-2 border-b border-border bg-secondary/20 overflow-x-auto shrink-0">
              <button
                onClick={() => setSelectedPostId(null)}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-medium rounded-lg whitespace-nowrap transition-colors",
                  !selectedPostId ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'
                )}
              >
                Todos
              </button>
              {posts.filter(p => p.clientName === selectedClient).map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPostId(p.id)}
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-medium rounded-lg whitespace-nowrap transition-colors",
                    selectedPostId === p.id ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'
                  )}
                >
                  {p.postType} — {(messagesByPost[p.id] || []).length} msg
                </button>
              ))}
            </div>

            {/* Contexto do post em discussão + ações rápidas */}
            {selectedPostId && (() => {
              const p = posts.find(pp => pp.id === selectedPostId)
              if (!p) return null
              const statusLabel: Record<string, string> = {
                rascunho: 'Rascunho', aguardando: 'Aguardando', alteracao: 'Em Alteração',
                aprovado: 'Aprovado', publicado: 'Publicado',
              }
              return (
                <div className="px-4 py-3 border-b border-border bg-card shrink-0 space-y-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: p.clientColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider capitalize">{p.postType}</span>
                        <span className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase",
                          p.status === 'aprovado' ? 'bg-success/10 text-success' :
                          p.status === 'publicado' ? 'bg-primary/10 text-primary' :
                          p.status === 'alteracao' ? 'bg-destructive/10 text-destructive' :
                          'bg-muted text-muted-foreground'
                        )}>
                          {statusLabel[p.status] || p.status}
                        </span>
                      </div>
                      {p.scheduled_at && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {format(new Date(p.scheduled_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      )}
                      {p.caption && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{p.caption}</p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/posts/${p.id}`)} title="Abrir página do post">
                      <ExternalLink size={16} />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-[11px] font-medium"
                      disabled={postAction !== null || p.status === 'alteracao'}
                      onClick={() => runPostAction('alteracao', p.id)}
                    >
                      {postAction === 'alteracao' ? <Loader2 size={12} className="animate-spin" /> : <Pencil size={12} />}
                      Solicitar alteração
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-[11px] font-medium"
                      disabled={postAction !== null || p.status === 'aprovado' || p.status === 'publicado'}
                      onClick={() => runPostAction('aprovado', p.id)}
                    >
                      {postAction === 'aprovado' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Aprovar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-[11px] font-medium"
                      disabled={postAction !== null}
                      onClick={() => navigate(`/posts/novo?id=${p.id}`)}
                    >
                      <Edit3 size={12} /> Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-[11px] font-medium"
                      disabled={postAction !== null}
                      onClick={() => navigate(`/posts/${p.id}`)}
                    >
                      <ExternalLink size={12} /> Abrir
                    </Button>
                  </div>
                </div>
              )
            })()}

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {displayMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                  <MessageSquare size={32} className="opacity-30" />
                  <p className="text-sm">Nenhuma mensagem ainda</p>
                </div>
              ) : (
                <>
                  {selectedPostId ? (
                    displayMessages.map(renderMessage)
                  ) : (
                    <>
                      {posts.filter(p => p.clientName === selectedClient).map(p => {
                        const msgs = messagesByPost[p.id] || []
                        if (msgs.length === 0) return null
                        return (
                          <div key={p.id}>
                            <button
                              onClick={() => setExpandedPosts(prev => {
                                const next = new Set(prev)
                                if (next.has(p.id)) next.delete(p.id)
                                else next.add(p.id)
                                return next
                              })}
                              className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 hover:text-foreground transition-colors"
                            >
                              {expandedPosts.has(p.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                              {p.postType} — {format(new Date(msgs[0].created_at), "dd/MM", { locale: ptBR })}
                              <span className="text-[9px] font-normal normal-case ml-1">
                                ({msgs.length} msg{msgs.length !== 1 ? 'ns' : ''})
                              </span>
                            </button>
                            {expandedPosts.has(p.id) && (
                              <div className="space-y-3 ml-3 border-l-2 border-border pl-3">
                                {msgs.map(renderMessage)}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-border bg-card shrink-0">
              <div className="flex gap-2">
                <input
                  placeholder={selectedPostId ? `Mensagem sobre este post...` : `Mensagem para ${selectedClient}...`}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  className="flex-1 px-4 py-2.5 bg-background border border-border rounded-xl text-sm"
                />
                <Button onClick={handleSend} disabled={!inputText.trim() || sending} size="icon" className="shrink-0">
                  <Send size={16} />
                </Button>
              </div>
              {!selectedPostId && (
                <p className="text-[9px] text-muted-foreground mt-1.5">
                  A mensagem será enviada no post mais recente de {selectedClient}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground gap-3 flex-col">
            <MessageSquare size={48} className="opacity-20" />
            <p className="text-sm">Selecione um cliente para conversar</p>
          </div>
        )}
      </div>
    </div>
  )
}

function renderMessage(msg: Message) {
  const isGestor = msg.author_role === 'gestor'
  return (
    <div key={msg.id} className={cn("flex gap-2 animate-fade-up", isGestor && "flex-row-reverse")}>
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0",
        isGestor ? 'bg-primary' : 'bg-rose-400'
      )}>
        {msg.author_name.charAt(0).toUpperCase()}
      </div>
      <div className={cn("max-w-[70%]", isGestor && "items-end")}>
        <div className={cn(
          "rounded-2xl px-3.5 py-2 text-sm",
          isGestor ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-secondary rounded-tl-sm'
        )}>
          <p className="text-[10px] opacity-70 font-medium mb-0.5">{msg.author_name}</p>
          <p>{msg.message}</p>
        </div>
        <p className="text-[9px] text-muted-foreground mt-0.5 px-1">
          {format(new Date(msg.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
        </p>
      </div>
    </div>
  )
}
