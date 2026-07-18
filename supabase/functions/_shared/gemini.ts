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

export async function callGemini(prompt: string, schema: Record<string, unknown>) {
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) throw new Error('Chưa cấu hình GEMINI_API_KEY trong Supabase secrets.')
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-3.1-flash-lite'
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: .35 } }),
  })
  if (!response.ok) throw new Error(`Gemini trả về HTTP ${response.status}.`)
  const payload = await response.json()
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini không trả về nội dung.')
  return JSON.parse(text)
}

export { corsHeaders, json }
