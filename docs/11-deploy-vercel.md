# 11 — Deploy na Vercel e operação

> **Objetivo**: entender a configuração de deploy, as variáveis de ambiente e o
> checklist de operação do PostUp.

## A arquitetura de deploy

```
GitHub (main / production)  →  CI (lint + types + build + tests)
        │
        ▼
      Vercel  →  build (npm run build)  →  dist/  →  https://postupapp.vercel.app
        │
        └── Supabase (banco + storage + edge functions) — host separado
```

O PostUp tem **2 branches principais**: `main` e `production`. O fluxo usado é
promover `main` → `production` quando uma versão está pronta para ir ao ar
(o CI roda nos dois).

## `vercel.json`

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- `framework: vite` → a Vercel detecta o output padrão.
- **`rewrites` é ESSENCIAL para SPA**: sem isso, navegar direto para `/clientes/abc`
  (ou refresh numa rota interna) daria 404. O rewrite manda tudo para `index.html`
  e o React Router assume a rota.

## Variáveis de ambiente

| Variável | Onde | Uso |
|----------|------|-----|
| `VITE_SUPABASE_URL` | frontend (Vercel + `.env.local`) | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | frontend (Vercel + `.env.local`) | Chave pública do cliente |
| `VITE_TURNSTILE_SITE_KEY` | frontend (Vercel) | Chave pública do captcha (widget) |
| `TURNSTILE_SECRET_KEY` | **edge function** (Supabase) | Chave secreta de validação |

**Regras de env no Vite:**

- Só variáveis com prefixo `VITE_` ficam disponíveis no bundle do navegador.
- `TURNSTILE_SECRET_KEY` **nunca** pode ter prefixo `VITE_` — senão vazaria para o cliente.
- `.env.example` documenta as 4; `.env.local` (real, gitignored) contém os valores.

> **Estado atual**: as 3 variáveis do frontend estão definidas na Vercel
> (confirmado inspecionando o bundle de produção — ver abaixo). O fallback de
> teste do Turnstile (chave de testes da Cloudflare) continua valendo para
> ambientes locais sem chave.

## Conferir o que está de fato em produção

A SPA minifica tudo; o `index.html` de produção mostra o hash dos assets
(`assets/index-*.js`). Para confirmar que o deploy tem o código/env esperado:

1. Baixe o `index.html` de produção → confira a **CSP** e os hashes dos chunks.
2. O Login é **lazy**: o código dele está em chunks separados
   (`Login-*.js`, `TurnstileWidget-*.js`) — baixe os que interessam.
3. Procure marcadores:
   - **Env vars injetadas**: a URL do Supabase aparece literal no bundle. Se a env
     faltasse, o guard `if (!url || !key) throw ...` viraria constante falsa e o
     minifier **removeria** o throw — a mensagem `Faltam as variáveis...` SOME do
     bundle quando as vars existem (e fica presente quando não existem).
   - **Sitekey real**: `0x...` aparece no chunk do widget; a testkey
     `1x00000000000000000000AA` SOME quando `VITE_TURNSTILE_SITE_KEY` está definida.
   - **Versão do código**: procure mensagens de UI que só existem a partir de um
     commit (ex.: a mensagem do widget "código {error}" veio no `2b60d38`).

## GitHub Actions (CI + deploy)

Dois workflows em `.github/workflows/`:

- **`ci.yml`**: roda em push para `main` — lint, tsc, build, testes (sem precisar
  de `.env.local`: o `vitest.config.ts` define `test.env` com placeholders).
- **`deploy.yml`**: roda em push para `production` — `npm ci` → `npx tsc --noEmit`
  → `npm run build` → publica na Vercel **via CLI oficial com cloud build**
  (`npx vercel deploy --prod --yes`). A Vercel constrói usando as env vars reais
  do projeto (Settings → Environment Variables).

O passo de deploy precisa de 3 **secrets do GitHub** (repo → Settings → Secrets):

| Secret | Onde obter |
|--------|-----------|
| `VERCEL_TOKEN` | Conta Vercel → Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel → project → Settings → General (**ID do time**, formato `team_...`) |
| `VERCEL_PROJECT_ID` | Vercel → project → Settings → General (formato `prj_...`) |

