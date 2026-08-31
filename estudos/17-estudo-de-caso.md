# 17 — Estudo de caso: a saga da semana em que o PostUp não funcionava

> **Objetivo**: usar UM problema real de várias camadas como laboratório. Este
> estudo reconta, passo a passo, o que aconteceu no PostUp quando o login mentia,
> o celular ficava com tela branca e o deploy não subia — e transforma cada
> bug em uma lição de como a web funciona. Nada aqui é assumido: cada termo é
> explicado na primeira vez que aparece.

## Como ler este estudo (mapa do passeio)

Este é um material para **estudar devagar**. A ordem importa: cada parte
constrói o vocabulário da parte seguinte. Você verá três padrões repetidos o
tempo todo:

1. **O sintoma** — o que o usuário (ou você) vê na tela.
2. **O conceito** — o pedaço da web que está por trás daquele sintoma.
3. **A correção** — o que foi mudado no código e POR QUE aquilo resolve.

Toda vez que aparecer um termo em **negrito**, ele é explicado logo em seguida,
na prática, com uma analogia. Todo trecho de código tem um comentário explicando
"o que está acontecendo" linha por linha.

**O mapa da saga** (é bom imprimir isso mentalmente):

```
Bug 1 ─ login mentia sobre a senha      → causa: HTTP + edge function + captcha
Bug 2 ─ celular ficava com tela branca  → causa: WebSocket + init de módulo
Bug 3 ─ o deploy não subia              → causa: GitHub Actions + Vercel + secrets + env
```

Cada bug parecia ser "um problema diferente", mas todos são o MESMO tipo de
erro: **a resposta de um sistema sendo interpretada errado por outro sistema**.
Guarde essa frase, ela é a tese do estudo inteiro.

---

## Parte 0 — O palco: onde cada peça do PostUp vive

Antes de qualquer bug, você precisa saber quais "prédios" existem nesse projeto.
Se você já sabe, pule para a Parte 1 — mas ler rápido não faz mal.

### Frontend (o navegador)

O PostUp é um app **React** com **Vite**. "React" é uma biblioteca que desenha
interfaces: cada tela é uma função que recebe dados e devolve HTML. "Vite" é a
ferramenta que pega todo esse código TypeScript e transforma em arquivos `.js`
minificados (espremidos para carregar rápido) que o navegador baixa.

Na prática: quando alguém abre `postupapp.vercel.app`, o navegador baixa um
arquivo `index.html` + alguns `.js`/`.css`. Todo o "app" roda DENTRO do
navegador. O servidor só entrega os arquivos.

### Supabase (o "backend pronto")

O PostUp não tem um servidor próprio. Ele usa o **Supabase**, um serviço que
dá, de graça (num plano), o que normalmente você construiria à mão:

- **Banco de dados PostgreSQL**: onde ficam clientes, posts, feedbacks.
- **Auth**: login, cadastro, sessão, confirmação por e-mail.
- **Storage**: onde ficam as imagens.
- **Edge functions**: funções pequenas que rodam "na borda" (perto do usuário)
  quando alguém faz uma requisição HTTP.

Na prática: o navegador conversa direto com o Supabase usando **HTTP** (o
protocolo da web — você "liga para uma URL", pede algo, recebe uma resposta).
O navegador manda `fetch('https://...supabase.co/...')` e recebe um JSON de
volta.

### Cloudflare Turnstile (o captcha)

**Captcha** é aquele desafio "prove que você é humano" (marque a caixa, resolva
um quebra-cabeça). O **Turnstile** é o captcha da Cloudflare: ele roda no
navegador, detecta se tem robô, e entrega um **token** — um pedacinho de texto
criptografado que é a "prova" de que passou na verificação.

Na prática: é um bilhete de uma vez só. O navegador mostra o widget, o widget
gera um `token`, e o seu servidor precisa **conferir esse token na Cloudflare**
antes de confiar nele. Se você não conferir, um robô pode forjar o bilhete.

### A edge function (o "conferidor de bilhete")

A conferência do token não pode ser feita pelo navegador (ele não pode esconder
a chave secreta). Por isso existe a edge function `verify-turnstile` no
Supabase: uma função que recebe o token via HTTP, pergunta para a Cloudflare
"esse bilhete é válido?" e responde sim ou não.

### Vercel (onde o site mora) e GitHub Actions (o empregado)

- **Vercel** hospeda o site. "Hospedar" = guardar os arquivos e entregá-los
  quando alguém acessa a URL. A Vercel também pode **construir** o site
  (rodar o build do Vite).
- **GitHub Actions** é um "empregado" que executa tarefas automáticas quando
  você envia código para o GitHub. Ele roda **workflows** (receitas em YAML).
- **Deploy** = publicar uma nova versão do site. "O deploy subiu" = a versão
  nova foi para o ar.

---

## Parte 1 — Bug 1: "a senha está incorreta" que não era a senha

### 1.1 O sintoma

O usuário abria o app no celular, digitava e-mail e senha CORRETOS, resolvia o
captcha... e recebia:

> "A senha está incorreta. Tente novamente."

