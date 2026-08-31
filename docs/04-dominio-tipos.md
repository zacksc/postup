# 04 — O domínio em tipos: Post, Client, Feedback

> **Objetivo**: conhecer as estruturas de dados centrais, por que `PostStatus`/
> `PostType` são tipos união, e como os tipos conversam com o banco.

## Por que TypeScript ajuda no domínio

Os "nomes" do produto (post, status, tipo) viram **tipos** no código. Com tipos
união e `Record`, o compilador impede estados inválidos: um post não pode ter um
status `'qualquer-coisa'` porque `PostStatus` só permite 5 valores.

## `PostStatus` e `PostType` — a base de tudo

Definidos em `src/components/ui/status-badge.tsx`:

```ts
export type PostStatus = 'rascunho' | 'aguardando' | 'alteracao' | 'aprovado' | 'publicado'
export type PostType   = 'reels' | 'carrossel' | 'foto' | 'stories' | 'design'
```

Por que tipos **união** em vez de `string`? Porque o ESLint/TS acusam qualquer
valor fora da lista. E o `Record<PostStatus, string>` abaixo obriga: **se você
adicionar um status novo, precisa dar o label junto** — é impossível esquecer.
Isso é o padrão "make illegal states unrepresentable".

## `Post` (src/types/post.ts)

```ts
export interface Post {
  id: string
  clientId: string
  clientName: string        // denormalizado: cópia do nome do cliente
  clientColor: string       // denormalizado: cor da paleta do cliente
  clientHandle: string      // denormalizado: @handle
  type: PostType
  status: PostStatus
  caption: string
  scheduledAt: Date
  files: PostFile[]
  feedbackCount?: number
  version?: number
  platform?: 'instagram' | 'tiktok' | 'both'
}
```

### Denormalização (decisão importante!)

`clientName`, `clientColor` e `clientHandle` são **cópias** do cliente, gravadas
dentro do post. Isso é **denormalização**: repetimos dados para evitar JOINs e
consultas extras a cada renderização de cards/cronograma. Custo: se o cliente mudar
de nome, os posts antigos continuam com o nome velho. É um trade-off comum em
produtos de cronograma/feed (leitura pesada, escrita rara). Manter a cópia é
intencional.

> Se em algum momento precisar do cliente completo a partir do post, use
> `clientId` para buscar — mas prefira não fazer isso em listas.

## `PostFile` — mídias do post

```ts
export interface PostFile {
  id: string
  url: string
  thumbnailUrl?: string
  order: number                 // ordem no carrossel
  mediaType: 'image' | 'video'
}
```

`order` controla a sequência do carrossel; `thumbnailUrl` aparece em cards compactos.

## `PostVersion` — snapshot para histórico/restore

```ts
export interface PostVersion {
  id: string
  post_id: string
  version_number: number
  name: string                  // ex.: "v1 – aprovado pelo cliente"
  data: PostVersionData         // snapshot { post_type, caption, media_urls, scheduled_at, status }
  created_at: string
}
```

O snapshot guarda o estado completo do post naquele momento. O `Historico.tsx`
lista as versões; o "restore" copia `data` de volta para o post.

## `Client` (src/types/client.ts)

Estrutura rica: `branding` (fonts, logos, palette), `links` (canva, drive, linktree,
meetings), `metrics`, `contacts`, `contracts`, `bio`, `followers/following`,
`profile_photo`, `review_token` (usado no fluxo de review), `team_id`.

Perceba campos opcionais (`?`): um cliente recém-criado não tem `followers` nem
`bio`; o formulário de novo cliente (`NovoCliente.tsx`) preenche aos poucos.

## `PostFeedback` e `FeedbackCard` (src/types/feedback.ts)

Dois conceitos relacionados, mas distintos:

1. **`PostFeedback`** — um comentário no "mural" do post (`author_role:
   'gestor' | 'cliente'`, `type: 'message' | 'log'`). O `type: 'log'` é usado para
   eventos automatizados (ex.: "versão v2 criada").
2. **`FeedbackCard`** — um card estilo **Trello** (kanban): tem `title`,
   `description`, `deadline`, `priority`, `status`, `completed_at`. Acompanha
   `FeedbackCardAttachment` (imagens/links), `FeedbackCardChecklistItem`
   (checklist) e `FeedbackCardComment` (comentários). `FeedbackCardFull` junta tudo.

O kanban de feedbacks (`Feedbacks.tsx`) trabalha com `FeedbackCard`; o mural do
post (`PostDetalhe`) trabalha com `PostFeedback`.

## Tipos `Record<string, unknown>` — o "pegue qualquer coisa"

`metrics: Record<string, unknown>` e `contracts: Record<string, unknown>[]` são
**flexíveis por design**: o schema do cliente evolui sem exigir migração de tipo.
O trade-off: você perde autocomplete. Para estruturas estáveis, prefira tipos
fortes (como `branding`).

## Praticar

1. Adicione um 6º status ao `PostStatus` (ex.: `'cancelado'`) e veja o TypeScript exigir o label.
2. Leia `src/pages/Post/PostDetalhe.tsx`: onde `PostFeedback` e `PostVersion` são usados juntos?
3. No `Client`, o que acontece com `review_token` se você o tornar obrigatório? (Tente e veja o erro em `NovoCliente.tsx`.)

**Anterior**: [`03-arquitetura.md`](03-arquitetura.md) · **Próximo**: [`05-dados-supabase.md`](05-dados-supabase.md)
