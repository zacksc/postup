# 08 — RLS e segurança no banco (o coração do PostUp)

> **Objetivo**: dominar **Row Level Security** — o conceito que faz o PostUp seguro
> — lendo as migrations reais (015 tenant isolation, 014 security validation).

## CONCEITO — O que é RLS (Row Level Security)

RLS é um recurso do Postgres que **filtra linhas no próprio banco**, por política,
de acordo com quem faz a requisição.

```sql
CREATE POLICY "auth_all_clients" ON clients
  FOR ALL TO authenticated
  USING (user_id = auth.uid())      -- SELECT vê só as linhas do dono
  WITH CHECK (user_id = auth.uid()) -- INSERT/UPDATE só com o dono correto
```

- `USING` → filtra quais linhas são **visíveis/modificáveis** (SELECT/UPDATE/DELETE).
- `WITH CHECK` → valida as linhas **novas** (INSERT) ou atualizadas (UPDATE).
- `auth.uid()` → id do usuário logado (vem do token JWT, confiável).
- **Sem RLS, tudo é visível**. RLS só existe se `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.

**Por que isso é o coração?** Porque o frontend usa a anon key — qualquer um pode
chamar a API. A RLS é a ÚLTIMA linha de defesa que o atacante não pode burlar.
Mesmo que alguém injete um SQL ou engane a UI, o banco responde só com o que a
política permite.

## CONCEITO — O problema do "USING (true)" e a lição do PostUp

Nas migrations 006+, as políticas eram `USING (true)` — qualquer usuário logado
via TUDO de todos. Isso é aceitável para 1 usuário, mas **violação grave** em
multi-usuário. A migration 015 corrigiu:

1. Adicionou `user_id` em `clients`, `posts`, `feedback_cards`.
2. Trocou as policies para `user_id = auth.uid()`.
3. Para tabelas **filhas** (sem `user_id`), usou `EXISTS`:

```sql
CREATE POLICY "auth_all_feedbacks" ON post_feedbacks
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM posts
            WHERE posts.id = post_feedbacks.post_id
              AND posts.user_id = auth.uid())
  )
```

Ou seja: um feedback só é acessível se o **post pai** for do usuário. Isso é
**isolamento de tenant por propagação**: herda o dono da tabela pai.

## CONCEITO — O anon precisa de acesso? (o caso do review)

O fluxo de review (`/review/:token`) é **sem login** — o cliente final acessa via
link. Então o `anon` precisa de algum acesso:

```sql
-- clients: anon SÓ vê quem tem review_token
CREATE POLICY "anon_select_clients_by_token" ON clients
  FOR SELECT TO anon USING (review_token IS NOT NULL);

-- posts: anon pode ler (o token no link controla o acesso na prática)
CREATE POLICY "anon_select_posts" ON posts
  FOR SELECT TO anon USING (true);
```

**Modelo mental**: o token do link é o "segredo". O anon não escreve nada
diretamente — escreve via funções `SECURITY DEFINER` que VALIDAM o token
(próxima seção).

## NO CÓDIGO — `014_security_validation.sql` (a aula de segurança)

Abra o arquivo e leia `approve_post`:

```sql
CREATE OR REPLACE FUNCTION approve_post(p_post_id uuid, p_review_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_post_id IS NULL OR p_review_token IS NULL THEN
    RAISE EXCEPTION 'Invalid parameters';              -- 1. valida null
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM posts p JOIN clients c ON c.id = p.client_id
    WHERE p.id = p_post_id AND c.review_token = p_review_token
  ) THEN
    RAISE EXCEPTION 'Unauthorized';                    -- 2. valida token
  END IF;
  UPDATE posts SET status = 'aprovado' WHERE id = p_post_id;
  INSERT INTO post_feedbacks (...)
  VALUES (p_post_id, 'cliente', 'Cliente', 'Post aprovado pelo cliente.', 'log');
