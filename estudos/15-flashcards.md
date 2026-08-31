# 15 — Flashcards de revisão

> **Objetivo**: revisão rápida e ativa. Cubra a coluna RESPOSTA, leia o CONCEITO,
> tente responder de cabeça, depois confira. Repita em sessões espaçadas.

## JavaScript / TypeScript

| CONCEITO | RESPOSTA |
|----------|----------|
| O que é TypeScript? | Superset de JS que adiciona tipos em tempo de compilação; é apagado no build (não existe em runtime). |
| Tipo união (`\|`) | Valor pode ser um dos tipos listados. Ex.: `PostStatus` com 5 strings. |
| `Record<K,V>` | Objeto com chaves do tipo K e valores do tipo V. O TS exige TODAS as chaves. |
| `unknown` vs `any` | `any` desliga a checagem; `unknown` exige narrowing (provar o tipo) antes de usar. |
| Type assertion (`as T`) | Promessa ao compilador de que o valor é T; não muda o runtime. |
| `import type` | Importa só para o TypeScript; é removido no build (ajuda tree-shaking). |
| `Promise<T>` | Função assíncrona que resolve para T. Ex.: `signIn` → `Promise<{error?: string}>`. |
| "make illegal states impossible" | Desenhar tipos para que estados inválidos nem compilem (uniões, Records). |

## React

| CONCEITO | RESPOSTA |
|----------|----------|
| O que é "render"? | Executar a função do componente para produzir a descrição da UI para os dados atuais. |
| O que é reconciliação? | Comparar a árvore nova com a anterior (diff) e aplicar o mínimo de mudanças no DOM. |
| Quando re-renderiza? | Estado interno muda, props mudam (referência), ou contexto usado muda. |
| `useState` | Estado local: valor + setter. Substituir, nunca mutar. |
| `useRef` | Valor que não causa re-render; usado para timers/DOM. |
| `useCallback` | Estabiliza a REFERÊNCIA de uma função enquanto as deps não mudam. |
| `useMemo` | Memoiza o RESULTADO de um cálculo (e estabiliza a referência do valor). |
| `useEffect` | Roda após o render quando as deps mudam. Cleanup (retorno) no desmonte. |
| Regra dos hooks | Só no topo de componentes/custom hooks; nunca dentro de if/loops. |
| Por que o lint de hooks existe | O React mantém hooks em lista ordenada por chamada; ordem instável quebra o estado. |
| O que causa efeito "infinito"? | Deps instáveis (função/objeto recriado a cada render) ou deps que mudam de identidade. |
| `React.lazy` + `Suspense` | Code-splitting: página carrega sob demanda com fallback. |
| `<Navigate to="/x" replace />` vs `navigate()` no useEffect | `Navigate` redireciona no RENDER (antes do paint, sem flash); `navigate` no efeito roda depois do paint. |
| Ordem do ciclo: render → commit → paint → useEffect | `useEffect` sempre roda APÓS o paint — por isso redirect em efeito deixa 1 frame da tela antiga visível. |
| `key` como reset de estado | Mudar a `key` força remontagem → `useState(init)` reinicia. Evita `setState` em `useEffect`. |

## CSS / UI

| CONCEITO | RESPOSTA |
|----------|----------|
| Utility-first | Estilizar com classes utilitárias em vez de classes CSS nomeadas. |
| Tailwind v4 vs v3 | v4 é CSS-first (`@theme`), sem config JS; v3 usava `tailwind.config.js`. |
| Design token | Variável de valor de design (cor/espaço/fonte) usada de forma consistente. |
| `cva` | Define variantes de estilo com tipagem (Button com variant default/approve/...). |
| `cn()` (clsx + twMerge) | Junta classes condicionais e resolve conflitos (p-2 + p-4 → p-4). |
| Tokens semânticos | `primary`/`secondary`/`destructive` em vez de cores literais → tema troca num lugar. |

## SQL / Postgres

| CONCEITO | RESPOSTA |
|----------|----------|
| PK / FK | Primary Key identifica a linha; Foreign Key referencia outra tabela. |
| `ON DELETE CASCADE` | Apagar o pai apaga os filhos (posts → post_feedbacks). |
| Índice | Estrutura que acelera WHERE/ORDER BY; custa espaço e escrita. |
| JSONB | JSON binário otimizado para dados flexíveis (branding, metrics). |
| `TIMESTAMPTZ` | Data/hora com fuso — correto para agendamento. |
| `gen_random_uuid()` | Gera UUID automaticamente (id sem "adivinhar"). |
| Migration | Arquivo SQL versionado aplicado em ordem; idempotente com `IF NOT EXISTS`. |
| Transação / atomicidade | Operações em grupo: ou todas executam ou nenhuma. |

## Auth e segurança

| CONCEITO | RESPOSTA |
|----------|----------|
| Autenticação vs autorização | Auth = "quem é você"; autorização = "o que você pode fazer". |
| JWT | Token autocontido e assinado; servidor valida a assinatura sem guardar estado. |
| Anon key vs service role | Anon é pública e limitada por RLS; service role ignora RLS e NUNCA vai ao front. |
| RLS | Filtro de linhas no banco por política (USING/WITH CHECK + auth.uid()). |
| `USING` vs `WITH CHECK` | USING filtra linhas existentes; WITH CHECK valida linhas novas/alteradas. |
| Tabela filha sem user_id | Herda o dono via `EXISTS` na tabela pai (post_feedbacks → posts). |
| `SECURITY DEFINER` | Função roda como dono (ignora RLS do chamador) — exige validação + search_path fixo. |
| Por que fixar `search_path`? | Evitar "search_path hijacking" (função resolver nome malicioso). |
| XSS | Injeção de script que roda no contexto de outro usuário. Refletido/armazenado/DOM. |
| Sanitização | DOMPurify com `ALLOWED_TAGS: []` remove todo HTML (o PostUp usa em todo texto). |
| CSP | Header que restringe origem de recursos; deny-by-default; rede contra XSS. |
| CSRF | Forçar usuário logado a executar ação. Tokens bearer no header são menos vulneráveis que cookies. |
| Turnstile | Captcha Cloudflare: widget gera token no front; edge function valida com o segredo. |

