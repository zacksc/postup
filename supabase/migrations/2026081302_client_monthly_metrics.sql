-- Migração: Relatório mensal do cliente
-- Data: 2026-08-13
-- Descrição: Tabela para armazenar métricas manuais mensais dos clientes
--            (coleta manual, sem API da Meta por enquanto).

CREATE TABLE IF NOT EXISTS public.client_monthly_metrics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month text NOT NULL, -- '2026-08'

  -- Métricas manuais
  followers integer,
  following integer,
  new_followers integer,
  reach integer,
  impressions integer,
  profile_visits integer,
  engagement_rate numeric(5,2),
  comments integer,
  saves integer,
  shares integer,

  -- Texto livre
  notes text,
  goals_next text, -- próximos caminhos / metas do mês seguinte

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Um registro por cliente por mês
  UNIQUE(client_id, month)
);

-- RLS
ALTER TABLE public.client_monthly_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own client metrics"
  ON public.client_monthly_metrics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own client metrics"
  ON public.client_monthly_metrics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own client metrics"
  ON public.client_monthly_metrics FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own client metrics"
  ON public.client_monthly_metrics FOR DELETE
  USING (auth.uid() = user_id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_client_monthly_metrics_client_id ON public.client_monthly_metrics (client_id);
CREATE INDEX IF NOT EXISTS idx_client_monthly_metrics_month ON public.client_monthly_metrics (month);
