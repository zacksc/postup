# 18 — Estudo de caso parte 2: a landing que "aparecia por trás"

> **Objetivo**: reconta, passo a passo, a investigação de um bug de navegação
> sutil: o usuário logado via a **landing page piscar "por trás" da tela atual**
> ao dar refresh ou trocar de página — de vez em quando. É o bug mais
> "fantasmagórico" do PostUp até aqui: nada quebrava, nenhum erro aparecia no
> console, e o sintoma dependia de **timing**. Este estudo mostra como
> rastrear um bug que "só às vezes acontece".

## Como ler este estudo (o mapa)

O formato é o mesmo do estudo 17: **sintoma → conceito → investigação → causa →
correção → lição**. A tese deste estudo é uma frase que vale ouro:

> **Quando você "vê" uma tela atrás de outra, não é um portal mágico: é uma
> rota que ainda está (ou ainda vai) ser desenhada. O navegador só desenha o
> que está no DOM. Se uma tela aparece, é porque ela ESTAVA montada — ou por
> um instante antes de outra a substituir.**

Guarde essa frase. Todo o estudo é um desdobramento dela.

```
Sintoma   → landing pisca "por trás" ao navegar/atualizar
Conceitos → paint, useEffect, <Navigate>, lazy/Suspense
Método    → por que "refresh em rota interna" NÃO causa (eliminação)
Causa     → redirect em useEffect roda DEPOIS do paint + link para "/"
Correção  → redirect em <Navigate> roda ANTES do paint + breadcrumb → /home
```

---

## Parte 0 — O palco: como as rotas estão divididas

Antes do bug, você precisa ter na cabeça o mapa de rotas. Abra
`src/routes/index.tsx` mentalmente:

```
Rotas PÚBLICAS (fora do AppShell — sem sidebar):
  /                  → LandingPage (a landing!)
  /login             → Login
  /cadastro          → Cadastro
  /esqueci-senha     → ForgotPassword
  /redefinir-senha   → ResetPassword
  /review/:token     → ClienteFluxo (fluxo do cliente, link com token)
  *                  → NotFound

Rotas PROTEGIDAS (dentro de <ProtectedRoute> → <AppShell>):
  /home, /cronograma, /posts/*, /clientes, /grid/:clientId,
  /feedbacks, /perfil, /configuracoes, /logs, /chat ...
```

Três peças de código importam:

**1. `ProtectedRoute.tsx` — o "porteiro" das rotas internas:**

```tsx
export function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) {
    return <div className="h-screen ..."><Loader2 className="animate-spin" /></div>
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}
```

Repare: ele **redireciona com `<Navigate>` no corpo do render**, não num
`useEffect`. Este detalhe é a chave da correção (veremos por quê).

**2. `Landing.tsx` — o efeito de redirecionar usuário logado (ANTES do bug):**

```tsx
const { user, loading } = useAuth()
const [menuOpen, setMenuOpen] = useState(false)
const [scrolled, setScrolled] = useState(false)

useEffect(() => {
  if (!loading && user) {
    navigate('/home', { replace: true })   // ← redireciona num useEffect
  }
}, [user, loading, navigate])
```

**3. `Breadcrumb.tsx` — o ícone de casinha que apontava para `/`:**

```tsx
<Link to="/" className="hover:text-foreground ...">
  <Home size={14} />
</Link>
```

---

## Parte 1 — O sintoma

O usuário (dono do produto) relatou:

> "Percebo que de vez em quando, quando dou refresh na página ou troco de
> página, eu vejo que tem a landing page inicial por trás."

Dois adjetivos são pistas enormes:
- **"de vez em quando"** → depende de algo não-determinístico (timing de
  rede, de carregamento de arquivo, da máquina). Bug intermitente.
- **"por trás"** → o usuário está vendo a página atual E a landing ao mesmo
  tempo, como se a landing fosse um papel atrás do papel da frente.

Não havia erro no console. Nada quebrava. Era só um "flash" visual.

---

