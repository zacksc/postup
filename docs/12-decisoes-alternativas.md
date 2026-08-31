# 12 — Registro de decisões e alternativas

> **Objetivo**: documentar as decisões de arquitetura/técnica que o PostUp tomou,
> por que foram tomadas, e o que foi rejeitado — com o raciocínio completo.

## Como ler este arquivo

Cada seção segue o formato:

- **Contexto**: o problema que apareceu.
- **Decisão**: o que fizemos.
- **Por quê**: o raciocínio.
- **Alternativas rejeitadas**: o que consideramos e por que não serviu.
- **Reavaliar quando**: a condição que indicaria trocar de decisão.

---

## D1 — Migração para TypeScript

- **Contexto**: projeto iniciado em JavaScript; erros só apareciam em runtime; o domínio
  (status, tipos, versões) estava ficando complexo.
- **Decisão**: migrar para TypeScript com typescript-eslint e `no-explicit-any` no lint.
- **Por quê**: erros de tipo viraram erros de compilação; refatorações ficaram seguras;
  o domínio virou "tipos falantes" (ver `04-dominio-tipos.md`).
- **Alternativas rejeitadas**: JSDoc (JS + comentários de tipo) — verboso e não bloqueia
  no build. Continuar JS — insustentável no tamanho atual.
- **Reavaliar quando**: nunca (já está feito).

## D2 — SPA (Vite) em vez de Next.js/SSR

- **Contexto**: precisávamos de um app autenticado com dashboard, drag-and-drop, realtime.
- **Decisão**: Vite + React SPA, deploy estático na Vercel.
- **Por quê**: o conteúdo não é indexável/publico (requer login), logo SSR não agrega SEO;
  Vite é mais simples (sem servidor Node próprio) e o Supabase já cobre o backend.
- **Alternativas rejeitadas**: **Next.js** (SSR desnecessário, mais infra), **Remix**
  (sobreposição com Supabase), **SvelteKit/Vue** (ecossistema menor do time).
- **Reavaliar quando**: se o app precisar de páginas públicas indexáveis (SEO) ou de
  server-render com muitos dados — aí Next.js/Astro pode valer.

## D3 — Supabase em vez de Firebase / backend próprio

- **Contexto**: precisávamos de banco relacional, auth, storage e realtime sem servidor próprio.
- **Decisão**: Supabase (Postgres + Auth + Storage + Realtime + Edge Functions).
- **Por quê**: SQL relacional (posts/clients/cards com FKs) casa perfeitamente com o
  domínio; RLS dá segurança a nível de banco; open-source, sem lock-in; o Postgres
  permite funções `SECURITY DEFINER` (fluxo de review).
- **Alternativas rejeitadas**: **Firebase** (NoSQL, RLS mais frágil no Firestore,
  queries limitadas), **backend próprio** (Node/Express: custo de servidor, auth,
  infra — excessivo para o porte), **Supabase self-hosted** (implantação local
  exigida apenas se houver requisito de dados on-prem).
- **Reavaliar quando**: se o produto crescer muito (centenas de milhares de usuários),
  RLS e rate-limit do Supabase podem ser gargalo — aí avaliar backend próprio com
  Postgres direto.

## D4 — RLS com `user_id` (tenant isolation por usuário)

- **Contexto**: originalmente as policies eram `USING (true)` (audit, migração 006) —
  qualquer usuário logado via todos os dados de todos.
- **Decisão**: migração 015 adicionou `user_id` nas tabelas e RLS `user_id = auth.uid()`
  (e `EXISTS` para tabelas filhas), com backfill para o primeiro usuário.
- **Por quê**: o produto será usado por múltiplos gestores; vazar dados entre contas é
  violação grave de segurança (e da confiança do portfólio).
- **Alternativas rejeitadas**: políticas por `team_id` (migração de teams existe, mas
  ainda não é o padrão); roles complexas (ainda sem necessidade real de RBAC fino).
