import { describe, expect, it } from 'vitest'
import type { GameWord } from '../domain/types'
import { buildWordQueue } from './GameEngine'

const words: GameWord[] = ['alpha', 'beta', 'gamma'].map((english, index) => ({ id: String(index), english, vietnamese: `nghia-${index}`, acceptedAnswers: [], category: 'noun', tier: 1, isDue: false }))

describe('buildWordQueue', () => {
  it('schedules every vocabulary item exactly twice', () => {
    const queue = buildWordQueue(words, () => 0.5)
    expect(queue).toHaveLength(words.length * 2)
    for (const word of words) expect(queue.filter((queued) => queued.id === word.id)).toHaveLength(2)
  })
})
