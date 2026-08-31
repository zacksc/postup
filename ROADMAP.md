# PostUp — Roadmap de Estudo

> Um plano de estudos **didático do iniciante ao avançado** para entender e evoluir
> o PostUp. Cada nível termina com um critério de "você sabe disso quando".
>
> A wiki completa está em [`docs/`](docs/00-index.md). Este roadmap organiza o
> mesmo conteúdo em trilhas.

---

## Nível 1 — Iniciante: fundamentos

**Objetivo**: entender o produto, rodar o projeto e conhecer as peças.

### Trilha 1.1 — O produto e o domínio
- O que o PostUp resolve (gestão de conteúdo de Instagram para agências)
- Conceitos: Post, Cliente, Feedback, Versão, Status
- Vocabulário: `rascunho`, `aguardando`, `alteracao`, `aprovado`, `publicado`
- **Docs**: [`01-fundamentos.md`](docs/01-fundamentos.md)

### Trilha 1.2 — Rodar o projeto
- `npm install`, `npm run dev`, `.env.example` → `.env.local`
- Estrutura de pastas (`src/lib`, `src/hooks`, `src/types`, `src/pages`...)
- Alias `@/` → `src/`
- **Docs**: [`00-index.md`](docs/00-index.md), [`03-arquitetura.md`](docs/03-arquitetura.md)

### Trilha 1.3 — A stack em pílulas
- O que é React, TypeScript, Vite, Tailwind v4, shadcn/ui
- O que é Supabase (e o que ele substitui: backend próprio)
- **Docs**: [`02-stack.md`](docs/02-stack.md)

### Trilha 1.4 — Os tipos do domínio
- `PostStatus`, `PostType` (tipos união) e `Record<PostStatus, string>`
- `Post`, `PostFile`, `Client`, `PostFeedback`, `FeedbackCard`
- **Docs**: [`04-dominio-tipos.md`](docs/04-dominio-tipos.md)

### ✅ Você sabe isso quando...
- Consegue abrir o app localmente e criar um post de rascunho.
- Consegue explicar o fluxo `rascunho → aguardando → aprovado → publicado`.
- Sabe onde ficam os tipos de `Post` e `Client` e consegue listar 3 campos de cada.

---

## Nível 2 — Intermediário: como as peças funcionam

**Objetivo**: entender a camada de dados, os fluxos e a segurança.

### Trilha 2.1 — Supabase e o banco
- Migrations: como o schema evolui (`supabase/migrations/`)
- RLS: por que o app confia no banco, não no frontend
- Storage (`posts-media`), Realtime (publication), Edge Functions (Deno)
- **Docs**: [`05-dados-supabase.md`](docs/05-dados-supabase.md)

### Trilha 2.2 — Os fluxos da interface
- Login com Turnstile (e erros diferenciados)
- Reset de senha com sessão de recuperação
- Review do cliente via link (`/review/:token`) sem login
- Criar post, kanban de feedbacks, chat realtime
- **Docs**: [`06-fluxos-frontend.md`](docs/06-fluxos-frontend.md)

### Trilha 2.3 — Segurança
- Modelo de ameaça: login e review são as portas públicas
- Camadas: sanitização → Turnstile → edge function → RLS → SECURITY DEFINER → CSP
- Validação de `SECURITY DEFINER` e `search_path`
- **Docs**: [`07-seguranca.md`](docs/07-seguranca.md)

### Trilha 2.4 — Estado e hooks
- Context API (AuthProvider) e por que Zustand está instalado mas não usado
- Padrão "hook por feature": `use-feedbacks`, `use-auth`
- `useCallback`/`useEffect` com cleanup e o lint `exhaustive-deps`
- **Docs**: [`08-estado-hooks.md`](docs/08-estado-hooks.md)

### Trilha 2.5 — Design system
- `components/ui` (shadcn) vs componentes de domínio
- cva: variantes (`default`, `approve`, `feedback`, `destructive`...)
- `StatusBadge`/`TypeBadge` e tema Tailwind v4 (`@theme`)
- **Docs**: [`09-ui-componentes.md`](docs/09-ui-componentes.md)

### ✅ Você sabe isso quando...
- Consegue explicar, em 1 minuto, por que RLS é a defesa principal do app.
- Consegue criar uma nova migration e aplicar com `supabase db push`.
- Consegue adicionar um hook novo que busca uma tabela e escuta realtime.
- Consegue rastrear no código por que um status "aprovado" é verde em todo o app.

---

## Nível 3 — Avançado: qualidade, deploy e decisões

**Objetivo**: entender testes, CI/CD, deploy e a capacidade de tomar decisões de arquitetura.

### Trilha 3.1 — Testes e qualidade
- Vitest + Testing Library + jsdom: `utils.test`, `Login.test`
- Mocks (`vi.mock`): testar UI sem Supabase
- Lint: as ~165 correções do audit e as regras configuradas
- `tsc -b` vs `tsc --noEmit` (o build pega o que o typecheck simples não pega)
- **Docs**: [`10-testes-qualidade.md`](docs/10-testes-qualidade.md)

### Trilha 3.2 — Deploy e operação
- `vercel.json`: framework, output, rewrites de SPA
- Variáveis de ambiente: `VITE_` (front) vs `TURNSTILE_SECRET_KEY` (edge)
- CI: GitHub Actions (npm ci, lint, tsc, build, vitest)
- Branches `main` e `production`
- **Docs**: [`11-deploy-vercel.md`](docs/11-deploy-vercel.md)

### Trilha 3.3 — Decisões de arquitetura
- As 14 decisões documentadas (D1–D14) e as alternativas rejeitadas
- Critérios de "reavaliar quando" — quando evoluir a stack
- **Docs**: [`12-decisoes-alternativas.md`](docs/12-decisoes-alternativas.md)

### Trilha 3.4 — Glossário
- Termos técnicos e de domínio para falar a mesma língua
- **Docs**: [`13-glossario.md`](docs/13-glossario.md)

### ✅ Você sabe disso quando...
- Consegue corrigir um erro de lint e um erro de tipo, e explicar por que aconteceram.
- Consegue escrever um teste para um utilitário novo seguindo o padrão existente.
- Consegue dar `npm run build` e entender cada erro que aparecer.
- Consegue defender uma decisão de arquitetura citando trade-offs e alternativas.

---

## Trilhas de evolução do produto (próximos passos no código)

Depois de dominar a wiki, estes são os próximos trabalhos naturais no PostUp:

| Prioridade | Feature | Contexto |
|------------|---------|----------|
| **1** | Confirmar env vars na Vercel (`vercel login`) | Sem isso o deploy de produção pode quebrar captcha/Supabase |
| **2** | Error tracking (Highlight.io/PostHog) | Decisão D11: reavaliar antes do lançamento real |
| **3** | Fase 1 — Cadastro/Onboarding | Fluxo completo: conta → perfil → primeiro cliente |
| **4** | Fase 2 — Gestor + Review | Revisar UX do review link, notificações ao gestor |
| **5** | Fase 3 — Equipes (`profiles_and_teams`) | Migrar RLS de `user_id` para `team_id` (decisão D4) |
| **6** | Fase 4 — Publicação automática | Integrar API do Instagram (permissão do cliente) |
| **7** | Fase 5 — Analytics | Métricas reais de posts (alcance, engajamento) |
| **8** | Fase 6 — TikTok | Segunda plataforma (`platform` já existe no tipo) |

Para cada feature: leia a decisão relacionada na wiki, escreva um plano, e siga o
**Checklist de prontidão**: `npm run lint` → `npm run build` → `npx vitest run` → `npx tsc --noEmit`.
