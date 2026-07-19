import { describe, expect, it } from 'vitest'
import { sanitizeLearnSession, generateNextBatch } from './learn'
import type { AppSnapshot, LearnSession, VocabularyItem } from '../domain/types'

// Mock snapshot builder
function createMockSnapshot(opts: {
  vocabulary?: Partial<VocabularyItem>[]
  cards?: { vocabularyId: string }[]
  decks?: { id: string; name: string }[]
} = {}): AppSnapshot {
  const decks = (opts.decks || []).map(d => ({
    id: d.id,
    userId: 'u',
    name: d.name,
    description: '',
    source: 'manual' as const,
    sourceKey: '',
    createdAt: '',
    updatedAt: ''
  }))

  const vocabulary = (opts.vocabulary || []).map((w, idx) => ({
    id: w.id || `w${idx}`,
    userId: 'u',
    deckId: w.deckId || 'd1',
    english: w.english || `word-${idx}`,
    vietnamese: w.vietnamese || `viet-${idx}`,
    acceptedAnswers: [],
    partOfSpeech: 'noun' as const,
    tier: 1 as const,
    cefr: 'A1' as const,
    ipa: '',
    exampleEn: '',
    exampleVi: '',
    notes: '',
    status: w.status || 'active',
    source: 'manual' as const,
    sourceKey: '',
    createdAt: '',
    updatedAt: ''
  }))

  const cards = (opts.cards || []).map((c, idx) => ({
    id: `c${idx}`,
    userId: 'u',
    vocabularyId: c.vocabularyId,
    memoryLevel: 1 as const,
    dueAt: '',
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    learningSteps: 0,
    reps: 0,
    lapses: 0,
    state: 0 as const,
    lastReviewAt: null,
    lastRating: null,
    createdAt: '',
    updatedAt: ''
  }))

  return {
    profile: {
      id: 'u',
      timezone: 'UTC',
      newWordsPerSession: 10,
      desiredRetention: 0.9,
      aiEnabled: false,
      createdAt: '',
      updatedAt: ''
    },
    decks,
    vocabulary,
    cards,
    reviews: [],
    gameRuns: [],
    practiceSessions: []
  }
}

function createMockSession(opts: Partial<LearnSession> = {}): LearnSession {
  return {
    userId: 'u',
    selectedDeckId: opts.selectedDeckId !== undefined ? opts.selectedDeckId : null,
    queueIds: opts.queueIds || [],
    deferredIds: opts.deferredIds || [],
    status: opts.status || 'idle',
    updatedAt: opts.updatedAt || ''
  }
}

describe('sanitizeLearnSession', () => {
  it('resets selectedDeckId to null if deck does not exist', () => {
    const snapshot = createMockSnapshot({ decks: [{ id: 'd1', name: 'Deck 1' }] })
    const session = createMockSession({ selectedDeckId: 'd-nonexistent' })
    const sanitized = sanitizeLearnSession(session, snapshot)
    expect(sanitized.selectedDeckId).toBeNull()
  })

  it('keeps selectedDeckId if deck exists', () => {
    const snapshot = createMockSnapshot({ decks: [{ id: 'd1', name: 'Deck 1' }] })
    const session = createMockSession({ selectedDeckId: 'd1' })
    const sanitized = sanitizeLearnSession(session, snapshot)
    expect(sanitized.selectedDeckId).toBe('d1')
  })

  it('filters queueIds and deferredIds (removes duplicates, learned, non-active, or mismatched deck)', () => {
    const snapshot = createMockSnapshot({
      decks: [{ id: 'd1', name: 'Deck 1' }, { id: 'd2', name: 'Deck 2' }],
      vocabulary: [
        { id: 'w1', deckId: 'd1', status: 'active' }, // active, unlearned, deck 1
        { id: 'w2', deckId: 'd1', status: 'active' }, // active, learned, deck 1
        { id: 'w3', deckId: 'd1', status: 'archived' }, // archived, deck 1
        { id: 'w4', deckId: 'd2', status: 'active' }, // active, unlearned, deck 2
      ],
      cards: [{ vocabularyId: 'w2' }] // w2 is learned
    })

    const session = createMockSession({
      selectedDeckId: 'd1',
      queueIds: ['w1', 'w1', 'w2', 'w3', 'w4', 'w-nonexistent'],
      deferredIds: ['w1', 'w1', 'w2', 'w3', 'w4']
    })

    const sanitized = sanitizeLearnSession(session, snapshot)

    // queueIds should only have w1 (w2 is learned, w3 is archived, w4 is deck 2, w-nonexistent does not exist, duplicates removed)
    expect(sanitized.queueIds).toEqual(['w1'])

    // deferredIds should have w1 and w4 (global, so w4 is kept since it is active and unlearned, w2 is learned, w3 is archived)
    expect(sanitized.deferredIds).toEqual(['w1', 'w4'])
  })
})

