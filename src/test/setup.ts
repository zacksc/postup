import '@testing-library/jest-dom/vitest'

// jsdom não implementa IntersectionObserver — PreviewMedia usa para pausar
// vídeos fora da viewport.
class IntersectionObserverMock {
  observe = () => {}
  unobserve = () => {}
  disconnect = () => {}
  takeRecords = () => []
  root = null
  rootMargin = ''
  thresholds = []
}

globalThis.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver

// jsdom não implementa o ciclo de vida de mídia — stubs para não derrubar
// os efeitos de PreviewMedia/MediaPreview.
const mediaProto = HTMLMediaElement.prototype as unknown as {
  play: () => Promise<void>
  pause: () => void
  load: () => void
}
mediaProto.play = () => Promise.resolve()
mediaProto.pause = () => {}
mediaProto.load = () => {}