Não era verdade. A senha estava certa. E pior: o mesmo app, no mesmo dia, às
vezes entrava. Depois não entrava mais. Um erro que "aparece e some" é o
primeiro sinal de que a mensagem que você vê **não é a causa real** — é um
sintoma de outra coisa acontecendo antes.

### 1.2 Os conceitos que você precisa primeiro

**HTTP** é o protocolo de comunicação da web. Toda comunicação HTTP tem:
- Um **método** (`POST` para enviar dados, `GET` para buscar).
- Uma **URL** (para onde).
- Um **corpo** (o conteúdo, geralmente JSON).
- Uma **resposta** do servidor, que tem um **status code** (código de status).

**Status codes** são números de três dígitos que dizem "o que aconteceu" com o
pedido. Pense neles como a cara do garçom ao responder seu pedido:

- **2xx (200, 204)** — "Deu certo, aqui está o que você pediu."
- **4xx (400, 401, 404, 405)** — "Você errou algo no pedido" (400 = pedido mal
  formado; 405 = método não permitido).
- **5xx (500)** — "O restaurante quebrou, problema é nosso."

Regra de ouro para quem programa: **2xx significa "chegou e processei"**.
Qualquer coisa fora disso significa "não deu certo" — e sistemas que automatizam
a comunicação geralmente JOGAM FORA o corpo da resposta quando não é 2xx. Esse
detalhe é o coração do Bug 1.

**JSON** é o formato de dados da web: texto com chaves e valores, ex.:
`{"success": false, "error": "timeout-or-duplicate"}`.

**Edge function**: como você viu na Parte 0, é uma função que roda "na borda" e
responde a requisições HTTP. Ela é o "conferidor de bilhete" do captcha.

**`supabase.functions.invoke`**: é o jeito que o app (no navegador) usa para
chamar uma edge function. Na prática: manda um `POST` e espera a resposta.

### 1.3 Como estava o código (a versão com o bug)

A edge function `supabase/functions/verify-turnstile/index.ts` fazia o seguinte
(simplificado — abra o arquivo real para ver o detalhe completo):

```ts
// ANTES (com bug) — comportamento resumido
if (!outcome.success) {
  return new Response(JSON.stringify({
    success: false,
    error: 'timeout-or-duplicate',   // ← o motivo REAL da falha estava aqui
  }), {
    status: 400,                     // ← o problema: status 400
  })
}
```

E no app, o navegador chamava assim (`src/hooks/use-auth.tsx`):

```ts
const { data, error } = await supabase.functions.invoke('verify-turnstile', {
  body: { token },
})
if (error) return { error: 'Falha na verificação de segurança...', code: 'turnstile_failed' }
```

### 1.4 A lógica do bug (o que estava acontecendo de verdade)

Siga a cadeia, passo a passo:

1. O usuário resolve o captcha e o app envia o `token` para a edge function.
2. A edge function pergunta à Cloudflare se o token é válido.
3. A Cloudflare responde "não" (ex.: o token expirou — isso acontece às vezes,
   é normal).
4. A edge function monta a resposta com o motivo (`error: 'timeout-or-duplicate'`)
   **mas marca o status como `400`**.
5. O `supabase.functions.invoke` vê que não é 2xx. Regra do cliente: **não-2xx =
   erro** → ele joga o corpo no lixo e devolve `{ data: null, error: {...} }`.
6. No app, `data` fica `undefined`. O `if (error)` dispara e devolve a mensagem
   genérica `'Falha na verificação de segurança...'`.
7. O `Login.tsx` recebe esse erro genérico, e o fluxo cai no `else`:
   `'A senha está incorreta. Tente novamente.'`

Ou seja: **a mensagem que o usuário via ("senha incorreta") não tinha nada a ver
com a senha.** O motivo real (token expirado) foi destruído no passo 5 — o
protocolo HTTP "não-2xx = erro" engoliu a informação.

A analogia: você manda um mensageiro ao restaurante pedir um prato. O restaurante
não tem o prato e anota no papelzinho "prato esgotado". O mensageiro foi
treinado para rasgar QUALQUER bilhete vermelho sem ler, e volta dizendo "não
tem comida" — e a recepção traduz isso como "você digitou o pedido errado".
A informação boa (o motivo) morreu no caminho porque a cor do papel (o status)
mandou descartar.

**Regra prática que você deve gravar**: se você quer passar informações na
resposta que o FRONTEND vai ler, devolva **HTTP 200** e ponha o resultado no
corpo (`{ success: true }` / `{ success: false, error: '...' }`). Use status
`4xx`/`5xx` para quando o próprio HTTP não precisar ser processado (ou quando
você confia que o cliente lê o corpo mesmo em erro). Muitas APIs — inclusive a
do Supabase — descartam o corpo em não-2xx.

### 1.5 Como ficou o código (a correção)

```ts
// DEPOIS (corrigido) — parte relevante da edge function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })  // CORS
  }
  // ... (valida token, chama Cloudflare)
  if (!outcome.success) {
    return json({ success: false, error: outcome['error-codes']?.join(', ') || 'Verification failed' })
    //                          ↑ status 200 agora! O corpo chega inteiro ao app.
  }
  return json({ success: true })
})
```

E no app, `Login.tsx` passou a tratar o `code` de forma explícita:

```ts
if (result.code === 'email_not_confirmed') {
  setError('Seu email ainda não foi confirmado. Verifique sua caixa de entrada...')
} else if (result.code === 'turnstile_failed') {
  setError(result.error ?? 'Não foi possível concluir a verificação de segurança. Tente novamente.')
  // ↑ agora o erro REAL do captcha chega ao usuário, não a "senha incorreta"
} else {
  // só aqui sim: o erro de senha de verdade
}
```

### 1.6 Os dois problemas escondidos (que apareceram depois)

Corrigir o status 400 não bastou — o bug tinha mais duas camadas, ambas do tipo
"a resposta sendo interpretada errado":

**Escondido 1 — falta de `Content-Type: application/json`.**

O `Content-Type` é um **header** (cabeçalho) da resposta HTTP que diz "o corpo
é JSON". Sem ele, o cliente do Supabase (`functions-js`) não sabe o formato e
devolve o corpo como **texto** — então `data.success` (acessar uma propriedade
do objeto) vira `undefined`, porque `data` é uma string, não um objeto.

Na prática: você pede um bolo, recebe uma caixa sem etiqueta; sem a etiqueta
("bolo"), você não sabe se abre esperando um bolo ou um sapato. O `Content-Type`
é a etiqueta. A correção foi centralizar na função `json()` que SEMPRE manda
`{ 'Content-Type': 'application/json', ...corsHeaders }`.

**Escondido 2 — CORS (Cross-Origin Resource Sharing).**

O navegador tem uma regra de segurança: o JavaScript de um site (`postupapp.vercel.app`)
só pode ler respostas de uma origem diferente (a URL do Supabase) se o servidor
dessa origem **autorizar explicitamente**. Antes de uma requisição "complicada",
o navegador manda um **preflight**: um `OPTIONS` de teste perguntando "posso
chamar você?". Se o servidor não responder a esse teste, o navegador BLOQUEIA a
requisição inteira com "Failed to fetch".

Na prática: a edge function não tratava `OPTIONS` e respondia `405 Method not
allowed` → o navegador bloqueava → o app via "Failed to fetch" → o erro virava
a mensagem genérica de captcha (de novo, um sintoma no lugar da causa). A
correção foi responder `OPTIONS` com `204` + os headers `Access-Control-Allow-*`
(listando quem pode, quais métodos, quais cabeçalhos).

### 1.7 Como reconhecer esse problema (sinais)

- A mensagem de erro que o usuário vê **não corresponde à ação que ele fez**
  (digitou senha certa e veio "senha incorreta").
- O erro **aparece e some** (depende do motivo real, ex.: token de captcha que
  expira).
- No console do navegador você vê "Failed to fetch" ou `data` como `undefined`.
- Você chama a URL da edge function direto (Postman/curl) e ela responde com
  status 4xx em vez de 200 + corpo.

### 1.8 Como agir

1. **Leia o corpo da resposta**, não só o status. Chame a função com `curl` e
   veja o que ela responde em cada caso.
2. **Garanta que a resposta tem `Content-Type: application/json`**.
3. **Trate `OPTIONS`** (CORS) se o navegador for chamar de outro domínio.
4. **Prefira `200 + success:false`** para erros que o frontend precisa ler.
5. Escreva um **teste** que simule a falha e confirme que a mensagem certa
   chega ao usuário (o PostUp tem `Login.test.tsx` para isso).

---

## Parte 2 — Bug 2: tela branca no celular (o WebSocket que não existia)

### 2.1 O sintoma

O usuário entrava (agora o login funcionava!) e... nada. A tela ficava
**completamente branca** em todas as páginas, inclusive acessando direto pela
URL. Sem mensagem de erro visível. É o sintoma mais assustador de todos: parece
que o site quebrou por inteiro.

Tela branca = **o JavaScript morreu antes de conseguir desenhar qualquer coisa**.
O app não renderizou nem o rodapé de "algo deu errado". O código nem chegou a
executar o React direito.

### 2.2 Os conceitos que você precisa primeiro

**WebSocket**: protocolo de comunicação que abre uma **conexão contínua** entre
navegador e servidor (os dois podem falar a qualquer momento, sem precisar
reconectar). O app usa isso para o **realtime** (feedbacks chegando ao vivo).
Contraste com HTTP normal, que é "liga, pede, desliga".

**`supabase.channel(...).subscribe()`**: o jeito de pedir atualização em tempo
real. "Channel" = um canal. "Subscribe" = assinar aquele canal para receber
eventos. Internamente, o Supabase abre um WebSocket para isso.

**Navegadores sem WebSocket**: alguns navegadores antigos e certas **WebViews**
(o navegador interno de apps/Android mais antigos) não têm o objeto `WebSocket`.
Não é "WebSocket quebrado" — é "WebSocket não existe ali".

**Module init (inicialização do módulo)**: quando o navegador carrega o bundle,
ele executa o código no topo de cada arquivo, na ordem dos `import`. `supabase.ts`
tem `createClient(...)` no topo. Se isso lançar erro, o arquivo inteiro (e quem
o importa) nunca carrega.

