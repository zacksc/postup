import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { subscribeRealtime } from '../lib/realtime';
import { isValidUuid, sanitize } from '../lib/utils';
import type { PostFeedback } from '../types/feedback';

export function useFeedbacks(postId: string, versionName?: string | null) {
  const [feedbacks, setFeedbacks] = useState<PostFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchFeedbacks = useCallback(async () => {
    if (!postId) return;
    try {
      let query = supabase
        .from('post_feedbacks')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (versionName && /^v\d+$/.test(versionName)) {
        query = query.or(`version_name.eq.${versionName},version_name.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setFeedbacks(data || []);
    } finally {
      setLoading(false);
    }
  }, [postId, versionName]);

  useEffect(() => {
    if (!postId) return;
    fetchFeedbacks();

    if (!isValidUuid(postId)) return;

    const channel = subscribeRealtime(() =>
      supabase
        .channel(`feedbacks-${postId}-${versionName || 'all'}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'post_feedbacks', filter: `post_id=eq.${postId}` },
          (payload) => {
            const fb = payload.new as PostFeedback;
            if (!versionName || !fb.version_name || fb.version_name === versionName) {
              setFeedbacks((prev) => [...prev, fb]);
            }
          }
        )
        .subscribe()
    );

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [postId, versionName, fetchFeedbacks]);

  async function send(message: string, role: 'gestor' | 'cliente', name: string) {
    if (!postId) return;
    setSending(true);
    try {
      const payload: Partial<PostFeedback> & { type: 'message' } = { post_id: postId, author_role: role, author_name: name, message: sanitize(message), type: 'message' };
      if (versionName) payload.version_name = versionName;
      const { data, error } = await supabase.from('post_feedbacks').insert([payload]).select();
      if (error) throw error;
      if (data?.[0]) {
        setFeedbacks((prev) => [...prev, data[0] as PostFeedback]);
      }
    } finally {
      setSending(false);
    }
  }

  async function sendLog(message: string) {
    if (!postId) return;
    try {
      const payload: Partial<PostFeedback> & { type: 'log' } = { post_id: postId, author_role: 'gestor', author_name: 'Sistema', message: sanitize(message), type: 'log' };
      if (versionName) payload.version_name = versionName;
      const { data, error } = await supabase.from('post_feedbacks').insert([payload]).select();
      if (error) throw error;
      if (data?.[0]) {
        setFeedbacks((prev) => [...prev, data[0] as PostFeedback]);
      }
    } catch (err) {
      console.error('Erro ao criar log:', err);
    }
  }

  return { feedbacks, loading, sending, send, sendLog };
}
