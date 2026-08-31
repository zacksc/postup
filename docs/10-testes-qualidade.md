# 10 — Testes e qualidade: o caminho até o "CI verde"

> **Objetivo**: entender a pirâmide de qualidade do projeto — testes (Vitest),
> lint (ESLint), tipos (tsc) e CI (GitHub Actions) — e como chegamos de ~165
> problemas de lint a **0 erros / 0 warnings**.

## Os 4 guardiões da qualidade

```
npm run lint        → ESLint  (erros de código/regras)
npx tsc --noEmit    → TypeScript (erros de tipo)
npm run build       → tsc -b && vite build (build real)
npx vitest run      → testes unitários/componente
```

No CI (`~/.github/workflows/ci.yml`), os 4 rodam **em todo push/PR para `main`**:

```yaml
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm run build
      - run: npx vitest run
```

> `npm ci` (não `npm install`) garante o **lockfile exato** — builds reproduzíveis.

### O caso real: CI falhou porque o runner não tem `.env.local`

`src/lib/supabase.ts` lança **no momento do import** se faltarem as variáveis `VITE_*`:

```ts
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltam as variáveis de ambiente do Supabase...')
}
```

O runner do GitHub **não tem** `.env.local` (gitignored). Qualquer teste que
importe `compress-image.ts` — que importa `supabase.ts` — morria no load, antes
de rodar:

```
src/test/compress-image.test.ts: src/lib/supabase.ts#L7
Error: Faltam as variáveis de ambiente do Supabase. Verifique o ficheiro .env.local
 ❯ src/lib/supabase.ts:7:9
 ❯ src/lib/compress-image.ts:1:1
 ❯ src/test/compress-image.test.ts:2:1
```

O "CI verde" anterior tinha vindo de uma execução **local** (com `.env.local`),
não do repositório como está — um bug latente desde que `compress-image.ts`
passou a importar o supabase. `lint`/`tsc`/`build` continuavam verdes porque
não avaliam o guard em runtime.

**Fix** (`vitest.config.ts`): placeholders seguros no ambiente de teste —

```ts
test: {
  env: {
    VITE_SUPABASE_URL: 'http://localhost:54321',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key',
  },
}
```

**Lições:** (1) efeito colateral no topo de módulo (throw no import) quebra
testabilidade — alternativas: env fake para testes (feito) ou inicialização
preguiçosa (`getSupabase()` que só valida no primeiro uso); (2) nunca confie em
"CI verde" baseado em execução local — o CI roda num ambiente limpo; (3) um
commit de docs/código que só roda localmente parece verde no seu terminal, mas
não no runner.

## Testes: o que existe (38 testes, 7 arquivos)

| Arquivo | Testa |
|---------|-------|
| `src/test/utils.test.ts` | `cn`, `formatDate`, `sanitize`, `getInitials` |
| `src/test/compress-image.test.ts` | Compressão de imagem (redimensiona, converte) |
| `src/test/setup.test.tsx` | Setup/render básico |
| `src/test/Login.test.tsx` | Página de login: render, toggle senha, erros, 3 tentativas, botão bloqueado sem token, reset do captcha, falha do captcha NÃO mascarada como senha errada |
| `src/test/realtime.test.ts` | `subscribeRealtime`: subscreve quando há WebSocket; retorna `null` sem lançar quando não há |
| `src/test/supabase.test.ts` | `createClient` NÃO lança sem WebSocket (transport de fallback) — regressão da tela branca mobile |
| `src/test/use-notifications.test.tsx` | `useNotifications` (montado no Header) NÃO lança erro quando `supabase.channel()` lança — regressão do crash mobile |

### Como o LoginPage é testado sem Supabase?

**Mock** (`vi.mock`): o teste substitui `@/hooks/use-auth` por uma versão falsa.

```ts
vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    session: null,
    loading: false,
    signIn: vi.fn(),
    ...
  })),
}))
```

