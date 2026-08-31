# 06 — Os fluxos da interface

> **Objetivo**: entender as páginas principais e os fluxos de usuário, mostrando
> como os componentes e hooks se encaixam.

## Mapa das páginas

| Rota | Página | O que faz |
|------|--------|-----------|
| `/` | Landing | Página pública de apresentação |
| `/login` | Login | Entrar (com captcha Turnstile, erros diferenciados) |
| `/cadastro` | Cadastro | Criar conta |
| `/esqueci-senha` | ForgotPassword | Enviar e-mail de recuperação |
| `/redefinir-senha` | ResetPassword | Nova senha (só em sessão de recuperação real) |
| `/review/:token` | ClienteFluxo | **Fluxo do cliente**: aprovar/alterar posts via link, sem login |
| `/home` | Home | Dashboard: métricas, cards atrasados, atividades recentes |
| `/cronograma` | Cronograma | Calendário mensal/semanal; arrastar para criar |
| `/posts/novo` | NovoPost | Criar post: cliente, mídias, legenda, agendamento |
| `/posts/:id` | PostDetalhe | Detalhe do post + mural de feedbacks + versões |
| `/posts/:id/historico` | Historico | Linha do tempo de versões com restore |
| `/clientes` | Clientes | Lista de clientes com progresso |
| `/clientes/novo` | NovoCliente | Criar cliente (formulário com abas) |
| `/clientes/:clientId/editar` | NovoCliente | Editar cliente (mesma página) |
| `/clients/:clientId` | ClientDetail | Dossiê completo do cliente |
| `/grid/:clientId` | GridInstagram | Preview do feed do cliente (3 colunas) |
| `/feedbacks` | Feedbacks | Kanban de cards de feedback (Trello-like) |
| `/perfil` | Perfil | Dados do usuário |
| `/configuracoes` | Configuracoes | Configurações (5 abas) |
| `/logs` | Logs | Timeline de todas as atividades |
| `/chat` | Chat | Chat por post com realtime |
| `/lab` | Lab | "Component Lab": vitrine de componentes (dev) |

## Fluxo 1 — Login com proteção anti-bot

```
Usuário digita email+senha
   │
   ▼
<Login.tsx> verifica: e-mail existe? (rpc check_email_exists)
   │        → se não existe: erro "e-mail não registrado" + sugestão de cadastro
   │
   ▼
Turnstile (captcha Cloudflare) → token
   │
   ▼
<use-auth.signIn> → invoca edge function verify-turnstile (valida token)
   │
   ▼
Supabase signInWithPassword
   │
   ▼
erro? → trata senha errada; após 3 tentativas oferece "esqueci minha senha"
```

Decisões de UX desse fluxo (commit `a348a08`, `8ef4d39`, `a34920c`):

- **Não dar informação demais**: e-mail não registrado vs senha errada são mensagens
  diferentes (ajuda o usuário legítimo; risco de "enumerar usuários" é aceitável
  para o produto atual — anotado como trade-off).
- **Turnstile em cima, botão embaixo**: o captcha não pode vir depois do botão
  (frustra o usuário que clica e falha).
- **Token de uso único**: o widget é resetado a cada tentativa — se o mesmo token
  for reenviado, a Cloudflare responde `timeout-or-duplicate` e mostramos
  "Verificação expirada, resolva novamente".
- **CSP precisa liberar `challenges.cloudflare.com`**: sem isso o captcha nem
  carrega (script, frame, connect, img, worker) — corrigido em `a34920c`.

## Fluxo 2 — Redefinição de senha segura

```
Esqueci senha → supabase.resetPasswordForEmail(email, redirectTo /redefinir-senha)
   │
   ▼  usuário clica no link do e-mail → Supabase dispara evento PASSWORD_RECOVERY
   │
   ▼  use-auth marca sessionStorage('postup_recovery', '1')
   │
   ▼
<ResetPassword> SÓ mostra formulário se isRecoverySession === true
   │  (senão: "link inválido/expirado")
   ▼
Nova senha → updateUser({ password })
```

Isso impede que alguém acesse `/redefinir-senha` direto e troque senha de qualquer
um sem estar numa **sessão de recuperação real** (fix `bf2a312`).

## Fluxo 3 — Review do cliente (sem login)

Rota pública `/review/:token`. O `ClienteFluxo.tsx`:

