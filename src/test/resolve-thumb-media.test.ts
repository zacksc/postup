import { describe, it, expect } from 'vitest'
import { resolveThumbMedia } from '@/lib/utils'

describe('resolveThumbMedia (miniaturas grid/cronograma)', () => {
  it('retorna o primeiro item quando não há convenção de capa', () => {
    expect(resolveThumbMedia(['foto.png'])).toEqual({ url: 'foto.png', poster: undefined })
    expect(resolveThumbMedia(['video.mp4'])).toEqual({ url: 'video.mp4', poster: undefined })
  })

  it('na convenção [capa, vídeo], mostra o vídeo com a capa como poster', () => {
    expect(resolveThumbMedia(['capa.jpg', 'reel.mp4'])).toEqual({ url: 'reel.mp4', poster: 'capa.jpg' })
  })

  it('usa o primeiro vídeo quando há capa + vários itens', () => {
    const result = resolveThumbMedia(['capa.jpg', 'foto1.png', 'reel2.mp4'])
    expect(result.url).toBe('reel2.mp4')
    expect(result.poster).toBe('capa.jpg')
  })

  it('não considera [vídeo, imagem] como capa (capa vem primeiro e é imagem)', () => {
    expect(resolveThumbMedia(['reel.mp4', 'capa.jpg'])).toEqual({ url: 'reel.mp4', poster: undefined })
  })

  it('retorna url null quando a lista é vazia', () => {
    expect(resolveThumbMedia([])).toEqual({ url: null, poster: undefined })
    expect(resolveThumbMedia(null)).toEqual({ url: null, poster: undefined })
    expect(resolveThumbMedia(['', null])).toEqual({ url: null, poster: undefined })
  })
})
