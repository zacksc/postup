-- Migration 006: Criar tabelas faltantes, RLS, storage bucket e Realtime
-- Itens 1–5 do audit de lançamento (Fase 1)

-- ============================================================
-- 1. Criar / completar tabela posts
-- ============================================================
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  client_name TEXT NOT NULL,
  client_handle TEXT DEFAULT '',
  client_color TEXT DEFAULT '#7c6af7',
  post_type TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  caption TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'rascunho',
  media_urls JSONB DEFAULT '[]',
  version INTEGER DEFAULT 1
);

-- Colunas que podem estar faltando na tabela existente
ALTER TABLE posts ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS client_handle TEXT DEFAULT '';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS client_color TEXT DEFAULT '#7c6af7';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS caption TEXT DEFAULT '';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT '[]';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_posts_client_id ON posts(client_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at ON posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_posts_client_handle ON posts(client_handle);

-- ============================================================
-- 2. Criar / completar tabela post_feedbacks
-- ============================================================
CREATE TABLE IF NOT EXISTS post_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_role TEXT NOT NULL,
  author_name TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'message'
);

ALTER TABLE post_feedbacks ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'message';
ALTER TABLE post_feedbacks ADD COLUMN IF NOT EXISTS version_name TEXT;

CREATE INDEX IF NOT EXISTS idx_post_feedbacks_post_id ON post_feedbacks(post_id);
CREATE INDEX IF NOT EXISTS idx_post_feedbacks_version ON post_feedbacks(version_name);
CREATE INDEX IF NOT EXISTS idx_post_feedbacks_created_at ON post_feedbacks(created_at DESC);

-- ============================================================
-- 3. Remover DISABLE RLS anteriores (idempotente)
-- ============================================================
ALTER TABLE IF EXISTS post_feedbacks FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS posts FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clients FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS feedback_cards FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS feedback_card_attachments FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS feedback_card_checklist_items FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS feedback_card_comments FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS post_versions FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 4. Políticas RLS granulares
-- ============================================================
DROP POLICY IF EXISTS "anon_select_posts" ON posts;
CREATE POLICY "anon_select_posts" ON posts
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "auth_all_posts" ON posts;
CREATE POLICY "auth_all_posts" ON posts
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_feedbacks" ON post_feedbacks;
CREATE POLICY "anon_select_feedbacks" ON post_feedbacks
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "anon_insert_feedbacks" ON post_feedbacks;
CREATE POLICY "anon_insert_feedbacks" ON post_feedbacks
  FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_feedbacks" ON post_feedbacks;
CREATE POLICY "auth_all_feedbacks" ON post_feedbacks
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_clients" ON clients;
CREATE POLICY "auth_all_clients" ON clients
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_feedback_cards" ON feedback_cards;
CREATE POLICY "auth_all_feedback_cards" ON feedback_cards
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_feedback_attachments" ON feedback_card_attachments;
CREATE POLICY "auth_all_feedback_attachments" ON feedback_card_attachments
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_feedback_checklist" ON feedback_card_checklist_items;
CREATE POLICY "auth_all_feedback_checklist" ON feedback_card_checklist_items
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_feedback_comments" ON feedback_card_comments;
CREATE POLICY "auth_all_feedback_comments" ON feedback_card_comments
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_post_versions" ON post_versions;
CREATE POLICY "auth_all_post_versions" ON post_versions
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 5. Criar storage bucket posts-media
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'posts-media',
  'posts-media',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_select_storage" ON storage.objects;
CREATE POLICY "anon_select_storage" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'posts-media');

DROP POLICY IF EXISTS "anon_insert_storage" ON storage.objects;
CREATE POLICY "anon_insert_storage" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'posts-media');

DROP POLICY IF EXISTS "auth_all_storage" ON storage.objects;
CREATE POLICY "auth_all_storage" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'posts-media')
  WITH CHECK (bucket_id = 'posts-media');

-- ============================================================
-- 6. Habilitar Realtime nas tabelas
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE post_feedbacks;
ALTER PUBLICATION supabase_realtime ADD TABLE feedback_cards;
