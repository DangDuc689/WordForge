import { callGroq, corsHeaders, json, requireUser } from '../_shared/gemini.ts'

const schema = {
  type: 'OBJECT', properties: {
    title: { type: 'STRING' }, format: { type: 'STRING', enum: ['reading', 'quiz', 'dialogue'] }, passage: { type: 'STRING' }, passageVi: { type: 'STRING' },
    questions: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: { type: 'STRING' }, vocabularyId: { type: ['STRING', 'NULL'] }, prompt: { type: 'STRING' }, choices: { type: 'ARRAY', items: { type: 'STRING' } }, answer: { type: 'STRING' }, explanation: { type: 'STRING' } }, required: ['id', 'vocabularyId', 'prompt', 'choices', 'answer', 'explanation'] } },
  }, required: ['title', 'format', 'passage', 'passageVi', 'questions'],
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { client, user } = await requireUser(request)
    const { deckId, format } = await request.json()
    
    // 1. Fetch learned cards first
    const { data: cards, error: cardsError } = await client.from('srs_cards').select('vocabulary_id,due_at,lapses,reps,memory_level').eq('user_id', user.id)
    if (cardsError) throw cardsError
    const cardMap = new Map((cards ?? []).map((card) => [card.vocabulary_id, card]))
    const learnedIds = Array.from(cardMap.keys())

    // 2. Fetch vocabulary items details for all learned cards
    let learnedWords: any[] = []
    if (learnedIds.length > 0) {
      const learnedQuery = client
        .from('vocabulary_items')
        .select('id,english,vietnamese,example_en,part_of_speech,deck_id')
        .in('id', learnedIds)
        .eq('status', 'active')
      const { data, error } = deckId ? await learnedQuery.eq('deck_id', deckId) : await learnedQuery
      if (error) throw error
      learnedWords = data ?? []
    }

    // 3. Fetch up to 200 active vocabulary items for background words
    const wordQuery = client.from('vocabulary_items').select('id,english,vietnamese,example_en,part_of_speech').eq('user_id', user.id).eq('status', 'active').limit(200)
    const { data: words, error: wordsError } = deckId ? await wordQuery.eq('deck_id', deckId) : await wordQuery
    if (wordsError) throw wordsError
    
    const { data: recentPractices } = await client.from('practice_sessions')
      .select('target_vocabulary_ids')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3)
    
    const recentTargetIds = new Set((recentPractices ?? []).flatMap((p: any) => p.target_vocabulary_ids))

    // 4. Calculate targets from learned words
    const targets = learnedWords.filter((word) => { 
        const card = cardMap.get(word.id); 
        return card && !recentTargetIds.has(word.id) && (card.reps < 2 || card.memory_level <= 2 || new Date(card.due_at) <= new Date());
    })
    
    if (targets.length < 3) {
      const moreTargets = learnedWords.filter((word) => {
        const card = cardMap.get(word.id);
        return card && (card.reps < 2 || card.memory_level <= 2 || new Date(card.due_at) <= new Date());
      });
      for (const t of moreTargets) {
        if (!targets.some(x => x.id === t.id)) targets.push(t);
      }
    }
    
    if (targets.length < 3) {
      for (const t of learnedWords) {
        if (!targets.some(x => x.id === t.id)) targets.push(t);
      }
    }

    const targetGlossary = targets.slice(0, 8)
    const known = (words ?? []).filter((word) => !targetGlossary.some((target) => target.id === word.id)).slice(0, 80)
    
    if (targetGlossary.length < 3) {
      throw new Error('Bạn cần học ít nhất 3 từ trước khi sử dụng tính năng luyện tập AI.')
    }

    const requestedFormat = format === 'dialogue' ? 'dialogue' : 'reading'
    const prompt = `Tạo một bài luyện tiếng Anh cho người Việt A1-B1 bằng JSON. format=${requestedFormat}. Dùng bắt buộc các từ mục tiêu và viết câu tự nhiên, không bịa nghĩa. ${requestedFormat === 'reading' ? 'Tạo passage 90-130 từ, bản dịch Việt và 3 câu hỏi đọc hiểu.' : 'Tạo hội thoại 8-12 lượt nói ngắn. QUAN TRỌNG: mỗi lượt nói trong "passage" bắt buộc phải bắt đầu bằng nhãn "A: " hoặc "B: " và kết thúc bằng một dấu xuống dòng \\n để mỗi lượt nói nằm trên một dòng riêng biệt (Ví dụ: "A: Hello!\\nB: Hi there!\\n"). Bản dịch trong "passageVi" cũng phải được chia dòng tương ứng tương tự bằng dấu xuống dòng \\n.'} Mỗi question phải có vocabularyId đúng với một id mục tiêu hoặc null. Từ mục tiêu: ${JSON.stringify(targetGlossary.map(t => ({id: t.id, english: t.english, vietnamese: t.vietnamese}))) }. Từ đã biết để làm nền: ${JSON.stringify(known.map(k => k.english))}`
    
    const result = await callGroq(prompt, schema)
    
    const validTargetIds = new Set(targetGlossary.map((t) => t.id))
    const questions = (Array.isArray(result.questions) ? result.questions : []).slice(0, 3).map((q: any) => {
      if (q.vocabularyId && !validTargetIds.has(q.vocabularyId)) {
        const mapped = targetGlossary.find(t => q.prompt?.includes(t.english) || q.answer?.includes(t.english) || q.explanation?.includes(t.english))
        return { ...q, vocabularyId: mapped ? mapped.id : null }
      }
      return q
    })

    const glossary = targetGlossary.map((t) => ({ vocabularyId: t.id, english: t.english, vietnamese: t.vietnamese }))

    return json({ ...result, format: requestedFormat, questions, glossary })
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'AI practice thất bại.' }, 500) }
})
