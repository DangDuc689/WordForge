import { callGemini, corsHeaders, json, requireUser } from '../_shared/gemini.ts'

const schema = {
  type: 'OBJECT', properties: {
    title: { type: 'STRING' }, format: { type: 'STRING', enum: ['reading', 'quiz'] }, passage: { type: 'STRING' }, passageVi: { type: 'STRING' },
    questions: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: { type: 'STRING' }, vocabularyId: { type: ['STRING', 'NULL'] }, prompt: { type: 'STRING' }, choices: { type: 'ARRAY', items: { type: 'STRING' } }, answer: { type: 'STRING' }, explanation: { type: 'STRING' } }, required: ['id', 'vocabularyId', 'prompt', 'choices', 'answer', 'explanation'] } },
  }, required: ['title', 'format', 'passage', 'passageVi', 'questions'],
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { client, user } = await requireUser(request)
    const { deckId, format } = await request.json()
    const wordQuery = client.from('vocabulary_items').select('id,english,vietnamese,example_en,part_of_speech').eq('user_id', user.id).eq('status', 'active').limit(200)
    const { data: words, error } = deckId ? await wordQuery.eq('deck_id', deckId) : await wordQuery
    if (error) throw error
    const { data: cards } = await client.from('srs_cards').select('vocabulary_id,due_at,lapses,reps,memory_level').eq('user_id', user.id)
    const cardMap = new Map((cards ?? []).map((card) => [card.vocabulary_id, card]))
    const targets = (words ?? []).filter((word) => { const card = cardMap.get(word.id); return !card || card.reps < 2 || card.memory_level <= 2 || new Date(card.due_at) <= new Date() }).slice(0, 10)
    const known = (words ?? []).filter((word) => !targets.some((target) => target.id === word.id)).slice(0, 80)
    const requestedFormat = format === 'quiz' ? 'quiz' : 'reading'
    const prompt = `Tạo một bài luyện tiếng Anh cho người Việt A1-B1 bằng JSON. format=${requestedFormat}. Dùng bắt buộc các từ mục tiêu và viết câu tự nhiên, không bịa nghĩa. ${requestedFormat === 'reading' ? 'Tạo passage 90-130 từ, bản dịch Việt và 4 câu hỏi.' : 'Tạo 5 câu hỏi trắc nghiệm ngữ cảnh, mỗi câu 4 lựa chọn.'} Mỗi question phải có vocabularyId đúng với một id mục tiêu hoặc null. Từ mục tiêu: ${JSON.stringify(targets)}. Từ đã biết để làm nền: ${JSON.stringify(known)}`
    const result = await callGemini(prompt, schema)
    return json({ ...result, format: requestedFormat, questions: Array.isArray(result.questions) ? result.questions.slice(0, 6) : [] })
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'AI practice thất bại.' }, 500) }
})
