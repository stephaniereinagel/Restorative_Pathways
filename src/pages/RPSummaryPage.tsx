import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type RPRoot } from '../db'
import { buildRpClientSummary } from '../rp/summary'
import { AppLayout } from '../ui/AppLayout'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { shareOrDownloadTextFile } from '../ui/download'
import { Textarea } from '../ui/Textarea'

function safeDay(iso: string) {
  try {
    return new Date(iso).toISOString().slice(0, 10)
  } catch {
    return 'session'
  }
}

export function RPSummaryPage() {
  const { sessionId = '' } = useParams()

  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId])
  const person = useLiveQuery(async () => {
    if (!session) return undefined
    return db.people.get(session.personId)
  }, [session?.personId])
  const rp = useLiveQuery(() => db.rpSessions.get(sessionId), [sessionId])
  const roots = useLiveQuery(async () => db.rpRoots.where('sessionId').equals(sessionId).toArray(), [sessionId])

  const summary = useMemo(() => {
    if (!session) return ''
    return buildRpClientSummary({
      clientName: person?.name ?? 'Client',
      sessionStartedAt: session.startedAt,
      sessionReason: session.reason,
      sessionOpeningNotes: session.notes,
      roots: (roots ?? []) as RPRoot[],
      additionalNextSteps: (rp?.practitionerNotes ?? '').trim() || undefined,
    })
  }, [person?.name, rp?.practitionerNotes, roots, session])

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary)
      window.alert('Copied to clipboard.')
    } catch {
      window.alert('Copy failed. You can select and copy the text manually.')
    }
  }

  async function download() {
    if (!session) return
    await shareOrDownloadTextFile({
      filename: `restorative-pathways-session-summary-${safeDay(session.startedAt)}.txt`,
      text: summary,
    })
  }

  if (!session) {
    return (
      <AppLayout title="RP summary">
        <Card>
          <div className="text-sm text-slate-300">Session not found.</div>
        </Card>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="RP summary">
      <div className="space-y-4">
        <Card>
          <div className="space-y-2">
            <div className="text-sm font-extrabold">{person?.name ?? 'Client'}</div>
            <div className="text-xs text-slate-400">{new Date(session.startedAt).toLocaleString()}</div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={copy}>
                Copy
              </Button>
              <Button variant="secondary" onClick={download}>
                Download
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Client-friendly summary</div>
            <Textarea readOnly rows={18} value={summary} />
          </div>
        </Card>

        <div className="grid gap-2 sm:grid-cols-2">
          <Link to={`/sessions/${encodeURIComponent(sessionId)}`}>
            <Button className="w-full" variant="ghost">
              Back to session
            </Button>
          </Link>
          <Link to={`/people/${encodeURIComponent(session.personId)}`}>
            <Button className="w-full" variant="ghost">
              Back to client
            </Button>
          </Link>
        </div>
      </div>
    </AppLayout>
  )
}

