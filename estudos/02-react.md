# 02 — React: componentes, render e ciclo de vida

> **Objetivo**: dominar o modelo mental do React — JSX, componentes, props, estado,
> renderização e o ciclo de vida — com exemplos do PostUp.

## CONCEITO — O que é "render" no React

React constrói a UI como uma **árvore de componentes**. Cada componente é uma
**função** que recebe `props` e retorna uma descrição do que deve aparecer.
"Renderizar" = executar essa função para produzir a descrição.

```tsx
function PostCard({ post }) {
  return <div>{post.caption}</div>   // descrição do que renderizar
}
```

Três ideias centrais:

1. **Declarativo**: você descreve o QUE quer (a UI para os dados atuais);
   o React decide COMO atualizar o DOM.
2. **Estado**: quando o estado muda, o componente **re-renderiza** (a função roda de novo).
3. **Virtual DOM / reconciliação**: o React compara a árvore anterior com a nova
   (diff) e aplica o mínimo de mudanças no DOM real.

### O fluxo mental (decorar!)

```
1. Estado muda (setState, props, contexto)
2. React re-renderiza o componente (executa a função)
3. Produz a nova árvore de elementos (a "descrição")
4. Reconcilia: compara com a anterior
5. Atualiza só o que mudou no DOM
```

## CONCEITO — JSX

JSX parece HTML, mas é **sintaxe para chamar `React.createElement`**. Tudo que é
valor JS vai entre chaves `{}`:

```tsx
<StatusBadge status={post.status} size="md" />
```

- `status={post.status}` → passa a variável JS.
- `size="md"` → string literal.
- JSX não roda no navegador; o Vite transforma em `React.createElement` no build.

## NO CÓDIGO — `src/components/post/PostCard.tsx`

Abra o arquivo. Identifique:

1. **Props tipadas**: `{ post: Post; onSelect?: (id: string) => void }` — o componente
   declara o contrato do que recebe.
2. **`StatusBadge`** composto dentro do card (componentização).
3. **Evento**: `onClick={() => onSelect?.(post.id)}` — o `?` chama só se a função existir
   (prop opcional).

## CONCEITO — Estado (`useState`)

```tsx
const [loading, setLoading] = useState(true)
```

- `loading` = valor atual. `setLoading` = função para atualizar.
- Ao chamar `setLoading(false)`, o React agenda um re-render com o novo valor.
- Estado é **imutável na prática**: você não altera `loading`, você o **substitui**.

**Regra de ouro**: nunca faça `state.push(x)` (mutação). Sempre `setState([...state, x])`.

## CONCEITO — Efeitos (`useEffect`) e o ciclo de vida

`useEffect(fn, deps)` roda `fn` **depois do render**, quando `deps` mudam:

```tsx
useEffect(() => {
  fetchFeedbacks()                       // roda no montar + quando deps mudarem
  const channel = supabase.channel(...).subscribe()
  return () => supabase.removeChannel(channel)   // cleanup ao desmontar/antes do próximo
}, [postId, versionName, fetchFeedbacks])
```

- **Deps `[]`** → roda UMA vez (equivalente a `componentDidMount`).
- **Sem deps** → roda a cada render (perigoso).
- **Com deps** → roda quando alguma dependência mudar.
- **Cleanup (retorno)** → roda antes do próximo efeito e no desmonte
  (equivalente a `componentWillUnmount`). Serve para cancelar subscriptions,
  timers e listeners.

O React moderno não tem mais `componentDidMount` etc. — os efeitos (e seus cleanups)
substituem o "ciclo de vida" clássico.

## NO CÓDIGO — `src/hooks/use-feedbacks.ts`

Esse é o exemplo MÁXIMO do ciclo de vida no PostUp. Abra e leia com calma:

1. `useState` para `feedbacks`, `loading`, `sending`.
2. `useCallback` para `fetchFeedbacks` (estabiliza a referência da função).
3. `useEffect` que: busca dados + cria canal realtime + **retorna cleanup** que
   remove o canal.
4. Por que `fetchFeedbacks` está nas deps? Porque o efeito usa ela; o lint exige.
   E por que é `useCallback`? Para a referência NÃO mudar a cada render
   (senão o efeito rodaria de novo infinitamente).

> **Pergunta clássica**: "por que meu useEffect roda duas vezes?" Respostas:
> strict mode em dev, deps instáveis (função recriada a cada render), ou deps que
> mudam de identidade (objeto/array novo a cada render). No PostUp, `useCallback`
> resolve o caso das funções.

## CONCEITO — Renderização condicional

```tsx
{loading ? <Loader2 /> : posts.map(...)}
{!error && <form>...</form>}
```

- Ternário: um dos dois ramos.
- `&&`: renderiza o direito se o esquerdo for truthy.
- É JS puro dentro de `{}` — não há "template" especial no React.

## CONCEITO — Composição vs herança

O PostUp **compõe**: `StatusBadge` usa `<Badge>`, `PostCard` usa `StatusBadge`,
`Feedbacks` usa `KanbanColumn`. Isso é **composição**: componentes pequenos viram
blocos. Não existe herança de componentes React — herança é anti-padrão.

## PRATICAR

1. Abra `src/pages/Login/Login.tsx`: liste todos os `useState` e explique o que cada um controla.
2. No mesmo arquivo, encontre a renderização condicional de erro. O que muda na tela?
3. Crie um componente `<Counter>` de teste e explique, passo a passo, o que acontece
   no render ao clicar no botão.
4. No `use-feedbacks.ts`, **remova o cleanup** do efeito, rode o app, navegue entre posts
   e observe o console do Supabase (subscriptions acumulando). Depois restaure.

## ENTREVISTA — perguntas típicas

**"Explique o ciclo de vida de um componente React."**
Estrutura: (1) montagem (props/estado inicial, render, efeitos); (2) atualização
(re-render quando props/estado mudam, efeitos reexecutam se deps mudarem);
(3) desmontagem (cleanup dos efeitos); (4) no React moderno isso é expresso com
hooks (`useEffect` + cleanup), não com métodos de classe; (5) exemplo real do
`use-feedbacks` (busca + canal realtime + removeChannel).

**"O que é o Virtual DOM?"**
Estrutura: (1) o React mantém uma representação em memória da UI (árvore de elementos);
(2) a cada render ele diffa a nova árvore com a anterior; (3) calcula o mínimo de
mudanças e aplica no DOM real; (4) benefício: manipular DOM é caro; o diff minimiza;
(5) nuance de entrevista: o "Virtual DOM" é uma implementação da reconciliação —
o essencial é o modelo mental de "descrever a UI e deixar o framework sincronizar".

**"Qual a diferença entre estado e props?"**
Estrutura: (1) props vêm de cima (pai → filho), são imutáveis para o filho;
(2) estado é interno ao componente, mutável via setter; (3) mudar props = pai
re-renderiza o filho; mudar estado = componente re-renderiza; (4) exemplo:
`post` é prop do `PostCard`; `loading` é estado interno do hook/componente.

**Anterior**: [`01-js-ts.md`](01-js-ts.md) · **Próximo**: [`03-hooks.md`](03-hooks.md)