> **Valores atuais do PostUp** (verificados via API em 2026-08):
> - `VERCEL_ORG_ID` = `team_weVAbkMAs9l9Kf3FyCpKPJva` (time "Ezequiel's projects", slug `ezequiels-projects-cd16ed22`)
> - `VERCEL_PROJECT_ID` = `prj_I1CeiEM20AGkLcqCmYdtVXDqmeHv` (projeto `postup`)
>
> **Bug real (4×)**: além dos erros já documentados abaixo, o deploy falhava com
> *"Could not retrieve Project Settings"* mesmo com secrets configurados — o
> `VERCEL_ORG_ID` estava com o ID da **conta pessoal** (`usr_...`) em vez do ID do
> **time** (`team_...`), então o `vercel pull` não achava o projeto. Confirme o
> `team_...` no dashboard (não copie o slug nem o ID da conta). O passo de deploy
> agora **escreve o `.vercel/project.json` explicitamente** a partir dos secrets
> antes do `vercel pull`, para o link não depender do estado do diretório.

> **Bug real (3×)**: o deploy falhava com *"Input required and not supplied:
> vercel-token"* porque os secrets ainda não estavam configurados; depois, um
> guard `if: ${{ secrets.X != '' }}` no passo **invalidava o workflow inteiro**
> (`Unrecognized named-value: 'secrets'`) — o GitHub Actions NÃO aceita referenciar
> secret inexistente dentro de `if:`. O `fed442e` (fix do realtime) **nunca foi
> publicado pelo Actions** (os runs do deploy falharam) e o app mobile continuava
> quebrando. Fix: os secrets vão apenas em
> `env:` (secret indefinido vira string vazia, sem erro de parse) e a checagem de
> "tem ou não tem secret" acontece **no shell** (se faltar, imprime warning e pula).
> Troquei também a ação de terceiro (`amondnet/vercel-action@v25`, Docker) pelo
> **CLI oficial da Vercel** (`npx vercel deploy --prod`) — menos partes móveis.
>
> **Bug real (5×) — env mascarada quebra o bundle**: `vercel pull` escreve o
> `.vercel/.env.production.local` com os valores de env **mascarados como
> `[SENSITIVE]`** quando as vars do projeto estão marcadas como "Sensitive" no
> dashboard. Se o build usar esse arquivo (ex.: `vercel build` + `vercel deploy
> --prebuilt`), o `VITE_SUPABASE_URL` vira a string `[SENSITIVE]` → o
> `createClient` lança `Invalid supabaseUrl` → **tela branca em TODAS as rotas**
> (inclusive login). Sintomas: o bundle de produção não contém a URL real
> (`vhgbxvpjsvtkjmlkjkvm`) e o app não renderiza nada. Fix: **cloud build**
> (`vercel deploy --prod`) — a Vercel usa as env vars reais do projeto, não o
> arquivo baixado. (Alternativa local: exportar as `VITE_*` no shell antes do
> build — env do processo tem prioridade sobre o arquivo mascarado.)

> **Nota sobre verificação de bundle**: strings de `console.warn` (ex.: a do
> `subscribeRealtime`) **não sobrevivem à minificação de produção** — não use
> mensagens de log como marcador de "fix presente". Use strings de UI, o hash do
> chunk (muda a cada build) ou conte chamadas preservadas (ex.: `removeChannel`).
> Para confirmar que as envs entraram, procure a URL real do Supabase no bundle.

## Supabase

- **Projeto**: `vhgbxvpjsvtkjmlkjkvm` (ref do projeto).
- **Edge function** `verify-turnstile` precisa ter `TURNSTILE_SECRET_KEY` no ambiente.
  Contrato da edge: **sempre HTTP 200** com `{ success }`; em falha retorna
  `{ success: false, error: <error-codes> }` (o `supabase.functions.invoke` trata
  não-2xx como erro e descarta o corpo — ver `docs/07-seguranca.md` §8).
  **Todas as respostas devem mandar `Content-Type: application/json`**: sem ele o
  `functions-js` devolve o corpo como **texto** e `data.success` vira `undefined`.
  **CORS precisa ser tratado na própria função**: a edge retorna `405` ao preflight
  `OPTIONS` se não houver handler — o navegador bloqueia a chamada com
  "Failed to fetch" (e o erro vira a mensagem genérica do captcha). A função
  responde `OPTIONS` com `204` + `Access-Control-Allow-*` (origem `*`, métodos
  `POST, OPTIONS`, headers `authorization, apikey, x-client-info, content-type`).
