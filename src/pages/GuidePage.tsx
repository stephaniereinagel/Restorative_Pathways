import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AppLayout } from '../ui/AppLayout'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'

type GuideSection = {
  id: string
  title: string
  level: number
  body: string
}

function parseGuide(text: string): GuideSection[] {
  const lines = (text ?? '').split(/\r?\n/)
  const sections: GuideSection[] = []
  let cur: GuideSection | null = null

  const push = () => {
    if (!cur) return
    const body = cur.body.trim()
    if (!cur.title.trim() && !body) return
    sections.push({ ...cur, body })
  }

  for (const line of lines) {
    const m = /^(#{2,4})\s+(.*)$/.exec(line.trim())
    if (m) {
      push()
      const hashes = m[1]
      const title = m[2].trim()
      const level = hashes.length
      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
      cur = { id: id || `section-${sections.length + 1}`, title, level, body: '' }
      continue
    }
    if (!cur) {
      // Ignore preamble until first heading.
      continue
    }
    cur.body += `${line}\n`
  }
  push()
  return sections
}

async function loadGuideText(): Promise<string | null> {
  try {
    const res = await fetch('/rp/framework_guide.txt', { cache: 'no-store' })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export function GuidePage() {
  const guideText = useLiveQuery(() => loadGuideText(), [])
  const [q, setQ] = useState('')

  const sections = useMemo(() => parseGuide(guideText ?? ''), [guideText])
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return sections
    return sections.filter((sec) => {
      const hay = `${sec.title}\n${sec.body}`.toLowerCase()
      return hay.includes(s)
    })
  }, [q, sections])

  return (
    <AppLayout title="Framework guide">
      <div className="space-y-4">
        <Card className="p-3">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#6b645c]">Search</div>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the guide…" className="py-1" />
            <div className="text-[11px] text-[#6b645c]">
              {guideText ? `${filtered.length} sections` : 'Guide not loaded yet (missing /rp/framework_guide.txt).'}
            </div>
          </div>
        </Card>

        {guideText ? (
          <div className="space-y-2">
            {filtered.map((sec) => (
              <details key={`${sec.id}-${sec.title}`} className="rounded-2xl border border-[#e5dccf] bg-[#fffdf9] p-3">
                <summary className="cursor-pointer select-none text-sm font-extrabold">
                  <span className="text-[#7c756d]">{sec.level === 2 ? '§ ' : sec.level === 3 ? '• ' : '· '}</span>
                  {sec.title}
                </summary>
                <div className="mt-2 whitespace-pre-wrap text-sm text-[#5b554d]">{sec.body}</div>
              </details>
            ))}
          </div>
        ) : (
          <Card>
            <div className="space-y-2">
              <div className="text-sm font-extrabold">Guide file not found</div>
              <div className="text-sm text-[#5b554d]">
                To enable the in-app guide (and improve AI alignment), copy your framework guide into:
              </div>
              <div className="rounded-xl border border-[#e5dccf] bg-[#fbf7ef] p-3 font-mono text-xs text-[#2b2a28]">
                bodycode-journal-pwa/public/rp/framework_guide.txt
              </div>
              <div className="text-xs text-[#6b645c]">
                Then reload the app on your phone and computer.
              </div>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}

