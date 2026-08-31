-- Migration 007: Tokens de review para clientes
-- Substitui PIN hardcoded por token criptográfico UUID

ALTER TABLE clients ADD COLUMN IF NOT EXISTS review_token UUID DEFAULT gen_random_uuid();

-- Backfill: garantir que todos os clientes existentes tenham token
UPDATE clients SET review_token = gen_random_uuid() WHERE review_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_review_token ON clients(review_token);
