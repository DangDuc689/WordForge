import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const LEVELS = ['A1', 'A2', 'B1', 'B2']
const POS = new Set(['noun', 'verb', 'adjective', 'adverb', 'phrase', 'pronoun', 'determiner', 'preposition', 'conjunction', 'interjection', 'numeral', 'modal', 'auxiliary', 'infinitive-marker', 'other'])
const root = resolve(process.argv[2] ?? 'public/catalog/oxford-3000-us/v1')
const readJson = async (name) => JSON.parse(await readFile(resolve(root, name), 'utf8'))

async function main() {
  const manifest = await readJson('manifest.json')
  if (!manifest.ready) throw new Error(`Catalog chưa sẵn sàng: ${manifest.message || 'không có lý do'}`)
  const sourceKeys = new Set()
  let total = 0
  for (const level of LEVELS) {
    const metadata = manifest.levels.find((item) => item.level === level)
    if (!metadata) throw new Error(`Manifest thiếu ${level}`)
    const catalog = await readJson(metadata.file)
    if (catalog.schemaVersion !== 1 || catalog.level !== level || catalog.variant !== 'en-US') throw new Error(`Metadata ${level} không hợp lệ`)
    if (!Array.isArray(catalog.entries) || catalog.entries.length !== metadata.entryCount) throw new Error(`Số lượng ${level} không khớp manifest`)
    for (const [index, entry] of catalog.entries.entries()) {
      const label = `${level}[${index}]`
      if (!entry.sourceKey || sourceKeys.has(entry.sourceKey)) throw new Error(`${label} có sourceKey thiếu hoặc trùng`)
      sourceKeys.add(entry.sourceKey)
      if (entry.cefr !== level || !POS.has(entry.partOfSpeech)) throw new Error(`${label} có CEFR/từ loại sai`)
      if (entry.tier !== (level === 'A1' ? 1 : level === 'A2' ? 2 : 3)) throw new Error(`${label} có tier sai`)
      for (const field of ['english', 'vietnamese', 'ipa', 'exampleEn', 'exampleVi']) {
        if (typeof entry[field] !== 'string' || !entry[field].trim()) throw new Error(`${label} thiếu ${field}`)
      }
      if (!entry.ipa.startsWith('/') || !entry.ipa.endsWith('/')) throw new Error(`${label} có IPA sai định dạng`)
      if (!Array.isArray(entry.acceptedAnswers) || entry.acceptedAnswers.some((answer) => typeof answer !== 'string' || !answer.trim())) throw new Error(`${label} có acceptedAnswers sai`)
      const normalizedAnswers = entry.acceptedAnswers.map((answer) => answer.trim().toLowerCase())
      if (new Set(normalizedAnswers).size !== normalizedAnswers.length || normalizedAnswers.includes(entry.english.trim().toLowerCase())) throw new Error(`${label} có acceptedAnswers trùng hoặc lặp lại headword`)
      if (/\b(?:noun|verb|adjective|adverb)\.$/i.test(entry.english)) throw new Error(`${label} có headword chứa nhãn từ loại`)
    }
    total += catalog.entries.length
  }
  if (total < 3_000) throw new Error(`Catalog chỉ có ${total} thẻ`)
  console.log(`Catalog hợp lệ: ${total} thẻ, ${sourceKeys.size} sourceKey duy nhất.`)
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
