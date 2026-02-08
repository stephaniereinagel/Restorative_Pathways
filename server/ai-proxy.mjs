import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const PORT = Number(process.env.AI_PROXY_PORT || 8787)
const HOST = process.env.AI_PROXY_HOST || '127.0.0.1'
const API_KEY = (process.env.OPENAI_API_KEY || '').trim()
const DEFAULT_MODEL = (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim()

const GUIDE_PATH =
  process.env.RP_FRAMEWORK_GUIDE_PATH ||
  path.resolve(process.cwd(), 'public', 'rp', 'framework_guide.txt')

function loadFrameworkGuide() {
  try {
    const text = fs.readFileSync(GUIDE_PATH, 'utf8')
    return text
  } catch {
    return null
  }
}

function chunkGuide(text) {
  const lines = String(text || '').split(/\r?\n/)
  const chunks = []
  let cur = null

  const push = () => {
    if (!cur) return
    const body = cur.body.trim()
    if (!cur.title || !body) return
    chunks.push({ title: cur.title, level: cur.level, body })
  }

  for (const line of lines) {
    const m = /^(#{2,4})\s+(.*)$/.exec(line.trim())
    if (m) {
      push()
      cur = { level: m[1].length, title: m[2].trim(), body: '' }
      continue
    }
    if (!cur) continue
    cur.body += `${line}\n`
  }
  push()
  return chunks
}

function tokenize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && t.length <= 32)
}

function retrieveFromGuide(args) {
  const { chunks, query, limit = 3, maxChars = 1800 } = args
  if (!chunks?.length) return []

  const tokens = new Set(tokenize(query))
  if (!tokens.size) return []

  const scored = chunks
    .map((c) => {
      const hay = `${c.title}\n${c.body}`.toLowerCase()
      let score = 0
      for (const t of tokens) {
        if (hay.includes(t)) score += 1
      }
      return { c, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  const out = []
  let used = 0
  for (const { c } of scored) {
    const snippet = c.body.length > 900 ? `${c.body.slice(0, 900).trim()}…` : c.body
    const block = `### ${c.title}\n${snippet}`.trim()
    if (!block) continue
    if (used + block.length > maxChars) break
    out.push({ title: c.title, excerpt: snippet })
    used += block.length
  }
  return out
}

const guideText = loadFrameworkGuide()
const guideChunks = guideText ? chunkGuide(guideText) : []

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 1_000_000) reject(new Error('Payload too large'))
    })
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch (e) {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

async function callOpenAIChat({ model, temperature, messages }) {
  if (!API_KEY) throw new Error('OPENAI_API_KEY is not set on this computer')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ model, temperature, messages }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`OpenAI error (${res.status}): ${txt}`.trim())
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content ?? ''
  return String(content).trim()
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) return sendJson(res, 400, { error: 'Missing URL' })
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

    if (req.method === 'GET' && url.pathname === '/api/ai/ping') {
      return sendJson(res, 200, {
        ok: true,
        model: DEFAULT_MODEL,
        keyConfigured: !!API_KEY,
        guideLoaded: !!guideText,
        guidePath: GUIDE_PATH,
      })
    }

    if (req.method === 'GET' && url.pathname === '/api/ai/retrieve') {
      const q = url.searchParams.get('q') || ''
      const matches = retrieveFromGuide({ chunks: guideChunks, query: q, limit: 4 })
      return sendJson(res, 200, { ok: true, matches })
    }

    if (req.method === 'POST' && url.pathname === '/api/ai/chat') {
      const body = await readJson(req)
      const system = String(body?.system ?? '')
      const user = String(body?.user ?? '')
      const model = String(body?.model ?? DEFAULT_MODEL)
      const temperature = typeof body?.temperature === 'number' ? body.temperature : 0.4

      if (!system.trim() || !user.trim()) return sendJson(res, 400, { error: 'Missing system or user prompt' })

      const matches = retrieveFromGuide({ chunks: guideChunks, query: user, limit: 4 })
      const reference =
        matches.length && guideText
          ? [
              'Framework reference (excerpts from the Restorative Pathways Framework Guide; use for alignment, not authority):',
              ...matches.map((m) => `- ${m.title}: ${m.excerpt}`),
              '',
              'If the question cannot be answered from these principles, say so calmly and stay within scope.',
            ].join('\n')
          : ''

      const userWithRef = reference ? `${user}\n\n${reference}` : user

      const content = await callOpenAIChat({
        model,
        temperature,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userWithRef },
        ],
      })
      return sendJson(res, 200, { content })
    }

    return sendJson(res, 404, { error: 'Not found' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return sendJson(res, 500, { error: msg })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[ai-proxy] listening on http://${HOST}:${PORT}`)
  console.log(`[ai-proxy] key configured: ${API_KEY ? 'yes' : 'no'} (set OPENAI_API_KEY to enable)`)
})

