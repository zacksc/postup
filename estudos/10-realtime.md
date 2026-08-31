# 10 — Realtime: WebSockets e o Supabase Realtime

> **Objetivo**: entender como o PostUp atualiza a UI sem refresh — o conceito de
> WebSocket, o canal do Supabase, `postgres_changes`, e a anatomia de uma
> subscription com cleanup.

## CONCEITO — HTTP vs WebSocket (a base)

- **HTTP (request/response)**: o cliente pergunta, o servidor responde, conexão
  encerra. Para "ouvir" mudanças, o cliente teria que **ficar perguntando**
  (polling) — ineficiente.
- **WebSocket**: conexão **bidirecional e contínua**. Servidor e cliente podem
  enviar mensagens a qualquer momento. Perfeito para chat, kanban colaborativo,
  notificações.
- **SSE (Server-Sent Events)**: conexão contínua do servidor PARA o cliente
  (unidirecional) — alternativa mais leve para notificações one-way.

O Supabase Realtime usa WebSocket. O PostUp assina canais e recebe eventos.

## CONCEITO — O modelo do Supabase Realtime

```
Cliente                                 Supabase (WebSocket)
   │                                          ▲
   │  channel('feedbacks-123')                │
   │  .on('postgres_changes',                 │ publica evento
   │       { table: 'post_feedbacks',         │ quando um INSERT acontece
   │         filter: "post_id=eq.123" })      │
   │  .subscribe()                            │
   │                                          │
   │  ◄───────────────────────────────────────┤ INSERT de feedback (ex.: do cliente via review)
   │  recebe payload → setFeedbacks(prev => [...prev, fb])
   ▼
   UI atualiza sem refresh
```

Peças-chave:
1. **Channel**: um "canal" de comunicação identificado por nome.
2. **`postgres_changes`**: tipo de evento que escuta mudanças no Postgres
   (INSERT/UPDATE/DELETE) — com filtros por tabela e coluna.
3. **Realtime está habilitado por tabela**: `ALTER PUBLICATION supabase_realtime
   ADD TABLE post_feedbacks;` (migration 006).
4. **Subscribe**: abre a conexão.

## NO CÓDIGO — `src/hooks/use-feedbacks.ts` (a anatomia completa)

```tsx
const channel = supabase
  .channel(`feedbacks-${postId}-${versionName || 'all'}`)
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'post_feedbacks', filter: `post_id=eq.${postId}` },
    (payload) => {
      const fb = payload.new as PostFeedback
      if (!versionName || !fb.version_name || fb.version_name === versionName) {
        setFeedbacks((prev) => [...prev, fb])
      }
    }
  )
  .subscribe()

return () => {
  supabase.removeChannel(channel)   // CLEANUP: cancela ao desmontar
}
```

Pontos que caem em entrevista:

1. **Nome do canal único** por post+versão: evita colisão entre telas.
2. **Filtro no servidor** (`post_id=eq.${postId}`): o Supabase só envia eventos
   daquele post — menos tráfego e menos lógica no cliente.
3. **`event: 'INSERT'`**: escuta só inserções (mural de feedback = sempre append).
4. **Atualização funcional**: `setFeedbacks(prev => [...prev, fb])` — usa o valor
   anterior, nunca sobrescreve com valor velho (seguro em concorrência).
5. **`removeChannel` no cleanup**: sem isso, cada troca de post deixa uma
   subscription órfã = **memory leak** + eventos duplicados.

## CONCEITO — O problema que o `useCallback` resolve no realtime

O efeito que cria o canal depende de `fetchFeedbacks` (nas deps). Se
`fetchFeedbacks` fosse uma função nova a cada render:
- O efeito re-executaria (deps mudaram) → criaria outro canal → o cleanup cancelaria
  o anterior → **flip-flop infinito** de subscribe/unsubscribe.

Com `useCallback`, a referência é estável → o efeito só re-executa quando `postId`/
`versionName` mudam de verdade. **Por isso o audit corrigiu tantos `useCallback`**.

## CONCEITO — Escutando mudanças com o estado correto

```tsx
setFeedbacks((prev) => [...prev, fb])
```

- **Forma funcional** do `setState`: o React passa o valor atual.
- Por quê? Se dois eventos chegam rápido (ou um insert local + um realtime), a
  forma funcional garante que nenhuma atualização se perca. A forma direta
  (`setFeedbacks([...feedbacks, fb])`) lê um valor possivelmente velho.

## NO CÓDIGO — Outros usos de realtime no PostUp

- `Chat.tsx`: escuta `post_feedbacks` para o chat gestor↔cliente.
- `Feedbacks.tsx`: kanban sincronizado (cards atualizam se outro agente do fluxo
  mexer — ex.: aprovação pelo cliente via review link reflete no kanban do gestor).
- Kanban drag-and-drop: `update({ status })` dispara evento → outras telas reagem.

## CONCEITO — Quando NÃO usar realtime

- Se a mudança só ocorre localmente (1 usuário) → fetch simples basta.
- Se o volume de eventos é enorme → pode sobrecarregar (pense em debounce/batch).
- Se você só precisa de dados uma vez → não assine canal, faça `select`.

**Decisão do PostUp**: realtime onde há **múltiplas portas de entrada** (gestor +
cliente no mesmo post via review). Onde é single-user (configurações), fetch simples.

## PRATICAR

1. Abra dois navegadores (normal + anônimo), um logado e outro no `/review/:token`.
   Envie feedback de um lado e observe o outro atualizar sem refresh.
2. No `use-feedbacks.ts`, **remova o `removeChannel`** e navegue entre posts. Abra o
   console/network e veja as conexões WebSocket acumulando. Depois restaure.
3. Adicione `console.log('subscribed')` dentro do callback e conte quantas vezes
   roda ao trocar de post — entenda o papel do cleanup + useCallback.
4. Escreva, de cabeça, a linha que cria um canal ouvindo UPDATE em `posts` filtrado
   por `client_id`. Compare com o real.

## ENTREVISTA — perguntas típicas

**"Explique a diferença entre polling, SSE e WebSocket."**
Estrutura: (1) polling: cliente pergunta repetidamente (simples, ineficiente);
(2) SSE: servidor→cliente contínuo (notificações one-way); (3) WebSocket:
bidirecional contínuo (chat, colaborativo); (4) o PostUp usa WebSocket via
Supabase Realtime; (5) quando escolher cada um.

**"Como o Supabase Realtime funciona?"**
Estrutura: (1) canais sobre WebSocket; (2) `postgres_changes` escuta mudanças do
banco (INSERT/UPDATE/DELETE) via publicação `supabase_realtime`;
(3) filtros por tabela/coluna reduzem o tráfego; (4) o cliente recebe `payload`
e atualiza estado; (5) é preciso habilitar a tabela na publicação (migration 006).

**"Como evitar memory leak com subscriptions?"**
Estrutura: (1) sempre retornar cleanup no `useEffect` que cria o canal;
(2) `supabase.removeChannel(channel)` no desmonte; (3) canais com nome único por
escopo; (4) `useCallback` estabiliza deps para não recriar o efeito;
(5) exemplo real: `use-feedbacks.ts`; (6) sintoma de leak: conexões WebSocket
acumulando, eventos duplicados.

**Anterior**: [`09-seguranca-web.md`](09-seguranca-web.md) · **Próximo**: [`11-arquitetura.md`](11-arquitetura.md)
