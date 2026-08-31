// Copia o ffmpeg.wasm core (single-threaded) para public/ffmpeg/ para servir
// do próprio domínio (evita CDN externa e conflitos com a CSP).
// Roda no postinstall para que CI/cloud build sempre tenham os arquivos.
import { copyFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'node_modules/@ffmpeg/core/dist/esm')
const dest = resolve(root, 'public/ffmpeg')

mkdirSync(dest, { recursive: true })

for (const f of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
  copyFileSync(resolve(src, f), resolve(dest, f))
}

console.log('[copy-ffmpeg] ffmpeg core copied to public/ffmpeg')
