# 21 — Estudo de caso: storage de mídias — R2, Bring-Your-Own-Storage e o dilema do "usuário leigo"

> **Objetivo**: responder com números a pergunta "quanto tempo o R2 gratuito aguenta
> se eu usar sozinho / com 2 amigos / lançar em produção?" e avaliar a alternativa
> de **BYO storage** (o usuário conecta o próprio Google Drive/Dropbox/Cloudflare) para
> manter o custo do PostUp em **$0** mesmo com lançamento real — incluindo o dilema do
> usuário que não sabe fazer isso, e o que dá para prometer de verdade sobre privacidade.

```
Pergunta  → quanto tempo dura o free tier do R2 em cada cenário?
Método    → modelagem de consumo (imagem webp 200KB / reel 720p ~10MB) × usuários × tempo
Cenário A → sozinho | Cenário B → +2 amigos | Cenário C → launch público no free plan
Alternativa → BYO: Google Drive / Dropbox / R2 próprio (cotas reais + privacidade)
Dilema    → "forçar escolha" vs "storage temporário com expiração" vs "híbrido"
Recomendação → camada de storage abstrata AGORA; R2 na fase de testes; BYO no launch
```

---

## Parte 1 — Quanto tempo o R2 grátis aguenta?

### As premissas de consumo (valores realistas pós-compressão do PostUp)

O PostUp **não** armazena os arquivos originais: imagens viram webp (max 1920px, q0.82)
e vídeos >25MB são transcodificados para 720p (CRF 28, D15). Então o que conta é o
tamanho **comprimido**:

| Tipo | Tamanho comprimido (estimativa) |
|---|---|
| Foto (webp) | ~200 KB (100–400 KB) |
| Reel/vídeo (720p) | ~10 MB (5–15 MB) |
| Capa + anexos de feedback | ~1 MB extra por post |

Um usuário ativo realista (fazendo conteúdo de verdade) publica ~15 fotos + 15 reels/mês:

```
15 reels × 10 MB  = 150 MB
15 fotos × 0.2 MB =   3 MB
capa/anexos       =   7 MB
──────────────────────────
≈ 160 MB / mês / usuário ativo
```

> **Atenção — é cumulativo.** Storage não zera: o total só cresce a cada upload
> (a não ser que o usuário delete). "Dura X meses" = tempo até o total acumulado chegar
> em 10 GB, contado desde o dia 1 do app.

### Os limites que importam (e um que não importa)

| Limite R2 free | Valor | Importa? |
|---|---|---|
| Storage | 10 GB-mês | **SIM — é o gargalo** |
| Egress (saída) | $0 **sempre** | Não (vídeos servidos ao cliente não custam) |
| Classe A (uploads) | 1M/mês (~33k/dia) | Não (longe da realidade) |
| Classe B (leituras) | 10M/mês | Não |

Conclusão parcial: **o único limite relevante é storage = 10 GB cumulativos.**

### Cenário A — só você

```
10 GB ÷ 160 MB/mês ≈ 62 meses ≈ 5 ANOS
```

Mesmo que você seja um power user (300 MB/mês): ~2,7 anos. **Sozinho, o R2 gratuito
praticamente nunca estoura.**

### Cenário B — você + 2 amigos (3 usuários em testes reais)

Cada um com o ritmo de 160 MB/mês → total de ~480 MB/mês:

```
10 GB ÷ 480 MB/mês ≈ 21 meses ≈ 1,7 ANOS
```

Se os amigos forem pesados em vídeo (300 MB/mês cada → 900 MB/mês no total):
`10.000 MB ÷ 900 ≈ 11 meses`. **Para a fase de testes com 2–3 pessoas, o R2 aguenta
de ~1 a ~2 anos — tranquilo para o seu objetivo agora.**

### Cenário C — launch público mantendo o plano gratuito

Aqui o problema aparece de verdade: o crescimento é **linear com o número de usuários**,
e cada um adiciona ~160 MB/mês **para sempre**:

| Usuários ativos | Consumo mensal | Tempo até 10 GB |
|---|---|---|
| 10 | 1,6 GB/mês | ~6 meses |
| 20 | 3,2 GB/mês | ~3 meses |
| 50 | 8 GB/mês | ~6 semanas |
| 100 | 16 GB/mês | < 3 semanas |

> **Veredito**: o free tier do R2 é ótimo para **desenvolvimento, testes e os primeiros
> meses com poucos usuários**, mas **não sustenta um launch** — com 50 usuários ativos
> o bucket enche em semanas. É exatamente a sua preocupação: mesmo limitando upload a
> 30–40 MB, são 10 GB compartilhados entre todos.

