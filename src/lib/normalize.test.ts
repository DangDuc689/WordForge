import { describe, expect, it } from 'vitest'
import { isAcceptedAnswer, normalizeAnswer } from './normalize'

describe('answer normalization', () => {
  it('normalizes case, whitespace and final punctuation', () => {
    expect(normalizeAnswer('  Good   Morning! ')).toBe('good morning')
  })
  it('accepts canonical and explicit aliases only', () => {
    expect(isAcceptedAnswer(' organiser ', 'organizer', ['organiser'])).toBe(true)
    expect(isAcceptedAnswer('arrange', 'organizer', ['organiser'])).toBe(false)
  })
  it('accepts case-insensitive answers', () => {
    expect(isAcceptedAnswer('monday', 'Monday')).toBe(true)
    expect(isAcceptedAnswer('Monday', 'monday')).toBe(true)
  })
})