**`createClient`**: a função do Supabase que cria o objeto `supabase` (a
"caneta" que o app usa para falar com o banco). Ela, internamente, também prepara
o realtime — e, em versões novas, verifica se existe WebSocket **na hora de
criar o cliente**, não na hora de assinar o canal.

**Erro síncrono**: erro que acontece na hora, no mesmo "turno" de execução.
Dá para pegar com `try/catch`. **Erro assíncrono**: acontece depois, numa
promise/callback — `try/catch` NÃO pega.

**`try/catch`**: o "rede de proteção" do JavaScript. Você tenta `try { ... }`
e, se algo lançar erro, o `catch { ... }` executa em vez de derrubar tudo.

**ErrorBoundary** (no React): um componente que "pega" erros de renderização
dos filhos e mostra uma tela de erro bonitinha em vez de tela branca.

**`useEffect`**: o lugar no React onde você roda efeitos colaterais (buscar
dados, assinar canal) depois que o componente aparece na tela.

### 2.3 A primeira camada do problema (o que já tínhamos corrigido)

Numa fase anterior, o crash era simples: as páginas e hooks chamavam
`supabase.channel(...).subscribe()` **direto** no `useEffect`. Em navegador sem
WebSocket, `.subscribe()` lançava erro síncrono → o ErrorBoundary pegava →
tela de erro. A correção foi um helper que pega o erro e segue a vida:

```ts
// src/lib/realtime.ts — DEPOIS (corrigido)
export function subscribeRealtime(build: () => RealtimeChannel): RealtimeChannel | null {
  try {
    const channel = build()        // cria o canal + subscribe
    channel.subscribe()
    return channel
  } catch (err) {
    console.warn('[realtime] indisponível neste navegador; sem atualizações ao vivo.', err)
    return null                    // SEM CRASH: devolve null e o app segue
  }
}
```

E todos os chamadores passaram a tratar o `null`:

```ts
const channel = subscribeRealtime(() =>
  supabase.channel('notifications').on('postgres_changes', {...}, () => {...}).subscribe()
)
return () => { if (channel) supabase.removeChannel(channel) }
```

Isso corrigiu os erros que aconteciam **dentro do `useEffect`**. Mas o usuário
ainda via tela branca. Por quê? Porque o crash real não estava ali — estava
**antes**, na inicialização do módulo.

### 2.4 A camada invisível: `createClient` lança no init

Quando o navegador carregava o app, ANTES de qualquer componente, este código
rodava:

```ts
// src/lib/supabase.ts — como estava
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

O `createClient` (versões novas do `@supabase/supabase-js`) procura o WebSocket
**na hora de criar o cliente** e, se não acha, lança:

```
Error: Unknown JavaScript runtime without WebSocket support.
  Suggested solution: Ensure you're running in a supported environment
  (browser, Node.js, Deno) or provide a custom WebSocket implementation.
```

Onde exatamente? No arquivo `websocket-factory.js` do pacote:
`transport: options?.transport ?? WebSocketFactory.getWebSocketConstructor()`.
Traduzindo: "se você não me disse qual transporte usar, eu procuro o WebSocket
do ambiente; se não tem, eu lanço erro."

A pegadinha fatal: esse erro acontece no **`import` do módulo**, que roda antes
de tudo — inclusive antes do ErrorBoundary e antes de qualquer `try/catch` do
`useEffect`. Um `try/catch` no `subscribeRealtime` NUNCA poderia pegar isso,
porque a função nem chegou a ser chamada: o arquivo que a contém nem carregou.

A analogia: é como se o prédio desabasse na fundação, não no 10º andar. Você
comprou redes de proteção para as janelas do 10º andar (o ErrorBoundary, o
try/catch do subscribe), mas o problema é que o concreto do térreo não curava.
Tudo desabou na fundação.

### 2.5 A correção: um transporte de emergência

A solução tem dois passos no `src/lib/supabase.ts`:

```ts
// src/lib/supabase.ts — DEPOIS (corrigido)

// Um "WebSocket de mentira": existe, não conecta, não quebra.
class NoopWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  readyState = NoopWebSocket.CLOSED
  binaryType = ''
  onopen: ((event?: unknown) => void) | null = null
  onerror: ((event?: unknown) => void) | null = null
  onmessage: ((event?: unknown) => void) | null = null
  onclose: ((event?: unknown) => void) | null = null

  constructor(public url: string, public protocols?: string | string[]) {}

  send(): void {}      // não faz nada
  close(): void {}     // não faz nada
}

