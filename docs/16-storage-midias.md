# 16 — Storage de mídias: alternativas e plano de migração

> **Objetivo**: decidir para onde migrar as mídias dos posts antes que o bucket
> gratuito do Supabase (1 GB) estoure. O upload de imagens já comprime no cliente
> (webp, ~1080–1920px) e vídeos para 720p, mas vídeos longos e múltiplos clientes
> esgotam 1 GB rápido (decisão D15 só adiou o problema).
>
> Decisão registrada: **D20** (implementada, Google Drive BYO por usuário) e **D21**
> (fluxo de pastas configurável) em `12-decisoes-alternativas.md`; **D19** (Cloudflare R2)
> permanece como plano de migração futura quando o volume agregado justificar.

---

## 1. Estado atual

- **Provider por usuário**: o upload vai para o **Google Drive da conta logada**
  (BYO, D20) se o usuário conectou; senão, fallback no bucket Supabase `posts-media`.
- **Camada única**: `src/lib/media-storage.ts` expõe `uploadMedia(blob, path, opts)`
  e decide o provider checando a tabela `user_drive_connections` (RLS: o usuário vê a
  própria linha). Todos os pontos de upload usam essa camada — trocar de provider é só
  mexer nela (é plugável).
- **Google Drive**: OAuth `drive.file` (só arquivos criados pelo app); o browser faz o
  upload dos bytes direto pro Google (sessão resumable, sem passar pelo edge); o
  `refresh_token` fica **criptografado** no banco (`_shared/crypto.ts`). Edge functions:
  `drive-oauth`, `drive-upload`, `drive-status`. UI de conexão no Perfil.
- **Bucket Supabase `posts-media`** (fallback): público, limite de **10 MB por arquivo**
  (migration 006 — **menor que o teto de 30 MB da compressão estratégica, ver B15**),
  MIME em allowlist (jpeg/png/webp/gif/mp4/webm).
- **Call sites migrados para `uploadMedia`** (antes `supabase.storage.from(...)` direto):
  - `src/pages/Post/NovoPost.tsx` (mídias do post + capa — **passa contexto**, stories com sequência)
  - `src/pages/Clientes/NovoCliente.tsx` (foto do cliente)
  - `src/pages/Perfil/Perfil.tsx` (avatar)
  - `src/components/feedback/FeedbackCardModal.tsx` (anexos)
  - `src/components/modals/PostModal.tsx` (upload rápido — **passa contexto**, stories com sequência)
  - `src/lib/compress-image.ts` (`compressPostMediaAndReupload` — aceita contexto; publish em
    `PostDetalhe.tsx` e `GridInstagram.tsx` passam cliente/data/tipo, sem subpasta de sequência)
- Vídeo comprimido estrategicamente para caber em **30 MB** (`MAX_MEDIA_SIZE`,
  bitrate calculado pela duração + escada de resoluções, D15) — não elimina o
  volume, só reduz e garante o teto.

> **Nota**: o `docs/16` foi originalmente escrito com a D19 (R2) como plano. A D20
> (BYO Google Drive) foi implementada primeiro por decisão do usuário; as seções de
> alternativas (R2/B2/Supabase) abaixo continuam valendo para a fase seguinte.

## 1.1 Fluxo de pastas no Google Drive (D21)

- Cada usuário define um **template de pastas** (default `{cliente}/{ano}/{mes}/{dia}/{tipo}`)
  em **Configurações → Armazenamento**. Placeholders: `{cliente} {ano} {mes} {dia} {tipo} {sequencia}`.
- A expansão acontece no **client** (`src/lib/drive-folders.ts`, função pura `buildFolderPath`)
  usando o contexto do post (cliente, data de agendamento, tipo, sequência). Exemplo de resultado:
  `Loja Bella/2026/08/04/reels/video.mp4`.
- **Tipo** mapeia o `post_type` para pastas: reels→`reels`, foto→`fotos`, carrossel→`carrossel`,
  stories→`stories`, design→`design`, outro→`outros`.
- **Stories**: cada post de stories cria uma subpasta de sequência única
  (`.../stories/sequencia-<timestamp>/`) que agrupa os arquivos **na ordem de postagem**.
  O template também aceita `{sequencia}` explícito; sem sequência, vira `sem-sequencia`.
- **Sem contexto** (avatar, anexos de feedback): o arquivo vai direto à raiz do app,
  preservando o comportamento anterior.
- A **edge `drive-upload`** resolve/cria a hierarquia de pastas no Drive (`getOrCreateFolder`,
  iterando os segmentos) e usa o cache `drive_folders` (path→folder_id) para não recriar
  nem fazer `files.list` a cada upload; se a pasta sumir do Drive, o `files.get` falha e recria.
- Config salva em `user_storage_settings` (RLS: o dono lê/grava). O `media-storage.ts` cacheia
  o template em memória e `resetFolderTemplateCache()` invalida ao salvar nas Configurações.
- Testes: `src/test/drive-folders.test.ts` cobre a expansão do template (8 casos).

## 1.2 Testando o storage do Supabase (antes do R2)

Para validar o fluxo inteiro (compressão → upload → preview/download) usando o
bucket Supabase `posts-media` — sem desconectar o Google Drive:

1. Rodar a migration `20260809_posts_media_bucket_size_limit.sql` (eleva o limite
   por arquivo de 10 MB para 50 MB, ver B15) no painel do Supabase.
