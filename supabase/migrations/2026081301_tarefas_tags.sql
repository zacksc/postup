-- Migração: Tags no sistema de Tarefas + post_id nullable
-- Data: 2026-08-13
-- Descrição: Adiciona suporte a tags jsonb em posts e feedback_cards,
--            e permite feedback_cards sem post_id (tarefas soltas).

-- 1. Tornar post_id nullable em feedback_cards (tarefas soltas)
ALTER TABLE public.feedback_cards
  ALTER COLUMN post_id DROP NOT NULL;

-- 2. Adicionar coluna tags em feedback_cards
ALTER TABLE public.feedback_cards
  ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. Adicionar coluna tags em posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 4. Índice GIN para consultas eficientes em tags
CREATE INDEX IF NOT EXISTS idx_feedback_cards_tags ON public.feedback_cards USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_posts_tags ON public.posts USING gin (tags);

-- 5. Comentário nas colunas
COMMENT ON COLUMN public.feedback_cards.tags IS 'Array de tags [{name, color}] para categorização';
COMMENT ON COLUMN public.feedback_cards.post_id IS 'FK para posts. NULL = tarefa solta (sem post associado)';
COMMENT ON COLUMN public.posts.tags IS 'Array de tags [{name, color}] para categorização. Posts recebem tag "post" padrão.';
