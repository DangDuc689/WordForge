export interface AiModelOption {
  id: string
  name: string
}

export const AI_MODELS: readonly AiModelOption[] = [
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-3-flash', name: 'Gemini 3 Flash' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite (Khuyên dùng)' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash' },
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash' },
] as const

export const DEFAULT_AI_MODEL = 'gemini-3.5-flash-lite'
export const STORAGE_KEY_GEMINI_KEY = 'wordforge_gemini_api_key'
export const STORAGE_KEY_GEMINI_MODEL = 'wordforge_gemini_model'

export function getAiConfig(): { apiKey: string; model: string } {
  const apiKey = (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_GEMINI_KEY) : '') || ''
  const model = (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_GEMINI_MODEL) : '') || DEFAULT_AI_MODEL
  return { apiKey: apiKey.trim(), model }
}

export function saveAiConfig(apiKey: string, model: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY_GEMINI_KEY, apiKey.trim())
  localStorage.setItem(STORAGE_KEY_GEMINI_MODEL, model || DEFAULT_AI_MODEL)
}

export async function testAiKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  const trimmedKey = apiKey.trim()
  if (!trimmedKey) {
    return { ok: false, error: 'Vui lòng nhập API Key trước khi kiểm tra.' }
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(trimmedKey)}`, {
      method: 'GET',
    })

    if (res.ok) {
      return { ok: true }
    }

    const data = await res.json().catch(() => null)
    const errMessage = data?.error?.message

    if (res.status === 400 || res.status === 401 || res.status === 403) {
      return { ok: false, error: 'API Key không hợp lệ hoặc đã bị vô hiệu hóa.' }
    }
    if (res.status === 429) {
      return { ok: false, error: 'API Key đã vượt quá hạn mức (Rate limit/Quota).' }
    }

    return { ok: false, error: errMessage || `Lỗi phản hồi từ Gemini API (Mã lỗi ${res.status}).` }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Không thể kết nối tới máy chủ Google Gemini. Vui lòng kiểm tra mạng.',
    }
  }
}
