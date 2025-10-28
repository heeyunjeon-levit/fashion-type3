/*
 Batch runner: reads items.jsonl and runs the full pipeline in parallel.
 Usage:
   NEXT_PORT=3001 ts-node --esm scripts/run_items_jsonl.ts /Users/levit/Downloads/items.jsonl --photos-dir /Users/levit/Desktop/photos --concurrency 3
 Env:
   NEXT_PORT (default 3000)
   NEXT_BASE (default http://localhost:${NEXT_PORT})
   PYTHON_CROPPER_URL (default http://localhost:8000)
*/

const fs = require('fs')
const path = require('path')

type JsonlItem = {
  filename: string
  items?: Array<{ name: string; qty: number }>
  items_flat?: string[]
}

type ProductOption = { link: string; thumbnail: string | null; title: string | null }

const argv = process.argv.slice(2)
if (argv.length < 1) {
  console.error('Usage: ts-node scripts/run_items_jsonl.ts <items.jsonl> [--photos-dir <dir>] [--concurrency <n>]')
  process.exit(1)
}

const jsonlPath = argv[0]
const photosDirArgIdx = argv.indexOf('--photos-dir')
const concurrencyIdx = argv.indexOf('--concurrency')
const photosDir = photosDirArgIdx >= 0 ? argv[photosDirArgIdx + 1] : '/Users/levit/Desktop/photos'
const concurrency = concurrencyIdx >= 0 ? Math.max(1, parseInt(argv[concurrencyIdx + 1] || '3', 10)) : 3

const NEXT_PORT = process.env.NEXT_PORT ? parseInt(process.env.NEXT_PORT, 10) : 3000
const NEXT_BASE = process.env.NEXT_BASE || `http://127.0.0.1:${NEXT_PORT}`
const PYTHON_CROPPER_URL = process.env.PYTHON_CROPPER_URL || 'http://127.0.0.1:8000'

const koToEn: Record<string, string> = {
  '상의': 'tops',
  '하의': 'bottoms',
  '신발': 'shoes',
  '가방': 'bag',
  '악세사리': 'accessory',
  '드레스': 'dress',
}

function mapKoreanToEnglish(name: string): string {
  return koToEn[name] || name
}

function flattenItems(item: JsonlItem): string[] {
  if (item.items && Array.isArray(item.items)) {
    const out: string[] = []
    for (const it of item.items) {
      const en = mapKoreanToEnglish(it.name)
      for (let i = 0; i < (it.qty || 0); i++) out.push(en)
    }
    return out
  }
  if (item.items_flat && Array.isArray(item.items_flat)) {
    return item.items_flat.map(mapKoreanToEnglish)
  }
  return []
}

async function uploadLocalViaNextUpload(localPath: string): Promise<string> {
  const FormData = require('form-data')
  const http = require('http')
  const buffer = fs.readFileSync(localPath)
  const form = new FormData()
  const filename = path.basename(localPath)
  form.append('file', buffer, { filename })
  
  // Use http.request instead of fetch for form-data compatibility
  return new Promise((resolve, reject) => {
    const url = new URL(`${NEXT_BASE}/api/upload`)
    const port = url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 3000)
    const options = {
      hostname: url.hostname,
      port: port,
      path: url.pathname,
      method: 'POST',
      headers: form.getHeaders()
    }
    
    const req = http.request(options, (res: any) => {
      let data = ''
      res.on('data', (chunk: any) => data += chunk)
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`upload failed: ${res.statusCode} ${data}`))
        } else {
          try {
            const json = JSON.parse(data)
            if (!json.imageUrl) reject(new Error('upload returned no imageUrl'))
            else resolve(json.imageUrl)
          } catch (e) {
            reject(new Error(`Failed to parse response: ${data}`))
          }
        }
      })
    })
    
    req.on('error', (err: Error) => {
      reject(new Error(`HTTP request error: ${err.message}`))
    })
    
    form.pipe(req)
  })
}

