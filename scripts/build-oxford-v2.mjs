import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const LEVELS = ['A1', 'A2', 'B1', 'B2']
const inputRoot = resolve(process.argv[2] ?? 'public/catalog/oxford-3000-us/v1')
const outputRoot = resolve(process.argv[3] ?? 'public/catalog/oxford-3000-us/v2')
const normalize = (value) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US')
const slug = (value) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function groupEntries(entries) {
  const groups = new Map()
  for (const entry of entries) {
    const key = normalize(entry.english)
    groups.set(key, [...(groups.get(key) ?? []), entry])
  }
  return [...groups.values()].map((senses) => {
    const primary = senses[0]
    return {
      ...primary,
      sourceKey: `${primary.cefr.toLowerCase()}:${slug(primary.english)}`,
      acceptedAnswers: [...new Set(senses.flatMap((sense) => sense.acceptedAnswers))],
      senses: senses.map((sense) => ({
        sourceKey: sense.sourceKey,
        vietnamese: sense.vietnamese,
        partOfSpeech: sense.partOfSpeech,
        cefr: sense.cefr,
        tier: sense.tier,
        ipa: sense.ipa,
        exampleEn: sense.exampleEn,
        exampleVi: sense.exampleVi,
        notes: sense.notes,
      })),
    }
  })
}

await mkdir(outputRoot, { recursive: true })
const sourceManifest = JSON.parse(await readFile(resolve(inputRoot, 'manifest.json'), 'utf8'))
const levels = []
for (const level of LEVELS) {
  const catalog = JSON.parse(await readFile(resolve(inputRoot, `${level.toLowerCase()}.json`), 'utf8'))
  const entries = groupEntries(catalog.entries)
  const file = `${level.toLowerCase()}.json`
  await writeFile(resolve(outputRoot, file), `${JSON.stringify({ ...catalog, schemaVersion: 2, catalogVersion: 'oxford-3000-us-v2', entries }, null, 2)}\n`, 'utf8')
  levels.push({ level, entryCount: entries.length, file })
}
await writeFile(resolve(outputRoot, 'manifest.json'), `${JSON.stringify({
  ...sourceManifest,
  schemaVersion: 2,
  catalogVersion: 'oxford-3000-us-v2',
  levels,
}, null, 2)}\n`, 'utf8')
console.log(`Đã tạo Oxford v2: ${levels.map((item) => `${item.level}=${item.entryCount}`).join(', ')}`)
