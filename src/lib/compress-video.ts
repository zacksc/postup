import type { FFmpeg } from '@ffmpeg/ffmpeg'

/**
 * Limite de mídia por arquivo (30 MB por padrão; ajustável via VITE_MAX_MEDIA_SIZE).
 * É o teto que a compressão estratégica tenta respeitar — nunca o upload quebra
 * "arquivo grande demais" sem antes tentar caber nesse limite.
 */
export const MAX_MEDIA_SIZE = (Number(import.meta.env.VITE_MAX_MEDIA_SIZE) || 30) * 1024 * 1024

const AUDIO_BITRATE = 128 * 1024
const SAFETY_MARGIN = 0.85
const MAX_DIMENSION = 720
const RESOLUTION_LADDER = [540, 480, 360]

interface CompressVideoOptions {
  onProgress?: (progress: number) => void
  /** Avisa quando o core do ffmpeg (~30 MB) está sendo baixado/`load()`ado. */
  onCoreStatus?: (status: 'loading' | 'ready' | 'failed') => void
  /**
   * Avisa quando o vídeo volta do processo SEM compressão (será enviado com o
   * tamanho original). `ffmpeg-unavailable`: core não carregou (ex.: rede/memória
   * no mobile). `no-reduction`: todas as tentativas falharam ou não reduziram.
   */
  onFallback?: (reason: 'ffmpeg-unavailable' | 'no-reduction') => void
  /** Avisa quando uma tentativa de compressão falha com o motivo. */
  onError?: (message: string) => void
  maxDimension?: number
  targetSize?: number
  /**
   * Duração do vídeo em segundos. Quando fornecida (calculada na main thread),
   * o compressor usa bitrate dois-pass preciso ao invés da escada CRF, o que
   * é muito mais confiável para atingir o tamanho alvo. Sem essa opção (ex.: 
   * dentro de um Web Worker onde DOM não existe), a duração é 0 e o compressor
   * cai na escada CRF.
   */
  duration?: number
}

interface Attempt {
  dim: number
  bitrate?: number
  crf?: number
  twoPass?: boolean
}

type CoreListener = (status: 'loading' | 'ready' | 'failed') => void

const LOAD_RETRIES = 3
const LOAD_RETRY_DELAY_MS = 1500
const LOAD_TIMEOUT_MS = 45000

let ffmpegPromise: Promise<FFmpeg | null> | null = null
let coreListeners: CoreListener[] = []

