-- Arquivamento automático do Kanban (D23):
--  - posts.archived_at: quando definido, o card some do quadro e vira "arquivo".
--  - Regras (aplicadas no fetch do Kanban):
--      * status = 'aprovado'  e scheduled_at passou do dia → arquiva
--      * status = 'publicado' e scheduled_at fora da semana atual → arquiva
--  - O modal "Arquivo" lê archived_at IS NOT NULL e oferece restaurar (NULL).

alter table public.posts
  add column if not exists archived_at timestamptz;
