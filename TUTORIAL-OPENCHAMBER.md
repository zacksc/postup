# Tutorial OpenChamber — Agentes, MCP e Skills

> **Objetivo**: tirar o máximo do OpenChamber: orquestrar agentes de IA, criar os
> seus próprios agentes, entender e construir servidores MCP, e criar/usar skills.
> Guia prático, em pt-BR, com exemplos copiáveis.

---

## Sumário

1. [Fundação: OpenChamber e OpenCode](#1-fundação-openchamber-e-opencode)
2. [Extrair o máximo do OpenChamber](#2-extrair-o-máximo-do-openchamber)
3. [Agentes: o que são e como criar](#3-agentes-o-que-são-e-como-criar)
4. [MCP: o que é e como criar](#4-mcp-o-que-é-e-como-criar)
5. [Skills: o que são, como e quando usar](#5-skills-o-que-são-como-e-quando-usar)
6. [Matriz de decisão: agente vs skill vs MCP](#6-matriz-de-decisão-agente-vs-skill-vs-mcp)

---

## 1. Fundação: OpenChamber e OpenCode

### O que é cada um

- **OpenCode** é o **motor**: um agente de programação de IA open source (CLI/SDK).
  É quem conversa com o modelo, lê/edita arquivos, roda comandos e usa ferramentas.
- **OpenChamber** é o **orquestrador e a interface**: um workspace open source que
  roda sobre o OpenCode para você **dirigir, supervisionar e revisar** o trabalho
  dos agentes. Funciona no Desktop, navegador/PWA, VS Code, celular e CLI.

Em uma frase:

> OpenChamber decide **o quê e quando**; o OpenCode executa **como**.

O OpenChamber não é uma alternativa ao OpenCode — ele **usa o OpenCode por baixo**.
O Desktop do OpenChamber já embute o OpenCode. No CLI/Web e VS Code, ele usa o
OpenCode que você instalou.

### Instalação rápida

```bash
# OpenCode (se for usar CLI/Web/VS Code)
curl -fsSL https://opencode.ai/install | bash

# OpenChamber CLI (requer Node.js 22+)
curl -fsSL https://raw.githubusercontent.com/openchamber/openchamber/main/scripts/install.sh | bash

# Subir o workspace e abrir no navegador
openchamber --ui-password be-creative-here
# → abre em http://localhost:3000
```

Para o Desktop, baixe o release no GitHub Releases
(`github.com/openchamber/openchamber/releases`). O Desktop traz o OpenCode embutido,
então não precisa instalar o OpenCode separadamente.

> **Segurança**: o OpenChamber escuta em `localhost` por padrão. Só use `--lan`
> em rede confiável e proteja o acesso web com `--ui-password`.

### Modelo mental

```
Projetos  (raízes de pastas que o OpenChamber conhece)
└── Sessões  (uma conversa/tarefa com um agente; podem ter um GOAL)
    └── Agentes  (personas: modelo + instruções + permissões)
        └── Ferramentas (MCP, skills, built-ins)
```

Camadas de organização que você precisa dominar, em ordem de "tamanho":

| Camada | Pergunta que responde | Onde se configura |
|---|---|---|
| **Projeto** | Em que código? | OpenChamber → Projects |
| **Sessão** | Que tarefa agora? | Sidebar de sessões |
| **Goal** | Quando está pronto? | Botão alvo no composer |
| **Agente** | Quem executa (persona)? | Settings → Agents |
| **Skill** | Como fazer de forma consistente? | Settings → Skills |
| **MCP** | Que ferramenta externa existe? | Settings → MCP |

---

## 2. Extrair o máximo do OpenChamber

### 2.1 Session Goals — deixe o agente ir até o fim

Em vez de ficar mandando "continue", você define **uma linha de chegada**. O
OpenChamber audita cada resposta com um modelo barato e, se não concluiu, dispara
uma continuação sozinho — **mesmo com o app fechado**.

Como usar:
1. Pressione o **botão de alvo** no composer (acende = goal armado).
2. Escreva o prompt e envie. Aquela mensagem vira o objetivo.
3. O loop roda até: **complete** (verde), **blocked** (vermelho) ou **budget
   atingido**. O botão mostra o status na cor.

Escreva o objetivo **auto-contido** — o auditor só vê o objetivo e a última
resposta, não o histórico:

- ✅ "Adicione testes para o módulo de exportação e faça a suíte inteira passar."
- ❌ "Ajeita isso" / "Continua aquela ideia".

Detalhes úteis:
- **Pause/Resume**: o botão de parar aborta e pausa; seu "stop" sempre vence.
- **Token budget**: em Settings → Chat → Goal. Ao estourar, para como "budget
  reached"; você pode subir e retomar.
- O loop roda **no servidor** (Desktop ou processo `openchamber`), não no seu tab.
- Um goal por sessão.

### 2.2 Worktrees — isolamento total por branch

Sessão em **worktree** = cópia própria do repo em branch própria (git worktree).
Dois agentes podem trabalhar em paralelo sem pisar um no outro.

1. Botão de nova worktree no topo da sidebar de sessões.
2. Escolha: **new branch** (nome + branch de origem) ou **existing branch**.
3. Confirme a pasta (o OpenChamber sugere pelo nome da branch).

Depois: **Integrate** (na visão Git) traz os commits do worktree para outra branch
(ex.: `main`). Conflitos podem ser entregues ao agente para resolver.

> Worktrees só funcionam em repositórios git. Em pastas sem git, o recurso é
> desligado automaticamente.

### 2.3 Multi-run — mesmo prompt, até 5 modelos

Compare abordagens sem digitar de novo:
1. Abra o lançador de multi-run (topo da sidebar).
2. Escolha projeto, nomeie o grupo, escreva o prompt e marque os modelos (até 5).
3. Ative **isolate runs** para cada run ganhar sua própria worktree/branch.
4. Cada modelo roda em uma sessão própria. Revise lado a lado e fique com a melhor.

Dá para combinar: Multi-run + Goal para cada run ir até a linha de chegada.

### 2.4 Scheduled Tasks e Loops — automação recorrente

Agende um prompt para rodar **daily, weekly, once ou cron**. Ao rodar, o OpenChamber
cria uma nova sessão e envia o prompt. Marque **Run as goal** para a execução
perseguir a conclusão.

**Loops** são tarefas agendadas em arquivos markdown commitáveis na pasta
`.agents/loops/` — aparecem sozinhas no scheduler, sem dialogar:

```markdown
---
name: daily-digest
schedule: "0 9 * * *"
enabled: true
model: anthropic/claude-sonnet-4-5
agent: plan
timezone: America/Sao_Paulo
---
Resuma as mudanças do repositório desde ontem e publique o resumo.
```

Regras dos loops:
- **Project scope**: `.agents/loops/*.md` na raiz do projeto (ou qualquer pasta
  acima até a raiz do git). **User scope**: `~/.agents/loops/*.md` (todo projeto).
- O arquivo é **a fonte da verdade** enquanto existir; mudanças na UI são revertidas
  no próximo sync. Para parar: delete o arquivo ou `enabled: false`.
- Loops são **cron-only** e ficam **desligados por padrão** (`enabled: false`).

> Tarefas só disparam enquanto o servidor do OpenChamber estiver rodando.

### 2.5 Preview & Changes Walkthrough

- **Preview**: abra o app rodando ao lado da conversa. Aponte para um elemento e
  envie ao agente screenshot, estilos, posição e erros do browser — o contexto de
  "essa coisa aqui".
- **Changes Walkthrough**: pega um diff grande e o transforma em um tour guiado,
  agrupando as edições em passos ordenados e explicados.

### 2.6 GitHub — da issue ao PR

- Inicie uma sessão a partir de uma **issue** ou **PR** com o contexto anexado.
- Envie checks falhos ou comentários de review de volta ao agente.
- Atualize ou faça merge do PR sem sair do OpenChamber.

### 2.7 Notes, Todos & Plans

Aproveite as abas de notas, todos e planos por projeto para:
- Manter contexto entre sessões (o plano vira o objetivo de uma goal).
- Criar uma worktree direto de um todo.
- Rodar "implementar plano" em sessão nova, marcando **Run as goal** — o goal
  carrega o conteúdo do plano como objetivo.

### 2.8 Magic Prompts e comandos

- **Magic Prompts**: atalhos prontos que geram prompts bem-formados para padrões
  comuns (ex.: revisar, documentar, explicar). Veja a doc de Magic Prompts.
- **Slash commands**: digite `/` no começo da mensagem para comandos reutilizáveis.
  Um `/` no **meio** da mensagem abre o seletor de **skills** (ver seção 5).

### 2.9 Acesso remoto e continuidade

- **Private Relay**: pareie um dispositivo com QR code de uso único; conexão
  criptografada ponta a ponta, sem abrir portas. Pode ser revogada.
- **Tunnels**: Cloudflare/Ngrok etc. para acesso por URL.
- **UI password**: gate de senha para deixar o acesso web pronto para uso público.

Comandos CLI úteis:

```bash
openchamber status                       # estado do servidor
openchamber connect-url --qr             # link de pareamento via QR
openchamber tunnel start --provider cloudflare --mode quick --qr
openchamber startup enable               # subir ao fazer login
openchamber logs
openchamber stop
openchamber update
```

### 2.10 Resumo de fluxo recomendado

```
1. PLANTE   → sessão com agente plan (sem editar) + Notes/Plans
2. EXECUTE  → implemente com build em worktree (isolado), com Goal
3. COMPARE  → Multi-run se houver dúvida de modelo/abordagem
4. REVISE   → Changes Walkthrough + agente revisor (read-only)
5. ENTREGUE → Integrate do worktree + PR pelo GitHub
```

---

## 3. Agentes: o que são e como criar

### 3.1 Conceito

Um **agente** é uma persona configurada que define:

- **model** — qual modelo de IA ele usa (por padrão, herda o modelo do agente pai);
- **prompt** — instruções permanentes (o system prompt) que ele sempre segue;
- **permission / tools** — o que ele pode fazer (editar, rodar bash, navegar, etc.);
- **temperature / top_p / steps** — como ele pensa e até onde vai sozinho;
- **description** — quando usar este agente (usada pelo próprio modelo para decidir).

Há **dois tipos**:

| Tipo | Papel | Exemplos |
|---|---|---|
| **Primary** | Assistente principal com quem você conversa. Troque com **Tab**. | `build`, `plan` |
| **Subagent** | Especialista que agentes primários invocam (via ferramenta `task`) ou você invoca com `@nome`. | `general`, `explore`, `scout` |

### 3.2 Built-ins do OpenCode

| Agente | Modo | Permissões | Uso típico |
|---|---|---|---|
| `build` | primary | Tudo liberado | Desenvolvimento completo (padrão) |
| `plan` | primary | Edições/bash = `ask` | Analisar e planejar sem modificar |
| `general` | subagent | Tudo (menos todo) | Pesquisa e tarefas multi-passo em paralelo |
| `explore` | subagent | Somente leitura | Explorar o codebase rápido (grep/glob/read) |
| `scout` | subagent | Somente leitura | Pesquisar docs externas / dependências |

Para invocar um subagente manualmente:

```
@general procure onde `connectToServer` é chamado
@explore liste os arquivos que usam Supabase
```

### 3.3 Como criar — três caminhos

#### A) Comando interativo (recomendado para começar)

```bash
opencode agent create
```

O assistente pergunta: global ou do projeto → descrição → gera prompt e
identificador → seleciona permissões (o que você não marcar fica **negado**) →
cria um arquivo markdown.

#### B) Markdown com frontmatter (mais legível, versionável)

Os arquivos ficam em:
- **Global**: `~/.config/opencode/agents/`
- **Projeto**: `.opencode/agents/`

O **nome do arquivo vira o nome do agente** (`review.md` → agente `review`).

```markdown
---
description: Revisa código buscando bugs, segurança e manutenibilidade
mode: subagent
model: anthropic/claude-sonnet-4-20250514
temperature: 0.1
permission:
  edit: deny
  bash: deny
---
Você é um revisor de código sênior. Foque em:
- Qualidade e boas práticas
- Bugs potenciais e casos de borda
- Implicações de performance
- Questões de segurança

Dê feedback construtivo SEM modificar arquivos.
```

#### C) JSON no `opencode.json`

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "code-reviewer": {
      "description": "Revisa código buscando boas práticas e problemas",
      "mode": "subagent",
      "model": "anthropic/claude-sonnet-4-20250514",
      "prompt": "Você é um revisor de código. Foque em segurança, performance e manutenibilidade.",
      "permission": { "edit": "deny" }
    }
  }
}
```

> O `prompt` também aceita arquivo externo: `"prompt": "{file:./prompts/review.txt}"`
> (caminho relativo ao config).

### 3.4 Opções essenciais

| Opção | O que faz | Exemplo |
|---|---|---|
| `description` | **Obrigatória**. Define quando usar o agente. | `"Revisa PRs antes do merge"` |
| `mode` | `primary` \| `subagent` \| `all` (padrão). | `mode: subagent` |
| `model` | Modelo do agente. Formato `provider/model-id`. | `model: anthropic/claude-haiku-4-20250514` |
| `temperature` | Criatividade/determinismo (0.0–1.0). | `0.1` para análise, `0.7` para brainstorm |
| `top_p` | Alternativa à temperature (0.0–1.0). | `0.9` |
| `prompt` | System prompt do agente. | texto ou `{file:...}` |
| `steps` | Máx. de iterações antes de responder texto. | `steps: 5` (controla custo) |
| `permission` | `allow` / `ask` / `deny`, com wildcards e por comando. | ver abaixo |
| `tools` | (legado) liga/desliga ferramentas por nome. | `tools: { "bash": false }` |
| `hidden` | Esconde do menu `@` (só subagents). | `hidden: true` |
| `color` | Cor na UI (hex ou tema). | `color: accent` |

**Permission keys** (tudo que um agente pode fazer, em forma de chave):

`read`, `edit`, `glob`, `grep`, `list`, `bash`, `task`, `external_directory`,
`todowrite`, `webfetch`, `websearch`, `lsp`, `skill`, `question`.

Exemplo com controle fino de bash:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "build": {
      "permission": {
        "bash": {
          "*": "ask",
          "git status *": "allow",
          "git diff*": "allow",
          "grep *": "allow"
        }
      }
    }
  }
}
```

Regras: **a última regra que casa vence** — coloque o `"*"` primeiro e as regras
específicas depois. O mesmo vale para `permission.task`, que controla quais
subagentes um agente pode invocar:

```jsonc
"permission": {
  "task": {
    "*": "deny",
    "orchestrator-*": "allow",
    "code-reviewer": "ask"
  }
}
```

### 3.5 Exemplos prontos para colar

**Escritor de documentação** (`~/.config/opencode/agents/docs-writer.md`):

```markdown
---
description: Escreve e mantém documentação do projeto
mode: subagent
permission:
  bash: deny
---
Você é um redator técnico. Crie documentação clara e completa.
Foque em: explicações claras, estrutura boa, exemplos de código, linguagem amigável.
```

**Auditor de segurança** (`~/.config/opencode/agents/security-auditor.md`):

```markdown
---
description: Faz auditoria de segurança e identifica vulnerabilidades
mode: subagent
permission:
  edit: deny
---
Você é um especialista em segurança. Identifique problemas como:
- Validação de entrada
- Falhas de autenticação/autorização
- Exposição de dados
- Vulnerabilidades de dependências
- Problemas de configuração
```

**Planejador estrito** (primary, sem editar nada):

```jsonc
{
  "agent": {
    "architect": {
      "description": "Planeja mudanças grandes sem tocar no código",
      "mode": "primary",
      "model": "anthropic/claude-sonnet-4-20250514",
      "temperature": 0.2,
      "permission": { "edit": "deny", "bash": "ask" },
      "prompt": "Você é um arquiteto. Produza planos passo a passo, com riscos e trade-offs. Não edite arquivos."
    }
  }
}
```

> **Opções extras (pass-through)**: qualquer outra chave que você puser no agente é
> enviada ao provedor — ex.: `"reasoningEffort": "high"` em modelos OpenAI.

### 3.6 Boas práticas

- **Uma responsabilidade por agente.** Revisor não edita; explorador não escreve.
- **Aproveite os subagentes** para proteger seu contexto: `explore` e `scout` são
  leitura pura e não poluem a conversa principal.
- **Controle custo com `steps`** e modelos baratos para tarefas mecânicas.
- Permissão mínima: comece negando e libere o necessário.

---

## 4. MCP: o que é e como criar

### 4.1 Conceito

**MCP (Model Context Protocol)** é um padrão aberto que padroniza **como agentes de
IA se conectam a ferramentas e dados externos**. Em vez de cada ferramenta inventar
uma API diferente, tudo fala MCP.

Arquitetura:

```
┌──────────────┐   MCP (stdio ou HTTP/SSE)   ┌──────────────┐
│  Cliente      │ ──────────────────────────▶ │  Servidor MCP │
│ (OpenCode/    │ ◀────────────────────────── │  (expõe       │
│  OpenChamber) │    tools / resources /      │   ferramentas)│
│              │    prompts                    │              │
└──────────────┘                              └──────┬───────┘
                                                      │ API / DB / serviço
                                                      ▼
                                           (Supabase, GitHub, Sentry, browser…)
```

- O **cliente** (OpenCode/OpenChamber) lista as ferramentas do servidor e as entrega
  ao LLM, que decide quando chamar.
- Um **servidor MCP** expõe **tools** (funções executáveis), **resources** (dados) e
  **prompts** (templates). Na prática, você vai usar principalmente **tools**.
- Pode rodar **local** (um processo na sua máquina, via `stdio`) ou **remoto**
  (uma URL HTTP, às vezes com OAuth).

### 4.2 Regra mental MCP vs Skill

> **MCP** = capacidade de **FAZER algo fora do OpenCode** (buscar em API, ler banco,
> controlar browser).
> **Skill** = conhecimento de **COMO fazer algo de forma consistente** (instruções).
> MCP dá "mãos"; Skill dá "manual".

### 4.3 Adicionar um servidor MCP no OpenChamber

**Settings → MCP → Add a server**, escolha o tipo:

- **local** — você informa o comando que roda na sua máquina e, se preciso, variáveis
  de ambiente.
- **remote** — você informa a URL e headers (ex.: token de auth).

Depois escolha o escopo:
- **personal** — disponível em todos os projetos;
- **project** — disponível só no projeto atual (salvo junto com as settings dele).

O servidor vem **ligado por padrão**; dá para desligar sem apagar. Nomes usam
minúsculas, números, hífen e underscore.

### 4.4 Adicionar no OpenCode (`opencode.jsonc`)

Seu config atual (`~/.config/opencode/opencode.jsonc`) é um ótimo exemplo — já tem 5
servidores remotos da Cloudflare:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "cloudflare": {
      "type": "remote",
      "url": "https://mcp.cloudflare.com/mcp",
      "enabled": true,
      "oauth": {}
    },
    "cloudflare-docs": {
      "type": "remote",
      "url": "https://docs.mcp.cloudflare.com/mcp",
      "enabled": true
    }
  }
}
```

**Servidor local** (ex.: servidor de teste oficial):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "mcp_everything": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-everything"]
    }
  }
}
```

Opções de um servidor **local**: `type`, `command` (array), `cwd`, `environment`
(objeto de variáveis), `enabled`, `timeout` (ms para listar tools, padrão 5000).

Opções de um servidor **remote**: `type`, `url`, `enabled`, `headers`, `oauth`,
`timeout`.

**OAuth**: para servidores remotos que exigem login, o OpenCode detecta o 401 e
dispara o fluxo OAuth sozinho (com Dynamic Client Registration, RFC 7591). Se você
tiver client credentials:

```jsonc
{
  "mcp": {
    "my-oauth-server": {
      "type": "remote",
      "url": "https://mcp.example.com/mcp",
      "oauth": {
        "clientId": "{env:MY_MCP_CLIENT_ID}",
        "clientSecret": "{env:MY_MCP_CLIENT_SECRET}",
        "scope": "tools:read tools:execute"
      }
    }
  }
}
```

Comandos de autenticação/gestão:

```bash
opencode mcp auth my-oauth-server   # dispara o login no navegador
opencode mcp list                    # lista servidores e status de auth
opencode mcp logout my-oauth-server  # remove credenciais guardadas
opencode mcp debug my-oauth-server   # diagnostica conexão/fluxo OAuth
```

> Os tokens ficam em `~/.local/share/opencode/mcp-auth.json`.

### 4.5 Ligar/desligar e restringir por agente

As tools do MCP entram com o nome do servidor como prefixo
(`meu_servidor_minha_tool`). Dá para usar globs:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "my-mcp": { "type": "local", "command": ["bun", "x", "my-mcp-command"] }
  },
  "tools": {
    "my-mcp*": false          // desliga todas as tools desse servidor, globalmente
  },
  "agent": {
    "my-agent": {
      "tools": { "my-mcp*": true }   // ...mas libera para um agente específico
    }
  }
}
```

### 4.6 Criar o seu próprio servidor MCP

Vamos criar um servidor TypeScript com o **SDK oficial**. Exemplo realista: um
servidor que expõe duas ferramentas para consultar dados do Supabase.

```bash
mkdir meu-mcp && cd meu-mcp
npm init -y
npm install @modelcontextprotocol/sdk zod
npx tsc --init --target ES2022 --module NodeNext --moduleResolution NodeNext --outDir dist
```

`server.ts`:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "postup-helper",
  version: "1.0.0",
});

server.tool(
  "get-post-status",
  "Retorna o status de um post pelo id",
  { postId: z.number().describe("Id do post no Supabase") },
  async ({ postId }) => {
    // Aqui você chama sua API/Supabase de verdade
    const status = postId > 0 ? "aprovado" : "não encontrado";
    return { content: [{ type: "text", text: JSON.stringify({ postId, status }) }] };
  }
);

server.tool(
  "list-recent-posts",
  "Lista os posts mais recentes",
  { limit: z.number().default(5) },
  async ({ limit }) => {
    const posts = [{ id: 1, title: "Exemplo" }]; // troque pela sua query
    return { content: [{ type: "text", text: JSON.stringify(posts.slice(0, limit)) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

`package.json`:

```json
{
  "name": "postup-helper",
  "type": "module",
  "main": "dist/server.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

Registrar no seu config (o agente passa a ter `postup-helper_get-post-status` e
`postup-helper_list-recent-posts`):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "postup-helper": {
      "type": "local",
      "command": ["node", "/caminho/para/meu-mcp/dist/server.js"],
      "enabled": true
    }
  }
}
```

Para servir **remotamente**, use `streamable-http` (SDK `@modelcontextprotocol/sdk`):
hospede o servidor (ex.: Worker/container), exponha uma URL e registre com
`"type": "remote", "url": "https://seu-host/mcp"`.

### 4.7 Cuidados

- **Contexto custa tokens**: cada servidor MCP adiciona as descrições das tools ao
  contexto. Servidor com muitas tools (ex.: GitHub) pode estourar o limite.
  Deixe desligado o que você não usa (ex.: `"enabled": false` ou `tools` glob).
- **Nunca coloque secrets no config** — use `{env:VAR}` e variáveis de ambiente.
- Permita MCP **por agente** quando vários servidores só fizerem sentido em certos
  fluxos.

---

## 5. Skills: o que são, como e quando usar

### 5.1 Conceito

Uma **skill** é um pacote reutilizável de **instruções** que o agente carrega
**sob demanda** quando o assunto é relevante. Na prática, é uma pasta com um
`SKILL.md` (e arquivos de apoio). O agente vê a lista de skills disponíveis (nome +
descrição) e chama a ferramenta `skill` para carregar o conteúdo completo.

> Exemplo real da sua máquina: você já tem skills globais em
> `~/.config/opencode/skills/` (cloudflare, wrangler, durable-objects, etc.).

Se o MCP dá **mãos** (fazer), a skill dá o **manual** (saber como fazer com
consistência): "como escrevemos commit", "nossas convenções de API", "como rodar um
deploy".

### 5.2 Onde as skills vivem

| Local | Escopo |
|---|---|
| `.opencode/skills/<nome>/SKILL.md` | Projeto |
| `.claude/skills/<nome>/SKILL.md` | Projeto (compatível Claude) |
| `.agents/skills/<nome>/SKILL.md` | Projeto (compatível Agents) |
| `~/.config/opencode/skills/<nome>/SKILL.md` | Global |
| `~/.claude/skills/<nome>/SKILL.md` | Global |
| `~/.agents/skills/<nome>/SKILL.md` | Global |

**Discovery**: para caminhos de projeto, o OpenCode sobe do diretório atual até a
raiz do git e carrega todo `skills/*/SKILL.md` que achar no caminho. Globais são
sempre carregados. Ou seja: **não precisa registrar nada** — basta criar a pasta.

### 5.3 Estrutura do `SKILL.md`

Começa com **frontmatter YAML**. Só estes campos são reconhecidos:

- `name` (**obrigatório**): 1–64 chars, minúsculas + hífen único, igual ao nome da
  pasta. Regex: `^[a-z0-9]+(-[a-z0-9]+)*$`
- `description` (**obrigatório**): 1–1024 chars. Seja específico — é assim que o
  agente decide quando carregar a skill.
- `license`, `compatibility`, `metadata` — opcionais.

Exemplo (`~/.config/opencode/skills/git-release/SKILL.md`):

```markdown
---
name: git-release
description: Create consistent releases and changelogs
license: MIT
compatibility: opencode
metadata:
  audience: maintainers
  workflow: github
---
## What I do
- Draft release notes from merged PRs
- Propose a version bump
- Provide a copy-pasteable `gh release create` command

## When to use me
Use this when you are preparing a tagged release.
Ask clarifying questions if the target versioning scheme is unclear.
```

> `SKILL.md` é sempre **em MAIÚSCULAS** e a pasta usa o mesmo nome do campo `name`.

### 5.4 Como o agente enxerga

A descrição da ferramenta `skill` lista as skills com nome e descrição:

```
<available_skills>
  <skill>
    <name>git-release</name>
    <description>Create consistent releases and changelogs</description>
  </skill>
</available_skills>
```

O agente carrega com `skill({ name: "git-release" })`. Tudo que estiver na pasta
(referências, scripts, templates) vira contexto da skill.

### 5.5 Como criar

**No OpenChamber** — Settings → Skills:
1. Crie a skill, dê nome e descrição curta (a descrição decide quando ela se aplica).
2. Escreva as instruções; anexe arquivos de apoio se precisar.
3. Escolha **personal** (todo projeto) ou **project** (só o atual).

**Manual** — só criar a pasta + `SKILL.md`. Depois, use na conversa com `/` no meio
da mensagem para abrir o seletor de skills (o `/` no começo abre **commands**).

**Catálogo pronto** — veja o **Skills Catalog** do OpenChamber e marketplaces como o
LobeHub Skills para instalar skills prontas em vez de escrever do zero.

### 5.6 Permissões por skill

Controle quais skills um agente pode carregar (`allow`/`ask`/`deny`), com wildcards:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "skill": {
      "*": "allow",
      "internal-*": "deny",
      "experimental-*": "ask"
    }
  }
}
```

- `allow` → carrega na hora; `deny` → some do agente; `ask` → pergunta ao usuário.

Override por agente (em frontmatter de agentes custom):

```markdown
---
permission:
  skill:
    "documents-*": "allow"
---
```

Desligar skills por completo:

```markdown
---
tools:
  skill: false
---
```

> Se uma skill não aparece: 1) `SKILL.md` está em MAIÚSCULAS? 2) tem `name` e
> `description`? 3) nome único entre todas as localizações? 4) não está `deny`?

### 5.7 Quando usar skill (e quando não)

| Situação | Use skill? |
|---|---|
| Workflow recorrente do time (commit, release, deploy) | ✅ Sim |
| Convenções que devem ser iguais em todo projeto | ✅ Sim |
| Guias longos de API/ferramenta (Cloudflare, Postgres…) | ✅ Sim |
| Preciso que o agente **execute** algo externo | ❌ Não — use MCP |
| Comportamento/instrução que vale para todo o projeto | ✅ `AGENTS.md` (regras) |
| Persona com permissões e modelo próprios | ❌ Não — use agente |

---

## 6. Matriz de decisão: agente vs skill vs MCP

### 6.1 Comparação direta

| Capacidade | MCP | Skill | Agente |
|---|---|---|---|
| Ferramentas externas (API, browser, banco) | ✅ | ❌ | via ferramentas |
| Instruções reutilizáveis | ❌ | ✅ | via `prompt` |
| Persona / modelo / permissões | ❌ | ❌ | ✅ |
| Controle de permissão | ✅ | ✅ | ✅ |
| Custo de contexto ao carregar | tools sempre listadas | só quando chamado | sempre presente |

### 6.2 Como decidir

```
Quer dar ao agente acesso a um serviço externo?        → MCP
Quer ensinar um jeito consistente de fazer algo?        → Skill
Quer uma persona com modelo/regras/permissões próprias? → Agente
Quer regra permanente para todo o projeto?              → AGENTS.md
```

- Se a skill precisa **executar** algo (ex.: "rode o playwright"), ela vai precisar
  de um MCP por baixo — elas se **complementam**.
- Prefira **skill a prompt gigante**: mantém o contexto enxuto (carrega só quando
  necessário).
- Prefira **subagente a prompt no agente principal**: protege o contexto da conversa.

### 6.3 Stack recomendado (resumo de tudo)

```
OpenChamber (orquestração: goals, worktrees, multi-run, agendamento)
└── OpenCode (motor)
    ├── agentes  → personas (model + prompt + permissões)
    ├── skills   → como fazer (instruções sob demanda)
    ├── MCP      → ferramentas externas (fazer)
    └── AGENTS.md → regras do projeto
```

Fluxo de uma tarefa madura:

1. **Plan** (agente `plan`, sem editar) → plano salvo em Notes/Plans.
2. **Execute** (agente `build` em **worktree**, com **Goal**).
3. **Compare** (opcional: **Multi-run** com 2–5 modelos, isolados).
4. **Review** (agente revisor read-only + **Changes Walkthrough**).
5. **Ship** (**Integrate** do worktree → **PR** no GitHub).
6. **Automatize** (**Scheduled task**/loop para o que se repetir).

### 6.4 Recursos oficiais

- OpenChamber docs: https://docs.openchamber.dev
- OpenCode docs: https://opencode.ai/docs (Agentes, Skills, MCP servers)
- MCP (spec/SDK): https://modelcontextprotocol.io
- OpenChamber no GitHub: https://github.com/openchamber/openchamber

---

*Guia baseado nas documentações oficiais do OpenChamber e do OpenCode (ago/2026) e no
config real de `~/.config/opencode/opencode.jsonc`. Ferramentas evoluem rápido —
confira as docs para atualizações.*
