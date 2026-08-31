# 06 — SQL e Postgres

> **Objetivo**: dominar os conceitos de banco que o PostUp usa — tabelas,
> relacionamentos, índices, JSONB, funções PL/pgSQL e migrations — lendo as
> migrations reais do projeto.

## CONCEITO — Banco relacional em 60 segundos

Dados organizados em **tabelas** (linhas = registros, colunas = campos).
Relacionamentos via **chaves**:

- **PK (Primary Key)**: identifica a linha (`id UUID PRIMARY KEY`).
- **FK (Foreign Key)**: referencia outra tabela (`client_id REFERENCES clients(id)`).
- **1:N**: um cliente tem muitos posts (`clients 1→N posts`).
- **N:N**: dois clientes têm muitos posts? Não aqui — mas cards↔checklist é 1:N.

O PostUp é 100% relacional: `clients`, `posts`, `post_feedbacks`,
`feedback_cards` (+ attachments/checklist/comments), `post_versions`.

## CONCEITO — `SELECT`, filtros, ordenação

```ts
supabase.from('posts').select('*').eq('client_id', id).order('scheduled_at', { ascending: true })
```

- `.select('*')` → `SELECT * FROM posts`
- `.eq('client_id', id)` → `WHERE client_id = id`
- `.order(...)` → `ORDER BY scheduled_at ASC`

O cliente do Supabase traduz isso para SQL — mas entender o SQL por trás é o que
faz você depurar queries. Escreva a query SQL equivalente de cabeça.

## CONCEITO — `JOIN` (relacionamento em consulta)

```sql
SELECT p.*, c.name
FROM posts p
JOIN clients c ON c.id = p.client_id
```

O PostUp usa JOIN **na RLS** (ver capítulo 08) e **evita JOIN na UI**: por isso
`posts` guarda `client_name`/`client_color` denormalizados (cópia) — decisão
documentada em `docs/12-decisoes-alternativas.md` (D10).

## CONCEITO — Índices

```sql
CREATE INDEX IF NOT EXISTS idx_posts_client_id ON posts(client_id);
```

- Índice = estrutura auxiliar que acelera `WHERE coluna = x` / `ORDER BY`.
- Sem índice, o Postgres faz **full scan** (varre todas as linhas).
- Custam espaço e lentidão em INSERT/UPDATE — criamos só nos campos de filtro
  comum (`client_id`, `status`, `scheduled_at`).
- Para entrevista: sabe que `WHERE` e `JOIN` em coluna indexada são rápidos.

## CONCEITO — `JSONB` (dados flexíveis no Postgres)

```sql
media_urls JSONB DEFAULT '[]'
```

- `JSONB` = coluna que guarda JSON de forma binária otimizada.
- Permite "schema flexível" dentro de uma coluna (listas de URLs, metadados).
- Pode ter índices GIN para buscas dentro do JSON (o PostUp não precisa ainda).
- O PostUp usa: `media_urls` nos posts, `branding`/`metrics`/`contacts`/`links`
  nos clientes. Estruturas ricas sem criar 20 tabelas.

## CONCEITO — Timestamps e `NOW()`

```sql
created_at TIMESTAMPTZ DEFAULT NOW()
```

- `TIMESTAMPTZ` = data+hora com fuso (correto para agendamento).
- `DEFAULT NOW()` = o banco preenche sozinho na inserção.
- `scheduled_at TIMESTAMPTZ NOT NULL` no posts = campo obrigatório (agendamento).

## CONCEITO — `uuid` e `gen_random_uuid()`

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

- `UUID` = identificador globalmente único (não incremental — evita "adivinhar" IDs).
- `gen_random_uuid()` gera automaticamente.
- Para o review, o UUID funciona como segredo quando não exposto publicamente
  (o PostUp usa tokens dedicados além do id — capítulo 07/08).

## NO CÓDIGO — `supabase/migrations/006_create_tables_rls_realtime.sql`

Abra o arquivo. Identifique (nesta ordem):

