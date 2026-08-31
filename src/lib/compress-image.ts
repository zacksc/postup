import { isVideoUrl } from '@/lib/utils'
import { uploadMedia, type FolderContext } from '@/lib/media-storage'

const MAX_DIMENSION = 1920
const QUALITY = 0.82
const QUALITY_LOW = 0.6
const MAX_DIMENSION_LOW = 1080

interface CompressOptions {
  maxDimension?: number
  quality?: number
  format?: 'image/jpeg' | 'image/webp'
}

export function compressImage(file: File, options: CompressOptions = {}): Promise<Blob> {
  const maxDimension = options.maxDimension ?? MAX_DIMENSION
  const quality = options.quality ?? QUALITY
  const format = options.format ?? 'image/webp'

  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      resolve(file)
      return
    }

    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(img.src)

      let { width, height } = img
      if (width <= maxDimension && height <= maxDimension && file.size < 500 * 1024) {
        resolve(file)
        return
      }

      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('No 2d context')); return }
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Canvas is empty')); return }
        resolve(blob)
      }, format, quality)
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

export function compressImageLow(fileOrUrl: string | File): Promise<Blob> {
  if (typeof fileOrUrl === 'string') {
    return compressImageFromUrl(fileOrUrl, {
      maxDimension: MAX_DIMENSION_LOW,
      quality: QUALITY_LOW,
    })
  }
  return compressImage(fileOrUrl, {
    maxDimension: MAX_DIMENSION_LOW,
    quality: QUALITY_LOW,
  })
}

function compressImageFromUrl(url: string, options: CompressOptions = {}): Promise<Blob> {
  const maxDimension = options.maxDimension ?? MAX_DIMENSION_LOW
  const quality = options.quality ?? QUALITY_LOW

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      let { width, height } = img
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('No 2d context')); return }
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Canvas is empty')); return }
        resolve(blob)
      }, 'image/webp', quality)
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = url
  })
}

export async function compressPostMediaAndReupload(mediaUrls: string[], context?: FolderContext): Promise<string[]> {
  const newUrls: string[] = []
  for (const url of mediaUrls) {
    if (isVideoUrl(url)) {
      newUrls.push(url)
      continue
    }
    try {
      const compressed = await compressImageFromUrl(url)
      const fileName = `posts-compressed/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`
      try {
        const publicUrl = await uploadMedia(compressed, fileName, { context })
        newUrls.push(publicUrl)
      } catch {
        newUrls.push(url)
      }
    } catch {
      newUrls.push(url)
    }
  }
  return newUrls
}
