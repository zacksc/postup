# 11 — Arquitetura frontend, camadas e padrões

> **Objetivo**: enxergar o PostUp como um sistema — camadas, fluxo de dados,
> padrões de organização, e por que essa estrutura escala.

## CONCEITO — Arquitetura em camadas

Todo sistema organizado tem camadas com responsabilidades distintas:

```
┌─────────────────────────── UI (pages) ───────────────────────────┐
│ Componentes por tela: Home, Cronograma, Feedbacks, Chat...       │
├────────────────────── Componentes de domínio ────────────────────┤
│ post/, feedback/, client/, calendar/ (sabem o que é um "post")   │
├─────────────────────────── Design system ────────────────────────┤
│ ui/ (button, badge, dialog...) — NÃO sabem o que é um "post"     │
├────────────────────────────── Hooks ─────────────────────────────┤
│ use-feedbacks, use-auth... (lógica de dados + estado)            │
├────────────────────────────── lib ───────────────────────────────┤
│ supabase client, utils, compress-image                           │
└─────────────────────── Supabase (backend) ───────────────────────┘
```

**Regra de dependência**: uma camada pode usar as de baixo, nunca as de cima.
`ui/button` não sabe que existe `pages/Home`. `Home` usa `ui/button`. Isso mantém
o sistema previsível.

## CONCEITO — O padrão de dados do PostUp (hooks por feature)

Cada entidade tem um hook que encapsula:
- Estado (`data`, `loading`, `error`)
- Fetch inicial (via Supabase)
- Mutações (`send`, `update`, `delete`)
- Subscriptions (realtime)

```
Componente → hook (use-feedbacks) → Supabase → banco
                 │
                 └── estado local (useState) → render
```

Benefício: a lógica de dados vive em UM lugar; qualquer tela reutiliza. O componente
fica "burro" (renderiza e chama ações) — fácil de testar e manter.

## CONCEITO — Rotas aninhadas e o "layout persistente"

```tsx
<BrowserRouter>
  <Suspense fallback={<PageFallback />}>
    <Routes>
      {/* públicas */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/review/:token" element={<ClienteFluxoPage />} />

      {/* protegidas: gate + layout */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/home" element={<HomePage/>} />
          ...
        </Route>
      </Route>
    </Routes>
  </Suspense>
</BrowserRouter>
```

1. **Rotas públicas vs protegidas** separadas por estrutura (não por `if`).
2. `ProtectedRoute` = gate de auth (uma vez, para todas).
3. `AppShell` = layout (sidebar/header) que **não remonta** ao trocar de página
   (o `<Outlet />` troca, o shell fica).
4. Tudo lazy (`lazy` + `Suspense`) → code-splitting por página.

## CONCEITO — Separação "o que mostrar" vs "como estilizar"

`StatusBadge` (não sabe CSS) escolhe a variante; `Badge` (com `cva`) sabe as cores.
Isso é uma **divisão de responsabilidade**: regra de domínio (status→variante) longe
de regra de apresentação (variante→classe CSS). Muda a cor num lugar; muda a regra
em outro.

## CONCEITO — Estado: onde vive cada tipo de estado

| Tipo de estado | Onde vive | Exemplo |
|----------------|-----------|---------|
| Estado de UI local | `useState` no componente | `loading`, `error`, modal aberto |
| Estado derivado | `useMemo` | `progressPct`, `approvedCount` |
| Estado compartilhado global | Context API | `user`, `session` (useAuth) |
| Estado do servidor | Hooks + Supabase | `feedbacks`, `posts` |

**Nota de honestidade técnica** (o PostUp): o `package.json` tem `zustand`, mas o
código usa Context + hooks. Zustand foi uma dependência planejada que não se
concretizou — o Context resolve o estado global atual. **Se o estado global
crescer** (multi-teams, muitos itens), migrar para Zustand é barato e seria a
escolha certa. Saiba explicar essa decisão — mostra maturidade.

## CONCEITO — Patterns que o PostUp usa (nomeie em entrevista)

- **Composição** (componentes pequenos compostos) em vez de herança.
- **Hook pattern** (custom hooks para lógica de dados).
- **Provider pattern** (AuthProvider expõe useAuth via Context).
- **Layout route** (rotas aninhadas para persistir layout).
- **Ports/Adapters (leve)**: a camada `lib/supabase.ts` isola o "mundo externo" —
  o resto do app não importa o Supabase diretamente em todo lugar.

## CONCEITO — O que NÃO fazer (anti-patterns que o PostUp evita)

- Componente gigante que faz tudo (God component) → extrair.
- Buscar dados dentro do render (chamada async no corpo) → hooks/efeitos.
- Mutar estado direto (`state.push`) → sempre `setState` com novo array/objeto.
- `any` em payloads → tipar (lint `no-explicit-any` é erro).
- Efeitos sem cleanup → subscriptions vazam.

## PRATICAR

1. Desenhe (papel ou mentalmente) o fluxo de dados de uma tela: do clique do usuário
   até a atualização no banco e volta. Use o `Feedbacks.tsx` (kanban drag) como caso.
2. Adicione um botão que aparece em TODAS as páginas autenticadas. Em qual camada
   você o colocaria? (Resposta: no `AppShell`, não em cada página.)
3. Identifique no `PostCard` quais props são domínio e quais são UI. Como separaria?
4. Se você adicionasse uma biblioteca de upload, onde ela entraria na hierarquia de
   camadas? (Dica: `lib/` ou um hook.)

## ENTREVISTA — perguntas típicas

**"Como você estruturaria um app React escalável?"**
Estrutura: (1) camadas (UI / domínio / design system / lógica / dados); (2) rotas
aninhadas com layout persistente; (3) hooks por feature para dados; (4) separação
de estado (local/derivado/global/servidor); (5) code-splitting; (6) cite o PostUp
como exemplo concreto de cada ponto.

**"O que é composição em React e por que preferir a herança?"**
Estrutura: (1) componentes pequenos compostos via children/props; (2) herança de
componentes é anti-padrão (acoplamento, difícil de testar); (3) exemplo: StatusBadge
compõe Badge; PostCard compõe StatusBadge; (4) benefícios: reuso, testabilidade,
single responsibility.

**"Como você decide entre Context API e uma lib de estado (Zustand/Redux)?"**
Estrutura: (1) Context para estado global pequeno e pouco mutável (auth/tema);
(2) Zustand/Redux quando: estado compartilhado com muitos consumidores, seletores,
atualizações fora do React; (3) o PostUp usa Context hoje e tem zustand instalado
como caminho planejado; (4) mostre que você pesa a decisão pelo PROBLEMA, não pelo
hype.

**Anterior**: [`10-realtime.md`](10-realtime.md) · **Próximo**: [`12-git-cicd.md`](12-git-cicd.md)
