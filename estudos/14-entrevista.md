# 14 — Banco de perguntas de entrevista

> **Objetivo**: as perguntas que um entrevistador faria sobre este projeto e sobre
> os conceitos que ele usa — com respostas-modelo estruturadas em 3–5 pontos e o
> "formato de ouro" para responder.

## O formato de ouro para responder (decore)

Para QUALQUER pergunta técnica:
1. **Defina** o conceito em 1 frase.
2. **Explique** o mecanismo (como funciona).
3. **Conecte ao projeto** ("no PostUp nós..." — exemplo concreto).
4. **Trade-off** (o que ganha/cede).
5. **Feche** com uma frase de síntese.

```text
Pergunta: "O que é RLS?"
Resposta:
  1. RLS é um filtro de linhas que roda dentro do banco. 
  2. Você cria políticas com USING e WITH CHECK que comparam auth.uid() com os dados.
  3. No PostUp, cada tabela tem policies user_id = auth.uid(), e as filhas herdam via EXISTS.
  4. O trade-off é que o app precisa desenhar o schema pensando em isolamento desde o início.
  5. É o que garante que um usuário só vê o que é dele, mesmo que o front seja burlado.
```

## Categoria 1 — React e JavaScript (nível 1)

### P1. O que acontece quando o estado de um componente muda?
**Resp-modelo**: (1) `setState` agenda um re-render; (2) o React executa a função
do componente de novo com o novo valor; (3) produz a nova árvore de elementos;
(4) reconcilia com a anterior (diff); (5) atualiza só o que mudou no DOM. No PostUp:
`setFeedbacks` no `use-feedbacks` atualiza o mural sem recarregar.

### P2. Qual a diferença entre `useState` e `useRef`?
**Resp-modelo**: (1) ambos guardam valores entre renders; (2) mudar `useState`
re-renderiza; mudar `useRef` não; (3) `useState` substitui o valor (imutável),
`useRef` muta `.current`; (4) usos: refs para timers/DOM (`toastTimer` no
ClienteFluxo), estado para dados de UI (`loading`).

### P3. Explique o `useEffect` e o cleanup.
**Resp-modelo**: (1) roda após o render quando as deps mudam; (2) deps `[]` = uma
vez; deps presentes = quando mudarem; (3) o retorno é o cleanup — roda antes do
próximo efeito e no desmonte; (4) serve para subscriptions/timers/listeners;
(5) no `use-feedbacks`: cria canal realtime e `removeChannel` no cleanup para não
vazar.

### P4. Por que o lint `exhaustive-deps` reclama de você e o que fazer?
**Resp-modelo**: (1) o efeito usa valores que precisam estar nas deps; (2) sem
isso, o efeito usa valores "velhos" (closure) ou roda demais; (3) corrigir
estabilizando com `useCallback`/`useMemo`, não suprimindo; (4) exceções pontuais
com `// eslint-disable-next-line` comentado; (5) no PostUp foi o grupo mais
numeroso de correções do audit.

### P5. O que é code-splitting e lazy loading?
**Resp-modelo**: (1) dividir o bundle em chunks; (2) `React.lazy` + `Suspense` +
import dinâmico; (3) cada rota do PostUp é lazy → abre rápido em mobile; (4)
fallback = spinner; (5) quando não usar: páginas pequenas onde o split adiciona
latência.

## Categoria 2 — TypeScript (nível 1/2)

### P6. `interface` vs `type`?
**Resp-modelo**: (1) ambos descrevem formas; (2) `type` faz união/utilitários
(`PostStatus`, `Record`); (3) `interface` é estendível e tem merge de declaração;
(4) no PostUp: `interface` para objetos de domínio, `type` para uniões;
(5) intercambiáveis na maioria dos casos — consistência importa mais.

### P7. Por que usar `unknown` em vez de `any`?
**Resp-modelo**: (1) `any` desliga a checagem; (2) `unknown` exige provar o tipo
(narrowing); (3) o lint do PostUp marca `no-explicit-any` como erro;
(4) dados externos (Supabase) devem ser tipados na origem, não `as any`;
(5) quando precisa de "escape", `as unknown as X` é explícito e rastreável.

