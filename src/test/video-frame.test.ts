import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateVideoFrame, generateVideoFrameFromUrl } from '@/lib/video-frame'

interface MockVideo {
  src: string
  muted: boolean
  playsInline: boolean
  preload: string
  duration: number
  videoWidth: number
  videoHeight: number
  currentTime: number
  onloadedmetadata: (() => void) | null
  onerror: ((e?: unknown) => void) | null
  onseeked: (() => void) | null
  load: ReturnType<typeof vi.fn>
}

const defaultVideo = (): MockVideo => {
  const video: MockVideo = {
    src: '',
    muted: false,
    playsInline: false,
    preload: '',
    duration: 10,
    videoWidth: 1920,
    videoHeight: 1080,
    currentTime: 0,
    onloadedmetadata: null,
    onerror: null,
    onseeked: null,
    load: vi.fn(),
  }
  let t = 0
  // No navegador o seek é assíncrono: o handler `onseeked` é atribuído logo
  // depois do setter, então disparamos em microtask (não de forma síncrona).
  Object.defineProperty(video, 'currentTime', {
    get: () => t,
    set: (v: number) => {
      t = v
      queueMicrotask(() => video.onseeked?.())
    },
  })
  return video
}

let video: MockVideo
let originalCreateElement: typeof document.createElement

const stubDom = (opts: { canvasBlob?: Blob | null } = {}) => {
  document.createElement = vi.fn((tag: string): HTMLElement => {
    if (tag === 'video') return video as unknown as HTMLVideoElement
    if (tag === 'canvas') {
      return {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({ drawImage: vi.fn() })),
        toBlob: (cb: (b: Blob | null) => void) =>
          cb(opts.canvasBlob === undefined ? new Blob(['frame'], { type: 'image/jpeg' }) : opts.canvasBlob),
      } as unknown as HTMLCanvasElement
    }
    return originalCreateElement(tag)
  }) as unknown as typeof document.createElement

  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:mock-video'),
    revokeObjectURL: vi.fn(),
  })
}

beforeEach(() => {
  video = defaultVideo()
  originalCreateElement = document.createElement.bind(document)
  stubDom()
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.createElement = originalCreateElement
})

describe('generateVideoFrame', () => {
  it('returns null for non-video files', async () => {
    const file = new File(['x'], 'foto.png', { type: 'image/png' })
    expect(await generateVideoFrame(file)).toBeNull()
  })

  it('extracts a JPEG frame from a mocked video', async () => {
    const file = new File(['x'], 'reel.mp4', { type: 'video/mp4' })
    video.load = vi.fn(() => video.onloadedmetadata?.())

    const blob = await generateVideoFrame(file)

    expect(blob).toBeInstanceOf(Blob)
    expect(blob?.type).toBe('image/jpeg')
    expect(video.currentTime).toBeGreaterThan(0)
  })

  it('returns null when the video fails to load', async () => {
    const file = new File(['x'], 'reel.mp4', { type: 'video/mp4' })
    video.load = vi.fn(() => video.onerror?.(new Error('load failed')))

    expect(await generateVideoFrame(file)).toBeNull()
  })

  it('returns null when the video has no dimensions', async () => {
    const file = new File(['x'], 'reel.mp4', { type: 'video/mp4' })
    video.load = vi.fn(() => video.onloadedmetadata?.())
    video.videoWidth = 0
    video.videoHeight = 0

    expect(await generateVideoFrame(file)).toBeNull()
  })

  it('returns null when canvas produces no blob', async () => {
    stubDom({ canvasBlob: null })
    const file = new File(['x'], 'reel.mp4', { type: 'video/mp4' })
    video.load = vi.fn(() => video.onloadedmetadata?.())

    expect(await generateVideoFrame(file)).toBeNull()
  })
})

describe('generateVideoFrameFromUrl', () => {
  it('returns null when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    expect(await generateVideoFrameFromUrl('https://exemplo.com/video.mp4')).toBeNull()
  })

  it('returns null when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    expect(await generateVideoFrameFromUrl('https://exemplo.com/video.mp4')).toBeNull()
  })

  it('delegates to generateVideoFrame on success', async () => {
    const blobFromUrl = new Blob(['video-bytes'], { type: 'video/mp4' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => blobFromUrl }))
    video.load = vi.fn(() => video.onloadedmetadata?.())

    const result = await generateVideoFrameFromUrl('https://exemplo.com/video.mp4')

    expect(result).toBeInstanceOf(Blob)
    expect(video.load).toHaveBeenCalled()
  })
})
