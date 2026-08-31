# Histórico de Problemas e Soluções - Postup Video Pipeline

## 1. Cloudflare Containers (não funcionou)

**Problema:** Containers requerem Workers Paid plan ($5/mês).

**Erro:** `Unauthorized` ao fazer push da imagem do container.

**Solução:** Abandonado. Usar Render free tier como alternativa.

---

## 2. ffmpeg.wasm no browser (não funciona para vídeos grandes)

**Problema:** `RuntimeError: memory access out of bounds` para vídeos >50MB.

**Causa:** O WASM tem limite de memória (~1GB). Um vídeo de 68MB + buffers do ffmpeg estouram esse limite.

**Solução parcial:** MediaRecorder como fallback (funciona, mas qualidade ruim).

**Solução final:** Serviço externo (Render) com ffmpeg nativo.

---

## 3. MediaRecorder no browser (qualidade ruim)

**Problema:** `ReferenceError: document is not defined` — MediaRecorder usa DOM (canvas, video) que não existe no Web Worker.

**Solução:** Mover MediaRecorder para a main thread.

**Novo problema:** Qualidade muito ruim (12.5MB de 68.4MB = redução excessiva).

**Causa:** Resolução era reduzida de 1080x1920 para 405x720.

**Solução:** Manter resolução original + bitrate calculado dinamicamente.

---

## 4. Render Dockerfile - arquivo não encontrado

**Erro:** `COPY server.js .: not found`

**Causa:** Render usa a raiz do repo como build context, não o diretório do Dockerfile.

**Solução:** Usar caminho completo: `COPY services/video-render/server.js .`

---

## 5. Render Dockerfile - npm ci sem package-lock.json

**Erro:** `npm ci can only install with an existing package-lock.json`

**Causa:** O serviço não tem dependências npm (usa só módulos nativos do Node.js).

**Solução:** Remover npm do Dockerfile entirely.

---

## 6. Render Dockerfile - npm ci sem package-lock.json

**Erro:** `npm ci can only install with an existing package-lock.json`

**Causa:** O serviço não tem dependências npm (usa só módulos nativos do Node.js).

**Solução:** Remover npm do Dockerfile entirely.

---

## 7. Vídeos ainda usavam compressão client-side

**Problema:** O NovoPost continuava chamando `compressVideoWorker` (client-side) em vez do Render.

**Solução:** Remover toda a lógica de compressão client-side do `post-save-job.ts`. Agora vídeos vão direto para o Render via edge function `video-process`.

**Fluxo final:**
1. Browser sobe vídeo no R2 (presigned URL)
2. Edge function cria job no Supabase
3. Edge function chama Render
4. Render baixa do R2 → processa → sobe App no R2 → sobe Cliente no Drive
5. Browser recebe status via Realtime

1. **Render free tier** como compute para ffmpeg (sem Oracle Cloud)
2. **Upload para R2 primeiro** (não upload direto pro Render)
3. **API Key compartilhada** para autenticação entre edge function e Render
4. **Duas versões de vídeo:** App (R2, ≤30MB) e Cliente (Drive, alta qualidade)