describe('generateNextBatch', () => {
  it('prioritizes normal (non-deferred) words', () => {
    const snapshot = createMockSnapshot({
      decks: [{ id: 'd1', name: 'Deck 1' }],
      vocabulary: [
        { id: 'w1', deckId: 'd1', status: 'active' },
        { id: 'w2', deckId: 'd1', status: 'active' },
        { id: 'w3', deckId: 'd1', status: 'active' },
      ],
      cards: []
    })

    // w2 is deferred
    const session = createMockSession({
      selectedDeckId: 'd1',
      deferredIds: ['w2']
    })

    const nextSession = generateNextBatch(session, snapshot, 2)

    // w1 and w3 are normal, so they should be selected in the queue. w2 remains deferred.
    expect(nextSession.queueIds).toEqual(['w1', 'w3'])
    expect(nextSession.deferredIds).toEqual(['w2'])
    expect(nextSession.status).toBe('active')
  })

  it('selects deferred words only when no normal words remain, keeping correct defer order', () => {
    const snapshot = createMockSnapshot({
      decks: [{ id: 'd1', name: 'Deck 1' }],
      vocabulary: [
        { id: 'w1', deckId: 'd1', status: 'active' },
        { id: 'w2', deckId: 'd1', status: 'active' },
        { id: 'w3', deckId: 'd1', status: 'active' },
      ],
      cards: []
    })

    // all are deferred. Defer order: w3, then w1, then w2.
    const session = createMockSession({
      selectedDeckId: 'd1',
      deferredIds: ['w3', 'w1', 'w2']
    })

    // Take a batch of size 2
    const nextSession = generateNextBatch(session, snapshot, 2)

    // Should pull first two from deferred list: w3 and w1. w2 should remain in deferred list.
    expect(nextSession.queueIds).toEqual(['w3', 'w1'])
    expect(nextSession.deferredIds).toEqual(['w2'])
    expect(nextSession.status).toBe('active')

    // Simulate user learning w3 and w1:
    const snapshot2 = {
      ...snapshot,
      cards: [
        { id: 'c1', userId: 'u', vocabularyId: 'w3', memoryLevel: 1, dueAt: '', stability: 0, difficulty: 0, elapsedDays: 0, scheduledDays: 0, learningSteps: 0, reps: 0, lapses: 0, state: 0, lastReviewAt: null, lastRating: null, createdAt: '', updatedAt: '' },
        { id: 'c2', userId: 'u', vocabularyId: 'w1', memoryLevel: 1, dueAt: '', stability: 0, difficulty: 0, elapsedDays: 0, scheduledDays: 0, learningSteps: 0, reps: 0, lapses: 0, state: 0, lastReviewAt: null, lastRating: null, createdAt: '', updatedAt: '' }
      ] as any
    }

    // Take next batch
    const finalSession = generateNextBatch(nextSession, snapshot2, 2)
    expect(finalSession.queueIds).toEqual(['w2'])
    expect(finalSession.deferredIds).toEqual([])
    expect(finalSession.status).toBe('active')

    // Simulate user learning w2:
    const snapshot3 = {
      ...snapshot2,
      cards: [
        ...snapshot2.cards,
        { id: 'c3', userId: 'u', vocabularyId: 'w2', memoryLevel: 1, dueAt: '', stability: 0, difficulty: 0, elapsedDays: 0, scheduledDays: 0, learningSteps: 0, reps: 0, lapses: 0, state: 0, lastReviewAt: null, lastRating: null, createdAt: '', updatedAt: '' }
      ] as any
    }

    // Another batch should end the session
    const emptySession = generateNextBatch(finalSession, snapshot3, 2)
    expect(emptySession.queueIds).toEqual([])
    expect(emptySession.deferredIds).toEqual([])
    expect(emptySession.status).toBe('completed')
  })

  it('sets status to completed when no words are left to learn', () => {
    const snapshot = createMockSnapshot({
      decks: [{ id: 'd1', name: 'Deck 1' }],
      vocabulary: [
        { id: 'w1', deckId: 'd1', status: 'active' },
      ],
      cards: [{ vocabularyId: 'w1' }] // w1 is already learned
    })

    const session = createMockSession({
      selectedDeckId: 'd1',
      queueIds: [],
      deferredIds: []
    })

    const nextSession = generateNextBatch(session, snapshot, 5)
    expect(nextSession.queueIds).toEqual([])
    expect(nextSession.status).toBe('completed')
  })
})