function notifyCore(status: 'loading' | 'ready' | 'failed') {
  for (const listener of coreListeners) listener(status)
  if (status !== 'loading') coreListeners = []
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function loadFFmpegCore(): Promise<FFmpeg | null> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < LOAD_RETRIES; attempt++) {
    if (attempt > 0) await delay(LOAD_RETRY_DELAY_MS)
    try {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg')
      const ffmpeg = new FFmpeg()
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout ao carregar o compressor de vídeo')), LOAD_TIMEOUT_MS)
      )
      await Promise.race([ffmpeg.load({
        coreURL: '/ffmpeg/ffmpeg-core.js',
        wasmURL: '/ffmpeg/ffmpeg-core.wasm',
      }), timeout])
      return ffmpeg
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[compress-video] tentativa ${attempt + 1}/${LOAD_RETRIES} falhou:`, lastError.message)
    }
  }
  console.error('[compress-video] todas as tentativas falharam:', lastError?.message)
  return null
}

function getFFmpeg(onStatus?: CoreListener): Promise<FFmpeg | null> {
  if (onStatus) {
    if (ffmpegPromise) {
      ffmpegPromise.then(ff => onStatus(ff ? 'ready' : 'failed')).catch(() => onStatus('failed'))
    } else {
      coreListeners.push(onStatus)
    }
  }
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      try {
        notifyCore('loading')
         const ffmpeg = await loadFFmpegCore()
        if (ffmpeg) {
          notifyCore('ready')
        } else {
          notifyCore('failed')
        }
        return ffmpeg
      } catch {
        notifyCore('failed')
        ffmpegPromise = null
        return null
      }
    })()
  }
  return ffmpegPromise
}

function getVideoExt(name: string): string {
  const m = name.match(/\.[^.]+$/)
  return (m?.[0] || '.mp4').toLowerCase()
}

/**
 * Lê a duração de um vídeo via <video> (metadata, barato — não baixa o ffmpeg).
 * Retorna 0 se não conseguir (ex.: codec estranho); nesse caso o encoder
 * cai na escada por CRF, sem bitrate calculado.
 */
function getVideoDuration(blob: Blob): Promise<number> {
  return new Promise(resolve => {
    try {
      const url = URL.createObjectURL(blob)
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        resolve(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0)
        URL.revokeObjectURL(url)
      }
      video.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(0)
      }
      video.src = url
    } catch {
      resolve(0)
    }
  })
}

/**
 * Bitrate total necessário para caber em `targetBytes` dentro de `durationSec`.
 * Subtrai o bitrate de áudio; retorna 0 se inviável.
 */
function calcVideoBitrate(durationSec: number, targetBytes: number): number {
  if (!durationSec || durationSec <= 0) return 0
  const total = (targetBytes * 8) / durationSec
  return Math.max(0, Math.round(total - AUDIO_BITRATE))
}

/**
 * Monta a escada de tentativas, da maior qualidade para a menor:
 * primeiro bitrate calculado (quando há duração); sem duração, CRF crescente.
 * Depois reduz resolução e/ou bitrate até o limite.
 */
function buildAttempts(maxDimension: number, bitrate: number): Attempt[] {
  const dims = [maxDimension, ...RESOLUTION_LADDER.filter(d => d < maxDimension)]
  const attempts: Attempt[] = []

  if (bitrate > 0) {
    // A primeira tentativa é a mais precisa: two-pass com o bitrate calculado
    // pra caber no alvo (±5%). As seguintes são single-pass com fatores menores,
    // pra casos onde o two-pass estourou mesmo assim (ex.: sobrecarga de áudio).
    attempts.push({ dim: maxDimension, bitrate, twoPass: true })
    const factors = [0.85, 0.7, 0.5, 0.35]
    for (const factor of factors) {
      attempts.push({ dim: maxDimension, bitrate: Math.round(bitrate * factor) })
    }
    for (const dim of dims.slice(1)) {
      attempts.push({ dim, bitrate: Math.round(bitrate * 0.35) })
    }
  } else {
    for (const dim of dims) {
      for (const crf of [28, 32, 36, 40]) {
        attempts.push({ dim, crf })
      }
    }
  }
  return attempts.slice(0, 8)
}

function encodeAttempt(
  ffmpeg: FFmpeg,
  file: File,
  attempt: Attempt,
  inputName: string,
  outputName: string,
): Promise<Blob> {
  const args = [
    '-i', inputName,
    '-vf', `scale=min(${attempt.dim}\\,iw):min(${attempt.dim}\\,ih):force_original_aspect_ratio=decrease`,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    '-y',
    outputName,
  ]

  if (attempt.bitrate) {
    args.splice(-1, 0,
      '-b:v', String(attempt.bitrate),
      '-maxrate', String(Math.round(attempt.bitrate * 1.2)),
      '-bufsize', String(Math.round(attempt.bitrate * 2)),
    )
  } else {
    args.splice(-1, 0, '-crf', String(attempt.crf))
  }

  return (async () => {
    await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()))
    const exitCode = await ffmpeg.exec(args)
    if (exitCode !== 0) throw new Error(`ffmpeg exit code ${exitCode}`)
    const data = (await ffmpeg.readFile(outputName)) as Uint8Array
    await ffmpeg.deleteFile(inputName).catch(() => {})
    await ffmpeg.deleteFile(outputName).catch(() => {})
    return new Blob([data.slice()], { type: 'video/mp4' })
  })()
}

/**
 * Encode em TWO-PASS (análise + encode final). O Pass 1 coleta estatísticas de
 * complexidade do vídeo em um arquivo de log; o Pass 2 usa esse log pra distribuir
 * os bits e chegar MUITO perto do tamanho alvo (±5%), coisa que single-pass com
 * `-b:v` não garante (estoura fácil em cenas complexas). Dobra o tempo, mas só é
 * usado na primeira tentativa, a mais importante.
 */
function encodeAttemptTwoPass(
  ffmpeg: FFmpeg,
  file: File,
  bitrate: number,
  dim: number,
  inputName: string,
  outputName: string,
): Promise<Blob> {
  const passLogName = `ffmpeg2pass-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const vf = `scale=min(${dim}\\,iw):min(${dim}\\,ih):force_original_aspect_ratio=decrease`
  const videoArgs = [
    '-i', inputName,
    '-vf', vf,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-b:v', String(bitrate),
    '-maxrate', String(Math.round(bitrate * 1.2)),
    '-bufsize', String(Math.round(bitrate * 2)),
    '-passlogfile', passLogName,
  ]

  // Pass 1: análise, sem áudio, sem gerar arquivo de saída útil.
  const pass1Args = [
    ...videoArgs,
    '-pass', '1',
    '-an',
    '-f', 'mp4',
    '-y',
    `${outputName}.pass1`,
  ]

  // Pass 2: encode final com áudio, lendo o log do Pass 1.
  const pass2Args = [
    ...videoArgs,
    '-pass', '2',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    '-y',
    outputName,
  ]

  return (async () => {
    await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()))
    const exit1 = await ffmpeg.exec(pass1Args)
    if (exit1 !== 0) throw new Error(`ffmpeg pass 1 exit code ${exit1}`)
    const exit2 = await ffmpeg.exec(pass2Args)
    if (exit2 !== 0) throw new Error(`ffmpeg pass 2 exit code ${exit2}`)
    const data = (await ffmpeg.readFile(outputName)) as Uint8Array
    // Limpa tudo, incluindo o log do pass 1 e o arquivo descartado do pass 1.
    await Promise.allSettled([
      ffmpeg.deleteFile(inputName),
      ffmpeg.deleteFile(outputName),
      ffmpeg.deleteFile(`${outputName}.pass1`),
      ffmpeg.deleteFile(`${passLogName}-0.log`),
      ffmpeg.deleteFile(`${passLogName}-0.log.mbtree`),
    ])
    return new Blob([data.slice()], { type: 'video/mp4' })
  })()
}