### P8. O que é um tipo união e um `Record`? Como o PostUp os usa?
**Resp-modelo**: (1) união = valor entre opções (`PostStatus` com 5 valores);
(2) `Record<K,V>` = objeto com chaves tipadas; (3) "make illegal states
impossible"; (4) `Record<PostStatus,string>` força o label para todo status novo;
(5) isso transforma erros de domínio em erros de compilação.

## Categoria 3 — Banco e Supabase (nível 2)

### P9. Explique RLS com exemplo.
**Resp-modelo**: (1) filtro por linha no banco; (2) `USING` (acesso) + `WITH CHECK`
(validação de escrita); (3) `auth.uid()` identifica o dono; (4) exemplo: clients
`user_id = auth.uid()`; (5) filhas herdam via `EXISTS` (post_feedbacks). É a defesa
principal mesmo com anon key pública.

### P10. O que é `SECURITY DEFINER` e como usar com segurança?
**Resp-modelo**: (1) função roda como dono, ignorando RLS do chamador;
(2) utilidade: operações atômicas que o anon precisa (approve_post);
(3) riscos: escalada de privilégio; (4) defesas: validar parâmetros, autorizar com
token, fixar `search_path`; (5) exemplo real do `014_security_validation.sql`.

### P11. JSONB vs colunas normais?
**Resp-modelo**: (1) JSONB = JSON binário otimizado; (2) quando: dados flexíveis/
aninhados (branding, metrics); (3) quando não: campos filtrados/indexados
(status, scheduled_at); (4) trade-off: flexibilidade vs integridade; (5) no PostUp
os dois coexistem na mesma tabela.

### P12. Como funciona o Realtime do Supabase?
**Resp-modelo**: (1) WebSocket; (2) canais com `postgres_changes` escutando
INSERT/UPDATE/DELETE; (3) publicação `supabase_realtime` por tabela;
(4) filtros (`post_id=eq.x`) reduzem tráfego; (5) o PostUp usa em feedbakcks/chat
para atualizar entre gestor e cliente.

### P13. Como você garantiria que um usuário não veja dados de outro?
**Resp-modelo**: (1) coluna `user_id`/`team_id` em cada tabela; (2) policies RLS
`user_id = auth.uid()`; (3) filhas via `EXISTS` no pai; (4) backfill de dados
antigos; (5) o PostUp faz na migration 015; (6) bonus: nunca deixar `USING (true)`
sem necessidade.

## Categoria 4 — Segurança (nível 2/3)

### P14. O que é XSS e como se proteger?
**Resp-modelo**: (1) injetar script que roda no contexto de outro usuário;
(2) tipos: refletido/armazenado/DOM; (3) sanitizar input (DOMPurify com
`ALLOWED_TAGS: []`); (4) CSP como rede de segurança; (5) no PostUp, `sanitize()` em
todo texto re-renderizado; (6) nunca `dangerouslySetInnerHTML` com input sem limpar.

### P15. O que é CSP e o que aconteceu com o Turnstile no PostUp?
**Resp-modelo**: (1) header que restringe origem de recursos; (2) deny-by-default;
(3) o captcha não carregava porque o domínio da Cloudflare estava bloqueado;
(4) solução: liberar explicitamente `challenges.cloudflare.com`, não desligar a CSP;
(5) lição: nova dependência externa = atualizar a CSP conscientemente.

### P16. Por que o Turnstile precisa de uma edge function para validar?
**Resp-modelo**: (1) o segredo (`TURNSTILE_SECRET_KEY`) nunca vai ao navegador;
(2) o widget público gera o token; (3) a edge function valida com o segredo na
Cloudflare; (4) front só recebe `success: true/false`; (5) sem isso, bots
falsificariam o captcha chamando a API direto.

### P17. Diferenciação de erro de login: segurança vs UX?
**Resp-modelo**: (1) mensagens diferentes ajudam o usuário; (2) risco: enumeração
de e-mails; (3) mitigação no PostUp: captcha + e-mail confirmado + limite de
tentativas; (4) trade-off aceito e documentado; (5) mostre que você PESOU a
decisão — isso impressiona.

## Categoria 5 — Arquitetura (nível 2/3)

