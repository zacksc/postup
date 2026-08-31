# 07 — Segurança: como o PostUp se protege

> **Objetivo**: percorrer as camadas de segurança — do captcha no login até a
> validação de inputs no banco — e entender o "modelo de ameaça".

## O modelo de ameaça (quem pode atacar?)

O PostUp tem **duas portas de entrada públicas**:

1. **Login/Cadastro** — porta dos gestores (exige conta).
2. **`/review/:token`** — porta dos clientes (exige o link com token).

E um alvo valioso: **os dados de posts/clientes dos gestores**. As defesas abaixo
existem para impedir que um atacante (ou um usuário mal-intencionado) acesse dados
de outros usuários ou faça requisições em nome de outros.

## Camadas de defesa

```
┌────────────────────────────────────────────────────────────┐
│ 1. Frontend: sanitização de input + compressão             │
│ 2. Turnstile (Cloudflare) — bloqueia bots no login/cadastro│
│ 3. Edge Function verify-turnstile — valida o token (secret) │
│ 4. RLS no banco — cada usuário vê só o que é dele          │
│ 5. SECURITY DEFINER + validação — operações sensíveis      │
│ 6. CSP (Content-Security-Policy) — limita o que o browser  │
│    pode carregar/executar                                   │
└────────────────────────────────────────────────────────────┘
```

## 1. Sanitização de inputs (`src/lib/utils.ts`)

```ts
export function sanitize(input: string, maxLength = 2000): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] }).trim().slice(0, maxLength)
}
```

- `DOMPurify.sanitize` com `ALLOWED_TAGS: []` remove **todo HTML/script** do texto.
- Limite de tamanho (2000) impede abuso de storage.
- Usado para **qualquer texto vindo de usuário** que vai ser exibido de novo
  (legendas, mensagens de feedback). Sem isso, alguém poderia injetar `<script>`
  que roda no browser de outro usuário (XSS).

## 2 & 3. Turnstile + Edge Function (login/cadastro)

- **Frontend**: `TurnstileWidget` renderiza o captcha da Cloudflare (chave `VITE_TURNSTILE_SITE_KEY`) e produz um `token`.
- **Servidor**: `supabase.functions.invoke('verify-turnstile', { body: { token } })` — a edge function (Deno) valida o token com `TURNSTILE_SECRET_KEY` e retorna `{ success }`.
- **Regra de ouro**: o segredo só existe na edge function. Se validássemos no front, o segredo ficaria exposto no bundle e qualquer um poderia falsificar.

Detalhe de UX/segurança: o widget é **resetado a cada tentativa** para que um token
não seja reutilizado (`timeout-or-duplicate` é tratado com mensagem amigável).

**Códigos de erro do widget (diagnóstico rápido):**
- `110100/110110` — sitekey inválido/não encontrado. `400070` — desabilitado.
- `110200` — domínio não autorizado (adicionar no Hostname Management).
- `200500` — iframe não carregou (rede/blocker bloqueando `challenges.cloudflare.com`).
- `600010` (família 300/600) — falha do desafio: o ambiente do visitante foi
  marcado como bot (VPN, proxy, VM, WebGL desabilitado, extensões). Não é bug de
  código — testar em navegador limpo/aba anônima.
- O `TurnstileWidget` mostra a falha com uma mensagem clara e o **botão de login
  fica bloqueado até existir token válido** (sem captcha, a edge function
  rejeitaria mesmo assim).

## 4. RLS — Row Level Security

É a defesa mais importante. Cada política no banco:

```sql
-- Usuário vê apenas o que é dele
USING (user_id = auth.uid())
```

- Tabelas com `user_id` direto (clients, posts, feedback_cards).
- Filhas sem `user_id` (post_feedbacks, post_versions, attachments...) usam `EXISTS`:
  `... WHERE posts.user_id = auth.uid()` — a linha só é visível se o post "pai" for do usuário.
- Anon: só SELECT de `posts` (para review) e de `clients` **com `review_token` não nulo**.

## 5. SECURITY DEFINER com validação

Funções `approve_post`, `undo_approve_post`, `send_client_feedback`,
`approve_all_posts` (migração 014):

```sql
CREATE OR REPLACE FUNCTION approve_post(p_post_id uuid, p_review_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_post_id IS NULL OR p_review_token IS NULL THEN
    RAISE EXCEPTION 'Invalid parameters';       -- valida null
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM posts p JOIN clients c ON c.id = p.client_id
    WHERE p.id = p_post_id AND c.review_token = p_review_token
  ) THEN
    RAISE EXCEPTION 'Unauthorized';             -- token precisa bater
  END IF;
  ...
```

