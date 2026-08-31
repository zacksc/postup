# 07 — Autenticação e sessão

> **Objetivo**: entender como funciona autenticação no PostUp — o que é sessão,
> tokens JWT, o papel do Supabase Auth, e os fluxos de login, cadastro e
> recuperação de senha.

## CONCEITO — O que é autenticação vs autorização

- **Autenticação**: "quem é você?" (login, senha, token).
- **Autorização**: "o que você pode fazer?" (roles, RLS).

O PostUp: autenticação via Supabase Auth (email+senha). Autorização via **RLS**
no banco (`user_id = auth.uid()`) — cada usuário só vê/edita o que é dele.

## CONCEITO — Como funciona uma sessão com tokens

Fluxo clássico (e o do Supabase):

```
1. Usuário envia email+senha
2. Servidor valida e emite um TOKEN (JWT) com a identidade
3. O cliente guarda o token e o envia em cada requisição (Authorization header)
4. Servidor confia no token (assinatura) e responde
```

O **JWT** (JSON Web Token) é um token **autocontido e assinado**: o servidor não
precisa guardar estado — ele verifica a assinatura e lê os dados do próprio token.
No Supabase: `access_token` (vida curta) + `refresh_token` (vida longa, renova o
primeiro). É por isso que **o frontend nunca pode validar o token sozinho** — ele
pode lê-lo, mas só o servidor/banco pode confiar nele.

## NO CÓDIGO — `src/hooks/use-auth.tsx`

Abra o arquivo e estude o fluxo de restauração de sessão:

```tsx
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session)
    setUser(session?.user ?? null)
    setLoading(false)
  })

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    setSession(session)
    setUser(session?.user ?? null)
    if (event === 'PASSWORD_RECOVERY') {
      sessionStorage.setItem(RECOVERY_KEY, '1')
      setIsRecoverySession(true)
    } else if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
      sessionStorage.removeItem(RECOVERY_KEY)
      setIsRecoverySession(false)
    }
  })

  return () => subscription.unsubscribe()   // cleanup
}, [])
```

1. **`getSession()`**: ao carregar, restaura a sessão salva (o Supabase guarda no
   localStorage). Sem isso, o usuário logado "perderia" a sessão a cada refresh.
2. **`onAuthStateChange`**: listener que reage a eventos (login, logout, recovery).
3. **`PASSWORD_RECOVERY`**: flag no `sessionStorage` marca "esta é uma sessão de
   recuperação" — a página de reset só mostra o formulário nesse caso.

## CONCEITO — Sessão em `sessionStorage` vs `localStorage`

- `localStorage`: persiste após fechar o navegador (o Supabase guarda o refresh
  token aqui por padrão — "ficar logado").
- `sessionStorage`: morre ao fechar a aba (o PostUp usa para a flag de recovery —
  é uma marcação de curto prazo, não o token).

## NO CÓDIGO — Fluxo de login com proteção (Login.tsx + use-auth)

```
1. Preenche email+senha
2. Verifica se email existe (rpc check_email_exists) → mensagem diferente
3. Turnstile gera token → use-auth.signIn valida via edge function
4. supabase.auth.signInWithPassword({ email, password })
5. Retorna { error?: string; code?: string } → Login mostra mensagem
6. Após 3 falhas → oferece "enviar link de redefinição"
```

**Por que retornar `{ error }` em vez de `throw`?** O componente decide a UX
(mensagem específica) sem try/catch espalhado. Erro vira dado.

## NO CÓDIGO — Recuperação de senha

```
resetPassword(email) → supabase.resetPasswordForEmail(email, { redirectTo: '/redefinir-senha' })
    │  e-mail com link mágico
    ▼
clica no link → Supabase dispara PASSWORD_RECOVERY → flag no sessionStorage
    ▼
/redefinir-senha → SÓ mostra formulário se isRecoverySession === true
    ▼
updatePassword(nova) → updateUser({ password })
```

**Por que a flag?** Sem ela, qualquer um abriria `/redefinir-senha` direto e
trocaría a senha de quem estivesse logado. A flag garante que o formulário só
aparece numa sessão de recuperação REAL (fix do `bf2a312`).

## CONCEITO — O papel do `ProtectedRoute`

```tsx
<Route element={<ProtectedRoute />}>
  <Route element={<AppShell />}> ... rotas protegidas ... </Route>
</Route>
```

- `ProtectedRoute` lê a sessão (`useAuth`) e, se não houver, **redireciona para
  `/login`**.
- Envolve TODAS as rotas autenticadas de uma vez (rotas aninhadas) — não precisa
  verificar em cada página.
- Proteção **frontend**: só UX. A segurança REAL é a RLS no banco (o cliente nunca
  "é confiável"). Um usuário malicioso pode burlar o redirect — mas não a RLS.

## CONCEITO — Anon key vs service role

- **Anon key** (no frontend): chave pública, identifica o "papel anônimo". Pode
  ser usada por qualquer um — por isso as tabelas têm RLS restringindo o anon.
- **Service role** (NUNCA no frontend): bypass total de RLS. Fica no servidor/
  edge functions. Se vazar, o banco inteiro está exposto.

O PostUp só usa a anon key no bundle (`VITE_SUPABASE_ANON_KEY`). O segredo do
Turnstile (`TURNSTILE_SECRET_KEY`) vive na edge function, não no front.

## PRATICAR

1. No console do navegador (logado), inspecione o localStorage: encontre o token
   do Supabase. Abra-o num decodificador de JWT (ex.: jwt.io) — quais claims você
   vê? Qual o `sub` (usuário)?
2. No `ProtectedRoute.tsx`, o que é renderizado se `loading` for true? Por que é
   importante (evita "flash" de redirecionamento)?
3. Abra o `Login.tsx` e explique como o contador de 3 tentativas funciona. Onde ele
   é resetado?
4. Simule: abra `/redefinir-senha` sem clicar em link de recovery. O que aparece?
   Por quê?

## ENTREVISTA — perguntas típicas

**"Como funciona autenticação com JWT?"**
Estrutura: (1) servidor valida credenciais e emite token assinado com claims
(usuário, expiração); (2) cliente envia em toda requisição; (3) servidor verifica
assinatura sem guardar estado; (4) Supabase: access + refresh token;
(5) o PostUp delega auth ao Supabase mas o fluxo conceitual é o mesmo.

**"Qual a diferença entre autenticação e autorização?"**
Estrutura: (1) auth = identidade; autorização = permissão; (2) exemplo: login
(auth) + RLS `user_id = auth.uid()` (autorização); (3) o PostUp garante autorização
no BANCO (RLS), não na UI; (4) por que: a UI pode ser burlada, o banco não.

**"O que é a anon key e por que não é um segredo?"**
Estrutura: (1) chave pública que marca requisições como "anon"; (2) está no bundle,
qualquer um vê; (3) NÃO dá acesso além do que a RLS permite; (4) o verdadeiro
segredo é a service role — nunca no front; (5) no PostUp: só anon key no bundle,
segredos em edge functions/ambiente.

**Anterior**: [`06-sql-postgres.md`](06-sql-postgres.md) · **Próximo**: [`08-rls-seguranca.md`](08-rls-seguranca.md)
