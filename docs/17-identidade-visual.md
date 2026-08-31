# 17 — Nova Identidade Visual

> Registro das decisões de design, alternativas consideradas e impacto na
> aplicação. Substitui o visual anterior baseado em roxo/curvas por um
> minimalista monocromático com linhas retas.

## Resumo das mudanças

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Cor principal | `#7c6af7` (roxo) | `#0a0a0a` (preto light) / `#ffffff` (branco dark) |
| Raio | `0.625rem` (curvo) | `0px` (retangular) |
| Fonte | DM Sans + DM Mono | Roboto (tudo) |
| Navegação | Kanban → Tarefas | KanbanSquare → ListTodo |
| Calendário semanal | Lista empilhada | Grade com horários (30min) + linha "now" |
| Cards calendário | Pílula com nome | Mini-card (foto + nome + legenda + tipo + hora + status) |

## Decisões de design

### Cores (src/index.css)

**Light mode:**
- `--color-primary: #0a0a0a` (preto quase puro)
- `--color-primary-foreground: #ffffff`
- Hierarquia: títulos = `text-foreground` (preto), corpo = `text-muted-foreground` (cinza `#6b7280`)

**Dark mode:**
- `--color-primary: #ffffff` (inverte — branco como destaque)
- `--color-primary-foreground: #0a0a0a`
- Background: `#0a0a0a`, Card: `#141414`, Muted: `#1f1f1f`

**Alternativa considerada:** Manter um accent color sutil (ex: azul neutro). Descartada porque a identidade pede "preta como principal" — sem cor de destaque adicional.

### Raio zero

Zeramos todos os tokens `--radius-*` no `@theme` e adicionamos `.rounded-full { border-radius: 0 !important }` no CSS global.

**Exceção intencional:** Componentes que simulam o Instagram real (StoriesPreview, ReelsPreview, TikTokPreview, IgProfileMockup, moldura de celular) mantêm as curvas — são reprodução fiel do app externo.

**Alternativa considerada:** Usar `border-radius: 2px` para suavizar. Descartada porque o usuário pediu "linhas retas, retangulos e quadrados".

### Fonte Roboto

`--font-sans` e `--font-mono` = Roboto. Removeu-se DM Sans/DM Mono e a dependência `@fontsource-variable/geist`.

### Remoção do roxo

Todas as referências `#7c6af7` → `#374151` (gray-700) como fallback de cor de cliente.
Gradientes `from-pink-400 to-purple-500` → `from-gray-600 to-gray-800`.
Classes `purple-*` → `gray-*`.
Accent/ring tokens → neutros.

## Componentes afetados

- `src/index.css` — tokens de tema
- `src/lib/navigation.ts` — label/ícone
- `src/components/layout/Breadcrumb.tsx` — label
- `src/pages/Feedbacks/Feedbacks.tsx` — título header
- `src/pages/Perfil/Perfil.tsx` — botão Tarefas
- `src/pages/Demo/Demo.tsx` — mock nav
- ~25 arquivos com fallback `#7c6af7`
- ~15 arquivos com gradientes/classes purple

## Impacto

- **Landing/Demo:** herd automaticamente os novos tokens.
- **Dark mode:** cores invertidas (preto → branco).
- **Acessibilidade:** contraste mantido (preto/branco = contraste máximo).
- **Performance:** sem impacto (tokens CSS, sem JS extra).

## Praticar

1. Abra o app e mude entre light/dark — verifique a inversão de cores.
2. Navegue por todas as páginas e confirme que nenhum roxo restou.
3. Verifique que avatares e indicadores de status são quadrados.
4. Confirme que o fonte Roboto é usada em todos os textos.
