import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AI_MODELS,
  DEFAULT_AI_MODEL,
  STORAGE_KEY_GEMINI_KEY,
  STORAGE_KEY_GEMINI_MODEL,
  getAiConfig,
  saveAiConfig,
  testAiKey,
} from './aiSettings'

describe('aiSettings (BYOK)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('exposes exactly the 9 required Gemini models with clean labels', () => {
    expect(AI_MODELS.length).toBe(9)
    const ids = AI_MODELS.map((m) => m.id)
    expect(ids).toEqual([
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-3-flash',
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-3.8-flash',
    ])

    // Verify none of the labels contain quota metrics (RPM, TPM, RPD)
    for (const model of AI_MODELS) {
      expect(model.name).not.toMatch(/RPM|TPM|RPD/i)
    }
  })

  it('provides default fallback values when localStorage is empty', () => {
    const config = getAiConfig()
    expect(config.apiKey).toBe('')
    expect(config.model).toBe(DEFAULT_AI_MODEL)
  })

  it('persists and retrieves custom apiKey and model in localStorage', () => {
    saveAiConfig('AIzaSyCustomKey123', 'gemini-3.8-flash')
    expect(localStorage.getItem(STORAGE_KEY_GEMINI_KEY)).toBe('AIzaSyCustomKey123')
    expect(localStorage.getItem(STORAGE_KEY_GEMINI_MODEL)).toBe('gemini-3.8-flash')

    const config = getAiConfig()
    expect(config.apiKey).toBe('AIzaSyCustomKey123')
    expect(config.model).toBe('gemini-3.8-flash')
  })

  it('validates empty key in testAiKey without calling network', async () => {
    const result = await testAiKey('   ')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Vui lòng nhập API Key')
  })

  it('handles valid API key response in testAiKey', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ models: [] }),
    } as Response)

    const result = await testAiKey('AIzaSyValidKey')
    expect(result.ok).toBe(true)
  })

  it('handles 400/401 invalid key in testAiKey', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'API key not valid' } }),
    } as Response)

    const result = await testAiKey('AIzaSyBadKey')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('không hợp lệ')
  })
})
