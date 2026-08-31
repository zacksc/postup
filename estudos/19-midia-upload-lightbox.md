# 19 — Mídia a fundo: compressão de vídeo no navegador, capa de reels e lightbox

> **Objetivo**: destrinchar as features de mídia que o PostUp ganhou: comprimir
> vídeo **no navegador** (sem servidor), gerar **capa automática** de reels e
> abrir mídia em **lightbox com som**. São três problemas de web interessantes:
> WebAssembly, canvas + vídeo, e o ciclo render→paint sob regra de lint.

## O mapa do passeio

```
Feature 1 — compressão de vídeo no browser  → ffmpeg.wasm + WebAssembly
Feature 2 — capa automática de reels        → <video> + canvas + frame aleatório
Feature 3 — lightbox de mídia com som       → Dialog + vídeo com controls + remount por key
```

Tese que atravessa tudo: **o navegador é um computador completo — dá para rodar
um encoder de vídeo, "tirar foto" de um vídeo e tocar som dentro dele, sem
nenhum servidor.** O PostUp aproveita isso para não estourar o storage do
Supabase gratuito (1 GB).

---

## Parte 1 — Compressão de vídeo no navegador (`src/lib/compress-video.ts`)

### 1.1 O problema

O usuário faz upload de reels de 200 MB. O plano gratuito do Supabase tem
1 GB de storage. Se ninguém comprimir, 5 vídeos lotam a conta. Além disso,
vídeo de 4K não faz sentido para preview num feed de 720px.

### 1.2 Os conceitos

**ffmpeg**: o encoder de vídeo mais famoso do mundo (linha de comando). Ele
"transcodifica" (converte de um formato/qualidade para outro). `ffmpeg.wasm`
é a versão que roda dentro do navegador via **WebAssembly (wasm)** — código
binário que o navegador executa quase na velocidade nativa.

**H.264 + AAC**: o codec de vídeo e áudio que o Instagram/everyone entende.
No ffmpeg: `-c:v libx264` (vídeo) e `-c:a aac` (áudio).

**CRF**: número de qualidade do H.264. Quanto MENOR, melhor qualidade e maior
arquivo. `28` é um bom equilíbrio para previews. (`-crf 28`.)

**Preset `veryfast`**: troca um pouco de eficiência de compressão por
velocidade — no navegador, cada segundo importa.

**`movflags +faststart`**: move o índice (a "tabela de conteúdo") do vídeo
para o começo do arquivo, para o player iniciar o playback antes de baixar o
arquivo inteiro. Essencial para upload em nuvem + playback em streaming.

**`-vf` (video filter)**: recebe o filtro `scale=...` que redimensiona.
O PostUp usa:
`min(720, iw):min(720, ih):force_original_aspect_ratio=decrease`
- `iw`/`ih` = largura/altura ORIGINAIS do vídeo.
- `min(720, iw)` = "720 se for maior, senão o tamanho original".
- Resultado: **nunca faz upscaling** — um vídeo de 640px continua 640px.

### 1.3 O código (os pontos-chave)

```ts
export const MAX_MEDIA_SIZE = (Number(import.meta.env.VITE_MAX_MEDIA_SIZE) || 30) * 1024 * 1024
const AUDIO_BITRATE = 128 * 1024
const SAFETY_MARGIN = 0.85
const MAX_DIMENSION = 720
const RESOLUTION_LADDER = [540, 480, 360]   // se precisar descer de resolução
```

**Carregamento lazy (só quando precisar):** o ffmpeg core (~30 MB) não é
baixado no load do app — só na primeira vez que alguém envia um vídeo grande:

```ts
let ffmpegPromise: Promise<FFmpeg | null> | null = null

function getFFmpeg(): Promise<FFmpeg | null> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      try {
        const { FFmpeg } = await import('@ffmpeg/ffmpeg')   // import dinâmico
        const ffmpeg = new FFmpeg()
        await ffmpeg.load({ coreURL: '/ffmpeg/ffmpeg-core.js', wasmURL: '/ffmpeg/ffmpeg-core.wasm' })
        return ffmpeg
      } catch {
        ffmpegPromise = null    // deixa tentar de novo na próxima vez
        return null
      }
    })()
  }
  return ffmpegPromise
}
```