- **Reavaliar quando**: na fase de "equipes" (o schema `profiles_and_teams` já existe),
  migrar de `user_id` para `team_id`/membership quando múltiplos gestores da MESMA
  agência precisarem ver os mesmos clientes.

## D5 — Review do cliente sem login (link com token)

- **Contexto**: o cliente final (dono do Instagram) não pode ter que criar conta.
- **Decisão**: rota pública `/review/:token`; `clients.review_token`; funções
  `SECURITY DEFINER` que exigem o token correto.
- **Por quê**: o link É o segredo (como um convite); a experiência do cliente é
  "abre, aprova, fecha". RLS ainda protege os dados do gestor; anon só lê o que o
  token permite e só escreve validando o token.
- **Alternativas rejeitadas**: criar conta para o cliente (atrito gigante), magic-link
  com Supabase (exige e-mail configurado e fluxo mais complexo), expor tudo público
  (inseguro).
- **Reavaliar quando**: se houver exigência de "quem aprovou exatamente" auditável com
  identidade forte — aí trocar por magic-link assinado (mais forte que token estático).

## D6 — Turnstile (Cloudflare) no login/cadastro

- **Contexto**: formulários públicos abertos a bots (criação de conta em massa, brute force).
- **Decisão**: Turnstile + edge function `verify-turnstile` para validar no servidor.
- **Por quê**: gratuito, sem CAPTCHA "chato" (invisible-mode disponível), e a validação
  server-side com secret é o único jeito seguro (segredo não vai ao bundle).
- **Alternativas rejeitadas**: **reCAPTCHA v2/v3** (Google, rastreamento e UX pior),
  **hCaptcha** (menos integração), **rate-limit só no front** (não protege contra
  quem chama a API direto). Nota: o login "sem captcha" para usuários já conhecidos
  foi desbloqueado em `1680580` — o captcha é exigido só quando o e-mail parece suspeito.
- **Reavaliar quando**: se o tráfego de bots aumentar, adicionar rate-limit real no
  Supabase e/ou verificar `User-Agent`/IP.

## D7 — Estado global: Context API (Zustand está instalado, mas não usado)

- **Contexto**: o package.json declara `zustand`, mas o código usa Context + hooks locais.
- **Decisão**: manter Context enquanto o estado global é "auth + tema".
- **Por quê**: menos abstração; o estado compartilhado é pequeno e raramente muda fora
  do render. Migrar para Zustand não resolve dor real hoje.
- **Alternativas rejeitadas**: Redux Toolkit (boilerplate), Jotai (outra lib para
  aprender), migrar já para Zustand (prematura).
- **Reavaliar quando**: quando o realtime/websocket atualizar várias telas ao mesmo
  tempo, ou o estado global crescer além de auth+tema.

## D8 — Sanitização com DOMPurify no cliente

- **Contexto**: legendas/mensagens de usuários são re-renderizadas (HTML).
- **Decisão**: `sanitize()` com `ALLOWED_TAGS: []` (remove todo HTML) e limite de tamanho.
- **Por quê**: a UI não precisa de rich text do usuário; remover tudo é mais simples e
  seguro que allowlist de tags. Combina com o limite de 2000 chars no banco (migração 014).
- **Alternativas rejeitadas**: allowlist de tags (`<b>`, `<i>`) — risco residual e
  complexidade; sanitização só no backend — a UI também renderiza dados vindos de
  outras fontes (chat realtime).
- **Reavaliar quando**: se precisarmos de rich text de verdade, migrar para um editor
  que já sanciona (ex.: Tiptap + sanitize no backend também).

## D9 — Sem React Query / SWR (hooks próprios)

- **Contexto**: muitas telas buscam os mesmos dados (posts, feedbacks).
- **Decisão**: hooks próprios com `useState`/`useEffect` + chamadas diretas ao Supabase.
- **Por quê**: o volume por usuário é pequeno (dezenas/centenas de linhas); fetch na
  montagem é aceitável; reduz dependências e camada de abstração.
