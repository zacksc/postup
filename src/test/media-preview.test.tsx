import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { MediaPreview } from '@/components/post/MediaPreview'
import { useVideoPoster } from '@/hooks/use-video-poster'

vi.mock('@/hooks/use-video-poster')

const DRIVE_VIDEO = 'https://drive.google.com/uc?id=abc123&export=download&type=video'
const DRIVE_IMAGE = 'https://drive.google.com/uc?id=img456&export=download'
const R2_VIDEO = 'https://pub-xxx.r2.dev/videos%2Fabc.mp4'

beforeEach(() => {
  vi.mocked(useVideoPoster).mockReturnValue(null)
})

describe('MediaPreview (fallback de mídia)', () => {
  it('renders a <video> for a Drive video URL', () => {
    const { container } = render(<MediaPreview url={DRIVE_VIDEO} />)
    expect(container.querySelector('video')).toBeInTheDocument()
    expect(container.querySelector('video')?.getAttribute('src')).toBe(DRIVE_VIDEO)
  })

  it('renders an <img> for an image URL', () => {
    const { container } = render(<MediaPreview url={DRIVE_IMAGE} />)
    expect(container.querySelector('img')).toBeInTheDocument()
    expect(container.querySelector('img')?.getAttribute('src')).toBe(DRIVE_IMAGE)
  })

  it('falls back to the Drive thumbnail when a Drive video fails to load', () => {
    const { container } = render(<MediaPreview url={DRIVE_VIDEO} />)
    const video = container.querySelector('video')!
    fireEvent.error(video)

    const img = container.querySelector('img')
    expect(img).toBeInTheDocument()
    expect(img?.getAttribute('src')).toBe('https://drive.google.com/thumbnail?id=abc123&sz=w640')
  })

  it('shows a placeholder when the Drive thumbnail also fails', () => {
    const { container } = render(<MediaPreview url={DRIVE_VIDEO} />)
    fireEvent.error(container.querySelector('video')!)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('[class*="bg-muted"]')).toBeInTheDocument()
  })

  it('shows a placeholder when a non-Drive image fails', () => {
    const { container } = render(<MediaPreview url="https://cdn.example.com/quebrada.png" />)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('[class*="bg-muted"]')).toBeInTheDocument()
  })

  it('uses the Drive thumbnail as poster for Drive videos', () => {
    const { container } = render(<MediaPreview url={DRIVE_VIDEO} />)
    expect(container.querySelector('video')?.getAttribute('poster')).toBe(
      'https://drive.google.com/thumbnail?id=abc123&sz=w640',
    )
  })

  it('uses the extracted frame as poster for R2 videos', () => {
    vi.mocked(useVideoPoster).mockReturnValue('blob:frame-123')
    const { container } = render(<MediaPreview url={R2_VIDEO} />)
    expect(useVideoPoster).toHaveBeenCalledWith(R2_VIDEO)
    expect(container.querySelector('video')?.getAttribute('poster')).toBe('blob:frame-123')
  })

  it('falls back to the extracted frame when an R2 video fails to load', () => {
    vi.mocked(useVideoPoster).mockReturnValue('blob:frame-123')
    const { container } = render(<MediaPreview url={R2_VIDEO} />)
    fireEvent.error(container.querySelector('video')!)
    const img = container.querySelector('img')
    expect(img).toBeInTheDocument()
    expect(img?.getAttribute('src')).toBe('blob:frame-123')
  })

  it('shows a placeholder when the extracted frame also fails', () => {
    vi.mocked(useVideoPoster).mockReturnValue('blob:frame-123')
    const { container } = render(<MediaPreview url={R2_VIDEO} />)
    fireEvent.error(container.querySelector('video')!)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('[class*="bg-muted"]')).toBeInTheDocument()
  })

  it('renders nothing when there is no url', () => {
    const { container } = render(<MediaPreview url={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('resets the failure state when the url changes', () => {
    const { container, rerender } = render(<MediaPreview url={DRIVE_VIDEO} />)
    fireEvent.error(container.querySelector('video')!)
    expect(container.querySelector('img')).toBeInTheDocument()

    rerender(<MediaPreview url="https://cdn.example.com/outra.png" />)
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toBe('https://cdn.example.com/outra.png')
  })

})

describe('MediaPreview (modo thumbnail)', () => {
  it('nunca renderiza <video> para vídeo — mostra imagem estática com a capa', () => {
    const { container } = render(<MediaPreview url={R2_VIDEO} poster="capa.jpg" thumbnail />)
    expect(container.querySelector('video')).not.toBeInTheDocument()
    const img = container.querySelector('img')
    expect(img).toBeInTheDocument()
    expect(img?.getAttribute('src')).toBe('capa.jpg')
  })

  it('usa o frame extraído como miniatura quando não há capa enviada', () => {
    vi.mocked(useVideoPoster).mockReturnValue('blob:frame-123')
    const { container } = render(<MediaPreview url={R2_VIDEO} thumbnail />)
    expect(container.querySelector('video')).not.toBeInTheDocument()
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toBe('blob:frame-123')
  })

  it('usa a thumbnail do Drive como miniatura para vídeo do Drive', () => {
    const { container } = render(<MediaPreview url={DRIVE_VIDEO} thumbnail />)
    expect(container.querySelector('video')).not.toBeInTheDocument()
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toBe('https://drive.google.com/thumbnail?id=abc123&sz=w640')
  })

  it('mostra placeholder com ícone quando não há capa nem frame', () => {
    vi.mocked(useVideoPoster).mockReturnValue(null)
    const { container } = render(<MediaPreview url={R2_VIDEO} thumbnail />)
    expect(container.querySelector('video')).not.toBeInTheDocument()
    expect(container.querySelector('[class*="bg-muted"]')).toBeInTheDocument()
  })

  it('mostra placeholder quando a capa falha ao carregar', () => {
    const { container } = render(<MediaPreview url={R2_VIDEO} poster="capa.jpg" thumbnail />)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('[class*="bg-muted"]')).toBeInTheDocument()
  })

  it('renderiza <img> normal para imagem no modo thumbnail', () => {
    const { container } = render(<MediaPreview url={DRIVE_IMAGE} thumbnail />)
    expect(container.querySelector('video')).not.toBeInTheDocument()
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toBe(DRIVE_IMAGE)
  })

  it('não extrai frame quando já há capa enviada', () => {
    vi.mocked(useVideoPoster).mockClear()
    render(<MediaPreview url={R2_VIDEO} poster="capa.jpg" thumbnail />)
    expect(useVideoPoster).toHaveBeenCalledWith(null)
  })
})
