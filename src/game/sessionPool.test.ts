import { describe, expect, it } from 'vitest'
import { buildGamePool } from './sessionPool'

describe('game session pool', () => {
  it('prioritizes due words and excludes archived words', () => {
    const vocabulary = [
      { id: 'new', userId: 'u', deckId: 'd', english: 'new', vietnamese: 'mới', acceptedAnswers: [], partOfSpeech: 'noun' as const, tier: 1 as const, cefr: 'A1' as const, ipa: '', exampleEn: '', exampleVi: '', notes: '', status: 'active' as const, source: 'manual' as const, sourceKey: '', createdAt: '', updatedAt: '' },
      { id: 'archived', userId: 'u', deckId: 'd', english: 'old', vietnamese: 'cũ', acceptedAnswers: [], partOfSpeech: 'noun' as const, tier: 1 as const, cefr: 'A1' as const, ipa: '', exampleEn: '', exampleVi: '', notes: '', status: 'archived' as const, source: 'manual' as const, sourceKey: '', createdAt: '', updatedAt: '' },
    ]
    const cards = [{ id: 'c', userId: 'u', vocabularyId: 'new', memoryLevel: 1 as const, dueAt: '2020-01-01T00:00:00Z', stability: 1, difficulty: 5, elapsedDays: 0, scheduledDays: 0, learningSteps: 0, reps: 1, lapses: 0, state: 1 as const, lastReviewAt: null, lastRating: 3 as const, createdAt: '', updatedAt: '' }]
    const pool = buildGamePool(vocabulary, cards, 'd', new Date('2026-07-16T00:00:00Z'))
    expect(pool).toHaveLength(1)
    expect(pool[0].id).toBe('new')
    expect(pool[0].isDue).toBe(true)
    expect(buildGamePool(vocabulary, cards, 'd', new Date('2026-07-16T00:00:00Z'), { source: 'due' })).toHaveLength(1)
    expect(buildGamePool(vocabulary, cards, 'd', new Date('2026-07-16T00:00:00Z'), { source: 'all', selectedIds: ['missing'] })).toHaveLength(0)
  })
})
