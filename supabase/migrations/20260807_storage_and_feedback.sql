-- Extende as settings de armazenamento (D21):
--  - root_folder: pasta raiz no Drive que agrupa todos os uploads (default 'Postup')
--  - agencia / equipe: valores fixos usados pelos placeholders {agencia} e {equipe}
--  - novo default do template: {cliente}/{ano}/{mes_completo}/{dia}/{tipo}
-- E marca posts como feedback (toggle manual no formulário).

alter table public.user_storage_settings
  add column if not exists root_folder text not null default 'Postup';

alter table public.user_storage_settings
  add column if not exists agencia text not null default '';

alter table public.user_storage_settings
  add column if not exists equipe text not null default '';

alter table public.user_storage_settings
  alter column folder_template set default '{cliente}/{ano}/{mes_completo}/{dia}/{tipo}';

alter table public.posts
  add column if not exists is_feedback boolean not null default false;
