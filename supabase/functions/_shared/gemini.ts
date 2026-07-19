import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from './cors.ts'

export async function requireUser(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) throw new Error('Thiếu phiên đăng nhập.')
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('Phiên đăng nhập không hợp lệ.')
  return { client, user: data.user }
}

export async function callGroq(prompt: string, schema: Record<string, unknown>) {
  const key = Deno.env.get('GROQ_API_KEY')
  if (!key) throw new Error('Chưa cấu hình GROQ_API_KEY trong Supabase secrets.')
  const model = Deno.env.get('GROQ_MODEL') || 'openai/gpt-oss-20b'

  // Convert schema format to standard JSON schema (lowercase types) to guide the model
  const schemaStr = JSON.stringify(schema).replace(/"(STRING|INTEGER|NUMBER|BOOLEAN|ARRAY|OBJECT|NULL)"/g, (match) => match.toLowerCase())
  const fullPrompt = `${prompt}\n\nIMPORTANT: You MUST return ONLY valid JSON. The JSON must strictly match the following JSON Schema:\n\n${schemaStr}`

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. You must output ONLY a valid JSON object matching the requested schema. Do not write any introduction, explanation, or markdown formatting (do not use ```json). Start directly with \'{\' and end with \'}\'.'
        },
        { role: 'user', content: fullPrompt }
      ],
      temperature: 0.35,
      response_format: { type: 'json_object' }
    }),
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Groq trả về HTTP ${response.status}: ${errorText}`)
  }
  const payload = await response.json()
  const text = payload.choices?.[0]?.message?.content
  if (!text) throw new Error('Groq không trả về nội dung.')
  
  let cleanText = text.trim()
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  }
  return JSON.parse(cleanText)
}

export { corsHeaders, json }
