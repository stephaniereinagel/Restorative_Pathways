import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  initDb,
  type KV,
  type Person,
  type RPCollection,
  type RPEvent,
  type RPRoot,
  type RPSessionState,
  type Session,
} from '../db'
import { getCatalogVersion, importMapCsv, importNodeIndexJson } from '../rp/catalog'
import { getAiConfig, setAiConfig } from '../rp/ai'
import { AppLayout } from '../ui/AppLayout'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Field } from '../ui/Field'
import { Input } from '../ui/Input'

type ExportPayload = {
  version: number
  exportedAt: string
  data: {
    people: Person[]
    sessions: Session[]
    kv?: KV[]
    rpSessions?: RPSessionState[]
    rpCollections?: RPCollection[]
    rpRoots?: RPRoot[]
    rpEvents?: RPEvent[]
  }
}

function downloadJson(filename: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function SettingsPage() {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const rpNodeIndexRef = useRef<HTMLInputElement | null>(null)
  const rpMapCsvRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [rpStatus, setRpStatus] = useState<string | null>(null)
  const aiCfg = useLiveQuery(() => getAiConfig(), [])

  const [aiKeyDraft, setAiKeyDraft] = useState('')
  const [aiModelDraft, setAiModelDraft] = useState('')

  const aiConfigured = useMemo(() => !!(aiCfg?.apiKey ?? '').trim(), [aiCfg?.apiKey])

  async function exportAll() {
    setBusy('Exporting…')
    try {
      const [people, sessions, kv, rpSessions, rpCollections, rpRoots, rpEvents] = await Promise.all([
        db.people.toArray(),
        db.sessions.toArray(),
        db.kv.toArray(),
        db.rpSessions.toArray(),
        db.rpCollections.toArray(),
        db.rpRoots.toArray(),
        db.rpEvents.toArray(),
      ])

      const payload: ExportPayload = {
        version: 3,
        exportedAt: new Date().toISOString(),
        data: { people, sessions, kv, rpSessions, rpCollections, rpRoots, rpEvents },
      }

      const day = new Date().toISOString().slice(0, 10)
      downloadJson(`restorative-pathways-backup-${day}.json`, payload)
    } finally {
      setBusy(null)
    }
  }

  async function importFile(file: File) {
    setBusy('Importing…')
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as ExportPayload
      const data = parsed?.data
      if (!data) throw new Error('Invalid file: missing data')

      if (!Array.isArray(data.people) || !Array.isArray(data.sessions)) throw new Error('Invalid file: data arrays are missing')

      const kv = Array.isArray(data.kv) ? data.kv : []
      const rpSessions = Array.isArray(data.rpSessions) ? data.rpSessions : []
      const rpCollections = Array.isArray(data.rpCollections) ? data.rpCollections : []
      const rpRoots = Array.isArray(data.rpRoots) ? data.rpRoots : []
      const rpEvents = Array.isArray(data.rpEvents) ? data.rpEvents : []

      await db.transaction(
        'rw',
        [db.people, db.sessions, db.kv, db.rpSessions, db.rpCollections, db.rpRoots, db.rpEvents],
        async () => {
          await db.people.bulkPut(data.people)
          await db.sessions.bulkPut(data.sessions)
          if (kv.length) await db.kv.bulkPut(kv)
          if (rpSessions.length) await db.rpSessions.bulkPut(rpSessions)
          if (rpCollections.length) await db.rpCollections.bulkPut(rpCollections)
          if (rpRoots.length) await db.rpRoots.bulkPut(rpRoots)
          if (rpEvents.length) await db.rpEvents.bulkPut(rpEvents)
        },
      )
    } finally {
      setBusy(null)
    }
  }

  async function refreshRpStatus() {
    const v = await getCatalogVersion()
    setRpStatus(v ? `Catalog loaded (version: ${v})` : 'Catalog not loaded yet')
  }

  async function importRpNodeIndex(file: File) {
    setBusy('Importing Restorative Pathways node index…')
    try {
      const res = await importNodeIndexJson(file)
      setRpStatus(`Catalog loaded (version: ${res.version}, nodes: ${res.nodeCount.toLocaleString()})`)
    } finally {
      setBusy(null)
    }
  }

  async function importRpMap(file: File) {
    setBusy('Importing Restorative Pathways map CSV…')
    try {
      const res = await importMapCsv(file)
      setRpStatus((prev) => (prev ? `${prev} • map loaded (${res.byteLength.toLocaleString()} chars)` : 'Map loaded'))
    } finally {
      setBusy(null)
    }
  }

  async function resetAll() {
    const ok = window.confirm(
      'Erase ALL data on this device (people, sessions, restorative pathways logs, catalog)? This cannot be undone.',
    )
    if (!ok) return
    setBusy('Erasing…')
    try {
      await db.delete()
      await db.open()
      await initDb()
    } finally {
      setBusy(null)
    }
  }

  return (
    <AppLayout title="Settings">
      <div className="space-y-4">
        <Card>
          <div className="space-y-2">
            <div className="text-sm font-extrabold">AI assistant (optional)</div>
            <div className="text-sm text-[#5b554d]">
              Configure an API key on this device to use in-app explanations and protocol ideas. Stored locally in this browser only.
            </div>

            <div className="grid gap-3">
              <Field label="OpenAI API key">
                <Input
                  type="password"
                  value={aiKeyDraft}
                  onChange={(e) => setAiKeyDraft(e.target.value)}
                  placeholder={aiConfigured ? '•••••••• (configured)' : 'sk-...'}
                />
              </Field>
              <Field label="Model (optional)">
                <Input value={aiModelDraft} onChange={(e) => setAiModelDraft(e.target.value)} placeholder="gpt-4o-mini" />
              </Field>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="secondary"
                  disabled={!!busy}
                  onClick={async () => {
                    setBusy('Saving AI settings…')
                    try {
                      const key = aiKeyDraft.trim()
                      const model = aiModelDraft.trim()
                      await setAiConfig({ apiKey: key || null, model: model || null })
                      setAiKeyDraft('')
                      setAiModelDraft('')
                      window.alert('Saved.')
                    } finally {
                      setBusy(null)
                    }
                  }}
                >
                  Save
                </Button>
                <Button
                  variant="ghost"
                  disabled={!!busy}
                  onClick={async () => {
                    const ok = window.confirm('Clear the AI API key from this device?')
                    if (!ok) return
                    setBusy('Clearing AI settings…')
                    try {
                      await setAiConfig({ apiKey: null, model: null })
                      setAiKeyDraft('')
                      setAiModelDraft('')
                    } finally {
                      setBusy(null)
                    }
                  }}
                >
                  Clear
                </Button>
              </div>

              <div className="text-xs text-[#6b645c]">
                Status: <span className="font-semibold">{aiConfigured ? 'Configured' : 'Not configured'}</span>
                {aiCfg?.model ? ` • Model: ${aiCfg.model}` : ''}
              </div>
            </div>

            {busy ? <div className="text-xs text-[#6b645c]">{busy}</div> : null}
          </div>
        </Card>

        <Card>
          <div className="space-y-2">
            <div className="text-sm font-extrabold">Backups</div>
            <div className="text-sm text-[#5b554d]">
              Your journal is stored locally on the device/browser. Use export/import to back up or move it.
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={exportAll} variant="secondary" disabled={!!busy}>
                Export JSON
              </Button>
              <Button
                onClick={() => fileRef.current?.click()}
                variant="secondary"
                disabled={!!busy}
                className="w-full"
              >
                Import JSON
              </Button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void importFile(f)
              }}
            />

            {busy ? <div className="text-xs text-[#6b645c]">{busy}</div> : null}
          </div>
        </Card>

        <Card>
          <div className="space-y-2">
            <div className="text-sm font-extrabold">Restorative Pathways catalog</div>
            <div className="text-sm text-[#5b554d]">
              Load the Restorative Pathways decision tree data (stored locally on this device). This enables browsing and selecting
              pathways in sessions.
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={() => rpNodeIndexRef.current?.click()} variant="secondary" disabled={!!busy}>
                Import node index (JSON)
              </Button>
              <Button onClick={() => rpMapCsvRef.current?.click()} variant="secondary" disabled={!!busy}>
                Import map (CSV) (optional)
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={refreshRpStatus} variant="ghost" disabled={!!busy}>
                Refresh status
              </Button>
            </div>

            <input
              ref={rpNodeIndexRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void importRpNodeIndex(f)
              }}
            />
            <input
              ref={rpMapCsvRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void importRpMap(f)
              }}
            />

            {rpStatus ? <div className="text-xs text-[#6b645c]">{rpStatus}</div> : null}
            {busy ? <div className="text-xs text-[#6b645c]">{busy}</div> : null}
          </div>
        </Card>

        <Card>
          <div className="space-y-2">
            <div className="text-sm font-extrabold">Data reset</div>
            <div className="text-sm text-[#5b554d]">If you need a clean slate, you can erase local data.</div>
            <Button onClick={resetAll} variant="danger" disabled={!!busy}>
              Erase all data on this device
            </Button>
          </div>
        </Card>
      </div>
    </AppLayout>
  )
}