- **Alternativas rejeitadas**: **React Query** (ótimo, mas adiciona cache/invalidação/
  retry que hoje ninguém precisou), **SWR** (igual), **realtime em tudo** (custo e
  complexidade).
- **Reavaliar quando**: se houver listas grandes, dedupe de requisições, paginação ou
  invalidação coordenada entre telas. React Query + Supabase é a evolução natural.

## D10 — Denormalização de `clientName/clientColor` no post

- **Contexto**: cards/cronograma precisam do nome e cor do cliente.
- **Decisão**: copiar `client_name`, `client_handle`, `client_color` no `posts` (migração 006).
- **Por quê**: evita JOIN + lookup por cliente a cada card renderizado; leitura muito
  mais comum que escrita; o custo (nome desatualizado em posts antigos) é aceitável.
- **Alternativas rejeitadas**: JOIN sempre (lento em grids grandes), lookup no front
  por `clientId` (N+1), view materializada (complexidade).
- **Reavaliar quando**: se a edição de nome do cliente precisar refletir nos posts
  imediatamente — aí trigger de atualização ou JOIN.

## D11 — Sem Sentry (error tracking adiado)

- **Contexto**: audit de lançamento considerou monitoramento de erros.
- **Decisão**: Sentry foi instalado e **removido** (commit `1680580`).
- **Por quê**: custo/limite do plano + setup não justificavam agora; o app tem
  tratamento local de erros razoável (try/catch + toasts).
- **Alternativas**: Highlight.io (open-source, custo menor), PostHog (product analytics
  + errors), Rollbar, Bugsnag, OpenReplay (session replay).
- **Reavaliar quando**: antes do primeiro lançamento público real com usuários de
  verdade — adicionar error tracking é prioridade de produção, não de desenvolvimento.

## D12 — Lazy loading em todas as páginas

- **Contexto**: bundle inicial crescia com cada página nova.
- **Decisão**: `lazy(() => import(...))` + `<Suspense>` para todas as rotas.
- **Por quê**: cada página vira um chunk separado; o app abre mais rápido (principalmente
  em mobile — usuário final do produto).
- **Alternativas rejeitadas**: bundle único (simples, mas lento), micro-frontends (exagero).
- **Reavaliar quando**: se o chunk de alguma página ficar gigante, adicionar mais
  splitting interno ou import dinâmico de libs pesadas (ex.: fullcalendar).

## D13 — Erros de login diferenciados (e-mail não registrado vs senha errada)

- **Contexto**: UX ruim — mensagem genérica para tudo.
- **Decisão**: mensagens diferentes + contador de 3 tentativas oferecendo "esqueci a senha".
- **Por quê**: ajuda o usuário legítimo. Trade-off aceito: enumeração de e-mails
  (um atacante pode descobrir se um e-mail existe). Como o cadastro tem captcha e
  o app exige e-mail confirmado, o risco é controlado.
- **Alternativas rejeitadas**: mensagem única genérica (seguro, mas péssimo UX);
  nunca revelar (piora suporte).
- **Reavaliar quando**: se houver suspeita de abuso de enumeração, mesclar as mensagens
  novamente OU exigir captcha antes mesmo de checar o e-mail.

## D14 — Backfill e migrations 001–005 ausentes

- **Contexto**: banco criado antes da padronização; migrations começam na 006.
- **Decisão**: manter as migrations 006+ como estão; documentar a limitação.
- **Por quê**: o banco de produção já existe; recriar o schema-base com `IF NOT EXISTS`
  foi o pragmático. Uma migration 001–005 consolidada ajudaria a reproduzir o banco
  do zero (ideal para ambiente de staging).
- **Reavaliar quando**: se precisar de ambiente de staging/preview com schema completo —
  criar migrations 001–005 consolidando tabelas-base.

## D15 — Compressão de vídeo no navegador (720p, bitrate calculado, sem upscaling)

