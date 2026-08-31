# PostUp

Plataforma de gerenciamento de posts para redes sociais. Organize, agende e publique conteúdo com seus clientes.

## Funcionalidades

- **Kanban de Tarefas**: Gerencie posts com drag-and-drop
- **Cronograma Visual**: Calendário mensal/semanal com agendamento
- **Grid Instagram**: Prévia do perfil e organização visual
- **Chat**: Comunicação com clientes sobre posts
- **Aprovação de Posts**: Fluxo de revisão e aprovação
- **Upload de Mídia**: Suporte a imagens e vídeos com compressão

## Stack

- **Frontend**: React + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Deploy**: Vercel / Cloudflare

## Setup

### Pré-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com)

### Instalação

```bash
# Clonar o repositório
git clone https://github.com/zacksc/postup-open.git
cd postup-open

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais do Supabase

# Iniciar desenvolvimento
npm run dev
```

### Variáveis de Ambiente

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase | Sim |
| `VITE_SUPABASE_ANON_KEY` | Chave anônima do Supabase | Sim |
| `VITE_APP_URL` | URL da aplicação | Não |
| `VITE_STORAGE_PROVIDER` | Provedor de storage (`supabase` ou `r2`) | Não |
| `VITE_MAX_MEDIA_SIZE` | Limite de mídia em MB (padrão: 30) | Não |

### Banco de Dados

As migrações do Supabase estão em `supabase/migrations/`. Para aplicar:

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
│   ├── Home/       # Dashboard principal
│   ├── Cronograma/ # Calendário de agendamento
│   ├── Feedbacks/  # Kanban de tarefas
│   ├── GridInstagram/ # Grid visual do Instagram
│   ├── Chat/       # Chat com clientes
│   └── Landing/    # Página de vendas
├── hooks/          # Hooks customizados
├── lib/            # Utilitários e configurações
└── types/          # Definições de tipos
```

## Licença

Proprietário. Todos os direitos reservados.
