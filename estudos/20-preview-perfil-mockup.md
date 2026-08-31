# 20 — "Ver como o cliente vê": mockup de perfil IG, prévia do grid e o carrossel mobile

> **Objetivo**: destrinchar as features de **preview** do PostUp — como o app
> mostra ao gestor o que o cliente final verá no Instagram, e como as telas
> densas sobrevivem no celular. Três temas: um componente de mockup reutilizável,
> telas que geram interação ("criar post no espaço vazio", "copiar código") e
> um carrossel com matemática de largura.

## O mapa do passeio

```
1 — IgProfileMockup   → o "celular fake" reutilizável (framework de UI em mini)
2 — GridInstagram     → prévia + copiar + espaço vazio gera post
3 — ClienteFluxo      → coluna de preview no desktop, modal no mobile
4 — Carrossel mobile  → w = (100% − gap) / 1.25  (a fórmula de "1 card + 1/4")
```

Tese: **preview não é luxo — é a ponte entre o "sistema" (onde o gestor
trabalha) e o "produto" (o feed do Instagram que o cliente publica).** Quanto
mais fiel o preview, menos surpresa lá na frente.

---

## Parte 1 — `IgProfileMockup`: um celular fake, reutilizável

### 1.1 A ideia

Três telas precisavam mostrar "o perfil do Instagram do cliente":
`GridInstagram`, `ClienteFluxo` e o modal de prévia. Em vez de cada uma
redesenhar um perfil IG, criamos **um componente único** em
`src/components/instagram/IgProfileMockup.tsx` que recebe o cliente e os
posts e desenha o perfil inteiro.

### 1.2 A anatomia (linha por linha de conceito)

**Moldura de celular** (para a ilusão funcionar):

```tsx
<div className="rounded-[32px] overflow-hidden border-[3px] border-[#222] shadow-2xl bg-black" style={{ width }}>
  {/* Notch: a "pílula" preta de cima, com a câmera */}
  <div className="h-8 bg-black flex items-center justify-center relative shrink-0">
    <div className="w-[80px] h-1 rounded-full bg-white/20" />
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[20px] bg-black rounded-b-2xl" />
  </div>
```

O `style={{ width }}` permite a MESMA peça desenhar em tamanhos diferentes
(300px no grid, largura da coluna no ClienteFluxo, maior no modal).

**Cabeçalho IG**: foto + stats (posts/seg./seg.) + nome + bio + botão "Seguir".
Os stats vêm do próprio cliente (`client.followers`, `client.following`).

**Abas grid/tags**: o componente tem estado interno (`tab`), então é
interativo sem depender da tela que o hospeda.

**Grid 3 colunas — sem espaços vazios**:

```tsx
<div className="grid grid-cols-3 gap-[1px] bg-gray-200">
  {posts.map((p) => (
    <div key={p.id} className="aspect-[4/5] bg-gray-100 relative overflow-hidden">
      {p.mediaUrl ? <MediaPreview url={p.mediaUrl} className="w-full h-full" /> : /* ícone do tipo */ }
      {p.status !== 'publicado' && <div className="absolute inset-0 border-2 border-white/40 border-dashed" />}
      <div className={cn('absolute top-1 right-1 w-[14px] h-[14px] rounded-full border-2 border-white', STATUS_CLASS[p.status])} />
    </div>
  ))}
</div>
```

- `gap-[1px]` + fundo cinza → o "risco" entre as células do Instagram.
- `aspect-[4/5]` → proporção correta de post (4:5).
- **Só os posts reais** (`posts.map`) — antes, o grid desenhava células "+"
  vazias que imitavam o botão de criar; isso confundia a prévia (não era um
  post). Removido em `42e1ce8`.
- A **bolinha de status** e o **contorno tracejado** são a parte "do PostUp"
  dentro da "cara de Instagram": o gestor vê, num relance, o que ainda não foi
  publicado (`aguardando`, `alteracao`, `rascunho`...) — informação que o
  Instagram real não mostra. Isso é a "aumentação de realidade" do preview.

### 1.3 Por que um componente separado (`components/instagram/`)

