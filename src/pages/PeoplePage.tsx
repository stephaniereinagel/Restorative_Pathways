import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Dexie from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, type Person } from '../db'
import { AppLayout } from '../ui/AppLayout'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Field } from '../ui/Field'
import { Input } from '../ui/Input'

function nowIso() {
  return new Date().toISOString()
}

export function PeoplePage() {
  const people = useLiveQuery(async () => {
    const items = await db.people.orderBy('name').toArray()
    const displayMode = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'
    const isStandalone = (navigator as Navigator & { standalone?: boolean }).standalone ?? false
    const dbNames = typeof Dexie.getDatabaseNames === 'function' ? await Dexie.getDatabaseNames().catch(() => undefined) : undefined
    const idbNames = typeof indexedDB.databases === 'function' ? await indexedDB.databases().catch(() => undefined) : undefined
    const storageEstimate = navigator.storage?.estimate ? await navigator.storage.estimate().catch(() => undefined) : undefined
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/98e8c8e5-f277-461f-9255-2998b84f40af', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'A',
        location: 'PeoplePage.tsx:20',
        message: 'people query result',
        data: {
          count: items.length,
          dbName: db.name,
          dbVersion: db.verno,
          origin: window.location.origin,
          displayMode,
          isStandalone,
          dbNames,
          idbNames,
          storageEstimate,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    return items
  }, [], [])
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('')

  const canAdd = useMemo(() => name.trim().length > 0, [name])

  async function addPerson() {
    try {
      const t = nowIso()
      const person: Person = {
        id: newId(),
        name: name.trim(),
        relationship: relationship.trim() || undefined,
        createdAt: t,
        updatedAt: t,
      }
      await db.people.add(person)
      setName('')
      setRelationship('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      window.alert(`Could not add person on this device.\n\n${msg}`)
    }
  }

  return (
    <AppLayout title="People">
      <div className="space-y-4">
        <div className="flex justify-center">
          <img src="/brand/rp-logo.jpg" alt="Restorative Pathways" className="w-64 max-w-full rounded-2xl border border-[#e5dccf] bg-[#fffdf9] p-3" />
        </div>
        <Card>
          <div className="space-y-3">
            <div className="text-sm font-bold">Add person</div>
            <div className="grid gap-3">
              <Field label="Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Steph" />
              </Field>
              <Field label="Relationship (optional)">
                <Input
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  placeholder="e.g., self, spouse, child"
                />
              </Field>
              <Button onClick={addPerson} disabled={!canAdd}>
                Add
              </Button>
            </div>
          </div>
        </Card>

        <div className="text-xs font-semibold uppercase tracking-wide text-[#6b645c]">Your people</div>
        <div className="space-y-3">
          {people?.length ? (
            people.map((p) => (
              <Link key={p.id} to={`/people/${p.id}`} className="block">
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-extrabold">{p.name}</div>
                      <div className="truncate text-sm text-[#6b645c]">{p.relationship ?? '—'}</div>
                    </div>
                    <div className="text-sm text-[#6b645c]">Open</div>
                  </div>
                </Card>
              </Link>
            ))
          ) : (
            <Card>
              <div className="text-sm text-[#5b554d]">Add your first person above.</div>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

