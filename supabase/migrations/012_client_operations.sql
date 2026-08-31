-- Migration 012: Security definer functions for client operations
-- These bypass RLS and verify ownership via review_token

-- Approve a post
CREATE OR REPLACE FUNCTION approve_post(p_post_id uuid, p_review_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify token matches the client who owns the post
  IF NOT EXISTS (
    SELECT 1 FROM posts p
    JOIN clients c ON c.id = p.client_id
    WHERE p.id = p_post_id AND c.review_token = p_review_token
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE posts SET status = 'aprovado' WHERE id = p_post_id;
  INSERT INTO post_feedbacks (post_id, author_role, author_name, message, type)
  VALUES (p_post_id, 'cliente', 'Cliente', 'Post aprovado pelo cliente.', 'log');
END;
$$;

-- Undo approval of a post
CREATE OR REPLACE FUNCTION undo_approve_post(p_post_id uuid, p_review_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM posts p
    JOIN clients c ON c.id = p.client_id
    WHERE p.id = p_post_id AND c.review_token = p_review_token
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE posts SET status = 'aguardando' WHERE id = p_post_id;
  INSERT INTO post_feedbacks (post_id, author_role, author_name, message, type)
  VALUES (p_post_id, 'cliente', 'Cliente', 'Cliente desfez a aprovação.', 'log');
END;
$$;

-- Send feedback message from client
CREATE OR REPLACE FUNCTION send_client_feedback(p_post_id uuid, p_review_token uuid, p_message text, p_author_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM posts p
    JOIN clients c ON c.id = p.client_id
    WHERE p.id = p_post_id AND c.review_token = p_review_token
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT status INTO v_current_status FROM posts WHERE id = p_post_id;

  INSERT INTO post_feedbacks (post_id, author_role, author_name, message, type)
  VALUES (p_post_id, 'cliente', p_author_name, p_message, 'message');

  -- First message from client changes status from aguardando to alteracao
  IF v_current_status = 'aguardando' THEN
    UPDATE posts SET status = 'alteracao' WHERE id = p_post_id;
    INSERT INTO post_feedbacks (post_id, author_role, author_name, message, type)
    VALUES (p_post_id, 'cliente', p_author_name, 'Cliente solicitou alteração.', 'log');
  END IF;
END;
$$;

-- Approve all pending posts
CREATE OR REPLACE FUNCTION approve_all_posts(p_review_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  SELECT id INTO v_client_id FROM clients WHERE review_token = p_review_token;
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO post_feedbacks (post_id, author_role, author_name, message, type)
  SELECT id, 'cliente', 'Cliente', 'Post aprovado pelo cliente.', 'log'
  FROM posts
  WHERE client_id = v_client_id AND status = 'aguardando';

  UPDATE posts SET status = 'aprovado'
  WHERE client_id = v_client_id AND status = 'aguardando';
END;
$$;
