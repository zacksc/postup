-- Migration: Adiciona original_urls para preservar links de download dos originais.
-- media_urls passa a guardar a URL de exibição (Supabase posts-media).
-- original_urls guarda a URL do Google Drive (original para download).

-- 1. posts: nova coluna original_urls (paralela a media_urls)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS original_urls JSONB DEFAULT '[]';

-- 2. post_versions: espelhar original_urls no snapshot data
-- (colunas novas no jsonb data são adicionadas aqui; inserts futuros já devem incluir original_urls)
