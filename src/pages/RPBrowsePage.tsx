import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, type RPCollection, type RPRoot, type RPSessionState } from '../db'
import { buildNodePathLabels, loadCatalog, type RPCatalog } from '../rp/catalog'
import { AppLayout } from '../ui/AppLayout'
import { AiAssistModal } from '../ui/AiAssistModal'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'

function nowIso() {
  return new Date().toISOString()
}

function collapseWrapperNodeId(catalog: RPCatalog | null | undefined, startId: string): string {
  if (!catalog) return startId
  let cur = startId
  const seen = new Set<string>()
  while (cur && !seen.has(cur)) {
    seen.add(cur)
    const n = catalog.nodes[cur]
    if (!n) break
    const kids = n.children ?? []
    if (kids.length !== 1) break
    const childId = kids[0]
    const child = catalog.nodes[childId]
    if (!child) break
    // “Wrapper node” heuristic: single child and repeated label.
    if ((child.label ?? '').trim() !== (n.label ?? '').trim()) break
    cur = childId
  }
  return cur
}

async function ensureRpSession(sessionId: string): Promise<RPSessionState> {
  const existing = await db.rpSessions.get(sessionId)
  if (existing) return existing
  const t = nowIso()
  const s: RPSessionState = {
    sessionId,
    phase: 'discovery',
    currentState: 'RESTORE_INIT',
    stopRequested: false,
    createdAt: t,
    updatedAt: t,
  }
  await db.rpSessions.put(s)
  return s
}

async function ensureBuildingCollection(args: { sessionId: string }): Promise<{ rp: RPSessionState; collection: RPCollection }> {
  const t = nowIso()
  const rp = await ensureRpSession(args.sessionId)

  const existing = rp.currentCollectionId ? await db.rpCollections.get(rp.currentCollectionId) : undefined
  if (existing && existing.status === 'building') return { rp, collection: existing }

  const building = await db.rpCollections.where('sessionId').equals(args.sessionId).and((c) => c.status === 'building').first()
  if (building) {
    const next: RPSessionState = { ...rp, currentCollectionId: building.id, phase: 'discovery', updatedAt: t }
    await db.rpSessions.put(next)
    return { rp: next, collection: building }
  }

  const c: RPCollection = { id: newId(), sessionId: args.sessionId, status: 'building', createdAt: t, updatedAt: t }
  const next: RPSessionState = { ...rp, currentCollectionId: c.id, phase: 'discovery', updatedAt: t }
  await db.transaction('rw', [db.rpCollections, db.rpSessions], async () => {
    await db.rpCollections.add(c)
    await db.rpSessions.put(next)
  })
  return { rp: next, collection: c }
}

