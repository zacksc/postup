-- Migration 010: Corrigir ativação do RLS (FORCE → ENABLE)
-- O comando FORCE ROW LEVEL SECURITY não ativa RLS se ele estava DISABLEd.
-- Primeiro ENABLE, depois FORCE para o owner também ser afetado.

ALTER TABLE post_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_card_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_card_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_card_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_versions ENABLE ROW LEVEL SECURITY;
