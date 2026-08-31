-- Tabela para jobs de processamento de vídeo
CREATE TABLE IF NOT EXISTS video_jobs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id TEXT,
  r2_key TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'video/mp4',
  size BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'error')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  message TEXT,
  app_url TEXT,
  client_url TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_video_jobs_user_id ON video_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status);
CREATE INDEX IF NOT EXISTS idx_video_jobs_post_id ON video_jobs(post_id);

-- RLS (Row Level Security)
ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own video jobs"
  ON video_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own video jobs"
  ON video_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can update video jobs"
  ON video_jobs FOR UPDATE
  USING (true);

-- Habilitar Realtime para a tabela
ALTER PUBLICATION supabase_realtime ADD TABLE video_jobs;