## Parte 2 — Os conceitos (leia devagar, são a ferramenta da investigação)

### 2.1 Paint (pintar a tela)

O navegador **só desenha o que está no DOM** (a árvore de elementos viva do
documento). "Pintar a tela" = o navegador transforma o DOM em pixels. Se um
elemento não está no DOM, ele **não pode aparecer**. Logo, se a landing
"apareceu", é porque a landing estava (ou acabou de ficar) no DOM.

### 2.2 O ciclo de render do React (em que ordem as coisas acontecem)

Quando o React atualiza algo, a sequência é:

1. **Render** — o React roda suas funções componente e produz uma descrição
   do que a tela deve ser (o "Virtual DOM").
2. **Commit** — o React aplica as mudanças no DOM real (adiciona/remove/edita
   elementos).
3. **Paint** — o navegador desenha os pixels.
4. **`useEffect` roda** — DEPOIS do paint (efeitos são sempre *post-paint*).

O ponto 4 é o coração do bug: **qualquer navegação feita dentro de um
`useEffect` acontece depois de o navegador já ter pintado a tela.** Ou seja,
tudo o que o render do passo 1 produziu já apareceu para o usuário antes de o
efeito executar.

### 2.3 Passivo vs. render-time (a diferença entre `useEffect` e `<Navigate>`)

O React Router oferece DOIS jeitos de redirecionar:

- **No `useEffect`** (`navigate('/home')`): roda depois do paint. A tela atual
  já foi mostrada. Se a tela atual é a landing, ela aparece por pelo menos 1
  frame.
- **No render, com `<Navigate to="/home" replace />`**: o `Navigate` é um
  componente que, ao ser renderizado, chama `navigate` **durante o commit** —
  antes de o navegador pintar. A rota nova assume **no mesmo ciclo**, e o
  navegador nunca chega a pintar o conteúdo intermediário.

É exatamente o padrão que o `ProtectedRoute` já usava. A landing usava o outro.

### 2.4 Lazy loading e Suspense (por que "de vez em quando")

Toda rota é `lazy(() => import('...'))` — o arquivo da página só é baixado na
primeira visita. O `<Suspense fallback={...}>` mostra um spinner enquanto o
chunk (pedaço de código) carrega.

Isto explica o "de vez em quando": quando o usuário cai na rota `/`, às vezes
o chunk da landing ainda não está em cache e precisa ser baixado (→ mais tempo
visível), às vezes já está em cache e carrega em milissegundos (→ flash quase
imperceptível). O tempo que a landing fica na tela varia, mas **o motivo de
ela aparecer é sempre o mesmo**.

### 2.5 `replace` no Navigate

`replace: true` troca a entrada do histórico em vez de empilhar. Assim, o
botão "voltar" do navegador não leva de volta para a página que redirecionou.

---

## Parte 3 — A investigação (o método de eliminação)

A pergunta que norteou tudo: **por quais caminhos a URL vira `/`?**

### 3.1 Hipotese A — Refresh numa rota interna (`/home`, `/cronograma`...)

O deploy é na **Vercel**, e o `vercel.json` tem:

```json
"rewrites": [ { "source": "/(.*)", "destination": "/index.html" } ]
```

Isso significa que QUALQUER URL serve o mesmo `index.html` (fallback de SPA).
Ao refrescar `/cronograma`:
1. A Vercel devolve o `index.html`.
2. O React sobe, o `BrowserRouter` lê o pathname `/cronograma`.
3. O `ProtectedRoute` mostra spinner enquanto `loading` é `true`.
4. Auth resolve → usuário logado → renderiza `AppShell` + Cronograma.

**Em nenhum momento a landing entra no DOM.** A landing SÓ é renderizada
quando a rota `/` é a rota ativa. Refrescar `/cronograma` **não** pode mostrar
a landing. → Hipótese A descartada (com confiança).

### 3.2 Hipotese B — A landing ainda estava "montada" durante a troca

