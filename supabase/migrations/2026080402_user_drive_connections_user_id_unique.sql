-- Fix: a RPC upsert_drive_connection usa ON CONFLICT (user_id), que exige
-- constraint UNIQUE em user_id. A migration 20260802 só tinha PK em id.
alter table public.user_drive_connections
  add constraint user_drive_connections_user_id_key unique (user_id);