Assim o teste exercita **só a UI**: renderiza, digita, clica, e verifica a mensagem
que aparece. Não toca rede/banco — rápido e determinístico. `vi.mocked(useAuth)`
permite mudar o retorno por teste (ex.: `checkEmailExists → false` para testar o
erro de e-mail não registrado).

> **Padrão didático**: teste de componente = verificar o que o usuário **vê e
> interage**. Lógica pura (utils) = teste unitário simples. Chamadas externas = mock.

## O "audit de lançamento" e os 165 problemas de lint

Antes do commit `ae1c423`, o `npm run lint` acusava ~165 problemas. O trabalho de
limpeza se dividiu em 4 categorias:

| Categoria | Contagem | O que era | Como resolvido |
|-----------|----------|-----------|----------------|
| `@typescript-eslint/no-explicit-any` | ~120 | `any` em payloads/params | Tipar com `unknown`, `Partial<T>`, união de tipos |
| `react-hooks/exhaustive-deps` | ~18 | deps de `useEffect`/`useCallback` | Reordenar/re-usar `useCallback`, extrair deps estáveis |
| `no-unused-vars` | ~6 | imports não usados | Remover |
| `react-refresh/only-export-components` | ~5 | exportar + componentes no mesmo arquivo | Extrair funções não-componente para `lib/` ou usar `allowConstantExport` |
| Outros | ~16 | `prefer-const`, `no-empty`, `no-undef` | Ajustes pontuais |

### As 2 "regras do jogo" (lint config)

`eslint.config.js` (flat config, ESLint 9):

```js
rules: {
  'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
}
```

- **`react-refresh/only-export-components`** (Vite HMR): um arquivo com componentes
  React não deve exportar coisas não-componente (o hot-reload quebra). `allowConstantExport`
  permite exportar constantes (como `STATUS_LABELS`).
- **`react-hooks/exhaustive-deps`** (recomendado): força `useEffect`/`useCallback`
  a declararem todas as dependências. Exceções **pontuais e comentadas** com
  `// eslint-disable-next-line` existem onde a dependência é intencional
  (ex.: reset de estado uma única vez ao montar).

## Erros de tipo que só o build pegou

O comando `npm run build` = `tsc -b` (project references) **antes** do vite build.
Um `tsc --noEmit` simples no modo de projeto pode não pegar tudo; o `-b` usa os
`tsconfig` de referência (`tsconfig.app.json`/`tsconfig.node.json`). Foi assim que
erros reais apareceram:

- `overId` possivelmente `null` no drag-and-drop do `PostModal` → extrair com `?? ''`.
- `useMemo` acessando variável antes da declaração (Temporal Dead Zone) no `Chat.tsx`.
- Deps de `useCallback` apontando para função não estável no `ClienteFluxo.tsx`.
- `Client` não tem `color` → `selectedClientColor = branding?.palette?.[0] || '#7c6af7'`.

**Lição**: rode `tsc -b`/`npm run build`, não só `tsc --noEmit`, antes de subir.

## Pipeline e fluxo de trabalho

1. Commit em branch → CI roda os 4 guardiões (PR para `main`).
2. Merge/push em `main` → CI roda de novo + **Vercel deploy** (produção).
3. Vercel: cada PR ganha um **preview URL** para testar antes do merge.

## Praticar

1. Rode `npm run lint` e `npx vitest run` — deve dar 0 erros e 38 testes passando.
2. Escreva um teste para `formatDateShort('2026-07-30')` seguindo o padrão de `utils.test.ts`.
3. Quebre o build de propósito (troque um tipo por `any`), rode `npm run build` e leia o erro.
4. Sem `.env.local`, rode `npx vitest run` — o `compress-image.test.ts` passa mesmo assim (o `test.env` cobre).
5. O teste "falha do captcha NÃO mascarada como senha errada" verifica o quê exatamente? (R.: `signIn` retorna `code: 'turnstile_failed'` → a UI mostra a mensagem do captcha, **não** "A senha está incorreta", e `checkEmailExists` não é chamado).

**Anterior**: [`09-ui-componentes.md`](09-ui-componentes.md) · **Próximo**: [`11-deploy-vercel.md`](11-deploy-vercel.md)