A variável `ffmpegPromise` é um **cache de promessa**: só criamos o ffmpeg uma
vez por sessão. Se falhar, zeramos (`= null`) para permitir nova tentativa.

**A função principal — duas "saídas cedo" e um fallback:**

### 1.4 Estratégia para CABER no limite (e não só "converter")

O objetivo não é apenas "comprimir": é **garantir que o arquivo final caiba no
limite** (30 MB padrão, `MAX_MEDIA_SIZE`). Se um CRF fixo estourar o limite, o
upload falharia. Então a função usa uma **escada de tentativas calculadas**:

```
1. arquivo ≤ limite        → mantém original (sem custo)
2. lê a DURAÇÃO via <video> → bitrate-alvo = (limite×0.85 × 8 ÷ duração) − áudio
3. codifica com esse bitrate → verifica o tamanho real
4. ainda estourou? → escada: bitrate ×0.7 → ×0.5 → ×0.35 → 540p → 480p → 360p
5. devolve o MENOR resultado obtido (nunca o erro cru "arquivo grande demais")
```

- **`SAFETY_MARGIN = 0.85`**: mira em 85% do limite para absorver a variação do
  encoder (container overhead, keyframes) e nunca chegar colado no teto.
- **Duração via `<video>`**: barata (metadata) e não depende do ffmpeg; se falhar,
  a escada usa **CRF crescente** (28→40) como fallback.
- **Progresso por tentativa**: a barra escala `i/attempts + progresso/attempts`
  para refletir a tentativa atual.

**A regra de ouro continua:** nunca devolve algo maior que o original e nunca
upscaling. A diferença é que, agora, **falhar em caber no limite é o último
recurso**, não a primeira resposta.

---

## Parte 2 — Capa de reels automática (`src/lib/video-frame.ts`)

### 2.1 O problema

Reels (vídeos verticais) precisam de uma **capa** para o preview parecer um
post. Se o usuário não enviar uma, o PostUp extrai um frame do próprio vídeo.

### 2.2 Os conceitos

**`<video>` + canvas**: o navegador consegue "pausar" um vídeo num instante T
e desenhar o frame atual num `<canvas>` (a tela de desenho). O canvas então
gera um arquivo de imagem (`toBlob`).

**`createObjectURL`**: cria uma URL temporária (`blob:...`) apontando para o
arquivo local, sem precisar fazer upload. Sempre revogar com
`URL.revokeObjectURL` para não vazar memória.

**Events assíncronos do vídeo**: `onloadedmetadata` (descobriu duração e
dimensões) e `onseeked` (terminou de pular para o instante pedido). O código
embrulha cada um numa `Promise` para poder `await`.

### 2.3 O código (os pontos-chave)

```ts
const duration = video.duration
const targetTime = duration * (0.2 + Math.random() * 0.6)
video.currentTime = targetTime
```

- **Take aleatório entre 20% e 80% da duração**: evita o primeiro frame (que
  costuma ser preto/logo) e o último (fade out/logo). O `+Math.random()*0.6`
  dá entre 20% e 80%.
- **`Math.random()`**: cada capa gerada automaticamente é diferente — o grid
  do Instagram não fica com 10 thumbnails idênticos.

```ts
const MAX = 720
const ratio = Math.min(1, MAX / Math.max(width, height))
width = Math.round(width * ratio)
height = Math.round(height * ratio)
```

Mesma filosofia da compressão: redimensiona **para baixo, nunca para cima**
(`Math.min(1, ...)`), mantendo a proporção.

```ts
canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82)
```

Qualidade JPEG `0.82` — bom visual, arquivo leve (ideal para thumbnail).

**Robustez:** cada falha possível (não é vídeo, duração inválida, sem
dimensões, sem contexto 2D, erro de seek) retorna `null` — e o chamador segue
sem capa em vez de quebrar.

### 2.4 A convenção no banco: `media_urls = [capa, vídeo]`

A capa e o vídeo viram UMA lista ordenada:

```
media_urls: ["<url da capa>", "<url do vídeo>"]
```

- `media_urls[0]` = capa (imagem), `media_urls[1]` = vídeo.
- Quando o PostUp carrega um post para editar, ele precisa saber se a primeira
  URL é capa ou é o vídeo direto. Entra o helper `src/lib/utils.ts`:

