# PostUp — Wiki de Estudo e Referência

> Plataforma web para agências e gestores de marketing organizarem, aprovarem e
> publicarem conteúdo de Instagram para múltiplos clientes.

Esta wiki foi escrita para ensinar **como o PostUp foi construído**, do zero ao
estado atual: as decisões, os porquês, as alternativas consideradas e a lógica
de cada camada. Ela serve tanto para quem está começando (nunca viu React/Supabase)
quanto para quem quer manter e evoluir o projeto.

## Como usar esta wiki

A wiki é organizada em **ordem didática**: os primeiros arquivos explicam
conceitos fundamentais (o que é o produto, a stack, a arquitetura), os do meio
entram em cada camada (dados, estado, interface, segurança) e os últimos cobrem
qualidade, deploy e o registro de decisões.

| # | Arquivo | O que você vai aprender | Nível |
|---|---------|------------------------|-------|
| 00 | `00-index.md` | Visão geral e mapa da wiki | — |
| 01 | `01-fundamentos.md` | O produto, o domínio e os conceitos-base | Iniciante |
| 02 | `02-stack.md` | Cada tecnologia escolhida e por quê | Iniciante |
| 03 | `03-arquitetura.md` | Rotas, layout, lazy loading e fluxo de dados | Iniciante |
| 04 | `04-dominio-tipos.md` | Os tipos do domínio: Post, Cliente, Feedback | Iniciante |
| 05 | `05-dados-supabase.md` | Banco, auth, RLS, realtime, storage, migrations | Intermediário |
| 06 | `06-fluxos-frontend.md` | Os fluxos principais da interface | Intermediário |
| 07 | `07-seguranca.md` | Turnstile, review tokens, sanitização, CSP | Intermediário |
| 08 | `08-estado-hooks.md` | Zustand e hooks customizados | Intermediário |
| 09 | `09-ui-componentes.md` | Design system: shadcn/ui, tema e componentes | Intermediário |
| 10 | `10-testes-qualidade.md` | Vitest, ESLint, TypeScript e CI | Avançado |
| 11 | `11-deploy-vercel.md` | Deploy na Vercel e operação | Avançado |
| 12 | `12-decisoes-alternativas.md` | Registro de decisões e alternativas | Avançado |
| 13 | `13-glossario.md` | Glossário de termos | — |
| 14 | `14-checklist-bugs-polimentos.md` | Checklist vivo de bugs e polimentos (abertos e fechados) | Avançado |
| 15 | `15-backlog-unificado.md` | Lista única e priorizada do que falta (14 + plano 0107) | Avançado |
| 16 | `16-storage-midias.md` | Alternativas de storage de mídias e plano de migração | Avançado |
| 17 | `17-identidade-visual.md` | Nova identidade visual: cores, raio, fonte, decisões | Intermediário |

No final de cada arquivo há uma seção **"Praticar"** com exercícios para fixar o
conteúdo, e links para o arquivo seguinte e anterior.

## Roadmap de aprendizado

O arquivo [`ROADMAP.md`](../ROADMAP.md), na raiz do repositório, organiza os
mesmos tópicos em um plano de estudos por nível (iniciante → intermediário →
avançado) com critérios de "você sabe disso quando...".

## Como rodar o projeto

```bash
npm install       # instala as dependências
npm run dev       # servidor de desenvolvimento (Vite)
npm run build     # build de produção (tsc -b && vite build)
npm run lint      # ESLint
npm run test      # Vitest (testes unitários)
```

Os scripts estão em `package.json`. O projeto exige um `.env.local` com as
variáveis do Supabase e do Turnstile (veja `.env.example`).

## Mapa mental do repositório

```
postup/
├── .github/workflows/ci.yml   → CI que roda lint + typecheck + build + testes
├── src/
│   ├── main.tsx               → bootstrap do React
│   ├── App.tsx                → Providers (tema, toasts, rotas)
│   ├── routes/index.tsx       → Todas as rotas com lazy loading
│   ├── lib/                   → utils, supabase client, compressão de imagem
│   ├── hooks/                 → hooks de auth, feedbacks, notificações, etc.
│   ├── store/                 → Zustand (tema, auth, toasts)
│   ├── types/                 → tipos de domínio (Post, Client, Feedback...)
│   ├── components/
│   │   ├── ui/                → design system (button, badge, dialog...)
│   │   ├── layout/            → AppShell, Sidebar, Header, ProtectedRoute
│   │   ├── post/              → PostCard, IgPreview, KanbanColumn, MediaPreview, MediaLightbox
│   │   ├── instagram/         → IgProfileMockup (simulador de perfil do Instagram)
│   │   ├── feedback/          → threads, modais e cartões de feedback
│   │   ├── calendar/          → MonthView, WeekView
│   │   ├── modals/            → PostModal, ClientModal, ImageCropperModal
│   │   └── client/            → ClientCard
│   ├── pages/                 → uma pasta por página (Home, Cronograma...)
│   └── test/                  → testes (setup + arquivos de teste)
├── supabase/
│   └── migrations/            → SQL versionado (tabelas, RLS, functions)
└── docs/                      → esta wiki
```

Continue em [`01-fundamentos.md`](01-fundamentos.md).