// "Se existe WebSocket de verdade, usa ele. Se não, usa o de mentira."
const realtimeTransport =
  typeof WebSocket !== 'undefined' ? WebSocket : (NoopWebSocket as unknown as typeof WebSocket)

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { transport: realtimeTransport },   // ← o seguro-de-vida
})
```

A lógica:

1. `typeof WebSocket !== 'undefined'` é uma **verificação de ambiente**: "o
   navegador deste usuário TEM o objeto WebSocket?".
2. Se tem → passamos o WebSocket de verdade (comportamento normal).
3. Se não tem → passamos o `NoopWebSocket`. O `createClient` vê que recebeu um
   transporte e **não lança erro**. Quando alguém tentar assinar um canal, o
   `NoopWebSocket` será instanciado, receberá os `onopen/onmessage/...` e... nada
   acontecerá. O canal fica "conectando" para sempre, silenciosamente. Sem
   crash, sem mensagem estranha — o app funciona, só não tem atualização ao vivo
   (que é perfeitamente aceitável para o usuário).

**Por que isso é robusto**: você não conserta o navegador do usuário (não pode);
você conserta a SUA reação à falta de WebSocket. Em vez de "morrre", o app diz
"ok, sem tempo real, segue o jogo".

### 2.6 Como descobrimos (o método, que vale ouro)

Não dava para reproduzir "o celular do usuário" no computador. A solução foi
**simular o ambiente dele**: um navegador headless (sem janela) com o WebSocket
removido. O Playwright (ferramenta de automação de navegador) permite injetar
código antes do site rodar:

```js
// simula um navegador que não tem WebSocket (o caso do celular antigo)
await ctx.addInitScript(() => {
  Object.defineProperty(window, 'WebSocket', { value: undefined, configurable: true })
})
```

Então carregamos cada página e **capturamos os erros de console e de página**:

```js
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
```

O primeiro teste mostrou `Invalid supabaseUrl` (outro problema, Parte 3). Depois
de corrigir, o teste com `WebSocket = undefined` mostrou:
`Unknown JavaScript runtime without WebSocket support` — **o erro real do
celular**, reproduzido no computador em 30 segundos. Daí, a correção foi direta.

**Lição**: quando um bug só aparece num dispositivo que você não tem, não
adivinhe — **emule**. Navegador headless + remover WebSocket + capturar erros
é um laboratório portátil.

### 2.7 Como reconhecer esse problema (sinais)

- Tela branca em TODAS as rotas, inclusive no login.
- Só em celulares/WebViews antigas; no desktop funciona.
- Console do dispositivo mostra `Unknown JavaScript runtime without WebSocket
  support` (ou um `ReferenceError: WebSocket is not defined`).
- O erro acontece ANTES de qualquer tela — logo no load.

### 2.8 Como agir

1. **Reproduza** emulando o ambiente sem WebSocket (Playwright/Puppeteer +
   `addInitScript`).
2. **Veja onde o erro nasce**: é no `createClient` (init) ou no `.subscribe()`
   (useEffect)? Isso muda a correção.
3. Se for no `createClient`: forneça um `transport` de fallback (o `NoopWebSocket`).
4. Se for no `.subscribe()`: envolva em `try/catch` (o `subscribeRealtime`).
5. **Trate os dois**, porque navegadores sem WebSocket quebram nos dois pontos.
6. Escreva um teste que não deixe isso voltar (o PostUp tem `supabase.test.ts`
   e `use-notifications.test.tsx`).

---

## Parte 3 — Bug 3: o deploy que não subia (GitHub Actions + Vercel)

### 3.1 O sintoma

Cada envio de código para a branch `production` deixava o GitHub Actions
**vermelho** (falha), com mensagens que mudavam a cada tentativa:

1. `Input required and not supplied: vercel-token`
2. `Unrecognized named-value: 'secrets'`
3. `Could not retrieve Project Settings`
4. `Error: User not found`
5. E o pior: o deploy "dava certo" mas o site no ar estava quebrado (a tela
   branca da Parte 2!), porque as variáveis de ambiente vinham mascaradas.

Deploy falho é uma cascata de pequenos problemas. Vamos por cada um, com os
conceitos primeiro.

### 3.2 Os conceitos que você precisa primeiro

**Workflow** (GitHub Actions): um arquivo YAML que descreve uma receita
automatizada. Exemplo do PostUp, `.github/workflows/deploy.yml`:

```yaml
name: Deploy Production
on:
  push: { branches: [production] }   # roda quando envia para production
  workflow_dispatch:                  # OU quando alguém clica em "Rodar manualmente"
jobs:
  deploy:
    runs-on: ubuntu-latest            # roda numa máquina virtual limpa
    steps:
      - uses: actions/checkout@v4     # baixa o código
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run build
      - name: Deploy to Vercel
        env: { ... }                  # variáveis de ambiente do passo
        run: |                        # comandos shell que rodam o deploy
          npx vercel@latest deploy --prod --yes --token="$VERCEL_TOKEN"
