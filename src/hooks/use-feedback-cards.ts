import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeRealtime } from '../lib/realtime'
import { isValidUuid } from '../lib/utils'
import { useAuth } from './use-auth'
import type {
  FeedbackCard,
  FeedbackCardAttachment,
  FeedbackCardChecklistItem,
  FeedbackCardComment,
  FeedbackCardFull,
  FeedbackCardPriority,
  FeedbackCardStatus,
} from '../types/feedback'

export function useFeedbackCards(postId: string) {
  const [cards, setCards] = useState<FeedbackCardFull[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  const fetchCards = useCallback(async () => {
    if (!postId) return
    try {
      const { data: cardData, error: cardError } = await supabase
        .from('feedback_cards')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: false })

      if (cardError) throw cardError

      const now = new Date()
      const overdueCards = (cardData || []).filter(
        (c: FeedbackCard) => new Date(c.deadline) < now && c.status !== 'aprovado' && c.priority !== 'urgente'
      )
      if (overdueCards.length > 0) {
        await Promise.all(
          overdueCards.map((c: FeedbackCard) =>
            supabase.from('feedback_cards').update({ priority: 'urgente', user_id: user?.id }).eq('id', c.id)
          )
        )
        const { data: refreshed } = await supabase
          .from('feedback_cards')
          .select('*')
          .eq('post_id', postId)
          .order('created_at', { ascending: false })
        if (refreshed) {
          cardData.splice(0, cardData.length, ...refreshed)
        }
      }

      const fullCards: FeedbackCardFull[] = await Promise.all(
        (cardData || []).map(async (card) => {
          const [attachments, checklist, comments] = await Promise.all([
            supabase.from('feedback_card_attachments').select('*').eq('card_id', card.id).order('created_at'),
            supabase.from('feedback_card_checklist_items').select('*').eq('card_id', card.id).order('created_at'),
            supabase.from('feedback_card_comments').select('*').eq('card_id', card.id).order('created_at'),
          ])

          return {
            ...(card as FeedbackCard),
            attachments: (attachments.data || []) as FeedbackCardAttachment[],
            checklist: (checklist.data || []) as FeedbackCardChecklistItem[],
            comments: (comments.data || []) as FeedbackCardComment[],
          }
        })
      )

      setCards(fullCards)
    } catch (err) {
      console.error('Erro ao carregar cards:', err)
    } finally {
      setLoading(false)
    }
  }, [postId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (!postId) return
    fetchCards()

    if (!isValidUuid(postId)) return

    const channel = subscribeRealtime(() =>
      supabase
        .channel(`feedback-cards-${postId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'feedback_cards', filter: `post_id=eq.${postId}` },
          () => { fetchCards() }
        )
        .subscribe()
    )

    return () => { if (channel) supabase.removeChannel(channel) }
  }, [postId, fetchCards])

  async function createCard(data: {
    title: string
    description: string
    deadline: string
    requested_at?: string
    version_name?: string
    priority?: FeedbackCardPriority
    created_by: string
    user_id?: string
  }) {
    const { data: newCard, error } = await supabase
      .from('feedback_cards')
      .insert([{
        post_id: postId,
        title: data.title,
        description: data.description,
        deadline: data.deadline,
        requested_at: data.requested_at || null,
        version_name: data.version_name || null,
        priority: data.priority || 'normal',
        status: 'aguardando' as FeedbackCardStatus,
        created_by: data.created_by,
        user_id: data.user_id || null,
      }])
      .select()
      .single()

    if (error) throw error
    const card = newCard as FeedbackCard

    // Tag de feedback: um post só vira feedback quando um card é solicitado.
    try {
      await supabase.from('posts').update({ is_feedback: true, user_id: user?.id }).eq('id', postId)
    } catch { /* não derruba a criação do card */ }

    setCards((prev) => [{
      ...card,
      attachments: [],
      checklist: [],
      comments: [],
    }, ...prev])

    return card
  }

  async function updateCard(cardId: string, data: Partial<{
    title: string
    description: string
    deadline: string
    priority: FeedbackCardPriority
    status: FeedbackCardStatus
  }>) {
    const payload: Partial<FeedbackCard> = { ...data, user_id: user?.id }
    // Validar status para feedback_cards (só aceita: aguardando, alteracao, aprovado)
    if (payload.status && !['aguardando', 'alteracao', 'aprovado'].includes(payload.status as string)) {
      payload.status = 'aprovado' as FeedbackCardStatus
    }
    if (data.status === 'aprovado') {
      payload.completed_at = new Date().toISOString()
    }

    const { data: updated, error } = await supabase
      .from('feedback_cards')
      .update(payload)
      .eq('id', cardId)
      .select()
      .single()

    if (error) throw error
    const updatedCard = updated as FeedbackCard

    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, ...updatedCard } : c
      )
    )

    return updatedCard
  }

  async function deleteCard(cardId: string) {
    const { error } = await supabase
      .from('feedback_cards')
      .delete()
      .eq('id', cardId)

    if (error) throw error
    setCards((prev) => prev.filter((c) => c.id !== cardId))
  }

  // --- Attachments ---

  async function addAttachment(cardId: string, type: 'image' | 'link', url: string, name?: string) {
    const { data, error } = await supabase
      .from('feedback_card_attachments')
      .insert([{ card_id: cardId, type, url, name: name || null }])
      .select()
      .single()

    if (error) throw error
    const attachment = data as FeedbackCardAttachment

    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, attachments: [...c.attachments, attachment] } : c
      )
    )

    return attachment
  }

  async function removeAttachment(attachmentId: string) {
    const { error } = await supabase
      .from('feedback_card_attachments')
      .delete()
      .eq('id', attachmentId)

    if (error) throw error

    setCards((prev) =>
      prev.map((c) => ({
        ...c,
        attachments: c.attachments.filter((a) => a.id !== attachmentId),
      }))
    )
  }

  // --- Checklist ---

  async function addChecklistItem(cardId: string, text: string) {
    const { data, error } = await supabase
      .from('feedback_card_checklist_items')
      .insert([{ card_id: cardId, text }])
      .select()
      .single()

    if (error) throw error
    const item = data as FeedbackCardChecklistItem

    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, checklist: [...c.checklist, item] } : c
      )
    )

    return item
  }

  async function toggleChecklistItem(itemId: string, checked: boolean) {
    const { error } = await supabase
      .from('feedback_card_checklist_items')
      .update({ checked })
      .eq('id', itemId)

    if (error) throw error

    setCards((prev) =>
      prev.map((c) => ({
        ...c,
        checklist: c.checklist.map((i) =>
          i.id === itemId ? { ...i, checked } : i
        ),
      }))
    )
  }

  async function removeChecklistItem(itemId: string) {
    const { error } = await supabase
      .from('feedback_card_checklist_items')
      .delete()
      .eq('id', itemId)

    if (error) throw error

    setCards((prev) =>
      prev.map((c) => ({
        ...c,
        checklist: c.checklist.filter((i) => i.id !== itemId),
      }))
    )
  }

  // --- Comments ---

  async function addComment(cardId: string, author_role: string, author_name: string, message: string) {
    const { data, error } = await supabase
      .from('feedback_card_comments')
      .insert([{ card_id: cardId, author_role, author_name, message }])
      .select()
      .single()

    if (error) throw error
    const comment = data as FeedbackCardComment

    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, comments: [...c.comments, comment] } : c
      )
    )

    return comment
  }

  return {
    cards,
    loading,
    fetchCards,
    createCard,
    updateCard,
    deleteCard,
    addAttachment,
    removeAttachment,
    addChecklistItem,
    toggleChecklistItem,
    removeChecklistItem,
    addComment,
  }
}
