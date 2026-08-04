import { beforeEach, describe, expect, it } from 'vitest'
import { LocalRepository } from './repository'

const storageKey = 'vocab-siege.snapshot.v1'

describe('legacy backup compatibility', () => {
  beforeEach(() => localStorage.clear())

  it('maps old FSRS ratings to six-level memory data when loading', async () => {
    localStorage.setItem(storageKey, JSON.stringify({
      profile: { id: 'u', timezone: 'UTC', newWordsPerSession: 10, desiredRetention: 0.9, aiEnabled: false, createdAt: '', updatedAt: '' },
      decks: [], vocabulary: [], gameRuns: [], practiceSessions: [],
      cards: [{ id: 'c', userId: 'u', vocabularyId: 'v', dueAt: '', stability: 1, difficulty: 1, elapsedDays: 0, scheduledDays: 1, learningSteps: 0, reps: 2, lapses: 0, state: 2, lastReviewAt: '', lastRating: 4, createdAt: '', updatedAt: '' }],
      reviews: [{ id: 'r', userId: 'u', vocabularyId: 'v', mode: 'review', rating: 4, correct: true, responseMs: 1, usedHint: false, submittedAnswer: '', reviewedAt: '' }],
    }))

    const snapshot = await new LocalRepository().load()
    expect(snapshot?.cards[0].memoryLevel).toBe(6)
    expect(snapshot?.cards[0].lastRating).toBe(6)
    expect(snapshot?.reviews[0].rating).toBe(6)
  })

  it('normalizes source metadata and saves vocabulary in one local batch', async () => {
    localStorage.setItem(storageKey, JSON.stringify({
      profile: { id: 'u', timezone: 'UTC', newWordsPerSession: 10, desiredRetention: 0.9, aiEnabled: false, createdAt: '', updatedAt: '' },
      decks: [{ id: 'd', userId: 'u', name: 'Oxford 3000 · A1', description: '', createdAt: '', updatedAt: '' }],
      vocabulary: [], cards: [], reviews: [], gameRuns: [], practiceSessions: [],
    }))

    const repository = new LocalRepository()
    await repository.saveWords([
      { id: 'w1', userId: 'u', deckId: 'd', english: 'about', vietnamese: 'về', acceptedAnswers: [], partOfSpeech: 'preposition', tier: 1, cefr: 'A1', ipa: '/əˈbaʊt/', exampleEn: 'It is about work.', exampleVi: 'Đó là về công việc.', notes: '', status: 'active', source: 'oxford-3000', sourceKey: 'a1:about:preposition:1', createdAt: '', updatedAt: '' },
      { id: 'w2', userId: 'u', deckId: 'd', english: 'about', vietnamese: 'khoảng', acceptedAnswers: [], partOfSpeech: 'adverb', tier: 1, cefr: 'A1', ipa: '/əˈbaʊt/', exampleEn: 'About ten people came.', exampleVi: 'Khoảng mười người đã đến.', notes: '', status: 'active', source: 'oxford-3000', sourceKey: 'a1:about:adverb:1', createdAt: '', updatedAt: '' },
    ])
    const snapshot = await repository.load()
    expect(snapshot?.decks[0].source).toBe('manual')
    expect(snapshot?.vocabulary).toHaveLength(1)
    expect(snapshot?.vocabulary[0].sourceKey).toContain('about')
    expect(snapshot?.vocabulary[0].senses).toHaveLength(2)
    expect(snapshot?.vocabulary[0].senses?.map((sense) => sense.partOfSpeech)).toEqual(['preposition', 'adverb'])
  })

  it('saves and loads a learn session correctly from LocalRepository', async () => {
    const repository = new LocalRepository()
    const session = {
      userId: 'u123',
      selectedDeckId: 'deck-xyz',
      queueIds: ['w1', 'w2'],
      deferredIds: ['w3'],
      status: 'active' as const,
      updatedAt: '2026-07-19T00:00:00Z'
    }

    await repository.saveLearnSession(session)
    const loaded = await repository.loadLearnSession('u123')
    
    expect(loaded).toEqual(session)

    // Check it isolates by userId
    const otherLoaded = await repository.loadLearnSession('u456')
    expect(otherLoaded).toBeNull()
  })

  it('upserts game runs and reviews safely to prevent duplication on retry', async () => {
    localStorage.setItem(storageKey, JSON.stringify({
      profile: { id: 'u', timezone: 'UTC', newWordsPerSession: 10, desiredRetention: 0.9, aiEnabled: false, createdAt: '', updatedAt: '' },
      decks: [], vocabulary: [], cards: [], reviews: [], gameRuns: [], practiceSessions: [],
    }))
    const repository = new LocalRepository()
    const run = { id: 'run1', userId: 'u', deckId: null, score: 100, wave: 1, accuracy: 100, durationSeconds: 60, inputMode: 'typing' as const, createdAt: '2026-08-01T00:00:00Z' }
    const review = { id: 'rev1', userId: 'u', vocabularyId: 'v', mode: 'game-typing' as const, rating: 6 as const, correct: true, responseMs: 1000, usedHint: false, submittedAnswer: '', reviewedAt: '2026-08-01T00:00:00Z' }
    
    // First save
    await repository.addGameRun(run)
    await repository.addReviews([review])
    
    let snapshot = await repository.load()
    expect(snapshot?.gameRuns).toHaveLength(1)
    expect(snapshot?.reviews).toHaveLength(1)
    
    // Retry save (simulating a retry after partial failure)
    await repository.addGameRun(run)
    await repository.addReviews([review])
    
    snapshot = await repository.load()
    expect(snapshot?.gameRuns).toHaveLength(1) // Should still be 1
    expect(snapshot?.reviews).toHaveLength(1) // Should still be 1
  })
})
