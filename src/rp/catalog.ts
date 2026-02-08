import { db } from '../db'

export type RPNode = {
  label: string
  level: number
  domain: string
  children: string[]
  selectable: boolean
}

export type RPCatalog = {
  version: string
  nodes: Record<string, RPNode>
  rootIds: string[]
  parentById: Record<string, string | undefined>
}

const KV_VERSION = 'rp.catalog.version'
const KV_NODE_INDEX = 'rp.nodeIndex.json'
const KV_MAP_CSV = 'rp.map.csv'

// Optional “hosted on your computer” defaults (served from Vite's `public/` folder).
// Example when browsing from phone: `http://192.168.68.116:5173/rp/master_restorative_pathways_node_index_v1_0.json`
const DEFAULT_NODE_INDEX_URL = '/rp/master_restorative_pathways_node_index_v1_0.json'
const DEFAULT_MAP_CSV_URL = '/rp/master_restorative_pathways_map_v1_0.csv'

export async function getCatalogVersion(): Promise<string | null> {
  const row = await db.kv.get(KV_VERSION)
  return row?.value ?? null
}

async function tryAutoLoadCatalogFromSameOrigin(): Promise<{ ok: boolean; version?: string }> {
  try {
    const res = await fetch(DEFAULT_NODE_INDEX_URL, { cache: 'no-store' })
    if (!res.ok) return { ok: false }
    const parsed = (await res.json()) as { version?: string; nodes?: Record<string, RPNode> }
    if (!parsed?.nodes || typeof parsed.nodes !== 'object') return { ok: false }
    const ids = Object.keys(parsed.nodes)
    if (!ids.length) return { ok: false }

    // Light validation on one node.
    const sample = parsed.nodes[ids[0]]
    if (!sample || typeof sample.label !== 'string' || !Array.isArray(sample.children)) return { ok: false }

    const t = new Date().toISOString()
    await db.transaction('rw', db.kv, async () => {
      await db.kv.put({ key: KV_NODE_INDEX, value: JSON.stringify(parsed), updatedAt: t })
      await db.kv.put({ key: KV_VERSION, value: parsed.version ?? 'unknown', updatedAt: t })
    })

    // Map CSV is optional; if present on server, cache it too.
    try {
      const mapRes = await fetch(DEFAULT_MAP_CSV_URL, { cache: 'no-store' })
      if (mapRes.ok) {
        const text = await mapRes.text()
        const head = text.split(/\r?\n/, 1)[0] ?? ''
        if (head.toLowerCase().includes('id') && head.toLowerCase().includes('domain')) {
          await db.kv.put({ key: KV_MAP_CSV, value: text, updatedAt: t })
        }
      }
    } catch {
      // ignore optional map failures
    }

    return { ok: true, version: parsed.version ?? 'unknown' }
  } catch {
    return { ok: false }
  }
}

export async function loadCatalog(): Promise<RPCatalog | null> {
  const [ver, nodeIndexRow] = await Promise.all([db.kv.get(KV_VERSION), db.kv.get(KV_NODE_INDEX)])
  if (!ver?.value || !nodeIndexRow?.value) {
    // If catalog isn't loaded yet, try to auto-load it from the same origin (LAN-hosted dev server).
    const auto = await tryAutoLoadCatalogFromSameOrigin()
    if (!auto.ok) return null
    return await loadCatalog()
  }

  const parsed = JSON.parse(nodeIndexRow.value) as { version?: string; nodes?: Record<string, RPNode> }
  if (!parsed?.nodes || typeof parsed.nodes !== 'object') return null

  const nodes = parsed.nodes

  const parentById: Record<string, string | undefined> = {}
  const allIds = new Set(Object.keys(nodes))
  const childIds = new Set<string>()

  for (const [parentId, n] of Object.entries(nodes)) {
    for (const c of n.children ?? []) {
      parentById[c] = parentId
      childIds.add(c)
    }
  }

  const rootIds: string[] = []
  for (const id of allIds) {
    if (!childIds.has(id)) rootIds.push(id)
  }

  // Stable-ish ordering: domain then label.
  rootIds.sort((a, b) => {
    const na = nodes[a]
    const nb = nodes[b]
    return (na?.domain ?? '').localeCompare(nb?.domain ?? '') || (na?.label ?? '').localeCompare(nb?.label ?? '')
  })

  return {
    version: parsed.version ?? ver.value,
    nodes,
    rootIds,
    parentById,
  }
}

export function buildNodePathLabels(args: { nodeId: string; catalog: RPCatalog }): string[] {
  const out: string[] = []
  let cur: string | undefined = args.nodeId
  while (cur) {
    const n = args.catalog.nodes[cur]
    if (!n) break
    out.unshift(n.label)
    cur = args.catalog.parentById[cur]
  }
  return out
}

export async function importNodeIndexJson(file: File): Promise<{ version: string; nodeCount: number }> {
  const text = await file.text()
  const parsed = JSON.parse(text) as { version?: string; nodes?: Record<string, RPNode> }

  if (!parsed?.nodes || typeof parsed.nodes !== 'object') throw new Error('Invalid node index JSON: missing nodes')

  const ids = Object.keys(parsed.nodes)
  if (!ids.length) throw new Error('Invalid node index JSON: nodes is empty')

  // Light validation on one node.
  const sample = parsed.nodes[ids[0]]
  if (!sample || typeof sample.label !== 'string' || !Array.isArray(sample.children)) {
    throw new Error('Invalid node index JSON: unexpected node shape')
  }

  const t = new Date().toISOString()
  await db.transaction('rw', db.kv, async () => {
    await db.kv.put({ key: KV_NODE_INDEX, value: JSON.stringify(parsed), updatedAt: t })
    await db.kv.put({ key: KV_VERSION, value: parsed.version ?? 'unknown', updatedAt: t })
  })

  return { version: parsed.version ?? 'unknown', nodeCount: ids.length }
}

export async function importMapCsv(file: File): Promise<{ byteLength: number }> {
  const text = await file.text()
  // Minimal validation: header line must contain id + domain
  const head = text.split(/\r?\n/, 1)[0] ?? ''
  if (!head.toLowerCase().includes('id') || !head.toLowerCase().includes('domain')) {
    throw new Error('Invalid map CSV: missing expected headers')
  }
  const t = new Date().toISOString()
  await db.kv.put({ key: KV_MAP_CSV, value: text, updatedAt: t })
  return { byteLength: text.length }
}

export async function hasMapCsv(): Promise<boolean> {
  const row = await db.kv.get(KV_MAP_CSV)
  return !!row?.value
}

