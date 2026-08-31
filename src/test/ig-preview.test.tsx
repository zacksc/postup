import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IgPreview } from '@/components/post/IgPreview'

function makePost(overrides: Partial<Parameters<typeof IgPreview>[0]['post']> = {}) {
  return {
    client: { name: 'Cliente Teste', handle: '@cliente', color: '#374151' },
    type: 'foto',
    caption: 'Legenda de teste do post',
    scheduledAt: new Date('2026-08-15T14:30:00'),
    status: 'aguardando',
    ...overrides,
  }
}

describe('IgPreview', () => {
  it('exibe a legenda no DOM (não é cortada pela raiz)', () => {
    render(<IgPreview post={makePost()} />)
    expect(screen.getByText(/Legenda de teste do post/)).toBeInTheDocument()
    expect(screen.getAllByText(/@cliente/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Agendado para/)).toBeInTheDocument()
    expect(screen.getByText(/Status: aguardando/)).toBeInTheDocument()
  })

  it('não força aspect-square na raiz (se adapta ao conteúdo)', () => {
    const { container } = render(<IgPreview post={makePost()} />)
    const root = container.querySelector('div.rounded-xl')
    expect(root).not.toBeNull()
    expect(root!.className).not.toContain('aspect-square')
  })

  it('mostra placeholder quando não há mídia', () => {
    render(<IgPreview post={makePost({ files: [] })} />)
    expect(screen.getByText(/FOTO/)).toBeInTheDocument()
  })

  it('usa a capa como poster do vídeo quando coverUrl é informado', () => {
    render(
      <IgPreview
        post={makePost({
          files: [{ url: 'https://pub-x.r2.dev/reel.mp4', mediaType: 'video' }],
          coverUrl: 'https://pub-x.r2.dev/capa.jpg',
        })}
      />
    )
    const video = document.querySelector('video')
    expect(video).toBeInTheDocument()
    expect(video?.getAttribute('poster')).toBe('https://pub-x.r2.dev/capa.jpg')
  })

  it('usa a capa separada de media_urls [capa, vídeo] como poster', () => {
    render(
      <IgPreview
        post={makePost({
          files: [
            { url: 'https://pub-x.r2.dev/capa.jpg', mediaType: 'image' },
            { url: 'https://pub-x.r2.dev/reel.mp4', mediaType: 'video' },
          ],
        })}
      />
    )
    const video = document.querySelector('video')
    expect(video).toBeInTheDocument()
    expect(video?.getAttribute('poster')).toBe('https://pub-x.r2.dev/capa.jpg')
  })
})
