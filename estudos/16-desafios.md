# 16 — Desafios práticos para mexer no código sozinho

> **Objetivo**: virar a chave de "consumidor" para "autor" — desafios reais que
> exercitam os conceitos dos capítulos anteriores, do mais simples ao mais ousado.
> Cada desafio tem: **meta**, **pistas**, e **validação** (como saber se acertou).

## Regras dos desafios

1. Faça em ordem. Cada um usa os anteriores.
2. Se travar 20 min, leia a pista. Se ainda travar, volte ao capítulo e tente de novo.
3. Sempre valide: `npm run lint` + `npm run build` + `npx vitest run` verdes.
4. **Desfaça ou commite** no final (não deixe o repo quebrado).
5. Errar é o objetivo — bug = aprendizado.

---

## DESAFIO 1 — Seu primeiro utilitário com teste (nível 1)

**Meta**: criar `truncate` (cortar texto) com teste — exercita `01-js-ts` + `13-testes`.

1. Em `src/lib/utils.ts`, adicione:
   ```ts
   export function truncate(text: string, max = 100): string {
     if (text.length <= max) return text
     return text.slice(0, max - 3) + '...'
   }
   ```
2. Em `src/test/utils.test.ts`, adicione testes: texto curto (não corta), texto
   longo (corta + `...`), texto vazio, e texto de tamanho exato.
3. **Validação**: `npx vitest run` passa (31+ testes).

## DESAFIO 2 — Componente com variante nova (nível 1)

**Meta**: adicionar uma variante `facebook` no `Button` — exercita `05-css-tailwind`.

1. Em `src/components/ui/button.tsx`, adicione ao `cva`:
   `facebook: 'bg-blue-600 text-white hover:bg-blue-700'`.
2. Use `variant="facebook"` num botão do `Login.tsx` (ex.: botão de exemplo).
3. **Validação**: `tsc` aceita a variante nova; visualmente o botão fica azul.
4. Extra: troque por `variant="link"` e veja a diferença.

## DESAFIO 3 — Status novo com segurança de tipos (nível 1/2)

**Meta**: adicionar `'cancelado'` ao domínio — exercita `01-js-ts` + `04-dominio`.

1. Em `src/components/ui/status-badge.tsx`, adicione `'cancelado'` a `PostStatus`.
2. Rode `npx tsc --noEmit` e **leia todos os erros** (deve quebrar em vários lugares:
   o `Record`, o `Badge`, o `ClienteFluxo`...).
3. Corrija CADA erro: label no `STATUS_LABELS`, variante no `badge.tsx` (cor), e
   os `Record` de status nas páginas.
4. **Validação**: `tsc --noEmit` limpo + `npm run build` limpo.
5. **Reflexão**: quantos lugares o TS te obrigou a tocar? Isso é o valor dos tipos.

## DESAFIO 4 — Custom hook: `useDebouncedValue` (nível 2)

**Meta**: criar um hook e usar num input de busca — exercita `03-hooks`.

1. Crie `src/hooks/use-debounced-value.ts`:
   ```ts
   export function useDebouncedValue<T>(value: T, delay = 300): T {
     const [debounced, setDebounced] = useState(value)
     useEffect(() => {
       const timer = setTimeout(() => setDebounced(value), delay)
       return () => clearTimeout(timer)   // cleanup!
     }, [value, delay])
     return debounced
   }
   ```
2. Use num input de teste (ex.: na Home, um campo que busca clientes).
3. **Validação**: digite rápido — a busca NÃO dispara a cada tecla, só após a pausa.
4. **Reflexão**: por que o `clearTimeout` no cleanup é essencial aqui?

## DESAFIO 5 — Filter com segurança (nível 2)

**Meta**: adicionar um filtro por status na página `Feedbacks` (kanban) sem quebrar
o drag-and-drop — exercita `03-hooks` + `06-sql`.

1. Leia `use-feedback-cards.ts` e entenda de onde vem a lista de cards.
2. Adicione um `useState` de filtro (ex.: `'todos' | FeedbackCardStatus`) e filtre a
   lista exibida (sem alterar a lista original usada pelo dnd).
3. **Validação**: arrastar continua funcionando com o filtro ativo; `build` limpo.
4. Extra: mostre contagem de cards por status no topo.

## DESAFIO 6 — Sincronizar duas abas com realtime (nível 3)

**Meta**: provar que o realtime funciona entre abas — exercita `10-realtime`.

1. Abra a mesma página em 2 abas.
2. Numa aba, envie um feedback; na outra, o mural deve atualizar sem refresh.
   (Se já funciona, você está vendo o realtime do PostUp em ação.)
