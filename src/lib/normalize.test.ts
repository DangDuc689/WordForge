import { describe, expect, it } from 'vitest'
import { isAcceptedAnswer, normalizeAnswer, isAcceptedVietnameseAnswer } from './normalize'

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

describe('Vietnamese answer normalization', () => {
  it('accepts exact match', () => {
    expect(isAcceptedVietnameseAnswer('có thể', 'có thể')).toBe(true)
  })

  it('accepts match without diacritics', () => {
    expect(isAcceptedVietnameseAnswer('co the', 'có thể')).toBe(true)
    expect(isAcceptedVietnameseAnswer('duoc phep', 'được phép')).toBe(true)
  })

  it('accepts any part separated by comma or semicolon', () => {
    const canonical = 'có thể, được phép; cho phép'
    expect(isAcceptedVietnameseAnswer('có thể', canonical)).toBe(true)
    expect(isAcceptedVietnameseAnswer('được phép', canonical)).toBe(true)
    expect(isAcceptedVietnameseAnswer('cho phép', canonical)).toBe(true)
    // with no diacritics
    expect(isAcceptedVietnameseAnswer('duoc phep', canonical)).toBe(true)
  })

  it('accepts match ignoring parts in parentheses', () => {
    const canonical = 'có thể (khả thi), được phép'
    // Should match exact part
    expect(isAcceptedVietnameseAnswer('có thể (khả thi)', canonical)).toBe(true)
    // Should match part without parenthesis
    expect(isAcceptedVietnameseAnswer('có thể', canonical)).toBe(true)
    expect(isAcceptedVietnameseAnswer('co the', canonical)).toBe(true)
    
    // Should NOT match the word inside parenthesis alone
    expect(isAcceptedVietnameseAnswer('khả thi', canonical)).toBe(false)
  })
})
