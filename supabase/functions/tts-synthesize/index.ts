import { UniversalEdgeTTS } from 'edge-tts-universal'
import { createClient } from 'supabase'
import { corsHeaders, json, requireUser } from '../_shared/gemini.ts'

const BUCKET = 'tts-cache'
const MAX_TEXT_LENGTH = 500
const VOICES = new Set([
  'en-US-EmmaMultilingualNeural',
  'en-US-AriaNeural',
  'en-GB-SoniaNeural',
])
const EDGE_VOICE_NAMES: Record<string, string> = {
  'en-US-EmmaMultilingualNeural': 'Microsoft Server Speech Text to Speech Voice (en-US, EmmaMultilingualNeural)',
  'en-US-AriaNeural': 'Microsoft Server Speech Text to Speech Voice (en-US, AriaNeural)',
  'en-GB-SoniaNeural': 'Microsoft Server Speech Text to Speech Voice (en-GB, SoniaNeural)',
}
const RATES = new Set(['-10%', '-25%'])

function getAdminClient() {
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS')
  let key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, string>
      key = parsed.default || key
    } catch {
      // Fall back to the legacy secret below for local/older Supabase runtimes.
    }
  }
  if (!key) throw new Error('Thiếu secret key cho Supabase Storage.')
  return createClient(Deno.env.get('SUPABASE_URL')!, key)
}

function normalizeText(value: string) {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ')
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function cachePath(text: string, voice: string, rate: string) {
  const rateKey = rate === '-25%' ? 'slow-25' : 'normal-10'
  // v2 avoids reusing files generated before the canonical voice-name fix.
  return `v2/${voice}/${rateKey}/${await sha256(text)}.mp3`
}

async function objectExists(admin: ReturnType<typeof getAdminClient>, path: string) {
  const slash = path.lastIndexOf('/')
  const prefix = path.slice(0, slash)
  const filename = path.slice(slash + 1)
  const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 10, search: filename })
  if (error) throw error
  return (data ?? []).some((item) => item.name === filename)
}

function publicUrl(path: string) {
  const base = Deno.env.get('SUPABASE_URL')!
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Chỉ hỗ trợ POST.' }, 405)

  try {
    await requireUser(request)
    const body = await request.json() as { text?: unknown; voice?: unknown; rate?: unknown }
    const text = typeof body.text === 'string' ? normalizeText(body.text) : ''
    const voice = typeof body.voice === 'string' ? body.voice : ''
    const rate = typeof body.rate === 'string' ? body.rate : '-10%'

    if (!text || text.length > MAX_TEXT_LENGTH) return json({ error: `text phải dài từ 1 đến ${MAX_TEXT_LENGTH} ký tự.` }, 400)
    if (!VOICES.has(voice)) return json({ error: 'Giọng đọc không được hỗ trợ.' }, 400)
    if (!RATES.has(rate)) return json({ error: 'Tốc độ đọc không được hỗ trợ.' }, 400)

    const path = await cachePath(text, voice, rate)
    const admin = getAdminClient()
    if (await objectExists(admin, path)) return json({ url: publicUrl(path), cacheHit: true })

    // Use the canonical SSML voice name.  The short-name parser changed between
    // edge-tts-universal releases; the full name is accepted consistently by
    // both the Node/Deno and isomorphic implementations.
    const tts = new UniversalEdgeTTS(text, EDGE_VOICE_NAMES[voice], { rate, volume: '+0%', pitch: '+0Hz' })
    const result = await tts.synthesize()
    const audio = new Uint8Array(await result.audio.arrayBuffer())
    if (!audio.length) throw new Error('TTS không trả về audio.')

    const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, audio, {
      contentType: 'audio/mpeg',
      cacheControl: '31536000',
      upsert: false,
    })
    if (uploadError && !(await objectExists(admin, path))) throw uploadError
    return json({ url: publicUrl(path), cacheHit: Boolean(uploadError) })
  } catch (error) {
    console.error('tts-synthesize failed', error)
    return json({ error: error instanceof Error ? error.message : 'TTS hiện không khả dụng.' }, 502)
  }
})
