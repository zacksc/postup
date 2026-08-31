-- Corrige o CHECK constraint da coluna status em feedback_cards
-- O Kanban tem 4 colunas: aguardando, alteracao, aprovado, publicado
-- O constraint original só permitia 3 valores, causando erro ao mover tarefas

-- Primeiro remove o constraint antigo (se existir)
ALTER TABLE feedback_cards DROP CONSTRAINT IF EXISTS feedback_cards_status_check;

-- Adiciona o constraint com todos os valores válidos do Kanban
ALTER TABLE feedback_cards 
  ADD CONSTRAINT feedback_cards_status_check 
  CHECK (status IN ('aguardando', 'alteracao', 'aprovado', 'publicado'));