## Realtime

| CONCEITO | RESPOSTA |
|----------|----------|
| WebSocket vs HTTP | HTTP é request/response; WebSocket é conexão contínua bidirecional. |
| SSE vs WebSocket | SSE é servidor→cliente unidirecional; WebSocket é bidirecional. |
| Supabase Realtime | Canais via WebSocket com `postgres_changes` (INSERT/UPDATE/DELETE). |
| `supabase_realtime` publication | Lista de tabelas habilitadas para realtime (migration 006). |
| Memory leak de subscription | Falta de cleanup: canais acumulam. Solução: `removeChannel` no cleanup do efeito. |
| `setState` funcional | `setPrev => [...]` — usa o valor atual, seguro em concorrência/eventos rápidos. |

## Testes / Git / CI

| CONCEITO | RESPOSTA |
|----------|----------|
| Pirâmide de testes | Unit (muitos, baratos) → componente → E2E (poucos, caros). |
| Mock | Substituir dependência real por falsa controlada para isolar o que se testa. |
| `vi.mock` + `vi.fn()` | Vitest: mocka módulo e cria funções falsas. |
| `findBy` vs `getBy` | `getBy` é síncrono; `findBy` aguarda resposta assíncrona. |
| Conventional commits | Mensagens `feat:`/`fix:`/`docs:`/`chore:` padronizadas. |
| CI | Verificação automática a cada push (lint, tsc, build, testes). |
| CD | Deploy automático após verificação (Vercel). |
| `npm ci` vs `npm install` | `ci` instala exatamente o lockfile — reproduzível, usado no CI. |
| Rewrite de SPA | Mapear `/*` → `/index.html` para o router funcionar no refresh. |
| Fast-forward merge | Branch alvo é descendente direto → só avança o ponteiro. |

## Decisões do projeto (para entrevista)

| DECISÃO | PORQUÊ |
|---------|--------|
| TypeScript | Erros cedo, refatoração segura, domínio tipado. |
| Vite SPA (não Next) | Sem necessidade de SSR/SEO; Supabase cobre o backend. |
| Supabase (não Firebase) | Postgres relacional + RLS + SQL; sem lock-in. |
| RLS por user_id | Isolamento multi-usuário de verdade (era `USING (true)`). |
| Review sem login (token no link) | Cliente final não cria conta; o link é o segredo. |
| Turnstile + edge function | Captcha server-side com segredo fora do front. |
| Context (não Zustand) | Estado global pequeno hoje; zustand é o plano se crescer. |
| Sanitização com remove-tudo | UI não precisa de rich text; mais simples e seguro. |
| Sem React Query | Volume pequeno por usuário; hooks próprios bastam. Reavaliar quando crescer. |
| Denormalizar client no post | Evitar JOINs na UI; trade-off de nome desatualizado. |
| Sem Sentry (removido) | Custo para o momento; adicionar antes do lançamento real. |
| Lazy loading total | Bundle pequeno; abre rápido em mobile. |
| Compressão de vídeo 720p no browser | ffmpeg.wasm lazy; só >25MB; sem upscale; fail-safe (não piora o arquivo). |
| Capa de reels = `media_urls[0]` | Lista ordenada `[capa, vídeo]`; helper `hasCoverInMediaUrls` detecta. |
| Lightbox com `key` de remontagem | Reset de índice sem `setState` em efeito (regra de lint). |
| Redirect em `<Navigate>` (render) | Nunca em `useEffect` — evita flash da tela antiga (bug da landing). |

## Mídia (novas features)

| CONCEITO | RESPOSTA |
|----------|----------|
| ffmpeg.wasm | ffmpeg em WebAssembly: transcode no navegador, sem servidor. |
| CRF (H.264) | Qualidade do encoder; menor = melhor + maior arquivo. PostUp usa 28. |
| `-movflags +faststart` | Move o índice p/ o início → player inicia antes de baixar tudo. |
| `scale=min(720\,iw):min(720\,ih)` | Reduz p/ 720 se maior, senão mantém — NUNCA faz upscaling. |
| `URL.createObjectURL` | URL temporária (`blob:`) de arquivo local; revogar com `revokeObjectURL`. |
| `onseeked` | Evento de quando o `<video>` termina de pular p/ `currentTime`. |
| Frame aleatório de capa | 20–80% da duração (`0.2 + Math.random()*0.6`) — evita fades/logo. |
| Carrossel "1 card + ¼" | `w = (100% − gap) / 1.25` + `snap-x`/`snap-start`. |
| Lightbox com som | `controls autoPlay playsInline` SEM `muted`. |

## Como revisar (espaçamento)

- **Hoje**: leia o capítulo do assunto.
- **+1 dia**: responda 15 flashcards daquela categoria.
- **+3 dias**: responda as mesmas + 10 novas.
- **+7 dias**: responda TUDO da categoria, as que errou vão para a "pilha de revisão".
- **+30 dias**: revisão geral antes da entrevista.

## PRATICAR

1. Imprima mentalmente 10 flashcards de categorias diferentes por dia.
2. Para cada flashcard, além de responder, diga **onde no PostUp** o conceito
   aparece. Se não souber, volte ao capítulo.

**Anterior**: [`14-entrevista.md`](14-entrevista.md) · **Próximo**: [`16-desafios.md`](16-desafios.md)
