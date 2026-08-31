import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MediaLightbox, type LightboxItem } from '@/components/post/MediaLightbox'

const items: LightboxItem[] = [
  { url: 'capa.jpg', mediaType: 'image' },
  { url: 'reel.mp4', mediaType: 'video' },
  { url: 'foto.png', mediaType: 'image' },
]

function renderLightbox(overrides: Partial<Parameters<typeof MediaLightbox>[0]> = {}) {
  return render(
    <MediaLightbox open items={items} onOpenChange={vi.fn()} startIndex={0} {...overrides} />
  )
}

describe('MediaLightbox (carrossel)', () => {
  it('renders nothing when there are no items', () => {
    render(<MediaLightbox open items={[]} onOpenChange={vi.fn()} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows the counter based on the start index', () => {
    renderLightbox({ startIndex: 1 })
    expect(screen.getByText('2/3')).toBeInTheDocument()
  })

  it('advances with the next button and wraps around', () => {
    renderLightbox()
    expect(screen.getByText('1/3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Próxima mídia' }))
    expect(screen.getByText('2/3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Próxima mídia' }))
    expect(screen.getByText('3/3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Próxima mídia' }))
    expect(screen.getByText('1/3')).toBeInTheDocument()
  })

  it('goes back with the previous button and wraps around', () => {
    renderLightbox({ startIndex: 1 })
    expect(screen.getByText('2/3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Mídia anterior' }))
    expect(screen.getByText('1/3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Mídia anterior' }))
    expect(screen.getByText('3/3')).toBeInTheDocument()
  })

  it('navigates with the arrow keys', () => {
    renderLightbox()
    expect(screen.getByText('1/3')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('2/3')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('1/3')).toBeInTheDocument()
  })

  it('resets the index when the start index prop changes', () => {
    const { rerender } = renderLightbox({ startIndex: 1 })
    expect(screen.getByText('2/3')).toBeInTheDocument()

    rerender(
      <MediaLightbox open items={items} onOpenChange={vi.fn()} startIndex={0} />
    )
    expect(screen.getByText('1/3')).toBeInTheDocument()
  })

  it('uses the Drive embed player for Drive video URLs', () => {
    const driveItems: LightboxItem[] = [
      { url: 'https://drive.google.com/uc?id=abc123&export=download&type=video', mediaType: 'video' },
    ]
    render(<MediaLightbox open items={driveItems} onOpenChange={vi.fn()} startIndex={0} />)

    const iframe = document.querySelector('iframe')
    expect(iframe).toBeInTheDocument()
    expect(iframe?.getAttribute('src')).toBe('https://drive.google.com/file/d/abc123/preview')
    expect(document.querySelector('video')).not.toBeInTheDocument()
  })

  it('keeps the native <video> for non-Drive video URLs', () => {
    const localItems: LightboxItem[] = [
      { url: 'https://pub.example.com/reel.mp4', mediaType: 'video' },
    ]
    render(<MediaLightbox open items={localItems} onOpenChange={vi.fn()} startIndex={0} />)

    expect(document.querySelector('iframe')).not.toBeInTheDocument()
    expect(document.querySelector('video')).toBeInTheDocument()
  })
})
