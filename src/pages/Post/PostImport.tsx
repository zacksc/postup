import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, Download, AlertCircle, Loader2, Plus, X, Check, FileText, Image as ImageIcon } from 'lucide-react'
import { sanitize, isVideoUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { uploadMedia, uploadOriginalToDrive } from '@/lib/media-storage'
import { MediaPreview } from '@/components/post/MediaPreview'
import { generateVideoFrame } from '@/lib/video-frame'
import { useAuth } from '@/hooks/use-auth'
import type { Client } from '@/types/client'

interface ManualMedia {
  id: string
  file: File
  url: string
  mediaType: 'image' | 'video'
}

type PostCreationStatus = 'pending' | 'uploading' | 'creating' | 'success' | 'error'

interface ManualPost {
  id: string
  clientName: string
  postType: string
  platform: string
  scheduledAt: string
  scheduledTime: string
  caption: string
  postStatus: string
  mediaUrls: string[]
  mediaFiles: ManualMedia[]
  coverFile: ManualMedia | null
  creationStatus: PostCreationStatus
  creationError?: string
}

const POST_TYPE_OPTIONS = ['reels', 'carrossel', 'stories', 'foto', 'design']
const PLATFORM_OPTIONS = ['instagram', 'tiktok', 'both']
const STATUS_OPTIONS = ['rascunho', 'aguardando', 'aprovado']

const MAX_MANUAL_POSTS = 10

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

interface ParsedRow {
  clientName: string
  postType: string
  platform: string
  scheduledAt: string
  caption: string
  status: string
  mediaUrls: string[]
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return []

  const headers = parseCSVLine(lines[0])
  const required = ['clientName', 'postType', 'scheduledAt']
  const missing = required.filter(h => !headers.includes(h))
  if (missing.length > 0) {
    throw new Error(`Colunas obrigatórias ausentes: ${missing.join(', ')}`)
  }

  const rows: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length === 0 || values.every(v => !v.trim())) continue

    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] || ''
    })

    rows.push({
      clientName: row.clientName || '',
      postType: row.postType || 'foto',
      platform: row.platform || 'instagram',
      scheduledAt: row.scheduledAt || '',
      caption: row.caption || '',
      status: row.status || 'aguardando',
      mediaUrls: row.mediaUrls
        ? row.mediaUrls.split(';').map(u => u.trim()).filter(Boolean)
        : [],
    })
  }
  return rows
}

function parseJSON(text: string): ParsedRow[] {
  const data = JSON.parse(text)
  if (!Array.isArray(data)) throw new Error('O JSON deve ser um array de objetos')

  const first = data[0] || {}
  const missing = ['clientName', 'scheduledAt'].filter(h => !(h in first))
  if (missing.length > 0) {
    throw new Error(`Colunas obrigatórias ausentes no JSON: ${missing.join(', ')}`)
  }

  return data.map((item: Record<string, unknown>) => ({
    clientName: String(item.clientName || ''),
    postType: String(item.postType || 'foto'),
    platform: String(item.platform || 'instagram'),
    scheduledAt: String(item.scheduledAt || ''),
    caption: String(item.caption || ''),
    status: String(item.status || 'aguardando'),
    mediaUrls: Array.isArray(item.mediaUrls)
      ? item.mediaUrls.map(String)
      : String(item.mediaUrls || '').split(';').map(s => s.trim()).filter(Boolean),
  }))
}