/**
 * Comprime um vídeo no navegador (H.264/AAC) de forma ESTRATÉGICA: calcula o
 * bitrate a partir da duração para caber dentro de `targetSize` (30 MB padrão)
 * e, se o resultado ainda estourar, tenta uma escada de resoluções/bitrates
 * menores — só devolve o arquivo original como último recurso.
 *
 * - Nunca faz upscaling (`min(...)` na escala).
 * - Abaixo do limite (30 MB) mantém o vídeo original.
 * - Devolve o MENOR resultado obtido mesmo se não couber (melhor que erro).
 * - Se o ffmpeg.wasm falhar, tenta usar a MediaRecorder API como fallback.
 */
export async function compressVideo(file: File, options: CompressVideoOptions = {}): Promise<Blob> {
  const maxDimension = options.maxDimension ?? MAX_DIMENSION
  const targetSize = options.targetSize ?? MAX_MEDIA_SIZE

  if (!file.type.startsWith('video/')) return file
  if (file.size <= targetSize) return file

  console.log(`[compress-video] Iniciando: ${(file.size / 1024 / 1024).toFixed(1)}MB, target: ${(targetSize / 1024 / 1024).toFixed(0)}MB`)

  const ffmpeg = await getFFmpeg(options.onCoreStatus)
  if (!ffmpeg) {
    console.error('[compress-video] ffmpeg.wasm não pôde ser carregado')
    options.onFallback?.('ffmpeg-unavailable')
    return file
  }

  const onProgress = options.onProgress
  const targetBytes = targetSize * SAFETY_MARGIN
  const duration = options.duration ?? await getVideoDuration(file)
  const bitrate = calcVideoBitrate(duration, targetBytes)
  const attempts = buildAttempts(maxDimension, bitrate)

  console.log(`[compress-video] Duração: ${duration}s, bitrate: ${bitrate}kbps, tentativas: ${attempts.length}`)

  let best: Blob | null = null
  let progressListener: ((data: { progress: number }) => void) | null = null

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i]
    console.log(`[compress-video] Tentativa ${i + 1}/${attempts.length}: dim=${attempt.dim} bitrate=${attempt.bitrate || 'N/A'} twoPass=${!!attempt.twoPass} crf=${attempt.crf || 'N/A'}`)
    let encoded: Blob | null = null
    for (let retry = 0; retry < 2; retry++) {
      try {
        const inputName = `input-${Date.now()}-${i}-${retry}${getVideoExt(file.name)}`
        const outputName = `output-${Date.now()}-${i}-${retry}.mp4`

        if (onProgress) {
          const span = 1 / attempts.length
          progressListener = (data: { progress: number }) => {
            onProgress(Math.min(1, Math.max(0, i * span + data.progress * span)))
          }
          ffmpeg.on('progress', progressListener)
        }

        encoded = attempt.twoPass && attempt.bitrate
          ? await encodeAttemptTwoPass(ffmpeg, file, attempt.bitrate, attempt.dim, inputName, outputName)
          : await encodeAttempt(ffmpeg, file, attempt, inputName, outputName)

        if (progressListener) { try { ffmpeg.off('progress', progressListener) } catch { /* ignore */ } }
        progressListener = null
        break
      } catch (err) {
        if (progressListener) { try { ffmpeg.off('progress', progressListener) } catch { /* ignore */ } }
        progressListener = null
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[compress-video] Tentativa ${i + 1}${retry > 0 ? ` retry ${retry}` : ''} falhou:`, msg)
        options.onError?.(`Tentativa ${i + 1}${retry > 0 ? ` (retry ${retry})` : ''}: ${msg}`)
        if (retry === 0) continue
      }
    }

    if (encoded) {
      console.log(`[compress-video] Tentativa ${i + 1}: ${(encoded.size / 1024 / 1024).toFixed(1)}MB (target: ${(targetSize / 1024 / 1024).toFixed(0)}MB)`)
      if (!best || encoded.size < best.size) best = encoded
      if (encoded.size <= targetSize) return encoded
    } else {
      console.warn(`[compress-video] Tentativa ${i + 1}: encoding falhou`)
    }
  }

  try { ffmpeg.terminate() } catch { /* ignore */ }
  ffmpegPromise = null

  if (best && best.size < file.size) return best

  console.warn(`[compress-video] ffmpeg.wasm não reduziu: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`)
  options.onFallback?.('no-reduction')
  return file
}
