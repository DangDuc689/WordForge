import type { AppSnapshot, LearnSession } from '../domain/types'

/**
 * Clean up the learn session to remove duplicates, learned words, archived/deleted words,
 * and ensure selected deck compatibility.
 */
export function sanitizeLearnSession(session: LearnSession, snapshot: AppSnapshot): LearnSession {
  const now = new Date().toISOString()
  
  // 1. Verify selectedDeckId exists, fallback to null (All decks)
  let selectedDeckId = session.selectedDeckId
  if (selectedDeckId !== null) {
    const deckExists = snapshot.decks.some(d => d.id === selectedDeckId)
    if (!deckExists) {
      selectedDeckId = null
    }
  }

  // Helper sets for O(1) checks
  const activeWordIds = new Set(snapshot.vocabulary.map(w => w.id))
  const learnedWordIds = new Set(snapshot.cards.map(c => c.vocabularyId))
  const deckWordIds = new Set(
    snapshot.vocabulary
      .filter(w => (selectedDeckId === null || w.deckId === selectedDeckId))
      .map(w => w.id)
  )

  // 2. Sanitize queueIds
  // Keep only active, unlearned words belonging to the selected deck. Remove duplicates while maintaining order.
  const queueSet = new Set<string>()
  const queueIds: string[] = []
  for (const id of session.queueIds) {
    if (
      activeWordIds.has(id) &&
      !learnedWordIds.has(id) &&
      deckWordIds.has(id) &&
      !queueSet.has(id)
    ) {
      queueSet.add(id)
      queueIds.push(id)
    }
  }

  // 3. Sanitize deferredIds
  // Keep only active, unlearned words (global, so no deck restriction). Remove duplicates while maintaining order.
  const deferredSet = new Set<string>()
  const deferredIds: string[] = []
  for (const id of session.deferredIds) {
    if (
      activeWordIds.has(id) &&
      !learnedWordIds.has(id) &&
      !deferredSet.has(id)
    ) {
      deferredSet.add(id)
      deferredIds.push(id)
    }
  }

  // 4. Từ trong deferred mà isPrioritized=true → thoát khỏi deferred, lên đầu queue
  const wordMap = new Map(snapshot.vocabulary.map(w => [w.id, w]))
  const escapedFromDeferred: string[] = []
  const finalDeferredIds: string[] = []
  for (const id of deferredIds) {
    if (wordMap.get(id)?.isPrioritized && !queueSet.has(id)) {
      escapedFromDeferred.push(id)
    } else {
      finalDeferredIds.push(id)
    }
  }

  return {
    ...session,
    selectedDeckId,
    queueIds: [...escapedFromDeferred, ...queueIds],
    deferredIds: finalDeferredIds,
    updatedAt: now
  }
}

/**
 * Generate the next learning batch based on current session and snapshot.
 * Prioritizes normal (non-deferred) words, fallback to deferred words if no normal words remain.
 */
export function generateNextBatch(session: LearnSession, snapshot: AppSnapshot, limit: number): LearnSession {
  // First, sanitize the current session to ensure clean lists
  const cleanSession = sanitizeLearnSession(session, snapshot)
  
  // Available words: active, in deck, not learned (has no cards), and not already in the queue
  const queueSet = new Set(cleanSession.queueIds)
  const available = snapshot.vocabulary.filter(w => 
    (cleanSession.selectedDeckId === null || w.deckId === cleanSession.selectedDeckId) &&
    !snapshot.cards.some(c => c.vocabularyId === w.id) &&
    !queueSet.has(w.id)
  )

  const deferredSet = new Set(cleanSession.deferredIds)
  // Normal words: available and not in the deferred list
  const normalWords = available
    .filter(w => !deferredSet.has(w.id))
    .sort((a, b) => {
      const aPrio = a.isPrioritized ? 1 : 0
      const bPrio = b.isPrioritized ? 1 : 0
      if (aPrio !== bPrio) return bPrio - aPrio
      if (a.isPrioritized && b.isPrioritized) {
        return b.updatedAt.localeCompare(a.updatedAt)
      }
      return 0
    })

  let nextQueueIds: string[] = []
  let nextDeferredIds = [...cleanSession.deferredIds]

  if (normalWords.length > 0) {
    // 1. Take up to limit from normal words
    nextQueueIds = normalWords.slice(0, limit).map(w => w.id)
  } else {
    // 2. No normal words left: take from deferredIds (only those matching the selected deck)
    const availableIds = new Set(available.map(w => w.id))
    const eligibleDeferred = cleanSession.deferredIds.filter(id => availableIds.has(id))
    
    nextQueueIds = eligibleDeferred.slice(0, limit)
    // Remove the moved words from the deferred list
    const movedSet = new Set(nextQueueIds)
    nextDeferredIds = cleanSession.deferredIds.filter(id => !movedSet.has(id))
  }

  const nextStatus = nextQueueIds.length > 0 ? 'active' : 'completed'

  return {
    ...cleanSession,
    queueIds: nextQueueIds,
    deferredIds: nextDeferredIds,
    status: nextStatus,
    updatedAt: new Date().toISOString()
  }
}
