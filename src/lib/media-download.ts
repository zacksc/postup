import JSZip from 'jszip'
import { toast } from 'sonner'

/**
 * Download de mídia a partir de uma URL pública (Drive webContentLink /
 * Supabase storage / R2). Baixa via fetch → blob para respeitar o nome do
 * arquivo; se o CORS bloquear, cai para o link direto (o navegador baixa com
 * o nome que o servidor oferecer).
 */
export function deriveFilenameFromUrl(url: string): string {
  try {
    const clean = new URL(url)
    let last = clean.pathname.split('/').filter(Boolean).pop() || ''
    try { last = decodeURIComponent(last) } catch { /* mantém o segmento bruto */ }
    const base = last && last !== 'download' && last !== 'uc' ? last : 'postup-midia'
    const ext = (base.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|m4v)$/i)?.[0] || '').toLowerCase()
    const stem = base.replace(/\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|m4v)$/i, '')
    const safe = stem.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'postup-midia'
    return `${safe}${ext}`
  } catch {
    return 'postup-midia'
  }
}

async function fetchMediaBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { mode: 'cors' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.blob()
}

export async function downloadMediaUrl(url: string, filename?: string): Promise<void> {
  const name = filename || deriveFilenameFromUrl(url)
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objectUrl)
  } catch {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.target = '_blank'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
}

/**
 * Creates a ZIP file containing all media URLs and downloads it.
 * Each file is named based on the URL or a sequential suffix.
 */
export async function downloadMediaAsZip(
  mediaUrls: string[],
  zipName = 'postup-midia.zip',
  onProgress?: (progress: number) => void,
): Promise<void> {
  const zip = new JSZip()
  const total = mediaUrls.length

  for (let i = 0; i < total; i++) {
    const url = mediaUrls[i]
    if (!url) continue
    try {
      const blob = await fetchMediaBlob(url)
      const filename = deriveFilenameFromUrl(url) || `media-${i + 1}`
      const ext = blob.type.split('/')[1]?.split('+')[0] || 'bin'
      zip.file(filename.includes('.') ? filename : `${filename}.${ext}`, blob)
      onProgress?.((i + 1) / total)
    } catch (err) {
      console.error(`Failed to download ${url}:`, err)
      toast.error(`Não foi possível baixar: ${deriveFilenameFromUrl(url)}`)
    }
  }

  const content = await zip.generateAsync({ type: 'blob' })
  const objectUrl = URL.createObjectURL(content)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = zipName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}

/**
 * Downloads all media URLs sequentially (one by one), useful for batch
 * downloading when ZIP isn't supported or when the user wants individual files.
 */
export async function downloadAllMedia(
  mediaUrls: string[],
  onProgress?: (completed: number, total: number) => void,
): Promise<void> {
  let completed = 0
  for (const url of mediaUrls) {
    if (!url) continue
    try {
      await downloadMediaUrl(url)
    } catch (err) {
      console.error(`Failed to download ${url}:`, err)
    }
    completed++
    onProgress?.(completed, mediaUrls.length)
    // Small delay to avoid browser popup blockers
    await new Promise(r => setTimeout(r, 200))
  }
}
