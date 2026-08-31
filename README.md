<p align="center">
  <img src="public/logo.svg" alt="PostUp" width="120" />
</p>

<h1 align="center">PostUp</h1>

<p align="center">
  Organize seus posts. Aprovar nunca foi tao facil.
</p>

---

## O que e

PostUp e uma plataforma de gerenciamento de posts para criadores de conteudo e gestores de marketing que trabalham com clientes.

Voce cria um post, manda pro cliente aprovar, e pronto. Sem planilha, sem WhatsApp perdido, sem esquecer o que foi combinado.

## Para quem e

- **Gestores de social media** que administram contas de clientes e precisam de um fluxo claro de aprovacao.
- **Criadores de conteudo** que produzem posts e querem manter tudo organizado sem depender de ferramentas caras.
- **Freelancers de marketing** que trabalham com multiplos clientes e precisam de visibilidade sobre o que esta pendente, agendado ou publicado.

## O problema que resolve

Eu criei o PostUp porque vivi na pele a dor de gerenciar marketing de conteudo.

Na pratica, o fluxo era assim: escrevia o post no WhatsApp, mandava pro cliente, ele respondia "ta bom", eu esquecia de publicar, ele me cobrava no dia seguinte. Ou pior: eu estava com 5 clientes ao mesmo tempo e nao sabia qual post estava em qual etapa.

As ferramentas que existiam ou eram caras demais para um freelancer, ou nao tinham o fluxo simples que eu precisava: criar, enviar pra aprovacao, agendar, publicar.

Entao resolvi fazer a minha propria ferramenta. O que comecou como um projeto para resolver o meu problema virou o PostUp.

## Funcionalidades

- **Kanban de Tarefas** -- Gerencie posts com drag-and-drop entre colunas (aguardando, alteracao, aprovado, publicado)
- **Cronograma Visual** -- Calendario mensal e semanal para visualizar o que esta agendado
- **Grid Instagram** -- Previa do perfil e organizacao visual dos posts
- **Chat** -- Comunicacao direta com clientes sobre cada post
- **Aprovacao de Posts** -- Fluxo de revisao com feedback e status
- **Upload de Midia** -- Suporte a imagens e videos com compressao automatica
- **Landing Page** -- Pagina de vendas integrada para converter visitantes em clientes

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| Deploy | Vercel |
| Testes | Vitest + Testing Library |

## Setup Local

### Pre-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com)

### Instalacao

```bash
git clone https://github.com/zacksc/postup.git
cd postup
npm install
cp .env.example .env.local
# Edite .env.local com suas credenciais
npm run dev
```

### Variaveis de Ambiente

| Variavel | Descricao | Obrigatoria |
|----------|-----------|-------------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase | Sim |
| `VITE_SUPABASE_ANON_KEY` | Chave anonima do Supabase | Sim |
| `VITE_APP_URL` | URL da aplicacao | Nao |
| `VITE_STORAGE_PROVIDER` | `supabase` ou `r2` | Nao |

### Banco de Dados

As migracoes estao em `supabase/migrations/`. Para aplicar:

```bash
npx supabase db push
```

## Estrutura

```
src/
  components/     # Componentes reutilizaveis
    layout/       # Sidebar, Header, AppShell
    ui/           # Componentes base (Button, Dialog, etc)
    calendar/     # Componentes do calendario
    feedback/     # Cards de feedback
    post/         # Cards e modais de posts
  pages/          # Paginas da aplicacao
  hooks/          # Hooks customizados
  lib/            # Utilitarios e configuracoes
  types/          # Definicoes de tipos

supabase/
  functions/      # Edge functions
  migrations/     # Migrations do banco
```

## Comandos

| Comando | Descricao |
|---------|-----------|
| `npm run dev` | Iniciar servidor de desenvolvimento |
| `npm run build` | Build de producao |
| `npm run lint` | Verificar erros ESLint |
| `npm test` | Rodar testes |

## Licensa

Proprietaria. Todos os direitos reservados.
