export interface PostDraftMediaItem {
  id: string
  mediaType: 'image' | 'video'
  existing?: boolean
  url?: string
  file?: File
}

export interface PostDraft {
  editId: string | null
  savedAt: number
  clientId: string
  postType: string
  date: string
  time: string
  caption: string
  platform: string
  status: string
  compressVideos: boolean | null
  mediaItems: PostDraftMediaItem[]
  cover: PostDraftMediaItem | null
  newVersionName?: string
  selectedVersionId?: string
}

const DB_NAME = 'postup-drafts'
const DB_VERSION = 1
const STORE = 'drafts'
const KEY_PREFIX = 'postup:post-draft'

function draftKey(editId: string | null): string {
  return `${KEY_PREFIX}:${editId ?? 'new'}`
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function savePostDraft(editId: string | null, draft: PostDraft): Promise<void> {
  try {
    await idbPut(draftKey(editId), draft)
  } catch (err) {
    console.error('Falha ao salvar rascunho do post:', err)
  }
}

export async function loadPostDraft(editId: string | null): Promise<PostDraft | null> {
  try {
    const draft = await idbGet<PostDraft>(draftKey(editId))
    if (!draft) return null
    // Arquivos guardados voltam como File (structured clone mantém o tipo);
    // recria as URLs de objeto para exibição.
    const mediaItems = draft.mediaItems.map(item => {
      if (item.file) {
        return { ...item, url: URL.createObjectURL(item.file) }
      }
      return item
    })
    const cover = draft.cover?.file
      ? { ...draft.cover, url: URL.createObjectURL(draft.cover.file) }
      : draft.cover
    return { ...draft, mediaItems, cover }
  } catch (err) {
    console.error('Falha ao carregar rascunho do post:', err)
    return null
  }
}

export async function clearPostDraft(editId: string | null): Promise<void> {
  try {
    await idbDelete(draftKey(editId))
  } catch (err) {
    console.error('Falha ao limpar rascunho do post:', err)
  }
}
