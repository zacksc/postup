# 09 — Design system: componentes de UI

> **Objetivo**: entender a camada visual — componentes `ui/`, o padrão cva,
> as variantes semânticas e o tema Tailwind v4.

## A hierarquia de componentes

```
components/ui/     → átomos genéricos (button, badge, input, dialog...) [shadcn]
components/layout/ → AppShell, Sidebar, Header, BottomNav, Breadcrumb...
components/post/   → PostCard, PostPill, IgPreview, KanbanColumn, MediaPreview, MediaLightbox
components/instagram/ → IgProfileMockup (simulador de perfil do Instagram)
components/feedback/ → FeedbackThread, FeedbackModal, FeedbackCardModal
components/calendar/ → MonthView, WeekView
components/modals/ → PostModal, ClientModal, ImageCropperModal
components/client/ → ClientCard
pages/             → composição final de cada tela
```

Regra do projeto: **componentes de `ui/` não conhecem domínio** (não sabem o que
é um "post"); componentes de domínio (`post/`, `feedback/`) usam os de `ui/`.

## cva: variantes com TypeScript

`class-variance-authority` (cva) define variações de estilo com segurança de tipo.
O `Button` (`ui/button.tsx`) é o exemplo máximo:

```ts
const buttonVariants = cva('base:rounded-md focus-visible:ring-2 ...', {
  variants: {
    variant: {
      default: 'bg-primary text-white hover:...',
      secondary: 'bg-secondary ...',
      outline: 'border ...',
      ghost: 'transparent hover:bg-accent',
      destructive: 'bg-destructive text-white ...',
      approve: 'bg-emerald-600 ...',   // variantes customizadas do PostUp
      feedback: 'bg-amber-500 ...',
      link: 'underline-offset-4 ...',
    },
    size: { sm: 'h-8 px-3', default: 'h-10 px-4', lg: 'h-11 px-8' },
  },
})
```

Cada `variant` é um objeto de classes Tailwind. O TS obriga: se você adicionar
uma variant nova, precisa passá-la no prop. E o `StatusBadge` delega as variantes
ao `Badge` (`variant={status}`), que por sua vez tem uma variant para cada status —
a cor do post no app inteiro vem de um único lugar.

## StatusBadge / TypeBadge — o "vocabulário visual"

`status-badge.tsx`:

- `PostStatus` e `PostType` são tipos união.
- `Record<PostStatus, string>` garante label para todo status.
- `StatusBadge` repassa `variant={status}` → cores coerentes em toda a UI.
- `TypeBadge` usa `contentType` para o ícone certo (reels=Video, carrossel=Layers...).

**Por que centralizar?** Se o "aprovado" mudar de verde para azul, muda em 1 lugar
e o app inteiro segue. Se um status novo aparecer, o TS obriga a dar label+cor.

## Tema Tailwind v4

Diferente da v3 (config JS `tailwind.config.js`), a v4 é **CSS-first**:

```css
/* src/index.css (resumo) */
@theme {
  --color-primary: ...;
  --color-secondary: ...;
  --color-destructive: ...;
  --color-accent: ...;
}
```

- **Paleta semântica**: `primary`, `secondary`, `accent`, `destructive`,
  `muted`, `muted-foreground`... Os componentes usam nomes semânticos em vez de
  cores "chatas" (`bg-primary`, `text-muted-foreground`) — trocar o tema inteiro
  vira mexer em poucos tokens.
- **Dark mode**: classe `.dark` no `<html>` + tokens com `@variant dark`.
- **`tw-animate-css`**: animações de entrada/saída dos componentes shadcn
  (dialog, dropdown, etc.).

## Utilitários de estilo

- **`cn()`** (`lib/utils.ts`): `twMerge(clsx(inputs))`. Combina classes condicionais
  e **resolve conflitos** (ex.: `"p-2"` + `"p-4"` → mantém `p-4`). É o padrão de
  quase todo componente.
- **`getInitials`**: gera as iniciais do `Avatar` (1 nome → 2 letras; 2+ → iniciais).
- **Ícones**: `lucide-react` — importa só o SVG usado (tree-shaking).

## Componentes-chave e por que existem

| Componente | Para quê |
|------------|----------|
| `AppShell` + `Sidebar` + `Header` + `BottomNav` | Layout responsivo: sidebar desktop, bottom-nav mobile, header com breadcrumb/notificações/tema |
| `ProtectedRoute` | Gate de autenticação (redireciona para `/login`) |
| `IgPreview` | Preview "hiper-realista" do post (moldura de celular, grid 3 colunas) |
| `IgProfileMockup` | Mockup do PERFIL inteiro do Instagram (celular fake, header, abas, grid 3 colunas, bolinhas de status) |
| `MediaPreview` + `MediaLightbox` | Miniatura de mídia + lightbox em grande com som (vídeo `controls+autoPlay` sem `muted`), setas/contador |
| `PostCard` / `ClientCard` | Cartões com status, progresso e ações rápidas |
| `KanbanColumn` | Coluna do kanban com dnd-kit (drag-and-drop) |
| `PostModal` / `ClientModal` / `FeedbackCardModal` | Modais de edição rápida sem trocar de página |
| `MonthView` / `WeekView` | Visões do cronograma (fullcalendar customizado) |
| `NotificationDropdown` | Sino com dropdown de notificações |
| `TurnstileWidget` | Captcha Cloudflare no login/cadastro |
| `ImageCropperModal` | Crop de imagem (react-easy-crop) |

