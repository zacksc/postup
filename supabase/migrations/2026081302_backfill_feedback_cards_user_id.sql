-- Backfill user_id on feedback_cards that have NULL user_id
-- This ensures standalone tasks created before tenant isolation are visible

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get the first authenticated user
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    UPDATE feedback_cards SET user_id = v_user_id WHERE user_id IS NULL;
    RAISE NOTICE 'Backfilled feedback_cards user_id for %', v_user_id;
  ELSE
    RAISE NOTICE 'No auth users found, skipping backfill';
  END IF;
END;
$$;
