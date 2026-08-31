# 03 — Hooks em profundidade

> **Objetivo**: dominar `useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`
> e **custom hooks** — o coração do PostUp — entendendo o PORQUÊ de cada um.

## CONCEITO — O que é um hook

Hook = função que "engancha" o componente ao sistema de estado/efeitos do React.
Regras inegociáveis:

1. Só chame hooks **no topo** de um componente/custom hook (não dentro de `if`,
   loops ou funções aninhadas).
2. Só chame em **componentes ou custom hooks** (não em funções JS comuns).
3. Por quê? O React mantém os hooks numa **lista ordenada** por chamada. Se a
   ordem muda entre renders, o estado se perde. (Por isso o lint
   `react-hooks/rules-of-hooks` existe.)

## CONCEITO — `useState` em profundidade

```tsx
const [user, setUser] = useState<User | null>(null)
```

- O estado inicial é avaliado **uma vez** no primeiro render.
- `setUser(novoValor)` → agenda re-render.
- `setUser(prev => ...)` → forma funcional, usa o valor anterior (necessário em
  atualizações encadeadas ou quando o valor muda rápido, ex.: contadores).
- O PostUp usa em toda página: `loading`, `error`, `data`.

## CONCEITO — `useRef`

```tsx
const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
```

- `useRef` guarda um valor **que não causa re-render** quando muda.
- Serve para: timers, referência a elementos DOM (`ref={el}`), valores "mutáveis"
  entre renders.
- Diferença de `useState`: mudar ref NÃO re-renderiza; mudar estado re-renderiza.

**No código**: `ClienteFluxo.tsx` usa `toastTimer` para guardar o timer do toast —
se um novo toast chega, limpa o anterior (não precisa de re-render para isso).

## CONCEITO — `useCallback`

```tsx
const fetchPosts = useCallback(async (clientId: string, ...) => {
  // busca posts do supabase
}, [clientId, ...])
```

- `useCallback(fn, deps)` retorna a **mesma referência** de `fn` enquanto as deps
  não mudarem.
- Para quê? Estabilidade de referência:
  1. Se `fetchPosts` é dep de um `useEffect`, sem `useCallback` ela seria nova a
     cada render → o efeito rodaria infinitamente.
  2. Se `fetchPosts` é passado como prop, sem `useCallback` o filho re-renderiza
     a cada render do pai.

**Este foi um dos maiores aprendizados do audit do PostUp**: vários efeitos
"infinitos" eram funções instáveis nas deps. Correções em `Chat.tsx`,
`ClienteFluxo.tsx`, `NovoPost.tsx`, `Clientes.tsx`, `ClientDetail.tsx`.

## CONCEITO — `useMemo`

```tsx
const approvedCount = useMemo(
  () => posts.filter(p => p.status === 'aprovado').length,
  [posts]
)
```

- `useMemo` **calcula e guarda o resultado**; só recalcula se as deps mudarem.
- Para quê? Evitar computação cara em todo render. E também **estabilidade**:
  o objeto/valor resultante tem referência estável enquanto as deps não mudam.
- No `ClienteFluxo`, `approvedCount`, `pendingCount`, `progressPct` derivam de
  `posts` — com `useMemo`, não recalculam a cada render se `posts` não mudou.
- **Não use useMemo como otimização prematura**: para contas baratas, calcula direto.

## CONCEITO — `useEffect` + `useCallback` (o combo que mais gera bugs)

```
Sem useCallback:  função nova a cada render → efeito que a usa roda a cada render
Com useCallback:  mesma referência enquanto deps estáveis → efeito roda só quando precisa
```

O lint `react-hooks/exhaustive-deps` (regra do PostUp) te força a listar TODAS as
deps. Se o lint acusa, o código tem um problema real de estabilidade — corrigir,
não silenciar (exceto casos pontuais comentados).

## CONCEITO — Custom hooks

Um custom hook é só **uma função que chama outros hooks**. Ele encapsula lógica
reutilizável que envolve estado/efeitos.

```tsx
export function useFeedbacks(postId: string, versionName?: string | null) {
  const [feedbacks, setFeedbacks] = useState<PostFeedback[]>([])
  // ... fetch + realtime ...
  return { feedbacks, loading, sending, send, sendLog }
}
```

**Benefícios**:
- `useFeedbacks` usado em `PostDetalhe` e `Chat` — a lógica vive em UM lugar.
- O componente fica magro: só renderiza e chama ações.
- Os testes podem mockar o hook inteiro (como `Login.test.tsx` faz com `useAuth`).

## NO CÓDIGO — `src/hooks/use-auth.tsx`

Este hook é um **contexto** + hook: `AuthProvider` (componente) fornece o valor,
`useAuth()` (função) consome. Identifique:

1. Estado: `user`, `session`, `loading`, `isRecoverySession`.
2. Efeito que restaura sessão (`getSession`) e escuta `onAuthStateChange`.
3. Ações (`signIn`, `signUp`, ...) que retornam `{ error?: string }` — padrão do projeto.
4. `verifyTurnstile` interno (valida token do captcha via edge function).

## NO CÓDIGO — O efeito "TDZ" corrigido no Chat

No `Chat.tsx` havia um bug clássico: um `useMemo` acessava uma variável **antes** de
ela ser declarada no código (Temporal Dead Zone — a variável existe mas ainda não
foi inicializada). A correção foi **reordenar** as declarações. Lição: a ordem das
declarações importa; dependências precisam vir antes de quem as usa.

## PRATICAR

1. No `use-feedbacks.ts`, troque `useCallback` por função normal e adicione a função
   nas deps do efeito. Rode o lint (`npm run lint`) e leia o aviso. Depois desfaça.
2. Crie um custom hook `useDebouncedValue(value, delay)` e use num input de busca.
3. No `ClienteFluxo`, adicione `console.log` dentro de `fetchPosts` e observe quantas
   vezes roda ao interagir — entenda o efeito do `useCallback` nas deps.
4. Explique com suas palavras: por que `useRef` não re-renderiza e `useState` sim?
   Onde o PostUp usa cada um?

## ENTREVISTA — perguntas típicas

**"Qual a diferença entre `useCallback` e `useMemo`?"**
Estrutura: (1) `useCallback` memoiza a REFERÊNCIA de uma função; (2) `useMemo`
memoiza o RESULTADO de um cálculo; (3) ambos só reavaliam quando deps mudam;
(4) ambos dão estabilidade de referência — essencial em deps de efeitos e props;
(5) exemplo do PostUp: `fetchPosts` (useCallback) e `progressPct` (useMemo).

**"Por que o lint `exhaustive-deps` existe e o que ele pega?"**
Estrutura: (1) efeitos que usam valores precisam declarar todos; (2) sem isso,
efeitos usam valores "velhos" (closures) ou rodam demais; (3) no PostUp ele pegou
funções instáveis causando re-renders/subscriptions duplicadas; (4) a correção é
estabilizar com useCallback/useMemo, não suprimir (salvo exceções comentadas).

**"O que acontece se você chamar um hook dentro de um `if`?"**
Estrutura: (1) viola as regras dos hooks; (2) o React guarda hooks numa lista
ordenada por chamada; (3) se o `if` muda a ordem entre renders, o estado se
mistura/derruba; (4) por isso o lint proíbe; (5) solução: hooks sempre no topo,
condicionais dentro da lógica do hook (ex.: `if (!postId) return` no useFeedbacks).

**Anterior**: [`02-react.md`](02-react.md) · **Próximo**: [`04-render-perf.md`](04-render-perf.md)