### P18. Como você estruturaria um app React?
**Resp-modelo**: (1) camadas (UI/domínio/design system/hooks/dados); (2) rotas
aninhadas com layout persistente; (3) hooks por feature; (4) separação de estados
(local/derivado/global/servidor); (5) code-splitting; (6) cite o PostUp.

### P19. Context API vs Zustand/Redux?
**Resp-modelo**: (1) Context para estado pequeno/menos mutável (auth/tema);
(2) libs para estado compartilhado grande com seletores; (3) o PostUp usa Context
e tem zustand instalado como plano; (4) decisão pelo problema, não pelo hype;
(5) migração barata se necessário.

### P20. Composição vs herança em React?
**Resp-modelo**: (1) componentes pequenos compostos via children/props;
(2) herança de componente é anti-padrão; (3) exemplo: StatusBadge compõe Badge,
PostCard compõe StatusBadge; (4) benefícios: reuso, testabilidade.

## Categoria 6 — Qualidade e workflow (nível 1/2)

### P21. O que é a pirâmide de testes?
**Resp-modelo**: (1) unit → componente → E2E; (2) custo cresce, quantidade diminui;
(3) o PostUp tem unit + componente (30 testes); (4) E2E é o próximo passo;
(5) mocks isolam camadas (Login.test mocka useAuth).

### P22. CI/CD: o que é e como o PostUp usa?
**Resp-modelo**: (1) CI = verificação automática (lint, typecheck, build, testes);
(2) CD = deploy automático; (3) GitHub Actions com `npm ci`; (4) Vercel com
`rewrites` para SPA; (5) branches main/production separando dev de produção.

### P23. `npm ci` vs `npm install`?
**Resp-modelo**: (1) `npm ci` instala exatamente o lockfile; (2) determinístico,
reproduzível; (3) usado no CI; (4) `npm install` pode atualizar/resolver novo.

## Categoria 7 — Perguntas "comportamentais" sobre o projeto

### P24. Conte sobre um bug difícil que você resolveu.
**Use a história real**: o CSP bloqueava o Turnstile. Estrutura: (1) sintoma
(captcha não carregava); (2) investigação (devtools → erro de CSP); (3) causa raiz
(domínio não liberado); (4) solução (liberar explicitamente, sem desligar a CSP);
(5) lição (nova dependência externa = rever CSP). Bônus: a mesma técnica pegou o
TDZ no Chat (reordenar declarações) e os erros de `useCallback`.

### P25. Qual decisão de arquitetura você tomaria diferente?
**Boa resposta**: reconhecer trade-offs da stack — ex.: "hoje não usamos React
Query, mas quando as listas crescerem eu avaliaria; o zustand instalado é um sinal
disso". Mostra que você PESA decisões, não que o projeto é perfeito.

### P26. Explique o PostUp em 2 minutos.
**Estrutura**: (1) problema (agências gerenciam múltiplos clientes e aprovações);
(2) solução (cronograma, kanban de feedback, chat, review via link sem login);
(3) stack (React/TS/Vite/Tailwind/Supabase); (4) segurança (RLS + review token +
Turnstile); (5) qualidade (CI verde, 30 testes, wiki documentada). Veja também o
capítulo `16-desafios.md` e pratique em voz alta.

## PRATICAR

1. Grave você respondendo P9 (RLS), P3 (useEffect) e P22 (CI/CD) em 60s cada.
   Ouça e critique.
2. Responda P24 com a história real do CSP. Reescreva em 5 frases.
3. Faça um "mock interview": sorteie 10 perguntas aleatórias e responda em voz alta.

## ENTREVISTA — o que fazer ANTES de entrar

- Rodar `npm run lint`, `npm run build`, `npx vitest run` — saber que estão verdes.
- `git log --oneline` — conhecer a história do projeto.
- Explicar o PostUp em 30s/2min/5min (3 versões).
- Ter 1 bug real para contar (o CSP/Turnstile é perfeito).
- Ter 1 decisão para defender (RLS, review sem login, Context vs Zustand).

**Anterior**: [`13-testes.md`](13-testes.md) · **Próximo**: [`15-flashcards.md`](15-flashcards.md)