- **Contexto**: uploads de reels de centenas de MB estouravam o storage gratuito (1 GB) e ficavam pesados para preview.
- **Decisão**: `src/lib/compress-video.ts` usa **ffmpeg.wasm** (lazy, ~30MB só baixado no primeiro vídeo grande) para transcodificar para H.264/AAC. Limites: `MAX_MEDIA_SIZE = 30MB` (ajustável via `VITE_MAX_MEDIA_SIZE`), `MAX_DIMENSION = 720`, `CRF` variável. Filtro `scale=min(720\,iw):min(720\,ih):force_original_aspect_ratio=decrease` → **nunca faz upscaling**.
- **Estratégia para caber no limite** (em vez de erro "arquivo grande demais"):
  1. Se o arquivo ≤ `MAX_MEDIA_SIZE` → mantém original.
  2. Lê a **duração** via `<video>` (metadata, sem baixar ffmpeg) e calcula o **bitrate-alvo**: `(targetBytes × 8 ÷ duração) − áudio`. `targetBytes = limite × 0.85` (margem de segurança).
  3. Codifica com `-b:v/-maxrate/-bufsize` do bitrate calculado e **verifica o tamanho real** do resultado.
  4. Se ainda estourar, desce numa **escada**: bitrate ×0.7 → ×0.5 → ×0.35 → resolução 540p/480p/360p (até 8 tentativas), devolvendo o **menor resultado obtido** — nunca o erro cru de upload.
  5. Sem duração conhecida (codec estranho), cai na escada por **CRF crescente** (28→40).
- **Por quê**: previews em cards de ~400px não precisam de 4K; 30MB é o teto de UX que o usuário pediu; "tentar caber no limite calculando bitrate" é muito melhor que "recusar o arquivo".
- **Alternativas rejeitadas**: compressão no servidor/edge (custo e latência; o Supabase free não roda ffmpeg), limitar tamanho de upload (UX ruim), não comprimir (storage esgota), CRF fixo (tamanho de saída imprevisível — estoura o limite sem tentativa de reduzir).
- **Reavaliar quando**: se o Supabase subir o plano/storage, aumentar o `SIZE_THRESHOLD`/`MAX_MEDIA_SIZE`; se precisar de 1080p real, subir `MAX_DIMENSION` (e o custo de CPU). **Atenção**: o bucket `posts-media` ainda está limitado a 10 MB (migração 006) — ao migrar para R2 (D19), o limite por arquivo deixa de existir e o `MAX_MEDIA_SIZE` passa a valer de verdade.

## D16 — Capa de reels: convenção `media_urls = [capa, vídeo]`

- **Contexto**: reels precisam de capa para o preview; o usuário nem sempre envia.
- **Decisão**: a capa vira o **primeiro item** de `media_urls` (`[capa, vídeo]`); sem capa enviada, `generateVideoFrame` (`src/lib/video-frame.ts`) extrai um frame aleatório (20–80% da duração, canvas, max 720, JPEG 0.82). O helper `hasCoverInMediaUrls` (`src/lib/utils.ts`) detecta se `media_urls[0]` não é vídeo e há um vídeo depois.
- **Por quê**: sem schema novo (é só uma lista ordenada), determinístico e a própria lista é a fonte da verdade.
- **Alternativas rejeitadas**: coluna `cover_url` separada (dois campos a manter sincronizados), capa obrigatória (atrito para o usuário), serviço externo de thumbnail (dependência).
- **Reavaliar quando**: se houver mais de um vídeo por post ou carrossel de capas — aí migrar para uma estrutura mais explícita.

## D17 — Lightbox de mídia com remontagem via `key` (em vez de efeito)