END;
$$;
```

Conceitos que você precisa saber:

### `SECURITY DEFINER`
- A função roda com os privilégios do **dono** (não do chamador).
- Útil para operações que o anon não pode fazer linha a linha, mas que devem
  acontecer (aprovar post = atualizar status + inserir log = **atômico**).
- **PERIGO**: se mal escrita, vira uma porta de escape da RLS. Por isso valida.

### Validação obrigatória
- **Nunca** confie em parâmetros. `IF x IS NULL THEN RAISE EXCEPTION`.
- **Nunca** faça operações sem confirmar autorização (o token bate?).
- Limites: `send_client_feedback` rejeita mensagem vazia/longa e nome longo.

### `SET search_path = public`
- **Defesa contra "search_path hijacking"**: se um atacante cria uma tabela
  `clients` num schema que aparece antes no `search_path`, funções podem resolver
  o nome errado e executar SQL malicioso. Fixar `search_path` elimina o vetor.

### Por que função e não 2 chamadas do app?
**Atomicidade**: atualizar status E inserir log devem acontecer juntas ou nada.
Se o app fizesse em 2 requests, uma falha no meio deixaria o banco inconsistente.

## CONCEITO — Checklist de segurança de qualquer função no banco

1. Parâmetros validados (null, tipos, tamanhos)?
2. Autorização confirmada (token/uid)?
3. `SET search_path` fixado?
4. Escopo do `SECURITY DEFINER` é o mínimo necessário?
5. `RAISE EXCEPTION` retorna erro limpo ao app?

## PRATICAR

1. No Supabase SQL Editor: `SELECT * FROM clients;` logado como dono → o que vem?
   `SET ROLE anon; SELECT * FROM clients;` → o que muda?
2. Explique por que a policy de `post_feedbacks` usa `EXISTS` em vez de
   `user_id = auth.uid()` direto.
3. Se um atacante chama `approve_post` com um UUID aleatório e token inválido,
   o que a função retorna? Rastreie os 3 pontos de defesa.
4. Leia `015_tenant_isolation.sql` e descreva com suas palavras o backfill do final
   (por que associar dados antigos ao primeiro usuário?).

## ENTREVISTA — perguntas típicas

**"Explique Row Level Security."**
Estrutura: (1) filtro por linha no banco, não no app; (2) `USING` vs `WITH CHECK`;
(3) `auth.uid()` para identificar o dono; (4) por que importa: o backend deixa a
segurança no banco mesmo com chave pública; (5) exemplo real das migrations do PostUp.

**"Qual a diferença entre `USING` e `WITH CHECK`?"**
Estrutura: (1) `USING` define quais linhas EXISTENTES são acessíveis (SELECT/
UPDATE/DELETE); (2) `WITH CHECK` valida linhas NOVAS/alteradas (INSERT/UPDATE);
(3) exemplo: `USING (user_id = auth.uid())` + `WITH CHECK (user_id = auth.uid())`;
(4) usar só `USING` permitiria a um usuário INSERIR linha com user_id de outro.

**"O que é `SECURITY DEFINER` e quais os riscos?"**
Estrutura: (1) função roda como dono, ignorando RLS do chamador; (2) usos:
operações atômicas que o anon precisa (aprovar post), RPCs;
(3) riscos: escalada de privilégio se mal escrita; (4) mitigações: validar input,
autorizar, fixar `search_path`; (5) exemplo do `approve_post` validando o token.

**"Como você isolaria dados entre usuários num multi-tenant?"**
Estrutura: (1) coluna `user_id`/`team_id` em cada tabela; (2) policies
`user_id = auth.uid()`; (3) tabelas filhas herdam via `EXISTS`; (4) backfill de
dados antigos; (5) o PostUp faz isso na migration 015 e tem `profiles_and_teams`
para a fase de equipes.

**Anterior**: [`07-auth-sessao.md`](07-auth-sessao.md) · **Próximo**: [`09-seguranca-web.md`](09-seguranca-web.md)
