# 15 — Backlog unificado (docs/14 + Plano 0107)

> **Objetivo**: lista única e priorizada de tudo que falta no PostUp, fundindo o
> checklist vivo de `docs/14` com o levantamento "Próximos passos 0107" (feito
> em 07/01). Cada item indica a origem: **[14]** = `docs/14` · **[0107]** = plano 0107.
>
> Prioridade de trabalho: **bugs → segurança → polimento → features → fases grandes → infra**.
> Números novos continuam a sequência (`B15`, `P18`, `S3`...).

## Progresso (rodada de 04/08)

- **A1** ✔ (ano agora vem de `new Date()` no `GridInstagram`)
- **A3** ✔ já resolvido (ClientCard atual não exibe stats hardcoded)
- **A4** ✔ (`generateVideoFrameFromUrl` em `video-frame.ts`; edição regenera frame do vídeo salvo)
- **A5** ✔ (save força `[capa, ...mídias]` mesmo após reordenar)
- **A6** ✔ (`src/lib/copy-to-clipboard.ts` com fallback via `execCommand`; usado no Grid)
- **A7** ✔ (`describeStorageError` em `media-storage.ts` → mensagem clara de quota; flui via `toast.error` no `NovoPost`)
- **A8** ✔ (filtros de mês + responsável no Kanban)
- **A9** ✔ já resolvido (ClientDetail usa `scheduled_at` real no progresso mensal)
- **B2** ✔ (sanitização com `sanitize` em todas as rotas de escrita: Chat, use-feedbacks, FeedbackDialog, NovoCliente, cards do Kanban, restore de versão)
- **B4** ✔ (testes de regressão: `hasCoverInMediaUrls`, `generateVideoFrame` com DOM mockado, carrossel `MediaLightbox`; 20 testes novos → 75 no total; botões do lightbox ganharam `aria-label`)
- **C3** ✔ (`onCoreStatus` em `compress-video.ts` — `'loading' | 'ready' | 'failed'` com cache de listeners; `NovoPost` mostra banner "Baixando o compressor de vídeo na primeira vez..." + botão "Preparando compressor (1ª vez: ~30 MB)..."; 5 testes novos com `@ffmpeg/ffmpeg` mockado → 80 no total)
- **C5** ✔ (`touch-none` nos draggables `GridDraggablePost` e `MapDraggablePost` — sem `touch-action: none` o toque virava scroll no mobile e o drag nunca ativava)
- **A11** ✔ (coberto pelo banner do C3: "Não feche a aba" enquanto o compressor roda)
- **C1** ✔ (`PageFallback` ganhou `bg-background`)
- **C2** ✔ já coberto (compressão faz resize 1920 + WebP desde sempre)
- **C4** ✔ (lightbox com ←/→ no teclado + reset de índice por prop)
- **C6** ✔ (skeletons em Home e Kanban)
- **Feedback tag automática**: checkbox removido do `NovoPost` (criação sempre `false`, edição preserva); `is_feedback` passa a `true` automaticamente quando um feedback é solicitado (card criado, cliente envia no review, "solicitar alteração"). Kanban ganhou toggle **Todos / Posts / Feedbacks**.
- **A2** ⏳ aguarda verificação visual em runtime — o código já usa `flex items-center justify-center gap-1/1.5` uniforme

### Rodada de 04/08 (upload de vídeo no mobile + barra de ações)

- **Bug upload vídeo mobile** ✔ — causa raiz: no mobile o ffmpeg.wasm (core ~30 MB + vídeo de 200 MB) falha ao carregar ou não reduz, e `compressVideo` **devolvia o original silenciosamente**; o arquivo inteiro subia pro Drive (a pasta era criada!) e o erro de limite estourava depois, com a mensagem real do Google sendo **descartada** (`putRes.ok` virava `Upload ao Drive falhou (status)` sem ler o corpo).
  - `compress-video.ts` ganhou `onFallback: ('ffmpeg-unavailable' | 'no-reduction')` → `NovoPost` detecta e **bloqueia com mensagem clara** se o arquivo ainda passa de `MAX_MEDIA_SIZE`, em vez de subir 200 MB.
  - `media-storage.ts`: `uploadMedia` agora aceita `onProgress` (ratio) e faz o PUT com **XHR** (fetch não expõe progresso) + `extractGoogleError` lê a mensagem real do Google no corpo do PUT.
  - `drive-upload/index.ts` (edge): `googleError()` extrai `error.message` da API do Google em todos os erros (start/share/delete/pastas) — o usuário vê o motivo real (ex.: cota).
  - `NovoPost` exibe **progresso de upload** (barra azul + "%" no botão) e progresso de compressão.
