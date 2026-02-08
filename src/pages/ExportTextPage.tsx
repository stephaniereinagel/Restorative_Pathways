import { useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppLayout } from '../ui/AppLayout'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Textarea } from '../ui/Textarea'

type ExportPayload = { filename: string; text: string }

function readPayload(key: string): ExportPayload | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ExportPayload>
    if (!parsed || typeof parsed.text !== 'string') return null
    return { filename: String(parsed.filename || 'notes.txt'), text: parsed.text }
  } catch {
    return null
  }
}

export function ExportTextPage() {
  const [params] = useSearchParams()
  const key = params.get('key') ?? ''
  const taRef = useRef<HTMLTextAreaElement | null>(null)

  const payload = useMemo(() => (key ? readPayload(key) : null), [key])

  const filename = useMemo(() => payload?.filename ?? 'notes.txt', [payload?.filename])
  const text = useMemo(() => payload?.text ?? '', [payload?.text])

  return (
    <AppLayout title="Export">
      <div className="space-y-4">
        <Card>
          <div className="space-y-2">
            <div className="text-sm font-extrabold">{filename}</div>
            <div className="text-sm text-[#5b554d]">
              On iPhone over Wi‑Fi (`http://192.168…`), “downloads” can be unreliable. Use this export view instead:
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-[#5b554d]">
              <li>Tap <span className="font-semibold">Select all</span>, then copy, or</li>
              <li>Use Safari’s <span className="font-semibold">Share</span> button → <span className="font-semibold">Save to Files</span> (if available)</li>
            </ul>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  const el = taRef.current
                  if (!el) return
                  el.focus()
                  el.select()
                }}
                disabled={!text}
              >
                Select all
              </Button>
              <Link to="/" className="block">
                <Button className="w-full" variant="ghost">
                  Done
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#6b645c]">Text</div>
            <Textarea ref={taRef} readOnly rows={18} value={text || '(No data found — please go back and try Export again.)'} />
          </div>
        </Card>
      </div>
    </AppLayout>
  )
}

