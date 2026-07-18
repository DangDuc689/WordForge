import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'

const LEVELS = ['A1', 'A2', 'B1', 'B2']
const SOURCE_URL = 'https://www.oxfordlearnersdictionaries.com/external/pdf/wordlists/oxford-3000-5000/American_Oxford_3000_by_CEFR_level.pdf'
const CATALOG_VERSION = 'oxford-3000-us-v1'
const DEFAULT_OUTPUT = 'public/catalog/oxford-3000-us/v1'

const tokenPattern = '(?:modal v\\.|auxiliary v\\.|infinitive marker|indefinite article|definite article|number|n\\.|v\\.|v|adj\\.|adv\\.|prep\\.|pron\\.|det\\.|conj\\.|exclam\\.)'
const labelsPattern = new RegExp(`\\s+(${tokenPattern}(?:(?:\\s*,\\s*|\\s*\\/\\s*)${tokenPattern})*)$`)
const singleLabelPattern = new RegExp(tokenPattern, 'g')

const posMap = new Map([
  ['n.', 'noun'], ['v.', 'verb'], ['adj.', 'adjective'], ['adv.', 'adverb'],
  ['prep.', 'preposition'], ['pron.', 'pronoun'], ['det.', 'determiner'],
  ['conj.', 'conjunction'], ['exclam.', 'interjection'], ['number', 'numeral'],
  ['modal v.', 'modal'], ['auxiliary v.', 'auxiliary'],
  ['infinitive marker', 'infinitive-marker'], ['indefinite article', 'determiner'],
  ['definite article', 'determiner'], ['v', 'verb'],
])

const tierFor = (level) => level === 'A1' ? 1 : level === 'A2' ? 2 : 3
const slug = (value) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const sleep = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds))

function parseSource(text) {
  const entries = []
  const unmatched = []
  const occurrence = new Map()
  let level = null
  const lines = text.split(/\r?\n/)
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    let line = lines[lineIndex].replace(/\s+/g, ' ').trim()
    if (!line || line.startsWith('© Oxford University Press') || line.startsWith('The Oxford 3000') || line === '(American English)') continue
    if (LEVELS.includes(line)) { level = line; continue }
    if (!level) continue
    let match = line.match(labelsPattern)
    if (!match && lineIndex + 1 < lines.length) {
      const continuation = lines[lineIndex + 1].replace(/\s+/g, ' ').trim()
      if (new RegExp(`^${tokenPattern}(?:(?:\\s*,\\s*|\\s*\\/\\s*)${tokenPattern})*$`).test(continuation)) {
        line = `${line} ${continuation}`
        lineIndex += 1
        match = line.match(labelsPattern)
      }
    }
    if (!match) { unmatched.push(line); continue }
    const rawHeadword = line.slice(0, match.index).trim()
    const senseMatch = rawHeadword.match(/\s+\(([^)]+)\)$/)
    const senseHint = senseMatch?.[1] ?? ''
    const withoutSense = senseMatch ? rawHeadword.slice(0, senseMatch.index).trim() : rawHeadword
    const rawForms = withoutSense.split(/\s*,\s*/)
    const english = rawForms[0].replace(/(?<=\p{L})[12]$/u, '').trim()
    const seedAliases = rawForms.slice(1).map((form) => form.replace(/(?<=\p{L})[12]$/u, '').trim()).filter(Boolean)
    const labels = [...match[1].matchAll(singleLabelPattern)].map((item) => item[0])
    for (const label of labels) {
      const partOfSpeech = posMap.get(label) ?? 'other'
      const baseKey = `${level.toLowerCase()}:${slug(english)}:${partOfSpeech}`
      const index = (occurrence.get(baseKey) ?? 0) + 1
      occurrence.set(baseKey, index)
      entries.push({
        sourceKey: `${baseKey}:${index}`,
        english,
        seedAliases,
        partOfSpeech,
        cefr: level,
        tier: tierFor(level),
        senseHint,
        rawLine: line,
      })
    }
  }
  if (unmatched.length) throw new Error(`Không phân tích được ${unmatched.length} dòng:\n${unmatched.slice(0, 20).join('\n')}`)
  if (entries.length < 3_000) throw new Error(`Parser chỉ tạo ${entries.length} thẻ; nguồn có thể sai định dạng.`)
  return entries
}

