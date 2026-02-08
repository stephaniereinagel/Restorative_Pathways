import type { RPRoot } from '../db'

function safeDateLabel(iso: string) {
  try {
    return new Date(iso).toLocaleDateString()
  } catch {
    return iso
  }
}

function compact(s: string) {
  return s.replace(/\s+/g, ' ').trim()
}

function fmtTheme(r: RPRoot) {
  const leaf = r.path[r.path.length - 1] ?? r.domain
  const domain = r.domain ? ` (${r.domain})` : ''
  return `${leaf}${domain}`
}

function fmtPathway(r: RPRoot) {
  const path = r.path?.length ? r.path.join(' → ') : r.domain
  return path ? `Pathway: ${path}` : ''
}

export function buildRpClientSummary(args: {
  clientName: string
  sessionStartedAt: string
  sessionReason?: string
  sessionOpeningNotes?: string
  roots: RPRoot[]
  additionalNextSteps?: string
}): string {
  const roots = (args.roots ?? []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const restored = roots.filter((r) => r.status === 'restored')
  const deferred = roots.filter((r) => r.status === 'deferred')
  const identified = roots.filter((r) => r.status === 'identified')

  const lines: string[] = []

  // Header
  lines.push('Restorative Pathways — Session Summary')
  lines.push(`Client: ${args.clientName || 'Client'}`)
  lines.push(`Date: ${safeDateLabel(args.sessionStartedAt)}`)
  if ((args.sessionReason ?? '').trim()) lines.push(`Focus: ${compact(args.sessionReason ?? '')}`)
  if ((args.sessionOpeningNotes ?? '').trim()) {
    lines.push('')
    lines.push('Session notes')
    lines.push(compact(args.sessionOpeningNotes ?? ''))
  }

  // Plain-English context (for clients used to western medicine / talk therapy)
  lines.push('')
  lines.push('What we did (plain English)')
  lines.push(
    compact(
      'In this session we used a gentle, body-based process called Restorative Pathways. We listened for themes your system was signaling (stress patterns, protective responses, beliefs, emotions, body sensations, etc.). These themes are not medical diagnoses—they are signposts that guide what we support and restore.',
    ),
  )
  lines.push(
    compact(
      'Words you may see below: “Restored” means the process completed for that theme today. “Deferred” means we paused because the system needed something first (safety, capacity, timing, information, or a prerequisite theme). “Identified” means it was on the list, but we did not complete it today.',
    ),
  )

  // Results
  lines.push('')
  lines.push('What we completed today')
  if (restored.length) {
    for (const r of restored) {
      lines.push(`- ${fmtTheme(r)}`)
      const p = fmtPathway(r)
      if (p) lines.push(`  ${p}`)
      if ((r.notes ?? '').trim()) lines.push(`  Note: ${compact(r.notes ?? '')}`)
    }
  } else {
    lines.push('- (No pathways were completed today.)')
  }

  lines.push('')
  lines.push('What we identified to revisit')
  if (deferred.length || identified.length) {
    for (const r of deferred) {
      lines.push(`- ${fmtTheme(r)} (paused)`)
      const p = fmtPathway(r)
      if (p) lines.push(`  ${p}`)
      const reason = (r.restoration?.deferredReason ?? '').trim()
      if (reason) lines.push(`  What was needed first: ${compact(reason)}`)
      if ((r.notes ?? '').trim()) lines.push(`  Note: ${compact(r.notes ?? '')}`)
    }
    for (const r of identified) {
      lines.push(`- ${fmtTheme(r)} (identified)`)
      const p = fmtPathway(r)
      if (p) lines.push(`  ${p}`)
      if ((r.notes ?? '').trim()) lines.push(`  Note: ${compact(r.notes ?? '')}`)
    }
  } else {
    lines.push('- (Nothing outstanding from this list.)')
  }

  // Aftercare / next steps
  lines.push('')
  lines.push('Next steps (aftercare)')
  lines.push('- Hydrate')
  lines.push('- Rest / gentle movement')
  lines.push('- Notice changes without forcing meaning')
  lines.push('- Pause heavy processing for 24 hours (optional)')

  const extra = (args.additionalNextSteps ?? '').trim()
  if (extra) {
    lines.push('')
    lines.push('Additional notes / next steps')
    lines.push(extra)
  }

  // Gentle framing
  lines.push('')
  lines.push(
    compact(
      'Reminder: this work supports the nervous system and mind–body patterns. It does not replace medical care. If symptoms are intense, persistent, or concerning, consult a licensed medical professional.',
    ),
  )

  return lines.join('\n')
}

