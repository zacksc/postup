# PostUp

Plataforma de gerenciamento de posts para redes sociais. Organize, agende e publique conteúdo com seus clientes.

![CI](https://github.com/zacksc/postup/actions/workflows/ci.yml/badge.svg)

## Funcionalidades

- **Kanban de Tarefas** — Gerencie posts com drag-and-drop
- **Cronograma Visual** — Calendário mensal/semanal com agendamento
- **Grid Instagram** — Prévia do perfil e organização visual
- **Chat** — Comunicação com clientes sobre posts
- **Aprovação de Posts** — Fluxo de revisão e aprovação
- **Upload de Mídia** — Suporte a imagens e vídeos com compressão
- **Landing Page** — Página de vendas integrada

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| Deploy | Vercel |
| Testes | Vitest + Testing Library |

## Setup Local

### Pré-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com)

### Instalação

```bash
git clone https://github.com/zacksc/postup.git
cd postup
npm install
cp .env.example .env.local
# Edite .env.local com suas credenciais
npm run dev
```

### Variáveis de Ambiente

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase | Sim |
| `VITE_SUPABASE_ANON_KEY` | Chave anônima do Supabase | Sim |
| `VITE_APP_URL` | URL da aplicação | Não |
| `VITE_STORAGE_PROVIDER` | `supabase` ou `r2` | Não |

### Banco de Dados

As migrações estão em `supabase/migrations/`. Para aplicar:

```bash
npx supabase db push
```

## Estrutura

```
src/
├── components/     # Componentes reutilizáveis
│   ├── layout/     # Sidebar, Header, AppShell
│   ├── ui/         # Componentes base (Button, Dialog, etc)
│   ├── calendar/   # Componentes do calendário
│   ├── feedback/   # Cards de feedback
│   └── post/       # Cards e modais de posts
├── pages/          # Páginas da aplicação
├── hooks/          # Hooks customizados
├── lib/            # Utilitários e configurações
└── types/          # Definições de tipos

supabase/
├── functions/      # Edge functions
└── migrations/     # Migrations do banco
```

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Iniciar servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` | Verificar erros ESLint |
| `npm test` | Rodar testes |

## Licença

Proprietário. Todos os direitos reservados.
