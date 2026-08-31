# 01 — JavaScript e TypeScript na prática

> **Objetivo**: dominar os conceitos de linguagem que o PostUp usa todos os dias —
> de tipos básicos a generics — sempre amarrados a código real do projeto.

## CONCEITO — O que o TypeScript agrega ao JavaScript

JavaScript é dinâmico: uma variável pode ser `string`, depois `number`, depois
`object` sem erro. TypeScript adiciona **tipos em tempo de compilação**: o compilador
`tsc` verifica seu código ANTES de rodar e aponta inconsistências. O TypeScript é
**um superset**: todo JS válido é TS válido. O navegador só roda JS; o TS é
"apagado" na compilação (não existe em runtime).

Por que isso muda sua vida:
- **Erros cedo**: escrever `post.status = 'qualquer'` é erro de compilação.
- **Autocomplete**: o editor sabe os campos de `Post` e sugere.
- **Refatoração segura**: renomear `caption` em todo o projeto não quebra nada escondido.
- **Documentação viva**: o tipo É a documentação do contrato de dados.

## CONCEITO — Tipos união e interseção

```ts
type PostStatus = 'rascunho' | 'aguardando' | 'alteracao' | 'aprovado' | 'publicado'
```

- **União (`|`)**: o valor pode ser UM dos tipos. Aqui: uma string, mas só entre as 5.
- Isso é diferente de `string`: `'qualquer'` não compila.
- **Interseção (`&`)**: o valor é AMBOS (ex.: `A & B` = tem campos de A e B).

O PostUp usa união para `PostStatus`, `PostType`, `'image' | 'video'`, `'gestor' | 'cliente'`,
`'message' | 'log'`. Esse padrão se chama **"make illegal states unrepresentable"**
(torne estados inválidos impossíveis de representar).

## CONCEITO — `Record<PostStatus, string>`

```ts
const STATUS_LABELS: Record<PostStatus, string> = {
  rascunho: 'Rascunho',
  aguardando: 'Aguardando',
  ...
}
```

- `Record<K, V>` é um **tipo utilitário**: um objeto cujas chaves são do tipo `K`
  e valores do tipo `V`.
- A mágica: se você adicionar um status novo na união, o TypeScript **exige** que
  o `Record` tenha a chave nova — impossível esquecer o label.

## NO CÓDIGO — `src/components/ui/status-badge.tsx`

Abra o arquivo. Repare:

1. `PostStatus` e `PostType` (tipos união) são **exportados** e usados por
   `src/types/post.ts` (o `Post` tem `status: PostStatus`).
2. `Record<PostStatus, string>` força os labels.
3. `StatusBadge` recebe `status: PostStatus` e repassa para `<Badge variant={status}>`.

**Desafio mental**: o que acontece se você adicionar `'cancelado'` na união?
→ O `Record` quebra (falta o label). O `Badge` quebra (falta a variante).
→ O TypeScript lista TODOS os pontos que precisam mudar. Isso é o valor do TS.

## NO CÓDIGO — `src/lib/utils.ts` — `sanitize`

```ts
export function sanitize(input: string, maxLength = 2000): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] }).trim().slice(0, maxLength)
}
```

- **Parâmetro com default** (`maxLength = 2000`): opcional com valor padrão.
- **`DOMPurify.sanitize(input, { ALLOWED_TAGS: [] })`**: remove todo HTML. `[]`
  = nenhuma tag permitida → só texto limpo.
- `.trim()` remove espaços das pontas; `.slice(0, maxLength)` corta o tamanho.
- **Tipo de retorno declarado**: `: string`. O TS confere que o que você retorna
  é `string`.

## CONCEITO — `Partial<T>`, `as unknown as X`, e o "escape hatch"

O PostUp faz casts em alguns pontos (ex.: `use-teams.tsx`):

```ts
const row = data as unknown as { team_members: TeamMember[] }
```

- `as T` é um **type assertion**: "confia em mim, isto é T".
- `as unknown as T` é o "duplo escape": `unknown` é o tipo "não sei o que é" —
  qualquer coisa pode ser `unknown`, e `unknown` pode virar qualquer coisa.
  É usado quando o Supabase retorna um shape que o TS não consegue inferir.
- **Regra**: casts são exceção, não rotina. Se você usa muito `as`, algo está errado.
  Prefira tipar os dados na origem (ex.: tipos dos payloads do Supabase).

## CONCEITO — Tipagem de retorno de funções assíncronas

```ts
signIn: (email, password, cfToken?) => Promise<{ error?: string; code?: string }>
```

- `Promise<T>` = a função é assíncrona e **resolve para** T.
- `{ error?: string }` = objeto com campo `error` **opcional** (pode não existir).
- O padrão do PostUp: funções de auth retornam `{ error?: string }` em vez de
  lançar exceção — o componente decide o que mostrar. Erro vira **dado**, não crash.

## CONCEITO — `import type` e tree-shaking

```ts
import type { PostStatus, PostType } from '@/components/ui/status-badge'
```

- `import type` importa SÓ para o TypeScript; é apagado no build.
- Isso ajuda o **tree-shaking** (remover código não usado) e evita import circular
  de valores em runtime.

## PRATICAR

1. Abra `src/types/post.ts` e adicione `'cancelado'` ao `PostStatus` (em `status-badge.tsx`).
   Rode `npx tsc --noEmit` e anote os erros. Depois **desfaça**.
2. Escreva um `Record<PostType, string>` você mesmo e adicione uma variante nova.
3. No `use-auth.tsx`, explique o que o tipo de retorno de `signIn` comunica ao componente `Login`.
4. Crie um utilitário `truncate(text, n)` tipado e use-o num componente qualquer.

## ENTREVISTA — perguntas típicas

**"O que é a diferença entre `interface` e `type`?"**
Estrutura: (1) ambos definem formas de dados; (2) `type` pode união/utilitários;
(3) `interface` é estendível (`extends`) e declarable-merge; (4) no PostUp usamos
`interface` para objetos de domínio (`Post`, `Client`) e `type` para uniões
(`PostStatus`); (5) na maioria dos casos são intercambiáveis — escolha por consistência.

**"Por que usar `unknown` em vez de `any`?"**
Estrutura: (1) `any` desliga a checagem completamente; (2) `unknown` força você a
"provar" o tipo antes de usar (narrowing); (3) no lint do PostUp `no-explicit-any`
é erro — foi um dos maiores grupos de correção do audit; (4) quando o dado vem de
fora (API), o correto é tipar a resposta, não usar `any`.

**"O que é um type assertion e quando usar?"**
Estrutura: (1) é uma promessa ao compilador ("é T, confia"); (2) não muda runtime;
(3) usamos quando o Supabase/API retorna um shape que o TS não infere;
(4) excesso é cheiro de código — tipar na origem é melhor.

**Anterior**: [`00-como-usar.md`](00-como-usar.md) · **Próximo**: [`02-react.md`](02-react.md)
