import { callGemini, corsHeaders, json, requireUser } from '../_shared/gemini.ts'

const schema = {
  type: 'OBJECT', properties: {
    english: { type: 'STRING' }, vietnamese: { type: 'STRING' }, acceptedAnswers: { type: 'ARRAY', items: { type: 'STRING' } },
    partOfSpeech: { type: 'STRING', enum: ['noun', 'verb', 'adjective', 'phrase', 'adverb', 'pronoun', 'determiner', 'preposition', 'conjunction', 'interjection', 'numeral', 'modal', 'auxiliary', 'infinitive-marker', 'other'] }, tier: { type: 'INTEGER' }, cefr: { type: 'STRING' }, ipa: { type: 'STRING' },
    exampleEn: { type: 'STRING' }, exampleVi: { type: 'STRING' }, notes: { type: 'STRING' },
  }, required: ['english', 'vietnamese', 'acceptedAnswers', 'partOfSpeech', 'tier', 'cefr', 'ipa', 'exampleEn', 'exampleVi', 'notes'],
}

interface CambridgeData {
  ipaUk: string
  ipaUs: string
  partOfSpeech: string
  definition: string
  example: string
  cefr: string
}

// Fetch và parse Cambridge Dictionary HTML để lấy dữ liệu chuẩn
async function scrapeCambridge(term: string): Promise<CambridgeData | null> {
  try {
    const slug = term.trim().toLowerCase().replace(/\s+/g, '-')
    const url = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(slug)}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://dictionary.cambridge.org/',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const html = await res.text()

    // Parse IPA UK và US
    const ipaMatches = [...html.matchAll(/class="ipa[^"]*"[^>]*>([^<]+)<\/span>/g)]
    const ipaUk = ipaMatches[0]?.[1]?.trim() ?? ''
    const ipaUs = ipaMatches[1]?.[1]?.trim() ?? ''

    // Parse phần từ loại (POS)
    const posMatches = [...html.matchAll(/class="pos dpos"[^>]*>([^<]+)<\/span>/g)]
    const partOfSpeech = posMatches[0]?.[1]?.trim() ?? ''

    // Parse definition tiếng Anh - tìm text trong .def block, loại bỏ tags
    const defMatches = [...html.matchAll(/class="def ddef_d db">([\s\S]*?)<\/div>/g)]
    const definition = defMatches[0]?.[1]?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() ?? ''

    // Parse ví dụ đầu tiên — thử 3 patterns để đảm bảo match dù HTML khác nhau
    const egPattern1 = [...html.matchAll(/class="eg deg">([\s\S]*?)<\/span>/g)]
    const egPattern2 = [...html.matchAll(/class="eg[^"]*">([\s\S]*?)<\/span>/g)]
    const egPattern3 = [...html.matchAll(/class="[^"]*dexamp[^"]*"[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/g)]
    const egRaw = egPattern1[0]?.[1] ?? egPattern2[0]?.[1] ?? egPattern3[0]?.[1] ?? ''
    const example = egRaw.replace(/<[^>]+>/g, '').trim()
    console.log(`[cambridge] term=${term} ipaUk=${ipaUk} example_len=${example.length} example_preview=${example.substring(0,60)}`)

    // Parse CEFR level
    const cefrMatches = [...html.matchAll(/class="[^"]*epp-xref[^"]*">([A-C][12])<\/span>/g)]
    const cefr = cefrMatches[0]?.[1] ?? ''

    // Chỉ trả về nếu parse được ít nhất IPA hoặc definition
    if (!ipaUk && !definition) return null

    return { ipaUk, ipaUs, partOfSpeech, definition, example, cefr }
  } catch {
    // Không throw - cho phép fallback về AI-only
    return null
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { client, user } = await requireUser(request)
    const { term, deckId, cambridgeData: clientCambridgeData } = await request.json()
    if (typeof term !== 'string' || term.trim().length < 1) return json({ error: 'term là bắt buộc.' }, 400)

    // Fetch Cambridge và load user data song song để tiết kiệm thời gian
    const [cambridgeData, wordsResult, cardsResult] = await Promise.all([
      clientCambridgeData ?? scrapeCambridge(term),
      client.from('vocabulary_items').select('id,english,vietnamese').eq('user_id', user.id).eq('status', 'active').limit(500),
      client.from('srs_cards').select('vocabulary_id,reps,memory_level').eq('user_id', user.id),
    ])

    if (wordsResult.error) throw wordsResult.error
    const knownIds = new Set((cardsResult.data ?? []).filter((card) => card.reps >= 2 && card.memory_level >= 2).map((card) => card.vocabulary_id))
    const known = (wordsResult.data ?? []).filter((word) => knownIds.has(word.id)).slice(0, 200)

    // Xây dựng prompt: nếu có Cambridge data thì inject vào làm grounding
    let cambridgeContext = ''
    if (cambridgeData) {
      const lines = [
        cambridgeData.ipaUk && `- IPA (UK): /${cambridgeData.ipaUk}/`,
        cambridgeData.ipaUs && `- IPA (US): /${cambridgeData.ipaUs}/`,
        cambridgeData.partOfSpeech && `- Part of speech: ${cambridgeData.partOfSpeech}`,
        cambridgeData.cefr && `- CEFR level: ${cambridgeData.cefr}`,
        cambridgeData.definition && `- Definition (EN): ${cambridgeData.definition}`,
        cambridgeData.example && `- Example sentence (EN) — BẮT BUỘC dùng câu này làm exampleEn VÀ dịch ĐÚNG câu này làm exampleVi: "${cambridgeData.example}"`,
      ].filter(Boolean)
      if (lines.length > 0) {
        cambridgeContext = `\n\nDữ liệu tra được từ Cambridge Dictionary (nguồn chính xác, ưu tiên tuyệt đối):\n${lines.join('\n')}`
      }
    }

    const prompt = `Bạn là trợ lý học tiếng Anh cho người Việt trình độ A1-B1. Tạo bản nháp cho từ/cụm từ mới: "${term.trim()}".${cambridgeContext}\n\nYêu cầu:\n- Dùng IPA, partOfSpeech, CEFR từ Cambridge (ưu tiên tuyệt đối)\n- Nếu có Example sentence phía trên: exampleEn = câu đó, exampleVi = bản dịch tiếng Việt của ĐÚNG câu đó\n- NẾU KHÔNG CÓ example (hoặc từ Cambridge fetch thất bại): Hãy tạo ra một câu ví dụ tiếng Anh (exampleEn) CỰC KỲ CHUẨN MỰC, TỰ NHIÊN VÀ THỰC TẾ, bắt chước phong cách và chất lượng của từ điển Cambridge/Oxford để làm nổi bật rõ nghĩa của từ. KHÔNG CẦN giới hạn trong các từ đơn giản. Sau đó dịch sang tiếng Việt (exampleVi).\n- vietnamese: nghĩa tiếng Việt ngắn gọn, chuẩn xác\n- acceptedAnswers: chỉ biến thể chính tả/ngữ pháp thật sự tương đương\n- tier 1-3 (1=cơ bản, 3=nâng cao)\nTừ đã biết để tham khảo trình độ: ${JSON.stringify(known.map((word) => `${word.english}=${word.vietnamese}`))}` 

    const draft = await callGemini(prompt, schema)

    // Override cứng IPA từ Cambridge — đây là dữ liệu phonetics chính xác nhất
    const ipaFromCambridge = cambridgeData?.ipaUk ? `/${cambridgeData.ipaUk}/` : undefined

    // CEFR cuối cùng: ưu tiên Cambridge, nếu không có thì lấy của AI sinh ra
    const finalCefr = cambridgeData?.cefr || draft.cefr;

    // Ánh xạ CEFR sang tier để đảm bảo tính nhất quán
    let derivedTier = Math.min(3, Math.max(1, Number(draft.tier) || 1));
    if (finalCefr) {
      if (['A1', 'A2'].includes(finalCefr)) derivedTier = 1;
      else if (['B1', 'B2'].includes(finalCefr)) derivedTier = 2;
      else if (['C1', 'C2'].includes(finalCefr)) derivedTier = 3;
    }

    return json({
      ...draft,
      english: term.trim(),
      tier: derivedTier,
      acceptedAnswers: Array.isArray(draft.acceptedAnswers) ? draft.acceptedAnswers.slice(0, 8) : [],
      // Override dữ liệu từ Cambridge (luôn chính xác hơn AI)
      ...(ipaFromCambridge && { ipa: ipaFromCambridge }),
      ...(cambridgeData?.example && { exampleEn: cambridgeData.example }),
      ...(cambridgeData?.cefr && { cefr: cambridgeData.cefr }),
    })
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'AI enrichment thất bại.' }, 500) }
})