```

Peças:
- **`runner`**: a máquina virtual onde o workflow roda. Cada `run` é um comando
  shell executado nela.
- **`step`**: cada bloco (`uses` ou `run`). Se um falha, o passo fica vermelho
  e o workflow para.
- **`exit code`**: o código que um comando devolve ao terminar. `0` = sucesso;
  qualquer outro = falha. O GitHub Actions marca o passo como falho quando o
  comando devolve exit code diferente de 0.
- **Secrets**: valores secretos do repositório (Settings → Secrets). Existem
  para não colocar senhas no código. No YAML, você os injeta com
  `${{ secrets.NOME }}`.
- **`env:`**: variáveis de ambiente do passo — o shell do passo lê
  `$VERCEL_TOKEN`, `$VERCEL_ORG_ID`, etc.
- **`if:`**: condição em YAML para rodar ou pular um passo.

**Token**: uma "senha de API" que autoriza uma ferramenta a agir em seu nome.
O `VERCEL_TOKEN` autoriza o CLI da Vercel a fazer deploy. Um token aponta para
uma **conta** específica.

**Conta vs Time vs Projeto (na Vercel)**:
- **Conta** (user): você, pessoa física. Tem um ID `usr_...`.
- **Team** (time): "Ezequiel's projects" — um agrupamento que pode ter várias
  contas. Tem um ID `team_...` e um slug (`ezequiels-projects-cd16ed22`).
- **Projeto**: `postup`. Tem um ID `prj_...`.

**Env vars (variáveis de ambiente)**: configurações que o build pode ler, como
`VITE_SUPABASE_URL`. No Vite, só variáveis com prefixo `VITE_` vão para o
bundle do navegador.

**Cloud build vs prebuilt**:
- **Prebuilt**: você constrói na sua máquina (ou no runner) e só ENVIA os
  arquivos prontos para a Vercel publicar. Rápido, mas usa SUAS env vars.
- **Cloud build**: você envia o código-fonte e a Vercel constrói na nuvem, com
  AS ENV VARS DO PROJETO na Vercel. Mais lento, mas "do jeito certo".

### 3.3 Bug 3.1 — Secrets no `if:` invalidava o workflow inteiro

O workflow tinha um passo com:

```yaml
if: ${{ secrets.VERCEL_TOKEN != '' }}   # ← PROBLEMA
```

E o GitHub respondia:

```
Unrecognized named-value: 'secrets'
```

**O que aconteceu na prática**: o GitHub Actions **não permite** usar `secrets`
dentro de `if:` (só permite em `env:` e em lugares específicos). E o pior: um
erro de sintaxe assim **invalidava o workflow inteiro** — nem o CI rodava.

**A correção**: os secrets vão apenas em `env:`, e a checagem de "existe ou
não" acontece no **shell** (com `if` de bash), não no YAML:

```yaml
env:
  VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
run: |
  if [ -z "$VERCEL_TOKEN" ]; then
    echo "::warning::Secret não configurado. Deploy pulado."
    exit 0          # exit 0 = "sucesso de propósito" para não deixar vermelho
  fi
  npx vercel@latest deploy --prod --yes --token="$VERCEL_TOKEN"
```

**Lição**: quando um valor do YAML é mencionado num lugar que o GitHub não
aceita, o workflow inteiro morre. Coloque secrets em `env:` e faça a lógica no
shell. `exit 0` permite "pular educadamente" sem falhar.

### 3.4 Bug 3.2 — Org ID da conta pessoal em vez do ID do time

Sintoma:

```
Error: Could not retrieve Project Settings.
  To link your Project, remove the `.vercel` directory and deploy again.
```

**O que aconteceu na prática**: o secret `VERCEL_ORG_ID` estava com o ID da
**conta pessoal** (`usr_...`) em vez do ID do **time** (`team_...`). O projeto
`postup` mora no time "Ezequiel's projects". O CLI perguntou "me dá as
configurações do projeto X da conta Y?" e a conta pessoal não tem esse projeto
→ erro.

**Como descobrimos**: pedimos à API da Vercel, com o token local, para listar
os times e projetos:

```powershell
# times
GET https://api.vercel.com/v2/teams
# → ezequiels-projects-cd16ed22 => team_weVAbkMAs9l9Kf3FyCpKPJva