É uma pasta nova no design system: **componentes que simulam o produto
Instagram**. A regra de camadas continua valendo: `ui/` não conhece domínio,
`instagram/` usa `ui/` + `post/MediaPreview` e conhece o domínio (status de
post). Qualquer tela que queira "mostrar o perfil" importa UMA coisa só.

---

## Parte 2 — GridInstagram: interações que o preview gera

A página `GridInstagram` (`/grid/:clientId`) é onde o gestor arrasta posts no
calendário e vê o feed montado. Novas interações:

### 2.1 Botão "Prévia"

Um botão abre um **modal** com o `IgProfileMockup` — desktop e mobile. Serve
para "ver de longe, como um visitante do Instagram veria", sem os controles da
página. O modal é o mesmo componente da Parte 1, então não há código duplicado.

### 2.2 Botão "Copiar" (mobile)

No celular não dá para "gerar código" com a mesma facilidade — então um botão
**copia o código do grid** (provavelmente para colar num gerador de layout ou
compartilhar). Copiar usa a API `navigator.clipboard`, com feedback de toast.

### 2.3 Clicar no espaço vazio → criar post

```tsx
// "Não tem nada aqui. Quer criar?"
// → <Dialog> pergunta "Criar novo post?"
// → confirmar → navigate(`/posts/novo?date=...`)
```

É o princípio **"espaço vazio também é UI"**: em vez de o usuário procurar o
botão de criar, o próprio grid vazio se oferece como atalho. `NovoPost` lê o
parâmetro `?date=` na URL e já abre a data certa — navegação com estado.

### 2.4 Legenda das bolinhas no topo

As 5 bolinhas de status (rascunho, aguardando, alteração, aprovado, publicado)
ganharam uma legenda explícita no topo — no desktop numa faixa, no mobile no
bloco de controles. Antes a cor de cada bolinha ficava implícita; legendar
torna o grid autossuficiente.

---

## Parte 3 — ClienteFluxo: o "visto pelos olhos do cliente"

A rota `/review/:token` é o que o cliente final vê. O gestor também quer ver
como está ficando, então:

- **Desktop**: uma **coluna lateral sticky** com o `IgProfileMockup`, que
  acompanha o scroll enquanto o gestor rola a lista de posts.
- **Mobile**: um botão "Ver prévia do perfil no Instagram" abre o mockup num
  **modal** (não há espaço para coluna fixa no celular).
- **Cards de post limitados a `max-w-[400px]`**: a largura do card agora é
  proporcional ao que o Instagram realmente mostra — o gestor avalia "o
  resultado", não um card genérico de sistema.
- **Área de revisão separada** (`bg-[#f8f9fb]`): a decisão do cliente (aprovar /
  pedir alteração) fica visualmente distinta do conteúdo — "o que você está
  vendo" vs "o que você vai decidir".
- **Preview realista**: ícones de coração/comentário/compartilhar + mídia
  clicável abrindo o lightbox (Parte 3 do estudo 19).

A mesma separação "sistema vs produto" aparece em todo o app: o PostUp **não
substitui** o Instagram, ele **espelha** o que vai acontecer.

---

## Parte 4 — O carrossel mobile do Feedbacks (a fórmula do "1 card + 1/4")

### 4.1 O problema

Na página `Feedbacks`, os cards de feedback apareciam dentro de colunas do
kanban. No mobile, as colunas viraram **lista** (uma em baixo da outra), mas
os CARDS dentro de cada coluna voltaram a ser um **carrossel horizontal** —
para não gastar a altura inteira da tela com cards empilhados.

### 4.2 As classes-chave (`Feedbacks.tsx:640-668`)

```tsx
className="flex gap-2 p-3 overflow-x-auto snap-x"          // container: rola e "encaixa"
className="... shrink-0 snap-start"                        // cada card: não encolhe, é âncora
className="w-[calc((100%_-_0.5rem)/1.25)] md:w-auto"       // a fórmula da largura
```

### 4.3 A matemática (decorar esta fórmula)

```
w = (100% − gap) / 1.25
```

Por que **1.25**? Queremos que o usuário veja **1 card inteiro + ¼ do próximo**
— aquele "canto" que sinaliza "tem mais coisa para rolar". 1.25 = 1 + 0.25.