```ts
export function hasCoverInMediaUrls(mediaUrls) {
  if (isVideoUrl(mediaUrls[0] || '')) return false      // já é vídeo na frente
  return mediaUrls.slice(1).some(u => !!u && isVideoUrl(u))
}
```

"Tem capa" = o primeiro item NÃO é vídeo e existe um vídeo depois. Simples,
determinístico, sem tabela extra.

### 2.5 O fluxo no NovoPost (`src/pages/Post/NovoPost.tsx`)

```
Usuário anexa vídeo (reels)
   │
   ▼
A barra "Capa do vídeo (opcional)" aparece
   │
   ├─ Usuário envia uma imagem como capa → compressImage → vira media_urls[0]
   │
   └─ Usuário NÃO envia capa
         │
         ▼
   generateVideoFrame(videoFile)  → frame aleatório → vira media_urls[0]

finalMediaUrls = coverUrl ? [coverUrl, ...mediaUrls] : mediaUrls
```

Na edição (carregar versão salva), o `hasCoverInMediaUrls` detecta a capa e a
UI já mostra "Capa existente". Mesma função garante consistência em todos os
pontos que leem um post.

---

## Parte 3 — Lightbox de mídia (`MediaLightbox.tsx` + `MediaPreview.tsx`)

### 3.1 O problema

Antes, clicar num post abria o modal de detalhes ou nada — não dava para
**ver a mídia em grande, com som, e passar as imagens de um carrossel**. O
lightbox resolve: clique → mídia grande em modal escuro → navegar entre
itens → vídeo toca com áudio.

### 3.2 O código

**`MediaLightbox`** (`src/components/post/MediaLightbox.tsx`):

```tsx
const [index, setIndex] = useState(startIndex)
const safeIndex = Math.min(Math.max(index, 0), items.length - 1)
const current = items[safeIndex]

const prev = () => setIndex(i => (i - 1 + items.length) % items.length)  // circular
const next = () => setIndex(i => (i + 1) % items.length)
```

- `safeIndex` **satura** o índice (nunca sai da lista), enquanto `prev`/`next`
  usam módulo (`%`) para **voltar ao início** quando chega ao fim — carrossel
  circular.
- `key={current.url}` no `<img>`/`<video>`: força o React a **remontar** o
  elemento a cada troca de item — senão o navegador reusaria o elemento e a
  imagem/vídeo novo não reiniciaria.
- `autoPlay + controls` **sem `muted`**: o vídeo toca com som (é a proposta do
  lightbox — ver a mídia "de verdade"). O `controls` deixa o usuário pausar.
- `poster`: ao navegar de um item para o vídeo, usa a primeira imagem como
  poster temporário.
- O `Dialog` (shadcn/Radix) dá o overlay escuro, `Esc` para fechar e foco
  preso — acessibilidade de graça.

**`MediaPreview`** (`src/components/post/MediaPreview.tsx`) — o componente que
EXIBE a miniatura e agora pode "abrir" o lightbox:

```tsx
const items = lightboxItems?.length ? lightboxItems : [{ url, mediaType: isVideo ? 'video' : 'image' }]
// Se o que aparece é uma capa (imagem) e existe vídeo na lista,
// o lightbox abre DIRETO no vídeo:
const startIndex = items.length > 1 && !isVideo
  ? Math.max(0, items.findIndex(it => it.mediaType === 'video'))
  : 0
```

- `clickable` → vira botão (`cursor-zoom-in`), com ícone de maximizar no
  hover, e abre o lightbox.
- **Capa + vídeo**: o usuário clica na capa (imagem), mas o que ele quer ver é
  o vídeo — por isso `startIndex` aponta para o primeiro item do tipo vídeo.

**O truque da `key` (e a regra de lint):**

```tsx
<MediaLightbox
  key={lightboxOpen ? 'lightbox-open' : 'lightbox-closed'}
  ...
/>
```

O projeto roda uma regra de lint (`react-hooks/set-state-in-effect`) que
**proíbe chamar `setState` síncronamente dentro de `useEffect`**. O jeito
clássico de "resetar o índice do lightbox a cada abertura" seria:

```tsx
useEffect(() => { if (open) setIndex(startIndex) }, [open])   // ❌ proibido
```

