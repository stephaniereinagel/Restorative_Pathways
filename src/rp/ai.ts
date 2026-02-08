import { db } from '../db'

const KV_AI_API_KEY = 'ai.openai.apiKey'
const KV_AI_MODEL = 'ai.openai.model'

export type AiConfig = {
  apiKey: string | null
  model: string | null
}

export async function getAiConfig(): Promise<AiConfig> {
  const [k, m] = await Promise.all([db.kv.get(KV_AI_API_KEY), db.kv.get(KV_AI_MODEL)])
  return { apiKey: k?.value ?? null, model: m?.value ?? null }
}

export async function setAiConfig(args: { apiKey: string | null; model: string | null }) {
  const t = new Date().toISOString()
  await db.transaction('rw', db.kv, async () => {
    if (args.apiKey && args.apiKey.trim()) await db.kv.put({ key: KV_AI_API_KEY, value: args.apiKey.trim(), updatedAt: t })
    else await db.kv.delete(KV_AI_API_KEY)

    if (args.model && args.model.trim()) await db.kv.put({ key: KV_AI_MODEL, value: args.model.trim(), updatedAt: t })
    else await db.kv.delete(KV_AI_MODEL)
  })
}

