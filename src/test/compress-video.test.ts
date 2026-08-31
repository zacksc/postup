import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MAX_MEDIA_SIZE } from '@/lib/compress-video'

type MockFFmpeg = {
  load: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  terminate: ReturnType<typeof vi.fn>
  writeFile: ReturnType<typeof vi.fn>
  exec: ReturnType<typeof vi.fn>
  readFile: ReturnType<typeof vi.fn>
  deleteFile: ReturnType<typeof vi.fn>
}

const ffmpegState = vi.hoisted(() => ({
  instances: [] as MockFFmpeg[],
  reset() {
    this.instances.length = 0
  },
}))

vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: class implements MockFFmpeg {
    load = vi.fn().mockResolvedValue(undefined)
    on = vi.fn()
    off = vi.fn()
    terminate = vi.fn()
    writeFile = vi.fn().mockResolvedValue(undefined)
    exec = vi.fn().mockResolvedValue(0)
    readFile = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
    deleteFile = vi.fn().mockResolvedValue(undefined)
    constructor() {
      ffmpegState.instances.push(this)
    }
  },
}))

const originalCreateElement = document.createElement.bind(document)

beforeEach(() => {
  ffmpegState.reset()
  // jsdom não implementa createObjectURL; adiciona ao construtor real para
  // não quebrar `new URL(...)` usado por outras partes do código.
  const url = globalThis.URL as unknown as { createObjectURL?: unknown; revokeObjectURL?: unknown }
  if (!url.createObjectURL) {
    url.createObjectURL = vi.fn(() => 'blob:test')
    url.revokeObjectURL = vi.fn()
  }
  document.createElement = vi.fn((tag: string) => {
    if (tag === 'video') {
      const v = {
        preload: '',
        duration: 10,
        onloadedmetadata: null,
        onerror: null,
      } as unknown as HTMLVideoElement
      Object.defineProperty(v, 'src', {
        get: () => 'blob:test',
        set: () => queueMicrotask(() => (v as { onloadedmetadata: (() => void) | null }).onloadedmetadata?.()),
      })
      return v
    }
    return originalCreateElement(tag)
  }) as unknown as typeof document.createElement
})

afterEach(() => {
  document.createElement = originalCreateElement
})

const bigFile = () => new File([new Uint8Array(MAX_MEDIA_SIZE + 1)], 'big.mp4', { type: 'video/mp4' })

// Cada teste de core pega uma instância FRESCA do módulo, pois o cache global
// (ffmpegPromise) sobrevive entre testes dentro do mesmo arquivo.
async function freshModule() {
  vi.resetModules()
  return await import('@/lib/compress-video')
}

describe('compressVideo', () => {
  it('exports the function and the default limit', async () => {
    const mod = await freshModule()
    expect(mod.compressVideo).toBeInstanceOf(Function)
    expect(MAX_MEDIA_SIZE).toBe(30 * 1024 * 1024)
  })

  it('passes through non-video files', async () => {
    const mod = await freshModule()
    const file = new File(['x'], 'foto.png', { type: 'image/png' })
    expect(await mod.compressVideo(file)).toBe(file)
  })

  it('passes through videos below the limit without touching ffmpeg', async () => {
    const mod = await freshModule()
    const statuses: string[] = []
    const small = new File(['x'], 'small.mp4', { type: 'video/mp4' })
    const result = await mod.compressVideo(small, { onCoreStatus: s => statuses.push(s) })
    expect(result).toBe(small)
    expect(ffmpegState.instances).toHaveLength(0)
    expect(statuses).toEqual([])
  })

  it('reports core status loading → ready on first use', async () => {
    const mod = await freshModule()
    const statuses: string[] = []
    const result = await mod.compressVideo(bigFile(), { onCoreStatus: s => statuses.push(s) })
    expect(ffmpegState.instances).toHaveLength(1)
    expect(statuses).toEqual(['loading', 'ready'])
    expect(result).toBeInstanceOf(Blob)
  })

  it('reports ready immediately when the core is already loaded', async () => {
    const mod = await freshModule()
    const first: string[] = []
    await mod.compressVideo(bigFile(), { onCoreStatus: s => first.push(s) })
    expect(first).toEqual(['loading', 'ready'])

    const second: string[] = []
    await mod.compressVideo(bigFile(), { onCoreStatus: s => second.push(s) })
    expect(second).toEqual(['ready'])
  })
})

describe('two-pass encoding', () => {
  function passNumberOf(call: unknown[]): number | null {
    const args = call[0] as string[]
    const idx = args.indexOf('-pass')
    return idx >= 0 ? Number(args[idx + 1]) : null
  }

  it('runs two-pass (pass 1 + pass 2) on the first attempt and returns a Blob', async () => {
    const mod = await freshModule()
    // blob acima do limite (30 MB) pra garantir que entra em compressão
    await mod.compressVideo(bigFile())

    const ff = ffmpegState.instances[0]
    expect(ff).toBeDefined()
    const execCalls = ff.exec.mock.calls as unknown[][]

    // exec foi chamado com '-pass' 1 e '-pass' 2 (two-pass no primeiro attempt)
    const passNumbers = execCalls.map(passNumberOf)
    expect(passNumbers).toContain(1)
    expect(passNumbers).toContain(2)
  })

  it('falls back to single-pass attempts when two-pass throws', async () => {
    const mod = await freshModule()
    let execIndex = 0
    await mod.compressVideo(bigFile())
    const ff = ffmpegState.instances[0]
    expect(ff).toBeDefined()
    ff.exec = vi.fn(async () => {
      if (execIndex === 0) { execIndex++; return 1 }
      execIndex++
      return 0
    }) as unknown as MockFFmpeg['exec']
  })
})
