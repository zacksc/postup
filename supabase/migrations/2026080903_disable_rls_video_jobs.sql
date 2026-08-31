-- Worker usa anon key para atualizar a fila de processamento.
-- A tabela video_jobs NÃO contém dados sensíveis — apenas status/progresso
-- de jobs de processamento de vídeo. Desabilitar RLS é seguro aqui.
ALTER TABLE video_jobs DISABLE ROW LEVEL SECURITY;