import { z } from 'zod'
import type { OxfordCatalog } from '../domain/types'

export const OXFORD_LEVELS = ['A1', 'A2', 'B1', 'B2'] as const
export type OxfordLevel = (typeof OXFORD_LEVELS)[number]

const partOfSpeechSchema = z.enum([
  'noun', 'verb', 'adjective', 'adverb', 'phrase', 'pronoun', 'determiner',
  'preposition', 'conjunction', 'interjection', 'numeral', 'modal', 'auxiliary',
  'infinitive-marker', 'other',
])

const entrySchema = z.object({
  sourceKey: z.string().min(1),
  english: z.string().min(1),
  vietnamese: z.string().min(1),
  acceptedAnswers: z.array(z.string()),
  partOfSpeech: partOfSpeechSchema,
  cefr: z.enum(OXFORD_LEVELS),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  ipa: z.string().min(1),
  exampleEn: z.string().min(1),
  exampleVi: z.string().min(1),
  notes: z.string(),
  senses: z.array(z.object({
    sourceKey: z.string().min(1),
    vietnamese: z.string().min(1),
    partOfSpeech: partOfSpeechSchema,
    cefr: z.enum(OXFORD_LEVELS),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    ipa: z.string().min(1),
    exampleEn: z.string().min(1),
    exampleVi: z.string().min(1),
    notes: z.string(),
  })).min(1),
})

const catalogSchema = z.object({
  schemaVersion: z.literal(2),
  catalogVersion: z.string().min(1),
  variant: z.literal('en-US'),
  level: z.enum(OXFORD_LEVELS),
  sourceUrl: z.string().url(),
  generatedAt: z.string().min(1),
  entries: z.array(entrySchema),
})

const manifestSchema = z.object({
  schemaVersion: z.literal(2),
  catalogVersion: z.string().min(1),
  variant: z.literal('en-US'),
  sourceUrl: z.string().url(),
  ready: z.boolean(),
  message: z.string(),
  levels: z.array(z.object({
    level: z.enum(OXFORD_LEVELS),
    entryCount: z.number().int().nonnegative(),
    file: z.string().min(1),
  })),
})

export type OxfordCatalogManifest = z.infer<typeof manifestSchema>

const catalogRoot = '/catalog/oxford-3000-us/v2'

async function fetchJson(path: string): Promise<unknown> {
  const response = await fetch(path, { credentials: 'same-origin' })
  if (!response.ok) throw new Error(`Không thể tải catalog (${response.status}).`)
  return response.json()
}

export async function loadOxfordManifest(): Promise<OxfordCatalogManifest> {
  return manifestSchema.parse(await fetchJson(`${catalogRoot}/manifest.json`))
}

export async function loadOxfordCatalog(level: OxfordLevel): Promise<OxfordCatalog> {
  const parsed = catalogSchema.parse(await fetchJson(`${catalogRoot}/${level.toLowerCase()}.json`))
  if (parsed.level !== level) throw new Error(`Catalog ${level} không khớp cấp độ.`)
  const uniqueKeys = new Set(parsed.entries.map((entry) => entry.sourceKey))
  if (uniqueKeys.size !== parsed.entries.length) throw new Error(`Catalog ${level} có sourceKey trùng.`)
  const headwords = parsed.entries.map((entry) => entry.english.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US'))
  if (new Set(headwords).size !== headwords.length) throw new Error(`Catalog ${level} có headword trùng.`)
  return parsed
}
