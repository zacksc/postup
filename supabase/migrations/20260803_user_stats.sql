-- User Stats: aggregated counts for profile dashboard
CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_posts INT DEFAULT 0,
  total_feedbacks_given INT DEFAULT 0,
  total_approved INT DEFAULT 0,
  total_adjustments INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own stats"
  ON public.user_stats FOR SELECT
  USING (auth.uid() = user_id);

-- Function to refresh stats
CREATE OR REPLACE FUNCTION public.refresh_user_stats(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_stats (user_id, total_posts, total_feedbacks_given, total_approved, total_adjustments)
  VALUES (
    p_user_id,
    (SELECT COUNT(*) FROM public.posts WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM public.post_feedbacks pf
      JOIN public.posts p ON p.id = pf.post_id
      WHERE p.user_id = p_user_id AND pf.author_role = 'gestor'),
    (SELECT COUNT(*) FROM public.posts WHERE user_id = p_user_id AND status = 'aprovado'),
    (SELECT COUNT(*) FROM public.posts WHERE user_id = p_user_id AND status = 'alteracao')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_posts = EXCLUDED.total_posts,
    total_feedbacks_given = EXCLUDED.total_feedbacks_given,
    total_approved = EXCLUDED.total_approved,
    total_adjustments = EXCLUDED.total_adjustments,
    updated_at = NOW();
END;
$$;
