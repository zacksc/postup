# 08 — Estado e hooks: onde vive o estado da aplicação

> **Objetivo**: entender o modelo de estado real do PostUp, os hooks customizados
> e uma lição valiosa: **nem toda dependência instalada é usada**.

## Estado global: Context API (não Zustand!)

O `package.json` **declara `zustand`**, mas o código **não usa zustand em lugar nenhum**
(verificável com um `grep`). O estado global real é feito com a **Context API do React**:

```
App.tsx
├── ThemeProvider (next-themes)   → tema claro/escuro
├── AuthProvider (use-auth.tsx)   → usuário, sessão, signIn/signUp/signOut...
├── <Toaster> (sonner)            → toasts
└── AppRoutes
```

Isso é um padrão perfeitamente válido: o projeto começou com Context e, enquanto
o estado global é "pouco" (auth + tema), Context resolve. **Quando considerar migrar
para Zustand/Redux?**

- Quando vários componentes distantes precisam do mesmo estado e há *prop drilling* demais.
- Quando há estado que muda fora do render (ex.: websocket atualizando muitas telas).
- Quando precisar de *selectors* para evitar re-renders desnecessários.

Zustand continua no package.json como dependência **planejada** — se a equipe/usuário
sentir a dor, a migração é barata (Zustand é ~1 KB e muda poucas linhas por store).

> **Lição didática**: `package.json` é o que está *instalado*, não o que está *usado*.
> Antes de instalar algo, confirme com `grep` se já não existe outra solução.

## Estado local: o padrão do PostUp

Cada página mantém seu estado com `useState`/`useEffect`/`useMemo`/`useCallback`.
O padrão dominante é **"hook de dados por feature"**: um hook por entidade que
encapsula fetch + estados + mutações.

### Exemplo: `use-feedbacks.ts`

```ts
export function useFeedbacks(postId: string, versionName?: string | null) {
  const [feedbacks, setFeedbacks] = useState<PostFeedback[]>([])  // dados
  const [loading, setLoading] = useState(true)                    // estado de UI
  const [sending, setSending] = useState(false)

  const fetchFeedbacks = useCallback(async () => { ... }, [postId, versionName])

  useEffect(() => {
    fetchFeedbacks()
    // + realtime subscription quando postId é UUID válido
    const channel = supabase.channel(`feedbacks-${postId}-${versionName || 'all'}`)
      .on('postgres_changes', { event: 'INSERT', ..., filter: `post_id=eq.${postId}` }, ...)
      .subscribe()
    return () => { supabase.removeChannel(channel) }  // cleanup!
  }, [postId, versionName, fetchFeedbacks])

  return { feedbacks, loading, sending, send, sendLog }
}
```

**Por que `useCallback` + `useEffect` com cleanup?**

1. `fetchFeedbacks` com `useCallback` estabiliza a referência da função → o
   `useEffect` não recria a subscription a cada render.
2. O cleanup (`removeChannel`) impede **memory leaks**: sem ele, cada troca de
   `postId` deixaria uma subscription órfã no Supabase.
3. Filtro por `post_id=eq.${postId}` no realtime: só recebemos eventos desta post.

> Esse padrão (e a correção de `useCallback` em `Chat.tsx`, `ClienteFluxo.tsx` e
> `NovoPost.tsx` durante o "audit" — commits `ae1c423`) foi exatamente o que o
> lint `react-hooks/exhaustive-deps` pegou: **hooks mal encadeados causam
> re-render infinito ou subscriptions duplicadas**.

## Hooks disponíveis (mapa)

| Hook | Responsabilidade |
|------|------------------|
| `use-auth.tsx` | Context de auth + Turnstile + reset senha |
| `use-profile.tsx` | Perfil do usuário (fetch/update + reset via RLS) |
| `use-teams.tsx` | Equipes/membros (com cast tipado) |
| `use-feedbacks.ts` | Mural de feedbacks do post (+ realtime) |
| `use-feedback-cards.ts` | Cards do kanban (CRUD, checklist, anexos) |
| `use-notifications.ts` | Notificações (fetch, marcar lida) |
| `use-browser-notifications.ts` | Notificações do browser (Notifications API) |
| `use-calendar.ts` | Lógica do calendário/cronograma |
| `use-toast.ts` | Atalhos do sonner (sucesso/erro/aviso) |

## Tema: `next-themes` + classe `dark`

`ThemeProvider attribute="class"` → o Tailwind v4 usa a classe `.dark` no `<html>`.
O `ThemeToggle` chama `setTheme('light' | 'dark')`; o `sonner.tsx` do `ui/` lê o
tema para pintar os toasts corretamente. Isso evita o "flash" de tema errado no
carregamento (o `next-themes` injeta um script antes do render).

## Dados "modelados" vs "flexíveis"

O PostUp mistura dois estilos:

- **Fortes**: `Post`, `PostFile`, `FeedbackCard` — campos conhecidos, autocomplete.
- **Flexíveis**: `metrics: Record<string, unknown>`, `contracts: ...` — schema aberto.

A regra prática usada: **estrutura central do domínio = tipo forte; metadados
periféricos = flexível**. Para o `metrics` do cliente evoluir (seguidores, alcance,
engajamento) sem quebrar o app, é flexível.

## Praticar

1. Rode `rg "zustand" src` — confirme você mesmo que não há uso. Onde ele é usado se você procurar em `node_modules`?
2. No `use-feedbacks.ts`, o que aconteceria se removêssemos o cleanup (`removeChannel`)? Simule trocando de post várias vezes no `PostDetalhe`.
3. Adicione um `console.log('render')` no `PostDetalhe` e observe quantas vezes re-renderiza ao enviar 1 mensagem. Isso explica o `useCallback`?

**Anterior**: [`07-seguranca.md`](07-seguranca.md) · **Próximo**: [`09-ui-componentes.md`](09-ui-componentes.md)