Poderia o React manter a landing no DOM enquanto carrega a próxima página
(lazy)? Não. Quando você navega e a rota nova suspende, o `<Suspense>` mostra
o fallback **substituindo** o conteúdo antigo — a página anterior é desmontada.
E quando a rota nova já carregou, a troca é síncrona (antiga sai, nova entra,
mesmo frame). Em nenhum dos casos a landing "sobrevive por baixo". → B
descartada.

### 3.3 Hipotese C — O usuário chega na URL `/` de verdade

Sobrou uma possibilidade: **em algum momento a rota ativa é `/`**, e a landing
é renderizada. Quando um usuário LOGADO cai em `/`, acontecia:

1. A landing monta (chunk lazy carrega).
2. O render produz a tela da landing inteira (navbar fixa, hero, features...).
3. O React faz o commit no DOM.
4. **O navegador PINTA a landing.**
5. Só então o `useEffect` roda → `navigate('/home')` → a landing desmonta.

Entre 4 e 5, o usuário viu a landing. "Por trás" é a percepção dele durante
essa fração de segundo (ou o flash no momento da troca).

**De onde vem a navegação para `/`?** Encontramos DOIS caminhos:

- **O ícone de casinha do `Breadcrumb`** (componente do Header, visível em
  todas as páginas internas): `to="/"`. Clicou → caiu na landing → flash →
  redirect para `/home`.
- **Voltar/avançar do navegador**: o histórico continha `/` (por exemplo, a
  pessoa entrou pela landing antes de logar) e o botão voltar reabria `/`.

A causa raiz era uma só: **a landing usava `useEffect` para redirecionar —
depois do paint — quando deveria usar `<Navigate>` — antes do paint.**

### 3.4 Por que o sintoma era intermitente

O `useEffect` SEMPRE mostrava pelo menos 1 frame da landing. Mas:

- Chunk em cache + máquina rápida → 1 frame, quase invisível.
- Chunk sendo baixado + auth resolvendo → centenas de ms, bem visível.
- O usuário pode nem ter notado a maioria dos flashes — só os perceptíveis.

---

## Parte 4 — A correção (e POR QUE resolve)

### 4.1 Landing.tsx — gate de renderização no lugar do efeito

```tsx
export default function LandingPage() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // ↓↓↓ A MUDANÇA: nenhum hook depois destes returns.

  if (loading) {
    // 1º caso: auth ainda resolvendo → NÃO pinta a landing, mostra spinner
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (user) {
    // 2º caso: logado → redireciona ANTES de pintar qualquer coisa da landing
    return <Navigate to="/home" replace />
  }

  // 3º caso: visitante de verdade → a landing pode pintar à vontade
  return ( /* ...toda a landing... */ )
}
```

Por que resolve:

- **`if (user) return <Navigate .../>`** — o redirect acontece no render/commit,
  **antes do paint**. O navegador nunca desenha a landing para quem é logado.
  É o mesmo padrão exato do `ProtectedRoute` (que nunca teve esse bug porque já
  usava `<Navigate>`).
- **`if (loading) return spinner`** — fecha o caso do **primeiro load caindo
  direto em `/`**: enquanto a sessão é verificada, não mostramos a landing para
  ninguém (nem logado, nem anônimo). Sem isso, um usuário logado no primeiro
  acesso a `/` veria a landing durante o loading antes do `Navigate` disparar.
- Regra dos hooks preservada: os `useEffect` ficam todos **antes** dos returns
  condicionais, então a ordem dos hooks nunca muda entre renders.

### 4.2 Breadcrumb.tsx — a casinha vai para onde o usuário logado quer ir

```tsx
<Link to="/home" className="hover:text-foreground transition-colors shrink-0">
  <Home size={14} />
</Link>
```

O ícone de casa dentro do app (protegido) não devia apontar para a landing
pública — devia apontar para o "início" de quem está logado, que é `/home`.
Isso elimina o caminho nº 1 de navegação acidental para `/`.

### 4.3 E o caminho "voltar do navegador"?