1. `CREATE TABLE IF NOT EXISTS posts` — schema completo (PK, timestamps, FKs implícitas).
2. `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` — **migrations idempotentes**: rodam
   de novo sem quebrar (por isso o `IF NOT EXISTS`).
3. `CREATE INDEX IF NOT EXISTS` — os 4 índices.
4. Storage bucket com `ON CONFLICT (id) DO NOTHING` — idempotência de novo.
5. `ALTER PUBLICATION supabase_realtime ADD TABLE posts` — habilitar realtime.

> **Conceito-chave**: **migration** = cada mudança de schema é um arquivo SQL
> versionado, aplicado em ordem. Permite evoluir o banco de forma rastreável e
> reproduzível. O PostUp usa `supabase/migrations/` + CLI (`supabase db push`).

## NO CÓDIGO — Funções PL/pgSQL (`014_security_validation.sql`)

```sql
CREATE OR REPLACE FUNCTION approve_post(p_post_id uuid, p_review_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_post_id IS NULL OR p_review_token IS NULL THEN
    RAISE EXCEPTION 'Invalid parameters';
  END IF;
  -- ... valida token, atualiza status, insere log
END;
$$;
```

- **PL/pgSQL**: linguagem procedural do Postgres — lógica (IF, loops, exceções)
  dentro do banco.
- **`SECURITY DEFINER`**: roda com privilégios do dono (consegue escrever mesmo com
  RLS). Veremos a segurança no capítulo 08.
- **`RAISE EXCEPTION`**: aborta e retorna erro ao chamador.
- **`CREATE OR REPLACE`**: reexecutável (idempotente).

## CONCEITO — Transações e atomicidade

Uma **transação** agrupa operações: ou todas executam, ou nenhuma.
`approve_post` é atômico por natureza: atualiza status E insere log num único
statement. Se o app fizesse em duas chamadas, um erro no meio deixaria o banco
inconsistente. **Por isso existem funções no banco**: operações multi-step devem
ser atômicas.

## PRATICAR

1. Escreva o SQL de `posts` "de cabeça" e compare com a migration 006.
2. Escreva a query que lista posts com status `'aprovado'` do cliente X, ordenados
   por data. Depois faça com o cliente do Supabase.
3. Adicione um índice para `created_at` em `post_feedbacks` — a migration 006 já tem?
   Por que seria útil?
4. No Supabase SQL Editor, rode `SELECT * FROM posts LIMIT 5;` — entenda o resultado
   à luz da RLS (você está logado como dono).

## ENTREVISTA — perguntas típicas

**"O que é uma foreign key e por que usar?"**
Estrutura: (1) coluna que referencia a PK de outra tabela; (2) garante integridade
(não existe post órfão de cliente); (3) `ON DELETE CASCADE/SET NULL` define o
comportamento; (4) no PostUp: `post_feedbacks.post_id REFERENCES posts(id)
ON DELETE CASCADE` (apagar post apaga os feedbacks); (5) também acelera JOINs.

**"O que é JSONB e quando usar vs colunas normais?"**
Estrutura: (1) coluna JSON binário; (2) quando: dados variáveis/metadados (branding,
metrics do PostUp); (3) quando NÃO: dados que você filtra/agrega sempre — prefira
colunas/indexadas; (4) trade-off: flexibilidade vs integridade de schema;
(5) no PostUp: `media_urls`, `branding` são JSONB; `status`, `scheduled_at` são colunas.

**"O que é uma migration e por que versionar o schema?"**
Estrutura: (1) arquivos SQL em ordem aplicados via CLI; (2) rastreabilidade (quem
mudou o quê), reprodução (recriar banco), idempotência (`IF NOT EXISTS`); (3) no
PostUp: `supabase/migrations/` aplicadas com `supabase db push`; (4) alternativa:
editar schema no painel — perde histórico; (5) melhores práticas: uma mudança por
migration, nunca editar migração já aplicada (criar outra).

**Anterior**: [`05-css-tailwind.md`](05-css-tailwind.md) · **Próximo**: [`07-auth-sessao.md`](07-auth-sessao.md)