- **`SECURITY DEFINER`** = roda como dono (consegue escrever mesmo com RLS restrito).
- **Validação obrigatória** = rejeita null, token errado, mensagem vazia/longa.
- **`SET search_path = public`** = impede "search_path hijacking" (atacar funções que resolvem o nome errado).
- Alternativa mais rigorosa: exigir `auth.uid()` + token, em vez de só token.
  O fluxo atual é "qualquer um com o link age como o cliente" — aceitável porque
  o link é o "segredo" do cliente (como um convite). Anotado em `12-decisoes-alternativas.md`.

## 6. CSP — Content-Security-Policy

O `index.html` define uma CSP que **limita de onde o navegador pode carregar recursos**
(script, connect, img, frame, worker, style). Aprendizado do bug real: o CSP estava
bloqueando o captcha; a solução foi **liberar explicitamente `challenges.cloudflare.com`**
(commit `a34920c`) em vez de desligar a CSP:

```html
<script-src ... https://challenges.cloudflare.com>
frame-src ... https://challenges.cloudflare.com>
```

**Cada diretiva é independente** — liberar no `script-src` não libera no `font-src`.
Auditoria posterior encontrou dois casos assim:
- **Fontes do Turnstile**: `font-src 'self' data:` não incluía
  `challenges.cloudflare.com` → 40 violações no console. Adicionado.
- **Google Fonts (DM Sans)**: o `style-src` não tinha `fonts.googleapis.com` e o
  `font-src` não tinha `fonts.gstatic.com` → as fontes **nunca carregaram** (o app
  usava fonte fallback silenciosamente). Adicionado (commit `2b60d38`).

Regra: **CSP no deny-list-by-default** (tudo bloqueado, libera só o necessário)
é mais seguro que allow-list-by-default, mas cobra auditoria de TODAS as diretivas
a cada dependência de terceiro adicionada.

## 7. Ciclo de vida do token do Turnstile (o caso do "botão preso")

Bug real relatado: "o captcha passa, mas o botão Entrar continua bloqueado".
Causa raiz: o `Login.tsx` criava `turnstileRef` mas **nunca passava
`ref={turnstileRef}`** ao `<TurnstileWidget>`. Então `turnstileRef.current?.reset()`
era um **no-op silencioso** (ref null):

1. Tentativa de login falha (senha errada, e-mail não confirmado, ou a edge
   function rejeitando o token).
2. `setCfToken('')` zera o token — o botão desabilita (`disabled={loading || !cfToken}`).
3. O `reset()` que deveria gerar um token novo **não roda**.
4. O widget mantém o checkmark resolvido, mas o token de uso único já foi
   consumido — e Cloudflare não re-dispara `onSuccess` sem um reset.
5. Resultado: botão bloqueado **para sempre** até recarregar a página.

**Lições:**
- `ref?.metodo()` com ref null é um no-op **silencioso**. Se o widget expõe um
  handle (reset), teste que ele é chamado — o teste de Login agora verifica que
  `reset` roda após uma tentativa falha.
- Token de captcha é **uso único**: validou no servidor → descartar + reset do
  widget. Em `onExpire`/`onTimeout`, o token guardado também precisa ser limpo
  (o `onError` do Login faz `setCfToken('')`).
- Todo submit async precisa de `try/finally`: sem ele, se `signIn` lançar, o
  `loading` fica preso em `true` e o botão congela com spinner.
- **Tela branca = erro não capturado.** Não havia `ErrorBoundary`; um erro de
  render (chunk lazy falhando na rede do celular, script do Cloudflare...) derrubava
  a árvore React inteira em silêncio. Agora `src/main.tsx` envolve o app num
  `ErrorBoundary` (mensagem + recarregar) e loga `error`/`unhandledrejection` globais.

## 8. Erro mascarado: falha do captcha virando "senha incorreta"

Bug real relatado: "mesmo colocando a senha correta, recebo erro de senha".
A **causa raiz não estava na senha**: a verificação do Turnstile no servidor estava
falhando, mas o app apresentava o erro como senha errada.

O fio condutor do bug:

1. A edge function `verify-turnstile` retornava **HTTP 400** quando o Cloudflare
   rejeitava o token (código `600010`/`timeout-or-duplicate`, `invalid-input-response`, ...).
2. O `supabase.functions.invoke` trata **não-2xx como `error`** e ignora o corpo:
   o client **nunca via os `error-codes`** do Cloudflare.
3. `verifyTurnstile` do `use-auth` devolvia sempre `{ error: 'Falha na verificação...' }`
   — **sem código** distinguível.