- **Contexto**: o lightbox (`MediaLightbox.tsx`) precisava resetar o índice a cada abertura.
- **Decisão**: `key={lightboxOpen ? 'lightbox-open' : 'lightbox-closed'}` no `<MediaLightbox>` → o React **desmonta e remonta** o componente, e `useState(startIndex)` reinicializa sozinho.
- **Por quê**: a regra de lint `react-hooks/set-state-in-effect` proíbe `setState` síncrono em `useEffect`; remontar por `key` é declarativo (sem efeito, sem state duplicado) e satisfaz o lint. O vídeo usa `autoPlay + controls` SEM `muted` (é o propósito do lightbox: som).
- **Alternativas rejeitadas**: `useEffect(() => setIndex(...), [open])` (viola o lint), estado no pai com controle manual (acoplamento desnecessário), sempre re-montar com `useMemo`.
- **Reavaliar quando**: se o lightbox ganhar estado complexo (muitas transições), considerar `useReducer` interno — mas o `key` segue sendo o reset mais simples.

## D18 — Redirect invisível: `<Navigate>` no render, nunca em `useEffect`

- **Contexto**: a landing "aparecia por trás" para usuários logados (bug B09, commit `1d9d922`).
- **Decisão**: `Landing.tsx` passou a fazer gate no render — `if (loading) spinner`, `if (user) return <Navigate to="/home" replace />` — e o `Breadcrumb` aponta a casinha para `/home`. O `useEffect` de redirect foi removido.
- **Por quê**: `useEffect` roda **depois do paint** — a tela (a landing) já foi mostrada ao usuário por ≥1 frame. `<Navigate>` navega durante o commit, **antes do paint**, então nunca há flash. É o mesmo padrão do `ProtectedRoute`. `replace` ainda evita poluir o histórico.
- **Alternativas rejeitadas**: manter o redirect em `useEffect` (flash intermitente), esconder a landing com CSS (gambiarra), mudar a rota `/` para nunca ser acessível (quebra o fluxo de visitantes).
- **Reavaliar quando**: nunca — é regra permanente do projeto: **redirect que precisa ser invisível = render-time**.

## D19 — Storage de mídias: migrar do Supabase (1 GB) para Cloudflare R2

- **Contexto**: o bucket gratuito do Supabase tem 1 GB e estoura rápido com vídeos/múltiplos
  clientes; a compressão (D15) só adiou o problema.
- **Decisão**: migrar as mídias para **Cloudflare R2** (10 GB free permanente, egress $0,
  S3-compatible). Plano detalhado em `16-storage-midias.md`.
- **Por quê**: 10 GB grátis vs 1 GB; **egress $0 para sempre** (vídeos servidos aos clientes
  não cobram saída); API S3 → sem lock-in (trocar depois é trocar endpoint); custo zero até
  ~10 GB; mesmo ecossistema Cloudflare que o Turnstile.
- **Alternativas rejeitadas**: **Backblaze B2** (também 10 GB free e storage mais barato
  $0.006/GB-mês, mas região única e egress paga fora do Cloudflare) — ótimo plano B se passar
  de 10 GB; **upgrade Supabase Pro** ($25/mês recorrente, desnecessário no estágio atual);
  **AWS S3** (free só 12 meses e egress caro).
- **Reavaliar quando**: se o volume ultrapassar ~10 GB, comparar R2 ($0.015/GB-mês) vs
  B2+Cloudflare ($0.006/GB-mês); se o app precisar de storage privado com signed URLs,
  reavaliar (R2 público atual atende pois mídia é pública por design).

## D20 — Storage por usuário: Google Drive BYO (implementado antes do R2)

- **Contexto**: a D19 recomendava migrar para Cloudflare R2 (10 GB free) — infra que
  o projeto pagaria/gerenciaria. Para **$0 de custo operacional e sem assinatura**, o
  usuário optou por **BYO (bring-your-own)**: cada usuário conecta o **próprio** Google
  Drive via OAuth e as mídias dele vão para a conta dele (15 GB free por conta Google).
- **Decisão**: implementar Google Drive BYO agora; R2/B2 (D19) fica como plano de migração
  para quando o volume agregado justificar.