**Ou seja**: a migração para o R2 (D19) resolve o problema **agora** (10× o Supabase),
mas para o launch a resposta é outra: **cada usuário guardar as próprias mídias** (BYO),
ou um plano pago seu, ou um híbrido.

---

## Parte 2 — A alternativa BYO (Bring Your Own Storage)

A ideia: em vez de todo mundo usar **o seu** bucket, cada usuário conecta **o próprio**
espaço de mídia. Você não paga storage de ninguém, e cada um tem a quota do próprio serviço.

### As cotas gratuitas reais (2026)

| Provedor | Quota free | Upload máx. | O que o app "enxerga" | Esforço p/ o leigo |
|---|---|---|---|---|
| **Google Drive** | **15 GB** (compartilhados c/ Gmail/Fotos) | até 5 TB, 750 GB/dia | só a pasta do app (`appDataFolder`/`drive.file`) | Baixo — "Conectar com Google" |
| **Dropbox** | 2 GB | 150 MB básico / 350 GB via sessão | só a pasta do app (app folder) | Baixo-médio |
| **Cloudflare R2 próprio** | 10 GB | sem limite prático | o próprio bucket do usuário | **Alto** (precisa conta + token + bucket) |

### Google Drive — o melhor custo-benefício para o leigo

- **15 GB por conta Google** — o usuário quase sempre já tem uma. "Conectar com Google"
  é o fluxo mais amigável possível.
- Escopos OAuth que resolvem a privacidade:
  - **`drive.appdata`** → o app grava numa **pasta oculta própria** do app, que nem o
    usuário vê no Drive dele. O app **não** enxerga nenhum outro arquivo do usuário.
  - **`drive.file`** → o app só acessa arquivos que **ele mesmo criou** (aparecem no
    Drive do usuário, mas invisíveis aos outros apps).
- Upload de vídeo via **upload resumable** (Drive API suporta arquivos grandes).

### Dropbox — candidato fraco

- Só **2 GB** e upload básico de 150 MB. Com vídeos, enche rápido. Serve como
  "segunda opção" para quem não tem Google, mas não resolve bem o problema de vídeo.

### R2 próprio (tokens do usuário) — privacidade máxima, barreira máxima

- O usuário cria o **próprio bucket R2** e cola os tokens no PostUp → você **não hospeda
  nada**, e ele tem 10 GB do **dele** (que não se misturam com os de ninguém).
- Perfeito para agência/usuário técnico: ilimitado em agregado (N usuários × 10 GB).
- **Mas**: exige conta Cloudflare, criar token, bucket... é exatamente o passo a passo
  que você acabou de montar para você mesmo. **Usuário leigo não faz isso.**

---

## Parte 3 — O que dá para prometer de verdade sobre privacidade

Você pediu: *"de forma que EU não tenha acesso aos dados dele para segurança e evitar
ataques desse tipo"*. Preciso ser honesto sobre o que é possível:

1. **Você NUNCA tem zero acesso, se o app servir a mídia.** A imagem/vídeo precisa ser
   exibida no PostUp (e no link de review do cliente, sem login). Para o navegador
   carregar, a URL tem que ser acessível — ou o seu servidor serve (então você tem acesso)
   ou é uma URL pública/assinada.
2. **O que dá para garantir de verdade: escopo.** Com `drive.appdata`/`drive.file`,
   você **não** lê a vida pessoal do usuário — você só toca a pasta do seu próprio app.
   O contrato de privacidade que você pode assinar é "acesso apenas à pasta da PostUp",
   não "eu não consigo ver nada".
3. **URLs públicas vs assinadas:** num bucket público (R2 atual), quem tem a URL vê o
   arquivo. Isso é aceitável para mídia de post (é conteúdo de marketing, não dado
   sensível). Se quiser reforço, usar **URLs assinadas (expiráveis)** tanto no R2 quanto
   no Drive — aí mesmo com a URL, o acesso expira. Mais seguro, um pouco mais de código.
4. **Tokens:** o refresh token do Google precisa ficar salvo (para o app continuar
   funcionando). Boa prática: guardar **criptografado** no Postgres (Supabase tem Vault).
   Tokens do R2 do usuário: nunca logar, nunca mandar pro bundle, guardar criptografados.

> **Resumo honesto**: o BYO com escopo `appdata`/`drive.file` dá **privacidade forte**
> ("só vejo a pasta da PostUp"), não **anonimato absoluto**. Para o seu caso, é o nível
> certo — e o "ataque" que você teme (ler dados pessoais do usuário) fica impossível.

---

## Parte 4 — O dilema do "usuário leigo": forçar escolha vs. storage temporário

O ponto que você mesmo levantou: *"e se o usuário for leigo demais para isso?"*. Três
modelos, comparados:

### Opção 1 — Forçar a escolha no cadastro
Na criação da conta: **"Conecte seu Google Drive para guardar suas mídias"** (obrigatório).