4. O `Login.tsx` só distinguia `email_not_confirmed`; qualquer outro erro caía no
   `else` → como o e-mail existe (`checkEmailExists`), mostrava
   **"A senha está incorreta. Tente novamente."** mesmo com a senha certa.

**Correção (camada a camada):**
- Edge function: em falha retorna **200 com `{ success: false, error: <códigos> }`**
  (2xx → o client `invoke` lê `data`, não `error`).
- `use-auth`: `verifyTurnstile` marca todos os caminhos de falha com
  `code: 'turnstile_failed'` e mantém a mensagem amigável (timeout/expired, token inválido).
- `Login.tsx`: trata `code === 'turnstile_failed'` **antes** do `else` — mostra o erro
  real do captcha em vez de "senha incorreta"; o `else` continua cobrindo
  `invalid_credentials` (senha errada/e-mail não registrado).

**Lições:**
- **HTTP status é contrato de API.** Não-2xx e corpo são canais distintos; se o
  client precisa do *motivo* da falha, devolva 200 + `success:false`. Use status
  ≠ 2xx só quando o client não precisa do corpo (ou para indicar erro de transporte).
- **`Content-Type` também é contrato.** O `functions-js` só faz `JSON.parse` em
  respostas `application/json`; sem o header, `data` chega como string e
  `data.success` é `undefined` (e a UI cai no `else` de novo).
- **CORS pode mascarar o erro como "senha incorreta" (e fez).** A edge function
  não respondia ao preflight `OPTIONS` → o browser bloqueava o fetch com
  `TypeError: Failed to fetch` → `functions.invoke` devolvia `error` → a UI mostrava
  o erro genérico do captcha (e antes do §7, o `else` virava "senha incorreta").
  Sintoma no console: `has been blocked by CORS policy: No 'Access-Control-Allow-Origin'
  header`. Fix: handler `OPTIONS` → `204` + `Access-Control-Allow-*` na própria edge.
- **Erro genérico com fallback perigoso é bug de UX.** Um `else` que assume
  "senha errada" para *todo* erro não mapeado transforma falhas de captcha, rate
  limit ou rede em "senha incorreta". Sempre propague um `code` para a UI decidir.
- **Teste a mensagem, não só o caminho feliz.** O teste de Login agora cobre
  `turnstile_failed` e garante que `checkEmailExists` **não** é chamado nesse caso.

## Outras defesas

- **Compressão de imagem** (`compress-image.ts`): redimensiona para ≤1920px e converte
  para webp com qualidade 0.82 — reduz payload e evita upload de arquivos gigantes.
- **Validação de UUID**: `isValidUuid` evita usar strings arbitrárias em `.eq('id', ...)`.
- **Limites de storage**: bucket `posts-media` aceita só MIME types conhecidos e até 10 MB.
- **`.gitignore`**: `.env.local` e `supabase/.temp` não vão ao repositório (segredos).
- **`@types` e lint**: `no-explicit-any` força tipar payloads — menos surpresa de tipo em dados sensíveis.

## Checklist mental (use antes de adicionar qualquer feature)

1. Os inputs são sanitizados onde serão re-renderizados? (XSS)
2. As queries respeitam `user_id = auth.uid()`? (isolamento)
3. Funções `SECURITY DEFINER` validam entrada e fixam `search_path`?
4. O que o `anon` consegue ver/fazer? RLS cobre?
5. Segredos estão fora do frontend (env do servidor/edge)?
6. A CSP permite só o necessário? Novo domínio de terceiro? Libere explicitamente
   em TODAS as diretivas que ele tocar (script, style, font, img, connect, frame,
   worker, media) — cada uma é independente.
7. Um erro aqui deixa o usuário **sem mensagem** (tela branca)? Existe
   ErrorBoundary no caminho?

## Praticar

1. Leia `index.html` e liste os domínios liberados na CSP. O que aconteceria se adicionássemos o Google Analytics sem liberá-lo?
2. Tente no SQL do Supabase: `SELECT * FROM clients;` com a anon key — o que retorna e por quê?
3. Explique a diferença entre "confiar no token do link" e "exigir auth.uid()". Quando um vale mais?
4. No `Login.tsx`, por que o `ref={turnstileRef}` no widget é crítico? O que aconteceria se o token fosse zerado sem o widget ser resetado?
5. Explique o bug do "erro de senha mascarado": por que um HTTP 400 da edge function virava "senha incorreta" na UI, e por que devolver 200 + `{ success: false }` corrige?

**Anterior**: [`06-fluxos-frontend.md`](06-fluxos-frontend.md) · **Próximo**: [`08-estado-hooks.md`](08-estado-hooks.md)
