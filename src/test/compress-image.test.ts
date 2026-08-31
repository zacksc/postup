import { describe, it, expect } from 'vitest'
import { compressImage, compressImageLow, compressPostMediaAndReupload } from '@/lib/compress-image'

describe('compressImage', () => {
  it('exports the function', () => {
    expect(compressImage).toBeInstanceOf(Function)
  })

  it('returns a Promise', () => {
    const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
    const result = compressImage(file)
    expect(result).toBeInstanceOf(Promise)
  })

  it('passes through non-image files', async () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    const result = await compressImage(file)
    expect(result).toBe(file)
  })
})

describe('compressImageLow', () => {
  it('exports the function', () => {
    expect(compressImageLow).toBeInstanceOf(Function)
  })
})

describe('compressPostMediaAndReupload', () => {
  it('exports the function', () => {
    expect(compressPostMediaAndReupload).toBeInstanceOf(Function)
  })
})
