import { callGemini, corsHeaders, json, requireUser } from '../_shared/gemini.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  
  try {
    await requireUser(req)
    const { word, meaning, sentence } = await req.json()
    if (!word || !sentence) throw new Error('Thiếu từ vựng hoặc câu cần chấm.')

    const prompt = `Bạn là một giáo viên tiếng Anh tận tâm. Học viên đang học từ vựng "${word}" (Nghĩa tiếng Việt: "${meaning}").
Học viên đã đặt câu sau: "${sentence}".

Hãy kiểm tra xem câu này có đúng ngữ pháp tiếng Anh cơ bản không, và từ "${word}" có được sử dụng đúng ngữ cảnh và đúng từ loại không.
Hãy khích lệ học viên nếu họ làm tốt. Nếu sai, hãy sửa lỗi thật nhẹ nhàng.

Yêu cầu trả về JSON có các trường:
- isCorrect: boolean (true nếu câu chấp nhận được, false nếu sai ngữ pháp nặng hoặc sai hoàn toàn ngữ cảnh/nghĩa của từ).
- feedback: string (giải thích ngắn gọn gọn bằng tiếng Việt, dưới 2-3 câu).
- correctedSentence: string (câu được sửa lại cho chuẩn tự nhiên, hoặc trả về câu ban đầu nếu đã chuẩn).`

    const schema = {
      type: "OBJECT",
      properties: {
        isCorrect: { type: "BOOLEAN" },
        feedback: { type: "STRING" },
        correctedSentence: { type: "STRING" }
      },
      required: ["isCorrect", "feedback", "correctedSentence"]
    }

    const result = await callGemini(prompt, schema)
    return json(result)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Lỗi nội bộ'
    return json({ error }, 400)
  }
})
