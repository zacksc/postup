# 12 — Git, branches e CI/CD

> **Objetivo**: dominar o fluxo de trabalho com Git do PostUp — branches, merges,
> o CI (GitHub Actions) e o deploy (Vercel).

## CONCEITO — O que é Git e o que é um commit

Git é um **sistema de controle de versão distribuído**: cada mudança vira um
"snapshot" (commit) com autor, data e mensagem. O histórico é uma linha do tempo
que você pode navegar, comparar e reverter.

```
commit = estado dos arquivos + mensagem + hash único
git log  → vê a linha do tempo
git diff → vê mudanças antes de commitar
git status → o que está alterado/não rastreado
```

## CONCEITO — O fluxo de trabalho do PostUp (branches)

```
          feature/xxx
         /           \
main ───●────────────●───────────●  (branch principal de trabalho)
                      └── merge
                 
main ──► production   (promoção quando uma versão está pronta para o ar)
```

- **`main`**: desenvolvimento contínuo.
- **`production`**: o que está no ar (deploy da Vercel).
- Fluxo: trabalha em `main` (ou branch de feature), valida, e **promove
  `main → production`** quando pronto.

**Por que 2 branches?** Separa "pronto para testar" de "no ar". Se algo quebra em
produção, dá para reverter só a produção sem mexer no desenvolvimento.

## CONCEITO — merge, fast-forward e conflitos

```bash
git merge main          # traz os commits do main para a branch atual
git merge --ff-only x   # fast-forward: só avança o ponteiro (sem commit de merge)
```

- **Fast-forward**: a branch alvo é um "descendente direto" → o Git só avança.
- **Merge commit**: as branches divergiram → cria um commit de união.
- **Conflito**: os dois lados mudaram a MESMA linha → o Git pede decisão manual.

**A lição real do PostUp**: ao promover `main → production`, o merge falhou porque
a branch local estava 8 commits atrás do remoto. A correção foi `merge --ff-only
origin/production` (sincronizar) e depois `merge main`. **Sempre sincronize o remoto
antes de mergir.**

## NO CÓDIGO — Os commits do PostUp (leia o histórico)

```bash
git log --oneline
```

Repare no padrão das mensagens: `feat:` (funcionalidade), `fix:` (correção),
`docs:` (documentação), `chore:` (manutenção). Isso é **Conventional Commits** —
mensagens padronizadas que facilitam ler o histórico e gerar changelogs.

- `feat: erros diferenciados no login...`
- `fix: CSP bloqueava o Turnstile...`
- `docs: adiciona wiki didatica...`
- `chore: corrige lint, tipos e build...`

**Dica**: `git log --oneline --reverse` mostra a evolução do projeto do início —
ótimo para estudar COMO o projeto cresceu (e para contar a história em entrevista).

## CONCEITO — CI (Continuous Integration)

CI = **automatizar a verificação a cada push**: rodar lint, typecheck, build e
testes. No PostUp, o GitHub Actions faz isso:

```yaml
# .github/workflows/ci.yml
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci          # dependências exatas (lockfile)
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm run build
      - run: npx vitest run
```

Peças:
- **`on`**: gatilhos (push/PR na main).
- **`runs-on: ubuntu-latest`**: máquina virtual limpa — o CI roda num ambiente do
  zero (nada "funciona na minha máquina").
- **`npm ci`** (não `npm install`): instala EXATAMENTE o `package-lock.json` —
  builds reproduzíveis.
- **Cada `run`** falhando = vermelho no GitHub. A PR não mergea sem verde.

## CONCEITO — CD (Continuous Delivery/Deployment) com Vercel

O deploy é automático ao mergear na `production`:

- A Vercel conecta no repositório e detecta a branch.
- Roda `npm run build` (via `vercel.json`).
- Publica `dist/` em `https://postupapp.vercel.app`.

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- **`rewrites`** é essencial para SPA: sem ele, refresh em `/clientes/abc` daria 404
  (o servidor não tem essa rota; o React Router a resolve). O rewrite manda tudo
  para `index.html` e o router assume.

**Vercel preview**: cada PR ganha uma URL de preview — testar sem tocar em produção.

## CONCEITO — Por que isso tudo importa para o dia a dia

1. Você nunca quebra produção por engano (CI + branches + preview).
2. Erros aparecem cedo (lint/typecheck/testes antes do deploy).
3. O histórico conta a história do projeto (e a sua, em entrevista).

## PRATICAR

1. `git log --oneline -20` — leia as mensagens. Classifique cada uma
   (`feat`/`fix`/`docs`/`chore`).
2. `git diff ae1c423..cc76f6c --stat` — veja o que o commit da wiki mudou.
3. Simule um conflito: altere a MESMA linha em duas branches e tente o merge.
   Resolva escolhendo o que manter.
4. No GitHub, abra a aba Actions do repo e veja o último run do CI. O que cada
   passo fez?

## ENTREVISTA — perguntas típicas

**"Explique a diferença entre CI e CD."**
Estrutura: (1) CI = verificação automática a cada mudança (lint, testes, build);
(2) CD = entrega/deploy automático após a verificação; (3) no PostUp: CI no GitHub
Actions (4 passos) e deploy na Vercel ao mergear na production; (4) benefício:
problemas cedo, deploy sem erro humano, preview por PR.

**"Para que serve `npm ci` vs `npm install`?"**
Estrutura: (1) `npm ci` instala exatamente o lockfile, em CI; (2) `npm install`
atualiza dependências/pode resolver novas; (3) `ci` é determinístico e mais rápido;
(4) usado no workflow do PostUp para builds reproduzíveis.

**"Como você faria deploy de um SPA e por que precisa de rewrite?"**
Estrutura: (1) SPA = um `index.html` + JS que o router gerencia; (2) sem rewrite,
o servidor 404 em rotas internas no refresh; (3) `rewrites: source /* → /index.html`
resolve; (4) o PostUp configura isso em `vercel.json`.

**Anterior**: [`11-arquitetura.md`](11-arquitetura.md) · **Próximo**: [`13-testes.md`](13-testes.md)
