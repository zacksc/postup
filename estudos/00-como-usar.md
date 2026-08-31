# Estudos PostUp — Guia de Estudos Técnicos

> **Meta**: não é só entender o que o PostUp faz — é **dominar os conceitos** que ele
> usa, a ponto de explicar numa entrevista técnica e de mexer no código sozinho.
>
> Este guia é **ativo**: você lê, abre o código, responde perguntas e faz desafios.
> A wiki (`docs/`) continua como referência descritiva; aqui o foco é o "porquê"
> profundo e a prática.

## Como este guia funciona

Cada capítulo segue o mesmo ciclo de aprendizado:

```
1. CONCEITO   → o fundamento técnico explicado do zero
2. NO CÓDIGO  → o MESMO conceito aplicado no PostUp (com arquivo:linha)
3. PRATICAR   → exercícios para fixar (escrever, rodar, quebrar, consertar)
4. ENTREVISTA → perguntas típicas + como estruturar a resposta
```

A ordem dos capítulos é uma **trilha de dificuldade crescente**:

| # | Capítulo | Assunto | Nível |
|---|----------|---------|-------|
| 00 | `00-como-usar.md` | Metodologia e plano de estudo | — |
| 01 | `01-js-ts.md` | JavaScript e TypeScript na prática | Iniciante |
| 02 | `02-react.md` | React: componentes, render, ciclo de vida | Iniciante |
| 03 | `03-hooks.md` | Hooks em profundidade (useState→custom hooks) | Iniciante/Int. |
| 04 | `04-render-perf.md` | Renderização e performance (memo, lazy, splitting) | Intermediário |
| 05 | `05-css-tailwind.md` | CSS moderno e Tailwind v4 | Iniciante |
| 06 | `06-sql-postgres.md` | SQL e Postgres (joins, índices, JSONB, funções) | Intermediário |
| 07 | `07-auth-sessao.md` | Autenticação, sessão e tokens | Intermediário |
| 08 | `08-rls-seguranca.md` | RLS e segurança no banco | Avançado |
| 09 | `09-seguranca-web.md` | XSS, CSP, CSRF, sanitização, captcha | Intermediário |
| 10 | `10-realtime.md` | WebSockets e realtime (Supabase channels) | Avançado |
| 11 | `11-arquitetura.md` | Arquitetura frontend, camadas e padrões | Intermediário |
| 12 | `12-git-cicd.md` | Git, branches e CI/CD | Iniciante |
| 13 | `13-testes.md` | Testes: o que, por que, como (mocks) | Intermediário |
| 14 | `14-entrevista.md` | Banco de perguntas de entrevista com respostas | Todos |
| 15 | `15-flashcards.md` | Flashcards de revisão (conceito → resposta) | Todos |
| 16 | `16-desafios.md` | Desafios práticos para mexer no código sozinho | Todos |
| 17 | `17-estudo-de-caso.md` | Estudo de caso: a saga login/tela-branca/deploy (3 bugs, 1 método) | Todos |
| 18 | `18-estudo-de-caso-parte-2-landing-fantasma.md` | Estudo de caso: a landing "por trás" (redirect, paint, useEffect) | Todos |
| 19 | `19-midia-upload-lightbox.md` | Mídia a fundo: ffmpeg.wasm, capa de reels, lightbox | Avançado |
| 20 | `20-preview-perfil-mockup.md` | Mockup de perfil IG, prévia do grid, carrossel mobile | Intermediário |
| 21 | `21-estudo-de-caso-storage-byo.md` | Estudo de caso: R2, BYO storage (Drive/R2) e o dilema do usuário leigo | Avançado |
| 22 | `22-nova-identidade-visual.md` | Design tokens, theming com CSS vars, Tailwind v4 @theme, contraste | Intermediário |

## Plano de estudo sugerido

### Se você tem 1 semana (maratona)
1. Dia 1–2: `01-js-ts` + `02-react` + `03-hooks`
2. Dia 3: `06-sql-postgres` + `07-auth-sessao`
3. Dia 4: `08-rls-seguranca` + `09-seguranca-web`
4. Dia 5: `14-entrevista` (metade das perguntas) + `15-flashcards`
5. Dia 6–7: `16-desafios` (2–3 desafios) + revisão

### Se você tem 1 mês (consistente)
- Semana 1: conceitos de linguagem e React (01–05)
- Semana 2: banco, auth e segurança (06–09)
- Semana 3: realtime, arquitetura, testes, git (10–13)
- Semana 4: entrevista, flashcards e desafios (14–16)

### Regra de ouro
> Você não aprendeu até conseguir **explicar sem olhar** e **escrever sozinho**.
> Para cada capítulo: feche o arquivo e explique em voz alta (técnica Feynman).
> Se travar, releia e tente de novo. Entrevista = falar o conceito em 60s.

## O que esperar de cada seção

- **CONCEITO**: leitura obrigatória. Explica a ideia por trás (não decora).
- **NO CÓDIGO**: abra o arquivo indicado e leia junto. É o PostUp real.
- **PRATICAR**: faça. Errar aqui não custa nada — é assim que se aprende.
- **ENTREVISTA**: as perguntas que o entrevistador faria, com a estrutura de resposta
  ("o que é, para que serve, como o PostUp usa, e o que aconteceria se mudasse").

Comece pelo próximo: [`01-js-ts.md`](01-js-ts.md).