Em vez de brigar com o lint, usamos **remontagem por `key`**: ao trocar a key,
o React desmonta e remonta o componente inteiro — e `useState(startIndex)`
reinicializa sozinho, **sem nenhum efeito**. É o padrão "key como reset de
estado", limpo e declarativo.

### 3.3 Onde o lightbox está habilitado

- `ClienteFluxo` (revisão do cliente), `GridInstagram`, `Feedbacks`,
  `NovoPost` (lista de mídias enviadas), `IgPreview`.
- Todos passam `clickable` + `lightboxItems={mediaUrls.map(...)}` — um único
  componente, cinco telas, mesma experiência.

---

## Parte 4 — Checklist de reconhecimento e lições

| Se você vê... | Causa provável | Onde olhar |
|---|---|---|
| Vídeo do upload em tamanho original | Falhou compressão → fallback retorna original | `compressVideo` (limite, wasm, `blob.size`) |
| Sem barra de progresso do vídeo | `ffmpeg.on('progress')` não registrado | `if (onProgress) ffmpeg.on(...)` |
| Capa automática repetida (mesmo frame) | Sem `Math.random()` no `targetTime` | `video-frame.ts` |
| Primeira imagem da lista sumiu na edição | `media_urls[0]` sem capa → `hasCoverInMediaUrls` false | convenção `[capa, vídeo]` |
| Lightbox abre na imagem e não no vídeo | `startIndex` não pulando para o vídeo | `MediaPreview` startIndex |
| Lint reclamando de setState em efeito | Regra `react-hooks/set-state-in-effect` | `key` de remontagem |
| Vídeo no lightbox sem som | `muted` presente | tirar `muted`, manter `controls` |

### Lições que valem ouro

1. **O navegador é um runtime completo.** ffmpeg.wasm (WebAssembly), canvas e
   `<video>` permitem processar mídia no cliente — economizando storage e
   servidor. O custo é CPU do usuário, então **nunca faça mais que o
   necessário** (threshold, 720p, preset veryfast).
2. **Três regras de segurança de upload**: só converter o tipo certo; só
   converter acima do limite; nunca devolver arquivo maior que o original.
3. **Semântica de lista ordenada** (`[capa, vídeo]`) + helper determinístico
   (`hasCoverInMediaUrls`) = convenção auto-documentada, sem schema novo.
4. **Para resetar estado "ao abrir", use `key` de remontagem, não efeito.**
   É mais declarativo E satisfaz o lint.
5. **Carrossel circular**: `% length` para avançar/voltar, e saturação para o
   índice "seguro" nunca quebrar o render.

---

## Parte 5 — Para fixar (exercícios)

1. Abra `src/lib/compress-video.ts`. Liste as 3 condições em que a função
   devolve o arquivo ORIGINAL sem comprimir, e explique por que cada uma é
   correta.
2. Explique a expressão
   `scale=min(720\,iw):min(720\,ih):force_original_aspect_ratio=decrease`
   com um vídeo 1920x1080 e um vídeo 640x360.
3. Abra `src/lib/video-frame.ts`: por que `0.2 + Math.random() * 0.6`?
   O que aconteceria se fosse `Math.random()` puro (0% a 100%)?
4. Abra `src/components/post/MediaPreview.tsx`: descreva o que muda se
   `lightboxItems` tiver 3 imagens e nenhum vídeo. Qual é o `startIndex`?
5. Por que `key={lightboxOpen ? 'lightbox-open' : 'lightbox-closed'}` no
   `<MediaLightbox>`? Simule o código proibido (setState em efeito) e explique
   a violação da regra.

---

## Links para continuar

- **`docs/09-ui-componentes.md`** — design system (Dialog, MediaPreview, etc.).
- **`docs/12-decisoes-alternativas.md`** — D15 (compressão 720p/25MB), D16
  (capa `[capa,vídeo]`), D17 (lightbox com `key`).
- **`docs/05-dados-supabase.md`** — storage do Supabase e a convenção
  `media_urls`.
- **`estudos/05-css-tailwind.md`** — classes utilitárias usadas na UI de mídia.
- **`estudos/17-estudo-de-caso.md`** — o método do caçador aplicado a bugs.
