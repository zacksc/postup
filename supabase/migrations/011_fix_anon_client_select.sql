-- Migration 011: Permitir anon consultar clientes pelo review_token
-- Necessário para o fluxo de review do cliente (ClienteFluxo)

DROP POLICY IF EXISTS "anon_select_clients_by_token" ON clients;
CREATE POLICY "anon_select_clients_by_token" ON clients
  FOR SELECT TO anon
  USING (review_token IS NOT NULL);
