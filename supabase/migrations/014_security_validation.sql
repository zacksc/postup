-- Migration 014: Input validation on SECURITY DEFINER functions
-- Adds length/content checks to prevent abuse of client-facing RPCs

-- Recreate approve_post with validation
CREATE OR REPLACE FUNCTION approve_post(p_post_id uuid, p_review_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_post_id IS NULL OR p_review_token IS NULL THEN
    RAISE EXCEPTION 'Invalid parameters';
  END IF;

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

-- Recreate undo_approve_post with validation
CREATE OR REPLACE FUNCTION undo_approve_post(p_post_id uuid, p_review_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_post_id IS NULL OR p_review_token IS NULL THEN
    RAISE EXCEPTION 'Invalid parameters';
  END IF;

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

-- Recreate send_client_feedback with length/content validation
CREATE OR REPLACE FUNCTION send_client_feedback(p_post_id uuid, p_review_token uuid, p_message text, p_author_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status text;
BEGIN
  IF p_post_id IS NULL OR p_review_token IS NULL THEN
    RAISE EXCEPTION 'Invalid parameters';
  END IF;

  IF p_message IS NULL OR length(p_message) = 0 THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  IF length(p_message) > 2000 THEN
    RAISE EXCEPTION 'Message too long (max 2000 characters)';
  END IF;

  IF p_author_name IS NULL OR length(p_author_name) = 0 THEN
    p_author_name := 'Cliente';
  END IF;

  IF length(p_author_name) > 100 THEN
    RAISE EXCEPTION 'Author name too long (max 100 characters)';
  END IF;

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

  IF v_current_status = 'aguardando' THEN
    UPDATE posts SET status = 'alteracao' WHERE id = p_post_id;
    INSERT INTO post_feedbacks (post_id, author_role, author_name, message, type)
    VALUES (p_post_id, 'cliente', p_author_name, 'Cliente solicitou alteração.', 'log');
  END IF;
END;
$$;

-- Recreate approve_all_posts with validation
CREATE OR REPLACE FUNCTION approve_all_posts(p_review_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  IF p_review_token IS NULL THEN
    RAISE EXCEPTION 'Invalid parameters';
  END IF;

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