1. Pega `token` da URL.
2. Busca o cliente por `review_token` (RLS permite anon SELECT de clientes com token).
3. Lista os posts do cliente (RPC/funções `approve_post`, `undo_approve_post`,
   `send_client_feedback`, `approve_all_posts` validadas com o token).
4. O cliente pode: aprovar, desfazer aprovação, enviar feedback, aprovar todos.
5. Cada ação insere um `log` em `post_feedbacks` — o gestor vê em tempo real via realtime.

É um fluxo seguro porque **toda escrita exige o token certo** (validação no SQL).
A UI tem barra de progresso (x/y aprovados) e mensagens de feedback — o cliente
final não precisa entender "sistema", só aprovar.

## Fluxo 4 — Criar post (NovoPost)

1. **Cliente**: seleciona qual cliente; o preview pega cor/fonte do `branding`.
2. **Mídias**: upload múltiplo com drag-and-drop para ordenar; remoção via preview; crop opcional.
3. **Vídeo grande (reels)**: arquivos acima de **25 MB** passam por
   `compressVideo` (ffmpeg.wasm, 720p, sem upscale) com barra de progresso —
   arquivos pequenos/não-vídeo vão direto.
4. **Capa de reels (opcional)**: se houver vídeo, aparece a seção de capa. Sem
   capa enviada, `generateVideoFrame` extrai um frame aleatório (20–80% da
   duração) → `media_urls = [capa, vídeo]` (convenção detectada por
   `hasCoverInMediaUrls` ao editar).
5. **Conteúdo**: legenda + tipo (`reels`/`carrossel`/`foto`/`stories`/`design`).
6. **Agendamento**: data + hora; o `IgPreview` mostra como fica o feed.
7. Salvar → `supabase.from('posts').insert(...)` (com `client_id` + `user_id`).

O layout é **mobile-first com steps** (`04b7c3c`, `7f9aad5`): em telas pequenas
vira um passo de cada vez; em desktop, tudo lado a lado.

## Fluxo 5 — Kanban de feedbacks

`Feedbacks.tsx` usa `@dnd-kit` para arrastar cards entre colunas. Cada coluna é
um `status` de `FeedbackCard`. Arrastar = `update({ status })`. O realtime mantém
os cards sincronizados se outro usuário mexer.

## Fluxo 6 — Chat por post (realtime)

`Chat.tsx` assina o canal `post_feedbacks` (`postgres_changes`) e exibe a conversa
gestor ↔ cliente em tempo real, agrupada por post. Também consolida a navegação:
lista de posts com mais recentes no topo.

## Fluxo 7 — Navegação e redirect (a regra do "sem flash")

A rota `/` (Landing) é pública; as demais passam pelo `ProtectedRoute`.
Regra permanente do projeto (bug B09, commit `1d9d922`):

> **Redirect que precisa ser invisível acontece no render (`<Navigate>`),
> nunca em `useEffect`** — `useEffect` roda depois do paint, então a tela
> anterior (ex.: a landing) aparece por ≥1 frame.

Na prática:
- `ProtectedRoute`: `loading` → spinner; `!user` → `<Navigate to="/login" replace />`.
- `Landing`: `loading` → spinner; `user` → `<Navigate to="/home" replace />`;
  visitante → landing. Assim, um usuário logado que cai em `/` (breadcrumb,
  voltar do navegador, primeiro acesso) nunca vê a landing piscar.
- `Breadcrumb`: a casinha aponta para `/home` (início do app logado), não `/`.

## Fluxo 8 — Visualizar mídia em grande (lightbox)

`MediaPreview` (miniatura) + `MediaLightbox` (modal). Qualquer tela que mostre
mídia de um post passa `clickable` + `lightboxItems` e ganha: clique → modal
escuro com a mídia grande, vídeo com **som** (`controls autoPlay`), setas
circular e contador. Se o post tem capa + vídeo (`media_urls = [capa, vídeo]`),
o lightbox abre **direto no vídeo** (`startIndex` pula para o item de vídeo).

## Praticar

1. No `Login.tsx`, encontre onde o contador de tentativas reinicia e onde a oferta de "esqueci a senha" aparece.
2. Simule o fluxo de review: crie um post, copie o link `/review/:token`, abra em aba anônima e aprove.
3. No `ClienteFluxo.tsx`, por que `fetchPosts` é `useCallback`? O que mudaria sem ele?

**Anterior**: [`05-dados-supabase.md`](05-dados-supabase.md) · **Próximo**: [`07-seguranca.md`](07-seguranca.md)