# projetos do time
GET https://api.vercel.com/v9/projects?teamId=team_weVAbkMAs9l9Kf3FyCpKPJva
# → postup => prj_I1CeiEM20AGkLcqCmYdtVXDqmeHv
```

Aí confirmamos os IDs corretos: `team_weVAbkMAs9l9Kf3FyCpKPJva` e
`prj_I1CeiEM20AGkLcqCmYdtVXDqmeHv`, e atualizamos os secrets.

**Lição**: não confie no que "achou que era" — consulte a fonte (a API/dashboard)
e compare. Erros de copiar ID errado são comuns e silenciosos.

### 3.5 Bug 3.3 — Token inválido ("Error: User not found")

Sintoma (apareceu no log do passo de deploy):

```
> vercel whoami --token=...
Error: User not found.
```

**O que aconteceu na prática**: o `VERCEL_TOKEN` do GitHub não pertencia a
nenhuma conta (apagado, expirado ou copiado errado). `whoami` (quem sou eu?)
retornou "usuário não encontrado" — ou seja, o token não mapeia para ninguém.

**Como descobrimos**: adicionamos temporariamente `npx vercel whoami` no início
do passo de deploy para o log mostrar quem era o dono do token. Resposta:
`Error: User not found`.

**A correção**: o usuário criou um **novo token de Full Access** na conta certa
(vercel.com → avatar → Settings → Tokens) e atualizou o secret `VERCEL_TOKEN`.

**Lição**: um token tem dono, escopo e validade. Quando uma ferramenta diz
"autenticação falhou", teste o token isoladamente (`vercel whoami --token=...`)
antes de mexer em qualquer outra coisa.

### 3.6 Bug 3.4 — o pior: env mascarada quebrava o bundle (silencioso)

Este foi o mais traiçoeiro. O deploy **dava verde**, mas o site no ar estava
com tela branca.

**Sintoma no site**: `Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.`
(era o mesmo sintoma da Parte 2, mas por OUTRA causa).

**Como descobrimos**: inspecionamos o bundle de produção procurando a URL real
do Supabase (`vhgbxvpjsvtkjmlkjkvm`) — e ela NÃO estava lá. Em vez disso, o
valor embutido era literalmente a string `[SENSITIVE]`.

**O que aconteceu na prática**:

1. O workflow rodava `npx vercel pull` para baixar as env vars do projeto. 
2. As env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `VITE_TURNSTILE_SITE_KEY` estão marcadas como **"Sensitive"** no dashboard
   da Vercel.
3. Para não vazar segredo, o `vercel pull` **mascara** os valores: escreve
   `VITE_SUPABASE_URL="[SENSITIVE]"` no arquivo `.env.production.local`.
4. O build (`vercel build`) leu esse arquivo e **embutiu a string literal
   `[SENSITIVE]`** como URL do Supabase no bundle.
5. No navegador, `createClient("[SENSITIVE]", ...)` → não é uma URL válida →
   lança `Invalid supabaseUrl` → **tela branca** em todas as rotas.

Ou seja: o deploy "funcionou", mas entregou um produto quebrado, porque o build
usou uma variável mascarada. Esse é o pior tipo de bug: **o sistema não te avisa
que deu errado — ele te entrega um resultado errado com cara de certo**.

**Verificação útil (o truque do hash)**:
- `index.html` de produção aponta para `assets/index-<hash>.js`. O hash muda a
  cada build.
- Para conferir se as envs entraram: baixar o bundle e procurar a URL real do
  Supabase (`supabase.co` / o ref do projeto).
- Cuidado com **marcadores que a minificação apaga**: strings de `console.warn`
  NÃO sobrevivem ao build (o minificador remove `console.*` em produção).
  Não use mensagem de log como "prova de que o fix subiu".

**A decisão de correção**: trocamos o deploy de **prebuilt** para **cloud
build**:

```bash
# ANTES (prebuilt — usava env local, que vinha mascarada)
npx vercel pull --yes --environment=production
npx vercel build --prod
npx vercel deploy --prebuilt --prod