Mesmo que o usuário ainda caia em `/` pelo histórico, a correção 4.1 o
absorve: logado + `/` → `<Navigate>` instantâneo, sem flash. E como o
`Navigate` usa `replace`, o histórico nem guarda a passagem por `/`.

---

## Parte 5 — Checklist de reconhecimento (quando suspeitar do mesmo bug)

| Se você vê... | Provável causa | Onde olhar |
|---|---|---|
| Tela antiga "piscando" ao trocar de rota | Navegação em `useEffect` (pós-paint) | Trocar por `<Navigate>` no render |
| Página pública aparecendo para quem está logado | Redirect em `useEffect` na página pública | Mesma correção: gate no render |
| "Por trás" ao navegar | Rota anterior ainda pintando antes do efeito | Refatorar redirect para render-time |
| Bug intermitente, sem erro no console | Algo dependente de timing (lazy/network) | Caçar a sequência render→paint→effect |
| Link leva usuário logado à tela "errada" | Link apontando para rota pública | Conferir `to=` de cada `Link`/`navigate` |

---

## Parte 6 — As lições que valem ouro

1. **Redirect que precisa ser invisível = no render (`<Navigate>`), nunca no
   `useEffect`.** O `useEffect` roda depois do paint — qualquer coisa que ele
   "desfaz" já foi mostrada por 1 frame. `ProtectedRoute` já fazia certo; a
   landing fazia errado. O padrão do projeto, agora, é um só.
2. **O navegador só desenha o que está no DOM.** Se "aparece por trás", é
   porque aquilo ESTAVA no DOM. Rastreie quando aquela rota foi montada.
3. **Bug intermitente = timing.** "De vez em quando" quase sempre aponta para
   algo não-determinístico (lazy chunk, rede, auth). Não procure erro no
   console — procure a SEQUÊNCIA de eventos (render → commit → paint → effect).
4. **Eliminação > especulação.** Para cada hipótese, faça a pergunta que a
   mata: "o caminho X chega a montar a rota Y?". Refrescar `/cronograma` NÃO
   monta a landing — isso está garantido pela estrutura de rotas, não por sorte.
5. **`replace` no redirect evita poluir o histórico** e impede o "voltar" de
   reabrir a tela intermediária.

---

## Parte 7 — Para fixar (exercícios)

1. Abra `src/pages/Landing/Landing.tsx` e explique, com suas palavras, por que
   o `if (user) return <Navigate .../>` evita o flash que o `useEffect`
   antigo não evitava.
2. No `ProtectedRoute.tsx`, o redirect para `/login` também é feito com
   `<Navigate>`. Por que ele nunca sofreu deste bug? (Dica: onde está o
   `Navigate`? No render, antes ou depois do paint?)
3. **Pense**: e se o usuário clicar no botão "voltar" e cair em `/`?
   Explique por que agora ele NÃO vê a landing (dica: o `Navigate` roda no
   render + usa `replace`).
4. Abra `src/routes/index.tsx`. Liste as rotas públicas e as protegidas. Qual
   delas é a única que pode renderizar para um usuário logado sem passar pelo
   `ProtectedRoute`? (Resposta: `/` — por isso ela precisava do gate próprio.)
5. Simule no DevTools: sem a correção, adicione um `setTimeout` de 2s no
   efeito antigo e observe o flash. Depois troque para `<Navigate>` e veja a
   diferença. (Exercício mental, se não quiser editar o código.)

---

## Links para continuar

- **`docs/03-arquitetura.md`** — rotas públicas vs protegidas, lazy loading.
- **`docs/06-fluxos-frontend.md`** — fluxo de navegação e o mapa de páginas.
- **`docs/12-decisoes-alternativas.md`** — decisão D18 (redirect render-time).
- **`estudos/04-render-perf.md`** — render, commit, paint e lazy loading a fundo.
- **`estudos/02-react.md`** — `useEffect`, ciclo de vida e regras dos hooks.
- **`estudos/17-estudo-de-caso.md`** — a parte 1 da saga (o método do caçador).
