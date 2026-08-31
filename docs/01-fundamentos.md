# 01 — Fundamentos: o produto e o domínio

> **Objetivo**: entender o que o PostUp faz e quais são os conceitos de domínio
> que aparecem no código o tempo todo.

## O problema que o PostUp resolve

Agências de marketing gerenciam **múltiplos clientes**, cada um com sua conta de
Instagram. Para cada cliente, posts são criados, agendados e — antes de irem ao ar —
precisam ser **aprovados pelo cliente final**. Sem ferramenta, isso vira um caos
de WhatsApp: prints, mensagens perdidas, "a versão que eu aprovei não era essa".

O PostUp organiza esse fluxo em um lugar só:

1. **Cronograma visual** — quando cada post vai ao ar.
2. **Kanban de feedbacks** — quais alterações estão pendentes, em andamento, prontas.
3. **Chat por post** — gestor e cliente conversam sobre cada peça.
4. **Review público** — o cliente aprova/rejeita sem precisar de conta, via link com token.
5. **Histórico de versões** — nunca se perde "qual versão foi aprovada".

## Conceitos de domínio (os substantivos)

| Conceito | O que é | Onde no código |
|----------|---------|----------------|
| **Post** | Uma peça de conteúdo (imagem/vídeo) com legenda, agendada para um cliente | `src/types/post.ts` |
| **Cliente** | Uma conta/marca que a agência atende | `src/types/client.ts` |
| **Feedback** | Uma solicitação de alteração sobre um post, com status | `src/types/feedback.ts` |
| **Versão** | Um snapshot do post num momento (para restore) | `src/types/post.ts` |
| **Notificação** | Aviso de evento (novo feedback, aprovação...) | `src/types/notifications.ts` |

### O fluxo central de um post

```
Gestor cria post ──► agendado no cronograma
      │
      ├──► cliente pede alteração (feedback) ──► gestor ajusta ──► nova versão
      │
      └──► cliente aprova ──► post marcado como aprovado/pronto
```

## O "vocabulário" do produto

Estes termos aparecem no código e na interface — aprendê-los torna a leitura muito mais fácil:

- **Agendado** (`agendado`): post com data marcada, ainda não aprovado.
- **Rascunho** (`rascunho`): post em edição, sem data confirmada.
- **Aprovado** (`aprovado`): cliente deu ok.
- **Publicado** (`publicado`): post foi ao ar.
- **Rejeitado** (`rejeitado`): cliente pediu mudanças.
- **Pendência**: post que passou da data sem ser aprovado/publicado.
- **Review token**: link secreto único que dá acesso do cliente ao fluxo de aprovação.

## Por que o domínio importa para o código

Toda a UI (cards, badges, kanban) e a lógica de dados (Supabase, hooks) giram em
torno desses conceitos. Por exemplo, a cor de um badge de status e as colunas do
kanban derivam dos mesmos status definidos em `src/components/ui/status-badge.tsx`.
Entender o domínio antes do código faz o restante da wiki fazer sentido.

## Praticar

1. Abra `src/types/post.ts` e `src/types/feedback.ts`. Liste todos os status de um feedback.
2. No app, crie um post de rascunho e observe onde ele aparece (Home? Cronograma? Kanban?).
3. Tente responder: por que `clientName` e `clientColor` estão duplicados dentro de `Post` em vez de buscados do cliente? (Dica: leia a seção de banco de dados antes de concluir.)

**Próximo**: [`02-stack.md`](02-stack.md)
