import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, type RPCollection, type RPRoot, type RPSessionState } from '../db'
import { loadCatalog } from '../rp/catalog'
import { AppLayout } from '../ui/AppLayout'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

function nowIso() {
  return new Date().toISOString()
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

export function RPSessionPage() {
  const { sessionId = '' } = useParams()
  const nav = useNavigate()

  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId])
  const person = useLiveQuery(async () => {
    if (!session) return undefined
    return db.people.get(session.personId)
  }, [session?.personId])

  const rp = useLiveQuery(() => db.rpSessions.get(sessionId), [sessionId])

  const collections = useLiveQuery(async () => {
    const all = await db.rpCollections.where('sessionId').equals(sessionId).toArray()
    return all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }, [sessionId])

  const roots = useLiveQuery(async () => {
    const all = await db.rpRoots.where('sessionId').equals(sessionId).toArray()
    return all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }, [sessionId])

  const catalogOk = useLiveQuery(async () => {
    const c = await loadCatalog()
    return !!c
  }, [])

  async function goBrowse() {
    if (!sessionId) return
    await ensureBuildingCollection({ sessionId })
    nav(`/sessions/${encodeURIComponent(sessionId)}/pathways/browse`)
  }

  async function startRestoration() {
    if (!sessionId) return
    const { rp: rpSession } = await ensureBuildingCollection({ sessionId })
    const t = nowIso()
    // Start restoration in LIFO order (newest root first), so clear any pinned root.
    await db.rpSessions.put({ ...rpSession, phase: 'restoration', currentState: 'RESTORE_INIT', currentRootId: undefined, updatedAt: t })
    nav(`/sessions/${encodeURIComponent(sessionId)}/pathways/run`)
  }

  if (!session) {
    return (
      <AppLayout title="Restorative Pathways">
        <Card>
          <div className="text-sm text-slate-300">Session not found.</div>
        </Card>
      </AppLayout>
    )
  }

  const activeCollectionId = rp?.currentCollectionId
  const activeRoots = (roots ?? []).filter((r) => (activeCollectionId ? r.collectionId === activeCollectionId : false))

  const restoredCount = (roots ?? []).filter((r) => r.status === 'restored').length
  const deferredCount = (roots ?? []).filter((r) => r.status === 'deferred').length

  return (
    <AppLayout title="Restorative Pathways">
      <div className="space-y-4">
        <Card>
          <div className="space-y-2">
            <div className="text-sm font-extrabold">{person?.name ?? 'Client'}</div>
            <div className="text-xs text-slate-400">Session: {new Date(session.startedAt).toLocaleString()}</div>

            {!catalogOk ? (
              <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-3 text-sm text-amber-100">
                Catalog not loaded yet. Go to <span className="font-semibold">Settings → Restorative Pathways catalog</span> and
                import the node index JSON.
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={goBrowse} disabled={!catalogOk} variant="secondary" className="w-full">
                Add pathways
              </Button>
              <Button onClick={startRestoration} variant="secondary" className="w-full">
                Start restoration
              </Button>
            </div>

            <div className="text-xs text-slate-400">
              {restoredCount} restored • {deferredCount} deferred • {(collections ?? []).length} collections
            </div>
          </div>
        </Card>

        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current collection</div>
        {activeCollectionId ? (
          <div className="space-y-3">
            {activeRoots.length ? (
              activeRoots.map((r: RPRoot) => (
                <Card key={r.id}>
                  <div className="space-y-1">
                    <div className="text-sm font-extrabold">{r.path[r.path.length - 1] ?? r.domain}</div>
                    <div className="text-xs text-slate-400">{r.domain}</div>
                    <div className="text-xs text-slate-300">{r.path.join(' → ')}</div>
                    {r.notes ? <div className="text-xs text-slate-300 whitespace-pre-wrap">Notes: {r.notes}</div> : null}
                    <div className="text-xs text-slate-400">Status: {r.status}</div>
                  </div>
                </Card>
              ))
            ) : (
              <Card>
                <div className="text-sm text-slate-300">No pathways added to the current collection yet.</div>
              </Card>
            )}
          </div>
        ) : (
          <Card>
            <div className="text-sm text-slate-300">No active collection yet.</div>
          </Card>
        )}

        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tools</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link to={`/sessions/${encodeURIComponent(sessionId)}`}>
            <Button className="w-full" variant="ghost">
              Back to session
            </Button>
          </Link>
          <Link to={`/sessions/${encodeURIComponent(sessionId)}/pathways/run`}>
            <Button className="w-full" variant="ghost">
              Open runner
            </Button>
          </Link>
        </div>

        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Collections</div>
        <div className="space-y-3">
          {(collections ?? []).length ? (
            (collections ?? []).map((c) => (
              <Card key={c.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-extrabold">{c.status === 'building' ? 'Building' : 'Complete'}</div>
                    <div className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleString()}</div>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      const rpSession = await ensureRpSession(sessionId)
                      const t = nowIso()
                      await db.rpSessions.put({ ...rpSession, currentCollectionId: c.id, updatedAt: t })
                    }}
                  >
                    Set active
                  </Button>
                </div>
              </Card>
            ))
          ) : (
            <Card>
              <div className="text-sm text-slate-300">No collections yet.</div>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

