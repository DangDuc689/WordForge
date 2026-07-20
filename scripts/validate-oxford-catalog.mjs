import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const LEVELS = ['A1', 'A2', 'B1', 'B2']
const POS = new Set(['noun', 'verb', 'adjective', 'adverb', 'phrase', 'pronoun', 'determiner', 'preposition', 'conjunction', 'interjection', 'numeral', 'modal', 'auxiliary', 'infinitive-marker', 'other'])
const root = resolve(process.argv[2] ?? 'public/catalog/oxford-3000-us/v2')
const readJson = async (name) => JSON.parse(await readFile(resolve(root, name), 'utf8'))

async function main() {
  const manifest = await readJson('manifest.json')
  if (!manifest.ready) throw new Error(`Catalog chưa sẵn sàng: ${manifest.message || 'không có lý do'}`)
  const sourceKeys = new Set()
  const expectedCounts = { A1: 898, A2: 864, B1: 806, B2: 729 }
  let total = 0
  for (const level of LEVELS) {
    const metadata = manifest.levels.find((item) => item.level === level)
    if (!metadata) throw new Error(`Manifest thiếu ${level}`)
    const catalog = await readJson(metadata.file)
    if (catalog.schemaVersion !== 2 || catalog.level !== level || catalog.variant !== 'en-US') throw new Error(`Metadata ${level} không hợp lệ`)
    if (!Array.isArray(catalog.entries) || catalog.entries.length !== metadata.entryCount) throw new Error(`Số lượng ${level} không khớp manifest`)
    if (catalog.entries.length !== expectedCounts[level]) throw new Error(`Số headword ${level} không đúng: ${catalog.entries.length}`)
    const headwords = new Set()
    for (const [index, entry] of catalog.entries.entries()) {
      const label = `${level}[${index}]`
      if (!entry.sourceKey || sourceKeys.has(entry.sourceKey)) throw new Error(`${label} có sourceKey thiếu hoặc trùng`)
      sourceKeys.add(entry.sourceKey)
      const headword = entry.english.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US')
      if (headwords.has(headword)) throw new Error(`${label} có headword trùng: ${entry.english}`)
      headwords.add(headword)
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
      if (!Array.isArray(entry.senses) || !entry.senses.length) throw new Error(`${label} không có sense`)
      for (const sense of entry.senses) {
        if (!sense.sourceKey || sourceKeys.has(sense.sourceKey)) throw new Error(`${label} có sense sourceKey thiếu hoặc trùng`)
        sourceKeys.add(sense.sourceKey)
        if (sense.cefr !== level || !POS.has(sense.partOfSpeech) || !sense.vietnamese?.trim() || !sense.exampleEn?.trim()) throw new Error(`${label} có sense không hợp lệ`)
      }
    }
    total += catalog.entries.length
  }
  if (total !== 3_297) throw new Error(`Catalog có ${total} headword thay vì 3297`)
  console.log(`Catalog hợp lệ: ${total} headword, không trùng trong từng bộ, ${sourceKeys.size} sourceKey duy nhất.`)
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
