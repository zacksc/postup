# 13 — Testes: o que, por que e como

> **Objetivo**: entender a teoria e a prática dos testes no PostUp — a pirâmide,
> mocks, Testing Library, e como o `Login.test.tsx` testa uma página sem tocar no
> Supabase.

## CONCEITO — Por que testar?

1. **Regressão**: um bug consertado não volta.
2. **Confiança para refatorar**: mexer no código sem medo de quebrar.
3. **Documentação viva**: o teste mostra o comportamento esperado.
4. **Qualidade**: escrever para testar te força a desenhar melhor (código testável).

Custo: tempo de escrita + manutenção. Por isso existe a **pirâmide**.

## CONCEITO — A pirâmide de testes

```
      /\
     /  \    Testes de UI (poucos)  → mais lentos, frágeis
    /----\    (E2E: Playwright/Cypress)
   /      \
  /--------\   Testes de integração/componente (médios)
  |        |    (testing-library: renderiza componente real)
 /----------\
/------------\  Testes unitários (muitos) → rápidos, baratos
              (funções puras, utils, lógica)
```

- **Base (unit)**: funções puras — utils, formatação, sanitize.
- **Meio (componente)**: renderiza um componente com mocks (LoginPage).
- **Topo (E2E)**: fluxo completo no navegador (o PostUp ainda não tem).

Regra: quanto mais perto da base, mais testes e mais baratos. O PostUp tem 30
testes: unitários (utils, compress-image) + componente (Login).

## NO CÓDIGO — `src/test/utils.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { cn, formatDate, sanitize, getInitials } from '@/lib/utils'

describe('utils', () => {
  it('cn combina e resolve conflitos', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('bg-red-500', 'flex')).toBe('bg-red-500 flex')
  })
})
```

- **`describe`/`it`/`expect`**: estrutura BDD (behavior-driven) — lê como frase:
  "cn combina e resolve conflitos".
- Teste unitário = chamar função pura e **asserir o resultado**. Sem DOM, sem rede.

## CONCEITO — O que testar de uma função pura

Casos importantes (não só o "feliz"):
- Valor típico (`cn('p-2','p-4')` → `'p-4'`).
- **Borda** (vazio, nulo, extremo: `sanitize('')`, `getInitials('')`).
- **Comportamento de segurança** (`sanitize('<script>')` → `''`).

## NO CÓDIGO — `src/test/Login.test.tsx` (o mais didático)

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import LoginPage from '@/pages/Login/Login'

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(() => ({
    user: null, session: null, loading: false,
    signIn: vi.fn(), ...
  })),
}))
```

O teste:
1. **`vi.mock('@/hooks/use-auth')`**: substitui o hook por um MOCK — o teste não
   precisa de Supabase/banco/rede. O `LoginPage` chama `useAuth()` e recebe a
   versão falsa.
2. **`render(<BrowserRouter><LoginPage /></BrowserRouter>)`**: renderiza o componente
   real dentro de um router (o `Link` do React Router exige).
3. **`screen.getByText/getByPlaceholderText`**: Testing Library busca **como o
   usuário vê** (por texto, não por id interno).
4. **`userEvent.type/click`**: simula interação real (digitar, clicar).
5. **`expect(...).toBeInTheDocument()`**: verifica o que o usuário enxerga.

```tsx
it('shows password error when email exists', async () => {
  const { useAuth } = await import('@/hooks/use-auth')
  vi.mocked(useAuth).mockReturnValue({ ... signIn: mockSignIn ... })
  // mockSignIn retorna { error: 'Invalid login credentials' }
  // ... digita e clica
  expect(await screen.findByText('A senha está incorreta. Tente novamente.')).toBeInTheDocument()
})
```

**Conceitos que caem em entrevista**:
- **Mock** = substituir uma dependência por uma falsa controlada (isolar o que se testa).
- **`vi.mocked(...).mockReturnValue(...)`** = mudar o comportamento do mock por teste.
- **`findByText`** (async) vs `getByText` (sync): usar `find` quando a resposta é
  assíncrona (o texto só aparece depois do click + await).
- **Testar o que o usuário vê**, não detalhes internos.

## CONCEITO — O que os mocks NÃO testam

Mocks isolam — então o teste de Login NÃO verifica se o Supabase funciona, nem se
a validação do Turnstile está certa. Isso é por design: cada camada tem seu teste.
O que o teste de Login garante: **dado um resultado do hook, a UI reage certo**.

## NO CÓDIGO — `src/test/compress-image.test.ts`

Testa a compressão de imagem (canvas). Esse tipo de teste precisa de DOM — o Vitest
usa **jsdom** (DOM simulado em Node). O setup está em `src/test/setup.ts`
(importa `@testing-library/jest-dom` para matchers como `toBeInTheDocument`).

## CONCEITO — Ferramentas do ecossistema

- **Vitest**: runner de testes (configuração via `vitest.config.ts`), roda em Node.
- **jsdom**: DOM falso para testes de componente.
- **Testing Library**: APIs (`render`, `screen`, `userEvent`) que incentivam testar
  como o usuário usa.
- **jest-dom**: matchers extras (`toBeInTheDocument`, `toHaveAttribute`).

## PRATICAR

1. Rode `npx vitest run` — confirme 30 testes passando.
2. Escreva um teste para `formatDateShort('2026-07-30')` seguindo o padrão de
   `utils.test.ts`. Rode e veja passar.
3. No `Login.test.tsx`, mude o mock de `checkEmailExists` para `false` e explique
   qual teste cobre o e-mail não registrado. Depois desfaça.
4. Quebre o `Login` de propósito (troque o texto do botão) e rode o teste — veja o
   erro. Conserte.

## ENTREVISTA — perguntas típicas

**"Qual a diferença entre mock, stub e spy?"**
Estrutura: (1) stub: retorna dados fixos, não verifica chamadas; (2) mock: como
stub, mas também verifica interações (foi chamado com o quê); (3) spy: envolve a
função real e observa chamadas; (4) no PostUp usamos `vi.fn()` (mock/stub) para
isolar o Supabase; (5) Testing Library incentiva asserções no resultado visível,
não em spies de interação.

**"Como você testa uma página que depende de uma API?"**
Estrutura: (1) mock da camada de dados (hook/Supabase); (2) renderizar com router
quando houver links; (3) simular interação com `userEvent`; (4) asserir no que o
usuário vê; (5) exemplo real: `Login.test.tsx` mocka `useAuth` e testa erros de
senha/e-mail/3 tentativas.

**"O que é a pirâmide de testes e onde seu projeto se encaixa?"**
Estrutura: (1) explicar as 3 camadas (unit → componente → E2E); (2) custo x valor
de cada uma; (3) o PostUp tem 30 testes entre unit e componente; (4) falta E2E —
seria o próximo passo natural; (5) por que não ter SÓ testes unitários nem SÓ E2E.

**Anterior**: [`12-git-cicd.md`](12-git-cicd.md) · **Próximo**: [`14-entrevista.md`](14-entrevista.md)
