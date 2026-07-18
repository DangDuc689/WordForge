import { callGemini, corsHeaders, json, requireUser } from '../_shared/gemini.ts'

const schema = {
  type: 'OBJECT', properties: {
    english: { type: 'STRING' }, vietnamese: { type: 'STRING' }, acceptedAnswers: { type: 'ARRAY', items: { type: 'STRING' } },
    partOfSpeech: { type: 'STRING', enum: ['noun', 'verb', 'adjective', 'phrase', 'adverb', 'pronoun', 'determiner', 'preposition', 'conjunction', 'interjection', 'numeral', 'modal', 'auxiliary', 'infinitive-marker', 'other'] }, tier: { type: 'INTEGER' }, cefr: { type: 'STRING' }, ipa: { type: 'STRING' },
    exampleEn: { type: 'STRING' }, exampleVi: { type: 'STRING' }, notes: { type: 'STRING' },
  }, required: ['english', 'vietnamese', 'acceptedAnswers', 'partOfSpeech', 'tier', 'cefr', 'ipa', 'exampleEn', 'exampleVi', 'notes'],
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { client, user } = await requireUser(request)
    const { term, deckId } = await request.json()
    if (typeof term !== 'string' || term.trim().length < 1) return json({ error: 'term là bắt buộc.' }, 400)
    const { data: words, error } = await client.from('vocabulary_items').select('id,english,vietnamese').eq('user_id', user.id).eq('status', 'active').limit(200)
    if (error) throw error
    const { data: cards } = await client.from('srs_cards').select('vocabulary_id,reps,memory_level').eq('user_id', user.id)
    const knownIds = new Set((cards ?? []).filter((card) => card.reps >= 2 && card.memory_level >= 2).map((card) => card.vocabulary_id))
    const known = (words ?? []).filter((word) => knownIds.has(word.id)).slice(0, 80)
    const prompt = `Bạn là trợ lý học tiếng Anh cho người Việt trình độ A1-B1. Tạo bản nháp cho từ/cụm từ mới: "${term.trim()}". Chỉ dùng danh sách từ người học đã biết bên dưới để viết ví dụ đơn giản; không suy đoán trình độ tổng quát. Trả JSON đúng schema, tiếng Việt tự nhiên, tier 1-3 và CEFR chỉ là nhãn tham khảo. acceptedAnswers chỉ thêm biến thể chính tả/ngữ pháp thật sự tương đương, không thêm từ đồng nghĩa. Từ đã biết: ${JSON.stringify(known.map((word) => `${word.english}=${word.vietnamese}`))}`
    const draft = await callGemini(prompt, schema)
    return json({ ...draft, english: term.trim(), tier: Math.min(3, Math.max(1, Number(draft.tier) || 1)), acceptedAnswers: Array.isArray(draft.acceptedAnswers) ? draft.acceptedAnswers.slice(0, 5) : [] })
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'AI enrichment thất bại.' }, 500) }
})