- **Barra de ações fixa no mobile (NovoPost)** ✔ — antes: `h-screen` (100vh) no mobile podia passar da área visível e o botão "Visualizar" (fixo) cobria as tags de status. Agora: container usa `h-dvh`, conteúdo ganha `pb-28 md:pb-8`, e o mobile tem uma **barra fixa inferior** com **Visualizar + Agendar** (o botão de agendar saiu do header no mobile).
- **Bulk posts (pesquisa)** — ver "Pesquisa: posts em massa" abaixo.
- **Wizard passo-a-passo no mobile (avaliação)** — **viável e recomendado como UX mobile**: as seções do `NovoPost` já são estados independentes (cliente → agendamento → formato → plataforma → mídia → legenda → status), então um stepper com `AnimatePresence` + barra de progresso por passo é de baixo custo. Não implementado nesta rodada (a barra fixa de ações já resolve a dor imediata); virar item de polimento **P18**.

---

## Pesquisa: posts em massa (bulk) — feito em 04/08

**Pergunta**: como permitir criar/agendar vários posts de uma vez? Pesquisado em Hootsuite, Buffer, Publer, OwlStack, PostFast, PostEverywhere, Timed Post + Meta Graph API.

**Padrão de mercado (unânime)**: CSV/planilha → upload → **prévia com validação por linha** → corrigir erros → agendar lote.

- **Formato** (colunas típicas): `date`, `time`, `platform`, `account/client`, `caption`, `media_url` (URL pública), `status` (draft/ready). Buffer: até 100 posts; Hootsuite: 350; PostFast: 200 linhas; Publer: 500. Sem limite rígido p/ o PostUp — usar ~200.
- **Pré-requisito crítico**: mídia via **URL pública** (Drive/CDN) — o PostUp já faz isso com o Drive BYO (estudo 19).
- **Validação antes de agendar**: captions acima do limite, datas passadas, URLs quebradas, sem mídia, status não aprovado, colisão de horário. Mostrar erro por linha (Hootsuite/OwlStack).
- **Não fazer** (lições das ferramentas): Excel quebra UTF-8 → pedir CSV UTF-8; coluna de data em YY → exigir YYYY; subir conteúdo não revisado → campo `status` por linha.
- **Para o PostUp (implementação proposta)**: página "Posts em massa" → baixar template CSV → upload → parse → prévia por linha (cliente, data, tipo, legenda, mídia) → corrigir erros inline → "Agendar N posts". Mídia: aceitar **URLs já no Drive** ou **arquivos locais** (compressão+upload em lote reusando `uploadMedia` com `onProgress`). Supabase `posts.insert` em lote (o RLS já permite). **Status do lote**: usar a tabela `posts` + coluna `batch_id` (nova) para agrupar/visualizar no calendário.
- Dependência: nenhuma bloqueante; reusa `uploadMedia`, `sanitize`, `hasCoverInMediaUrls`, templates de pasta do Drive (D21). Esforço estimado: média (nova página + parser CSV + prévia).
- **Próximo passo**: item de feature → adicionar como **D11** e detalhar em estudo novo (`estudos/22-bulk-posts.md`).

---

## A. Bugs (atacar primeiro)

| # | Origem | Item | Detalhe |
|---|---|---|---|
| A1 | [0107] | ~~Ano hardcoded no Grid~~ ✔ | `GridInstagram.tsx:56,69` usa `2026` fixo; trocar por ano atual |
| A2 | [0107] | Ícones desalinhados (Grid) | Botões Copiar/Novo/Editar/Enviar nova versão desalinhados |
| A3 | [0107] | ~~`ClientCard` stats = 0~~ ✔ | Métricas exibidas são hardcoded; ligar aos dados reais (card atual não exibe stats) |
| A4 | [14] B10 | ~~Regenerar capa em vídeo salvo~~ ✔ | Edição: remover capa deve poder gerar novo frame (hoje só upload novo gera) |
| A5 | [14] B11 | ~~Ordem `[capa, vídeo]` na edição~~ ✔ | Reordenar mídias pode quebrar a convenção; validar/forçar no `NovoPost` ao salvar |
| A6 | [14] B13 | ~~Fallback do clipboard~~ ✔ | HTTP/permissão negada → "Copiar" deve ter fallback (textarea oculta) |
| A7 | [14] B14 | ~~Erro de storage cheio~~ ✔ | Mapear erro de limite do storage e mostrar mensagem clara |
| A8 | [0107] | ~~Filtros de data e responsável~~ ✔ | Feedbacks só filtra por cliente/tipo; faltam data e `responsible_user` |
| A9 | [0107] | ~~Progresso do mês no ClientDetail~~ ✔ | Não reflete posts reais do mês |
| A10 | [0107] | Preview de feed 3 colunas (Cronograma) | Conferir proporcionalidade no desktop |
| A11 | [14] B12 | ~~ffmpeg + aba em background~~ ✔ | Pode perder contexto; avaliar aviso "mantenha a aba aberta" durante compressão — coberto pelo banner do C3 |
| A12 | [0107] | PostDetalhe: pendências finas | "Ainda há alterações a fazer" — refinamentos de UX |

## B. Segurança / robustez (antes do launch real)

