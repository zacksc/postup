-- Storage settings: fluxo de pastas no Google Drive por usuário (decisão D21).
-- folder_template é um template com placeholders, ex. padrão:
--   {cliente}/{ano}/{mes}/{dia}/{tipo}
-- Placeholders disponíveis: {cliente} {ano} {mes} {dia} {tipo} {sequencia}.
-- `drive_folders` é um cache path→folder_id (só a edge function lê/escreve com
-- service_role) para não recriar pastas nem fazer files.list a cada upload.

create table if not exists public.user_storage_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  folder_template text not null default '{cliente}/{ano}/{mes}/{dia}/{tipo}',
  updated_at timestamptz not null default now()
);

alter table public.user_storage_settings enable row level security;

drop policy if exists "storage_settings_select_own" on public.user_storage_settings;
create policy "storage_settings_select_own"
  on public.user_storage_settings
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "storage_settings_insert_own" on public.user_storage_settings;
create policy "storage_settings_insert_own"
  on public.user_storage_settings
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "storage_settings_update_own" on public.user_storage_settings;
create policy "storage_settings_update_own"
  on public.user_storage_settings
  for update
  to authenticated
  using (user_id = auth.uid());

create table if not exists public.drive_folders (
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null,
  folder_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, path)
);

alter table public.drive_folders enable row level security;
-- sem policies: só a edge function (service_role) acessa este cache
