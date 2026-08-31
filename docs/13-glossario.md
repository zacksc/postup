# 13 — Glossário

> Termos técnicos e de domínio usados na wiki e no código, em ordem alfabética.

## A–C

- **anon key**: chave pública do Supabase que o frontend usa. Ela **não é um segredo**
  — a segurança vem das políticas RLS, não da chave.
- **allowlist / denylist**: lista de coisas permitidas (allow) ou bloqueadas (deny).
  "Deny por padrão" = bloqueia tudo e libera só o necessário (como a CSP do projeto).
- **cva** (`class-variance-authority`): lib que define variantes de estilo com tipos.
- **CSP (Content-Security-Policy)**: header que diz ao navegador o que ele pode carregar
  (script, frame, imagem...). O PostUp usa para limitar recursos a domínios conhecidos.
- **code-splitting**: dividir o JS em vários arquivos (chunks) que só são baixados quando necessários.
- **chunk**: arquivo JS gerado no build (ex.: uma página lazy-loadada).

## D–H

- **denormalização**: guardar cópias de dados (ex.: `client_name` dentro de `posts`)
  para evitar JOINs. Trade-off: pode ficar desatualizado.
- **deno**: runtime de JS/TS server-side usado pelas edge functions do Supabase.
- **edge function**: função serverless executada na borda (perto do usuário).
  No PostUp: `verify-turnstile`.
- **flat config**: formato novo de configuração do ESLint 9 (arquivo `eslint.config.js`).
- **HMR (Hot Module Replacement)**: atualiza o módulo alterado no navegador sem recarregar a página.
- **hook**: função React que começa com `use` e encapsula estado/efeitos (ex.: `useAuth`).

## I–O

- **idempotente**: operação que pode rodar várias vezes com o mesmo resultado
  (ex.: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
- **JSONB**: coluna Postgres que guarda JSON de forma otimizada (busca e validação).
- **lazy loading**: carregar algo apenas quando necessário (ver code-splitting).
- **lockfile** (`package-lock.json`): trava versões exatas das dependências
  (`npm ci` usa ele para builds reproduzíveis).
- **mock**: substituir uma dependência real (ex.: Supabase) por uma falsa nos testes,
  para testar a UI isoladamente.
- **migration**: arquivo SQL versionado que evolui o schema do banco.
- **onAuthStateChange**: listener do Supabase que avisa quando a sessão muda
  (login, logout, recovery).
- **Outlet**: componente do React Router que renderiza a rota filha dentro de um layout.
- **<Navigate> (React Router)**: componente que redireciona **durante o render** —
  antes do paint. Ideal para redirect invisível (sem flash). O oposto de `navigate()`
  em `useEffect`, que roda **depois** do paint.
- **ffmpeg.wasm**: ffmpeg compilado para WebAssembly, roda no navegador.
  Usado por `src/lib/compress-video.ts` para comprimir vídeo no cliente.
- **lightbox**: modal escuro que mostra a mídia em grande (com setas/contador).
- **poster**: atributo do `<video>` que define a imagem exibida antes do playback.
- **upscaling**: aumentar a resolução de uma imagem/vídeo além da original
  (perde qualidade e não ganha detalhe). O PostUp nunca faz upscaling.

## P–R

- **palette**: paleta de cores do branding de um cliente (usada nos posts dele).
- **policy (RLS)**: regra que define o que cada papel (anon/authenticated) pode fazer
  com cada linha da tabela.
- **prop drilling**: passar props por vários níveis de componentes até chegar onde é usado.
- **publish (supabase_realtime)**: a "fila" de eventos do Postgres que o realtime escuta.
- **realtime**: atualização automática via websocket quando o banco muda
  (ex.: chat gestor↔cliente).
- **RPC**: função chamável pela API do Supabase (ex.: `check_email_exists`,
  `approve_post`).
- **RLS (Row Level Security)**: segurança do Postgres que filtra linhas por política.
- **review_token**: código criptográfico do cliente usado no link `/review/:token`.

## S–Z

- **SECURITY DEFINER**: função SQL que roda com privilégios do dono, ignorando RLS
  do chamador. Exige validação de entrada obrigatória.
- **snapshot**: cópia do estado de um post numa versão (para histórico/restore).
- **tree-shaking**: o bundler remove código não usado (ex.: só importa o ícone que usa).
- **Turnstile**: CAPTCHA da Cloudflare (invisível ao usuário em modo-managed).
- **vite (import.meta.env)**: variáveis de ambiente do Vite; só expõe as com prefixo `VITE_`.
- **XSS (Cross-Site Scripting)**: ataque que injeta script em páginas vistas por outros
  usuários. O PostUp combate com `DOMPurify.sanitize`.
- **Zustand**: lib de estado global (instalada no projeto, atualmente não usada —
  o estado global é Context API).

## Termos de domínio (produto)

- **Dossiê do cliente**: página `/clients/:clientId` com identidade visual, métricas
  e progresso do cliente.
- **Kanban de feedbacks**: quadro estilo Trello com cards de solicitação de alteração.
- **Post**: peça de conteúdo (reels, carrossel, foto, stories, design).
- **Status do post**: `rascunho → aguardando → (alteracao) → aprovado → publicado`.
- **Versão**: snapshot numerado do post; dá para restaurar versões anteriores.

## Fim

Parabéns por chegar até aqui! Você já percorreu do "o que é o produto" até as
decisões de arquitetura. O próximo passo natural: o [`ROADMAP.md`](../ROADMAP.md),
que organiza tudo em trilhas de estudo. E depois, para contribuir com o código,
o **Checklist de prontidão**: `npm run lint` + `npm run build` + `npx vitest run` + `npx tsc --noEmit`.