| # | Origem | Item | Detalhe |
|---|---|---|---|
| B1 | [14] S1 | Rate-limit por IP | Nas edge functions (ou Supabase); captcha cobre só login/cadastro |
| B2 | [14] S2 | ~~Sanitização em todas as rotas de escrita~~ ✔ | Conferir `insert/update` com limite 2000 chars + DOMPurify |
| B3 | [0107] | Error tracking | D11: decidir Highlight.io **ou** PostHog antes do lançamento |
| B4 | [14] P17 | ~~Testes de regressão~~ ✔ | `hasCoverInMediaUrls`, `generateVideoFrame` (mokado), carrossel do Feedbacks |

## C. Polimento / UX

| # | Origem | Item | Detalhe |
|---|---|---|---|
| C1 | [14] P15 | ~~`PageFallback` opaco~~ ✔ | `bg-background` para não "vazar" a página anterior no lazy load |
| C2 | [14] P11 | ~~Compressão com resize 1080px~~ ✔ | Além de JPEG, redimensionar fotos de celular p/ economizar storage (já coberto: resize 1920 + WebP) |
| C3 | [14] P12 | ~~Progresso do ffmpeg core~~ ✔ | ~30MB baixados "escondidos" na 1ª vez; mostrar "preparando compressor..." (banner + botão; `onCoreStatus` em `compress-video.ts`) |
| C4 | [14] P13 | ~~Lightbox com teclado~~ ✔ | Setas ←/→ (hoje só `Esc` fecha) |
| C5 | [14] P14 | ~~Grid arrastável no mobile~~ ✔ | Reordenar por drag no mobile (hoje usa botões/trocas) — `touch-none` (touch-action: none) nos draggables do Grid e do mapa; o `PointerSensor` já cobria touch, mas o navegador interceptava o toque como scroll |
| C6 | [14] P16 | ~~Skeletons nas páginas~~ ✔ | Home e Feedbacks: spinners → skeletons |
| P17 | 04/08 | Wizard NovoPost no mobile | Stepper por seção (cliente → agendamento → formato → plataforma → mídia → legenda → status) com barra de progresso; avaliado como viável — seções já são estados independentes |

## D. Features médias

| # | Origem | Item | Detalhe |
|---|---|---|---|
| D1 | [0107] | Notificações: leitura no Supabase | Migrar leitura de `localStorage` → tabela (hoje "parcial") |
| D2 | [0107] | ClientDetail: grid + contador + ir ao chat | Grid atual, contador vermelho de mensagens, botão para o chat |
| D3 | [0107] | `responsible_user` integrado | Ligar aos usuários do sistema (hoje só campo) |
| D4 | [0107] | Chat: abrir com funcionários + post no balão | Novo chat com funcionários; indicar mais claramente o post |
| D5 | [0107] | Métricas de engajamento do cliente | Curtidas/views/comentários/stories/audiência — novas colunas |
| D6 | [0107] | Notificação por email (+ WhatsApp) | Planejar sistema de email; estruturar p/ WhatsApp |
| D7 | [0107] | Configurações: pagamento | Sistema de pagamento |
| D8 | [0107] | Onboarding Fase 1 | Conta → perfil → primeiro cliente |
| D9 | [0107] | Dossiê do cliente | Público-alvo/segmentação, identidade visual completa |
| D10 | [0107] | Diff entre versões de post | Comparar versões |
| D11 | 04/08 | Posts em massa (bulk) | CSV → prévia por linha → validação → agendar lote (pesquisa acima; detalhar em `estudos/22-bulk-posts.md`) |

## E. Fases grandes (ROADMAP)

| # | Origem | Item | Detalhe |
|---|---|---|---|
| E1 | [0107] | Fase 3 — Equipes | Migrar RLS `user_id` → `team_id` (decisão D4) |
| E2 | [0107] | Fase 4 — Publicação automática | API do Instagram (permissão do cliente) |
| E3 | [0107] | Fase 5 — Analytics | Gráficos de crescimento/engajamento por post |
| E4 | [0107] | Fase 6 — TikTok | Segunda plataforma (`platform` já existe) |
| E5 | [0107] | IA para direcionamento | Direcionamento de conteúdo por IA (adiado: "futuramente") |

## F. Infra (dev)

| # | Origem | Item | Detalhe |
|---|---|---|---|
| F1 | [0107] | PWA/mobile | Service worker + manifest |
| F2 | [0107] | CLI assistente | Automação Node.js |

---

## Prioridade sugerida da próxima sprint (bloco "pré-launch")

1. **A1–A3** (bugs visuais do Grid, rápidos)
2. **A6–A7** (B13 clipboard + B14 storage cheio — o B14 vira ainda mais crítico com a troca de storage)
3. **B1–B2** (rate-limit + sanitização)
4. **C1** (P15 fallback opaco — ~1 linha)

## Storage de mídias (pendência que vira prioridade)

Ver **D19** em `12-decisoes-alternativas.md` e o plano de migração em
`16-storage-midias.md`. O bucket Supabase free (1 GB) esgota rápido; a decisão
recomendada é **Cloudflare R2** (10 GB free permanente, egress zero, S3-compatible).

---

**Anterior**: [`14-checklist-bugs-polimentos.md`](14-checklist-bugs-polimentos.md)
· **Próximo**: [`16-storage-midias.md`](16-storage-midias.md)
