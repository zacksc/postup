import { useState, useMemo } from 'react'
import {
  startOfMonth,   // primeiro dia do mês
  endOfMonth,     // último dia do mês
  startOfWeek,    // primeiro dia da semana (domingo)
  endOfWeek,      // último dia da semana (sábado)
  eachDayOfInterval, // array com todos os dias de um intervalo
  isSameDay,      // compara se dois Dates são o mesmo dia
  isSameMonth,    // compara se dois Dates são o mesmo mês
  isToday,        // verifica se um Date é hoje
  addMonths,      // adiciona meses a um Date
  subMonths,      // subtrai meses de um Date
  addWeeks,       // adiciona semanas
  subWeeks,       // subtrai semanas
  format,         // formata um Date como string
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Post } from '@/types/post'

// CalendarView — os dois modos de visualização
type CalendarView = 'month' | 'week'

// useCalendar — recebe os posts e gerencia todo o estado do calendário
// posts vem de fora porque futuramente virão do Supabase
export function useCalendar(posts: Post[]) {

  // Data de referência — define qual mês ou semana está sendo exibido
  // Começa com o mês atual
  const [referenceDate, setReferenceDate] = useState(new Date())

  // Dia selecionado — quando o usuário clica em um dia
  // null significa que nenhum dia está selecionado
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  // Visualização atual — mensal ou semanal
  const [view, setView] = useState<CalendarView>('month')

  // Clientes filtrados — Set de clientIds ativos
  // Set é mais eficiente que array para verificar se um item existe
  // Começa vazio = todos os clientes visíveis
  const [activeClientIds, setActiveClientIds] = useState<Set<string>>(
    new Set()
  )

  // ── NAVEGAÇÃO ──────────────────────────────────────────

  // Avança um mês ou uma semana dependendo da view
  function goForward() {
    setReferenceDate(prev => {
        const next = view === 'month' ? addMonths(prev, 1) : addWeeks(prev, 1);
        return next;
    });
    // Não limpamos o dia selecionado para manter o contexto se estiver no mesmo período
  }

  // Volta um mês ou uma semana
  function goBack() {
    setReferenceDate(prev => {
        const next = view === 'month' ? subMonths(prev, 1) : subWeeks(prev, 1);
        return next;
    });
  }

  // Volta para hoje
  function goToToday() {
    setReferenceDate(new Date())
    setSelectedDay(new Date())
  }

  // ── FILTRO DE CLIENTES ──────────────────────────────────

  function toggleClient(clientId: string) {
    setActiveClientIds(prev => {
      // Cria um novo Set a partir do anterior
      // No React, estado deve ser imutável — nunca modifique o Set diretamente
      const next = new Set(prev)
      if (next.has(clientId)) {
        next.delete(clientId)
      } else {
        next.add(clientId)
      }
      return next
    })
  }

  // ── POSTS FILTRADOS ────────────────────────────────────

  // useMemo recalcula só quando posts ou activeClientIds mudam
  // Sem useMemo, filtraria a cada re-render — ineficiente
  const filteredPosts = useMemo(() => {
    // Se nenhum filtro ativo, retorna todos
    if (activeClientIds.size === 0) return posts
    // Filtra só os posts dos clientes ativos
    return posts.filter(p => activeClientIds.has(p.clientId))
  }, [posts, activeClientIds])

  // ── DIAS DO MÊS (para MonthView) ───────────────────────

  // useMemo — recalcula só quando referenceDate muda
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(referenceDate)
    const monthEnd = endOfMonth(referenceDate)

    // A grade do calendário começa no domingo antes do primeiro dia
    // e termina no sábado depois do último dia
    // Isso preenche as células vazias no início e fim do mês
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

    // eachDayOfInterval retorna um array com cada dia do intervalo
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [referenceDate])

  // ── DIAS DA SEMANA (para WeekView) ─────────────────────

  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(referenceDate, { weekStartsOn: 0 })
    const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: weekStart, end: weekEnd })
  }, [referenceDate])

  // ── HELPERS ─────────────────────────────────────────────

  // Retorna os posts de um dia específico
  function getPostsForDay(day: Date): Post[] {
    return filteredPosts.filter(p => isSameDay(p.scheduledAt, day))
  }

  // Retorna os posts do dia selecionado
  // Usado no painel lateral contextual
  const selectedDayPosts = useMemo(() => {
    if (!selectedDay) return []
    return filteredPosts.filter(p => isSameDay(p.scheduledAt, selectedDay))
  }, [selectedDay, filteredPosts])

  // Label do período atual formatado
  // Mês: "Janeiro 2026" | Semana: "19 – 25 de jan. 2026"
  const periodLabel = useMemo(() => {
    if (view === 'month') {
      // Capitaliza a primeira letra do nome do mês
      return format(referenceDate, "MMMM yyyy", { locale: ptBR })
        .replace(/^\w/, c => c.toUpperCase())
    }
    const start = startOfWeek(referenceDate, { weekStartsOn: 0 })
    const end = endOfWeek(referenceDate, { weekStartsOn: 0 })
    return `${format(start, "d")} – ${format(end, "d 'de' MMM. yyyy", { locale: ptBR })}`
  }, [referenceDate, view])

  // Clientes únicos extraídos dos posts para os filtros
  const clients = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>()
    posts.forEach(p => {
      if (!map.has(p.clientId)) {
        map.set(p.clientId, {
          id: p.clientId,
          name: p.clientName,
          color: p.clientColor,
        })
      }
    })
    return Array.from(map.values())
  }, [posts])

  return {
    // Estado
    view,
    setView,
    selectedDay,
    setSelectedDay,
    referenceDate,
    activeClientIds,

    // Navegação
    goForward,
    goBack,
    goToToday,

    // Filtro
    toggleClient,
    clients,

    // Dados calculados
    monthDays,
    weekDays,
    filteredPosts,
    selectedDayPosts,
    periodLabel,

    // Helpers
    getPostsForDay,
    isSameDay,
    isSameMonth,
    isToday,
  }
}