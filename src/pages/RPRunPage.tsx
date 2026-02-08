import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, type RPCollection, type RPEvent, type RPIntegrationChannel, type RPRoot, type RPSessionState } from '../db'
import { buildRpClientSummary } from '../rp/summary'
import { AppLayout } from '../ui/AppLayout'
import { AiAssistModal } from '../ui/AiAssistModal'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { shareOrDownloadTextFile } from '../ui/download'
import { Textarea } from '../ui/Textarea'

function nowIso() {
  return new Date().toISOString()
}

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

async function ensureRpSession(sessionId: string): Promise<RPSessionState> {
  const existing = await db.rpSessions.get(sessionId)
  if (existing) return existing
  const t = nowIso()
  const s: RPSessionState = {
    sessionId,
    phase: 'restoration',
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
    const next = { ...rp, currentCollectionId: building.id, updatedAt: t }
    await db.rpSessions.put(next)
    return { rp: next, collection: building }
  }

  const c: RPCollection = { id: newId(), sessionId: args.sessionId, status: 'building', createdAt: t, updatedAt: t }
  const next = { ...rp, currentCollectionId: c.id, updatedAt: t }
  await db.transaction('rw', [db.rpCollections, db.rpSessions], async () => {
    await db.rpCollections.add(c)
    await db.rpSessions.put(next)
  })
  return { rp: next, collection: c }
}

async function pickNextUnrestoredRoot(args: { sessionId: string; collectionId: string }): Promise<RPRoot | null> {
  const roots = await db.rpRoots.where('collectionId').equals(args.collectionId).toArray()
  // Order rule (per RP "associated pathway" semantics):
  // - Prefer the MOST RECENTLY added eligible root first (LIFO stack)
  // - Work backward toward older/top-level pathways
  // - Only after no "identified" remain, consider "deferred" (still newest-first)
  const byNewestFirst = (a: RPRoot, b: RPRoot) => b.createdAt.localeCompare(a.createdAt)

  const identified = roots.filter((r) => r.status === 'identified').sort(byNewestFirst)
  if (identified.length) return identified[0]

  const deferred = roots.filter((r) => r.status === 'deferred').sort(byNewestFirst)
  if (deferred.length) return deferred[0]

  return null
}

function channelLabel(c: RPIntegrationChannel) {
  switch (c) {
    case 'stillness_presence':
      return 'Stillness & Presence'
    case 'breath':
      return 'Breath'
    case 'touch_contact':
      return 'Touch / Contact'
    case 'rhythmic_input':
      return 'Rhythmic Input'
    case 'meridian_trace':
      return 'Meridian / Energy Tracing'
    case 'gentle_movement':
      return 'Gentle Movement'
  }
}

const guidanceByChannel: Record<RPIntegrationChannel, string[]> = {
  stillness_presence: ['Settle into presence.', 'Let the body lead; no forcing.'],
  breath: ['Slow exhale.', 'Sigh (no forcing).', 'Let breath soften the area.'],
  touch_contact: ['Supportive hand on the area.', 'Gentle contact; ask “is this okay?”'],
  rhythmic_input: ['Tapping/bilateral/rocking (gentle).', 'Stay with what feels regulating.'],
  meridian_trace: ['Trace along a comfortable path.', 'Follow sensation changes.'],
  gentle_movement: ['Micro-movement or stretch.', 'Stop before strain; stay within ease.'],
}

