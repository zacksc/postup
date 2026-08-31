-- Preferência de compressão de mídia por usuário:
--   compress_videos = true  → comprime vídeos antes de enviar (padrão)
--   compress_videos = false → envia o arquivo original, sem comprimir
-- Guardada em user_storage_settings para ser o padrão; o post pode sobrescrever
-- por post via o seletor "Enviar sem comprimir / Comprimir e enviar".

alter table public.user_storage_settings
  add column if not exists compress_videos boolean not null default true;
