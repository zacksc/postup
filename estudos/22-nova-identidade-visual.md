# 22 — Nova Identidade Visual: Design Tokens e Theming

> Estudo técnico sobre como implementar uma nova identidade visual em um app
> React + Tailwind v4 + shadcn/ui, cobrindo design tokens, theming, e decisões
> de arquitetura visual.

## CONCEITO

### Design Tokens

Design tokens são as **unidades atômicas de um sistema visual**: cores, tamanhos,
fontes, espaçamentos, border-radius, sombras. Em vez de espalhar valores mágicos
no CSS/JSX, definimos tokens centralizados que alimentam todo o sistema.

**Por quê?**
- Mudança de tema = trocar tokens, não centenas de arquivos
- Consistência visual garantida
- Facilita dark mode, white-label, testes de acessibilidade

### CSS Custom Properties no Tailwind v4

Tailwind v4 usa `@theme` para declarar tokens que viram utilitários:

```css
@theme {
  --color-primary: #0a0a0a;
  --radius: 0px;
  --font-sans: 'Roboto', sans-serif;
}
```

Isso gera automaticamente `bg-primary`, `text-primary`, `rounded-*`, `font-sans`.

### Hierarquia de contraste

Em design monocromático (preto/branco), a hierarquia de texto vem da **opacidade/cinza**:
- **Títulos:** `text-foreground` (preto puro no light, branco no dark)
- **Corpo:** `text-muted-foreground` (#6b7280 light, #9ca3af dark)
- **Detalhes:** `text-muted-foreground/60` (ainda mais suave)

## NO CÓDIGO

### Tokens (src/index.css:1-84)

```css
/* Light */
--color-primary: #0a0a0a;
--color-foreground: #0a0a0a;
--color-muted-foreground: #6b7280;

/* Dark */
--color-primary: #ffffff;
--color-foreground: #f5f5f5;
--color-muted-foreground: #9ca3af;
```

### Border-radius zero (src/index.css:49-57)

```css
@theme {
  --radius: 0px;
  --radius-lg: 0px;
  --radius-xl: 0px;
  /* ... */
}

.rounded-full {
  border-radius: 0 !important;
}
```

### Fallback de cor de cliente (~25 arquivos)

```tsx
// Antes:
style={{ background: client?.color || '#7c6af7' }}

// Depois:
style={{ background: client?.color || '#374151' }}
```

### Remoção de gradientes purple

```tsx
// Antes:
bg-gradient-to-br from-pink-400 to-purple-500

// Depois:
bg-gradient-to-br from-gray-600 to-gray-800
```

## PRATICAR

1. **Exercício 1:** Crie um novo componente que use `bg-primary`, `text-muted-foreground`,
   e `rounded-xl`. Verifique que no light é preto+cinza+quadrado, no dark é branco+cinza+quadrado.

2. **Exercício 2:** Adicione um novo token `--color-accent` no `@theme` e use como
   `bg-accent`. Teste a transição entre temas.

3. **Exercício 3:** Procure no código por `rounded-full` e verifique se todos são
   convertidos para quadrados (exceto simulações de Instagram).

4. **Exercício 4:** Troque `--font-sans` para outra fonte (ex: Inter) e verifique
   que todo o app atualiza automaticamente.

## ENTREVISTA

**P: O que são design tokens?**
R: Variáveis atômicas que definem as propriedades visuais de um design system
(cores, fontes, espaçamentos). Centralizadas, facilitam manutenção e theming.

**P: Como o Tailwind v4 usa CSS custom properties?**
R: A diretiva `@theme` declara tokens que viram utilitários gerados automaticamente.
`--color-primary: #000` gera `bg-primary`, `text-primary`, `border-primary`, etc.

**P: Por que usar preto/branco como cores primárias?**
R: Design monocromático maximiza contraste, é acessível (WCAG AAA), e cria
identidade visual forte sem depender de paletas coloridas.

**P: Como funciona a inversão dark mode?**
R: Tokens diferentes para `.dark` — `--color-primary: #ffffff` (inverte de preto
para branco). O CSS varia a cor; o JSX não muda.