async function callGemini(batch, apiKey, model) {
  const requested = batch.map(({ sourceKey, english, partOfSpeech, cefr, senseHint, seedAliases }) => ({ sourceKey, english, partOfSpeech, cefr, senseHint, seedAliases }))
  const prompt = `Bạn đang biên soạn flashcard tiếng Anh cho người Việt luyện TOEIC. Với từng mục đầu vào, hãy tự viết nội dung, không chép định nghĩa hoặc câu ví dụ của Oxford hay từ điển khác. Dùng tiếng Anh-Mỹ và ví dụ công việc/đời sống phù hợp TOEIC khi tự nhiên. Nghĩa Việt phải ngắn, đúng từ loại và đúng senseHint. IPA là IPA Mỹ trong dấu /. acceptedAnswers chỉ gồm chính tả Anh-Anh hoặc dạng song song có trong seedAliases, tuyệt đối không thêm từ đồng nghĩa. Trả đủ đúng một kết quả cho mỗi sourceKey. notes chỉ ghi chú phân biệt nghĩa thật sự cần thiết. Đầu vào: ${JSON.stringify(requested)}`
  const itemSchema = {
    type: 'OBJECT',
    properties: {
      sourceKey: { type: 'STRING' }, vietnamese: { type: 'STRING' }, ipa: { type: 'STRING' },
      exampleEn: { type: 'STRING' }, exampleVi: { type: 'STRING' },
      acceptedAnswers: { type: 'ARRAY', items: { type: 'STRING' } }, notes: { type: 'STRING' },
    },
    required: ['sourceKey', 'vietnamese', 'ipa', 'exampleEn', 'exampleVi', 'acceptedAnswers', 'notes'],
  }
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: { type: 'ARRAY', items: itemSchema }, temperature: 0.2 },
    }),
  })
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`)
  const payload = await response.json()
  const content = payload.candidates?.[0]?.content?.parts?.[0]?.text
  if (!content) throw new Error('Gemini không trả nội dung.')
  return JSON.parse(content)
}

async function withRetry(action) {
  let lastError
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try { return await action() } catch (error) {
      lastError = error
      if (attempt < 5) await sleep(attempt * attempt * 2_000)
    }
  }
  throw lastError
}

function validateEnrichment(sourceBatch, results) {
  if (!Array.isArray(results) || results.length !== sourceBatch.length) throw new Error('Gemini trả sai số lượng mục.')
  const resultMap = new Map(results.map((item) => [item.sourceKey, item]))
  return sourceBatch.map((source) => {
    const result = resultMap.get(source.sourceKey)
    if (!result) throw new Error(`Thiếu kết quả ${source.sourceKey}`)
    for (const key of ['vietnamese', 'ipa', 'exampleEn', 'exampleVi']) {
      if (typeof result[key] !== 'string' || !result[key].trim()) throw new Error(`${source.sourceKey} thiếu ${key}`)
    }
    const aliases = [...new Set([...(source.seedAliases ?? []), ...(Array.isArray(result.acceptedAnswers) ? result.acceptedAnswers : [])].map((item) => String(item).trim()).filter(Boolean))]
    return {
      sourceKey: source.sourceKey, english: source.english, vietnamese: result.vietnamese.trim(),
      acceptedAnswers: aliases, partOfSpeech: source.partOfSpeech, cefr: source.cefr, tier: source.tier,
      ipa: result.ipa.trim(), exampleEn: result.exampleEn.trim(), exampleVi: result.exampleVi.trim(),
      notes: String(result.notes ?? '').trim(),
    }
  })
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporary, path)
}

async function main() {
  const inputPath = process.argv[2]
  const outputRoot = resolve(process.argv[3] ?? DEFAULT_OUTPUT)
  if (!inputPath) throw new Error('Cách dùng: node scripts/generate-oxford-catalog.mjs <oxford.txt> [output-directory] [--parse-only]')
  const sourceEntries = parseSource(await readFile(resolve(inputPath), 'utf8'))
  const counts = Object.fromEntries(LEVELS.map((level) => [level, sourceEntries.filter((entry) => entry.cefr === level).length]))
  console.log(`Đã phân tích ${sourceEntries.length} thẻ: ${JSON.stringify(counts)}`)
  if (process.argv.includes('--parse-only')) return

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('Thiếu GEMINI_API_KEY. Khóa chỉ cần cho bước sinh catalog và không được dùng biến VITE_*.')
  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite'
  const progressPath = resolve(outputRoot, '.generation-progress.json')
  let progress = {}
  try { progress = JSON.parse(await readFile(progressPath, 'utf8')) } catch { /* first run */ }
  const batchSize = 20

  for (let offset = 0; offset < sourceEntries.length; offset += batchSize) {
    const batch = sourceEntries.slice(offset, offset + batchSize)
    const missing = batch.filter((entry) => !progress[entry.sourceKey])
    if (missing.length) {
      const results = await withRetry(() => callGemini(missing, apiKey, model))
      const validated = validateEnrichment(missing, results)
      for (const entry of validated) progress[entry.sourceKey] = entry
      await writeJsonAtomic(progressPath, progress)
    }
    console.log(`${Math.min(offset + batchSize, sourceEntries.length)}/${sourceEntries.length}`)
  }

  const generatedAt = new Date().toISOString()
  for (const level of LEVELS) {
    const entries = sourceEntries.filter((entry) => entry.cefr === level).map((entry) => progress[entry.sourceKey])
    if (entries.some((entry) => !entry)) throw new Error(`Catalog ${level} chưa đủ dữ liệu.`)
    await writeJsonAtomic(resolve(outputRoot, `${level.toLowerCase()}.json`), {
      schemaVersion: 1, catalogVersion: CATALOG_VERSION, variant: 'en-US', level,
      sourceUrl: SOURCE_URL, generatedAt, entries,
    })
  }
  await writeJsonAtomic(resolve(outputRoot, 'manifest.json'), {
    schemaVersion: 1, catalogVersion: CATALOG_VERSION, variant: 'en-US', sourceUrl: SOURCE_URL,
    ready: true, message: '',
    levels: LEVELS.map((level) => ({ level, entryCount: counts[level], file: `${level.toLowerCase()}.json` })),
  })
  console.log(`Catalog hoàn tất tại ${outputRoot}. File nguồn: ${basename(inputPath)}`)
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
