import { describe, expect, it } from 'vitest'
import { aggregateGameOutcomes, createSrsCard, memoryLevelInfo, nextMemoryLevel, ratingFromGameOutcome, scheduleReview } from './srs'

describe('six-level memory schedule', () => {
  it('creates a new card at level 1 due in two hours', () => {
    const now = new Date('2026-07-16T00:00:00Z')
    const card = createSrsCard('u', 'v', now)
    expect(card.memoryLevel).toBe(1)
    expect(card.dueAt).toBe('2026-07-16T02:00:00.000Z')
  })

  it('advances through all levels using the fixed intervals', () => {
    const now = new Date('2026-07-16T00:00:00Z')
    let card = createSrsCard('u', 'v', now)
    for (const level of [2, 3, 4, 5, 6] as const) {
      card = scheduleReview({ card, mode: 'learn', correct: true, now }).card
      expect(card.memoryLevel).toBe(level)
      expect(card.dueAt).toBe(new Date(now.getTime() + memoryLevelInfo(level).delayMs).toISOString())
    }
  })

  it('moves down one level on an incorrect answer without going below level 1', () => {
    const now = new Date('2026-07-16T00:00:00Z')
    let card = createSrsCard('u', 'v', now)
    for (let i = 0; i < 5; i++) card = scheduleReview({ card, mode: 'review', correct: true, now }).card
    expect(card.memoryLevel).toBe(6)
    card = scheduleReview({ card, mode: 'review', correct: false, now }).card
    expect(card.memoryLevel).toBe(5)
    card = createSrsCard('u', 'v', now)
    expect(scheduleReview({ card, mode: 'review', correct: false, now }).card.memoryLevel).toBe(1)
  })

  it('maps game completion to correct/incorrect and aggregates appearances', () => {
    expect(ratingFromGameOutcome({ vocabularyId: 'a', terminal: 'killed', responseMs: 1000, usedHint: false, hadTargetMistake: false })).toBe(true)
    expect(ratingFromGameOutcome({ vocabularyId: 'a', terminal: 'breached', responseMs: 3000, usedHint: false, hadTargetMistake: false })).toBe(false)
    expect(nextMemoryLevel({ memoryLevel: 6 } as never, true)).toBe(6)
    const result = aggregateGameOutcomes([
      { vocabularyId: 'a', terminal: 'killed', responseMs: 1000, usedHint: false, hadTargetMistake: false },
      { vocabularyId: 'a', terminal: 'killed', responseMs: 9000, usedHint: false, hadTargetMistake: true },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].responseMs).toBe(9000)
  })
})
