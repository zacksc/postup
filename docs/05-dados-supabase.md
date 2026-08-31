# 05 — Camada de dados: Supabase

> **Objetivo**: entender como o PostUp usa Supabase — cliente, migrations, RLS,
> auth, storage, realtime e edge functions — e por que cada peça existe.

## O papel do Supabase

Supabase é um **Backend-as-a-Service** open-source: PostgreSQL + Auth + Storage +
Realtime + Edge Functions. O PostUp não tem servidor próprio; o frontend fala
direto com o Supabase usando a **anon key** (chave pública) — e a segurança fica
no banco, via **RLS (Row Level Security)**.

## O cliente: `src/lib/supabase.ts`

```ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltam as variáveis de ambiente do Supabase...')
}
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

Pontos importantes:

- `import.meta.env.*` → variáveis de ambiente do **Vite** (precisam do prefixo `VITE_`).
- As chaves ficam em `.env.local` (não versionado) e nas env vars da Vercel.
- Se faltar alguma, o app **falha cedo** com mensagem clara — melhor que erro estranho no meio do uso.

## Migrations: o schema versionado

As migrations estão em `supabase/migrations/` e **são executadas via CLI do Supabase**
(`supabase db push`). Elas contam a evolução do banco:

| Migração | O que faz |
|----------|-----------|
| 006 | Tabelas (posts, post_feedbacks), RLS, bucket de storage, realtime |
| 007 | Review tokens (fluxo do cliente) |
| 009 | Backfill de `client_id` |
| 010–011 | Correções de RLS (anon select) |
| 012 | Operações de clientes (RPCs) |
| 013 | Campos do Instagram do cliente (bio, followers, etc.) |
| 014 | **Validação de input nas SECURITY DEFINER functions** |
| 015 | **Isolamento multi-usuário** (`user_id` + RLS por dono) |
| 20260730_* | `archived_at`, check de e-mail, notificações/platformas, profiles/teams, stats |
| 20260802–20260805 | Drive: `user_drive_connections`, `user_stats`, UNIQUE em `user_id`, `user_storage_settings`/`drive_folders` |
| 20260806 | **Fix de recursão infinita (42P17)** nas policies de `teams`/`team_members` — helpers `is_team_member`/`is_team_admin`/`is_team_owner` (SECURITY DEFINER) |
| 20260807 | **Armazenamento D21**: `root_folder`/`agencia`/`equipe` em `user_storage_settings`, default `folder_template` → `{cliente}/{ano}/{mes_completo}/{dia}/{tipo}`, e `posts.is_feedback` |
| 20260808 | **Arquivamento automático (D23)**: `posts.archived_at` — aprovado após a data vira arquivo; publicado fora da semana atual também |

> Nota: migrations 001–005 não estão no repositório (banco criado antes da
> padronização). Para reproduzir do zero, as migrations 006+ assumem tabelas
> pré-existentes. Ideal futuro: criar migrations 001–005 consolidando o schema-base.

### O que cada tabela significa

- **`posts`** — o post com `status`, `post_type`, `scheduled_at`, `media_urls`
  (JSONB: lista de URLs), `version`, `client_id`, `user_id`.
- **`post_feedbacks`** — mural do post (mensagens + logs com `version_name`).
- **`clients`** — dossiê completo (branding, links, métricas, review_token).
- **`feedback_cards`** + `feedback_card_attachments/checklist_items/comments` — kanban.
- **`post_versions`** — snapshots de versões.

## RLS: a segurança por dados

**RLS** = cada SELECT/INSERT/UPDATE/DELETE é filtrado pelo banco. O app nunca
confia no cliente: mesmo que alguém chame o Supabase com a anon key direto, só
vê o que a política permite.

Padrões usados:

1. **Dono vê o seu** (migração 015): `USING (user_id = auth.uid())`.
2. **Filhos herdam o dono do pai** (feedbacks/cards/versions):
   `EXISTS (SELECT 1 FROM posts WHERE posts.id = ... AND posts.user_id = auth.uid())`.
3. **Anon restrito ao fluxo de review**: `posts` selecionável por anon via
   `review_token`, e `clients` selecionáveis só se `review_token IS NOT NULL`.

> **Por que `anon` pode ler posts?** Porque o fluxo de review público
> (`/review/:token`) funciona sem login: o cliente navega pelo link, e o token
> garante que ele só acessa o que o link aponta. A leitura anon de `posts` é
> intencional — mas toda **escrita** protegida exige token válido.

## SECURITY DEFINER + validação (migração 014)

Funções como `approve_post`, `undo_approve_post`, `send_client_feedback` e
`approve_all_posts` rodam com privilégio elevado (`SECURITY DEFINER`) porque
precisam fazer **operações atômicas** (atualizar status + inserir log) que o anon
não poderia fazer linha a linha. A migração 014 adicionou **validação rigorosa**:

- Rejeita parâmetros nulos e tokens inexistentes (`RAISE EXCEPTION 'Unauthorized'`).
- Limita tamanho da mensagem (máx 2000) e do nome (máx 100).
- Usa `SET search_path = public` (defesa contra "search_path hijacking").

**Regra de ouro**: qualquer função `SECURITY DEFINER` precisa validar entrada e
fixar `search_path`. Sem isso, um anon poderia explorar para ler/alterar dados.

## Auth: registro e login

Fluxo com o Supabase Auth:

- **Cadastro**: `signUp` (email + senha), com confirmação de e-mail.
- **Login**: `signInWithPassword`; erros diferenciados (e-mail não registrado vs senha errada).
- **Recuperação**: `resetPasswordForEmail` → e-mail com link mágico → página `/redefinir-senha` → `updateUser({ password })`.
- **Sessão**: `getSession` + `onAuthStateChange` (em `use-auth.tsx`); `ProtectedRoute` redireciona se não logado.

> O fluxo `/review/:token` **não usa auth** — é o cliente aprovando sem conta.

## Storage

Bucket público `posts-media` (limitado a 10 MB, MIME types permitidos: jpeg/png/webp/gif/mp4/webm) para mídias dos posts. No upload, as imagens passam por **compressão no cliente** (`src/lib/compress-image.ts`) antes de ir ao storage — economiza banda e armazenamento.

## Realtime

A tabela `posts`, `post_feedbacks` e `feedback_cards` estão na publicação
`supabase_realtime`. O chat por post e o kanban usam `.channel(...).on('postgres_changes', ...)`
para atualizar a UI **sem refresh** quando outra pessoa (gestor ou cliente via review)
altera algo. Ex.: quando o cliente aprova pelo link, o kanban do gestor atualiza
sozinho.

> **Realtime é progressivo, não essencial.** Alguns navegadores mobile/WebViews
> bloqueiam WebSocket (`WebSocket not available: The Operation is insecure` — um
> `SecurityError` que o `realtime-js` propaga como erro **síncrono** e derrubava o
> app inteiro via ErrorBoundary). O app subscreve via `src/lib/realtime.ts`
> (`subscribeRealtime`): se o WebSocket lançar, ele registra um warn e segue —
> as páginas continuam funcionando com dados carregados por `fetch` no mount
> (só perdem a atualização automática). Padrão: **feature enriquecida por websocket
> com fallback silencioso**.

## Edge Function: `verify-turnstile`

```ts
// supabase/functions/verify-turnstile/index.ts (Deno)
const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
  method: 'POST',
  body: formData,   // secret + token
})
```

Servidor sem estado (Deno) que valida o token do Turnstile contra a Cloudflare.
O **segredo não pode ficar no frontend**, então a verificação real acontece aqui,
com `TURNSTILE_SECRET_KEY` do ambiente da Supabase.

## Praticar

1. No painel do Supabase, abra a tabela `posts` e confira as policies RLS de cada uma.
2. Explique com suas palavras: por que `anon` pode dar SELECT em `posts` mas o `INSERT` exige token?
3. Leia `src/hooks/use-auth.tsx`: como a sessão é restaurada após refresh da página?
4. Tente `curl` no endpoint da edge function sem token — o que deve acontecer?

**Anterior**: [`04-dominio-tipos.md`](04-dominio-tipos.md) · **Próximo**: [`06-fluxos-frontend.md`](06-fluxos-frontend.md)
