const http = require('http')
const { execFileSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')

const PORT = process.env.PORT || 3000
const API_KEY = (process.env.API_KEY || '').trim()
const R2_ACCOUNT_ID = (process.env.R2_ACCOUNT_ID || '').trim()
const R2_ACCESS_KEY_ID = (process.env.R2_ACCESS_KEY_ID || '').trim()
const R2_SECRET_ACCESS_KEY = (process.env.R2_SECRET_ACCESS_KEY || '').trim()
const R2_BUCKET = (process.env.R2_BUCKET || 'postupstorage').trim()
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim()
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

// ============================================================
// Multipart form data parser
// ============================================================

function parseMultipart(buffer, boundary) {
  const parts = []
  const boundaryBuffer = Buffer.from(`--${boundary}`)
  let start = buffer.indexOf(boundaryBuffer) + boundaryBuffer.length + 2

  while (true) {
    const end = buffer.indexOf(boundaryBuffer, start)
    if (end === -1) break

    const partData = buffer.slice(start, end - 2) // -2 for \r\n
    const headerEnd = partData.indexOf('\r\n\r\n')
    if (headerEnd === -1) { start = end + boundaryBuffer.length + 2; continue }

    const headers = partData.slice(0, headerEnd).toString()
    const data = partData.slice(headerEnd + 4)

    const nameMatch = headers.match(/name="([^"]+)"/)
    const filenameMatch = headers.match(/filename="([^"]+)"/)

    parts.push({
      name: nameMatch?.[1] || '',
      filename: filenameMatch?.[1] || undefined,
      data,
    })

    start = end + boundaryBuffer.length + 2
  }
  return parts
}

// ============================================================
// R2 S3-compatible API helpers (SigV4 via headers, mais robusto)
// ============================================================

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex')
}

function r2KeyPath(bucket, key) {
  // Preserva as barras do key (encoding correto p/ SigV4)
  return `/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`
}

function r2Headers(method, accountId, accessKey, secretKey, bucket, key, payloadBuffer, contentType) {
  const host = `${accountId}.r2.cloudflarestorage.com`
  const date = new Date()
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = date.toISOString().slice(0, 10).replace(/-/g, '')
  const canonicalUri = r2KeyPath(bucket, key)
  const payloadHash = sha256Hex(payloadBuffer)
  const credential = `${accessKey}/${dateStamp}/auto/s3/aws4_request`

  const signedHeaders = ['content-type', 'host', 'x-amz-content-sha256', 'x-amz-date']
  const canonicalHeaders = [
    `content-type:${contentType}\n`,
    `host:${host}\n`,
    `x-amz-content-sha256:${payloadHash}\n`,
    `x-amz-date:${amzDate}\n`,
  ].join('')

  const canonicalRequest = [
    method,
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders.join(';'),
    payloadHash,
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    `${dateStamp}/auto/s3/aws4_request`,
    sha256Hex(canonicalRequest),
  ].join('\n')

  const kDate = crypto.createHmac('sha256', `AWS4${secretKey}`).update(dateStamp).digest()
  const kRegion = crypto.createHmac('sha256', kDate).update('auto').digest()
  const kService = crypto.createHmac('sha256', kRegion).update('s3').digest()
  const signingKey = crypto.createHmac('sha256', kService).update('aws4_request').digest()
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex')

  const authorization = `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeaders.join(';')}, Signature=${signature}`

  return {
    'Authorization': authorization,
    'Content-Type': contentType,
    'X-Amz-Content-Sha256': payloadHash,
    'X-Amz-Date': amzDate,
  }
}

async function downloadFromR2(accountId, accessKey, secretKey, bucket, key, destPath) {
  const headers = r2Headers('GET', accountId, accessKey, secretKey, bucket, key, Buffer.alloc(0), 'application/octet-stream')
  const url = `https://${accountId}.r2.cloudflarestorage.com${r2KeyPath(bucket, key)}`
  const res = await fetch(url, { headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`R2 download failed: ${res.status} ${body.slice(0, 200)}`)
  }
  const buffer = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(destPath, buffer)
}