async function cropWithCounts(originalUrl: string, categories: string[]): Promise<Record<string, string>> {
  const http = require('http')
  const https = require('https')
  
  // group by type and count
  const counts: Record<string, number> = {}
  for (const c of categories) counts[c] = (counts[c] || 0) + 1
  const results: Record<string, string> = {}

  await Promise.all(
    Object.entries(counts).map(async ([category, count]) => {
      const url = new URL(`${PYTHON_CROPPER_URL}/crop`)
      const payload = JSON.stringify({ imageUrl: originalUrl, categories: [category], count })
      
      return new Promise<void>((resolve, reject) => {
        const options = {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 8000),
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          },
          timeout: 180000 // 3 minute timeout for slow crop operations
        }
        
        const client = url.protocol === 'https:' ? https : http
        const req = client.request(options, (res: any) => {
          let data = ''
          res.on('data', (chunk: any) => data += chunk)
          res.on('end', () => {
            if (res.statusCode !== 200) {
              console.warn(`crop failed for ${category}: ${res.statusCode}`)
              resolve()
            } else {
              try {
                const json = JSON.parse(data)
                const urls: string[] = Array.isArray(json.croppedImageUrls)
                  ? json.croppedImageUrls
                  : json.croppedImageUrl
                    ? [json.croppedImageUrl]
                    : []
                if (urls.length > 0) {
                  urls.forEach((u, i) => {
                    const key = i === 0 ? category : `${category}_${i}`
                    results[key] = u
                  })
                }
                resolve()
              } catch (e) {
                console.warn(`crop response parse error for ${category}`)
                resolve()
              }
            }
          })
        })
        
        req.on('error', (err: Error) => {
          console.warn(`crop request error for ${category}: ${err.message}`)
          resolve()
        })
        
        req.on('timeout', () => {
          console.warn(`crop timeout for ${category}`)
          req.destroy()
          resolve()
        })
        
        req.write(payload)
        req.end()
      })
    })
  )
  return results
}

async function searchProducts(
  croppedImages: Record<string, string>,
  originalImageUrl: string
): Promise<Record<string, ProductOption[]>> {
  const res = await fetch(`${NEXT_BASE}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categories: Object.keys(croppedImages), croppedImages, originalImageUrl }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`search failed: ${res.status} ${txt}`)
  }
  const data = await res.json()
  return data.results || {}
}

async function runOne(item: JsonlItem, photosRoot: string) {
  const start = Date.now()
  const filePath = path.join(photosRoot, item.filename)
  const categories = flattenItems(item)
  const result: any = {
    filename: item.filename,
    categories,
    success: false,
  }
  try {
    if (!fs.existsSync(filePath)) throw new Error(`file not found: ${filePath}`)
    console.log(`    📤 Uploading...`)
    const uploadedUrl = await uploadLocalViaNextUpload(filePath)
    console.log(`    ✅ Uploaded: ${uploadedUrl.substring(0, 60)}...`)
    console.log(`    ✂️ Cropping (${categories.join(', ')})...`)
    const cropped = await cropWithCounts(uploadedUrl, categories)
    console.log(`    ✅ Cropped: ${Object.keys(cropped).length} items`)
    console.log(`    🔍 Searching...`)
    const search = await searchProducts(cropped, uploadedUrl)
    console.log(`    ✅ Search complete`)
    const duration = ((Date.now() - start) / 1000).toFixed(2)
    result.success = true
    result.duration_s = parseFloat(duration)
    result.uploadedUrl = uploadedUrl
    result.cropped = cropped
    result.results = search
    result.summary = Object.entries(search).map(([k, arr]) => ({ key: k, count: (arr || []).length }))
    return result
  } catch (e: any) {
    console.log(`    ❌ Error: ${e?.message || String(e)}`)
    result.error = e?.message || String(e)
    result.duration_s = parseFloat(((Date.now() - start) / 1000).toFixed(2))
    return result
  }
}

async function run() {
  const lines = fs.readFileSync(jsonlPath, 'utf8').split(/\r?\n/).filter(Boolean)
  const items: JsonlItem[] = lines.map((l: string) => JSON.parse(l))
  console.log(`Starting batch for ${items.length} images with concurrency=${concurrency}`)
  const results: any[] = []

  let idx = 0
  async function worker() {
    while (true) {
      const myIdx = idx++
      if (myIdx >= items.length) return
      const it = items[myIdx]
      console.log(`\n[${myIdx + 1}/${items.length}] ${it.filename} …`)
      const r = await runOne(it, photosDir)
      results.push(r)
      const counts = (r.summary || []).map((s: any) => `${s.key}:${s.count}`).join(', ')
      console.log(` -> ${r.success ? 'OK' : 'FAIL'} in ${r.duration_s}s${counts ? ' | ' + counts : ''}`)
    }
  }

  await Promise.all(new Array(concurrency).fill(0).map(() => worker()))

  const outDir = path.join(__dirname, '..', 'batch_test_results')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `items-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  const summary = {
    timestamp: new Date().toISOString(),
    total: items.length,
    ok: results.filter((r) => r.success).length,
    fail: results.filter((r) => !r.success).length,
    results,
  }
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2))
  console.log(`\nSaved results to: ${outPath}`)
}

run().catch((e) => {
  console.error('Batch failed:', e)
  process.exit(1)
})


