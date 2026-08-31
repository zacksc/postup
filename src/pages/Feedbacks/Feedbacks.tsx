import { useState, useEffect, useCallback } from 'react'
import { Search, Filter, X, ListTodo, AlertTriangle, CalendarDays, Plus, Trash2, Archive, Square, CheckSquare, MoveRight, ExternalLink, ListChecks } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format, startOfWeek, endOfWeek, isWithinInterval, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { subscribeRealtime } from '@/lib/realtime'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { FeedbackCardModal } from '@/components/feedback/FeedbackCardModal'
import { PostViewModal } from '@/components/modals/PostViewModal'
import { MediaPreview } from '@/components/post/MediaPreview'
import { cn, sanitize, resolveThumbMedia } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { deletePost } from '@/lib/post-delete'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Skeleton } from '@/components/ui/skeleton'
import { DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, closestCorners, type DragEndEvent } from '@dnd-kit/core'
import type { FeedbackCardFull, FeedbackCard, FeedbackCardAttachment, FeedbackCardChecklistItem, FeedbackCardStatus, Tag } from '@/types/feedback'
import type { PostFile } from '@/types/post'
interface PostItem {
  id: string
  clientName: string
  clientHandle: string
  clientColor: string
  type: string
  caption: string
  scheduled_at: string
  status: string
  media_urls: string[]
  version?: number
  isFeedback?: boolean
  platform?: string
  archived_at?: string | null
  tags?: Tag[]
  isStandaloneTask?: boolean
  created_at?: string
}

interface CardSummary {
  id: string
  post_id: string
  title: string
  description: string
  status: string
  priority: string
  deadline: string
}

interface PostRow {
  id: string
  client_name: string | null
  client_handle: string | null
  client_color: string | null
  post_type: string | null
  caption: string | null
  scheduled_at: string
  status: string | null
  media_urls: string[] | null
  version?: number | null
  is_feedback?: boolean | null
  platform?: string | null
  tags?: Tag[] | null
  created_at?: string | null
}

function isTodayScheduled(scheduled: string | null) {
  if (!scheduled) return false
  const d = new Date(scheduled)
  if (Number.isNaN(d.getTime())) return false
  return format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'aguardando', title: 'A Fazer', color: 'bg-[#F6BD60]', bgLight: 'bg-[#F6BD60]/10 dark:bg-[#F6BD60]/10', borderLight: 'border-[#F6BD60]/30 dark:border-[#F6BD60]/20' },
  { id: 'alteracao', title: 'Em Andamento', color: 'bg-[#F28482]', bgLight: 'bg-[#F28482]/10 dark:bg-[#F28482]/10', borderLight: 'border-[#F28482]/30 dark:border-[#F28482]/20' },
  { id: 'aprovado', title: 'Aprovados', color: 'bg-[#6b9b7f]', bgLight: 'bg-[#6b9b7f]/10 dark:bg-[#6b9b7f]/10', borderLight: 'border-[#6b9b7f]/30 dark:border-[#6b9b7f]/20' },
  { id: 'publicado', title: 'Publicado', color: 'bg-[#6b9b7f]', bgLight: 'bg-[#6b9b7f]/5 dark:bg-[#6b9b7f]/10', borderLight: 'border-[#6b9b7f]/20 dark:border-[#6b9b7f]/20' },
]

const COLORS_CYCLE = [
  { color: 'bg-[#F6BD60]', bgLight: 'bg-[#F6BD60]/10 dark:bg-[#F6BD60]/10', borderLight: 'border-[#F6BD60]/30 dark:border-[#F6BD60]/20' },
  { color: 'bg-[#F5CAC3]', bgLight: 'bg-[#F5CAC3]/10 dark:bg-[#F5CAC3]/10', borderLight: 'border-[#F5CAC3]/30 dark:border-[#F5CAC3]/20' },
  { color: 'bg-[#F28482]', bgLight: 'bg-[#F28482]/10 dark:bg-[#F28482]/10', borderLight: 'border-[#F28482]/30 dark:border-[#F28482]/20' },
  { color: 'bg-[#84A59D]', bgLight: 'bg-[#84A59D]/10 dark:bg-[#84A59D]/10', borderLight: 'border-[#84A59D]/30 dark:border-[#84A59D]/20' },
  { color: 'bg-[#F6BD60]', bgLight: 'bg-[#F6BD60]/10 dark:bg-[#F6BD60]/10', borderLight: 'border-[#F6BD60]/30 dark:border-[#F6BD60]/20' },
  { color: 'bg-[#F5CAC3]', bgLight: 'bg-[#F5CAC3]/10 dark:bg-[#F5CAC3]/10', borderLight: 'border-[#F5CAC3]/30 dark:border-[#F5CAC3]/20' },
  { color: 'bg-[#F28482]', bgLight: 'bg-[#F28482]/10 dark:bg-[#F28482]/10', borderLight: 'border-[#F28482]/30 dark:border-[#F28482]/20' },
  { color: 'bg-[#84A59D]', bgLight: 'bg-[#84A59D]/10 dark:bg-[#84A59D]/10', borderLight: 'border-[#84A59D]/30 dark:border-[#84A59D]/20' },
]

const STORAGE_KEY = 'feedback-columns'

function loadColumnConfig(): ColumnConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Garante que a coluna "Publicado" existe mesmo para quem salvou
        // as colunas antes dela (migração do localStorage).
        const hasPublicado = parsed.some((c: ColumnConfig) => c.id === 'publicado')
        if (hasPublicado) return parsed
        const publicado = DEFAULT_COLUMNS.find(c => c.id === 'publicado')
        if (publicado) return [...parsed, publicado]
        return parsed
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_COLUMNS
}

