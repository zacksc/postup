# 05 — CSS moderno e Tailwind v4

> **Objetivo**: entender como o PostUp estiliza — Tailwind v4 (CSS-first),
> tokens semânticos, dark mode e o padrão `cva` + `cn()`.

## CONCEITO — O que é Tailwind (e utility-first)

Tailwind é um framework de CSS baseado em **classes utilitárias**: em vez de
escrever blocos CSS nomeados (`.card { ... }`), você aplica utilidades na classe:

```html
<div class="bg-white p-4 rounded-lg shadow flex items-center">
```

**Prós**: consistência, sem nomear classes, sem CSS "vivo" esquecido, fácil de
remover (a classe não usada simplesmente não gera CSS).
**Contras (mitigados)**: HTML "sujo", reuso via componentes (o PostUp resolve com
componentes React + `cva`).

## CONCEITO — Tailwind v3 vs v4 (importante para entrevista)

- **v3**: config em JS (`tailwind.config.js`) com `theme.extend`.
- **v4 (o PostUp)**: **CSS-first**. A configuração vive em CSS nativo via
  `@theme` e o plugin da Vite (`@tailwindcss/vite`). Sem arquivo de config JS.
- O build lê as classes usadas e **gera só o CSS necessário** (tree-shaking de CSS).

## NO CÓDIGO — O tema do PostUp

```css
@theme {
  --color-primary: ...;
  --color-secondary: ...;
  --color-accent: ...;
  --color-destructive: ...;
}
```

Esses tokens geram classes como `bg-primary`, `text-muted-foreground`. A ideia é
**semântica**: os componentes usam `primary`/`secondary`/`accent`/`destructive`
em vez de cores fixas ("roxo", "cinza"). Trocar o tema inteiro = mudar poucos tokens.

## CONCEITO — Design tokens (conceito mais amplo)

"Design token" = variável de valor de design (cor, espaçamento, fonte, raio) usada
de forma consistente. No PostUp os tokens vivem em `@theme`; no Tailwind clássico
seriam `theme.extend.colors`. Benefício: mudou o token, mudou o app todo.

## CONCEITO — Dark mode

```tsx
<ThemeProvider attribute="class" defaultTheme="light">   // next-themes
```

- O `next-themes` coloca a classe `dark` no `<html>` quando o tema é escuro.
- No CSS, tokens condicionais: `[data-theme="dark"]` ou `@variant dark` definem
  as cores escuras.
- Os componentes usam os mesmos tokens (`bg-panel`, `text-muted`) — o dark mode
  "funciona sozinho" porque as cores são semânticas, não literais.
- **Por que `next-themes`?** Ele injeta um script no `<head>` ANTES do render para
  aplicar o tema salvo sem "flash" (piscar tema errado no carregamento).

## CONCEITO — `cva` (class-variance-authority)

```tsx
const buttonVariants = cva('base:rounded-md ...', {
  variants: {
    variant: {
      default: 'bg-primary ...',
      destructive: 'bg-destructive ...',
      approve: 'bg-emerald-600 ...',
      link: 'underline ...',
    },
    size: { sm: 'h-8 px-3', default: 'h-10 px-4' },
  },
})
```

- **`cva` define variantes com TypeScript**: cada variant vira um prop tipado.
- "Composição de classes com segurança de tipo" — impossível passar uma variant
  que não existe.
- O PostUp customizou o `Button` do shadcn com variantes do domínio: `approve`,
  `feedback`, `link`.

## CONCEITO — `cn()` e o problema da "guerra de classes"

```tsx
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- **`clsx`**: junta classes condicionalmente (`cn(cond && 'p-4', 'flex')`).
- **`tailwind-merge`**: resolve CONFLITOS — se você passa `p-2` e `p-4`, ele mantém
  o último (não gera CSS contraditório).
- `cn()` é o padrão de todos os componentes do PostUp para receber classes extras
  do chamador sem sobrescrever as do componente.

## NO CÓDIGO — `src/components/ui/button.tsx` e `badge.tsx`

1. `button.tsx`: `cva` com variantes + `cn` para aplicar + `forwardRef`.
2. `badge.tsx`: as variantes `approve/feedback/link...` e os ícones por `contentType`.
3. `status-badge.tsx`: **não sabe CSS** — só escolhe a variante certa. O `Badge`
   (com cva) sabe as cores. Separação: "o que mostrar" (StatusBadge) vs "como
   estilizar" (Badge).

## CONCEITO — Animações

`tw-animate-css` fornece classes de animação (entrada/saída) usadas pelos
componentes shadcn (Dialog, Dropdown). São animações CSS puras via utility classes.

## PRATICAR

1. Mude `--color-primary` no `@theme` e veja o app inteiro mudar. Depois desfaça.
2. No `button.tsx`, adicione uma variant `facebook: 'bg-blue-600 ...'` — o TypeScript
   exige que os usos existentes continuem válidos. Teste usar `variant="facebook"`.
3. No `StatusBadge`, o que acontece se você passar `size="xl"`? O TS acusa — por quê?
4. Escreva `cn('p-2', 'p-4')` e veja o resultado. Sem `twMerge`, qual seria o problema?

## ENTREVISTA — perguntas típicas

**"Tailwind vs CSS-in-JS vs CSS Modules?"**
Estrutura: (1) Tailwind = utilitárias + tokenização, CSS gerado sob demanda;
(2) CSS Modules = escopo local por arquivo; (3) CSS-in-JS (styled-components) =
estilo dentro do componente com dinamicidade; (4) o PostUp escolheu Tailwind v4
por: velocidade, consistência, tokens semânticos e dark mode; (5) nuance: cada
abordagem tem trade-off — o importante é o design system (tokens), não a ferramenta.

**"O que são design tokens e por que usar?"**
Estrutura: (1) valores de design centralizados (cor, espaço, fonte); (2) consistência
e mudança em um ponto; (3) no PostUp: `@theme` do Tailwind v4; (4) permite tema
claro/escuro e rebranding rápido; (5) relação com design system.

**"Como funciona o dark mode no PostUp?"**
Estrutura: (1) `next-themes` aplica classe `dark` no `<html>`; (2) tokens semânticos
mudam com a classe; (3) componentes não sabem de "claro/escuro" — só usam tokens;
(4) sem flash de tema errado no load (script antes do render).

**Anterior**: [`04-render-perf.md`](04-render-perf.md) · **Próximo**: [`06-sql-postgres.md`](06-sql-postgres.md)