# DEPOIS (cloud build — a Vercel usa AS ENV VARS REAIS do projeto)
npx vercel deploy --prod --yes
```

No cloud build, quem constrói é a Vercel, usando as env vars **reais** que estão
no Settings do projeto — não o arquivo baixado e mascarado. O problema simplesmente
deixa de existir.

**Lição**: um deploy verde **não prova** que o site está certo. Sempre verifique
o artefato que foi para o ar (o bundle, a URL, a tela). "CI passou" é a primeira
pergunta; "o produto está certo?" é a segunda — e elas são diferentes.

### 3.7 Como reconhecer e agir (resumo do Bug 3)

| Sintoma no GitHub | Causa provável | O que verificar |
|---|---|---|
| `Unrecognized named-value: 'secrets'` | `secrets` usado em `if:` | Mover para `env:` |
| `Could not retrieve Project Settings` | ORG_ID/PROJECT_ID errados | Conferir com a API do Vercel |
| `Error: User not found` | Token inválido | `vercel whoami --token=...` |
| Deploy verde mas site quebrado | Env mascarada / build com env errada | Procurar a URL real no bundle |

Ação em sequência:

1. Pegue o log real do passo falho (`gh run view <id> --log-failed`).
2. Isole a peça suspeita (token, IDs, env) e teste-a sozinha.
3. Depois de verde, **verifique a produção de verdade** (baixe o bundle e
   confira os valores; abra a tela).

---

## Parte 4 — O método do caçador (o processo que resolvemos tudo)

Se você re-olhar as Partes 1–3, todos os bugs foram resolvidos com o MESMO
método científico em 4 passos:

1. **Observe** o sintoma e registre a mensagem exata (não o "achismo").
2. **Formule uma hipótese** de qual peça está mentindo (resposta? status? env?).
3. **Teste a hipótese isolando a peça** (curl na função, emular sem WebSocket,
   `vercel whoami`, ler o bundle).
4. **Confirme** reproduzindo antes → corrigindo → confirmando depois.

Ferramentas usadas na saga (e como cada uma ajudou):

- **`curl` / chamada direta** na edge function → ver o corpo real da resposta.
- **Navegador headless (Playwright)** + `addInitScript` removendo `WebSocket` →
  reproduzir o celular sem ter o celular.
- **`gh run view <id> --log-failed`** → ver o passo exato que falhou e a
  mensagem real do runner.
- **`vercel whoami` / API de teams e projects** → confirmar dono do token, IDs
  do time e do projeto.
- **Ler o bundle de produção** (procurar a URL do Supabase, o hash) → saber o
  que REALMENTE foi para o ar.
- **Testes de regressão** (`supabase.test.ts`, `realtime.test.ts`,
  `use-notifications.test.tsx`) → impedir que os bugs voltem.

Três princípios que valem mais que qualquer ferramenta:

1. **Mude uma coisa por vez.** Tentamos corrigir 3 coisas de uma vez e não
   sabíamos qual funcionou. Corrigir uma, testar, repetir.
2. **Verifique o artefato final**, não o processo. O CI verde e a tela branca
   aconteceram juntos — o processo mentiu, o artefato disse a verdade.
3. **Não confie em marcador que a minificação apaga.** O build remove
   `console.*` e renomeia funções. Procure strings de UI ou a URL real.

---

## Parte 5 — Checklist de reconhecimento rápido

Use esta tabela quando você encontrar um problema "estranho" em qualquer
projeto:

| Se você vê... | Provavelmente é... | Onde olhar primeiro |
|---|---|---|
| Erro genérico substituindo o motivo real | Status não-2xx descartando o corpo | Resposta da API + `Content-Type` |
| "Failed to fetch" no console | CORS/preflight | Tratar `OPTIONS` no servidor |
| `data` undefined vindo de invoke | Falta `Content-Type: application/json` | Headers da resposta |
| Tela branca em tudo | Erro no init do módulo (ou env quebrada) | `createClient`, env vars, bundle |
| Tela de erro (não branca) ao assinar canal | Erro síncrono no `useEffect` | `try/catch` no subscribe |
| `Unknown JavaScript runtime without WebSocket` | Sem WebSocket no ambiente | `transport` de fallback |
| Workflow GitHub morre inteiro | Erro de sintaxe/YAML/secrets em `if:` | Validação do YAML, mover secrets para `env:` |
| `Could not retrieve Project Settings` | ID de org/projeto errado | API/dashboard da Vercel |
| `User not found` | Token inválido | `vercel whoami --token=...` |
| Deploy verde, site quebrado | Env mascarada/errada no build | Ler o bundle de produção |

---

## Parte 6 — As lições que valem ouro (para decorar)

1. **HTTP 2xx = "processei"**. Não-2xx = o cliente pode descartar o corpo.
   Quer que o frontend leia o motivo? Mande 200 + `{ success: false, error }`.
2. **Cada resposta precisa de etiqueta** (`Content-Type`) e de **permissão de
   origem** (CORS), senão o navegador bloqueia ou interpreta errado.
3. **Dois lugares quebram sem WebSocket**: o `createClient` (init) e o
   `.subscribe()` (useEffect). Corrija os dois.
4. **Um `try/catch` só pega erros síncronos do mesmo escopo**. Erro no import
   de módulo acontece antes de tudo — precisa de outra estratégia
   (transporte de fallback, ou nunca lançar no init).
5. **Deploy verde ≠ site certo**. Sempre confira o bundle real que foi pro ar.
6. **Secrets e IDs**: teste a peça isolada antes de culpar o workflow. Token →
   `whoami`; projeto → a API.
7. **A minificação é sua inimiga na hora de verificar**. Não procure
   `console.warn` no bundle; procure strings de UI ou valores reais.
8. **Bug intermitente ou "mentiroso" = sintoma de causa anterior.** Siga a
   cadeia até a origem, não trate o sintoma.

---

## Parte 7 — Para fixar (exercícios)

1. **Reconte o Bug 1** em suas palavras: por que o app mostrava "senha
   incorreta" quando o problema era o captcha? Qual linha da edge function foi
   mudada e qual foi o efeito em cadeia?
2. **Abra `supabase/functions/verify-turnstile/index.ts`** e aponte: onde está
   o CORS, onde está o `Content-Type`, e por que o `OPTIONS` responde `204`.
3. **Abra `src/lib/supabase.ts`** e explique por que o `NoopWebSocket` precisa
   ter `onopen/onmessage/onclose/send/close` mesmo que não faça nada.
4. **Abra `src/lib/realtime.ts`** e `src/hooks/use-notifications.ts`: por que o
   retorno `null` do `subscribeRealtime` exige o `if (channel)` no cleanup?
5. **Abra `.github/workflows/deploy.yml`**: identifique onde os secrets entram,
   onde a checagem acontece no shell, e por que usamos cloud build em vez de
   prebuilt.
6. **Experimente**: rode `npx vercel pull` e abra o `.vercel/.env.production.local`
   — você vai ver `[SENSITIVE]` para as vars marcadas como Sensitive. Explique
   por que o prebuilt quebraria o app.
7. **Simule**: no DevTools, remova `WebSocket` (`delete window.WebSocket`),
   recarregue o app e veja os erros. Depois aplique o fallback e repita.
8. **Bônus (raciocínio)**: se o `subscribeRealtime` pega o erro do `.subscribe()`
   com `try/catch`, por que ele NÃO pega o erro do `createClient`? (Resposta:
   o erro do createClient acontece no import, antes de qualquer função rodar —
   o try/catch nem existe ainda naquele momento.)

---

## Links para continuar

- **`docs/07-seguranca-web`** — o captcha, a edge function e o contrato de
  resposta em detalhe.
- **`docs/11-deploy-vercel`** — o deploy, os secrets e a armadilha do
  `[SENSITIVE]`.
- **`docs/10-testes-qualidade`** — como os testes de regressão desses bugs
  foram escritos.
- **`estudos/10-realtime`** — WebSocket, channels e tempo real a fundo.
- **`estudos/12-git-cicd`** — GitHub Actions, workflows e secrets.
- **`estudos/09-seguranca-web`** — CORS, headers e segurança de comunicação.
