import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Session } from '../db'
import { getAiConfig } from '../rp/ai'
import { Button } from './Button'
import { Textarea } from './Textarea'

function nowIso() {
  return new Date().toISOString()
}

async function appendToSessionNotes(args: { sessionId: string; blockTitle: string; blockBody: string }) {
  const s = await db.sessions.get(args.sessionId)
  if (!s) throw new Error('Session not found')
  const t = nowIso()
  const header = `${args.blockTitle} (${new Date(t).toLocaleString()})`
  const block = [header, args.blockBody.trim()].filter(Boolean).join('\n')
  const nextNotes = (s.notes ? `${s.notes.trim()}\n\n---\n\n${block}\n` : `${block}\n`).trim()
  const next: Session = { ...s, notes: nextNotes, updatedAt: t }
  await db.sessions.put(next)
}

async function askOpenAI(args: { apiKey: string; model: string; system: string; user: string }): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      temperature: 0.4,
      messages: [
        { role: 'system', content: args.system },
        { role: 'user', content: args.user },
      ],
    }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`AI request failed (${res.status}). ${txt}`.trim())
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = data?.choices?.[0]?.message?.content ?? ''
  return content.trim()
}

async function askViaLocalProxy(args: { model: string; system: string; user: string }): Promise<string> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: args.model, system: args.system, user: args.user, temperature: 0.4 }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`AI proxy failed (${res.status}). ${txt}`.trim())
  }
  const data = (await res.json()) as { content?: string }
  return String(data?.content ?? '').trim()
}

