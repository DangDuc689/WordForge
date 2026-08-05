import { describe, expect, it } from 'vitest'
import type { AppSnapshot, SrsCard, VocabularyItem } from './types'
import { deduplicateSnapshot, normalizeHeadword } from './vocabulary'

const word = (id: string, english: string, vietnamese: string, partOfSpeech: VocabularyItem['partOfSpeech']): VocabularyItem => ({
  id, userId: 'u', deckId: 'd', english, vietnamese, acceptedAnswers: [], partOfSpeech,
  tier: 1, cefr: 'A1', ipa: '/x/', exampleEn: `Example ${id}`, exampleVi: `Ví dụ ${id}`,
  notes: '', status: 'active', source: 'oxford-3000', sourceKey: `a1:across:${partOfSpeech}:1`,
  createdAt: id, updatedAt: id,
})

const card = (id: string, vocabularyId: string, memoryLevel: SrsCard['memoryLevel'], reps: number): SrsCard => ({
  id, userId: 'u', vocabularyId, memoryLevel, dueAt: '', stability: memoryLevel,
  difficulty: 0, elapsedDays: 0, scheduledDays: 0, learningSteps: 0, reps, lapses: 1,
  state: 0, lastReviewAt: `2026-01-0${memoryLevel}T00:00:00Z`, lastRating: memoryLevel,
  createdAt: '', updatedAt: '',
})

describe('vocabulary headword deduplication', () => {
  it('normalizes casing and whitespace consistently', () => {
    expect(normalizeHeadword('  Across   The  Street ')).toBe('across the street')
  })

  it('merges senses and preserves the strongest progress and references', () => {
    const snapshot: AppSnapshot = {
      profile: { id: 'u', timezone: 'UTC', newWordsPerSession: 10, desiredRetention: 0.9, aiEnabled: false, ttsVoice: 'en-US-EmmaMultilingualNeural', createdAt: '', updatedAt: '' },
      decks: [{ id: 'd', userId: 'u', name: 'A1', description: '', source: 'oxford-3000', sourceKey: 'oxford-3000:a1', createdAt: '', updatedAt: '' }],
      vocabulary: [word('w1', 'across', 'băng qua', 'preposition'), word('w2', ' Across ', 'sang phía bên kia', 'adverb')],
      cards: [card('c1', 'w1', 2, 3), card('c2', 'w2', 5, 7)],
      reviews: [{ id: 'r', userId: 'u', vocabularyId: 'w1', mode: 'review', rating: 2, correct: true, responseMs: 1, usedHint: false, submittedAnswer: '', reviewedAt: '' }],
      gameRuns: [],
      practiceSessions: [{
        id: 'p', userId: 'u', deckId: 'd', format: 'reading', targetVocabularyIds: ['w1', 'w2'],
        content: { title: '', format: 'reading', passage: '', passageVi: '', questions: [{ id: 'q', vocabularyId: 'w1', prompt: '', choices: ['', ''], answer: '', explanation: '' }], glossary: [{ vocabularyId: 'w2', english: 'across', vietnamese: '' }] },
        score: null, createdAt: '',
      }],
    }

    const result = deduplicateSnapshot(snapshot)
    expect(result.merged).toBe(1)
    expect(result.snapshot.vocabulary).toHaveLength(1)
    expect(result.snapshot.vocabulary[0].senses).toHaveLength(2)
    expect(result.snapshot.cards).toHaveLength(1)
    expect(result.snapshot.cards[0]).toMatchObject({ memoryLevel: 5, reps: 10, lapses: 2 })
    const keeperId = result.snapshot.vocabulary[0].id
    expect(result.snapshot.reviews[0].vocabularyId).toBe(keeperId)
    expect(result.snapshot.practiceSessions[0].targetVocabularyIds).toEqual([keeperId])
    expect(result.snapshot.practiceSessions[0].content.questions[0].vocabularyId).toBe(keeperId)
    expect(result.snapshot.practiceSessions[0].content.glossary[0].vocabularyId).toBe(keeperId)
  })
})
