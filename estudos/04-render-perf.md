# 04 — Renderização e performance

> **Objetivo**: entender quando o React re-renderiza, como evitar re-renders
> desnecessários, e as técnicas de performance que o PostUp usa (lazy loading,
> code-splitting, uso inteligente de hooks).

## CONCEITO — Quando um componente re-renderiza?

Três gatilhos:

1. **Estado interno muda** (`setState`).
2. **Props mudam** (o pai re-renderizou e passou valores/refs diferentes).
3. **Contexto usado muda** (o valor do `Context` que o componente consome mudou).

Importante: quando o pai re-renderiza, os filhos **re-renderizam também** (por
padrão), mesmo que as props sejam "as mesmas" em valor — a menos que a referência
seja estável. Por isso `useCallback`/`useMemo` importam: **referências estáveis**
evitam re-render em cadeia.

## CONCEITO — O problema do "não preciso re-renderizar"

Cenário: `Home` tem um contador e renderiza `<ClientCard client={client} />`.
Clicar no contador re-renderiza `Home` → re-renderiza `ClientCard` (que não mudou).

Soluções (em ordem de agressividade):

| Técnica | O que faz | Uso no PostUp |
|---------|-----------|---------------|
| `useMemo`/`useCallback` | Estabiliza referências | Usado (deps estáveis) |
| `React.memo` | Pula re-render do filho se props não mudaram | Não usado (avaliar) |
| Extrair componente | Isolar estado quente num subcomponente | Padrão natural |
| Contexto seletivo | Só quem consome o contexto re-renderiza | `useAuth` no PostUp |

**Verdade de entrevista**: otimização prematura é ruim. Primeiro meça (React
DevTools Profiler), depois otimize. O PostUp usa as técnicas "baratas" (estabilidade
de referência + componentização) que resolvem 90% dos casos sem `memo`.

## NO CÓDIGO — A arquitetura que já evita re-render em cadeia

`src/routes/index.tsx`:

```tsx
<Route element={<ProtectedRoute />}>   // 1º gate
  <Route element={<AppShell />}>       // 2º layout persistente
    <Route path="/home" element={<HomePage/>} />
  </Route>
</Route>
```

O `<AppShell />` (Sidebar + Header) fica **fora** da página. Trocar de rota
re-renderiza só o `<Outlet />` (a página), não a Sidebar. Isso é otimização
estrutural: o layout não remonta a cada navegação.

## CONCEITO — Lazy loading e code-splitting

```tsx
const HomePage = lazy(() => import('@/pages/Home/Home'))
```

- `lazy(() => import(...))`: o módulo só é baixado **na primeira vez** que a rota
  é acessada.
- O bundler (Vite/Rollup) separa cada página em um **chunk** próprio.
- `<Suspense fallback={<Loader2/>}>`: enquanto o chunk carrega, mostra o fallback.
- Resultado: bundle inicial pequeno → app abre rápido em mobile (usuário real do PostUp).

**Por que não carregar tudo junto?** O JS de todas as páginas pesaria centenas de KB
e travaria o primeiro carregamento. Splitting = "pague só o que você usa".

## CONCEITO — `React.memo` (quando precisar)

```tsx
const ClientCard = memo(function ClientCard({ client, onSelect }) {
  // só re-renderiza se client/onSelect MUDAREM de referência
})
```

- `memo` compara as props (shallow) e pula o re-render se não mudaram.
- Só compensa se o filho é caro E as props são estáveis.
- No PostUp ainda não é necessário — a estabilidade de referência + layout
  persistente resolvem o problema atual. **Reavaliar quando** a Home crescer.

## CONCEITO — O "custo" de um render

Renderizar não é tocar o DOM: é executar a função do componente (JS) e produzir a
árvore de elementos. O custo é maior quando:
- A função calcula muita coisa (ex.: `posts.filter(...).sort(...)`).
- A árvore é grande (muitos componentes).
- Há chamadas caras no corpo (API, crypto, loops).

`useMemo` ataca o primeiro caso; componentização ataca o segundo; `lazy` ataca o
primeiro carregamento.

## NO CÓDIGO — `ClienteFluxo.tsx` (o exemplo completo)

Abra e note TODAS as técnicas juntas:

1. `useMemo` para `initials`, `approvedCount`, `pendingCount`, `progressPct`
   (derivados de `client`/`posts` — não recalculam sem necessidade).
2. `useCallback` para `fetchPosts` (referência estável → deps de efeitos).
3. `useRef` para `toastTimer` (valor que não re-renderiza).
4. `useEffect` organizado com deps corretas.
5. Efeito de auth movido após as declarações (fix do TDZ — ordem importa).

Esse arquivo é praticamente um "laboratório de hooks" — vale estudar linha a linha.

## CONCEITO — Quando a performance é um problema real?

Sinais de que você PRECISA otimizar:
- Interação com lag perceptível (devices reais, não seu PC).
- Re-render em cascata gigante no Profiler.
- Bundle > 300 KB gzipped no carregamento inicial.

No PostUp, o que já está sob controle: split por página, layout estável, refs
estáveis. O que NÃO é prioridade: `memo` em cards (dados pequenos).

## PRATICAR

1. Abra o React DevTools → Profiler. Navegue entre 3 páginas e observe quais
   componentes re-renderizam. A Sidebar re-renderiza ao trocar de rota?
2. Adicione `React.memo` no `ClientCard` e meça a diferença no Profiler (numa tela
   com estado local que muda — ex.: contador de teste). Vale a pena? Documente.
3. No `ClienteFluxo`, remova o `useMemo` do `progressPct` e compare com o Profiler.
4. Verifique no Network (aba JS) quantos chunks o app baixa na Home vs no Login.

## ENTREVISTA — perguntas típicas

**"Explique o que é code-splitting e quando usar."**
Estrutura: (1) dividir o bundle em chunks carregados sob demanda; (2) `React.lazy`
+ `Suspense` + import dinâmico; (3) benefício: primeiro carregamento menor;
(4) uso no PostUp: todas as rotas são lazy; (5) quando NÃO usar: página única
pequena onde o split adicionaria latência de rede.

**"O que é o Profiler do React DevTools e para que serve?"**
Estrutura: (1) grava renders e mostra quais componentes re-renderizam e quanto
tempo levam; (2) identifica re-renders em cascata (pai barato + filho caro);
(3) usamos para confirmar hipóteses de performance antes de otimizar;
(4) regra: meça antes de memoizar.

**"Como o PostUp evita re-render desnecessário do layout?"**
Estrutura: (1) rotas aninhadas com `AppShell` acima do `Outlet` — o layout é
persistente; (2) `useCallback`/`useMemo` estabilizam referências para deps;
(3) hooks de dados isolados por feature; (4) `memo` avaliado e dispensado no
momento (porte atual).

**Anterior**: [`03-hooks.md`](03-hooks.md) · **Próximo**: [`05-css-tailwind.md`](05-css-tailwind.md)
