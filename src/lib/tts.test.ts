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
