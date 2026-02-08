import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, type Session } from '../db'
import { AppLayout } from '../ui/AppLayout'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Field } from '../ui/Field'
import { Input } from '../ui/Input'
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

export function PersonPage() {
  const { personId = '' } = useParams()
  const nav = useNavigate()

  const person = useLiveQuery(async () => {
    const item = await db.people.get(personId)
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/98e8c8e5-f277-461f-9255-2998b84f40af', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'B',
        location: 'PersonPage.tsx:32',
        message: 'person query result',
        data: { personId, found: !!item },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    return item
  }, [personId])
  const sessions = useLiveQuery(async () => {
    const totalCount = await db.sessions.count()
    const items = await db.sessions.where('personId').equals(personId).toArray()
    const notesChars = items.reduce((sum, s) => sum + (s.notes ? s.notes.length : 0), 0)
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/98e8c8e5-f277-461f-9255-2998b84f40af', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'C',
        location: 'PersonPage.tsx:46',
        message: 'sessions query result',
        data: { personId, filteredCount: items.length, totalCount, notesChars },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    return items.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
  }, [personId])

  const sessionIdsKey = useMemo(() => (sessions ?? []).map((s) => s.id).join('|'), [sessions])
  const sessionStats = useLiveQuery(async () => {
    const ids = (sessions ?? []).map((s) => s.id)
    if (!ids.length) return { rpRootsCountBySessionId: new Map<string, number>() }

    const rpRootsCountBySessionId = new Map<string, number>()
    const roots = await db.rpRoots.where('sessionId').anyOf(ids).toArray()
    for (const r of roots) rpRootsCountBySessionId.set(r.sessionId, (rpRootsCountBySessionId.get(r.sessionId) ?? 0) + 1)

    return { rpRootsCountBySessionId }
  }, [sessionIdsKey])

  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')

  const canStart = useMemo(() => !!person, [person])

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      window.alert('Copied to clipboard.')
    } catch {
      window.alert('Copy failed. You can select and copy the text manually.')
    }
  }

  async function startSession() {
    if (!person) return
    const t = nowIso()
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/98e8c8e5-f277-461f-9255-2998b84f40af', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'E',
        location: 'PersonPage.tsx:71',
        message: 'start session save',
        data: {
          personId: person.id,
          reasonLen: reason.trim().length,
          notesLen: notes.length,
          notesTrimLen: notes.trim().length,
          t,
          origin: window.location.origin,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    const s: Session = {
      id: newId(),
      personId: person.id,
      startedAt: t,
      reason: reason.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: t,
      updatedAt: t,
    }
    await db.sessions.add(s)
    setReason('')
    setNotes('')
    nav(`/sessions/${s.id}`)
  }

  if (!person) {
    return (
      <AppLayout title="Person">
        <Card>
          <div className="text-sm text-slate-300">Person not found.</div>
        </Card>
      </AppLayout>
    )
  }

  return (
    <AppLayout title={person.name}>
      <div className="space-y-4">
        <Card>
          <div className="space-y-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Relationship</div>
              <div className="text-sm text-slate-200">{person.relationship ?? '—'}</div>
            </div>

            <div className="h-px bg-slate-800" />

            <div className="text-sm font-bold">Start a new session</div>
            <div className="grid gap-3">
              <Field label="Reason / focus (optional)">
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g., anxiety at bedtime" />
              </Field>
              <Field label="Notes (optional)">
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything you want recorded at the start"
                />
              </Field>
              <Button onClick={startSession} disabled={!canStart}>
                Start session
              </Button>
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Past sessions</div>
          <Link to="/" className="text-sm font-semibold text-indigo-300 hover:text-indigo-200">
            Back to people
          </Link>
        </div>

        <div className="space-y-3">
          {sessions?.length ? (
            sessions.map((s) => {
              const rpRootsCount = sessionStats?.rpRootsCountBySessionId.get(s.id) ?? 0
              const notesPreview = (s.notes ?? '').trim()
              const hasNotes = !!notesPreview
              const preview = hasNotes ? (notesPreview.length > 140 ? `${notesPreview.slice(0, 140)}…` : notesPreview) : ''

              return (
                <Card key={s.id}>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold">{s.reason ?? 'Session'}</div>
                        <div className="text-xs text-slate-400">{fmt(s.startedAt)}</div>
                      </div>
                      {s.endedAt ? (
                        <div className="text-xs font-semibold text-emerald-300">Ended</div>
                      ) : (
                        <div className="text-xs font-semibold text-amber-300">Open</div>
                      )}
                    </div>

                    <div className="text-xs text-slate-400">
                      Pathways: <span className="font-semibold text-slate-200">{rpRootsCount}</span>
                    </div>

                    {preview ? <div className="text-xs text-slate-300 whitespace-pre-wrap">Notes: {preview}</div> : null}

                    <div className="grid grid-cols-2 gap-2">
                      <Link to={`/sessions/${encodeURIComponent(s.id)}?backToPerson=1`}>
                        <Button className="w-full" variant="secondary">
                          Open
                        </Button>
                      </Link>
                      <Button
                        className="w-full"
                        variant="secondary"
                        onClick={() => {
                          const header = [`Client: ${person.name}`, `Date: ${fmt(s.startedAt)}`, s.reason ? `Focus: ${s.reason}` : null]
                            .filter(Boolean)
                            .join('\n')
                          const body = s.notes ? `\n\nSession notes:\n${s.notes}` : ''
                          void copyText(`${header}${body}`.trim())
                        }}
                      >
                        Copy notes
                      </Button>
                    </div>

                    {rpRootsCount ? (
                      <div className="grid grid-cols-2 gap-2">
                        <Link to={`/sessions/${encodeURIComponent(s.id)}/pathways/summary`}>
                          <Button className="w-full" variant="ghost">
                            RP summary
                          </Button>
                        </Link>
                        <Link to={`/sessions/${encodeURIComponent(s.id)}/pathways`}>
                          <Button className="w-full" variant="ghost">
                            Pathways
                          </Button>
                        </Link>
                      </div>
                    ) : null}
                  </div>
                </Card>
              )
            })
          ) : (
            <Card>
              <div className="text-sm text-slate-300">No sessions yet.</div>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