- **Como funciona**: OAuth `drive.file` (escopo mínimo, só arquivos que o app cria) com
  `access_type=offline`; o `refresh_token` é guardado **criptografado (AES-GCM, chave
  `DRIVE_ENCRYPTION_KEY` que só existe no edge function)** na tabela `user_drive_connections`.
  O upload dos bytes é feito **do browser direto pro Google** (sessão resumable, sem passar
  no edge). Se o usuário não conectou o Drive → fallback no bucket Supabase `posts-media`.
- **Arquivos**: edge functions `drive-oauth` (start/callback), `drive-upload` (start/share),
  `drive-status`; `_shared/cors.ts` e `_shared/crypto.ts`; migration
  `20260802_user_drive_connections.sql` (tabela + RLS + RPCs `upsert_drive_connection`/
  `delete_drive_connection`); front `src/lib/media-storage.ts` (camada única de upload),
  `src/hooks/use-drive.ts`, rota `/drive/callback`, card no Perfil.
- **Trade-offs**: cada conta Google cede 15 GB (menos que os 10 GB do R2 se somados por
  usuário, mas por usuário é mais); escopo `drive.file` + arquivos públicos "qualquer um
  com link" mantém a mídia pública como hoje (mesma regra: o painel é que é restrito).
- **Reavaliar quando**: se o app ganhar muitos usuários (fragmentação de storage e taxa de
  OAuth do Google) ou se mídia privada com signed URLs for necessária → migrar para R2/B2
  (D19) como storage central, mantendo a camada `media-storage.ts` intacta (é plugável).

## D21 — Fluxo de pastas no Google Drive por usuário (implementado)

- **Contexto**: com o Drive BYO (D20), os uploads iam todos para a **raiz** do Drive do
  app (`parents: []`) — sem organização. O usuário pediu hierarquia por cliente/data/tipo
  e a possibilidade de personalizar.
- **Decisão**: template de pastas por usuário (default `{cliente}/{ano}/{mes}/{dia}/{tipo}`),
  configurável em **Configurações → Armazenamento**, com placeholder `{sequencia}` para
  stories (subpasta que agrupa os arquivos na ordem de postagem).
- **Como funciona**: `src/lib/drive-folders.ts` expande o template no client (função pura,
  testada) usando o contexto do post (cliente, data, tipo, sequência); a edge `drive-upload`
  resolve/cria a hierarquia no Drive iterando os segmentos e usa o cache `drive_folders`
  (path→folder_id) para não recriar pastas; config em `user_storage_settings` (RLS por usuário).
- **Arquivos**: `src/lib/drive-folders.ts`, `src/hooks/use-storage-settings.ts`, aba
  Armazenamento em `src/pages/Configuracoes/Configuracoes.tsx`, mudanças em
  `src/lib/media-storage.ts` (aceita `options.context`) e `NovoPost.tsx`/`PostModal.tsx`
  (passam contexto), migrations `20260805_storage_settings.sql`.
- **Trade-offs**: expansão do template no client (a edge só recebe o path pronto) — se um dia
  o template precisar ser aplicado com segurança no servidor, move-se o `buildFolderPath`
  para `_shared` (função é pura). Cache `drive_folders` pode ficar velho se o usuário apagar
  pastas manualmente → o `files.get` detecta e recria.
- **Reavaliar quando**: se entrar trabalho em equipe com template por time (hoje é por usuário)
  ou se o usuário quiser assinatura/grupos no caminho (adicionar placeholder).

## Praticar

1. Escolha 2 decisões (D4 e D9) e escreva, com suas palavras, o que mudaria se a escolha tivesse sido a alternativa.
2. Para cada decisão, anote a condição "reavaliar quando" — esse é o gatilho de evolução do projeto.
3. Proponha uma decisão D20 (uma escolha que VOCÊ faria diferente e por quê) — compare com a atual.

**Anterior**: [`11-deploy-vercel.md`](11-deploy-vercel.md) · **Próximo**: [`13-glossario.md`](13-glossario.md) · **Checklist vivo**: [`14-checklist-bugs-polimentos.md`](14-checklist-bugs-polimentos.md)
