import { compressVideo } from '@/lib/compress-video'

self.onmessage = async (e: MessageEvent) => {
  const { file, options, requestId } = e.data as {
    file: File
    options: Omit<Parameters<typeof compressVideo>[1], 'onProgress' | 'onCoreStatus' | 'onFallback'>
    requestId: string
  }

  const progressMessages = new Set<string>()

  try {
    const result = await compressVideo(file, {
      ...options,
      onProgress: p => {
        const msg = `progress:${p}`
        if (!progressMessages.has(msg)) {
          progressMessages.add(msg)
          self.postMessage({ requestId, progress: p, type: 'progress' })
        }
      },
      onCoreStatus: s => {
        self.postMessage({ requestId, coreStatus: s, type: 'coreStatus' })
      },
      onFallback: r => {
        self.postMessage({ requestId, fallback: r, type: 'fallback' })
      },
    })
    self.postMessage({ requestId, result, type: 'success' })
  } catch (err) {
    self.postMessage({
      requestId,
      error: err instanceof Error ? err.message : String(err),
      type: 'error',
    })
  }
}