function saveColumnConfig(config: ColumnConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

interface ColumnConfig {
  id: string
  title: string
  color: string
  bgLight: string
  borderLight: string
  meta?: string
}

export default function FeedbacksPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [colConfig, setColConfig] = useState<ColumnConfig[]>(() => loadColumnConfig())
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [columns, setColumns] = useState<Record<string, PostItem[]>>({})
  const [cardsByPost, setCardsByPost] = useState<Record<string, CardSummary[]>>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filterClient, setFilterClient] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterResponsible, setFilterResponsible] = useState('')
  const [filterKind, setFilterKind] = useState<'todos' | 'posts' | 'feedbacks'>('todos')
  const [filterTag, setFilterTag] = useState('')
  const [responsibleByClient, setResponsibleByClient] = useState<Record<string, string>>({})
  const [activeDragCard, setActiveDragCard] = useState<PostItem | null>(null)
  const [showCurrentWeek, setShowCurrentWeek] = useState(false)
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'timeline'>('board')

  const [modalVersions, setModalVersions] = useState<{ name: string }[]>([])

  // Seleção em lote + arquivo
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showArchive, setShowArchive] = useState(false)
  const [archivedPosts, setArchivedPosts] = useState<PostItem[]>([])
  const [bulkTarget, setBulkTarget] = useState('')

  // Modal state
  const [modalCard, setModalCard] = useState<FeedbackCardFull | null>(null)
  const [modalPostData, setModalPostData] = useState<{
    id: string; clientName: string; clientHandle: string; type: string; caption: string; scheduledAt: string; files: PostFile[]; isStandalone?: boolean
  } | null>(null)
  const [viewPostModal, setViewPostModal] = useState<PostItem | null>(null)

  /** Arquiva automaticamente posts que passaram da data (D23). */
  const runAutoArchive = useCallback(async () => {
    const now = new Date()
    const startToday = startOfDay(now)

    const { data } = await supabase
      .from('posts')
      .select('id, status, scheduled_at, archived_at')
      .in('status', ['aprovado', 'publicado'])
      .is('archived_at', null)

    if (!data) return
    const toArchive = data.filter(p => {
      const d = new Date(p.scheduled_at)
      if (Number.isNaN(d.getTime())) return false
      if (p.status === 'aprovado') return d < startToday
      if (p.status === 'publicado') return d < startToday
      return false
    }).map(p => p.id)
    if (toArchive.length > 0) {
      await supabase.from('posts').update({ archived_at: new Date().toISOString(), user_id: user?.id }).in('id', toArchive)
    }
  }, [user?.id])

  const fetchArchive = useCallback(async () => {
    const { data } = await supabase
      .from('posts')
      .select('id, client_name, client_color, client_handle, post_type, caption, scheduled_at, status, media_urls, is_feedback, platform')
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false })
      .limit(100)
    if (data) {
      setArchivedPosts(data.map((p: PostRow) => ({
        id: p.id,
        clientName: p.client_name || 'Cliente',
        clientHandle: p.client_handle || '',
        clientColor: p.client_color || '#374151',
        type: (p.post_type || 'foto').toLowerCase(),
        caption: p.caption || '',
        scheduled_at: p.scheduled_at,
        status: p.status || 'aguardando',
        media_urls: p.media_urls || [],
        version: p.version || 1,
        isFeedback: Boolean(p.is_feedback),
        platform: p.platform || 'instagram',
        created_at: p.created_at || undefined,
      })))
    }
  }, [])

  const restorePost = async (id: string) => {
    await supabase.from('posts').update({ archived_at: null, user_id: user?.id }).eq('id', id)
    fetchArchive()
    fetchData()
  }

  // ── Seleção em lote ──
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = (posts: PostItem[]) => {
    const colPostIds = posts.map(p => p.id)
    const allSelected = colPostIds.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) colPostIds.forEach(id => next.delete(id))
      else colPostIds.forEach(id => next.add(id))
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  function toggleBulkMode() {
    setBulkMode(prev => {
      const next = !prev
      if (!next) setSelectedIds(new Set())
      return next
    })
  }

  const bulkMove = async (targetColId: string) => {
    if (selectedIds.size === 0 || !targetColId) return
    const ids = Array.from(selectedIds)
    const { data, error } = await supabase.from('posts').update({ status: targetColId, user_id: user?.id }).in('id', ids).select('id')
    if (error) {
      console.error('[bulkMove] Erro:', error)
      toast.error('Erro ao mover posts: ' + error.message)
    } else if (!data || data.length === 0) {
      toast.error('Nenhum post foi movido. Verifique as permissões.')
    }
    clearSelection()
    setBulkTarget('')
    fetchData()
  }

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return
    setLoading(true)
    const ids = Array.from(selectedIds)
    for (const id of ids) {
      try { await deletePost(id) } catch { /* segue para o próximo */ }
    }
    clearSelection()
    setLoading(false)
    fetchData()
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    const colIds = colConfig.map(c => c.id)

    const [postsResult, standaloneResult] = await Promise.all([
      supabase
        .from('posts')
        .select('id, client_name, client_color, client_handle, post_type, caption, scheduled_at, status, media_urls, is_feedback, platform, tags')
        .in('status', colIds)
        .is('archived_at', null)
        .order('scheduled_at', { ascending: false }),
      supabase
        .from('feedback_cards')
        .select('id, title, description, status, created_at')
        .is('post_id', null)
        .in('status', colIds)
        .order('created_at', { ascending: false })
    ])

    if (standaloneResult.error) {
      console.warn('[Feedbacks] Standalone tasks query failed:', standaloneResult.error.message)
    }

    const postsData = postsResult.data
    const standaloneData = standaloneResult.data

    const items: PostItem[] = (postsData || []).map((p: PostRow) => ({
      id: p.id,
      clientName: p.client_name || 'Cliente',
      clientHandle: p.client_handle || '',
      clientColor: p.client_color || '#374151',
      type: (p.post_type || 'foto').toLowerCase(),
      caption: p.caption || '',
      scheduled_at: p.scheduled_at,
      status: p.status || 'aguardando',
      media_urls: p.media_urls || [],
      version: p.version || 1,
      isFeedback: Boolean(p.is_feedback),
      platform: p.platform || 'instagram',
      tags: Array.isArray(p.tags) ? p.tags : [],
      created_at: p.created_at || undefined,
    }))

    const standaloneItems: PostItem[] = (standaloneData || []).map((t: Record<string, unknown>) => ({
      id: t.id as string,
      clientName: (t.title as string) || 'Tarefa',
      clientHandle: '',
      clientColor: '#6366f1',
      type: 'tarefa',
      caption: (t.description as string) || '',
      scheduled_at: (t.created_at as string) || new Date().toISOString(),
      status: (t.status as string) || 'aguardando',
      media_urls: [],
      isFeedback: false,
      isStandaloneTask: true,
      tags: [],
      created_at: (t.created_at as string) || undefined,
    }))

    const novosDados: Record<string, PostItem[]> = {}
    colIds.forEach(id => { novosDados[id] = [] })
    items.forEach((p) => {
      const col = p.status
      if (novosDados[col]) novosDados[col].push(p)
    })
    standaloneItems.forEach((t) => {
      const col = t.status
      if (novosDados[col]) novosDados[col].push(t)
    })
    setColumns(novosDados)

    const { data: cardsData } = await supabase
      .from('feedback_cards')
      .select('id, post_id, title, description, status, priority, deadline')
      .in('post_id', items.map(p => p.id))
      .order('created_at', { ascending: false })

    if (cardsData) {
      const now = new Date()
      const overdue = cardsData.filter(
        (c: CardSummary) => new Date(c.deadline) < now && c.status !== 'aprovado' && c.priority !== 'urgente'
      )
      if (overdue.length > 0) {
        await Promise.all(
          overdue.map((c: CardSummary) =>
            supabase.from('feedback_cards').update({ priority: 'urgente', user_id: user?.id }).eq('id', c.id)
          )
        )
        const { data: refreshed } = await supabase
          .from('feedback_cards')
          .select('id, post_id, title, description, status, priority, deadline')
          .in('id', overdue.map((c: CardSummary) => c.id))
        if (refreshed) {
          refreshed.forEach((r: CardSummary) => {
            const idx = cardsData.findIndex((c: CardSummary) => c.id === r.id)
            if (idx >= 0) cardsData[idx] = r
          })
        }
      }

      const grouped: Record<string, CardSummary[]> = {}
      cardsData.forEach((c: CardSummary) => {
        if (!grouped[c.post_id]) grouped[c.post_id] = []
        grouped[c.post_id].push(c as CardSummary)
      })
      setCardsByPost(grouped)
    }
    setLoading(false)
  }, [colConfig, user?.id])

  useEffect(() => {
    runAutoArchive().then(() => fetchData())
    const channel = subscribeRealtime(() =>
      supabase
        .channel('feedbacks-kanban')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback_cards' }, () => fetchData()),
    )
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [fetchData])

  // Responsáveis por cliente (para o filtro de responsável do Tarefas).
  useEffect(() => {
    supabase.from('clients').select('name, responsible_user').then(({ data }) => {
      const map: Record<string, string> = {}
      ;(data || []).forEach(c => {
        if (c.name && c.responsible_user) map[c.name] = c.responsible_user
      })
      setResponsibleByClient(map)
    })
  }, [])

  const allPosts = Object.values(columns).flat()
  const uniqueClients = [...new Set(allPosts.map(p => p.clientName))]

  const availableMonths = [...new Set(allPosts.map(p => {
    const d = new Date(p.scheduled_at)
    return isNaN(d.getTime()) ? '' : format(d, 'yyyy-MM')
  }).filter(Boolean))].sort().reverse()

  const responsibleOptions = [...new Set(Object.values(responsibleByClient).filter(Boolean))]

  const uniqueTagNames = [...new Set(allPosts.flatMap(p => p.tags?.map(t => t.name) || []))].sort()

  const hasActiveFilters = filterClient || filterType || filterMonth || filterResponsible || filterKind !== 'todos' || searchTerm || filterTag

  function clearFilters() {
    setSearchTerm('')
    setFilterClient('')
    setFilterType('')
    setFilterMonth('')
    setFilterResponsible('')
    setFilterKind('todos')
    setFilterTag('')
  }

  function filterPosts(posts: PostItem[]): PostItem[] {
    return posts.filter(p => {
      if (filterClient && p.clientName !== filterClient) return false
      if (filterType && p.type !== filterType) return false
      if (filterKind === 'posts' && p.isFeedback) return false
      if (filterKind === 'feedbacks' && !p.isFeedback) return false
      if (filterMonth) {
        const d = new Date(p.scheduled_at)
        if (isNaN(d.getTime()) || format(d, 'yyyy-MM') !== filterMonth) return false
      }
      if (filterResponsible && responsibleByClient[p.clientName] !== filterResponsible) return false
      if (showCurrentWeek) {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
        const postDate = new Date(p.scheduled_at)
        if (!isWithinInterval(postDate, { start: weekStart, end: weekEnd })) return false
      }
      if (searchTerm) {
        const q = searchTerm.toLowerCase()
        if (!p.clientName.toLowerCase().includes(q) && !p.caption.toLowerCase().includes(q)) return false
      }
      if (filterTag) {
        const hasTag = p.tags?.some(t => t.name === filterTag)
        if (!hasTag) return false
      }
      return true
    })
  }

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  async function handleDndEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveDragCard(null)
    if (!active || !over || active.id === over.id) return

    // Determinar a coluna de destino: pode ser um card (over.id = post.id)
    // ou uma coluna (over.id = colId)
    let targetColId = over.id as string
    let targetCol = colConfig.find(c => c.id === targetColId)

    // Se não encontrou a coluna, o over é um card — buscar a coluna desse card
    if (!targetCol) {
      for (const [colId, colPosts] of Object.entries(columns)) {
        if (colPosts.some(p => p.id === targetColId)) {
          targetColId = colId
          targetCol = colConfig.find(c => c.id === colId)
          break
        }
      }
    }

    // Debug: log para entender o que está acontecendo
    console.log('[DnD] active:', active.id, 'over:', over.id, 'targetColId:', targetColId, 'targetCol:', targetCol?.title)

    if (!targetCol) return

    // Arrastou um card que está na seleção → move TODOS os selecionados.
    const moveIds = selectedIds.has(active.id as string)
      ? Array.from(selectedIds)
      : [active.id as string]

    // Separate standalone tasks from regular posts
    const allItems = Object.values(columns).flat()
    const standaloneIds = moveIds.filter(id => allItems.find(p => p.id === id)?.isStandaloneTask)
    const postIds = moveIds.filter(id => !allItems.find(p => p.id === id)?.isStandaloneTask)

    // Update standalone tasks in feedback_cards table
    // feedback_cards SÓ aceita: aguardando, alteracao, aprovado (CHECK constraint)
    // Colunas customizadas ou 'publicado' → mapear para valor válido mais próximo
    if (standaloneIds.length > 0) {
      // Mapear targetColId para um status válido do feedback_cards
      let cardStatus: string
      if (targetColId === 'publicado' || targetColId === 'aprovado') {
        cardStatus = 'aprovado'
      } else if (targetColId === 'alteracao') {
        cardStatus = 'alteracao'
      } else if (targetColId === 'aguardando') {
        cardStatus = 'aguardando'
      } else {
        cardStatus = 'aprovado'
      }
      console.log('[DnD] Movendo tarefa:', { standaloneIds, targetColId, cardStatus })
      let { error } = await supabase.from('feedback_cards').update({ status: cardStatus, user_id: user?.id }).in('id', standaloneIds)
      // Se falhou, tentar com 'aprovado' como último recurso
      if (error && cardStatus !== 'aprovado') {
        console.log('[DnD] Retry com aprovado')
        const retry = await supabase.from('feedback_cards').update({ status: 'aprovado', user_id: user?.id }).in('id', standaloneIds)
        error = retry.error
      }
      if (error) {
        console.error('[DnD] Erro ao mover tarefas:', error)
        toast.error('Erro ao mover tarefas: ' + error.message)
      }
    }
    // Update regular posts in posts table
    // Usamos .select('id') para detectar falha silenciosa do RLS (0 rows afetadas)
    if (postIds.length > 0) {
      const { data, error } = await supabase.from('posts').update({ status: targetColId, user_id: user?.id }).in('id', postIds).select('id')
      if (error) {
        console.error('[DnD] Erro ao mover posts:', error)
        toast.error('Erro ao mover posts: ' + error.message)
      } else if (!data || data.length === 0) {
        toast.error('Nenhum post foi movido. Verifique as permissões do post.')
      }
    }
    clearSelection()
    fetchData()
  }

  const handleOpenCard = async (post: PostItem) => {
    // Standalone tasks: open FeedbackCardModal directly with the task's card
    if (post.isStandaloneTask) {
      setModalPostData({
        id: post.id,
        clientName: post.clientName,
        clientHandle: '',
        type: 'tarefa',
        caption: post.caption,
        scheduledAt: post.scheduled_at,
        files: [],
        isStandalone: true,
      })
      // Load the standalone task as a card
      try {
        const { data: fullCard } = await supabase
          .from('feedback_cards')
          .select('*')
          .eq('id', post.id)
          .single()
        if (fullCard) {
          const [attachmentsRes, checklistRes, commentsRes] = await Promise.all([
            supabase.from('feedback_card_attachments').select('*').eq('card_id', fullCard.id),
            supabase.from('feedback_card_checklist_items').select('*').eq('card_id', fullCard.id),
            supabase.from('feedback_card_comments').select('*').eq('card_id', fullCard.id).order('created_at'),
          ])
          setModalCard({
            ...(fullCard as FeedbackCard),
            attachments: attachmentsRes.data || [],
            checklist: checklistRes.data || [],
            comments: commentsRes.data || [],
          })
        }
      } catch { setModalCard(null) }
      return
    }

    // Posts: open FeedbackCardModal with post data
    setModalPostData({
      id: post.id,
      clientName: post.clientName,
      clientHandle: post.clientHandle,
      type: post.type,
      caption: post.caption,
      scheduledAt: post.scheduled_at,
      files: post.media_urls.map((url: string, i: number) => ({
        id: `media-${i}`, url, order: i, mediaType: 'image' as const,
      })),
    })

    // Load versions for version selector
    const { data: pv } = await supabase
      .from('post_versions')
      .select('name')
      .eq('post_id', post.id)
      .order('version_number', { ascending: true })
    const currentVersionName = `v${post.version || 1}`
    if (pv) {
      const allVersions = [...pv.map(v => ({ name: v.name }))]
      if (!allVersions.some(v => v.name === currentVersionName)) {
        allVersions.push({ name: currentVersionName })
      }
      setModalVersions(allVersions)
    } else {
      setModalVersions([{ name: currentVersionName }])
    }

    const cards = cardsByPost[post.id] || []
    if (cards.length === 0) {
      // No feedback cards — open PostViewModal for post viewing
      setViewPostModal(post)
      setModalPostData(null)
      return
    }

    try {
      const { data: fullCard } = await supabase
        .from('feedback_cards')
        .select('*')
        .eq('id', cards[0].id)
        .single()
      if (!fullCard) { setModalCard(null); return }

      const [attachmentsRes, checklistRes, commentsRes] = await Promise.all([
        supabase.from('feedback_card_attachments').select('*').eq('card_id', fullCard.id),
        supabase.from('feedback_card_checklist_items').select('*').eq('card_id', fullCard.id),
        supabase.from('feedback_card_comments').select('*').eq('card_id', fullCard.id).order('created_at'),
      ])

      setModalCard({
        ...(fullCard as FeedbackCard),
        attachments: attachmentsRes.data || [],
        checklist: checklistRes.data || [],
        comments: commentsRes.data || [],
      })
    } catch {
      setModalCard(null)
    }
  }

  const handleCloseModal = () => {
    setModalCard(null)
    setModalPostData(null)
  }

  const modalActions = {
    createCard: async (postId: string, data: {
      title: string
      description: string
      deadline: string
      requested_at: string
      priority: 'normal' | 'urgente'
      status: FeedbackCardStatus
      version_name?: string
      tags?: Tag[]
    }) => {
      const { deadline, requested_at, version_name, tags, ...rest } = data
      const payload = {
        post_id: postId || null,
        deadline: new Date(deadline).toISOString(),
        requested_at: new Date(requested_at).toISOString(),
        version_name: version_name || null,
        title: sanitize(rest.title),
        description: sanitize(rest.description),
        priority: rest.priority,
        status: rest.status,
        created_by: 'Gestor',
        tags: tags || [],
        user_id: user?.id || null,
      }

      // Try with user_id first (needed for RLS on migration 015+)
      let result = await supabase
        .from('feedback_cards')
        .insert([payload])
        .select()
        .single()

      // Fallback: if user_id column doesn't exist, retry without it
      if (result.error && result.error.message?.includes('user_id')) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { user_id, ...payloadWithoutUser } = payload
        result = await supabase
          .from('feedback_cards')
          .insert([payloadWithoutUser])
          .select()
          .single()
      }

      const { data: newCard } = result
      if (newCard) {
        if (postId) {
          try {
            await supabase.from('posts').update({ is_feedback: true, user_id: user?.id }).eq('id', postId)
          } catch { /* tag é cosmética */ }
          await supabase.from('posts').update({ status: 'alteracao', user_id: user?.id }).eq('id', postId)
        }
        const card: FeedbackCardFull = {
          ...newCard,
          attachments: [],
          checklist: [],
          comments: [],
        }
        setModalCard(card)
        fetchData()
        return card
      }
      return null
    },
    updateCard: async (cardId: string, data: Partial<{
      title: string
      description: string
      deadline: string
      priority: 'normal' | 'urgente'
      status: FeedbackCardStatus
    }>) => {
      const payload: Record<string, unknown> = { ...data }
      if (typeof payload.title === 'string') payload.title = sanitize(payload.title)
      if (typeof payload.description === 'string') payload.description = sanitize(payload.description)
      // Validar status para feedback_cards (só aceita: aguardando, alteracao, aprovado)
      if (payload.status && !['aguardando', 'alteracao', 'aprovado'].includes(payload.status as string)) {
        payload.status = 'aprovado'
      }
      if (data.status === 'aprovado') payload.completed_at = new Date().toISOString()
      payload.user_id = user?.id
      const { data: updated, error } = await supabase.from('feedback_cards').update(payload).eq('id', cardId).select().single()
      if (error) {
        console.error('[updateCard] Erro:', error)
        toast.error('Erro ao atualizar card: ' + error.message)
        return
      }
      if (modalCard && updated) {
        setModalCard({ ...modalCard, ...updated })
        if (data.status === 'aprovado' && updated.post_id) {
          const { error: postError } = await supabase.from('posts').update({ status: 'aprovado', user_id: user?.id }).eq('id', updated.post_id)
          if (postError) {
            console.error('[updateCard] Erro ao atualizar post:', postError)
            toast.error('Erro ao aprovar post: ' + postError.message)
          }
        }
      }
      fetchData()
    },
    addAttachment: async (cardId: string, type: 'image' | 'link', url: string, name?: string) => {
      const { data } = await supabase.from('feedback_card_attachments').insert([{ card_id: cardId, type, url, name }]).select().single()
      if (modalCard && data) setModalCard({ ...modalCard, attachments: [...modalCard.attachments, data] })
    },
    removeAttachment: async (attachmentId: string) => {
      await supabase.from('feedback_card_attachments').delete().eq('id', attachmentId)
      if (modalCard) setModalCard({ ...modalCard, attachments: modalCard.attachments.filter((a: FeedbackCardAttachment) => a.id !== attachmentId) })
    },
    addChecklistItem: async (cardId: string, text: string) => {
      const { data } = await supabase.from('feedback_card_checklist_items').insert([{ card_id: cardId, text }]).select().single()
      if (modalCard && data) setModalCard({ ...modalCard, checklist: [...modalCard.checklist, data] })
    },
    toggleChecklistItem: async (itemId: string, checked: boolean) => {
      await supabase.from('feedback_card_checklist_items').update({ checked }).eq('id', itemId)
      if (modalCard) setModalCard({
        ...modalCard,
        checklist: modalCard.checklist.map((i: FeedbackCardChecklistItem) => i.id === itemId ? { ...i, checked } : i),
      })
    },
    removeChecklistItem: async (itemId: string) => {
      await supabase.from('feedback_card_checklist_items').delete().eq('id', itemId)
      if (modalCard) setModalCard({ ...modalCard, checklist: modalCard.checklist.filter((i: FeedbackCardChecklistItem) => i.id !== itemId) })
    },
    addComment: async (cardId: string, author_role: string, author_name: string, message: string) => {
      const { data } = await supabase.from('feedback_card_comments').insert([{ card_id: cardId, author_role, author_name, message }]).select().single()
      if (modalCard && data) setModalCard({ ...modalCard, comments: [...modalCard.comments, data] })
    },
  }

  return (
    <div className="flex flex-col h-full gap-4 p-4 md:p-8 max-w-[1600px] mx-auto pb-24 md:pb-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListTodo size={24} className="text-primary" /> Tarefas
          </h1>
          <div className="bg-secondary p-0.5 flex gap-0.5">
            <button onClick={() => setViewMode('board')} className={cn("px-3 py-1.5 text-xs font-medium transition-all", viewMode === 'board' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>Board</button>
            <button onClick={() => setViewMode('list')} className={cn("px-3 py-1.5 text-xs font-medium transition-all", viewMode === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>Lista</button>
            <button onClick={() => setViewMode('timeline')} className={cn("px-3 py-1.5 text-xs font-medium transition-all", viewMode === 'timeline' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>Timeline</button>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:flex-initial">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Buscar cliente ou post..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-56 pl-9 pr-3 py-2 bg-card border border-border rounded-xl text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "p-2 border rounded-xl transition-colors",
              hasActiveFilters ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <Filter size={18} />
          </button>
          <button
            onClick={toggleBulkMode}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 border rounded-xl text-sm font-medium transition-colors",
              bulkMode ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"
            )}
            title={bulkMode ? 'Sair do modo de seleção' : 'Selecionar posts em lote'}
          >
            <ListChecks size={16} /> <span className="hidden md:inline">{bulkMode ? 'Sair' : 'Selecionar'}</span>
          </button>
          <button
            onClick={() => { fetchArchive(); setShowArchive(true) }}
            className="flex items-center gap-1.5 px-3 py-2 border rounded-xl text-sm font-medium border-border text-muted-foreground hover:text-foreground transition-colors"
            title="Cards arquivados"
          >
            <Archive size={16} /> <span className="hidden md:inline">Arquivo</span>
          </button>
          <button
            onClick={() => setModalPostData({ id: '', clientName: '', clientHandle: '', type: '', caption: '', scheduledAt: '', files: [], isStandalone: true })}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
          >
            <Plus size={16} /> <span className="hidden md:inline">Nova tarefa</span>
          </button>
        </div>
      </header>

      {/* Barra de ações em lote */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl">
          <span className="text-sm font-semibold text-primary">{selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-1.5">
            <MoveRight size={14} className="text-muted-foreground" />
            <Select value={bulkTarget} onValueChange={setBulkTarget}>
              <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="Mover para..." /></SelectTrigger>
              <SelectContent>
                {colConfig.filter(c => c.id !== undefined).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => bulkMove(bulkTarget)}
              disabled={!bulkTarget}
              className="px-2.5 py-1.5 text-xs font-bold text-primary-foreground bg-primary rounded-lg disabled:opacity-40"
            >
              Mover
            </button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ConfirmModal
              trigger={
                <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10">
                  <Trash2 size={13} /> Excluir
                </button>
              }
              title={`Excluir ${selectedIds.size} post(s)?`}
              description="Os posts selecionados, suas mídias no Drive/Storage e todos os feedbacks serão apagados permanentemente. Essa ação não pode ser desfeita."
              confirmLabel="Excluir todos"
              confirmVariant="destructive"
              onConfirm={bulkDelete}
            />
            <button
              onClick={clearSelection}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Filtros avançados */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-card border border-border rounded-xl">
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todos os clientes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os clientes</SelectItem>
              {uniqueClients.map(name => (<SelectItem key={name} value={name}>{name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Todos os tipos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os tipos</SelectItem>
              <SelectItem value="reels">Reels</SelectItem>
              <SelectItem value="carrossel">Carrossel</SelectItem>
              <SelectItem value="foto">Foto</SelectItem>
              <SelectItem value="stories">Stories</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Todos os meses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os meses</SelectItem>
              {availableMonths.map(m => (
                <SelectItem key={m} value={m}>{format(new Date(m + '-01'), 'MMMM yyyy', { locale: ptBR })}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterResponsible} onValueChange={setFilterResponsible}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todos os responsáveis" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os responsáveis</SelectItem>
              {responsibleOptions.map(r => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={filterTag} onValueChange={setFilterTag}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Todas as tags" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as tags</SelectItem>
              {uniqueTagNames.map(tag => (
                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {([['todos', 'Todos'], ['posts', 'Posts'], ['feedbacks', 'Feedbacks']] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilterKind(value)}
                className={cn(
                  "px-3 py-2 text-sm font-medium transition-colors",
                  filterKind === value ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
              <X size={14} /> Limpar
            </button>
          )}
          <button
            onClick={() => setShowCurrentWeek(!showCurrentWeek)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-colors",
              showCurrentWeek ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <CalendarDays size={15} />
            Esta semana
          </button>
        </div>
      )}

      {/* Board */}
      {viewMode === 'board' && (
      <DndContext sensors={dndSensors} collisionDetection={closestCorners} onDragStart={(e) => {
        const post = allPosts.find(p => p.id === e.active.id)
        if (post) setActiveDragCard(post)
      }} onDragEnd={handleDndEnd}>
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex flex-col md:flex-row gap-4 h-full min-w-0">
            {colConfig.map((col) => {
              const filtered = filterPosts(columns[col.id] || [])
              const isEmpty = filtered.length === 0

              return (
                <KanbanColumnDrop
                  key={col.id}
                  colId={col.id}
                  colCfg={col}
                  isEmpty={isEmpty}
                  filteredCount={filtered.length}
                  isEditing={editingColumnId === col.id}
                  editValue={editTitle}
                  selectedCount={filtered.filter(p => selectedIds.has(p.id)).length}
                  showSelection={bulkMode}
                  onToggleSelectAll={() => toggleSelectAll(filtered)}
                  onStartEdit={() => { setEditingColumnId(col.id); setEditTitle(col.title) }}
                  onEditChange={(v) => setEditTitle(v)}
                  onSaveEdit={() => {
                    if (editTitle.trim()) {
                      const updated = colConfig.map(c => c.id === col.id ? { ...c, title: editTitle.trim() } : c)
                      setColConfig(updated)
                      saveColumnConfig(updated)
                    }
                    setEditingColumnId(null)
                  }}
                  onCancelEdit={() => setEditingColumnId(null)}
                  onDelete={() => {
                    const updated = colConfig.filter(c => c.id !== col.id)
                    setColConfig(updated)
                    saveColumnConfig(updated)
                  }}
                >
                  {loading ? (
                    <div className="flex flex-col gap-[10px]">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-28 rounded-xl" />
                      ))}
                    </div>
                  ) : (
                    filtered.map((post) => {
                      const cards = cardsByPost[post.id] || []
                      const latestCard = cards[0]
                      return (
                        <KanbanDraggableCard
                          key={post.id}
                          post={post}
                          latestCard={latestCard}
                          showSelection={bulkMode}
                          selected={selectedIds.has(post.id)}
                          onToggleSelect={() => toggleSelect(post.id)}
                          onClick={() => handleOpenCard(post)}
                        />
                      )
                    })
                  )}
                </KanbanColumnDrop>
              )
            })}
            {/* Add column button */}
            <div className="flex flex-col justify-center shrink-0 self-center">
              <button
                onClick={() => {
                  const usedIds = new Set(colConfig.map(c => c.id))
                  let idx = 1
                  let newId = ''
                  while (!newId || usedIds.has(newId)) {
                    newId = `coluna_${idx}`
                    idx++
                  }
                  const colorIdx = (colConfig.length - 3) % COLORS_CYCLE.length
                  const newCol: ColumnConfig = {
                    id: newId,
                    title: 'Nova coluna',
                    ...COLORS_CYCLE[colorIdx >= 0 ? colorIdx : 0],
                  }
                  const updated = [...colConfig, newCol]
                  setColConfig(updated)
                  saveColumnConfig(updated)
                  setTimeout(() => {
                    setEditingColumnId(newCol.id)
                    setEditTitle(newCol.title)
                  }, 50)
                }}
                className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-2xl text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
              >
                <Plus size={18} />
                <span className="hidden md:inline">Adicionar coluna</span>
              </button>
            </div>
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {activeDragCard ? (
            <KanbanCardOverlay post={activeDragCard} draggingCount={selectedIds.has(activeDragCard.id) ? selectedIds.size : 1} />
          ) : null}
        </DragOverlay>
      </DndContext>
      )}

      {/* List View — estilo kibo-ui List: agrupado por status */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {colConfig.map(col => {
            const posts = filterPosts(columns[col.id] || [])
            if (posts.length === 0 && !showFilters) return null
            return (
              <div key={col.id} className="border border-border overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-secondary/50 border-b border-border">
                  <div className={cn("w-2.5 h-2.5 shrink-0", col.color)} />
                  <h3 className="text-sm font-semibold">{col.title}</h3>
                  <span className="ml-auto text-xs text-muted-foreground bg-background px-2 py-0.5">{posts.length}</span>
                </div>
                <div className="divide-y divide-border">
                  {posts.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()).map(post => (
                    <div key={post.id} onClick={() => handleOpenCard(post)} className="flex items-center gap-4 px-4 py-3 hover:bg-secondary/30 cursor-pointer transition-colors">
                      <div className="w-10 h-10 shrink-0 bg-muted overflow-hidden flex items-center justify-center">
                        {(() => {
                          const { url: thumbUrl, poster: thumbPoster } = resolveThumbMedia(post.media_urls)
                          return thumbUrl ? (
                            <MediaPreview url={thumbUrl} poster={thumbPoster} thumbnail className="w-full h-full object-cover" />
                          ) : <span className="text-xs text-muted-foreground/40">{post.type}</span>
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{post.caption || '(sem legenda)'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <span className="w-2 h-2 shrink-0" style={{ backgroundColor: post.clientColor }} />
                            {post.clientName}
                          </span>
                          <span className="text-[10px] text-muted-foreground capitalize">{post.type}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-mono text-muted-foreground">{format(new Date(post.scheduled_at), 'dd/MM HH:mm')}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{(cardsByPost[post.id] || []).length} cards</p>
                      </div>
                    </div>
                  ))}
                  {posts.length === 0 && (
                    <div className="px-4 py-6 text-center text-xs text-muted-foreground">Nenhum item</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Timeline View — estilo Gantt simplificado */}
      {viewMode === 'timeline' && (
        <div className="border border-border overflow-hidden">
          <div className="overflow-x-auto">
            {(() => {
              const sorted = allPosts.filter(p => !p.archived_at).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
              if (sorted.length === 0) return <div className="p-8 text-center text-sm text-muted-foreground">Nenhum post para exibir</div>

              const minDate = new Date(sorted[0].scheduled_at)
              const maxDate = new Date(sorted[sorted.length - 1].scheduled_at)
              const totalDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / 86400000) + 1)
              const dayWidth = Math.max(40, 800 / totalDays)

              return (
                <div className="min-w-max">
                  {/* Header com dias */}
                  <div className="flex border-b border-border sticky top-0 bg-card z-10">
                    <div className="w-48 shrink-0 px-4 py-2 text-xs font-medium text-muted-foreground border-r border-border">Post</div>
                    <div className="flex-1 flex">
                      {Array.from({ length: Math.min(totalDays, 60) }, (_, i) => {
                        const d = new Date(minDate.getTime() + i * 86400000)
                        return (
                          <div key={i} className="text-center py-2 border-r border-border/50" style={{ minWidth: dayWidth }}>
                            <span className="text-[9px] text-muted-foreground">{format(d, 'dd/MM')}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  {/* Rows */}
                  {sorted.map(post => {
                    const postDate = new Date(post.scheduled_at)
                    const offset = Math.max(0, Math.ceil((postDate.getTime() - minDate.getTime()) / 86400000))
                    const statusColors: Record<string, string> = {
                      publicado: 'bg-[#84A59D]', aprovado: 'bg-[#84A59D]', aguardando: 'bg-[#F6BD60]',
                      alteracao: 'bg-[#F28482]', rascunho: 'bg-[#8a8580]',
                    }
                    return (
                      <div key={post.id} className="flex border-b border-border/50 hover:bg-secondary/20 cursor-pointer" onClick={() => handleOpenCard(post)}>
                        <div className="w-48 shrink-0 px-4 py-2 border-r border-border flex items-center gap-2">
                          <span className="w-2 h-2 shrink-0" style={{ backgroundColor: post.clientColor }} />
                          <span className="text-xs font-medium truncate">{post.clientName}</span>
                          <span className="text-[10px] text-muted-foreground capitalize ml-auto">{post.type}</span>
                        </div>
                        <div className="flex-1 relative py-2">
                          <div
                            className={cn("absolute top-1/2 -translate-y-1/2 h-5 rounded-sm flex items-center px-2 text-[9px] font-medium text-white truncate", statusColors[post.status] || 'bg-muted-foreground')}
                            style={{ left: offset * dayWidth, minWidth: dayWidth * 0.8 }}
                          >
                            {post.caption?.split(' ').slice(0, 3).join(' ') || post.clientName}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* FeedbackCardModal */}
      {modalPostData && (
        <FeedbackCardModal
          card={modalCard}
          postId={modalPostData.id}
          postFiles={modalPostData.files}
          postCaption={modalPostData.caption}
          postType={modalPostData.type}
          clientName={modalPostData.clientName}
          clientHandle={modalPostData.clientHandle}
          scheduledAt={modalPostData.scheduledAt}
          open={!!modalPostData}
          onClose={handleCloseModal}
          actions={modalActions}
          versions={modalVersions}
          statusLabels={Object.fromEntries(colConfig.map(c => [c.id, c.title]))}
          isStandalone={modalPostData.isStandalone}
          defaultCreating={modalPostData.isStandalone}
          onEditPost={() => {
            const id = modalPostData.id
            handleCloseModal()
            navigate(`/posts/novo?id=${id}`)
          }}
        />
      )}

      {/* PostViewModal */}
      <PostViewModal
        open={!!viewPostModal}
        onClose={() => setViewPostModal(null)}
        post={viewPostModal ? {
          id: viewPostModal.id,
          clientName: viewPostModal.clientName,
          clientHandle: viewPostModal.clientHandle,
          clientColor: viewPostModal.clientColor,
          type: viewPostModal.type,
          caption: viewPostModal.caption,
          scheduled_at: viewPostModal.scheduled_at,
          status: viewPostModal.status,
          media_urls: viewPostModal.media_urls,
          platform: viewPostModal.platform,
        } : null}
      />

      {/* Modal Arquivo */}
      <Dialog open={showArchive} onOpenChange={setShowArchive}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive size={18} /> Arquivo de cards
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {archivedPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum card arquivado.</p>
            ) : (
              archivedPosts.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 border border-border rounded-xl">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: p.clientColor }}
                  >
                    {p.clientName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate">{p.clientName}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase bg-secondary/60 text-muted-foreground capitalize">{p.type}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase bg-muted text-muted-foreground">{p.status}</span>
                    </div>
                    {p.caption && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{p.caption}</p>}
                    {p.scheduled_at && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Publicação: {format(new Date(p.scheduled_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => navigate(`/posts/${p.id}`)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      title="Abrir post"
                    >
                      <ExternalLink size={14} />
                    </button>
                    <button
                      onClick={() => restorePost(p.id)}
                      className="px-2.5 py-1.5 text-[11px] font-bold text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
                    >
                      Restaurar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ─── dnd-kit helper components ─── */

function KanbanColumnDrop({ colId, colCfg, isEmpty, filteredCount, isEditing, editValue, selectedCount, showSelection, onToggleSelectAll, onStartEdit, onEditChange, onSaveEdit, onCancelEdit, onDelete, children }: {
  colId: string; colCfg: ColumnConfig; isEmpty: boolean; filteredCount: number
  isEditing: boolean; editValue: string; selectedCount: number; showSelection: boolean
  onToggleSelectAll: () => void
  onStartEdit: () => void; onEditChange: (v: string) => void; onSaveEdit: () => void; onCancelEdit: () => void; onDelete: () => void
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: colId })
  const allSelected = filteredCount > 0 && selectedCount === filteredCount
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col shrink-0 rounded-2xl md:h-full max-h-full transition-all bg-secondary/70",
        "self-center w-max max-w-full md:self-stretch md:w-72 max-md:w-full",
        isOver && "ring-2 ring-primary/30"
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          {showSelection && (
            <button
              onClick={onToggleSelectAll}
              disabled={filteredCount === 0}
              className={cn(
                "shrink-0 transition-colors",
                filteredCount === 0 ? 'text-muted-foreground/30 cursor-default' : 'text-muted-foreground hover:text-primary'
              )}
              title={allSelected ? 'Desmarcar todos' : 'Selecionar todos os posts desta coluna'}
            >
              {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
            </button>
          )}
          {/* Nome da coluna - editável inline */}
          {isEditing ? (
            <input
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveEdit()
                if (e.key === 'Escape') onCancelEdit()
              }}
              onBlur={onSaveEdit}
              className="w-32 text-[13.5px] font-semibold text-foreground bg-transparent border-b border-primary outline-none px-0.5"
              autoFocus
            />
          ) : (
            <h3
              className="text-[13.5px] font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
              onClick={onStartEdit}
              title="Clique para editar"
            >
              {colCfg.title}
            </h3>
          )}
          <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-secondary text-[10px] font-medium text-muted-foreground px-1">
            {filteredCount}
          </span>
        </div>
        {!isEditing && (
          <div className="flex items-center gap-0.5">
            <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
      
      {/* Cards Container - sempre visível */}
      <div className="flex flex-col gap-[10px] p-1.5 overflow-x-auto snap-x stagger md:flex-col md:overflow-y-auto md:min-h-[200px] md:flex-1">
        {isEmpty && (
          <div className="p-6 text-center text-xs text-muted-foreground border-2 border-dashed border-border rounded-xl">
            Nenhum post
          </div>
        )}
        {children}
      </div>

      {/* Botão Adicionar */}
      <div className="px-2.5 pb-2.5 shrink-0">
        <button className="w-full rounded-lg py-2 text-center text-[13px] font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors border border-dashed border-border">
          + Adicionar tarefa
        </button>
      </div>
    </div>
  )
}

/**
 * Atrasos (D23): há dois tipos — atraso de publicação (o post deveria já ter
 * saído) e atraso de alteração (o prazo do card de feedback passou sem aprovação).
 * Um post só é considerado atrasado se não foi publicado a tempo OU não foi
 * colocado como aprovado a tempo. Uma publicação agendada para hoje ainda NÃO
 * está atrasada (só a partir do dia seguinte).
 */
function getCardDelay(post: PostItem, latestCard?: CardSummary): { type: 'publicacao' | 'prazo'; date: Date } | null {
  const now = new Date()
  const startToday = startOfDay(now)
  const published = post.status === 'publicado'
  const approved = post.status === 'aprovado'

  // Atraso de publicação: agendado para antes de hoje e ainda não publicado.
  if (!published && post.scheduled_at) {
    const scheduled = new Date(post.scheduled_at)
    if (!Number.isNaN(scheduled.getTime()) && scheduled < startToday) {
      return { type: 'publicacao', date: scheduled }
    }
  }

  // Atraso de alteração: prazo do card de feedback venceu sem aprovação
  // (aprovado marca o card como concluído — não conta como atraso).
  if (!approved && latestCard?.deadline) {
    const deadline = new Date(latestCard.deadline)
    if (!Number.isNaN(deadline.getTime()) && deadline < now) {
      return { type: 'prazo', date: deadline }
    }
  }
  return null
}

function KanbanDraggableCard({ post, latestCard, showSelection, selected, onToggleSelect, onClick }: { post: PostItem; latestCard: CardSummary | undefined; showSelection: boolean; selected: boolean; onToggleSelect: () => void; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: post.id })
  const delay = getCardDelay(post, latestCard)
  const today = isTodayScheduled(post.scheduled_at)
  const { url: thumbUrl, poster: thumbPoster } = resolveThumbMedia(post.media_urls)
  const captionPreview = post.caption ? post.caption.split(' ').slice(0, 6).join(' ') + (post.caption.split(' ').length > 6 ? '...' : '') : ''
  const createdDate = post.created_at ? format(new Date(post.created_at), 'dd/MM') : ''
  const deadlineStr = latestCard?.deadline ? format(new Date(latestCard.deadline), 'dd/MM') : ''

  return (
    <div
      ref={setNodeRef}
      style={isDragging ? { opacity: 0.3 } : undefined}
      {...listeners}
      {...attributes}
      onClick={() => { if (!isDragging) onClick() }}
      className={cn(
        "rounded-xl border border-transparent bg-card p-2 cursor-grab active:cursor-grabbing shrink-0 snap-start shadow-card",
        "hover:shadow-md transition-all duration-200",
        "w-[calc((100%_-_0.5rem)/1.25)] md:w-auto flex flex-col gap-1",
        isDragging && "opacity-30",
        selected && "ring-2 ring-primary/40"
      )}
    >
      {/* Checkbox (selection mode) */}
      {showSelection && (
        <div className="flex justify-end">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect() }}
            className={cn(
              "transition-colors",
              selected ? 'text-primary' : 'text-muted-foreground/40 hover:text-primary'
            )}
          >
            {selected ? <CheckSquare size={14} /> : <Square size={14} />}
          </button>
        </div>
      )}

      {/* Media Preview */}
      {thumbUrl && (
        <div className="w-full h-24 rounded-lg overflow-hidden bg-secondary shrink-0">
          <MediaPreview url={thumbUrl} poster={thumbPoster} thumbnail className="w-full h-full object-cover" />
        </div>
      )}

      {/* Task Name (if feedback card) */}
      {latestCard?.title && (
        <p className="text-[13px] font-semibold text-foreground leading-snug truncate">
          {latestCard.title}
        </p>
      )}

      {/* Client Name + Deadline */}
      <div className="flex items-center gap-1.5 text-[12px]">
        <span className="font-medium text-foreground truncate">{post.clientName}</span>
        {deadlineStr && (
          <span className="text-muted-foreground shrink-0">[{deadlineStr}]</span>
        )}
      </div>

      {/* Content Preview */}
      {captionPreview && (
        <p className="text-[11px] text-muted-foreground leading-tight line-clamp-2">
          {captionPreview}
        </p>
      )}

      {/* Status · Date · Type */}
      <div className="flex items-center gap-1.5 text-[10.5px] mt-0.5">
        <span className={cn(
          "px-1.5 py-0.5 rounded-full font-medium",
          post.status === 'aprovado' && "bg-success/10 text-success",
          post.status === 'publicado' && "bg-primary/10 text-primary",
          post.status === 'alteracao' && "bg-destructive/10 text-destructive",
          post.status === 'aguardando' && "bg-warning/10 text-warning",
        )}>
          {post.status}
        </span>
        {createdDate && (
          <span className="text-muted-foreground">· {createdDate}</span>
        )}
        <span className="text-muted-foreground">· {post.type}</span>
      </div>

      {/* Delay/Today badges */}
      {(today || delay) && (
        <div className="flex justify-end mt-0.5">
          {today && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
              <CalendarDays size={10} /> Hoje
            </span>
          )}
          {delay && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-500">
              <AlertTriangle size={10} />
              {delay.type === 'publicacao' ? 'Atrasado' : 'Prazo'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function KanbanCardOverlay({ post, draggingCount }: { post: PostItem; draggingCount: number }) {
  const { url: thumbUrl, poster: thumbPoster } = resolveThumbMedia(post.media_urls)
  const captionPreview = post.caption ? post.caption.split(' ').slice(0, 6).join(' ') + (post.caption.split(' ').length > 6 ? '...' : '') : ''
  const createdDate = post.created_at ? format(new Date(post.created_at), 'dd/MM') : ''

  return (
    <div className="rounded-xl border border-primary/30 bg-card p-2 shadow-2xl opacity-90 flex flex-col gap-1 pointer-events-none w-[240px]">
      {thumbUrl && (
        <div className="w-full h-20 rounded-lg overflow-hidden bg-secondary shrink-0">
          <MediaPreview url={thumbUrl} poster={thumbPoster} thumbnail className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex items-center gap-1.5 text-[12px]">
        <span className="font-medium text-foreground truncate">{post.clientName}</span>
        {createdDate && <span className="text-muted-foreground shrink-0">· {createdDate}</span>}
      </div>
      {captionPreview && (
        <p className="text-[11px] text-muted-foreground leading-tight line-clamp-2">
          {captionPreview}
        </p>
      )}
      <div className="flex items-center gap-1.5 text-[10.5px]">
        <span className="px-1.5 py-0.5 rounded-full font-medium bg-secondary text-muted-foreground">{post.status}</span>
        <span className="text-muted-foreground">· {post.type}</span>
      </div>
      {draggingCount > 1 && (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary self-start">
          +{draggingCount - 1} items
        </span>
      )}
    </div>
  )
}