3. **Desafio extra**: no `use-feedbacks.ts`, adicione escuta de `UPDATE` também
   (hoje só escuta `INSERT`). Pense: que evento real dispararia um UPDATE?
   (R.: mudança de status/version de um feedback existente.)

## DESAFIO 7 — Testar o hook com mock do Supabase (nível 3)

**Meta**: escrever um teste unitário do `useFeedbacks` sem rede — exercita `13-testes`.

1. Mocke o `supabase` (channel/on/subscribe/removeChannel) com `vi.fn()`.
2. Teste: ao montar, `fetchFeedbacks` chama `select().eq().order()`.
3. Teste: o cleanup chama `removeChannel`.
4. **Validação**: teste passa sem tocar na rede.
5. **Reflexão**: por que mockar é necessário aqui? O que o teste garante?

## DESAFIO 8 — RLS: política nova com função (nível 3/4)

**Meta**: criar uma função segura + política — exercita `08-rls-seguranca`.

> **AVISO**: mexa em um **ambiente de desenvolvimento/staging** do Supabase ou num
> projeto de teste, NUNCA direto no de produção sem cuidado.

1. Crie a migration `supabase/migrations/20260801_archive_clients.sql`:
   - Função `archive_client(p_client_id uuid, p_user_id uuid)` que só permite
     arquivar cliente se `clients.user_id = p_user_id` (valida!).
   - `SECURITY DEFINER`, `SET search_path = public`, valida null.
2. Rode `supabase db push` (se tiver ambiente local/CLI) ou aplique no SQL Editor.
3. **Validação**: chamar com user_id errado → `RAISE EXCEPTION 'Unauthorized'`.
4. **Reflexão**: o que aconteceria se você esquecesse o `search_path`? (capítulo 08)

## DESAFIO 9 — Seu bug de mentira (nível 4)

**Meta**: introduzir um bug real e caçá-lo com as ferramentas certas.

1. Escolha: (a) remove um `useCallback`; (b) remove um cleanup de efeito; ou
   (c) muda uma deps de `useEffect` para `[]` errado.
2. Rode o app e observe o sintoma (loop? leak? estado errado?).
3. Caça: React DevTools → Profiler; Network → WebSockets; `npm run lint` → o aviso
   de `exhaustive-deps`.
4. Conserte e explique a causa raiz em 3 frases.
5. **Validação**: lint + build + testes verdes; você consegue EXPLICAR o bug.

## DESAFIO 10 — Contribuição real: melhorar uma página (nível 4/5)

**Meta**: implementar uma melhoria de produto de ponta a ponta.

Opções (escolha uma):
- **a) Empty states**: onde as listas (clientes, posts, feedbacks) estão vazias,
  mostrar mensagem + ação (ex.: "Crie seu primeiro post" + botão). Exercita UI +
  renderização condicional.
- **b) Validação de formulário**: no `NovoCliente`, validar campos obrigatórios com
  `react-hook-form` e mostrar erros. Exercita `react-hook-form`.
- **c) Busca de clientes**: campo de busca na lista de clientes com
  `useDebouncedValue` (desafio 4) e `ilike` do Supabase. Exercita SQL + hooks.

Para qualquer uma:
1. Escreva um teste (mesmo simples) para o comportamento novo.
2. `npm run lint` + `build` + `vitest` verdes.
3. Abra um PR? (Se o repo permitir.) Ou commite com mensagem `feat:`.

## DESAFIO 11 — O botão preso do Turnstile (nível 3, bug real)

**Meta**: reproduzir o bug real "o captcha passa, mas o botão Entrar fica
bloqueado" e corrigi-lo — exercita `07-auth-sessao` + `09-seguranca-web` + `13-testes`.

1. Veja `git show 2b60d38:src/pages/Login/Login.tsx`: existe `turnstileRef`, mas o
   `<TurnstileWidget>` **não recebe** `ref={turnstileRef}`.
2. **Explique a causa raiz**: tentativa falha → `setCfToken('')` zera o token;
   `turnstileRef.current?.reset()` é no-op (ref null); o widget mantém o checkmark
   mas o token de uso único já foi consumido → botão bloqueado até recarregar.
3. Corrija: passe `ref={turnstileRef}` ao widget.
4. **Validação**: o teste `Login.test.tsx` verifica que `captchaState.resetCount`
   é 1 após uma tentativa falha — rode `npx vitest run` (33 testes passando).
5. **Extra (mesmo bug latente)**: o submit original não tinha `try/finally` — se
   `signIn` lançasse, `loading` ficava preso em `true` e o botão congelava com
   spinner. Corrija com `finally`.
6. **Reflexão**: o `?.` encobre bugs de ref (no-op silencioso). Como um teste
   pegou isso sem tocar na rede?