## Componentes novos: mídia e mockup (commits `42e1ce8`, `2f6a6ab`)

### `MediaLightbox` (`components/post/MediaLightbox.tsx`)

- Dialog (shadcn/Radix) com overlay escuro (`bg-black/95`), mídia em
  `max-h-[85vh]`, `Esc` fecha, foco preso.
- **Vídeo toca com som**: `controls autoPlay playsInline` SEM `muted` — a
  proposta do lightbox é ver a mídia "de verdade".
- Navegação **circular** (`% items.length`) com contador `n+1/total`.
- `key={current.url}` força remontagem do `<img>`/`<video>` a cada troca.
- Reset de índice por **remontagem via `key`** no chamador (`MediaPreview`):
  `key={lightboxOpen ? 'lightbox-open' : 'lightbox-closed'}` — evita
  `setState` em efeito (regra `react-hooks/set-state-in-effect`).

### `IgProfileMockup` (`components/instagram/IgProfileMockup.tsx`)

- Moldura de celular (cantos 32px, border preta, notch), cabeçalho IG (avatar,
  stats, bio, botão "Seguir"), abas grid/tags com estado interno.
- Grid 3 colunas com `aspect-[4/5]` e `gap-[1px]`; **só posts reais** (sem
  células "+" vazias).
- **Aumentação do PostUp**: bolinha de status + contorno tracejado nos posts
  não publicados — o gestor vê o estado dentro da "cara de Instagram".
- `style={{ width }}` deixa a mesma peça servir 300px (grid), coluna do
  ClienteFluxo e modal de prévia.

## Estratégia de animação (sem penalizar desempenho)

Decisão baseada em benchmark (GSAP/Framer Motion adicionam 23–46KB de JS e
+8–50ms de INP; CSS puro: 0KB, roda no compositor sem travar a main thread):

1. **CSS-first** — micro-interações e entradas usam `transition`/`@keyframes`.
   **Nunca** animar `width/height/top/left/box-shadow` (layout/paint → jank e CLS);
   só `transform` e `opacity` (compositor-only).
2. **Framer Motion em momentos específicos** — apenas onde CSS puro não cobre bem:
   count-up de números (`CountUp`), reveal no scroll com suporte universal
   (`Reveal`, `whileInView`) e entrada/saída de painéis (`AnimatePresence` no
   dropdown de notificações). Todo o resto continua em CSS. Custo aceito:
   ~9KB gzip no bundle principal (autorizado pelo dono do projeto).
3. **Utilitários no `index.css`** (Tailwind v4 `@theme`): `animate-fade-in`,
   `animate-fade-up`, `animate-scale-in`, `animate-pop`, `animate-page`,
   `animate-slide-in` + `.stagger` (fade-up em cascata por filho, delay até 12
   itens) e `.lift` (elevação de hover via `translateY`).
4. **Transição de página**: `AppShell` remonta `<main>` com `key=pathname+search`
   e `animate-page` → fade por troca de rota, zero lib. Bônus: scroll volta ao topo.
5. **Aplicado em**: métricas Home/Dashboard (count-up), lista de clientes, cards
   do Kanban, lista/bolhas do Chat, grid do GridInstagram e seções da Landing
   (reveal no scroll).
6. **Acessibilidade**: bloco `@media (prefers-reduced-motion: reduce)` zera
   duração de animações/transições no app inteiro; Framer Motion respeita o SO
   via `<MotionConfig reducedMotion="user">` no `main.tsx`.

## Padrões de código que valem ouro

1. **Props `size` tipadas** (`'sm' | 'md' | 'lg'`) — nada de mágica por string livre.
2. **Composição em vez de herança** — `StatusBadge` compõe `Badge`, não estende.
3. **`useToast`** centraliza mensagens do sonner: o componente não escreve
   `toast.success(...)` repetido, usa `const { postSaved } = useToast()`.
4. **Classes utilitárias no corpo, tokens no design system** — variação pontual
   via `cn('extra', ...)`.

## Praticar

1. Mude a cor do status "aprovado" no `badge.tsx` e veja o app inteiro mudar.
2. Adicione um novo `PostType` (ex.: `'guia'`) — o que o TypeScript exige antes de compilar?
3. Leia `components/ui/button.tsx` e identifique as 8 variantes; experimente `variant="link"` em algum botão do app.

**Anterior**: [`08-estado-hooks.md`](08-estado-hooks.md) · **Próximo**: [`10-testes-qualidade.md`](10-testes-qualidade.md)