- Largura total disponível: 100%.
- Queremos caber 1.25 cards no container (+ o `gap` de 0.5rem entre o card e
  o pedaço do próximo).
- Então cada card = `(100% − gap) / 1.25`.

Com `gap: 0.5rem` (8px) e container de, digamos, 360px:
`(360 − 8) / 1.25 ≈ 281px` por card → 281 + 8 (gap) + ¼·281 ≈ 359px ≈ 360px. ✔

**Snap (`scroll-snap-type` + `scroll-snap-align`)**:
- `snap-x` no container → o scroll "gruda" em posições inteiras.
- `snap-start` no card → cada card pode ser o início de uma parada.
- O usuário não para num "meio card" torto.

**`md:w-auto`** → no desktop, o carrossel vira coluna normal (largura natural);
o `w-[calc(...)]` só vale no mobile (mobile-first: base mobile, breakpoint
desmonta a regra).

### 4.4 Card único centralizado

Se a coluna tem **um só card**, a fórmula faria o card ocupar 80% e ficar à
esquerda com vazio à direita — feio. A correção: quando `filteredCount === 1`,
aplica `justify-center` no container (estudo dos commits `4b1566f` e
`7b4294a`). Um único card fica centralizado, como um item de carrossel
solitário.

---

## Parte 5 — Checklist de reconhecimento e lições

| Se você vê... | Causa provável | Onde olhar |
|---|---|---|
| Grid do mockup com células "+" vazias | Versão antiga desenhava placeholders | `IgProfileMockup` → só `posts.map` |
| Card do carrossel ocupando 80% e à esquerda | Card único sem `justify-center` | `filteredCount === 1` no Feedbacks |
| "Canto" do próximo card ausente | Largura errada (sem o /1.25) | `w-[calc((100%_-_0.5rem)/1.25)]` |
| Card solto entre células no scroll | Sem `snap-x`/`snap-start` | classes do container/card |
| Mockup "espremido" em tela grande | `width` fixo pequeno | `style={{ width }}` do mockup |
| Código de grid não copia | Clipboard API bloqueada | `navigator.clipboard` + fallback |

### Lições

1. **Mockup = produto da reutilização.** Um componente fiel + `width` flexível
   + props de domínio substitui três cópias de UI. Nova pasta (`instagram/`)
   organiza "simuladores do produto".
2. **`aspect-[4/5]` + `gap-[1px]` + `grid-cols-3`** = o "DNA" visual do feed
   do Instagram em 3 linhas.
3. **Espaço vazio é UI.** Clicar no grid vazio oferece criar o post — e o
   `?date=` na URL leva o estado junto.
4. **Mobile-first com `md:` para desmontar**: a regra do carrossel existe na
   base e é cancelada no breakpoint — sem lógica JS de responsividade.
5. **Fórmulas de layout valem a pena documentar** (`/1.25`, `gap`) porque
   ficam crípticas depois de alguns dias.

---

## Parte 6 — Para fixar (exercícios)

1. Abra `src/components/instagram/IgProfileMockup.tsx` e responda: como o mesmo
   componente atende 300px no grid e uma coluna larga no ClienteFluxo?
2. Derive a fórmula `(100% − gap)/1.25` para um container de 320px com gap de
   8px. Qual a largura do card e quanto do próximo fica visível?
3. Por que o `w-[calc(...)]` precisa do `md:w-auto`? O que aconteceria no
   desktop sem ele?
4. No GridInstagram, descreva a jornada "espaço vazio → criar post": quais
   componentes e qual query string ligam o clique ao `NovoPost`?
5. No ClienteFluxo, por que a coluna do mockup é `sticky` no desktop, mas vira
   modal no mobile? O que o `sticky` economiza?

---

## Links para continuar

- **`docs/09-ui-componentes.md`** — design system e a hierarquia de componentes.
- **`docs/06-fluxos-frontend.md`** — fluxo do cliente (`/review/:token`).
- **`estudos/19-midia-upload-lightbox.md`** — MediaPreview/MediaLightbox usados
  dentro do mockup.
- **`estudos/05-css-tailwind.md`** — utilitários, `aspect-ratio`, `calc` e
  scroll-snap.
- **`docs/12-decisoes-alternativas.md`** — decisões de preview/carrossel.
