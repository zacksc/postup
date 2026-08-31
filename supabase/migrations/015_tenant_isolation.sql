-- Migration 015: Per-user data isolation (tenant separation)
-- Each user can only see their own clients, posts, and related data

-- ============================================================
-- 1. Add user_id columns
-- ============================================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE feedback_cards ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_cards_user_id ON feedback_cards(user_id);

-- ============================================================
-- 2. Update RLS policies for clients
-- ============================================================
DROP POLICY IF EXISTS "auth_all_clients" ON clients;
CREATE POLICY "auth_all_clients" ON clients
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow anon to select clients with a valid review_token (client review flow)
DROP POLICY IF EXISTS "anon_select_clients_by_token" ON clients;
CREATE POLICY "anon_select_clients_by_token" ON clients
  FOR SELECT TO anon
  USING (review_token IS NOT NULL);

-- ============================================================
-- 3. Update RLS policies for posts
-- ============================================================
DROP POLICY IF EXISTS "anon_select_posts" ON posts;
CREATE POLICY "anon_select_posts" ON posts
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "auth_all_posts" ON posts;
CREATE POLICY "auth_all_posts" ON posts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 4. Update RLS policies for post_feedbacks
-- ============================================================
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
  USING (
    EXISTS (SELECT 1 FROM posts WHERE posts.id = post_feedbacks.post_id AND posts.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM posts WHERE posts.id = post_feedbacks.post_id AND posts.user_id = auth.uid())
  );

-- ============================================================
-- 5. Update RLS policies for feedback_cards
-- ============================================================
DROP POLICY IF EXISTS "auth_all_feedback_cards" ON feedback_cards;
CREATE POLICY "auth_all_feedback_cards" ON feedback_cards
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 6. Update RLS policies for feedback_card_attachments
-- ============================================================
DROP POLICY IF EXISTS "auth_all_feedback_attachments" ON feedback_card_attachments;
CREATE POLICY "auth_all_feedback_attachments" ON feedback_card_attachments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM feedback_cards WHERE feedback_cards.id = feedback_card_attachments.card_id AND feedback_cards.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM feedback_cards WHERE feedback_cards.id = feedback_card_attachments.card_id AND feedback_cards.user_id = auth.uid())
  );

-- ============================================================
-- 7. Update RLS policies for feedback_card_checklist_items
-- ============================================================
DROP POLICY IF EXISTS "auth_all_feedback_checklist" ON feedback_card_checklist_items;
CREATE POLICY "auth_all_feedback_checklist" ON feedback_card_checklist_items
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM feedback_cards WHERE feedback_cards.id = feedback_card_checklist_items.card_id AND feedback_cards.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM feedback_cards WHERE feedback_cards.id = feedback_card_checklist_items.card_id AND feedback_cards.user_id = auth.uid())
  );

-- ============================================================
-- 8. Update RLS policies for feedback_card_comments
-- ============================================================
DROP POLICY IF EXISTS "auth_all_feedback_comments" ON feedback_card_comments;
CREATE POLICY "auth_all_feedback_comments" ON feedback_card_comments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM feedback_cards WHERE feedback_cards.id = feedback_card_comments.card_id AND feedback_cards.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM feedback_cards WHERE feedback_cards.id = feedback_card_comments.card_id AND feedback_cards.user_id = auth.uid())
  );

-- ============================================================
-- 9. Update RLS policies for post_versions
-- ============================================================
DROP POLICY IF EXISTS "auth_all_post_versions" ON post_versions;
CREATE POLICY "auth_all_post_versions" ON post_versions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM posts WHERE posts.id = post_versions.post_id AND posts.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM posts WHERE posts.id = post_versions.post_id AND posts.user_id = auth.uid())
  );

-- ============================================================
-- 10. Backfill existing data: associate with existing users
--     Skip if no users exist (new database)
-- ============================================================
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    UPDATE clients SET user_id = v_user_id WHERE user_id IS NULL;
    UPDATE posts SET user_id = v_user_id WHERE user_id IS NULL;
    UPDATE feedback_cards SET user_id = v_user_id WHERE user_id IS NULL;
  END IF;
END;
$$;