export function RPBrowsePage() {
  const { sessionId = '' } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()

  const nodeId = params.get('nodeId') ?? ''
  const [q, setQ] = useState('')
  const [addTargetId, setAddTargetId] = useState<string | null>(null)
  const [addNotes, setAddNotes] = useState('')
  const [aiNodeId, setAiNodeId] = useState<string | null>(null)

  const catalog = useLiveQuery(() => loadCatalog(), [])

  function openAddPanel(id: string) {
    setAddTargetId(id)
    setAddNotes('')
  }

  const curNode = useMemo(() => {
    if (!catalog) return null
    if (!nodeId) return null
    return catalog.nodes[collapseWrapperNodeId(catalog, nodeId)] ?? null
  }, [catalog, nodeId])

  const effectiveNodeId = useMemo(() => {
    if (!catalog) return nodeId
    if (!nodeId) return ''
    return collapseWrapperNodeId(catalog, nodeId)
  }, [catalog, nodeId])

  const children = useMemo(() => {
    if (!catalog) return []
    const ids = effectiveNodeId ? (catalog.nodes[effectiveNodeId]?.children ?? []) : catalog.rootIds
    const out = ids
      .map((id) => ({ id, node: catalog.nodes[id] }))
      .filter((x) => !!x.node)
      .map((x) => ({ id: x.id, node: x.node! }))
    out.sort((a, b) => a.node.label.localeCompare(b.node.label))
    return out
  }, [catalog, effectiveNodeId])

  const breadcrumb = useMemo(() => {
    if (!catalog || !nodeId) return []
    const ids: string[] = []
    let cur: string | undefined = effectiveNodeId || nodeId
    while (cur) {
      ids.unshift(cur)
      cur = catalog.parentById[cur]
    }
    // Collapse repeated labels (wrapper nodes).
    const collapsed: string[] = []
    let lastLabel: string | null = null
    for (const id of ids) {
      const label = (catalog.nodes[id]?.label ?? id).trim()
      if (lastLabel && label === lastLabel) continue
      collapsed.push(id)
      lastLabel = label
    }
    return collapsed
  }, [catalog, effectiveNodeId, nodeId])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return children
    return children.filter((c) => c.node.label.toLowerCase().includes(s) || c.node.domain.toLowerCase().includes(s))
  }, [children, q])

  function canAddNode(node: { selectable: boolean; level: number } | null | undefined) {
    if (!node) return false
    // Per your request: allow logging without drilling all the way down.
    // Anything level 4+ is eligible to log, even if it has children.
    return node.selectable || node.level >= 4
  }

  async function addPathway(targetNodeId: string, notes?: string) {
    if (!catalog) return
    const node = catalog.nodes[targetNodeId]
    if (!node) return

    const { rp, collection } = await ensureBuildingCollection({ sessionId })
    const t = nowIso()

    const path = buildNodePathLabels({ nodeId: targetNodeId, catalog })

    const root: RPRoot = {
      id: newId(),
      sessionId,
      collectionId: collection.id,
      pathwayNodeId: targetNodeId,
      domain: node.domain,
      path,
      source: { type: 'discovery_tree' },
      notes: notes?.trim() ? notes.trim() : undefined,
      status: 'identified',
      createdAt: t,
      updatedAt: t,
    }

    await db.transaction('rw', [db.rpRoots, db.rpSessions], async () => {
      await db.rpRoots.add(root)
      await db.rpSessions.put({ ...rp, currentCollectionId: collection.id, updatedAt: t })
    })

    nav(`/sessions/${encodeURIComponent(sessionId)}/pathways`)
  }

  if (!catalog) {
    return (
      <AppLayout title="Browse pathways">
        <Card>
          <div className="space-y-2">
            <div className="text-sm text-slate-300">Catalog not loaded.</div>
            <Link to="/settings">
              <Button variant="secondary">Go to Settings</Button>
            </Link>
          </div>
        </Card>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Browse pathways">
      <div className="space-y-4">
        <AiAssistModal
          isOpen={!!aiNodeId}
          onClose={() => setAiNodeId(null)}
          sessionId={sessionId}
          title={aiNodeId ? `Explain: ${catalog.nodes[aiNodeId]?.label ?? 'Pathway'}` : 'Explain'}
          contextLines={
            aiNodeId
              ? [
                  `Path: ${buildNodePathLabels({ nodeId: aiNodeId, catalog }).join(' → ')}`,
                  `Domain: ${catalog.nodes[aiNodeId]?.domain ?? ''}`,
                ]
              : []
          }
          defaultQuestion="What does this mean in the Restorative Pathways framework? Please explain in plain English."
          suggestionChips={[
            'Explain this in plain English for a parent.',
            'What might this look like in real life?',
            'What are gentle next steps or supports to consider?',
          ]}
        />

        {addTargetId ? (
          <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/30 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-2xl border border-[#e5dccf] bg-[#fbf7ef] p-4 shadow-xl">
              <div className="space-y-3">
                <div className="text-sm font-extrabold">Add to log</div>
                <div className="text-sm text-[#2b2a28]">{catalog.nodes[addTargetId]?.label ?? 'Pathway'}</div>
                <div className="text-xs text-[#6b645c]">{catalog.nodes[addTargetId]?.domain ?? ''}</div>
                <div className="text-xs text-[#6b645c]">{buildNodePathLabels({ nodeId: addTargetId, catalog }).join(' → ')}</div>

                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#6b645c]">Notes (optional)</div>
                  <Textarea
                    rows={3}
                    value={addNotes}
                    onChange={(e) => setAddNotes(e.target.value)}
                    placeholder="Add any context you want saved with this pathway…"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={async () => {
                      await addPathway(addTargetId, addNotes)
                      setAddTargetId(null)
                      setAddNotes('')
                    }}
                  >
                    Add
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setAddTargetId(null)
                      setAddNotes('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <Card className="p-3">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#6b645c]">Decision tree</div>
              <div className="text-[11px] text-[#7c756d]">
                {filtered.length} options • catalog {catalog.version}
              </div>
            </div>

            <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 text-sm text-[#5b554d] whitespace-nowrap">
              <Link
                to={`/sessions/${encodeURIComponent(sessionId)}/pathways/browse`}
                className="shrink-0 rounded-lg bg-[#f2ebe0] px-2 py-1 font-semibold text-[#2e4a5c] hover:bg-[#eadfce]"
              >
                Root
              </Link>
              {breadcrumb.map((id) => (
                <Link
                  key={id}
                  to={`/sessions/${encodeURIComponent(sessionId)}/pathways/browse?nodeId=${encodeURIComponent(id)}`}
                  className="shrink-0 rounded-lg bg-[#f2ebe0] px-2 py-1 font-semibold text-[#2b2a28] hover:bg-[#eadfce]"
                >
                  {catalog.nodes[id]?.label ?? id}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="py-1 text-sm"
              />
              {nodeId && curNode && canAddNode(curNode) ? (
                <Button variant="secondary" className="shrink-0 px-3 py-2 text-sm" onClick={() => openAddPanel(nodeId)}>
                  + Add
                </Button>
              ) : null}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-1">
          {filtered.length ? (
            filtered.map((c) => (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                className={`relative h-24 rounded-2xl border border-[#e5dccf] bg-[#fffdf9] p-2 shadow-sm ${
                  c.node.children?.length ? 'cursor-pointer hover:bg-[#fbf7ef]' : canAddNode(c.node) ? 'cursor-pointer' : ''
                }`}
                onClick={() => {
                  if (c.node.children?.length) {
                    nav(`/sessions/${encodeURIComponent(sessionId)}/pathways/browse?nodeId=${encodeURIComponent(c.id)}`)
                    return
                  }
                  if (canAddNode(c.node)) openAddPanel(c.id)
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return
                  e.preventDefault()
                  if (c.node.children?.length) {
                    nav(`/sessions/${encodeURIComponent(sessionId)}/pathways/browse?nodeId=${encodeURIComponent(c.id)}`)
                    return
                  }
                  if (canAddNode(c.node)) openAddPanel(c.id)
                }}
              >
                <button
                  type="button"
                  className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#e5dccf] bg-[#fffdf9] text-xs font-extrabold text-[#2e4a5c]"
                  onClick={(e) => {
                    e.stopPropagation()
                    setAiNodeId(c.id)
                  }}
                  aria-label="Explain this pathway"
                  title="Explain"
                >
                  ?
                </button>

                <div className="min-w-0 pr-7">
                  <div className="line-clamp-2 text-[12px] font-extrabold leading-tight">{c.node.label}</div>
                  <div className="mt-1 text-[10px] text-[#7c756d]">
                    {(() => {
                      const effective = collapseWrapperNodeId(catalog, c.id)
                      const n = catalog.nodes[effective]
                      const count = n?.children?.length ?? 0
                      return `${count} children`
                    })()}
                  </div>
                </div>

                <div className="absolute bottom-1 right-1">
                  <Button
                    variant="secondary"
                    className="px-1.5 py-0.5 text-[10px]"
                    disabled={!canAddNode(c.node)}
                    onClick={(e) => {
                      e.stopPropagation()
                      openAddPanel(c.id)
                    }}
                  >
                    +
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-2">
              <Card>
                <div className="text-sm text-slate-300">No matches at this level.</div>
              </Card>
            </div>
          )}
        </div>

        <Link to={`/sessions/${encodeURIComponent(sessionId)}/pathways`}>
          <Button className="w-full" variant="ghost">
            Back
          </Button>
        </Link>
      </div>
    </AppLayout>
  )
}