## DESAFIO 12 — CI verde sem `.env.local` (nível 3, bug real)

**Meta**: entender por que o GitHub Actions falhou e aplicar o fix — exercita
`12-git-cicd` + `13-testes`.

1. Renomeie `.env.local` para `x` (mova para fora do projeto) e rode
   `npx vitest run` — deve falhar `compress-image.test.ts`:
   ```
   Error: Faltam as variáveis de ambiente do Supabase...
    ❯ src/lib/supabase.ts:7:9
   ```
2. **Por que `lint`/`tsc`/`build` passaram?** (Não avaliam o guard em runtime.)
3. Aplique o fix no `vitest.config.ts`: `test.env` com placeholders
   (`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`).
4. Rode de novo sem `.env.local` — verde. Restaure o arquivo.
5. **Reflexão**: efeito colateral no import (throw) quebra testabilidade. Qual a
   alternativa mais robusta? (R.: inicialização preguiçosa — `getSupabase()` que
   só valida no primeiro uso.)

## DESAFIO 13 — "Senha incorreta" com a senha certa (nível 3, bug real)

**Meta**: reproduzir e corrigir um bug de UX/segurança em que a falha do captcha
virava "senha incorreta" — exercita `09-seguranca-web` + `13-testes`.

1. Na edge `verify-turnstile`, mude o `return` de falha para `status: 400`.
   O que muda no client? (R.: o `supabase.functions.invoke` passa a devolver
   `error` e **descarta o corpo** — os `error-codes` do Cloudflare somem.)
2. No `Login.tsx`, o `else` atual mapeia todo erro não-`email_not_confirmed` para
   "senha incorreta". Que erro do captcha seria mascarado? (R.: timeout/expired,
   token inválido, rate limit, rede.)
3. Aplique o fix em 3 camadas: edge retorna **200 + `success:false`**; `use-auth`
   devolve `code: 'turnstile_failed'`; `Login` trata esse `code` antes do `else`.
4. Escreva o teste: `signIn` resolve `{ error, code: 'turnstile_failed' }` →
   a UI mostra a mensagem do captcha, **não** "A senha está incorreta", e
   `checkEmailExists` **não** é chamado.
5. **Reflexão**: por que `success:false` com 200 é preferível a um status 400
   aqui? Quando um status não-2xx faz sentido? (R.: quando o client não precisa do
   corpo, ou para marcar erro de transporte em HTTP.)

## DESAFIO 14 — App quebrando no mobile por causa de WebSocket (nível 3, bug real)

**Meta**: entender e corrigir o crash "WebSocket not available: The Operation is
insecure" em navegadores mobile/WebViews que bloqueiam WebSocket — exercita
`05-dados-supabase` (realtime) + `13-testes`.

1. Onde nasce o erro? (R.: `new WebSocket(...)` lança um `SecurityError`; o
   `@supabase/realtime-js` re-lança como `WebSocket not available: ${message}` —
   um throw **síncrono** dentro de `RealtimeChannel.subscribe()`.)
2. Por que isso quebrava o app inteiro? (R.: o throw acontecia dentro de um
   `useEffect` → exceção no commit do React → ErrorBoundary global → tela de erro.)
3. Corrija sem perder o realtime: crie `subscribeRealtime` (`src/lib/realtime.ts`)
   que embrulha `channel.subscribe()` em try/catch e retorna `null` em falha;
   nos componentes, guarde o retorno e só chame `removeChannel` se não for `null`.
4. Escreva o teste: com WebSocket OK o canal é subscrito e retornado; com throw, o
   helper retorna `null` **sem lançar**.
5. **Reflexão**: realtime é essencial ou progressivo aqui? Quando valeria um
   fallback de polling? (R.: é um enriquecimento — os dados já carregam por
   `fetch` no mount; polling valeria em telas críticas que precisam ficar sempre
   frescas mesmo sem websocket.)

## O teste final (validação de prontidão)

Se você fez tudo, tente responder **sem consultar**:

1. Explique o fluxo de um clique de "aprovar" no review link, da UI até o banco e
   volta (RLS, SECURITY DEFINER, realtime, log).
2. Se um colega apagar o `useCallback` do `fetchPosts`, o que pode acontecer?
3. Se você precisa adicionar uma tabela `tags` ligada a posts, liste os passos
   (migration, tipo, hook, UI, RLS).
4. Se o cliente da agência pedir "esconder os posts de um cliente", o que você muda
   (schema? RLS? UI?) e qual o caminho mais seguro?

Se você consegue responder os 4 com fluência, **você está pronto para mexer no
código sozinho e para a entrevista**. 🎯

**Anterior**: [`15-flashcards.md`](15-flashcards.md)
