import { describe, it, expect } from 'vitest'
import { deriveFilenameFromUrl } from '@/lib/media-download'

describe('deriveFilenameFromUrl', () => {
  it('extrai o nome e a extensão do caminho', () => {
    expect(deriveFilenameFromUrl('https://drive.google.com/uc?id=abc&export=download')).toBe('postup-midia')
    expect(deriveFilenameFromUrl('https://xx.supabase.co/storage/v1/object/public/posts-media/file-1-1723.webp')).toBe('file-1-1723.webp')
    expect(deriveFilenameFromUrl('https://cdn.example.com/reels/video-entrevista.mp4')).toBe('video-entrevista.mp4')
  })

  it('sanitiza nomes inválidos', () => {
    expect(deriveFilenameFromUrl('https://cdn.example.com/meu arquivo legal!.jpg')).toBe('meu-arquivo-legal.jpg')
    expect(deriveFilenameFromUrl('https://cdn.example.com/---')).toBe('postup-midia')
  })

  it('mantém o nome quando não há extensão conhecida', () => {
    expect(deriveFilenameFromUrl('https://cdn.example.com/pasta/imagem')).toBe('imagem')
  })

  it('retorna fallback para URL inválida', () => {
    expect(deriveFilenameFromUrl('não é uma url')).toBe('postup-midia')
  })
})
