-- ============================================================
-- B15: eleva o limite por arquivo do bucket `posts-media` de 10 MB para 50 MB.
-- A compressão estratégica mira até 30 MB (MAX_MEDIA_SIZE) e o client usa o teto
-- de 50 MB (SUPABASE_OBJECT_LIMIT em src/lib/media-storage.ts); o limite de 10 MB
-- fazia vídeos comprimidos entre 10-30 MB quebrarem no upload. 50 MB = teto do
-- próprio Supabase Storage (objeto único).
-- ============================================================
UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id = 'posts-media';
