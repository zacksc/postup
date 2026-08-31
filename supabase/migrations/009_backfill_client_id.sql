-- Migration 009: Preencher client_id em posts existentes
UPDATE posts p
SET client_id = c.id
FROM clients c
WHERE p.client_name = c.name
  AND p.client_id IS NULL;
