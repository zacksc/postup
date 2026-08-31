import { describe, it, expect } from 'vitest'
import { cn, formatDate, formatDateShort, sanitize, getInitials, isVideoUrl, hasCoverInMediaUrls } from '@/lib/utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2')
  })

  it('handles conditional classes', () => {
    const isActive = false
    expect(cn('base', isActive && 'hidden', 'visible')).toBe('base visible')
  })

  it('resolves tailwind conflicts', () => {
    expect(cn('px-4', 'px-6')).toBe('px-6')
  })
})

describe('formatDate', () => {
  it('formats yyyy-mm-dd to dd/mm/yyyy', () => {
    expect(formatDate('2026-07-23')).toBe('23/07/2026')
  })

  it('returns empty string for empty input', () => {
    expect(formatDate('')).toBe('')
  })
})

describe('formatDateShort', () => {
  it('formats yyyy-mm-dd to dd/mm', () => {
    expect(formatDateShort('2026-07-23')).toBe('23/07')
  })

  it('returns empty string for empty input', () => {
    expect(formatDateShort('')).toBe('')
  })
})

describe('sanitize', () => {
  it('strips HTML tags', () => {
    expect(sanitize('<script>alert("xss")</script>hello')).toBe('hello')
  })

  it('strips all HTML tags including nested', () => {
    expect(sanitize('<div><p>text</p></div>')).toBe('text')
  })

  it('handles event handler attributes', () => {
    expect(sanitize('<img onerror="alert(1)">hello')).toBe('hello')
  })

  it('trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello')
  })

  it('limits length', () => {
    const long = 'a'.repeat(100)
    expect(sanitize(long, 10)).toBe('a'.repeat(10))
  })

  it('returns empty for empty input', () => {
    expect(sanitize('')).toBe('')
    expect(sanitize(null as unknown as string)).toBe('')
    expect(sanitize(undefined as unknown as string)).toBe('')
  })
})

describe('getInitials', () => {
  it('returns first two letters for single word', () => {
    expect(getInitials('João')).toBe('JO')
  })

  it('returns first letter of first two words', () => {
    expect(getInitials('Maria Silva')).toBe('MS')
  })

  it('handles empty input', () => {
    expect(getInitials('')).toBe('')
  })

  it('handles names with more than 2 words', () => {
    expect(getInitials('João Paulo Santos Lima')).toBe('JP')
  })
})

describe('isVideoUrl', () => {
  it('returns true for video extensions', () => {
    expect(isVideoUrl('https://x.supabase.co/storage/v1/object/posts-media/123-filme.mp4')).toBe(true)
    expect(isVideoUrl('/posts-media/123.mov')).toBe(true)
    expect(isVideoUrl('clip.WEBM')).toBe(true)
  })

  it('returns false for images and unknown', () => {
    expect(isVideoUrl('https://x.supabase.co/posts-media/123-foto.webp')).toBe(false)
    expect(isVideoUrl('foto.jpg')).toBe(false)
    expect(isVideoUrl('')).toBe(false)
  })

  it('ignores query strings and hash', () => {
    expect(isVideoUrl('video.mp4?token=abc')).toBe(true)
    expect(isVideoUrl('foto.png#section')).toBe(false)
  })
})

describe('hasCoverInMediaUrls', () => {
  it('returns false for nullish or empty', () => {
    expect(hasCoverInMediaUrls(null)).toBe(false)
    expect(hasCoverInMediaUrls(undefined)).toBe(false)
    expect(hasCoverInMediaUrls([])).toBe(false)
  })

  it('returns false with a single item', () => {
    expect(hasCoverInMediaUrls(['video.mp4'])).toBe(false)
    expect(hasCoverInMediaUrls(['capa.jpg'])).toBe(false)
  })

  it('returns true when an image precedes a video', () => {
    expect(hasCoverInMediaUrls(['capa.jpg', 'video.mp4'])).toBe(true)
    expect(hasCoverInMediaUrls(['capa.webp', 'video.mp4', 'foto.png'])).toBe(true)
  })

  it('returns false when the post starts with a video', () => {
    expect(hasCoverInMediaUrls(['video.mp4', 'video2.mp4'])).toBe(false)
    expect(hasCoverInMediaUrls(['video.mp4', 'capa.jpg'])).toBe(false)
  })

  it('returns false when there is no video after the first item', () => {
    expect(hasCoverInMediaUrls(['capa.jpg', 'foto.png'])).toBe(false)
    expect(hasCoverInMediaUrls(['capa.jpg', 'outra.jpg', 'ultima.webp'])).toBe(false)
  })

  it('tolerates null/empty entries inside the array', () => {
    expect(hasCoverInMediaUrls(['capa.jpg', null, 'video.mp4'])).toBe(true)
    expect(hasCoverInMediaUrls([null, 'video.mp4'])).toBe(true)
  })
})