export function AiAssistModal(props: {
  isOpen: boolean
  onClose: () => void
  sessionId: string
  title: string
  contextLines: string[]
  defaultQuestion: string
  suggestionChips?: string[]
}) {
  const cfg = useLiveQuery(() => getAiConfig(), [])
  const [question, setQuestion] = useState(props.defaultQuestion)
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [proxyOk, setProxyOk] = useState<boolean | null>(null)

  const system = useMemo(() => {
    return `
You are an AI assistant operating within the Restorative Pathways framework.

Your role is to support practitioner understanding while preserving the framework’s core commitments to discernment, safety, consent, humility, and non-authority.

You must adhere to the following principles at all times:

1. Discernment Over Direction
You do not direct sessions, determine readiness, or recommend what should happen next.
You offer explanations, reflections, and neutral descriptions only.
You never imply that something must, should, or needs to be done.

2. Non-Authoritative Posture
You are not an authority over the practitioner, the client, or the process.
You do not diagnose, interpret meaning, declare root causes, or define truth.
You do not claim spiritual, emotional, medical, or psychological authority.

3. Consent and Capacity First
You assume that all inquiry and restoration occur only with consent and adequate capacity.
You never pressure continuation, depth, or completion.
Stopping, pausing, or doing nothing is always a valid outcome.

4. Invitational Language Only
You use language that is:
- descriptive, not prescriptive
- invitational, not directive
- humble, not certain

You prefer phrases such as:
- “This is often understood as…”
- “Some practitioners notice…”
- “Within this framework, this may refer to…”
- “If it’s helpful, one way to understand this is…”

You avoid phrases such as:
- “You should…”
- “This means that…”
- “The client needs…”
- “The next step is…”

5. No Outcome Promises
You do not promise healing, release, resolution, or change.
You do not frame restoration as success or non-restoration as failure.

6. Respect for Scope
You do not replace medical care, mental health treatment, trauma therapy, or spiritual direction.
If a question exceeds the scope of Restorative Pathways, you clearly and calmly state that limitation.

7. Restoration Is Not Technique
When describing restoration, you emphasize:
- intention
- consent
- embodiment
- relationship

You explicitly avoid presenting any movement, touch, prayer, or action as inherently effective or required.

8. Practitioner as Steward of Space
You reinforce that the practitioner’s role is to hold space, not produce outcomes.
You normalize uncertainty, quiet sessions, and incomplete processes.

9. Faith Integration Is Optional
You do not assume belief systems.
When faith-integrated language is used, it is framed as optional, client-led, and non-presumptive.

10. Safety Overrides Completion
If a concept relates to identity, authority, attachment, trauma, or meaning, you emphasize pacing, gentleness, and choice over insight or resolution.

Your purpose is not to move the session forward, but to clarify understanding while protecting the framework’s posture.

Output style:
- Plain English. Short paragraphs or bullets.
- Be concise unless the user asks for more.
`.trim()
  }, [])

  const apiKey = (cfg?.apiKey ?? '').trim()
  const model = (cfg?.model ?? 'gpt-4o-mini').trim()

  async function runAsk(q: string) {
    setBusy(true)
    setErr(null)
    try {
      const out =
        proxyOk !== false
          ? await askViaLocalProxy({ model, system, user: [`Context:`, props.contextLines.filter(Boolean).join('\n'), '', `Question:`, q.trim()].filter(Boolean).join('\n') })
          : apiKey
            ? await askOpenAI({ apiKey, model, system, user: [`Context:`, props.contextLines.filter(Boolean).join('\n'), '', `Question:`, q.trim()].filter(Boolean).join('\n') })
            : (() => {
                throw new Error('No AI configured (local proxy not running, and no per-device key set).')
              })()
      setAnswer(out)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!props.isOpen) return
    let alive = true
    const ctrl = new AbortController()
    const t = window.setTimeout(() => ctrl.abort(), 800)
    ;(async () => {
      try {
        const res = await fetch('/api/ai/ping', { signal: ctrl.signal })
        if (!alive) return
        setProxyOk(res.ok)
      } catch {
        if (!alive) return
        setProxyOk(false)
      } finally {
        window.clearTimeout(t)
      }
    })()
    return () => {
      alive = false
      ctrl.abort()
      window.clearTimeout(t)
    }
  }, [props.isOpen])

  if (!props.isOpen) return null

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center overflow-y-auto bg-black/30 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-xl rounded-2xl border border-[#e5dccf] bg-[#fbf7ef] p-4 shadow-xl max-h-[85vh] overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-extrabold">{props.title}</div>
            <div className="mt-1 text-xs text-[#6b645c] whitespace-pre-wrap">{props.contextLines.join('\n')}</div>
          </div>
          <Button variant="ghost" className="shrink-0" onClick={props.onClose}>
            Close
          </Button>
        </div>

        {!apiKey && proxyOk === false ? (
          <div className="mt-3 rounded-xl border border-[#e5dccf] bg-[#fffdf9] p-3 text-sm text-[#5b554d]">
            AI is not configured on this device. Either run the local AI proxy on your computer, or add an API key in{' '}
            <Link to="/settings" className="font-semibold underline">
              Settings
            </Link>
            .
          </div>
        ) : null}

        <div className="mt-3 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#6b645c]">Ask</div>
          <Textarea
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question…"
          />

          {(props.suggestionChips ?? []).length ? (
            <div className="flex flex-wrap gap-2">
              {(props.suggestionChips ?? []).map((s) => (
                <button
                  key={s}
                  className="rounded-full border border-[#e5dccf] bg-[#fffdf9] px-3 py-1 text-xs font-semibold text-[#2b2a28]"
                  onClick={() => setQuestion(s)}
                  type="button"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                setQuestion(props.defaultQuestion)
                await runAsk(props.defaultQuestion)
              }}
            >
              {busy ? 'Explaining…' : 'Explain'}
            </Button>
            <Button
              disabled={busy || !question.trim()}
              onClick={async () => runAsk(question)}
            >
              {busy ? 'Asking…' : 'Ask AI'}
            </Button>
          </div>

          {err ? <div className="text-xs text-[#b84a4a]">{err}</div> : null}

          <div className="rounded-xl border border-[#e5dccf] bg-[#fffdf9] p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#6b645c]">Answer</div>
            <div className="mt-2">
              <Textarea readOnly rows={8} value={answer} placeholder="The answer will appear here…" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                disabled={!answer.trim()}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(answer.trim())
                    window.alert('Copied to clipboard.')
                  } catch {
                    window.alert('Copy failed. You can select and copy the text manually.')
                  }
                }}
              >
                Copy
              </Button>
              <Button
                variant="secondary"
                disabled={!answer.trim()}
                onClick={async () => {
                  try {
                    await appendToSessionNotes({
                      sessionId: props.sessionId,
                      blockTitle: 'AI explanation',
                      blockBody: `${props.title}\n\n${answer.trim()}`,
                    })
                    window.alert('Added to session notes.')
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e)
                    window.alert(`Could not add to session notes.\n\n${msg}`)
                  }
                }}
              >
                Add to session notes
              </Button>
              <Button variant="ghost" onClick={() => void props.onClose()}>
                Done
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-[#6b645c]">
          Tip: avoid entering identifying details. This feature is informational and not medical advice.
        </div>
      </div>
    </div>
  )
}

