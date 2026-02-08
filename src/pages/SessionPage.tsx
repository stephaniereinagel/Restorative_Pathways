import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Session } from '../db'
import { AppLayout } from '../ui/AppLayout'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

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

export function SessionPage() {
  const { sessionId = '' } = useParams()
  const [params] = useSearchParams()
  const backToPerson = params.get('backToPerson') === '1'

  const session = useLiveQuery(async () => {
    const item = await db.sessions.get(sessionId)
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/98e8c8e5-f277-461f-9255-2998b84f40af', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'D',
        location: 'SessionPage.tsx:28',
        message: 'session query result',
        data: { sessionId, found: !!item, notesChars: item?.notes ? item.notes.length : 0 },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    return item
  }, [sessionId])
  const person = useLiveQuery(async () => {
    if (!session) return undefined
    return db.people.get(session.personId)
  }, [session?.personId])

  async function endSession() {
    if (!session) return
    const t = nowIso()
    const next: Session = { ...session, endedAt: session.endedAt ?? t, updatedAt: t }
    await db.sessions.put(next)
  }

  if (!session) {
    return (
      <AppLayout title="Session">
        <Card>
          <div className="text-sm text-slate-300">Session not found.</div>
        </Card>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Session">
      <div className="space-y-4">
        <Card>
          <div className="space-y-2">
            <div className="text-base font-extrabold">{person?.name ?? 'Person'}</div>
            <div className="text-xs text-slate-400">{fmt(session.startedAt)}</div>
            {session.reason ? <div className="text-sm text-slate-200">{session.reason}</div> : null}
            {session.notes ? <div className="text-sm text-slate-300 whitespace-pre-wrap">{session.notes}</div> : null}
            {session.endedAt ? <div className="text-xs text-emerald-300">Ended: {fmt(session.endedAt)}</div> : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link to={`/sessions/${encodeURIComponent(session.id)}/pathways`}>
              <Button className="w-full" variant="secondary">
                Pathways
              </Button>
            </Link>
            <Link to={`/sessions/${encodeURIComponent(session.id)}/pathways/run`}>
              <Button className="w-full" variant="secondary">
                Runner
              </Button>
            </Link>
          </div>

          <div className="mt-2">
            <Link to={`/sessions/${encodeURIComponent(session.id)}/pathways/summary`}>
              <Button className="w-full" variant="secondary">
                Client summary
              </Button>
            </Link>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button className="w-full" variant="ghost" onClick={endSession} disabled={!!session.endedAt}>
              End session
            </Button>
            {person ? (
              <Link to={backToPerson ? `/people/${person.id}` : `/people/${person.id}`}>
                <Button className="w-full" variant="ghost">
                  Back to {person.name.split(' ')[0]}
                </Button>
              </Link>
            ) : (
              <Link to="/">
                <Button className="w-full" variant="ghost">
                  Back
                </Button>
              </Link>
            )}
          </div>
        </Card>

      </div>
    </AppLayout>
  )
}

