# 02 — A Stack: cada tecnologia e por quê

> **Objetivo**: conhecer cada biblioteca do `package.json`, o papel dela e por que
> foi escolhida (com as alternativas consideradas).

## A fundação

| Tecnologia | Papel | Por quê |
|------------|-------|---------|
| **React 19** | Biblioteca de UI | Ecossistema gigante, componentes declarativos, portfólio padrão de mercado |
| **TypeScript ~5.9** | Tipos estáticos | Encontra erros antes de rodar; autocomplete; foi a **migração** que iniciou o projeto |
| **Vite 8** | Build/servidor dev | Build ultra-rápido (esnext), HMR instantâneo; padrão da comunidade moderna |
| **Tailwind CSS v4** | Estilos | Utility-first, tema via CSS (`@theme`), sem config JS verbosa; a v4 usa CSS nativo |
| **shadcn/ui** | Componentes base | Não é uma dependência: são **códigos copiados para o repo**, totalmente customizáveis |

### O que é shadcn/ui (importante para iniciantes)

Diferente de Material UI ou Ant Design, **shadcn/ui não é um pacote instalado**.
É uma coleção de componentes (Radix UI + estilos Tailwind + `cva`) que você copia
para `src/components/ui/`. Você possui o código, pode editar à vontade. No PostUp
os componentes `button`, `badge`, `dialog`, `input`, etc. vieram daí — e vários
foram **modificados** (ex.: o `Button` ganhou variantes customizadas `approve`,
`feedback`, `link`; o `Badge` virou `StatusBadge`/`TypeBadge`).

## Estado, dados e comunicação

| Tecnologia | Papel | Por quê |
|------------|-------|---------|
| **Zustand 5** | Estado global | API mínima (`create`), sem boilerplate, atualizações fora do React, facilita migrar de `useContext` |
| **@supabase/supabase-js** | Cliente do backend | Backend como serviço (Postgres, Auth, Storage, Realtime) sem servidor próprio |
| **React Router 7** | Roteamento | `lazy` + `Suspense` para code-splitting; rotas aninhadas (layout protegido) |
| **react-query (via Supabase + hooks)** | Cache de dados | O projeto usa hooks próprios com `supabase` direto (sem react-query) |

> **Decisão**: não usamos React Query/SWR. Os dados de um único usuário agência são
> relativamente pequenos; hooks próprios (`use-feedbacks`, `use-feedbacks-cards`...)
> com chamadas diretas ao Supabase são suficientes e mantêm a stack menor.
> **Se a aplicação crescer** (muitas telas consultando o mesmo dado), reavalie.

## UI e interação

| Tecnologia | Papel |
|------------|-------|
| **radix-ui** | Componentes acessíveis de baixo nível (dropdown, dialog, tooltip) que o shadcn embrulha |
| **cva + clsx + tailwind-merge** | `class-variance-authority` define variantes; `cn()` (em `lib/utils.ts`) combina classes e resolve conflitos |
| **lucide-react** | Ícones (SVG tree-shakeable) |
| **sonner** | Toasts (notificações discretas no canto da tela) |
| **next-themes** | Toggle claro/escuro sem "flash" no carregamento |
| **@fontsource-variable/geist** | Fonte Geist (variável, da Vercel) |
| **date-fns** | Manipulação de datas (leve, modular, imutável) |
| **react-day-picker** | Calendário para seleção de data (ex.: agendamento) |
| **@fullcalendar/* (daygrid, interaction, react)** | Cronograma mensal/semanal com arrastar-para-criar |
| **@dnd-kit/core, sortable, utilities** | Drag and drop (kanban de feedbacks, ordenar mídias) |
| **react-easy-crop** | Crop de imagem (avatar de cliente, capas) |
| **react-hook-form** | Formulários com validação (novo cliente, cadastro) |
| **@marsidev/react-turnstile** | Widget CAPTCHA da Cloudflare no login/cadastro |
| **dompurify** | Sanitização de HTML (legendas que podem conter rich text) |
| **tw-animate-css** | Animações de entrada/saída (usadas pelos componentes shadcn) |

## Ferramentas de qualidade

| Tecnologia | Papel |
|------------|-------|
| **Vitest + Testing Library + jsdom** | Testes unitários e de componente rodando no Node (ambiente DOM simulado) |
| **ESLint 9 + typescript-eslint** | Lint: `no-explicit-any`, `react-hooks/exhaustive-deps`, etc. |
| **GitHub Actions** | CI: roda lint + typecheck + build + testes a cada push/PR na `main` |
| **Vercel** | Deploy automático do repo (preview por PR + produção) |

## Por que NÃO usamos outras opções (resumo)

- **Next.js**: SSR não é necessário (app é autenticado e roda no cliente); Vite é mais simples para SPA + Supabase.
- **Redux Toolkit**: muito boilerplate; Zustand resolve o mesmo problema com ~10 linhas.
- **MUI/AntD**: design próprio pesado de customizar; shadcn + Tailwind dá identidade visual única.
- **Firebase**: Supabase oferece Postgres real (relacional), RLS, e é open-source.
- **Sentry**: foi avaliado e **removido** (custo/complexidade para o momento). Alternativas futuras: Highlight.io, PostHog, Rollbar.

## Praticar

1. Leia `package.json` e identifique: qual lib é usada para drag-and-drop? Para crop? Para toasts?
2. Abra `src/lib/utils.ts` — entenda a função `cn()` (clsx + tailwind-merge).
3. Compare com um projeto que use Material UI: quais vantagens você vê em copiar o código do componente (shadcn) vs instalar?

**Anterior**: [`01-fundamentos.md`](01-fundamentos.md) · **Próximo**: [`03-arquitetura.md`](03-arquitetura.md)
