# 14 — Checklist de bugs e polimentos

> **Objetivo**: catálogo vivo dos bugs e polimentos do PostUp — o que já foi
> corrigido (com commit de referência), o que ainda está aberto e o que é
> melhoria de "polimento" (UX/performance/visual). É o documento de referência
> para retomar sessões de manutenção.
>
> > **Atenção**: os itens ⬜ da seção 3 abaixo foram **fundidos com o plano
> > "Próximos passos 0107"** no [`15-backlog-unificado.md`](15-backlog-unificado.md),
> > que é a lista única e priorizada de trabalho.

Legenda de status:

| Símbolo | Significado |
|---|---|
| ✅ | Feito e verificado em produção |
| 🔶 | Em andamento / parcial |
| ⬜ | Aberto (não iniciado) |
| ↩️ | Revertido / superado |

---

## 1. Bugs corrigidos (histórico recente)

| # | Bug | Causa raiz | Correção | Status |
|---|---|---|---|---|
| B01 | Login mostra "senha incorreta" com senha certa | Edge function devolvia 400 + sem `Content-Type` + CORS | Resposta `200 + {success:false}`, header JSON, tratar `OPTIONS` | ✅ |
| B02 | Tela branca no celular/WebView | `createClient` lança no init sem WebSocket | Transporte `NoopWebSocket` de fallback em `src/lib/supabase.ts` | ✅ |
| B03 | Deploy "verde" mas site quebrado (`[SENSITIVE]` no bundle) | Env mascarada em prebuilt | Cloud build (`vercel deploy --prod`) | ✅ |
| B04 | Deploy falhava (`secrets` em `if:`, IDs/token errados) | YAML/secret incorretos | Secrets em `env:`, checagem no shell, IDs corretos | ✅ |
| B05 | Preview do post no calendário cortado por overflow | Portal + seguir cursor não era usado | `PostHoverPreview` via portal seguindo o cursor (`838a397`) | ✅ |
| B06 | Cards do kanban no mobile gastavam altura demais | Colunas empilhadas com cards soltos | Colunas viram lista + cards em carrossel `w-56` (`4b1566f`) | ✅ |
| B07 | Carrossel mostrava card "cortado" no meio sem pista | Largura sem a matemática do "1 card + ¼" | `w=(100%−gap)/1.25` + scroll-snap (`7b4294a`) | ✅ |
| B08 | Mockup de perfil IG mostrava células "+" que não são posts | Placeholders vazios no grid | Só `posts.map` (`42e1ce8`) | ✅ |
| B09 | **Landing "aparecia por trás" ao navegar/atualizar** | Redirect em `useEffect` (pós-paint) + breadcrumb → `/` | `<Navigate>` no render + breadcrumb → `/home` (`1d9d922`) | ✅ |

## 2. Polimentos entregues (histórico recente)

| # | Polimento | O que faz | Commit | Status |
|---|---|---|---|---|
| P01 | Grid do Instagram: botão "Prévia" | Modal com mockup do perfil (desktop e mobile) | `2f6a6ab` | ✅ |
| P02 | Grid do Instagram: "Copiar" no mobile | Copia o código do grid | `2f6a6ab` | ✅ |
| P03 | Espaço vazio no grid gera post | Clicou no vazio → pergunta → `/posts/novo?date=` | `2f6a6ab` | ✅ |
| P04 | Legenda das bolinhas no topo do grid | 5 status explicados na UI | `2f6a6ab` | ✅ |
| P05 | ClienteFluxo com preview do perfil | Coluna sticky desktop + modal mobile | `2f6a6ab` | ✅ |
| P06 | Cards do ClienteFluxo em 400px | Largura proporcional ao Instagram | `2f6a6ab` | ✅ |
| P07 | Lightbox de mídia com som | Clicar em mídia abre em grande, com setas/contador | `42e1ce8` | ✅ |
| P08 | Compressão de vídeo 720p no browser | ffmpeg.wasm lazy, só acima de 25MB, sem upscale | `42e1ce8` | ✅ |
| P09 | Capa de reels (manual ou automática) | `media_urls=[capa, vídeo]`, frame aleatório via canvas | `42e1ce8` | ✅ |
| P10 | Landing sem flash para logado | Gate de render com `<Navigate>` | `1d9d922` | ✅ |

## 3. Bugs e pendências abertos (checklist restante)

> ⬜ = pendente. Esta é a lista que falta atacar nas próximas sessões.

### 3.1 Bugs/UX