- ✅ Zero custo de storage seu, desde o dia 1. Sem lógica de expiração.
- ✅ O usuário entende o modelo desde o início (sem surpresa de "meu vídeo sumiu").
- ❌ **Fricção no onboarding** — o leigo que não quer conectar nada é barrado no portão.
- ❌ Conversão pior: usuário chega querendo testar e tem que dar permissão de cara.

### Opção 2 — Storage temporário no SEU R2 com aviso de expiração
Todo mundo pode usar o seu bucket; mídias marcadas como "temporárias" expiram
(ex.: após 1 mês) com aviso, se o usuário não conectar o próprio storage.

- ✅ **Zero fricção no onboarding** — "comece a usar, conecte seu Drive depois".
- ❌ **Não resolve o custo no launch**: com 50 usuários mantendo 1 mês de mídia no seu
  bucket, você carrega ~8 GB só de "temporário". O problema volta um mês depois.
- ❌ **Complexidade real**: job de limpeza (cron), notificação por e-mail, e o risco de
  ódio do usuário quando a mídia dele expira ("deletaram meu vídeo!").
- ❌ E o pior: você ainda paga o storage durante o período de graça de **todo mundo**.

### Opção 3 — Híbrido (recomendado): default grátis pequeno + BYO para crescer
Cada conta tem um **allowance pequeno no seu R2** (ex.: **500 MB**, com barra de uso
visível) para o usuário começar sem fricção. Para mais espaço (ou vídeos em volume),
**conecte Google Drive / seu R2**. Sem expiração agressiva — o limite é o allowance.

- ✅ Onboarding sem fricção (o leigo usa o app de cara com o allowance).
- ✅ **Custo controlado**: o allowance limita o seu risco. 100 usuários × 500 MB =
  50 GB — ainda muito; dá para ajustar para 250 MB e limpar mídias de post deletado.
- ✅ **Caminho de upgrade claro e natural**: "usou seu espaço? Conecte seu Drive."
- ✅ Forçar escolha vira opção, não portão.
- ❌ Mais lógica no app (contar bytes usados, barra de progresso) — mas é UI simples.

---

## Parte 5 — Recomendação (faseada)

| Fase | Storage | Por quê |
|---|---|---|
| **Agora (testes com amigos)** | **R2 seu (D19), 10 GB** | ~1–2 anos de folga com 3 usuários; implementação simples; já dá para validar tudo |
| **Launch (usuários reais)** | **BYO: Google Drive (15 GB/usuário) + R2 próprio (usuários técnicos)** + allowance opcional | você fica em $0; cada usuário usa a própria quota; leigos entram com "Conectar com Google" |
| **Escala** | Reavaliar (plano pago do app, ou B2+Cloudflare para quem quiser pagar por espaço extra) | decisão D19 "reavaliar quando": >10 GB |

### A decisão de implementação mais importante agora

Construir a camada de mídia como **provedor plugável** desde já:

```
media-storage.ts (interface única: upload(url) / publicUrl(path) / delete(path))
  ├─ provider: r2        → bucket do PostUp (default hoje)
  ├─ provider: gdrive    → pasta do usuário via OAuth (drive.appdata | drive.file)
  └─ provider: user-r2   → tokens do próprio usuário (avançado)
```

Isso é **barato de fazer agora** (a interface já está sendo criada para a migração R2 —
só adicionar a noção de "provedor") e **evita retrabalho**: quando o launch vier,
adicionar o Google Drive é implementar um provider, não refatorar os 6 arquivos de upload.

---

## Conclusão

1. **R2 gratuito** resolve a fase atual: ~5 anos sozinho, ~1–2 anos com 2 amigos,
   **semanas** em launch com dezenas de usuários.
2. **BYO é o caminho para o launch a $0** — e o **Google Drive (15 GB, escopo app-only)**
   é o melhor equilíbrio entre cotA e facilidade para o leigo. Dropbox é fraco (2 GB).
3. **Privacidade**: o promissível é **escopo** ("só vejo a pasta do app"), não
   **anonimato** — e URLs assinadas reforçam quando precisar.
4. **Para o leigo**: não forçar escolha nem expirar mídia agressivamente; usar
   **allowance pequeno no seu R2 + BYO como upgrade natural** (Opção 3).
5. **Ação agora**: migrar para R2 (D19) já resolvendo a interface como **provedor
   plugável**, para o Google Drive entrar como um provider novo no launch — sem retrabalho.

---

**Anterior**: [`20-preview-perfil-mockup.md`](20-preview-perfil-mockup.md) ·
**Relacionado**: decisão [`D19`](../docs/12-decisoes-alternativas.md) e plano de
migração [`16-storage-midias.md`](../docs/16-storage-midias.md)
