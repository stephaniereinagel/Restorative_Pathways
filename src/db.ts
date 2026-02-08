import Dexie, { type Table } from 'dexie'

export type Person = {
  id: string
  name: string
  relationship?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export type Session = {
  id: string
  personId: string
  startedAt: string
  endedAt?: string
  reason?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export type FindingKind = 'emotion' | 'body' | 'belief' | 'other'

export type Finding = {
  id: string
  sessionId: string
  chartNodeId?: string
  kind: FindingKind
  title: string
  ageOrTimeframe?: string
  lifeEvent?: string
  peopleInvolved?: string
  bodyLocation?: string
  intensity?: string
  tags?: string[]
  notes?: string
  associatedFindingIds?: string[]
  createdAt: string
  updatedAt: string
}

export type Release = {
  id: string
  findingId: string
  method?: string
  passes?: number
  confirmedReleased: boolean
  notes?: string
  createdAt: string
  updatedAt: string
}

export type Chart = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export type ChartNodeType = 'category' | 'item'

export type ChartNode = {
  id: string
  chartId: string
  parentId?: string
  type: ChartNodeType
  title: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type KV = {
  key: string
  value: string
  updatedAt: string
}

// Restorative Pathways (RP) data model (offline-first; stored locally)
export type RPState =
  | 'RESTORE_INIT'
  | 'ACKNOWLEDGMENT'
  | 'READINESS_CHECK'
  | 'NOT_CONDITIONAL'
  | 'AUTHORITY_TRANSFER'
  | 'EMBODIED_INTEGRATION_PICK'
  | 'EMBODIED_INTEGRATION_GUIDE'
  | 'INTEGRATION_COMPLETION_CHECK'
  | 'ROOT_COMPLETE'
  | 'ASSOCIATED_PATHWAY_CHECK'
  | 'COLLECTION_COMPLETE'
  | 'ANOTHER_COLLECTION_CHECK'
  | 'SESSION_CLOSE'

export type RPSessionPhase = 'discovery' | 'restoration' | 'closure' | 'identified_paths_for_collection' | 'new_collection'

export type RPSessionState = {
  sessionId: string
  phase: RPSessionPhase
  currentState: RPState
  currentCollectionId?: string
  currentRootId?: string
  stopRequested: boolean
  practitionerNotes?: string
  createdAt: string
  updatedAt: string
}

export type RPCollectionStatus = 'building' | 'complete'

export type RPCollection = {
  id: string
  sessionId: string
  status: RPCollectionStatus
  createdAt: string
  updatedAt: string
}

export type RPRootStatus = 'identified' | 'restored' | 'deferred'

export type RPReadinessResult = 'ready' | 'not_ready' | 'conditional'

export type RPAuthorityMode = 'prayer' | 'declaration' | 'silent_intention' | 'symbolic_release' | 'custom'

export type RPIntegrationChannel =
  | 'stillness_presence'
  | 'breath'
  | 'touch_contact'
  | 'rhythmic_input'
  | 'meridian_trace'
  | 'gentle_movement'

export type RPRoot = {
  id: string
  sessionId: string
  collectionId: string
  pathwayNodeId: string
  domain: string
  path: string[]
  source?: { type: string; detail?: string }
  notes?: string
  status: RPRootStatus
  restoration?: {
    acknowledgedAt?: string
    readinessResult?: RPReadinessResult
    authorityMode?: RPAuthorityMode
    authorityScript?: string
    channelsUsed?: RPIntegrationChannel[]
    integrationCheck?: 'integrated' | 'unsure'
    restoredAt?: string
    deferredAt?: string
    deferredReason?: string
  }
  createdAt: string
  updatedAt: string
}

export type RPEvent = {
  id: string
  sessionId: string
  collectionId?: string
  rootId?: string
  state: RPState
  action?: string
  payload?: unknown
  createdAt: string
}

export class AppDB extends Dexie {
  people!: Table<Person, string>
  sessions!: Table<Session, string>
  findings!: Table<Finding, string>
  releases!: Table<Release, string>
  charts!: Table<Chart, string>
  chartNodes!: Table<ChartNode, string>
  kv!: Table<KV, string>

  rpSessions!: Table<RPSessionState, string>
  rpCollections!: Table<RPCollection, string>
  rpRoots!: Table<RPRoot, string>
  rpEvents!: Table<RPEvent, string>

  constructor() {
    super('session-journal')
    this.version(1).stores({
      people: 'id, name, createdAt, updatedAt',
      sessions: 'id, personId, startedAt, createdAt, updatedAt',
      findings: 'id, sessionId, title, kind, createdAt, updatedAt',
      releases: 'id, findingId, createdAt, updatedAt',
      charts: 'id, name, createdAt, updatedAt',
      chartNodes: 'id, chartId, parentId, type, sortOrder, title, createdAt, updatedAt',
    })

    this.version(2).stores({
      people: 'id, name, createdAt, updatedAt',
      sessions: 'id, personId, startedAt, createdAt, updatedAt',
      findings: 'id, sessionId, title, kind, createdAt, updatedAt',
      releases: 'id, findingId, createdAt, updatedAt',
      charts: 'id, name, createdAt, updatedAt',
      chartNodes: 'id, chartId, parentId, type, sortOrder, title, createdAt, updatedAt',

      kv: 'key, updatedAt',

      rpSessions: 'sessionId, phase, currentState, updatedAt',
      rpCollections: 'id, sessionId, status, createdAt, updatedAt',
      rpRoots: 'id, sessionId, collectionId, status, createdAt, updatedAt',
      rpEvents: 'id, sessionId, state, createdAt',
    })
  }
}

export const db = new AppDB()

function nowIso() {
  return new Date().toISOString()
}

export function newId() {
  // `crypto.randomUUID()` requires a secure context in many browsers.
  // On mobile, dev servers are often accessed via LAN IP (not localhost),
  // which can disable randomUUID and break “Add” actions silently.
  const c = (globalThis as unknown as { crypto?: Crypto }).crypto
  if (c?.randomUUID) return c.randomUUID()

  // Fallback UUID v4-ish (sufficient for local/offline IDs).
  let d = Date.now()
  let d2 = (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() * 1000 : 0) | 0
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    let r = Math.random() * 16
    if (d > 0) {
      r = (d + r) % 16
      d = Math.floor(d / 16)
    } else {
      r = (d2 + r) % 16
      d2 = Math.floor(d2 / 16)
    }
    const v = ch === 'x' ? (r | 0) : (((r | 0) & 0x3) | 0x8)
    return v.toString(16)
  })
}

type NodeSeed =
  | { type: 'item'; title: string }
  | { type: 'category'; title: string; children: NodeSeed[] }

function buildNodes(args: {
  chartId: string
  parentId?: string
  startSort: number
  seeds: NodeSeed[]
  createdAt: string
}): ChartNode[] {
  const out: ChartNode[] = []
  let sort = args.startSort

  for (const seed of args.seeds) {
    const id = newId()
    out.push({
      id,
      chartId: args.chartId,
      parentId: args.parentId,
      type: seed.type,
      title: seed.title,
      sortOrder: sort,
      createdAt: args.createdAt,
      updatedAt: args.createdAt,
    })

    sort += 10

    if (seed.type === 'category') {
      out.push(
        ...buildNodes({
          chartId: args.chartId,
          parentId: id,
          startSort: 10,
          seeds: seed.children,
          createdAt: args.createdAt,
        }),
      )
    }
  }

  return out
}

async function ensureChartNodesFromSeeds(args: { chartId: string; seeds: NodeSeed[]; createdAt: string }) {
  const existing = await db.chartNodes.where('chartId').equals(args.chartId).toArray()

  const keyForParent = (parentId?: string) => parentId ?? ''
  const byParent = new Map<string, Map<string, ChartNode>>() // parentKey -> lowerTitle -> node
  const maxSortByParent = new Map<string, number>() // parentKey -> max sort

  for (const n of existing) {
    const p = keyForParent(n.parentId)
    const titleKey = n.title.trim().toLowerCase()
    let m = byParent.get(p)
    if (!m) {
      m = new Map()
      byParent.set(p, m)
    }
    // If duplicates exist, keep the first encountered.
    if (!m.has(titleKey)) m.set(titleKey, n)

    const max = maxSortByParent.get(p) ?? 0
    if (n.sortOrder > max) maxSortByParent.set(p, n.sortOrder)
  }

  const toAdd: ChartNode[] = []

  function nextSort(parentId?: string) {
    const p = keyForParent(parentId)
    const cur = maxSortByParent.get(p) ?? 0
    const nxt = cur + 10
    maxSortByParent.set(p, nxt)
    return nxt
  }

  function ensureSeed(parentId: string | undefined, seed: NodeSeed): ChartNode | null {
    const p = keyForParent(parentId)
    const titleKey = seed.title.trim().toLowerCase()
    const m = byParent.get(p) ?? new Map<string, ChartNode>()
    if (!byParent.has(p)) byParent.set(p, m)

    let node = m.get(titleKey)

    if (!node) {
      node = {
        id: newId(),
        chartId: args.chartId,
        parentId,
        type: seed.type,
        title: seed.title,
        sortOrder: nextSort(parentId),
        createdAt: args.createdAt,
        updatedAt: args.createdAt,
      }
      m.set(titleKey, node)
      toAdd.push(node)
    }

    if (seed.type === 'category') {
      // Only recurse if we have a category node to attach children under.
      if (node.type === 'category') {
        for (const child of seed.children) ensureSeed(node.id, child)
      }
    }

    return node
  }

  for (const seed of args.seeds) ensureSeed(undefined, seed)

  if (toAdd.length) await db.chartNodes.bulkAdd(toAdd)
}

function expandedStarterChartSeeds(): NodeSeed[] {
  return [
    {
      type: 'category',
      title: 'Emotions',
      children: [
        {
          type: 'category',
          title: 'Core emotions',
          children: [
            { type: 'item', title: 'Fear' },
            { type: 'item', title: 'Anger' },
            { type: 'item', title: 'Sadness' },
            { type: 'item', title: 'Guilt' },
            { type: 'item', title: 'Shame' },
            { type: 'item', title: 'Grief' },
            { type: 'item', title: 'Anxiety' },
            { type: 'item', title: 'Overwhelm' },
            { type: 'item', title: 'Hopelessness' },
            { type: 'item', title: 'Helplessness' },
            { type: 'item', title: 'Frustration' },
            { type: 'item', title: 'Irritability' },
          ],
        },
        {
          type: 'category',
          title: 'Stress & pressure',
          children: [
            { type: 'item', title: 'Stress response stuck “on”' },
            { type: 'item', title: 'Performance pressure' },
            { type: 'item', title: 'Hypervigilance' },
            { type: 'item', title: 'Decision fatigue' },
            { type: 'item', title: 'Burnout' },
            { type: 'item', title: 'Too many responsibilities' },
            { type: 'item', title: 'Feeling rushed' },
            { type: 'item', title: 'Feeling trapped' },
          ],
        },
        {
          type: 'category',
          title: 'Relationships & belonging',
          children: [
            { type: 'item', title: 'Rejection' },
            { type: 'item', title: 'Abandonment' },
            { type: 'item', title: 'Betrayal' },
            { type: 'item', title: 'Loneliness' },
            { type: 'item', title: 'Feeling misunderstood' },
            { type: 'item', title: 'Resentment' },
            { type: 'item', title: 'Unspoken expectations' },
            { type: 'item', title: 'People-pleasing' },
          ],
        },
        {
          type: 'category',
          title: 'Self-perception',
          children: [
            { type: 'item', title: 'Not good enough' },
            { type: 'item', title: 'Self-criticism' },
            { type: 'item', title: 'Feeling unworthy' },
            { type: 'item', title: 'Feeling powerless' },
            { type: 'item', title: 'Embarrassment' },
            { type: 'item', title: 'Self-doubt' },
            { type: 'item', title: 'Imposter feelings' },
            { type: 'item', title: 'Loss of confidence' },
          ],
        },
        {
          type: 'category',
          title: 'Regulation & nervous system',
          children: [
            { type: 'item', title: 'Difficulty calming down' },
            { type: 'item', title: 'Difficulty feeling safe' },
            { type: 'item', title: 'Startle response' },
            { type: 'item', title: 'Emotional numbness' },
            { type: 'item', title: 'Emotional flooding' },
            { type: 'item', title: 'Tension holding (general)' },
          ],
        },
      ],
    },
    {
      type: 'category',
      title: 'Body',
      children: [
        {
          type: 'category',
          title: 'Foundational',
          children: [
            { type: 'item', title: 'Dehydration / low hydration' },
            { type: 'item', title: 'Poor sleep quality' },
            { type: 'item', title: 'Fatigue' },
            { type: 'item', title: 'Low resilience to stress' },
            { type: 'item', title: 'Inflammation (general)' },
            { type: 'item', title: 'Pain (general)' },
            { type: 'item', title: 'Muscle tension (general)' },
          ],
        },
        {
          type: 'category',
          title: 'Systems (general)',
          children: [
            { type: 'item', title: 'Nervous system imbalance' },
            { type: 'item', title: 'Digestive system imbalance' },
            { type: 'item', title: 'Endocrine / hormonal imbalance' },
            { type: 'item', title: 'Immune system imbalance' },
            { type: 'item', title: 'Respiratory system imbalance' },
            { type: 'item', title: 'Cardiovascular system imbalance' },
            { type: 'item', title: 'Musculoskeletal system imbalance' },
            { type: 'item', title: 'Reproductive system imbalance' },
            { type: 'item', title: 'Urinary system imbalance' },
            { type: 'item', title: 'Skin / integumentary imbalance' },
          ],
        },
        {
          type: 'category',
          title: 'Structural',
          children: [
            { type: 'item', title: 'Head / jaw tension' },
            { type: 'item', title: 'Neck tension' },
            { type: 'item', title: 'Shoulder tension' },
            { type: 'item', title: 'Upper back tension' },
            { type: 'item', title: 'Lower back tension' },
            { type: 'item', title: 'Hip imbalance' },
            { type: 'item', title: 'Knee discomfort' },
            { type: 'item', title: 'Foot / ankle discomfort' },
          ],
        },
        {
          type: 'category',
          title: 'Energy & vitality',
          children: [
            { type: 'item', title: 'Low motivation' },
            { type: 'item', title: 'Low focus / brain fog' },
            { type: 'item', title: 'Wired but tired' },
            { type: 'item', title: 'Afternoon crash' },
            { type: 'item', title: 'Restlessness' },
          ],
        },
      ],
    },
    {
      type: 'category',
      title: 'Beliefs',
      children: [
        {
          type: 'category',
          title: 'Self-worth & identity',
          children: [
            { type: 'item', title: 'I am not enough' },
            { type: 'item', title: 'I have to earn love' },
            { type: 'item', title: 'My needs don’t matter' },
            { type: 'item', title: 'If I rest, I’m lazy' },
            { type: 'item', title: 'It’s wrong to want more' },
            { type: 'item', title: 'I must be perfect to be accepted' },
            { type: 'item', title: 'I can’t trust myself' },
            { type: 'item', title: 'I’m responsible for everyone’s feelings' },
          ],
        },
        {
          type: 'category',
          title: 'Safety & control',
          children: [
            { type: 'item', title: 'The world is not safe' },
            { type: 'item', title: 'If I let go, something bad will happen' },
            { type: 'item', title: 'I have to stay on guard' },
            { type: 'item', title: 'I can’t handle it' },
            { type: 'item', title: 'I must stay in control' },
            { type: 'item', title: 'It’s not safe to feel' },
          ],
        },
        {
          type: 'category',
          title: 'Relationships',
          children: [
            { type: 'item', title: 'I will be rejected if I’m myself' },
            { type: 'item', title: 'People leave' },
            { type: 'item', title: 'I have to please others to be safe' },
            { type: 'item', title: 'Conflict means the relationship is ending' },
            { type: 'item', title: 'My voice doesn’t matter' },
            { type: 'item', title: 'I’m too much / not enough for others' },
          ],
        },
        {
          type: 'category',
          title: 'Body & health',
          children: [
            { type: 'item', title: 'My body is fragile' },
            { type: 'item', title: 'I can’t heal' },
            { type: 'item', title: 'Pain is inevitable' },
            { type: 'item', title: 'I don’t deserve to feel good' },
            { type: 'item', title: 'I can’t trust my body signals' },
          ],
        },
        {
          type: 'category',
          title: 'Purpose & meaning',
          children: [
            { type: 'item', title: 'My life doesn’t matter' },
            { type: 'item', title: 'I’m behind' },
            { type: 'item', title: 'It’s too late for me' },
            { type: 'item', title: 'Nothing I do makes a difference' },
            { type: 'item', title: 'I don’t belong' },
          ],
        },
      ],
    },
  ]
}

function sessionFlowChartSeeds(): NodeSeed[] {
  return [
    {
      type: 'category',
      title: 'Body chart (tiles)',
      children: [
        {
          type: 'category',
          title: 'Energy patterns',
          children: [
            {
              type: 'category',
              title: 'Activation (wired / on-edge)',
              children: [
                { type: 'item', title: 'Stress response stuck “on”' },
                { type: 'item', title: 'Racing thoughts / can’t settle' },
                { type: 'item', title: 'Restlessness' },
                { type: 'item', title: 'Startle response' },
                { type: 'item', title: 'Tension holding (general)' },
                { type: 'item', title: 'Overreactive to small stressors' },
              ],
            },
            {
              type: 'category',
              title: 'Depletion (low / flat)',
              children: [
                { type: 'item', title: 'Low vitality / depleted' },
                { type: 'item', title: 'Fatigue' },
                { type: 'item', title: 'Brain fog' },
                { type: 'item', title: 'Low motivation' },
                { type: 'item', title: 'Afternoon crash' },
                { type: 'item', title: 'Slow recovery after stress' },
              ],
            },
            {
              type: 'category',
              title: 'Sleep-related',
              children: [
                { type: 'item', title: 'Trouble falling asleep' },
                { type: 'item', title: 'Night waking' },
                { type: 'item', title: 'Early waking' },
                { type: 'item', title: 'Nighttime anxiety' },
                { type: 'item', title: 'Unrefreshing sleep' },
                { type: 'item', title: 'Bedtime resistance (child)' },
              ],
            },
            {
              type: 'category',
              title: 'Overstimulation / load',
              children: [
                { type: 'item', title: 'Screen overload' },
                { type: 'item', title: 'Noise/light sensitivity' },
                { type: 'item', title: 'Crowds / social overload' },
                { type: 'item', title: 'Too many transitions' },
                { type: 'item', title: 'No margin / too scheduled' },
                { type: 'item', title: 'Sensory overwhelm (child)' },
              ],
            },
            {
              type: 'category',
              title: 'Emotional overlay check',
              children: [
                { type: 'item', title: 'Anxiety / worry overlay' },
                { type: 'item', title: 'Anger / irritability overlay' },
                { type: 'item', title: 'Grief / sadness overlay' },
                { type: 'item', title: 'Overwhelm / pressure overlay' },
                { type: 'item', title: 'Shame / self-criticism overlay' },
                { type: 'item', title: 'Rejection / loneliness overlay' },
              ],
            },
          ],
        },
        {
          type: 'category',
          title: 'Microbes & pathogens',
          children: [
            {
              type: 'category',
              title: 'Respiratory',
              children: [
                { type: 'item', title: 'Congestion pattern' },
                { type: 'item', title: 'Cough pattern' },
                { type: 'item', title: 'Sinus pressure pattern' },
                { type: 'item', title: 'Throat irritation pattern' },
                { type: 'item', title: 'Seasonal flare pattern' },
                { type: 'item', title: 'Breathing tightness with stress' },
              ],
            },
            {
              type: 'category',
              title: 'Gut / microbiome',
              children: [
                { type: 'item', title: 'Bloating / gas pattern' },
                { type: 'item', title: 'Constipation pattern' },
                { type: 'item', title: 'Loose stools pattern' },
                { type: 'item', title: 'Nausea pattern' },
                { type: 'item', title: 'Food-triggered symptoms' },
                { type: 'item', title: 'Gut discomfort with stress' },
              ],
            },
            {
              type: 'category',
              title: 'Recurrence / lingering',
              children: [
                { type: 'item', title: 'Recurring infections pattern' },
                { type: 'item', title: 'Slow recovery pattern' },
                { type: 'item', title: 'Post-illness fatigue pattern' },
                { type: 'item', title: 'Inflammation lingering after illness' },
                { type: 'item', title: '“Always catching something”' },
                { type: 'item', title: 'Immune resilience low' },
              ],
            },
            {
              type: 'category',
              title: 'Emotional overlay check',
              children: [
                { type: 'item', title: 'Stress load lowering immunity' },
                { type: 'item', title: 'Grief / sadness lowering resilience' },
                { type: 'item', title: 'Fear / worry tightening breath' },
                { type: 'item', title: 'Overwhelm disrupting routines' },
                { type: 'item', title: 'Feeling unsafe / hypervigilant' },
                { type: 'item', title: 'Boundary stress / resentment' },
              ],
            },
          ],
        },
        {
          type: 'category',
          title: 'Circuits & systems',
          children: [
            {
              type: 'category',
              title: 'Systems',
              children: [
                { type: 'item', title: 'Nervous system imbalance' },
                { type: 'item', title: 'Digestive system imbalance' },
                { type: 'item', title: 'Immune system imbalance' },
                { type: 'item', title: 'Respiratory system imbalance' },
                { type: 'item', title: 'Endocrine / hormonal imbalance' },
                { type: 'item', title: 'Musculoskeletal system imbalance' },
                { type: 'item', title: 'Cardiovascular system imbalance' },
                { type: 'item', title: 'Skin / integumentary imbalance' },
              ],
            },
            {
              type: 'category',
              title: 'Circuits (functional)',
              children: [
                { type: 'item', title: 'Sleep/wake regulation' },
                { type: 'item', title: 'Stress regulation' },
                { type: 'item', title: 'Digestion regulation' },
                { type: 'item', title: 'Detox pathways support needed' },
                { type: 'item', title: 'Inflammation regulation' },
                { type: 'item', title: 'Energy production support needed' },
              ],
            },
            {
              type: 'category',
              title: 'Organs (by region)',
              children: [
                { type: 'item', title: 'Brain / head' },
                { type: 'item', title: 'Heart / circulation' },
                { type: 'item', title: 'Lungs / breathing' },
                { type: 'item', title: 'Stomach / intestines' },
                { type: 'item', title: 'Liver / gallbladder' },
                { type: 'item', title: 'Kidneys / bladder' },
                { type: 'item', title: 'Skin' },
                { type: 'item', title: 'Reproductive organs (if relevant)' },
              ],
            },
            {
              type: 'category',
              title: 'Glands / hormones',
              children: [
                { type: 'item', title: 'Thyroid support needed' },
                { type: 'item', title: 'Adrenal stress load' },
                { type: 'item', title: 'Blood sugar swings' },
                { type: 'item', title: 'Cycle-related changes (if relevant)' },
                { type: 'item', title: 'Stress hormones affecting sleep' },
                { type: 'item', title: 'Hormone mood sensitivity' },
              ],
            },
            {
              type: 'category',
              title: 'Emotional overlay check',
              children: [
                { type: 'item', title: 'Nervous system safety deficit' },
                { type: 'item', title: 'Grief held in chest / breath' },
                { type: 'item', title: 'Anger held as tension' },
                { type: 'item', title: 'Worry held in gut' },
                { type: 'item', title: 'Over-responsibility / pressure' },
                { type: 'item', title: 'Shutdown / numbness' },
              ],
            },
          ],
        },
        {
          type: 'category',
          title: 'Alignment & structure',
          children: [
            {
              type: 'category',
              title: 'Common regions',
              children: [
                { type: 'item', title: 'Jaw / TMJ tension' },
                { type: 'item', title: 'Neck tension' },
                { type: 'item', title: 'Shoulder tension' },
                { type: 'item', title: 'Upper back tension' },
                { type: 'item', title: 'Lower back discomfort' },
                { type: 'item', title: 'Hip imbalance' },
                { type: 'item', title: 'Knee discomfort' },
                { type: 'item', title: 'Foot/ankle discomfort' },
              ],
            },
            {
              type: 'category',
              title: 'Tissue types',
              children: [
                { type: 'item', title: 'Muscle tension' },
                { type: 'item', title: 'Ligament strain pattern' },
                { type: 'item', title: 'Tendon irritation pattern' },
                { type: 'item', title: 'Fascia tightness' },
                { type: 'item', title: 'Joint stiffness' },
              ],
            },
            {
              type: 'category',
              title: 'Posture / movement',
              children: [
                { type: 'item', title: 'Forward head posture pattern' },
                { type: 'item', title: 'Rounded shoulders pattern' },
                { type: 'item', title: 'Hip hinge / low back loading pattern' },
                { type: 'item', title: 'Compensation pattern (favoring one side)' },
                { type: 'item', title: 'Guarding due to fear of pain' },
                { type: 'item', title: 'Old injury compensation pattern' },
              ],
            },
            {
              type: 'category',
              title: 'Emotional overlay check',
              children: [
                { type: 'item', title: 'Carrying too much / burden' },
                { type: 'item', title: 'Feeling unsupported' },
                { type: 'item', title: 'Anger held in shoulders/jaw' },
                { type: 'item', title: 'Fear held as guarding/tension' },
                { type: 'item', title: 'Over-responsibility / rigidity' },
                { type: 'item', title: 'Stuckness / frozen response' },
              ],
            },
          ],
        },
        {
          type: 'category',
          title: 'Toxins & irritants',
          children: [
            {
              type: 'category',
              title: 'Food-related',
              children: [
                { type: 'item', title: 'Food additive sensitivity (general)' },
                { type: 'item', title: 'High sugar / crash pattern' },
                { type: 'item', title: 'Dairy trigger (general)' },
                { type: 'item', title: 'Gluten trigger (general)' },
                { type: 'item', title: 'Histamine-type reaction pattern' },
                { type: 'item', title: 'Caffeine sensitivity' },
              ],
            },
            {
              type: 'category',
              title: 'Environment / home',
              children: [
                { type: 'item', title: 'Household cleaner exposure' },
                { type: 'item', title: 'Fragrance exposure' },
                { type: 'item', title: 'Smoke exposure' },
                { type: 'item', title: 'Dust / indoor air irritation' },
                { type: 'item', title: 'Mold/damp exposure pattern' },
                { type: 'item', title: 'Water quality concern (general)' },
              ],
            },
            {
              type: 'category',
              title: 'Metals / materials',
              children: [
                { type: 'item', title: 'Heavy metal concern (general)' },
                { type: 'item', title: 'Dental materials sensitivity (general)' },
                { type: 'item', title: 'Nickel-type sensitivity (general)' },
                { type: 'item', title: 'New jewelry reaction' },
                { type: 'item', title: 'Old exposure worry (general)' },
                { type: 'item', title: 'Work/hobby exposure (general)' },
              ],
            },
            {
              type: 'category',
              title: 'Medication-related',
              children: [
                { type: 'item', title: 'Medication side-effect pattern' },
                { type: 'item', title: 'Sensitivity to new medication' },
                { type: 'item', title: 'Withdrawal/rebound pattern' },
                { type: 'item', title: 'Gut disruption after meds' },
                { type: 'item', title: 'Sleep disruption after meds' },
                { type: 'item', title: 'Mood change after meds' },
              ],
            },
            {
              type: 'category',
              title: 'Electromagnetic / screens',
              children: [
                { type: 'item', title: 'Screen overload symptoms' },
                { type: 'item', title: 'Head pressure after screens' },
                { type: 'item', title: 'Sleep disruption from late screens' },
                { type: 'item', title: 'Restlessness from overstimulation' },
                { type: 'item', title: 'Wired-at-night pattern' },
              ],
            },
            {
              type: 'category',
              title: 'Emotional overlay check',
              children: [
                { type: 'item', title: 'Boundary stress increasing reactivity' },
                { type: 'item', title: 'Chronic stress lowering tolerance' },
                { type: 'item', title: 'Fear / vigilance amplifying symptoms' },
                { type: 'item', title: 'Overwhelm disrupting routines' },
                { type: 'item', title: 'Resentment / tension in home' },
                { type: 'item', title: 'Shutdown / numb coping' },
              ],
            },
          ],
        },
        {
          type: 'category',
          title: 'Nutrition & lifestyle',
          children: [
            {
              type: 'category',
              title: 'Sleep',
              children: [
                { type: 'item', title: 'Sleep routine support needed' },
                { type: 'item', title: 'Late bedtime / inconsistent bedtime' },
                { type: 'item', title: 'Too much light at night' },
                { type: 'item', title: 'Night waking' },
                { type: 'item', title: 'Early waking' },
                { type: 'item', title: 'Unrefreshing sleep' },
              ],
            },
            {
              type: 'category',
              title: 'Hydration',
              children: [
                { type: 'item', title: 'Hydration support needed' },
                { type: 'item', title: 'Electrolyte/mineral support (general)' },
                { type: 'item', title: 'Dryness (general)' },
                { type: 'item', title: 'Headache improved by water' },
                { type: 'item', title: 'Low thirst cues' },
              ],
            },
            {
              type: 'category',
              title: 'Nutrition',
              children: [
                { type: 'item', title: 'Blood sugar swings pattern' },
                { type: 'item', title: 'Low protein / cravings' },
                { type: 'item', title: 'Skipping meals pattern' },
                { type: 'item', title: 'Low appetite / picky eating (child)' },
                { type: 'item', title: 'Mineral support needed (general)' },
                { type: 'item', title: 'Gut support foods needed' },
              ],
            },
            {
              type: 'category',
              title: 'Movement / recovery',
              children: [
                { type: 'item', title: 'Movement support needed' },
                { type: 'item', title: 'Too sedentary / stiffness' },
                { type: 'item', title: 'Overtraining / under-recovery' },
                { type: 'item', title: 'Gentle mobility needed' },
                { type: 'item', title: 'Outdoor movement helps' },
                { type: 'item', title: 'Need for stretching / release' },
              ],
            },
            {
              type: 'category',
              title: 'Outside / light / nature',
              children: [
                { type: 'item', title: 'Needs more daylight' },
                { type: 'item', title: 'Needs more time outside' },
                { type: 'item', title: 'Seasonal pattern' },
                { type: 'item', title: 'Fresh air helps symptoms' },
                { type: 'item', title: 'Nature/calming helps regulation' },
              ],
            },
            {
              type: 'category',
              title: 'Emotional overlay check',
              children: [
                { type: 'item', title: 'Overwhelm disrupting routines' },
                { type: 'item', title: 'Control/perfection around food' },
                { type: 'item', title: 'Anxiety affecting sleep' },
                { type: 'item', title: 'Resentment from over-scheduling' },
                { type: 'item', title: 'Shame/self-criticism about habits' },
                { type: 'item', title: 'Safety deficit / hypervigilance' },
              ],
            },
          ],
        },
        {
          type: 'category',
          title: 'Sensitivities',
          children: [
            {
              type: 'category',
              title: 'Food sensitivities',
              children: [
                { type: 'item', title: 'Food sensitivity pattern (general)' },
                { type: 'item', title: 'Dairy sensitivity (general)' },
                { type: 'item', title: 'Gluten sensitivity (general)' },
                { type: 'item', title: 'Egg sensitivity (general)' },
                { type: 'item', title: 'Artificial dye sensitivity (general)' },
                { type: 'item', title: 'Histamine-type food reaction pattern' },
              ],
            },
            {
              type: 'category',
              title: 'Environmental allergies',
              children: [
                { type: 'item', title: 'Seasonal allergy pattern' },
                { type: 'item', title: 'Dust sensitivity' },
                { type: 'item', title: 'Pet sensitivity' },
                { type: 'item', title: 'Pollen flare pattern' },
                { type: 'item', title: 'Indoor air irritation' },
              ],
            },
            {
              type: 'category',
              title: 'Chemical / fragrance',
              children: [
                { type: 'item', title: 'Chemical sensitivity pattern' },
                { type: 'item', title: 'Fragrance sensitivity' },
                { type: 'item', title: 'Cleaning product sensitivity' },
                { type: 'item', title: 'Paint/new furniture sensitivity' },
                { type: 'item', title: 'Headache triggered by smells' },
              ],
            },
            {
              type: 'category',
              title: 'Sensory (kid-friendly)',
              children: [
                { type: 'item', title: 'Texture/sensory sensitivity (child)' },
                { type: 'item', title: 'Noise/light overstimulation' },
                { type: 'item', title: 'Clothing tag/texture irritation' },
                { type: 'item', title: 'Crowds overwhelm' },
                { type: 'item', title: 'Transitions trigger meltdown' },
              ],
            },
            {
              type: 'category',
              title: 'Emotional overlay check',
              children: [
                { type: 'item', title: 'Anxiety amplifying sensitivity' },
                { type: 'item', title: 'Feeling unsafe → hyper-reactive' },
                { type: 'item', title: 'Overwhelm lowering tolerance' },
                { type: 'item', title: 'Resentment/boundary stress' },
                { type: 'item', title: 'Shutdown after overload' },
              ],
            },
          ],
        },
        {
          type: 'category',
          title: 'Cycles & rhythms',
          children: [
            {
              type: 'category',
              title: 'Daily rhythm',
              children: [
                { type: 'item', title: 'Morning resistance / slow start' },
                { type: 'item', title: 'Afternoon crash pattern' },
                { type: 'item', title: 'Evening second-wind pattern' },
                { type: 'item', title: 'Wired at bedtime' },
                { type: 'item', title: 'Night waking pattern' },
                { type: 'item', title: 'Hunger/irritability timing pattern' },
              ],
            },
            {
              type: 'category',
              title: 'Circadian',
              children: [
                { type: 'item', title: 'Circadian rhythm disruption' },
                { type: 'item', title: 'Too much light at night' },
                { type: 'item', title: 'Not enough daylight in morning' },
                { type: 'item', title: 'Weekend schedule shift' },
                { type: 'item', title: 'Jet lag / travel disruption' },
              ],
            },
            {
              type: 'category',
              title: 'Seasonal / environmental',
              children: [
                { type: 'item', title: 'Seasonal pattern' },
                { type: 'item', title: 'Winter low-energy pattern' },
                { type: 'item', title: 'Spring allergy season pattern' },
                { type: 'item', title: 'Heat sensitivity pattern' },
                { type: 'item', title: 'Cold sensitivity pattern' },
              ],
            },
            {
              type: 'category',
              title: 'Cycle-related (if relevant)',
              children: [
                { type: 'item', title: 'PMS / cycle-related changes (if relevant)' },
                { type: 'item', title: 'Cramping / discomfort timing' },
                { type: 'item', title: 'Mood swings timing' },
                { type: 'item', title: 'Sleep disruption around cycle' },
                { type: 'item', title: 'Energy dip timing' },
              ],
            },
            {
              type: 'category',
              title: 'Emotional overlay check',
              children: [
                { type: 'item', title: 'Overwhelm disrupting rhythm' },
                { type: 'item', title: 'Anxiety at night' },
                { type: 'item', title: 'Grief surfacing in quiet times' },
                { type: 'item', title: 'Anger/irritability at transitions' },
                { type: 'item', title: 'Safety deficit at bedtime' },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'category',
      title: 'Emotion chart (matrix)',
      children: [
        {
          type: 'category',
          title: 'Column A',
          children: [
            {
              type: 'category',
              title: 'Row 1',
              children: [
                { type: 'item', title: 'Abandonment' },
                { type: 'item', title: 'Rejection' },
                { type: 'item', title: 'Loneliness' },
                { type: 'item', title: 'Insecurity' },
                { type: 'item', title: 'Vulnerability' },
                { type: 'item', title: 'Homesickness' },
              ],
            },
            {
              type: 'category',
              title: 'Row 2',
              children: [
                { type: 'item', title: 'Grief' },
                { type: 'item', title: 'Sadness' },
                { type: 'item', title: 'Heartache' },
                { type: 'item', title: 'Disappointment' },
                { type: 'item', title: 'Longing' },
                { type: 'item', title: 'Sorrow' },
              ],
            },
            {
              type: 'category',
              title: 'Row 3',
              children: [
                { type: 'item', title: 'Anxiety' },
                { type: 'item', title: 'Worry' },
                { type: 'item', title: 'Nervousness' },
                { type: 'item', title: 'Panic' },
                { type: 'item', title: 'Dread' },
                { type: 'item', title: 'Hypervigilance' },
              ],
            },
            {
              type: 'category',
              title: 'Row 4',
              children: [
                { type: 'item', title: 'Anger' },
                { type: 'item', title: 'Irritability' },
                { type: 'item', title: 'Frustration' },
                { type: 'item', title: 'Resentment' },
                { type: 'item', title: 'Annoyance' },
                { type: 'item', title: 'Rage' },
              ],
            },
            {
              type: 'category',
              title: 'Row 5',
              children: [
                { type: 'item', title: 'Overwhelm' },
                { type: 'item', title: 'Stress' },
                { type: 'item', title: 'Pressure' },
                { type: 'item', title: 'Burnout' },
                { type: 'item', title: 'Exhaustion' },
                { type: 'item', title: 'Feeling rushed' },
              ],
            },
            {
              type: 'category',
              title: 'Row 6',
              children: [
                { type: 'item', title: 'Shame' },
                { type: 'item', title: 'Guilt' },
                { type: 'item', title: 'Embarrassment' },
                { type: 'item', title: 'Self-criticism' },
                { type: 'item', title: 'Unworthiness' },
                { type: 'item', title: 'Regret' },
              ],
            },
          ],
        },
        {
          type: 'category',
          title: 'Column B',
          children: [
            {
              type: 'category',
              title: 'Row 1',
              children: [
                { type: 'item', title: 'Fear' },
                { type: 'item', title: 'Terror' },
                { type: 'item', title: 'Insecurity (fear-based)' },
                { type: 'item', title: 'Feeling unsafe' },
                { type: 'item', title: 'Startle' },
                { type: 'item', title: 'Anticipation of harm' },
              ],
            },
            {
              type: 'category',
              title: 'Row 2',
              children: [
                { type: 'item', title: 'Jealousy' },
                { type: 'item', title: 'Envy' },
                { type: 'item', title: 'Comparison' },
                { type: 'item', title: 'Bitterness' },
                { type: 'item', title: 'Suspicion' },
                { type: 'item', title: 'Distrust' },
              ],
            },
            {
              type: 'category',
              title: 'Row 3',
              children: [
                { type: 'item', title: 'Feeling trapped' },
                { type: 'item', title: 'Helplessness' },
                { type: 'item', title: 'Powerlessness' },
                { type: 'item', title: 'Hopelessness' },
                { type: 'item', title: 'Defeat' },
                { type: 'item', title: 'Stuckness' },
              ],
            },
            {
              type: 'category',
              title: 'Row 4',
              children: [
                { type: 'item', title: 'Disgust' },
                { type: 'item', title: 'Aversion' },
                { type: 'item', title: 'Contempt' },
                { type: 'item', title: 'Being “done with it”' },
                { type: 'item', title: 'Judgment' },
                { type: 'item', title: 'Cynicism' },
              ],
            },
            {
              type: 'category',
              title: 'Row 5',
              children: [
                { type: 'item', title: 'Confusion' },
                { type: 'item', title: 'Indecision' },
                { type: 'item', title: 'Mental fog' },
                { type: 'item', title: 'Doubt' },
                { type: 'item', title: 'Uncertainty' },
                { type: 'item', title: 'Scattered' },
              ],
            },
            {
              type: 'category',
              title: 'Row 6',
              children: [
                { type: 'item', title: 'Emotional numbness' },
                { type: 'item', title: 'Detachment' },
                { type: 'item', title: 'Shutdown' },
                { type: 'item', title: 'Dissociation (mild)' },
                { type: 'item', title: 'Withdrawal' },
                { type: 'item', title: 'Apathy' },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'category',
      title: 'Emotion (binary drill-down)',
      children: [
        {
          type: 'category',
          title: 'Is it in Column A?',
          children: [
            {
              type: 'category',
              title: 'Column A',
              children: [
                {
                  type: 'category',
                  title: 'Is it in an odd row? (1, 3, 5)',
                  children: [
                    {
                      type: 'category',
                      title: 'Odd rows (1, 3, 5)',
                      children: [
                        {
                          type: 'category',
                          title: 'Is it row 1?',
                          children: [
                            {
                              type: 'category',
                              title: 'Row 1',
                              children: [
                                { type: 'item', title: 'Abandonment' },
                                { type: 'item', title: 'Rejection' },
                                { type: 'item', title: 'Loneliness' },
                                { type: 'item', title: 'Insecurity' },
                                { type: 'item', title: 'Vulnerability' },
                                { type: 'item', title: 'Homesickness' },
                              ],
                            },
                            {
                              type: 'category',
                              title: 'Not row 1',
                              children: [
                                {
                                  type: 'category',
                                  title: 'Is it row 3?',
                                  children: [
                                    {
                                      type: 'category',
                                      title: 'Row 3',
                                      children: [
                                        { type: 'item', title: 'Anxiety' },
                                        { type: 'item', title: 'Worry' },
                                        { type: 'item', title: 'Nervousness' },
                                        { type: 'item', title: 'Panic' },
                                        { type: 'item', title: 'Dread' },
                                        { type: 'item', title: 'Hypervigilance' },
                                      ],
                                    },
                                    {
                                      type: 'category',
                                      title: 'Row 5',
                                      children: [
                                        { type: 'item', title: 'Overwhelm' },
                                        { type: 'item', title: 'Stress' },
                                        { type: 'item', title: 'Pressure' },
                                        { type: 'item', title: 'Burnout' },
                                        { type: 'item', title: 'Exhaustion' },
                                        { type: 'item', title: 'Feeling rushed' },
                                      ],
                                    },
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                    {
                      type: 'category',
                      title: 'Even rows (2, 4, 6)',
                      children: [
                        {
                          type: 'category',
                          title: 'Is it row 2?',
                          children: [
                            {
                              type: 'category',
                              title: 'Row 2',
                              children: [
                                { type: 'item', title: 'Grief' },
                                { type: 'item', title: 'Sadness' },
                                { type: 'item', title: 'Heartache' },
                                { type: 'item', title: 'Disappointment' },
                                { type: 'item', title: 'Longing' },
                                { type: 'item', title: 'Sorrow' },
                              ],
                            },
                            {
                              type: 'category',
                              title: 'Not row 2',
                              children: [
                                {
                                  type: 'category',
                                  title: 'Is it row 4?',
                                  children: [
                                    {
                                      type: 'category',
                                      title: 'Row 4',
                                      children: [
                                        { type: 'item', title: 'Anger' },
                                        { type: 'item', title: 'Irritability' },
                                        { type: 'item', title: 'Frustration' },
                                        { type: 'item', title: 'Resentment' },
                                        { type: 'item', title: 'Annoyance' },
                                        { type: 'item', title: 'Rage' },
                                      ],
                                    },
                                    {
                                      type: 'category',
                                      title: 'Row 6',
                                      children: [
                                        { type: 'item', title: 'Shame' },
                                        { type: 'item', title: 'Guilt' },
                                        { type: 'item', title: 'Embarrassment' },
                                        { type: 'item', title: 'Self-criticism' },
                                        { type: 'item', title: 'Unworthiness' },
                                        { type: 'item', title: 'Regret' },
                                      ],
                                    },
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: 'category',
              title: 'Column B',
              children: [
                {
                  type: 'category',
                  title: 'Is it in an odd row? (1, 3, 5)',
                  children: [
                    {
                      type: 'category',
                      title: 'Odd rows (1, 3, 5)',
                      children: [
                        {
                          type: 'category',
                          title: 'Is it row 1?',
                          children: [
                            {
                              type: 'category',
                              title: 'Row 1',
                              children: [
                                { type: 'item', title: 'Fear' },
                                { type: 'item', title: 'Terror' },
                                { type: 'item', title: 'Insecurity (fear-based)' },
                                { type: 'item', title: 'Feeling unsafe' },
                                { type: 'item', title: 'Startle' },
                                { type: 'item', title: 'Anticipation of harm' },
                              ],
                            },
                            {
                              type: 'category',
                              title: 'Not row 1',
                              children: [
                                {
                                  type: 'category',
                                  title: 'Is it row 3?',
                                  children: [
                                    {
                                      type: 'category',
                                      title: 'Row 3',
                                      children: [
                                        { type: 'item', title: 'Feeling trapped' },
                                        { type: 'item', title: 'Helplessness' },
                                        { type: 'item', title: 'Powerlessness' },
                                        { type: 'item', title: 'Hopelessness' },
                                        { type: 'item', title: 'Defeat' },
                                        { type: 'item', title: 'Stuckness' },
                                      ],
                                    },
                                    {
                                      type: 'category',
                                      title: 'Row 5',
                                      children: [
                                        { type: 'item', title: 'Confusion' },
                                        { type: 'item', title: 'Indecision' },
                                        { type: 'item', title: 'Mental fog' },
                                        { type: 'item', title: 'Doubt' },
                                        { type: 'item', title: 'Uncertainty' },
                                        { type: 'item', title: 'Scattered' },
                                      ],
                                    },
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                    {
                      type: 'category',
                      title: 'Even rows (2, 4, 6)',
                      children: [
                        {
                          type: 'category',
                          title: 'Is it row 2?',
                          children: [
                            {
                              type: 'category',
                              title: 'Row 2',
                              children: [
                                { type: 'item', title: 'Jealousy' },
                                { type: 'item', title: 'Envy' },
                                { type: 'item', title: 'Comparison' },
                                { type: 'item', title: 'Bitterness' },
                                { type: 'item', title: 'Suspicion' },
                                { type: 'item', title: 'Distrust' },
                              ],
                            },
                            {
                              type: 'category',
                              title: 'Not row 2',
                              children: [
                                {
                                  type: 'category',
                                  title: 'Is it row 4?',
                                  children: [
                                    {
                                      type: 'category',
                                      title: 'Row 4',
                                      children: [
                                        { type: 'item', title: 'Disgust' },
                                        { type: 'item', title: 'Aversion' },
                                        { type: 'item', title: 'Contempt' },
                                        { type: 'item', title: 'Being “done with it”' },
                                        { type: 'item', title: 'Judgment' },
                                        { type: 'item', title: 'Cynicism' },
                                      ],
                                    },
                                    {
                                      type: 'category',
                                      title: 'Row 6',
                                      children: [
                                        { type: 'item', title: 'Emotional numbness' },
                                        { type: 'item', title: 'Detachment' },
                                        { type: 'item', title: 'Shutdown' },
                                        { type: 'item', title: 'Dissociation (mild)' },
                                        { type: 'item', title: 'Withdrawal' },
                                        { type: 'item', title: 'Apathy' },
                                      ],
                                    },
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'category',
      title: 'Start here (quick scan)',
      children: [
        {
          type: 'category',
          title: 'What’s the priority today?',
          children: [
            { type: 'item', title: 'Pain / physical discomfort' },
            { type: 'item', title: 'Sleep' },
            { type: 'item', title: 'Digestion' },
            { type: 'item', title: 'Anxiety / worry' },
            { type: 'item', title: 'Anger / irritability' },
            { type: 'item', title: 'Sadness / grief' },
            { type: 'item', title: 'Overwhelm / stress' },
            { type: 'item', title: 'Behavior / emotions (child)' },
            { type: 'item', title: 'Relationships / conflict' },
            { type: 'item', title: 'Energy / motivation' },
            { type: 'item', title: 'Focus / brain fog' },
            { type: 'item', title: 'Other (define)' },
          ],
        },
        {
          type: 'category',
          title: 'Where do you feel it?',
          children: [
            {
              type: 'category',
              title: 'Head & neck',
              children: [
                { type: 'item', title: 'Headache / pressure' },
                { type: 'item', title: 'Jaw tension' },
                { type: 'item', title: 'Throat tightness' },
                { type: 'item', title: 'Neck tension' },
                { type: 'item', title: 'Eye strain' },
              ],
            },
            {
              type: 'category',
              title: 'Chest & breathing',
              children: [
                { type: 'item', title: 'Chest tightness' },
                { type: 'item', title: 'Shortness of breath / shallow breathing' },
                { type: 'item', title: 'Heart racing / palpitations' },
              ],
            },
            {
              type: 'category',
              title: 'Stomach & abdomen',
              children: [
                { type: 'item', title: 'Nausea' },
                { type: 'item', title: 'Bloating / gas' },
                { type: 'item', title: 'Cramping' },
                { type: 'item', title: 'Appetite changes' },
              ],
            },
            {
              type: 'category',
              title: 'Back & shoulders',
              children: [
                { type: 'item', title: 'Shoulder tension' },
                { type: 'item', title: 'Upper back tension' },
                { type: 'item', title: 'Lower back discomfort' },
              ],
            },
            {
              type: 'category',
              title: 'Whole body / general',
              children: [
                { type: 'item', title: 'Fatigue' },
                { type: 'item', title: 'Restlessness' },
                { type: 'item', title: 'Inflammation (general)' },
                { type: 'item', title: 'Muscle tension (general)' },
              ],
            },
          ],
        },
        {
          type: 'category',
          title: 'What’s the feeling tone?',
          children: [
            { type: 'item', title: 'On edge / hypervigilant' },
            { type: 'item', title: 'Shut down / numb' },
            { type: 'item', title: 'Tearful' },
            { type: 'item', title: 'Snappy' },
            { type: 'item', title: 'Hopeless' },
            { type: 'item', title: 'Scattered / unfocused' },
            { type: 'item', title: 'Stuck / frozen' },
          ],
        },
      ],
    },
    {
      type: 'category',
      title: 'Body deep dive (symptom → system → themes)',
      children: [
        {
          type: 'category',
          title: 'Head, jaw, throat',
          children: [
            { type: 'item', title: 'Headache / pressure' },
            { type: 'item', title: 'Migraine pattern' },
            { type: 'item', title: 'Jaw clenching / TMJ tension' },
            { type: 'item', title: 'Throat tightness / lump in throat' },
            { type: 'item', title: 'Neck tension' },
            {
              type: 'category',
              title: 'Common emotional overlays (check + log)',
              children: [
                { type: 'item', title: 'Holding back words / unspoken truth' },
                { type: 'item', title: 'Pressure to perform' },
                { type: 'item', title: 'Anger held in' },
                { type: 'item', title: 'Fear / worry loop' },
                { type: 'item', title: 'Over-responsibility' },
              ],
            },
          ],
        },
        {
          type: 'category',
          title: 'Chest, heart, breathing',
          children: [
            { type: 'item', title: 'Chest tightness' },
            { type: 'item', title: 'Shallow breathing' },
            { type: 'item', title: 'Sighing / can’t get a full breath' },
            { type: 'item', title: 'Heart racing / palpitations' },
            {
              type: 'category',
              title: 'Common emotional overlays (check + log)',
              children: [
                { type: 'item', title: 'Anxiety / panic activation' },
                { type: 'item', title: 'Grief in the chest' },
                { type: 'item', title: 'Feeling unsafe' },
                { type: 'item', title: 'Shock / sudden fear' },
              ],
            },
          ],
        },
        {
          type: 'category',
          title: 'Stomach & digestion',
          children: [
            { type: 'item', title: 'Nausea' },
            { type: 'item', title: 'Bloating / gas' },
            { type: 'item', title: 'Cramping' },
            { type: 'item', title: 'Heartburn / reflux' },
            { type: 'item', title: 'Appetite changes' },
            { type: 'item', title: 'Bathroom changes (constipation/loose stools)' },
            {
              type: 'category',
              title: 'Common emotional overlays (check + log)',
              children: [
                { type: 'item', title: 'Worry / rumination' },
                { type: 'item', title: 'Control / perfection pressure' },
                { type: 'item', title: 'Can’t “stomach” something' },
                { type: 'item', title: 'Conflict in the home' },
                { type: 'item', title: 'Anticipatory anxiety' },
              ],
            },
          ],
        },
        {
          type: 'category',
          title: 'Muscles, joints, back',
          children: [
            { type: 'item', title: 'Shoulder tension' },
            { type: 'item', title: 'Upper back tension' },
            { type: 'item', title: 'Lower back discomfort' },
            { type: 'item', title: 'Hip tightness' },
            { type: 'item', title: 'Knee discomfort' },
            { type: 'item', title: 'General muscle tension' },
            {
              type: 'category',
              title: 'Common emotional overlays (check + log)',
              children: [
                { type: 'item', title: 'Carrying too much / burden' },
                { type: 'item', title: 'Over-functioning' },
                { type: 'item', title: 'Anger / frustration stored as tension' },
                { type: 'item', title: 'Feeling unsupported' },
              ],
            },
          ],
        },
        {
          type: 'category',
          title: 'Sleep & energy',
          children: [
            { type: 'item', title: 'Trouble falling asleep' },
            { type: 'item', title: 'Waking during the night' },
            { type: 'item', title: 'Early waking' },
            { type: 'item', title: 'Nighttime anxiety' },
            { type: 'item', title: 'Fatigue' },
            { type: 'item', title: 'Afternoon crash' },
            {
              type: 'category',
              title: 'Common emotional overlays (check + log)',
              children: [
                { type: 'item', title: 'Mind won’t turn off / rumination' },
                { type: 'item', title: 'Feeling unsafe at night' },
                { type: 'item', title: 'Overstimulation (day too full)' },
                { type: 'item', title: 'Unprocessed grief' },
              ],
            },
          ],
        },
        {
          type: 'category',
          title: 'Immune, allergies, skin',
          children: [
            { type: 'item', title: 'Allergy flare' },
            { type: 'item', title: 'Frequent colds' },
            { type: 'item', title: 'Inflammation (general)' },
            { type: 'item', title: 'Skin irritation / itch' },
            { type: 'item', title: 'Rash / eczema-like flare' },
            {
              type: 'category',
              title: 'Common emotional overlays (check + log)',
              children: [
                { type: 'item', title: 'Feeling “attacked” / defensive' },
                { type: 'item', title: 'Boundary stress' },
                { type: 'item', title: 'Chronic stress load' },
              ],
            },
          ],
        },
        {
          type: 'category',
          title: 'Hormones & cycles (if relevant)',
          children: [
            { type: 'item', title: 'PMS / mood swings' },
            { type: 'item', title: 'Cramping / cycle discomfort' },
            { type: 'item', title: 'Hot/cold swings' },
            { type: 'item', title: 'Blood sugar swings / irritability when hungry' },
            {
              type: 'category',
              title: 'Common emotional overlays (check + log)',
              children: [
                { type: 'item', title: 'Overwhelm / too much on the plate' },
                { type: 'item', title: 'Resentment (needs not met)' },
                { type: 'item', title: 'Self-criticism / perfection' },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'category',
      title: 'Emotion deep dive (theme → sensations → roots)',
      children: [
        {
          type: 'category',
          title: 'Anxiety / worry',
          children: [
            { type: 'item', title: 'What is the fear about?' },
            { type: 'item', title: 'Catastrophizing / worst-case loop' },
            { type: 'item', title: 'Anticipatory anxiety' },
            { type: 'item', title: 'Perfection pressure' },
            {
              type: 'category',
              title: 'Common body sensations',
              children: [
                { type: 'item', title: 'Chest tightness / shallow breathing' },
                { type: 'item', title: 'Stomach tightness / nausea' },
                { type: 'item', title: 'Restlessness' },
                { type: 'item', title: 'Racing thoughts' },
              ],
            },
          ],
        },
        {
          type: 'category',
          title: 'Anger / irritability',
          children: [
            { type: 'item', title: 'Boundary crossed' },
            { type: 'item', title: 'Unfairness' },
            { type: 'item', title: 'Feeling unheard' },
            { type: 'item', title: 'Too many demands' },
            {
              type: 'category',
              title: 'Common body sensations',
              children: [
                { type: 'item', title: 'Jaw clenching' },
                { type: 'item', title: 'Heat in chest/face' },
                { type: 'item', title: 'Shoulder/neck tension' },
              ],
            },
          ],
        },
        {
          type: 'category',
          title: 'Sadness / grief',
          children: [
            { type: 'item', title: 'Loss / change' },
            { type: 'item', title: 'Longing' },
            { type: 'item', title: 'Disappointment' },
            { type: 'item', title: 'Feeling alone' },
            {
              type: 'category',
              title: 'Common body sensations',
              children: [
                { type: 'item', title: 'Heavy chest' },
                { type: 'item', title: 'Low energy' },
                { type: 'item', title: 'Tearfulness / lump in throat' },
              ],
            },
          ],
        },
        {
          type: 'category',
          title: 'Shame / guilt',
          children: [
            { type: 'item', title: 'Self-criticism / harsh inner voice' },
            { type: 'item', title: 'Fear of being judged' },
            { type: 'item', title: 'Regret / rumination' },
            {
              type: 'category',
              title: 'Common body sensations',
              children: [
                { type: 'item', title: 'Collapsing posture / heaviness' },
                { type: 'item', title: 'Stomach drop' },
                { type: 'item', title: 'Avoidance / hiding' },
              ],
            },
          ],
        },
        {
          type: 'category',
          title: 'Overwhelm / burnout',
          children: [
            { type: 'item', title: 'Too many responsibilities' },
            { type: 'item', title: 'No margin / no rest' },
            { type: 'item', title: 'Decision fatigue' },
            { type: 'item', title: 'Resentment from over-giving' },
            {
              type: 'category',
              title: 'Common body sensations',
              children: [
                { type: 'item', title: 'Head pressure / brain fog' },
                { type: 'item', title: 'Tension in shoulders/back' },
                { type: 'item', title: 'Sleep disruption' },
                { type: 'item', title: 'Low motivation' },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'category',
      title: 'Body ↔ Emotion bridge (quick pairings)',
      children: [
        {
          type: 'category',
          title: 'If the symptom is…',
          children: [
            {
              type: 'category',
              title: 'Throat tightness',
              children: [
                { type: 'item', title: 'Check: unspoken words / holding back' },
                { type: 'item', title: 'Check: fear of conflict' },
                { type: 'item', title: 'Check: feeling unheard' },
              ],
            },
            {
              type: 'category',
              title: 'Stomach upset',
              children: [
                { type: 'item', title: 'Check: worry / rumination' },
                { type: 'item', title: 'Check: control pressure' },
                { type: 'item', title: 'Check: can’t “digest” a situation' },
              ],
            },
            {
              type: 'category',
              title: 'Jaw/shoulder tension',
              children: [
                { type: 'item', title: 'Check: anger held in' },
                { type: 'item', title: 'Check: over-responsibility' },
                { type: 'item', title: 'Check: needing a boundary' },
              ],
            },
            {
              type: 'category',
              title: 'Sleep trouble',
              children: [
                { type: 'item', title: 'Check: feeling unsafe' },
                { type: 'item', title: 'Check: overthinking / looping' },
                { type: 'item', title: 'Check: overstimulation' },
              ],
            },
          ],
        },
        {
          type: 'category',
          title: 'If the emotion is…',
          children: [
            {
              type: 'category',
              title: 'Anxiety',
              children: [
                { type: 'item', title: 'Check body: breathing shallow, chest tightness' },
                { type: 'item', title: 'Check body: stomach tightness / nausea' },
                { type: 'item', title: 'Check body: restlessness' },
              ],
            },
            {
              type: 'category',
              title: 'Anger',
              children: [
                { type: 'item', title: 'Check body: jaw clenching' },
                { type: 'item', title: 'Check body: heat in chest/face' },
                { type: 'item', title: 'Check body: shoulder tension' },
              ],
            },
            {
              type: 'category',
              title: 'Grief',
              children: [
                { type: 'item', title: 'Check body: heavy chest' },
                { type: 'item', title: 'Check body: low energy' },
                { type: 'item', title: 'Check body: lump in throat' },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'category',
      title: 'Narrow down (common roots)',
      children: [
        {
          type: 'category',
          title: 'Stress & nervous system',
          children: [
            { type: 'item', title: 'Stress response stuck “on”' },
            { type: 'item', title: 'Difficulty calming down' },
            { type: 'item', title: 'Difficulty feeling safe' },
            { type: 'item', title: 'Startle response' },
            { type: 'item', title: 'Hypervigilance' },
            { type: 'item', title: 'Wired but tired' },
          ],
        },
        {
          type: 'category',
          title: 'Relationships & belonging',
          children: [
            { type: 'item', title: 'Feeling rejected' },
            { type: 'item', title: 'Feeling abandoned' },
            { type: 'item', title: 'Betrayal / broken trust' },
            { type: 'item', title: 'Loneliness' },
            { type: 'item', title: 'Resentment' },
            { type: 'item', title: 'People-pleasing' },
            { type: 'item', title: 'Unspoken expectations' },
          ],
        },
        {
          type: 'category',
          title: 'Self-perception & pressure',
          children: [
            { type: 'item', title: 'Self-criticism' },
            { type: 'item', title: 'Not good enough' },
            { type: 'item', title: 'Perfectionism' },
            { type: 'item', title: 'Imposter feelings' },
            { type: 'item', title: 'Fear of failure' },
            { type: 'item', title: 'Over-responsibility' },
          ],
        },
        {
          type: 'category',
          title: 'Body foundations',
          children: [
            { type: 'item', title: 'Dehydration / low hydration' },
            { type: 'item', title: 'Poor sleep quality' },
            { type: 'item', title: 'Nutrition off-balance (general)' },
            { type: 'item', title: 'Overstimulation (screens/noise)' },
            { type: 'item', title: 'Under-recovery / too little rest' },
          ],
        },
        {
          type: 'category',
          title: 'Environment & rhythms',
          children: [
            { type: 'item', title: 'Too much transition / change' },
            { type: 'item', title: 'Over-full schedule' },
            { type: 'item', title: 'Home tension' },
            { type: 'item', title: 'School/work stress' },
            { type: 'item', title: 'Social stress' },
          ],
        },
      ],
    },
    {
      type: 'category',
      title: 'Context (what to log)',
      children: [
        {
          type: 'category',
          title: 'Timing',
          children: [
            { type: 'item', title: 'When did this start?' },
            { type: 'item', title: 'How old (approx.)?' },
            { type: 'item', title: 'Is this recurring?' },
            { type: 'item', title: 'Is it tied to a season/time of day?' },
          ],
        },
        {
          type: 'category',
          title: 'Triggers',
          children: [
            { type: 'item', title: 'Trigger: conflict' },
            { type: 'item', title: 'Trigger: separation' },
            { type: 'item', title: 'Trigger: criticism' },
            { type: 'item', title: 'Trigger: uncertainty' },
            { type: 'item', title: 'Trigger: sensory overload' },
          ],
        },
        {
          type: 'category',
          title: 'Life events',
          children: [
            { type: 'item', title: 'Move / change of home' },
            { type: 'item', title: 'School change' },
            { type: 'item', title: 'Loss / grief' },
            { type: 'item', title: 'Injury / illness' },
            { type: 'item', title: 'New baby / family shift' },
            { type: 'item', title: 'Major conflict' },
          ],
        },
        {
          type: 'category',
          title: 'People involved',
          children: [
            { type: 'item', title: 'Parent' },
            { type: 'item', title: 'Sibling' },
            { type: 'item', title: 'Teacher / coach' },
            { type: 'item', title: 'Friend' },
            { type: 'item', title: 'Partner / spouse' },
            { type: 'item', title: 'Other (name)' },
          ],
        },
      ],
    },
    {
      type: 'category',
      title: 'Beliefs (common patterns)',
      children: [
        {
          type: 'category',
          title: 'Safety & control',
          children: [
            { type: 'item', title: 'The world is not safe' },
            { type: 'item', title: 'If I let go, something bad will happen' },
            { type: 'item', title: 'I must stay on guard' },
            { type: 'item', title: 'I must stay in control' },
            { type: 'item', title: 'It’s not safe to feel' },
          ],
        },
        {
          type: 'category',
          title: 'Worthiness',
          children: [
            { type: 'item', title: 'I am not enough' },
            { type: 'item', title: 'I have to earn love' },
            { type: 'item', title: 'My needs don’t matter' },
            { type: 'item', title: 'If I rest, I’m lazy' },
            { type: 'item', title: 'I must be perfect to be accepted' },
          ],
        },
        {
          type: 'category',
          title: 'Belonging & connection',
          children: [
            { type: 'item', title: 'I don’t belong' },
            { type: 'item', title: 'People leave' },
            { type: 'item', title: 'My voice doesn’t matter' },
            { type: 'item', title: 'Conflict means the relationship is ending' },
          ],
        },
      ],
    },
    {
      type: 'category',
      title: 'Follow-up (next steps)',
      children: [
        {
          type: 'category',
          title: 'Support the body',
          children: [
            { type: 'item', title: 'Hydration' },
            { type: 'item', title: 'Sleep routine' },
            { type: 'item', title: 'Nourishment / protein / minerals' },
            { type: 'item', title: 'Gentle movement' },
            { type: 'item', title: 'Reduce overstimulation' },
          ],
        },
        {
          type: 'category',
          title: 'Support the nervous system',
          children: [
            { type: 'item', title: 'Breathing / grounding' },
            { type: 'item', title: 'Time outside' },
            { type: 'item', title: 'Connection / co-regulation' },
            { type: 'item', title: 'Boundaries' },
            { type: 'item', title: 'Rest / simplify schedule' },
          ],
        },
        {
          type: 'category',
          title: 'Session notes',
          children: [
            { type: 'item', title: 'What shifted?' },
            { type: 'item', title: 'What remains?' },
            { type: 'item', title: 'What to check next time?' },
            { type: 'item', title: 'Follow-up date' },
          ],
        },
      ],
    },
  ]
}

async function ensureExpandedStarterChart() {
  const existing = await db.charts.where('name').equals('Expanded Starter Chart').first()
  if (existing) return

  const t = nowIso()
  const chartId = newId()
  await db.charts.add({ id: chartId, name: 'Expanded Starter Chart', createdAt: t, updatedAt: t })
  const nodes = buildNodes({ chartId, startSort: 10, seeds: expandedStarterChartSeeds(), createdAt: t })
  await db.chartNodes.bulkAdd(nodes)
}

async function ensureSessionFlowChart() {
  const existing = await db.charts.where('name').equals('Session Flow Chart').first()
  const t = nowIso()

  if (!existing) {
    const chartId = newId()
    await db.charts.add({ id: chartId, name: 'Session Flow Chart', createdAt: t, updatedAt: t })
    const nodes = buildNodes({ chartId, startSort: 10, seeds: sessionFlowChartSeeds(), createdAt: t })
    await db.chartNodes.bulkAdd(nodes)
    return
  }

  // Additive upgrades: ensure missing nodes exist anywhere in the tree (won't overwrite user edits).
  await ensureChartNodesFromSeeds({ chartId: existing.id, seeds: sessionFlowChartSeeds(), createdAt: t })
}

export async function initDb() {
  // Restorative Pathways–only UI: no seeded charts needed.
  // Keep legacy seed helpers referenced to avoid unused warnings (they do not run).
  void ensureExpandedStarterChart
  void ensureSessionFlowChart
}