- ⬜ **B10 — Escolha da capa em vídeo existente na edição**: ao editar um post
  salvo, se o usuário remover a capa atual, a UI deve poder regenerar um novo
  frame (hoje só o upload de vídeo novo gera frame automático).
- ⬜ **B11 — Ordem do carrossel na edição**: reordenar mídias em post existente
  pode quebrar a convenção `[capa, vídeo]` (a capa precisa continuar na posição
  0). Validar/forçar no `NovoPost` ao salvar.
- ⬜ **B12 — Vídeo grande + aba em segundo plano**: `ffmpeg.wasm` pode perder
  contexto se a aba ficar em background; avaliar aviso "mantenha a aba aberta"
  durante a compressão.
- ⬜ **B13 — Fallback do `navigator.clipboard`**: em HTTP (não HTTPS) ou
  permissão negada, "Copiar" no grid deve ter fallback (ex.: textarea oculta).
- ⬜ **B14 — Erro de storage cheio**: quando o Supabase storage atingir o
  limite, o upload falha de forma genérica. Mapear o erro e mostrar mensagem
  clara ("armazenamento cheio").
- ✅ **B15 — Bucket `posts-media` limitado a 10 MB (migration 006)**: a compressão
  estratégica mira 30 MB (`MAX_MEDIA_SIZE`), mas o bucket ainda recusa >10 MB.
  Até migrar para R2 (D19), vídeos que saírem da compressão entre 10–30 MB quebram
  no upload. Corrigir o limite do bucket para ≥ `MAX_MEDIA_SIZE` ou antecipar a
  migração.
  **Resolvido**: migration `20260809_posts_media_bucket_size_limit.sql` elevou o
  limite para 50 MB (teto de objeto único do Supabase, igual ao `SUPABASE_OBJECT_LIMIT`
  do client). Para testar o storage do Supabase (mesmo com Drive conectado), usar
  `VITE_STORAGE_PROVIDER=supabase` (ver `docs/16-storage-midias.md`).

### 3.2 Polimentos / melhorias

- ⬜ **P11 — Compressão de imagem com redimensionamento**: `compressImage`
  existe; avaliar redimensionar para 1080px (e não só JPEG) para economizar
  storage de fotos de celular.
- ⬜ **P12 — Pré-carregar ffmpeg core sob demanda com progresso**: hoje o
  primeiro vídeo grande baixa ~30MB "escondido"; mostrar estado "preparando
  compressor..." na primeira vez.
- ⬜ **P13 — Lightbox com teclado**: adicionar setas ←/→ do teclado e `Esc`
  dentro do lightbox (hoje `Esc` fecha via Dialog, mas setas não navegam).
- ⬜ **P14 — Preview do grid arrastável em mobile**: reordenar posts por
  drag-and-drop no mobile (hoje mobile usa botões/trocas).
- ⬜ **P15 — `PageFallback` com fundo opaco**: o fallback do `<Suspense>` é
  transparente (`h-screen` sem `bg-*`); dar fundo `bg-background` para nunca
  "vazar" a página anterior durante lazy loads.
- ⬜ **P16 — Skeleton loading nas páginas**: trocar spinners por skeletons
  (Home, Feedbacks) para percepção de velocidade.
- ⬜ **P17 — Testes para os novos fluxos**: adicionar testes de regressão para
  `hasCoverInMediaUrls`, `generateVideoFrame` (mokado) e o carrossel do
  Feedbacks.

### 3.3 Segurança / robustez

- ⬜ **S1 — Rate-limit real**: o captcha protege login/cadastro; avaliar
  rate-limit por IP nas edge functions (ou no Supabase).
- ⬜ **S2 — Sanitização em todas as rotas de escrita**: conferir que todo
  `insert/update` passa pelo limite de 2000 chars e sanitização (migração 014 +
  DOMPurify no cliente).

---

## 4. Como usar este checklist

- **Fim de sessão**: marque o que fechou com o commit (`✅` + hash).
- **Início de sessão**: pegue os itens ⬜ prioritários (bugs primeiro, depois
  polimento).
- **Novos bugs**: adicione com o maior número livre (`B15`, `P18`, `S3`...).
- A documentação detalhada de cada bug/feature corrigida está nos estudos
  `17`–`20` e nas decisões D15–D19 do `docs/12`.

---

**Anterior**: [`13-glossario.md`](13-glossario.md) · **Continuação**: a fila de
trabalho ativa está em [`15-backlog-unificado.md`](15-backlog-unificado.md).
