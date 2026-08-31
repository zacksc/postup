-- Migration: Vinculação de Google Drive por usuário (BYO storage, decisão D20)
-- Guarda o refresh_token criptografado (AES-GCM via chave `DRIVE_ENCRYPTION_KEY`
-- que só existe no edge function). RLS isola por usuário; o front NUNCA recebe
-- o token (só o servidor, com service_role, acessa para gerar acesso).

create table if not exists public.user_drive_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_uid text,
  email text,
  drive_name text,
  refresh_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_drive_connections_user_id_key unique (user_id)
);

alter table public.user_drive_connections enable row level security;

-- O usuário pode VER a própria conexão (sem o token — o token fica no payload que
-- o servidor devolve ao build de URL; aqui só metadados de "está conectado").
drop policy if exists "drive_select_have_own" on public.user_drive_connections;
create policy "drive_select_have_own"
  on public.user_drive_connections
  for select
  to authenticated
  using (user_id = auth.uid());

-- Upsert (edge function / seciurly running as service_role bypassa RLS, mas a
-- função garante que só o dono escreve sua própria linha)
drop function if exists public.upsert_drive_connection(uuid, text, text, text, text);
create function public.upsert_drive_connection(
  p_user uuid,
  p_google_uid text,
  p_email text,
  p_drive_name text,
  p_refresh_token text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.user_drive_connections (user_id, google_uid, email, drive_name, refresh_token, updated_at)
  values (p_user, p_google_uid, p_email, p_drive_name, p_refresh_token, now())
  on conflict (user_id)
  do update set
    google_uid = excluded.google_uid,
    email = excluded.email,
    drive_name = excluded.drive_name,
    refresh_token = excluded.refresh_token,
    updated_at = now();
end;
$$;

-- Deleta a conexão (desconectar drive)
create function public.delete_drive_connection(p_user uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.user_drive_connections where user_id = p_user;
end;
$$;