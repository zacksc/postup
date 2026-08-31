# 03 — Arquitetura: como o app é organizado

> **Objetivo**: entender o esqueleto do projeto — entrada, rotas, layout protegido,
> lazy loading e o fluxo de dados da tela até o Supabase.

## A entrada: `src/main.tsx` → `src/App.tsx`

`main.tsx` monta o React no DOM e renderiza `<App />`. O `App.tsx` é o **provedor
de contexto**: ele envolve tudo com os providers de tema (`next-themes`) e de
toasts (`sonner`), e renderiza `<AppRoutes />`. Todo o roteamento fica isolado em
`src/routes/index.tsx`.

```tsx
// padrão mental de App.tsx
<ThemeProvider>        // claro/escuro
  <Toaster />          // toasts (sonner)
  <AppRoutes />        // <BrowserRouter> + <Routes> + <Suspense>
</ThemeProvider>
```

## Rotas com lazy loading (code-splitting)

Todas as páginas são carregadas com `lazy(() => import(...))` e embrulhadas em
`<Suspense>`. Na prática: cada página vira um **arquivo JS separado no build**, e o
navegador só baixa a página quando o usuário navega para ela. O bundle inicial fica
pequeno — essencial num app que terá muitas telas.

```tsx
const HomePage = lazy(() => import('@/pages/Home/Home'))
// ...
<Suspense fallback={<PageFallback />}>   // spinner central enquanto carrega
```

## Três grupos de rotas

1. **Públicas** (fora do `AppShell`): `/` (landing), `/demo`, `/login`, `/cadastro`,
   `/esqueci-senha`, `/redefinir-senha`, `/review/:token`.
2. **Protegidas** (dentro de `<ProtectedRoute />` + `<AppShell />`): `/home`,
   `/cronograma`, `/posts/*`, `/clientes/*`, `/feedbacks`, `/grid/:clientId`,
   `/perfil`, `/configuracoes`, `/logs`, `/chat`.
3. **404**: qualquer rota desconhecida → `NotFoundPage`.

### O padrão de rotas aninhadas (importante!)

```tsx
<Route element={<ProtectedRoute />}>      // 1º filtro: autenticado?
  <Route element={<AppShell />}>          // 2º layout (sidebar+header)
    <Route path="/home" element={<HomePage/>} />
  </Route>
</Route>
```

- `ProtectedRoute` (em `components/layout/ProtectedRoute.tsx`) verifica a sessão
  do Supabase; se não estiver logado, redireciona para `/login`.
- `AppShell` renderiza `Sidebar` + `Header` + `<Outlet />` (a página filha).
  Isso significa que a sidebar **não remonta** quando você troca de página.

O `Outlet` do React Router é o "buraco" onde o conteúdo da rota filha aparece.

## O que é o alias `@/`

Em `tsconfig` e `vite.config.ts`, o caminho `@` aponta para `src/`. Por isso você
vê `import { cn } from '@/lib/utils'` em vez de caminhos relativos gigantes.

## O fluxo de dados de uma tela (ex.: Home)

```
Componente (Home)                      Supabase
     │                                     ▲
     │  chama o hook (use-feedbacks)       │ SQL via RLS
     ▼                                     │
Hook (busca, estados loading/erro) ────────┤
     │  supabase.from('...').select(...)
     ▼
Estado React → renderiza (cards, calendário, métricas)
```

Padrão usado no projeto:

1. O componente chama um **hook customizado** (`use-*` em `src/hooks/`).
2. O hook encapsula: fetch inicial, estados (`loading`, `error`, `data`), e funções de mutação.
3. As mutações chamam `supabase.from('tabela').insert/update/delete(...)`.
4. Realtime (quando configurado, ex.: chat) atualiza a UI automaticamente via subscription.

## Por que essa arquitetura?

- **Code-splitting** → carregamento rápido em mobile (usuários reais do produto).
- **Rotas aninhadas** → layout persistente, sem recarregar sidebar a cada navegação.
- **Hooks por feature** → lógica reutilizável entre telas (ex.: `use-feedbacks`
  usado em Feedbacks e PostDetalhe) e componentes magros.
- **Pasta por página** (`pages/Home/Home.tsx`) → escala bem: cada feature agrupa
  seus componentes específicos.

## Limitações conhecidas (leia antes de expandir)

- Sem camada de cache/React Query: telas que montam refazem o fetch. Para o porte
  atual (1 usuário agência), ok. Se virar multi-teams com muitos dados, avalie.
- `browserRouter` requer SPA fallback no servidor — a `vercel.json` já configura o
  rewrite para `index.html` (veja `11-deploy-vercel.md`).

## Praticar

1. Adicione uma rota nova `exemplo` (página simples) e observe o lazy loading no Network do DevTools.
2. Vá para outra página autenticada e verifique se a `Sidebar` continua montada (adicione um `console.log` no `useEffect` dela, depois remova).
3. Abra `src/components/layout/ProtectedRoute.tsx`: o que ele renderiza quando o usuário está logado? E quando não está?

**Anterior**: [`02-stack.md`](02-stack.md) · **Próximo**: [`04-dominio-tipos.md`](04-dominio-tipos.md)