- **Migrations**: executar via CLI (`supabase db push`) — o schema do banco é versionado
  em `supabase/migrations/`, mas as migrations 001–005 não estão no repo.
- **Bucket** `posts-media` público.

### Google Drive (BYO storage, decisão D20)

As edge functions `drive-oauth`, `drive-upload` e `drive-status` precisam de 4 secrets:

| Secret | Valor |
|--------|-------|
| `GOOGLE_CLIENT_ID` | do OAuth Client no Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | do OAuth Client (só no painel Supabase, nunca no repo) |
| `GOOGLE_REDIRECT_URI` | fallback do redirect; dev = `http://localhost:5173/drive/callback` |
| `DRIVE_ENCRYPTION_KEY` | AES-GCM de 32 bytes: `openssl rand -hex 32` |

Configurar em **Functions → Secrets** no painel do Supabase (ou `supabase secrets set`).

> **Redirect URI dinâmico**: o front envia a própria origem no body do
> `drive-oauth` (`start` e `callback`), então a env só vira fallback. O Google
> exige que a URI esteja **cadastrada** no OAuth Client — registrar **as duas**:
> `http://localhost:5173/drive/callback` (dev) e
> `https://postupapp.vercel.app/drive/callback` (prod). Sem cadastro, o Google
> recusa com `redirect_uri_mismatch`.

> **Quirk do `db push` (colisão de versão)**: o CLI registra cada migration pela
> **prefixo numérica** (a parte antes do `_`). Várias migrations com o mesmo
> prefixo (ex.: 4 arquivos `20260730_*`) colidem na chave única
> `schema_migrations_pkey` e o `db push` falha com *"duplicate key value"*. As
> migrations `20260730_*` abaixo já existem no remoto (aplicadas manualmente);
> para aplicar apenas a migration nova (`20260802_user_drive_connections.sql`),
> mova as colidentes para fora da pasta, rode `supabase db push` e devolva-as.
> Migrations antigas já aplicadas mas fora do histórico podem falhar com
> "already exists" — use `supabase migration repair --status applied <versão>`.
> Obs.: o diretório `supabase/` é gitignored; migrations ficam fora do versionamento.

## Checklist de lançamento (produção)

- [ ] `main` → `production` promovida (merge).
- [ ] CI verde nos dois branches.
- [ ] Env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY` definidas na Vercel (e confirmadas no bundle — ver acima).
- [ ] `TURNSTILE_SECRET_KEY` definida na Supabase edge function.
- [ ] Secrets do GitHub (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`) configurados para o `deploy.yml` publicar de verdade.
- [ ] Edge function `verify-turnstile` no ar (retorna 200 + `success:false` em falha).
- [ ] Testar cadastro real (com confirmação de e-mail), login, review link.
- [ ] Verificar CSP (o captcha precisa carregar — domínio `challenges.cloudflare.com` liberado).
- [ ] `supabase db push` aplicado (se houver migrations novas).
- [ ] Secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `DRIVE_ENCRYPTION_KEY` definidas no Supabase.
- [ ] OAuth Client no Google com as 2 redirect URIs cadastradas (dev + prod) e escopo `drive.file` adicionado manualmente.
- [ ] Sem tela branca em erro: ErrorBoundary global ativo (`src/main.tsx`).

## Comandos úteis

```bash
npm run dev       # local
npm run build     # build de produção
npx supabase db push   # aplica migrations no banco
npx supabase functions deploy verify-turnstile   # publica a edge function
npx supabase functions deploy drive-oauth drive-upload drive-status   # edge functions do Google Drive
npx supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REDIRECT_URI=... DRIVE_ENCRYPTION_KEY=...   # secrets do Drive
npx vitest run    # testes
```

## Praticar

1. Explique por que o `rewrites` é obrigatório para SPA. O que acontece sem ele ao dar F5 em `/posts/abc`?
2. Por que `TURNSTILE_SECRET_KEY` não pode ter prefixo `VITE_`? O que vazaria?
3. Se o banco mudar (nova migration), qual é a ordem correta: deploy do app, `db push`, ou tanto faz?
4. Baixe o bundle de produção e identifique: a URL do Supabase, a sitekey do Turnstile e a ausência da mensagem `Faltam as variáveis...`.

**Anterior**: [`10-testes-qualidade.md`](10-testes-qualidade.md) · **Próximo**: [`12-decisoes-alternativas.md`](12-decisoes-alternativas.md)