async function uploadToR2(accountId, accessKey, secretKey, bucket, filePath, key) {
  const buffer = fs.readFileSync(filePath)
  const headers = r2Headers('PUT', accountId, accessKey, secretKey, bucket, key, buffer, 'video/mp4')
  const url = `https://${accountId}.r2.cloudflarestorage.com${r2KeyPath(bucket, key)}`
  const res = await fetch(url, { method: 'PUT', headers, body: buffer })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`R2 upload failed: ${res.status} ${body.slice(0, 200)}`)
  }
}

async function uploadToR2FromBuffer(buffer, filename, key) {
  const mimeType = filename.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream'
  const headers = r2Headers('PUT', R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, key, buffer, mimeType)
  const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com${r2KeyPath(R2_BUCKET, key)}`
  const res = await fetch(url, { method: 'PUT', headers, body: buffer })
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    console.error(`R2 upload failed: ${res.status} ${errBody.slice(0, 300)}`)
    throw new Error(`R2 upload failed: ${res.status} ${errBody.slice(0, 200)}`)
  }
}

// ============================================================
// Supabase REST helpers
// ============================================================

async function updateJobStatus(supabaseUrl, supabaseKey, jobId, status, progress, message, extra = {}) {
  await fetch(`${supabaseUrl}/rest/v1/video_jobs?id=eq.${jobId}`, {
    method: 'PATCH',
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ status, progress, message, ...extra }),
  })
}

async function createVideoJob(supabaseUrl, supabaseKey, jobId, userId, postId, r2Key, filename) {
  const res = await fetch(`${supabaseUrl}/rest/v1/video_jobs`, {
    method: 'POST',
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      id: jobId,
      user_id: userId,
      post_id: postId || '',
      r2_key: r2Key,
      original_name: filename,
      mime_type: 'video/mp4',
      size: 0,
      status: 'queued',
      progress: 0,
      message: 'Vídeo recebido, aguardando processamento',
    }),
  })
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`Falha ao criar job: ${res.status} ${errBody.slice(0, 200)}`)
  }
}

// ============================================================
// ffmpeg helpers
// ============================================================

function getVideoInfo(filePath) {
  const raw = execFileSync('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath], { encoding: 'utf-8' })
  const info = JSON.parse(raw)
  const format = info.format || {}
  const vs = (info.streams || []).find(s => s.codec_type === 'video') || {}
  return { duration: parseFloat(format.duration || '0'), width: parseInt(vs.width || '0'), height: parseInt(vs.height || '0'), codec: vs.codec_name || 'unknown' }
}

const MAX_R2_SIZE = 50 * 1024 * 1024 // 50MB
const FFMPEG_MEMORY_ARGS = ['-threads', '1', '-loglevel', 'error', '-preset', 'fast', '-rc-lookahead', '0', '-refs', '3']

function calcBitrate(durationSec, targetBytes) {
  const audioBitrate = 128 * 1024
  return Math.max(100 * 1024, Math.round((targetBytes * 8 / durationSec) - audioBitrate))
}

/**
 * Converte o vídeo para H.264 (compatível) com a resolução máxima mantendo proporção.
 * 1080p por padrão; se o resultado passar de 50MB, refaz em 720p.
 * @param maxDim Dimensão máxima do lado mais longo (1920 = 1080p, 1280 = 720p)
 */
function processVideo(input, output, duration, maxDim) {
  const vbr = calcBitrate(duration, MAX_R2_SIZE * 0.85)
  console.log(`[App] ${maxDim === 1920 ? '1080p' : '720p'} bitrate=${Math.round(vbr / 1024)}kbps`)
  execFileSync('ffmpeg', [
    '-y', '-i', input,
    '-vf', `scale='min(${maxDim},iw)':'min(${maxDim},ih)':force_original_aspect_ratio=decrease,setsar=1,fps=30`,
    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    ...FFMPEG_MEMORY_ARGS,
    '-b:v', String(vbr), '-maxrate', String(Math.round(vbr * 1.2)), '-bufsize', String(vbr * 2),
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-movflags', '+faststart', output,
  ], { stdio: 'ignore' })
}

// ============================================================
// Processamento principal (a partir de arquivo em disco)
// ============================================================

const R2_PUBLIC_BASE = process.env.R2_PUBLIC_BASE || 'https://pub-1a3087e2ae044de09fd937421b1549d7.r2.dev'

async function processJobFromDisk(job) {
  const {
    jobId, r2Key, userId, postId,
    r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2Bucket,
    supabaseUrl, supabaseKey,
    folderPath,
    originalPath, // caminho do arquivo já em disco (do /upload)
  } = job

  const appPath = `/tmp/app_${jobId}.mp4`

  try {
    console.log(`[${jobId}] Iniciando processamento`)

    // 1. Info do vídeo (arquivo já está em disco)
    const info = getVideoInfo(originalPath)
    console.log(`[${jobId}] ${info.width}x${info.height}, ${info.duration}s, ${info.codec}`)
    await updateJobStatus(supabaseUrl, supabaseKey, jobId, 'processing', 15, `Vídeo: ${info.width}x${info.height}, ${info.duration}s`)

    // 2. Converte para R2: 1080p (máx proporção). Se >50MB, refaz em 720p.
    await updateJobStatus(supabaseUrl, supabaseKey, jobId, 'processing', 25, 'Processando vídeo para o player (1080p)...')
    processVideo(originalPath, appPath, info.duration, 1920)
    let appSize = fs.statSync(appPath).size
    console.log(`[${jobId}] 1080p: ${(appSize / 1024 / 1024).toFixed(1)}MB`)

    if (appSize > MAX_R2_SIZE) {
      console.log(`[${jobId}] Acima de 50MB — refazendo em 720p`)
      await updateJobStatus(supabaseUrl, supabaseKey, jobId, 'processing', 40, 'Reduzindo para 720p (cabe no limite)...')
      try { fs.unlinkSync(appPath) } catch {}
      processVideo(originalPath, appPath, info.duration, 1280)
      appSize = fs.statSync(appPath).size
      console.log(`[${jobId}] 720p: ${(appSize / 1024 / 1024).toFixed(1)}MB`)
    }

    // 3. Upload versão convertida para R2 (pública via r2.dev)
    await updateJobStatus(supabaseUrl, supabaseKey, jobId, 'processing', 60, 'Enviando versão para o player (R2)...')
    const appR2Key = `posts/${postId}/app_${Date.now()}.mp4`
    await uploadToR2(r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2Bucket, appPath, appR2Key)

    // 4. Upload ORIGINAL (bruto) para R2 temporário → Drive
    await updateJobStatus(supabaseUrl, supabaseKey, jobId, 'processing', 75, 'Enviando original para o Drive do cliente...')
    const clientTempKey = `temp/drive/${jobId}/original_${Date.now()}.mp4`
    await uploadToR2(r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2Bucket, originalPath, clientTempKey)

    // Chama edge function para copiar pro Drive
    const clientName = `video_${postId}_original.mp4`
    const driveRes = await fetch(`${supabaseUrl}/functions/v1/r2-to-drive?action=process`, {
      method: 'POST',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, key: clientTempKey, name: clientName, mimeType: 'video/mp4', folderPath: folderPath || undefined }),
    })
    const driveResult = await driveRes.json()
    if (driveResult.error) throw new Error(driveResult.error)

    // 5. Atualiza job (app_url = URL pública r2.dev)
    await updateJobStatus(supabaseUrl, supabaseKey, jobId, 'completed', 100, 'Processamento concluído!', {
      app_url: `${R2_PUBLIC_BASE}/${appR2Key}`,
      client_url: driveResult.url || null,
    })

    // Cleanup local
    try { fs.unlinkSync(originalPath) } catch {}
    try { fs.unlinkSync(appPath) } catch {}

    console.log(`[${jobId}] Concluído!`)
    return { success: true }
  } catch (err) {
    console.error(`[${jobId}] Erro:`, err.message)
    await updateJobStatus(supabaseUrl, supabaseKey, jobId, 'error', 0, err.message).catch(() => {})
    try { fs.unlinkSync(originalPath) } catch {}
    try { fs.unlinkSync(appPath) } catch {}
    throw err
  }
}

// ============================================================
// Servidor HTTP
// ============================================================

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', ffmpeg: true }))
    return
  }

  // Upload: recebe arquivo do browser, responde 202 IMEDIATAMENTE, processa em background
  if (req.method === 'POST' && req.url === '/upload') {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks)
        const boundary = req.headers['content-type']?.split('boundary=')[1]
        if (!boundary) { res.writeHead(400); res.end(JSON.stringify({ error: 'Missing boundary' })); return }

        // Parse multipart form data
        const parts = parseMultipart(body, boundary)
        const file = parts.find(p => p.name === 'file')
        const postId = (parts.find(p => p.name === 'postId')?.data?.toString() || '').trim()
        const userId = (parts.find(p => p.name === 'userId')?.data?.toString() || '').trim()
        const folderPath = (parts.find(p => p.name === 'folderPath')?.data?.toString() || '').trim()

        if (!file) { res.writeHead(400); res.end(JSON.stringify({ error: 'Missing file' })); return }

        const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const r2Key = `video-jobs/${jobId}/${file.filename}`
        const originalPath = `/tmp/original_${jobId}.${file.filename.includes('.') ? file.filename.split('.').pop() : 'mp4'}`

        console.log(`[${jobId}] Recebendo ${file.filename} (${file.data.length} bytes)`)

        // 1. Escreve em disco e LIBERA o buffer da memória
        fs.writeFileSync(originalPath, file.data)
        file.data = null
        body.fill(0) // limpa o buffer grande

        // Responde 202 IMEDIATAMENTE — o processamento roda em background
        res.writeHead(202, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ jobId, status: 'queued', message: 'Vídeo recebido, processando em segundo plano' }))

        // 2. Processamento em background (não bloqueia o response)
        setImmediate(async () => {
          try {
            if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
              throw new Error('R2 credentials not configured on Render')
            }
            // Cria a linha no video_jobs para o polling do frontend encontrar o job
            await createVideoJob(SUPABASE_URL, SUPABASE_KEY, jobId, userId, postId, r2Key, file.filename)
            const fileBuffer = fs.readFileSync(originalPath)
            await uploadToR2FromBuffer(fileBuffer, file.filename, r2Key)
            console.log(`[${jobId}] R2 upload complete`)

            await processJobFromDisk({
              jobId, r2Key, userId, postId,
              r2AccountId: R2_ACCOUNT_ID, r2AccessKeyId: R2_ACCESS_KEY_ID,
              r2SecretAccessKey: R2_SECRET_ACCESS_KEY, r2Bucket: R2_BUCKET,
              supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_KEY,
              folderPath: folderPath || undefined,
              originalPath,
            })
          } catch (err) {
            console.error(`[${jobId}] Background error:`, err.message)
          }
        })
      } catch (err) {
        console.error('Upload error:', err)
        try { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: err.message })) } catch {}
      }
    })
    return
  }

  // Autenticação
  if (API_KEY) {
    const auth = req.headers.authorization || ''
    if (auth !== `Bearer ${API_KEY}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unauthorized' }))
      return
    }
  }

  // Processar vídeo (via edge function — baixa do R2 primeiro)
  if (req.method === 'POST' && req.url === '/process') {
    ;(async () => {
      let body = ''
      for await (const chunk of req) body += chunk
      const job = JSON.parse(body)
      const originalPath = `/tmp/original_${job.jobId}.mp4`
      await downloadFromR2(job.r2AccountId, job.r2AccessKeyId, job.r2SecretAccessKey, job.r2Bucket, job.r2Key, originalPath)
      await processJobFromDisk({ ...job, originalPath })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true }))
    })().catch(err => {
      console.error('Erro no /process:', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message }))
    })
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, () => {
  console.log(`Video Render Service rodando na porta ${PORT}`)
  console.log(`API Key: ${API_KEY ? 'configurada' : 'NÃO configurada (sem autenticação)'}`)
  console.log(`R2 config: ${R2_ACCOUNT_ID ? 'OK' : 'MISSING'}, ${R2_ACCESS_KEY_ID ? 'OK' : 'MISSING'}, ${R2_SECRET_ACCESS_KEY ? 'OK' : 'MISSING'}`)
  console.log(`Supabase config: ${SUPABASE_URL ? 'OK' : 'MISSING'}, ${SUPABASE_KEY ? 'OK' : 'MISSING'}`)
})