function downloadCSVTemplate() {
  const csv = [
    'clientName,postType,platform,scheduledAt,caption,status,mediaUrls',
    'Cliente A,reels,instagram,2025-01-15T10:00,"Legenda incrível",aguardando,"https://exemplo.com/img1.webp;https://exemplo.com/video1.mp4"',
    'Cliente B,foto,instagram,2025-01-16T14:30,"Outra legenda",aprovado,',
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'template-postup.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function PostImportPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Manual batch creation
  const [manualPosts, setManualPosts] = useState<ManualPost[]>([
    { id: '0', clientName: '', postType: 'reels', platform: 'instagram', scheduledAt: '', scheduledTime: '', caption: '', postStatus: 'aguardando', mediaUrls: [], mediaFiles: [], coverFile: null, creationStatus: 'pending' },
  ])
  const [creating, setCreating] = useState(false)
  const [creationSummary, setCreationSummary] = useState<{ success: number; failed: number; errors: string[] } | null>(null)

  async function loadClients() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('clients').select('*').eq('user_id', user.id)
    if (data) setClients(data as Client[])
  }

  useEffect(() => {
    loadClients()
  }, [])

  const clientByName = new Map(clients.map(c => [c.name.toLowerCase(), c]))

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    file.text().then(text => {
      try {
        let rows: ParsedRow[]
        if (file.name.toLowerCase().endsWith('.json')) {
          rows = parseJSON(text)
        } else {
          rows = parseCSV(text)
        }
      setParsedRows(rows)
      setParseError(null)
    } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Erro ao analisar arquivo')
        setParsedRows([])
      }
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function addManualPost() {
    if (manualPosts.length >= MAX_MANUAL_POSTS) {
      toast.warning(`Limite máximo de ${MAX_MANUAL_POSTS} posts atingido`)
      return
    }
    setManualPosts([...manualPosts, {
      id: Date.now().toString(),
      clientName: '',
      postType: 'reels',
      platform: 'instagram',
      scheduledAt: '',
      scheduledTime: '',
      caption: '',
      postStatus: 'aguardando',
      mediaUrls: [],
      mediaFiles: [],
      coverFile: null,
      creationStatus: 'pending',
    }])
  }

  function removeManualPost(id: string) {
    if (manualPosts.length <= 1) return
    setManualPosts(manualPosts.filter(p => p.id !== id))
  }

  function updateManualPost(id: string, field: keyof ManualPost, value: string | string[] | ManualMedia | null) {
    setManualPosts(manualPosts.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  function handleCoverChange(id: string, file: File | null) {
    if (!file) {
      setManualPosts(manualPosts.map(p => p.id === id ? { ...p, coverFile: null } : p))
      return
    }
    const cover: ManualMedia = {
      id: Math.random().toString(36).slice(2),
      file,
      url: URL.createObjectURL(file),
      mediaType: 'image',
    }
    setManualPosts(manualPosts.map(p => {
      if (p.id !== id) return p
      if (p.coverFile) URL.revokeObjectURL(p.coverFile.url)
      return { ...p, coverFile: cover }
    }))
  }

  function handleMediaUrlsChange(id: string, value: string) {
    const urls = value.split('\n').map(s => s.trim()).filter(Boolean)
    updateManualPost(id, 'mediaUrls', urls)
  }

  function handleMediaFilesChange(id: string, files: FileList | null) {
    if (!files || files.length === 0) return
    const newFiles: ManualMedia[] = Array.from(files).map(file => ({
      id: Math.random().toString(36).slice(2),
      file,
      url: URL.createObjectURL(file),
      mediaType: file.type.startsWith('video/') ? 'video' : 'image',
    }))
    setManualPosts(manualPosts.map(p => p.id === id ? { ...p, mediaFiles: [...p.mediaFiles, ...newFiles] } : p))
  }

  function removeMediaFile(postId: string, mediaId: string) {
    setManualPosts(manualPosts.map(p => {
      if (p.id !== postId) return p
      const media = p.mediaFiles.find(m => m.id === mediaId)
      if (media) URL.revokeObjectURL(media.url)
      return { ...p, mediaFiles: p.mediaFiles.filter(m => m.id !== mediaId) }
    }))
  }

  function setPostStatus(id: string, status: PostCreationStatus, error?: string) {
    setManualPosts(prev => prev.map(p => p.id === id ? { ...p, creationStatus: status, creationError: error } : p))
  }

  async function createPostsFromManual() {
    const validPosts = manualPosts.filter(p => p.clientName.trim() && p.scheduledAt)
    if (validPosts.length === 0) {
      toast.error('Preencha pelo menos um post com cliente e data')
      return
    }

    // Validate all clients exist
    for (const post of validPosts) {
      if (!clientByName.has(post.clientName.toLowerCase())) {
        toast.error(`Cliente "${post.clientName}" não encontrado`)
        return
      }
    }

    setCreating(true)
    setCreationSummary(null)
    let successCount = 0
    let failedCount = 0
    const errors: string[] = []

    for (let i = 0; i < validPosts.length; i++) {
      const post = validPosts[i]
      setPostStatus(post.id, 'uploading')
      toast.info(`Criando post ${i + 1}/${validPosts.length} — ${post.clientName}...`)

      try {
        const client = clientByName.get(post.clientName.toLowerCase())!
        const scheduledAt = new Date(`${post.scheduledAt}T${post.scheduledTime || '12:00'}`).toISOString()

        // Upload media files
        const uploadedUrls: string[] = []
        const uploadedOriginalUrls: (string | null)[] = []
        const driveContext = {
          client: client.name,
          date: post.scheduledAt,
          type: post.postType,
          plataforma: post.platform || 'instagram',
          sequence: post.postType === 'stories' ? `sequencia-${Date.now()}` : undefined,
        }
        for (const media of post.mediaFiles) {
          const isVideo = media.mediaType === 'video'
          const ext = isVideo
            ? (media.file.type.includes('mp4') ? '.mp4' : (media.file.name.match(/\.[^.]+$/)?.[0].toLowerCase() || '.mp4'))
            : '.webp'
          const fileName = `file-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
          const [url, origUrl] = await Promise.all([
            uploadMedia(media.file, fileName, { context: driveContext }),
            uploadOriginalToDrive(media.file, fileName, { context: driveContext }),
          ])
          uploadedUrls.push(url)
          uploadedOriginalUrls.push(origUrl)
        }

        // Upload cover if provided
        let coverDisplayUrl: string | null = null
        let coverOriginalUrl: string | null = null
        const hasManualCover = !!post.coverFile
        if (post.coverFile) {
          try {
            const [displayUrl, origUrl] = await Promise.all([
              uploadMedia(post.coverFile.file, `cover-${Date.now()}.jpg`, { context: driveContext }),
              uploadOriginalToDrive(post.coverFile.file, `cover-${Date.now()}.jpg`, { context: driveContext }),
            ])
            coverDisplayUrl = displayUrl
            coverOriginalUrl = origUrl
          } catch (coverErr) {
            console.error('Erro ao enviar capa manual:', coverErr)
            toast.warning('Falha ao enviar capa — post criado sem capa personalizada')
          }
        }

        // Auto-generate cover for videos only if no manual cover was provided
        let finalMediaUrls = [...uploadedUrls, ...post.mediaUrls]
        let finalOriginalUrls = [...uploadedOriginalUrls, ...post.mediaUrls.map(() => null)]
        const hasVideo = post.mediaFiles.some(m => m.mediaType === 'video') || uploadedUrls.some(url => isVideoUrl(url))

        if (hasVideo && !hasManualCover && !coverDisplayUrl) {
          const videoFile = post.mediaFiles.find(m => m.mediaType === 'video')
          if (videoFile) {
            const frame = await generateVideoFrame(videoFile.file)
            if (frame) {
              const [displayUrl, origUrl] = await Promise.all([
                uploadMedia(frame, `cover-${Date.now()}.jpg`, { context: driveContext }),
                uploadOriginalToDrive(videoFile.file, `cover-${Date.now()}.jpg`, { context: driveContext }),
              ])
              coverDisplayUrl = displayUrl
              coverOriginalUrl = origUrl
            }
          }
        }

        if (coverDisplayUrl) {
          finalMediaUrls = [coverDisplayUrl, ...finalMediaUrls]
          finalOriginalUrls = [coverOriginalUrl, ...finalOriginalUrls]
        }

        setPostStatus(post.id, 'creating')

        const { data: createdPost, error } = await supabase.from('posts').insert([{
          client_id: client.id,
          client_name: client.name,
          client_handle: client.handle || '',
          client_color: client.branding?.palette?.[0] || '#374151',
          post_type: post.postType,
          platform: post.platform || 'instagram',
          scheduled_at: scheduledAt,
          caption: sanitize(post.caption),
          status: post.postStatus as string,
          media_urls: finalMediaUrls,
          user_id: user?.id,
        }]).select('id').single()
        if (!error && createdPost && finalOriginalUrls.some(Boolean)) {
          await supabase.from('posts').update({ original_urls: finalOriginalUrls, user_id: user?.id }).eq('id', createdPost.id)
        }
        if (error) throw error

        setPostStatus(post.id, 'success')
        successCount++
        toast.success(`Post ${post.clientName} criado!`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'erro desconhecido'
        setPostStatus(post.id, 'error', msg)
        failedCount++
        errors.push(`${post.clientName}: ${msg}`)
        toast.error(`Erro ao criar post ${post.clientName}: ${msg}`)
      }
    }

    setCreating(false)
    setCreationSummary({ success: successCount, failed: failedCount, errors })

    if (successCount > 0 && failedCount === 0) {
      toast.success(`${successCount} post${successCount > 1 ? 's' : ''} criado${successCount > 1 ? 's' : ''} com sucesso!`)
      setTimeout(() => navigate('/cronograma'), 2000)
    } else if (successCount > 0) {
      toast.warning(`${successCount} criado${successCount > 1 ? 's' : ''}, ${failedCount} falhou`)
    } else {
      toast.error(`Nenhum post foi criado. ${failedCount} erro${failedCount > 1 ? 's' : ''}.`)
    }
  }

  async function createPostsFromCSV() {
    if (parsedRows.length === 0) return

    const validRows = parsedRows.filter(r => r.clientName.trim() && r.scheduledAt)
    if (validRows.length === 0) {
      toast.error('Nenhum post válido para importar')
      return
    }

    setCreating(true)
    let count = 0
    for (const row of validRows) {
      const client = clientByName.get(row.clientName.toLowerCase())
      if (!client) {
        toast.error(`Cliente "${row.clientName}" não encontrado`)
        continue
      }
      try {
        const { error } = await supabase.from('posts').insert([{
          client_id: client.id,
          client_name: client.name,
          client_handle: client.handle || '',
          client_color: client.branding?.palette?.[0] || '#7c6af4',
          post_type: row.postType || 'foto',
          platform: row.platform || 'instagram',
          scheduled_at: new Date(row.scheduledAt).toISOString(),
          caption: sanitize(row.caption),
          status: row.status || 'aguardando',
          media_urls: row.mediaUrls,
          user_id: user?.id,
        }])
        if (error) throw error
        count++
      } catch (err) {
        toast.error(`Erro ao criar post para "${row.clientName}": ${err instanceof Error ? err.message : 'erro desconhecido'}`)
      }
    }
    setCreating(false)
    if (count > 0) {
      toast.success(`${count} post${count > 1 ? 's' : ''} importado${count > 1 ? 's' : ''} com sucesso`)
      setTimeout(() => navigate('/cronograma'), 1500)
    }
  }

  function resetCSV() {
    setParsedRows([])
    setParseError(null)
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] min-h-0 bg-background">
      <header className="flex items-center gap-3 px-4 md:px-6 h-14 border-b border-border bg-card shrink-0">
        <button onClick={() => navigate('/cronograma')} className="p-2 -ml-2 hover:bg-secondary rounded-lg shrink-0">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight">Importar Posts</h1>
          <p className="text-xs text-muted-foreground">CSV/JSON ou criação em lote manual (até {MAX_MANUAL_POSTS} posts).</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-24 md:pb-6">
        <div className="max-w-4xl mx-auto p-4 space-y-8">
          {/* CSV/JSON Upload Section */}
          <section className="space-y-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">CSV ou JSON</h2>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-secondary/40 transition-colors"
            >
              <Upload size={32} className="text-muted-foreground mb-3" />
              <p className="text-sm font-medium mb-1">Clique para selecionar o arquivo</p>
              <p className="text-xs text-muted-foreground">Formatos suportados: .csv, .json</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,application/json,text/csv"
              className="hidden"
              onChange={handleFileUpload}
            />
            <div className="flex items-center gap-4 text-xs">
              <button
                onClick={downloadCSVTemplate}
                className="text-primary hover:underline font-medium flex items-center gap-1"
              >
                <Download size={12} /> Baixar template CSV
              </button>
            </div>

            {parseError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
                <p className="text-xs text-destructive flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  {parseError}
                </p>
              </div>
            )}
          </section>

          {/* CSV Preview */}
          {parsedRows.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Pré-visualização · {parsedRows.length} linha{parsedRows.length > 1 ? 's' : ''}
                </h2>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={resetCSV} className="text-xs">
                    <X size={12} className="mr-1" /> Limpar
                  </Button>
                  <Button size="sm" onClick={createPostsFromCSV} disabled={creating} className="text-xs">
                    {creating ? <Loader2 size={14} className="animate-spin mr-1" /> : <FileText size={14} className="mr-1" />}
                    Importar {parsedRows.length} post{parsedRows.length > 1 ? 's' : ''}
                  </Button>
                </div>
              </div>

              <div className="border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/30 border-b border-border">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">#</th>
                        <th className="text-left px-3 py-2 font-medium">Cliente</th>
                        <th className="text-left px-3 py-2 font-medium">Tipo</th>
                        <th className="text-left px-3 py-2 font-medium">Agendado</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                        <th className="text-left px-3 py-2 font-medium">Mídias</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((row, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-2">{row.clientName}</td>
                          <td className="px-3 py-2 capitalize">{row.postType}</td>
                          <td className="px-3 py-2 font-mono">{row.scheduledAt || '-'}</td>
                          <td className="px-3 py-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/30 border">{row.status}</span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {row.mediaUrls.length > 0 ? `${row.mediaUrls.length} arquivo${row.mediaUrls.length > 1 ? 's' : ''}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* Manual Batch Creation Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Criação em lote manual</h2>
              <Button size="sm" onClick={addManualPost} disabled={manualPosts.length >= MAX_MANUAL_POSTS || creating} className="text-xs gap-1">
                <Plus size={12} /> Adicionar ({manualPosts.length}/{MAX_MANUAL_POSTS})
              </Button>
            </div>

            <div className="space-y-4">
              {manualPosts.map((post, index) => (
                <div
                  key={post.id}
                  className={`p-4 border space-y-3 bg-card/50 transition-all ${
                    post.creationStatus === 'success' ? 'border-emerald-500/50 bg-emerald-500/5' :
                    post.creationStatus === 'error' ? 'border-destructive/50 bg-destructive/5' :
                    post.creationStatus === 'uploading' || post.creationStatus === 'creating' ? 'border-primary/30 bg-primary/5' :
                    'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Post #{index + 1}</span>
                      {post.creationStatus === 'uploading' && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-500 font-medium flex items-center gap-1">
                          <Loader2 size={10} className="animate-spin" /> Enviando mídia...
                        </span>
                      )}
                      {post.creationStatus === 'creating' && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-500 font-medium flex items-center gap-1">
                          <Loader2 size={10} className="animate-spin" /> Criando post...
                        </span>
                      )}
                      {post.creationStatus === 'success' && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 font-medium flex items-center gap-1">
                          <Check size={10} /> Criado!
                        </span>
                      )}
                      {post.creationStatus === 'error' && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-destructive/10 text-destructive font-medium flex items-center gap-1">
                          <AlertCircle size={10} /> {post.creationError || 'Erro'}
                        </span>
                      )}
                    </div>
                    {manualPosts.length > 1 && (
                      <button
                        onClick={() => removeManualPost(post.id)}
                        className="p-1 hover:bg-secondary text-muted-foreground"
                        disabled={creating}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Cliente *</label>
                      <input
                        value={post.clientName}
                        onChange={e => updateManualPost(post.id, 'clientName', e.target.value)}
                        list={`clients-${post.id}`}
                        placeholder="Nome do cliente"
                        className="w-full px-3 py-2 border border-input bg-background text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                        disabled={creating}
                      />
                      <datalist id={`clients-${post.id}`}>
                        {clients.map(c => <option key={c.id} value={c.name} />)}
                      </datalist>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Tipo</label>
                      <Select value={post.postType} onValueChange={(v) => updateManualPost(post.id, 'postType', v)} disabled={creating}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {POST_TYPE_OPTIONS.map(t => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Plataforma</label>
                      <Select value={post.platform} onValueChange={(v) => updateManualPost(post.id, 'platform', v)} disabled={creating}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PLATFORM_OPTIONS.map(p => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Status</label>
                      <Select value={post.postStatus} onValueChange={(v) => updateManualPost(post.id, 'postStatus', v)} disabled={creating}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Data *</label>
                      <input
                        type="date"
                        value={post.scheduledAt}
                        onChange={e => updateManualPost(post.id, 'scheduledAt', e.target.value)}
                        className="w-full px-3 py-2 border border-input bg-background text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                        disabled={creating}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Hora</label>
                      <input
                        type="time"
                        value={post.scheduledTime}
                        onChange={e => updateManualPost(post.id, 'scheduledTime', e.target.value)}
                        className="w-full px-3 py-2 border border-input bg-background text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                        disabled={creating}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Legenda</label>
                      <textarea
                        value={post.caption}
                        onChange={e => updateManualPost(post.id, 'caption', e.target.value)}
                        placeholder="Escreva a legenda do post..."
                        rows={2}
                        className="w-full px-3 py-2 border border-input bg-background text-sm outline-none resize-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                        disabled={creating}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Mídia</label>
                      <div className="grid grid-cols-4 gap-2">
                        {post.mediaFiles.map((media) => (
                          <div key={media.id} className="relative aspect-square border border-border overflow-hidden bg-muted group">
                            <MediaPreview url={media.url} mediaType={media.mediaType} className="w-full h-full" />
                            <button
                              type="button"
                              onClick={() => removeMediaFile(post.id, media.id)}
                              className="absolute top-0.5 right-0.5 bg-black/60 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                        <label className="border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer aspect-square hover:bg-muted transition-colors gap-0.5">
                          <Upload size={16} className="text-muted-foreground" />
                          <span className="text-[9px] text-muted-foreground font-medium">Adicionar</span>
                          <input
                            type="file"
                            multiple
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={e => { handleMediaFilesChange(post.id, e.target.files); e.target.value = '' }}
                            disabled={creating}
                          />
                        </label>
                      </div>
                      <textarea
                        value={post.mediaUrls.join('\n')}
                        onChange={e => handleMediaUrlsChange(post.id, e.target.value)}
                        placeholder="Ou cole links de mídia (um por linha): https://exemplo.com/foto1.webp"
                        rows={1}
                        className="mt-2 w-full px-3 py-2 border border-input bg-background text-sm outline-none resize-none font-mono focus:border-ring focus:ring-3 focus:ring-ring/50"
                        disabled={creating}
                      />
                    </div>

                    {/* Capa de vídeo */}
                    {post.mediaFiles.some(m => m.mediaType === 'video') && (
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block flex items-center gap-1">
                          <ImageIcon size={10} /> Capa do vídeo
                        </label>
                        <p className="text-[9px] text-muted-foreground mb-2">Se não enviar, a capa será gerada automaticamente do vídeo.</p>
                        <div className="flex items-center gap-3">
                          {post.coverFile ? (
                            <div className="relative w-16 h-16 border border-border overflow-hidden bg-muted">
                              <MediaPreview url={post.coverFile.url} mediaType="image" className="w-full h-full" />
                              <button
                                type="button"
                                onClick={() => handleCoverChange(post.id, null)}
                                className="absolute top-0.5 right-0.5 bg-black/60 text-white p-0.5"
                              >
                                <X size={8} />
                              </button>
                            </div>
                          ) : (
                            <label className="w-16 h-16 border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted transition-colors gap-0.5">
                              <ImageIcon size={14} className="text-muted-foreground" />
                              <span className="text-[8px] text-muted-foreground">Capa</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => { handleCoverChange(post.id, e.target.files?.[0] || null); e.target.value = '' }}
                                disabled={creating}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {manualPosts.length < MAX_MANUAL_POSTS && (
              <button
                onClick={addManualPost}
                className="w-full py-2 border border-dashed border-border text-xs font-medium text-muted-foreground hover:bg-secondary/40 flex items-center justify-center gap-2"
                disabled={creating}
              >
                <Plus size={14} /> Adicionar mais um post
              </button>
            )}
          </section>

          {/* Resumo da criação */}
          {creationSummary && (
            <section className="p-4 border border-border bg-card space-y-3">
              <h2 className="text-sm font-bold flex items-center gap-2">
                {creationSummary.failed === 0 ? (
                  <><Check size={16} className="text-emerald-500" /> Todos os posts foram criados!</>
                ) : (
                  <><AlertCircle size={16} className="text-amber-500" /> Resumo da criação</>
                )}
              </h2>
              <div className="flex gap-4 text-xs">
                <span className="text-emerald-500 font-medium">{creationSummary.success} sucesso{creationSummary.success !== 1 ? 's' : ''}</span>
                {creationSummary.failed > 0 && (
                  <span className="text-destructive font-medium">{creationSummary.failed} falha{creationSummary.failed !== 1 ? 's' : ''}</span>
                )}
              </div>
              {creationSummary.errors.length > 0 && (
                <div className="space-y-1">
                  {creationSummary.errors.map((err, i) => (
                    <p key={i} className="text-[11px] text-destructive flex items-start gap-1">
                      <AlertCircle size={10} className="shrink-0 mt-0.5" /> {err}
                    </p>
                  ))}
                </div>
              )}
              {creationSummary.success > 0 && (
                <Button size="sm" onClick={() => navigate('/cronograma')} className="text-xs">
                  Ir para o Cronograma
                </Button>
              )}
            </section>
          )}
        </div>
      </div>

      {/* Footer actions - Desktop */}
      <div className="hidden md:flex items-center gap-3 border-t px-6 py-3 bg-card shrink-0">
        <button
          onClick={() => navigate('/cronograma')}
          className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg"
        >
          Cancelar
        </button>
        <div className="ml-auto">
          <Button
            onClick={createPostsFromManual}
            disabled={creating || manualPosts.filter(p => p.clientName.trim() && p.scheduledAt).length === 0}
            className="text-xs font-bold gap-2"
          >
            {creating ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Criando...
              </>
            ) : (
              <>
                <Check size={14} /> Criar {manualPosts.filter(p => p.clientName.trim() && p.scheduledAt).length} post{manualPosts.filter(p => p.clientName.trim() && p.scheduledAt).length > 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Footer actions - Mobile */}
      <div className="md:hidden fixed bottom-16 left-0 right-0 p-3 bg-card border-t border-border z-20 flex gap-2">
        <button
          onClick={() => navigate('/cronograma')}
          className="flex-1 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
        >
          Cancelar
        </button>
        <Button
          className="flex-1 text-xs font-bold gap-1"
          onClick={createPostsFromManual}
          disabled={creating || manualPosts.filter(p => p.clientName.trim() && p.scheduledAt).length === 0}
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {creating ? 'Criando...' : 'Criar posts'}
        </Button>
      </div>
    </div>
  )
}