2. Definir `VITE_STORAGE_PROVIDER=supabase` no `.env.local` (ver `.env.example`).
   Isso faz `hasDriveConnection()` retornar `false` em `src/lib/media-storage.ts`,
   forçando o caminho Supabase em `uploadMedia`.
3. Criar/editar um post com imagem e vídeo, salvar e conferir:
   - upload em `posts-media` (Storage → Buckets no painel Supabase);
   - preview e o novo botão de download no lightbox funcionando com a URL pública;
   - erros de tamanho claros (mensagem de "50 MB" em `describeStorageError`).

Remover `VITE_STORAGE_PROVIDER` (ou deixá-lo vazio) volta ao fluxo Drive. Quando o
volume validar, a troca para R2 (seção 4) só mexe no `media-storage.ts`/envs — a
camada de upload já é única.

## 2. Alternativas gratuitas comparadas (preços de 2026)

| | Supabase (atual) | Cloudflare R2 | Backblaze B2 | Supabase Pro |
|---|---|---|---|---|
| **Free** | 1 GB | **10 GB (permanente)** | **10 GB (permanente)** | — (pago) |
| **Depois do free** | — | $0.015/GB-mês | **$0.006/GB-mês** | $25/mês (inclui 100 GB) |
| **Egress (saída)** | free no plano free | **$0 sempre** | 3× o armazenamento free, depois $0.01/GB (ou **$0 via Cloudflare**) | 5 GB free, depois pago |
| **API compatível** | própria (Supabase) | **S3-compatible** | S3-compatible | própria |
| **Operações (API)** | free | 1M classe A + 10M classe B/mês free | uploads free; ~2.5k downloads/dia free | — |
| **URL pública** | `supabase.co/storage/...` | r2.dev ou custom domain | b2 link ou via CDN | `supabase.co/...` |
| **Cache/CDN** | não | Cloudflare (built-in, mesmo domínio) | Cloudflare (Bandwidth Alliance) | não |

### Cloudflare R2 — recomendado
- **10 GB free que nunca expira** (não é trial de 12 meses).
- **Egress $0 para sempre** — vídeos servidos aos clientes não custam saída.
- **S3-compatible**: troca de provedor no futuro é só mudar credenciais.
- Operações free: 1M gravações + 10M leituras/mês — folga enorme para esse porte.
- Usa o mesmo ecossistema Cloudflare que o Turnstile (já presente no app).
- Custo se crescer: $0.015/GB-mês (~$15/mês por TB) — muito barato.

### Backblaze B2 — mais barato no storage
- Mesmo **10 GB free permanente**; storage depois **$0.006/GB-mês** (mais barato que R2).
- Egress free até 3× o armazenamento médio; acima, $0.01/GB **OU $0 se sair via
  Cloudflare (Bandwidth Alliance)**.
- Trade-off: região única (us-west), ecossistema menor que o R2/Cloudflare.
- Ideal se o volume de mídia crescer muito — B2 + Cloudflare é a combinação mais barata.

### Manter Supabase (upgrade)
- Supabase Pro ($25/mês) inclui 100 GB de storage — resolve, mas é assinatura
  recorrente mesmo sem receita; o free do R2 já resolve a fase atual de graça.

## 3. Recomendação

**Cloudflare R2 agora** (10 GB free). Migrar para **Backblaze B2** só se o volume
passar de ~10 GB e a economia (~$0.009/GB-mês) justificar a troca de endpoint.

Motivos: 10 GB grátis (vs 1 GB), egress zero (vídeos!), S3-compatible (sem lock-in),
e zero custo mensal — condiz com o estágio do projeto (portfolio/small SaaS).

## 4. Plano de migração (esboço)

1. **Credenciais**: criar bucket R2 + API token; adicionar envs
   `VITE_R2_ACCOUNT_ID`, `VITE_R2_ACCESS_KEY_ID`, `VITE_R2_SECRET_ACCESS_KEY`,
   `VITE_R2_BUCKET`, `VITE_R2_PUBLIC_URL` (`.env.local` + Vercel).
2. **Camada de upload** (`src/lib/media-storage.ts`, novo): embrulhar o upload
   com a SDK S3 (`@aws-sdk/client-s3`) apontando para `https://<account>.r2.cloudflarestorage.com`.
   Manter `compressImage`/`compressVideo` como estão (só muda o destino do blob).
3. **Substituir chamadas**: trocar `supabase.storage.from('posts-media')` pelo
   helper nos 6 arquivos da seção 1.
4. **URLs**: salvar `VITE_R2_PUBLIC_URL/<path>` no banco (igual `getPublicUrl` hoje);
   `isVideoUrl` continua funcionando (basta aceitar o novo domínio).
5. **Dados antigos**: migrar 1 GB do Supabase → R2 (script local `scripts/migrate-storage.mjs`
   com as duas SDKs) e atualizar os URLs no Postgres; manter o bucket Supabase
   só como backup até validar.
6. **Bucket público R2**: public access via custom domain ou r2.dev (mesma regra
   de segurança atual: mídia é pública por design, o acesso ao painel é que é restrito).

> **Atenção (B14)**: aproveitar a migração para implementar a mensagem clara de
> "armazenamento cheio" ao mapear os erros de upload (item A7 do backlog).

---

**Anterior**: [`15-backlog-unificado.md`](15-backlog-unificado.md) ·
**Decisão**: D19 em [`12-decisoes-alternativas.md`](12-decisoes-alternativas.md)
