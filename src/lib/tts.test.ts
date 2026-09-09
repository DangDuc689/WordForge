import { describe, expect, it } from 'vitest'
import { TTS_VOICES, normalizeTtsText, ttsCacheKey } from './tts'

describe('TTS cache identity', () => {
  it('normalizes Unicode and whitespace before generating a cache key', () => {
    expect(normalizeTtsText('  cafe\u0301\n  study  ')).toBe('café study')
    expect(ttsCacheKey('  hello\nworld ', 'en-US-EmmaMultilingualNeural', 'normal'))
      .toBe(ttsCacheKey('hello world', 'en-US-EmmaMultilingualNeural', 'normal'))
  })

  it('separates voice and speed variants', () => {
    const text = 'Hello world'
    expect(ttsCacheKey(text, 'en-US-EmmaMultilingualNeural', 'normal'))
      .not.toBe(ttsCacheKey(text, 'en-US-AriaNeural', 'normal'))
    expect(ttsCacheKey(text, 'en-US-EmmaMultilingualNeural', 'normal'))
      .not.toBe(ttsCacheKey(text, 'en-US-EmmaMultilingualNeural', 'slow'))
  })

  it('exposes the three supported voices in a stable order', () => {
    expect(TTS_VOICES.map((voice) => voice.value)).toEqual([
      'en-US-EmmaMultilingualNeural',
      'en-US-AriaNeural',
      'en-GB-SoniaNeural',
    ])
  })
})

describe('TTS voice localStorage persistence', () => {
  it('returns default voice when localStorage is empty', async () => {
    localStorage.clear()
    const { getStoredTtsVoice } = await import('./tts')
    expect(getStoredTtsVoice()).toBe('en-US-EmmaMultilingualNeural')
  })

  it('persists and retrieves custom voice in localStorage', async () => {
    localStorage.clear()
    const { getStoredTtsVoice, saveStoredTtsVoice, STORAGE_KEY_TTS_VOICE } = await import('./tts')
    saveStoredTtsVoice('en-US-AriaNeural')
    expect(localStorage.getItem(STORAGE_KEY_TTS_VOICE)).toBe('en-US-AriaNeural')
    expect(getStoredTtsVoice()).toBe('en-US-AriaNeural')
  })

  it('supports browser voices in localStorage', async () => {
    localStorage.clear()
    const { getStoredTtsVoice, saveStoredTtsVoice } = await import('./tts')
    saveStoredTtsVoice('browser://Google US English')
    expect(getStoredTtsVoice()).toBe('browser://Google US English')
  })
})