export function RPRunPage() {
  const { sessionId = '' } = useParams()
  const nav = useNavigate()

  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId])
  const person = useLiveQuery(async () => {
    if (!session) return undefined
    return db.people.get(session.personId)
  }, [session?.personId])

  const rp = useLiveQuery(() => db.rpSessions.get(sessionId), [sessionId])
  const collection = useLiveQuery(async () => {
    if (!rp?.currentCollectionId) return undefined
    return db.rpCollections.get(rp.currentCollectionId)
  }, [rp?.currentCollectionId])
  const root = useLiveQuery(async () => {
    if (!rp?.currentRootId) return undefined
    return db.rpRoots.get(rp.currentRootId)
  }, [rp?.currentRootId])

  const rootsInSession = useLiveQuery(async () => db.rpRoots.where('sessionId').equals(sessionId).toArray(), [sessionId])
  const collectionsInSession = useLiveQuery(async () => db.rpCollections.where('sessionId').equals(sessionId).toArray(), [sessionId])

  const [channelsDraft, setChannelsDraft] = useState<RPIntegrationChannel[]>([])
  const [deferReason, setDeferReason] = useState('')
  // null = not edited yet (use stored value), '' = user intentionally cleared it
  const [nextStepsDraft, setNextStepsDraft] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(false)

  const sessionStartedAt = session?.startedAt ?? new Date().toISOString()

  const counts = useMemo(() => {
    const roots = rootsInSession ?? []
    const collections = collectionsInSession ?? []
    return {
      restoredRootsCount: roots.filter((r) => r.status === 'restored').length,
      deferredRootsCount: roots.filter((r) => r.status === 'deferred').length,
      identifiedRootsCount: roots.filter((r) => r.status === 'identified').length,
      collectionsCompletedCount: collections.filter((c) => c.status === 'complete').length,
    }
  }, [rootsInSession, collectionsInSession])

  const clientSummary = useMemo(() => {
    const extra = (nextStepsDraft ?? rp?.practitionerNotes ?? '').trim()
    return buildRpClientSummary({
      clientName: person?.name ?? 'Client',
      sessionStartedAt,
      sessionReason: session?.reason,
      sessionOpeningNotes: session?.notes,
      roots: (rootsInSession ?? []) as RPRoot[],
      additionalNextSteps: extra || undefined,
    })
  }, [person?.name, rootsInSession, rp?.practitionerNotes, session?.notes, session?.reason, sessionStartedAt, nextStepsDraft])

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(clientSummary)
      window.alert('Copied to clipboard.')
    } catch {
      window.alert('Copy failed. You can select and copy the text manually.')
    }
  }

  async function downloadSummary() {
    const day = new Date(sessionStartedAt).toISOString().slice(0, 10)
    await shareOrDownloadTextFile({
      filename: `restorative-pathways-session-summary-${day}.txt`,
      text: clientSummary,
    })
  }

  async function logEvent(args: Omit<RPEvent, 'id' | 'createdAt'>) {
    const e: RPEvent = { id: newId(), createdAt: nowIso(), ...args }
    await db.rpEvents.add(e)
  }

  async function goTo(nextState: RPSessionState['currentState'], action?: string) {
    const rpSession = await ensureRpSession(sessionId)
    const t = nowIso()
    const next: RPSessionState = { ...rpSession, currentState: nextState, phase: rpSession.phase ?? 'restoration', updatedAt: t }
    await db.rpSessions.put(next)
    await logEvent({
      sessionId,
      collectionId: next.currentCollectionId,
      rootId: next.currentRootId,
      state: nextState,
      action,
    })
  }

  async function ensureReady() {
    const { rp: rpSession, collection: col } = await ensureBuildingCollection({ sessionId })
    const t = nowIso()

    let currentRootId = rpSession.currentRootId
    if (!currentRootId) {
      const next = await pickNextUnrestoredRoot({ sessionId, collectionId: col.id })
      if (next) currentRootId = next.id
    }

    const nextRp: RPSessionState = {
      ...rpSession,
      phase: rpSession.phase ?? 'restoration',
      currentCollectionId: col.id,
      currentRootId,
      updatedAt: t,
    }
    await db.rpSessions.put(nextRp)
    return { rp: nextRp, collection: col, currentRootId }
  }

  async function stopSession() {
    const rpSession = await ensureRpSession(sessionId)
    const t = nowIso()
    await db.rpSessions.put({ ...rpSession, stopRequested: true, currentState: 'SESSION_CLOSE', phase: 'closure', updatedAt: t })
    await logEvent({
      sessionId,
      collectionId: rpSession.currentCollectionId,
      rootId: rpSession.currentRootId,
      state: 'SESSION_CLOSE',
      action: 'Stop Session',
    })
  }

  async function advanceFromRestoreInit() {
    const { rp: rpSession, currentRootId } = await ensureReady()
    if (!rpSession.currentCollectionId) {
      await goTo('ANOTHER_COLLECTION_CHECK', 'No collection')
      return
    }
    if (!currentRootId) {
      // Nothing to restore yet.
      await goTo('ASSOCIATED_PATHWAY_CHECK', 'No roots in collection')
      return
    }
    await goTo('ACKNOWLEDGMENT', 'Start root')
  }

  async function completeRootAndContinue(args?: { action?: string }) {
    const rpSession = await ensureRpSession(sessionId)
    const colId = rpSession.currentCollectionId
    if (!colId) return
    const next = await pickNextUnrestoredRoot({ sessionId, collectionId: colId })
    const t = nowIso()
    if (next) {
      await db.rpSessions.put({ ...rpSession, currentRootId: next.id, currentState: 'ACKNOWLEDGMENT', updatedAt: t })
      await logEvent({
        sessionId,
        collectionId: colId,
        rootId: next.id,
        state: 'ACKNOWLEDGMENT',
        action: args?.action ? `${args.action} → next root` : 'Next root',
      })
    } else {
      await db.rpSessions.put({ ...rpSession, currentState: 'ASSOCIATED_PATHWAY_CHECK', updatedAt: t })
      await logEvent({
        sessionId,
        collectionId: colId,
        rootId: undefined,
        state: 'ASSOCIATED_PATHWAY_CHECK',
        action: args?.action ? `${args.action} → no more roots` : 'No more roots',
      })
    }
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

  const currentState = rp?.currentState ?? 'RESTORE_INIT'
  const currentRoot = root
  const currentCollection = collection

  const selectedChannels = channelsDraft.length
    ? channelsDraft
    : (currentRoot?.restoration?.channelsUsed ?? [])

  return (
    <AppLayout title="Restoration runner">
      <div className="space-y-4">
        <AiAssistModal
          isOpen={aiOpen}
          onClose={() => setAiOpen(false)}
          sessionId={sessionId}
          title="Explain / Ask AI"
          contextLines={[
            `State: ${currentState}`,
            currentRoot ? `Pathway: ${currentRoot.path.join(' → ')}` : 'Pathway: (none selected)',
          ]}
          defaultQuestion={
            currentState === 'EMBODIED_INTEGRATION_PICK'
              ? 'Give gentle, kid-appropriate examples for Rhythmic Input (and a few alternatives), with safety cautions.'
              : 'Explain what this step means in the Restorative Pathways framework and suggest gentle options to proceed.'
          }
          suggestionChips={[
            'Explain this step in plain English for a parent.',
            'What does this mean in the Restorative Pathways framework?',
            'Give 5 gentle rhythmic input examples appropriate for a child.',
            'If this feels “not ready”, what might be needed first?',
          ]}
        />

        <Card>
          <div className="space-y-2">
            <div className="text-sm font-extrabold">{person?.name ?? 'Client'}</div>
            <div className="text-xs text-slate-400">Session: {fmt(session.startedAt)}</div>
            <div className="text-xs text-slate-400">State: {currentState}</div>
            {currentRoot ? (
              <div className="text-xs text-slate-300">
                Current root: <span className="font-semibold">{currentRoot.path[currentRoot.path.length - 1]}</span>
              </div>
            ) : (
              <div className="text-xs text-slate-300">No current root selected.</div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Link to={`/sessions/${encodeURIComponent(sessionId)}/pathways`}>
                <Button className="w-full" variant="ghost">
                  Back
                </Button>
              </Link>
              <Button className="w-full" variant="ghost" onClick={stopSession}>
                Stop session
              </Button>
            </div>
            <Button variant="secondary" className="w-full" onClick={() => setAiOpen(true)}>
              Explain
            </Button>
          </div>
        </Card>

        {currentState === 'RESTORE_INIT' ? (
          <Card>
            <div className="space-y-3">
              <div className="text-sm font-extrabold">Restore</div>
              <div className="text-sm text-slate-300">
                This will select the next root in the active collection and begin the restoration loop.
              </div>
              <Button onClick={advanceFromRestoreInit}>Begin</Button>
              <Link to={`/sessions/${encodeURIComponent(sessionId)}/pathways/browse`}>
                <Button variant="secondary" className="w-full">
                  Add pathways first
                </Button>
              </Link>
            </div>
          </Card>
        ) : null}

        {currentState === 'ACKNOWLEDGMENT' && currentRoot ? (
          <Card>
            <div className="space-y-3">
              <div className="text-sm font-extrabold">Acknowledgment</div>
              <div className="text-sm text-slate-200">{currentRoot.domain}</div>
              <div className="text-sm text-slate-300">{currentRoot.path.join(' → ')}</div>
              {currentRoot.source?.type ? <div className="text-xs text-slate-400">Source: {currentRoot.source.type}</div> : null}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={async () => {
                    const t = nowIso()
                    await db.rpRoots.put({
                      ...currentRoot,
                      restoration: { ...(currentRoot.restoration ?? {}), acknowledgedAt: t },
                      updatedAt: t,
                    })
                    await goTo('READINESS_CHECK', 'Acknowledge')
                  }}
                >
                  Acknowledge
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const t = nowIso()
                    await db.rpRoots.put({
                      ...currentRoot,
                      status: 'deferred',
                      restoration: { ...(currentRoot.restoration ?? {}), deferredAt: t, deferredReason: deferReason || undefined },
                      updatedAt: t,
                    })
                    setDeferReason('')
                    await completeRootAndContinue({ action: 'Pause / Defer' })
                  }}
                >
                  Pause / Defer
                </Button>
              </div>

              <Textarea
                rows={3}
                value={deferReason}
                onChange={(e) => setDeferReason(e.target.value)}
                placeholder="(Optional) If deferring, note what’s needed first…"
              />
            </div>
          </Card>
        ) : null}

        {currentState === 'READINESS_CHECK' && currentRoot ? (
          <Card>
            <div className="space-y-3">
              <div className="text-sm font-extrabold">Readiness Gate</div>
              <div className="text-sm text-slate-300">Is this ready to be restored now?</div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={async () => {
                    const t = nowIso()
                    await db.rpRoots.put({
                      ...currentRoot,
                      restoration: { ...(currentRoot.restoration ?? {}), readinessResult: 'ready' },
                      updatedAt: t,
                    })
                    await goTo('AUTHORITY_TRANSFER', 'Ready')
                  }}
                >
                  Ready
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const t = nowIso()
                    await db.rpRoots.put({
                      ...currentRoot,
                      restoration: { ...(currentRoot.restoration ?? {}), readinessResult: 'not_ready' },
                      updatedAt: t,
                    })
                    await goTo('NOT_CONDITIONAL', 'Not Ready')
                  }}
                >
                  Not Ready
                </Button>
              </div>
              <Button
                variant="secondary"
                onClick={async () => {
                  const t = nowIso()
                  await db.rpRoots.put({
                    ...currentRoot,
                    restoration: { ...(currentRoot.restoration ?? {}), readinessResult: 'conditional' },
                    updatedAt: t,
                  })
                  await goTo('NOT_CONDITIONAL', 'Conditional')
                }}
              >
                Conditional / Needs Something First
              </Button>
            </div>
          </Card>
        ) : null}

        {currentState === 'NOT_CONDITIONAL' && currentRoot ? (
          <Card>
            <div className="space-y-3">
              <div className="text-sm font-extrabold">Honor the “not yet”</div>
              <div className="text-sm text-slate-300">
                Defer this root, return to discovery, or identify an associated pathway to restore first.
              </div>
              <Textarea
                rows={3}
                value={deferReason}
                onChange={(e) => setDeferReason(e.target.value)}
                placeholder="(Optional) What is needed first?"
              />
              <div className="grid gap-2">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const t = nowIso()
                    await db.rpRoots.put({
                      ...currentRoot,
                      status: 'deferred',
                      restoration: { ...(currentRoot.restoration ?? {}), deferredAt: t, deferredReason: deferReason || undefined },
                      updatedAt: t,
                    })
                    setDeferReason('')
                    await completeRootAndContinue({ action: 'Defer root' })
                  }}
                >
                  Defer root & continue
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const t = nowIso()
                    const rpSession = await ensureRpSession(sessionId)
                    await db.rpSessions.put({ ...rpSession, phase: 'discovery', currentState: 'RESTORE_INIT', updatedAt: t })
                    nav(`/sessions/${encodeURIComponent(sessionId)}/pathways`)
                  }}
                >
                  Return to discovery
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    // “Associated pathway” here means: current root is blocked until another root is restored.
                    // So we park the current root and go add the prerequisite (which will be newer and therefore run first).
                    const rpSession = await ensureRpSession(sessionId)
                    const t = nowIso()
                    await db.rpSessions.put({
                      ...rpSession,
                      phase: 'identified_paths_for_collection',
                      currentState: 'RESTORE_INIT',
                      currentRootId: undefined,
                      updatedAt: t,
                    })
                    nav(`/sessions/${encodeURIComponent(sessionId)}/pathways/browse`)
                  }}
                >
                  Find associated pathway
                </Button>
                <Button onClick={stopSession} variant="danger">
                  End session
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        {currentState === 'AUTHORITY_TRANSFER' && currentRoot ? (
          <Card>
            <div className="space-y-3">
              <div className="text-sm font-extrabold">Authority Transfer</div>
              <div className="text-sm text-slate-300">Choose an Authority & Surrender mode.</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Prayer', value: 'prayer' as const },
                  { label: 'Declaration', value: 'declaration' as const },
                  { label: 'Silent Intention', value: 'silent_intention' as const },
                  { label: 'Symbolic Release', value: 'symbolic_release' as const },
                  { label: 'Custom', value: 'custom' as const },
                ].map((m) => (
                  <Button
                    key={m.value}
                    variant="secondary"
                    onClick={async () => {
                      const t = nowIso()
                      await db.rpRoots.put({
                        ...currentRoot,
                        restoration: { ...(currentRoot.restoration ?? {}), authorityMode: m.value },
                        updatedAt: t,
                      })
                      await goTo('EMBODIED_INTEGRATION_PICK', `Authority: ${m.value}`)
                    }}
                  >
                    {m.label}
                  </Button>
                ))}
              </div>
              <Button variant="ghost" onClick={() => goTo('READINESS_CHECK', 'Back')}>
                Back
              </Button>
            </div>
          </Card>
        ) : null}

        {currentState === 'EMBODIED_INTEGRATION_PICK' && currentRoot ? (
          <Card>
            <div className="space-y-3">
              <div className="text-sm font-extrabold">Embodied Integration</div>
              <div className="text-sm text-slate-300">How will the body participate in this restoration?</div>

              <div className="grid gap-2">
                {(
                  [
                    'stillness_presence',
                    'breath',
                    'touch_contact',
                    'rhythmic_input',
                    'meridian_trace',
                    'gentle_movement',
                  ] as const
                ).map((c) => {
                  const checked = selectedChannels.includes(c)
                  return (
                    <label key={c} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                      <div className="text-sm text-slate-100">{channelLabel(c)}</div>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-indigo-500"
                        checked={checked}
                        onChange={(e) => {
                          const set = new Set(selectedChannels)
                          if (e.target.checked) set.add(c)
                          else set.delete(c)
                          setChannelsDraft(Array.from(set))
                        }}
                      />
                    </label>
                  )
                })}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={async () => {
                    const t = nowIso()
                    const channels = (channelsDraft.length ? channelsDraft : (currentRoot.restoration?.channelsUsed ?? [])) as RPIntegrationChannel[]
                    await db.rpRoots.put({
                      ...currentRoot,
                      restoration: { ...(currentRoot.restoration ?? {}), channelsUsed: channels },
                      updatedAt: t,
                    })
                    setChannelsDraft([])
                    await goTo('EMBODIED_INTEGRATION_GUIDE', 'Continue')
                  }}
                >
                  Continue
                </Button>
                <Button variant="secondary" onClick={() => goTo('INTEGRATION_COMPLETION_CHECK', 'Skip to completion')}>
                  Skip to completion
                </Button>
              </div>

              <Button variant="ghost" onClick={() => goTo('AUTHORITY_TRANSFER', 'Back')}>
                Back
              </Button>
            </div>
          </Card>
        ) : null}

        {currentState === 'EMBODIED_INTEGRATION_GUIDE' && currentRoot ? (
          <Card>
            <div className="space-y-3">
              <div className="text-sm font-extrabold">Micro-guidance</div>
              <div className="text-sm text-slate-300">Use gentle cues. Let the body lead; no forcing.</div>
              {selectedChannels.length ? (
                <div className="space-y-2">
                  {selectedChannels.map((c) => (
                    <div key={c} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <div className="text-sm font-extrabold">{channelLabel(c)}</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
                        {(guidanceByChannel[c] ?? []).map((g) => (
                          <li key={g}>{g}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-300">No channels selected. Continue to completion check.</div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => goTo('INTEGRATION_COMPLETION_CHECK', 'Done')}>Done</Button>
                <Button variant="secondary" onClick={() => goTo('EMBODIED_INTEGRATION_PICK', 'Add/Change')}>
                  Add/Change
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        {currentState === 'INTEGRATION_COMPLETION_CHECK' && currentRoot ? (
          <Card>
            <div className="space-y-3">
              <div className="text-sm font-extrabold">Integration completion check</div>
              <div className="text-sm text-slate-300">Has the body received this change?</div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={async () => {
                    const t = nowIso()
                    await db.rpRoots.put({
                      ...currentRoot,
                      status: 'restored',
                      restoration: { ...(currentRoot.restoration ?? {}), integrationCheck: 'integrated', restoredAt: t },
                      updatedAt: t,
                    })
                    await completeRootAndContinue({ action: 'Integrated' })
                  }}
                >
                  Integrated
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const t = nowIso()
                    await db.rpRoots.put({
                      ...currentRoot,
                      status: 'restored',
                      restoration: { ...(currentRoot.restoration ?? {}), integrationCheck: 'unsure', restoredAt: t },
                      updatedAt: t,
                    })
                    await completeRootAndContinue({ action: 'Unsure (proceed)' })
                  }}
                >
                  Unsure (proceed)
                </Button>
              </div>
              <Button variant="secondary" onClick={() => goTo('EMBODIED_INTEGRATION_PICK', 'Change integration method')}>
                Change integration method
              </Button>
            </div>
          </Card>
        ) : null}

        {currentState === 'ASSOCIATED_PATHWAY_CHECK' ? (
          <Card>
            <div className="space-y-3">
              <div className="text-sm font-extrabold">Associated pathway check</div>
              <div className="text-sm text-slate-300">Is there an associated pathway that needs to be restored?</div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const rpSession = await ensureRpSession(sessionId)
                    const t = nowIso()
                    await db.rpSessions.put({ ...rpSession, phase: 'identified_paths_for_collection', currentState: 'RESTORE_INIT', updatedAt: t })
                    nav(`/sessions/${encodeURIComponent(sessionId)}/pathways`)
                  }}
                >
                  Yes
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    // Move to collection complete flow.
                    await goTo('COLLECTION_COMPLETE', 'No')
                  }}
                >
                  No
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        {currentState === 'COLLECTION_COMPLETE' ? (
          <Card>
            <div className="space-y-3">
              <div className="text-sm font-extrabold">Collection complete</div>
              <div className="text-sm text-slate-300">Is there another pathway to restore in this session?</div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const rpSession = await ensureRpSession(sessionId)
                    const t = nowIso()
                    // Mark current collection complete.
                    if (rpSession.currentCollectionId) {
                      const c = await db.rpCollections.get(rpSession.currentCollectionId)
                      if (c) await db.rpCollections.put({ ...c, status: 'complete', updatedAt: t })
                    }
                    // Create a new building collection for the next discovery.
                    const newCol: RPCollection = { id: newId(), sessionId, status: 'building', createdAt: t, updatedAt: t }
                    await db.transaction('rw', [db.rpCollections, db.rpSessions], async () => {
                      await db.rpCollections.add(newCol)
                      await db.rpSessions.put({ ...rpSession, currentCollectionId: newCol.id, currentRootId: undefined, phase: 'new_collection', currentState: 'RESTORE_INIT', updatedAt: t })
                    })
                    nav(`/sessions/${encodeURIComponent(sessionId)}/pathways`)
                  }}
                >
                  Yes
                </Button>
                <Button variant="secondary" onClick={() => goTo('SESSION_CLOSE', 'No')}>
                  No
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        {currentState === 'SESSION_CLOSE' ? (
          <Card>
            <div className="space-y-3">
              <div className="text-sm font-extrabold">Session closure</div>
              <div className="text-sm text-slate-300">
                Restored: <span className="font-semibold">{counts.restoredRootsCount}</span> • Deferred:{' '}
                <span className="font-semibold">{counts.deferredRootsCount}</span> • Collections completed:{' '}
                <span className="font-semibold">{counts.collectionsCompletedCount}</span>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="text-sm font-extrabold">Aftercare</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
                  <li>Hydrate</li>
                  <li>Rest / gentle movement</li>
                  <li>Notice changes without forcing meaning</li>
                  <li>Pause heavy processing for 24 hours (optional)</li>
                </ul>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="text-sm font-extrabold">Client-friendly summary</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={copySummary}>
                    Copy
                  </Button>
                  <Button variant="secondary" onClick={downloadSummary}>
                    Download
                  </Button>
                </div>
                <div className="mt-2">
                  <Textarea readOnly rows={12} value={clientSummary} />
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="text-sm font-extrabold">Additional next steps (optional)</div>
                <div className="text-xs text-slate-400">Saved with the session on this device.</div>
                <div className="mt-2 space-y-2">
                  <Textarea
                    rows={4}
                    value={nextStepsDraft ?? rp?.practitionerNotes ?? ''}
                    onChange={(e) => setNextStepsDraft(e.target.value)}
                    placeholder="e.g., practice 3 slow exhales at bedtime; check in next week…"
                  />
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      const t = nowIso()
                      const rpSession = await ensureRpSession(sessionId)
                      const value = (nextStepsDraft ?? '').trim()
                      await db.rpSessions.put({ ...rpSession, practitionerNotes: value ? value : undefined, updatedAt: t })
                      setNextStepsDraft(value)
                      window.alert('Saved.')
                    }}
                  >
                    Save next steps
                  </Button>
                </div>
              </div>

              <Button
                onClick={async () => {
                  const t = nowIso()
                  if (!session.endedAt) await db.sessions.put({ ...session, endedAt: t, updatedAt: t })
                  const rpSession = await ensureRpSession(sessionId)
                  await db.rpSessions.put({ ...rpSession, phase: 'closure', updatedAt: t })
                  nav(`/sessions/${encodeURIComponent(sessionId)}`)
                }}
              >
                End session
              </Button>
            </div>
          </Card>
        ) : null}

        {currentState === 'ANOTHER_COLLECTION_CHECK' ? (
          <Card>
            <div className="space-y-3">
              <div className="text-sm font-extrabold">Another collection?</div>
              <div className="text-sm text-slate-300">No active collection found. Add pathways or close the session.</div>
              <div className="grid grid-cols-2 gap-2">
                <Link to={`/sessions/${encodeURIComponent(sessionId)}/pathways`}>
                  <Button variant="secondary" className="w-full">
                    Go to pathways
                  </Button>
                </Link>
                <Button onClick={stopSession} variant="danger" className="w-full">
                  Close
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        {currentState === 'ROOT_COMPLETE' ? (
          <Card>
            <div className="space-y-2">
              <div className="text-sm font-extrabold">Root complete</div>
              <div className="text-sm text-slate-300">Advancing…</div>
              <Button onClick={() => void completeRootAndContinue()}>Continue</Button>
            </div>
          </Card>
        ) : null}

        {!currentCollection ? (
          <Card>
            <div className="text-sm text-slate-300">No active collection. Add pathways first.</div>
          </Card>
        ) : null}
      </div>
    </AppLayout>
  )
}

