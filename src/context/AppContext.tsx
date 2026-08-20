import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  AiPracticeSet,
  AppSnapshot,
  Deck,
  GameRun,
  GameSaveRequest,
  LearnSession,
  VocabularyImportResult,
  PracticeSession,
  Profile,
  ReviewMode,
  VocabularyItem,
} from '../domain/types'
import { DEFAULT_TTS_VOICE } from '../domain/types'
import { CloudRepository, LocalRepository, type AppRepository } from '../data/repository'
import { loadOxfordCatalog, type OxfordLevel } from '../data/oxfordCatalog'
import { STARTER_WORDS } from '../data/starterWords'
import { deduplicateSnapshot, mergeVocabularyItems, normalizeHeadword, withVocabularySenses } from '../domain/vocabulary'
import { aggregateGameOutcomes, buildDashboardStats, createSrsCard, isDue, memoryLevelInfo, ratingFromGameOutcome, scheduleReview } from '../lib/srs'
import { sanitizeLearnSession, generateNextBatch } from '../lib/learn'
import { useAuth } from './AuthContext'

interface ReviewInput {
  vocabularyId: string
  mode: ReviewMode
  correct: boolean
  submittedAnswer?: string
  responseMs?: number | null
  usedHint?: boolean
}

interface AppValue {
  snapshot: AppSnapshot
  loading: boolean
  error: string
  stats: ReturnType<typeof buildDashboardStats>
  saveWord: (input: Omit<VocabularyItem, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'source' | 'sourceKey'> & { id?: string }) => Promise<VocabularyItem>
  prioritizeLearnWord: (vocabularyId: string) => Promise<void>
  deleteWord: (id: string) => Promise<void>
  saveDeck: (name: string, description: string, id?: string) => Promise<Deck>
  deleteDeck: (id: string) => Promise<void>
  importOxfordLevels: (levels: OxfordLevel[]) => Promise<VocabularyImportResult>
  reviewWord: (input: ReviewInput) => Promise<void>
  recordGame: (request: GameSaveRequest) => Promise<void>
  updateProfile: (input: Partial<Pick<Profile, 'newWordsPerSession' | 'desiredRetention' | 'aiEnabled' | 'timezone' | 'ttsVoice'>>) => Promise<void>
  savePractice: (deckId: string | null, format: 'reading' | 'quiz' | 'dialogue' | 'dictation', targetIds: string[], content: AiPracticeSet, score?: number | null) => Promise<PracticeSession>
  updatePracticeSession: (session: PracticeSession) => Promise<void>
  exportBackup: () => void
  importBackup: (file: File) => Promise<void>
  reload: () => Promise<void>
  adjustMemoryLevel: (vocabularyId: string, action: 'decrement' | 'reset-to-one') => Promise<void>
  learnSession: LearnSession | null
  savingSession: boolean
  changeLearnDeck: (deckId: string | null) => Promise<void>
  deferLearnWord: (vocabularyId: string) => Promise<void>
  nextLearnWord: (input: Omit<ReviewInput, 'mode'>) => Promise<void>
  generateNextBatchAction: () => Promise<void>
}

const AppContext = createContext<AppValue | null>(null)

const nowIso = () => new Date().toISOString()

function createInitialSnapshot(userId: string): AppSnapshot {
  const now = nowIso()
  const deckId = crypto.randomUUID()
  return {
    profile: {
      id: userId,
      timezone: 'Asia/Saigon',
      newWordsPerSession: 10,
      desiredRetention: 0.9,
      aiEnabled: false,
      ttsVoice: DEFAULT_TTS_VOICE,
      createdAt: now,
      updatedAt: now,
    },
    decks: [{
      id: deckId,
      userId,
      name: 'WordForge Starter',
      description: '72 từ mẫu được chuyển từ prototype ban đầu.',
      source: 'starter',
      sourceKey: 'wordforge-starter-v1',
      createdAt: now,
      updatedAt: now,
    }],
    vocabulary: STARTER_WORDS.map((item, index) => ({
      id: crypto.randomUUID(),
      userId,
      deckId,
      english: item.english,
      vietnamese: item.vietnamese,
      acceptedAnswers: [],
      partOfSpeech: item.partOfSpeech,
      tier: item.tier,
      cefr: item.cefr,
      ipa: '',
      exampleEn: '',
      exampleVi: '',
      notes: index < 72 ? 'Từ mẫu của WordForge.' : '',
      senses: [{
        sourceKey: `starter:${index}:${item.english}`,
        vietnamese: item.vietnamese,
        partOfSpeech: item.partOfSpeech,
        tier: item.tier,
        cefr: item.cefr,
        ipa: '',
        exampleEn: '',
        exampleVi: '',
        notes: index < 72 ? 'Từ mẫu của WordForge.' : '',
      }],
      status: 'active' as const,
      source: 'starter' as const,
      sourceKey: `starter:${index}:${item.english}`,
      createdAt: now,
      updatedAt: now,
    })),
    cards: [],
    reviews: [],
    gameRuns: [],
    practiceSessions: [],
  }
}

const EMPTY_STATS = { newCount: 0, learningCount: 0, dueCount: 0, weakCount: 0, streak: 0, accuracy: 100, todayLearnedCount: 0, todayReviewedCount: 0 }

export function AppProvider({ children }: { children: ReactNode }) {
  const { userId, isLocalMode } = useAuth()
  const repository = useMemo<AppRepository>(() => isLocalMode ? new LocalRepository() : new CloudRepository(), [isLocalMode])
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null)
  const [learnSession, setLearnSession] = useState<LearnSession | null>(null)
  const [savingSession, setSavingSession] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let loaded = await repository.load(userId)
      if (!loaded) {
        loaded = createInitialSnapshot(userId)
        await repository.restore(loaded)
      }
      setSnapshot(loaded)

      let session = await repository.loadLearnSession(userId)
      if (!session) {
        session = {
          userId,
          selectedDeckId: null,
          queueIds: [],
          deferredIds: [],
          status: 'idle',
          updatedAt: new Date().toISOString()
        }
      }
      const sanitized = sanitizeLearnSession(session, loaded)
      setLearnSession(sanitized)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu.')
    } finally {
      setLoading(false)
    }
  }, [repository, userId])

  useEffect(() => { void reload() }, [reload])

  const saveAndSetSession = useCallback(async (newSession: LearnSession) => {
    setSavingSession(true)
    try {
      await repository.saveLearnSession(newSession)
      setLearnSession(newSession)
    } catch (err) {
      console.error('Lỗi khi lưu phiên học:', err)
    } finally {
      setSavingSession(false)
    }
  }, [repository])

  useEffect(() => {
    if (snapshot && learnSession && !savingSession) {
      const sanitized = sanitizeLearnSession(learnSession, snapshot)
      if (
        sanitized.selectedDeckId !== learnSession.selectedDeckId ||
        sanitized.queueIds.length !== learnSession.queueIds.length ||
        sanitized.deferredIds.length !== learnSession.deferredIds.length ||
        sanitized.queueIds.some((id, idx) => id !== learnSession.queueIds[idx]) ||
        sanitized.deferredIds.some((id, idx) => id !== learnSession.deferredIds[idx])
      ) {
        void saveAndSetSession(sanitized)
      }
    }
  }, [snapshot, learnSession, savingSession, saveAndSetSession])

  const requireSnapshot = () => {
    if (!snapshot) throw new Error('Dữ liệu chưa sẵn sàng')
    return snapshot
  }

  const value = useMemo<AppValue | null>(() => {
    if (!snapshot) return null
    return {
      snapshot,
      loading,
      error,
      stats: buildDashboardStats(snapshot.vocabulary, snapshot.cards, snapshot.reviews, snapshot.profile.timezone),
      async saveWord(input) {
        const current = requireSnapshot()
        const existing = input.id ? current.vocabulary.find((item) => item.id === input.id) : undefined
        const collision = current.vocabulary.find((item) => item.deckId === input.deckId
          && normalizeHeadword(item.english) === normalizeHeadword(input.english)
          && item.id !== input.id)
        if (existing && collision) throw new Error('Từ này đã tồn tại trong bộ. Hãy chỉnh sửa mục hiện có để thêm nghĩa.')
        const stamp = nowIso()
        let word: VocabularyItem = withVocabularySenses({
          ...input,
          id: input.id ?? crypto.randomUUID(),
          userId,
          source: existing?.source ?? 'manual',
          sourceKey: existing?.sourceKey ?? '',
          createdAt: existing?.createdAt ?? stamp,
          updatedAt: stamp,
        }, input.senses?.length ? input.senses : [{
          sourceKey: existing?.sourceKey ?? '',
          vietnamese: input.vietnamese,
          partOfSpeech: input.partOfSpeech,
          tier: input.tier,
          cefr: input.cefr,
          ipa: input.ipa,
          exampleEn: input.exampleEn,
          exampleVi: input.exampleVi,
          notes: input.notes,
        }])
        if (!existing && collision) {
          word = mergeVocabularyItems(collision, { ...word, id: collision.id, createdAt: collision.createdAt })
        }
        await repository.saveWord(word)
        setSnapshot((state) => state ? ({
          ...state,
          vocabulary: state.vocabulary.some((item) => item.id === word.id)
            ? state.vocabulary.map((item) => item.id === word.id ? word : item)
            : [word, ...state.vocabulary],
        }) : state)
        return word
      },
      async prioritizeLearnWord(vocabularyId) {
        if (savingSession || !learnSession || !snapshot) return
        
        const word = snapshot.vocabulary.find(w => w.id === vocabularyId)
        if (word) {
          const updatedWord = { ...word, isPrioritized: !word.isPrioritized, updatedAt: nowIso() }
          await repository.saveWord(updatedWord)
          setSnapshot((state) => state ? ({
            ...state,
            vocabulary: state.vocabulary.map(w => w.id === vocabularyId ? updatedWord : w)
          }) : state)
        }
        
        const isTopPriority = learnSession.queueIds[0] === vocabularyId
        const nextQueue = learnSession.queueIds.filter(id => id !== vocabularyId)
        const nextDeferred = learnSession.deferredIds.filter(id => id !== vocabularyId)
        
        if (isTopPriority) {
          nextDeferred.push(vocabularyId)
        } else {
          nextQueue.unshift(vocabularyId)
        }

        const updatedSession = sanitizeLearnSession({
          ...learnSession,
          queueIds: nextQueue,
          deferredIds: nextDeferred,
          status: nextQueue.length > 0 ? 'active' : 'completed',
          updatedAt: new Date().toISOString()
        }, snapshot)

        await saveAndSetSession(updatedSession)
      },
      async deleteWord(id) {
        await repository.deleteWord(id)
        setSnapshot((state) => state ? ({
          ...state,
          vocabulary: state.vocabulary.filter((word) => word.id !== id),
          cards: state.cards.filter((card) => card.vocabularyId !== id),
        }) : state)
      },
      async saveDeck(name, description, id) {
        const existing = id ? snapshot.decks.find((deck) => deck.id === id) : undefined
        const stamp = nowIso()
        const deck: Deck = {
          id: id ?? crypto.randomUUID(), userId, name, description,
          source: existing?.source ?? 'manual', sourceKey: existing?.sourceKey ?? '',
          createdAt: existing?.createdAt ?? stamp, updatedAt: stamp,
        }
        await repository.saveDeck(deck)
        setSnapshot((state) => state ? ({ ...state, decks: state.decks.some((item) => item.id === deck.id) ? state.decks.map((item) => item.id === deck.id ? deck : item) : [...state.decks, deck] }) : state)
        return deck
      },
      async deleteDeck(id) {
        if (snapshot.decks.length <= 1) throw new Error('Cần giữ lại ít nhất một bộ từ.')
        await repository.deleteDeck(id)
        setSnapshot((state) => state ? ({
          ...state,
          decks: state.decks.filter((deck) => deck.id !== id),
          vocabulary: state.vocabulary.filter((word) => word.deckId !== id),
        }) : state)
      },
      async importOxfordLevels(levels) {
        const current = requireSnapshot()
        const selected = [...new Set(levels)]
        const knownDecks = new Map(current.decks.filter((deck) => deck.source === 'oxford-3000').map((deck) => [deck.sourceKey, deck]))
        const knownWords = new Map(current.vocabulary.map((word) => [`${word.deckId}|${normalizeHeadword(word.english)}`, word]))
        const importedDecks: Deck[] = []
        const importedWords: VocabularyItem[] = []
        let created = 0
        let updated = 0
        let skipped = 0

        for (const level of selected) {
          const catalog = await loadOxfordCatalog(level)
          const deckSourceKey = `oxford-3000:${level.toLowerCase()}`
          let deck = knownDecks.get(deckSourceKey)
          if (!deck) {
            const stamp = nowIso()
            deck = {
              id: crypto.randomUUID(), userId,
              name: `Oxford 3000 · ${level}`,
              description: 'Headword và CEFR theo Oxford 3000; nghĩa Việt, IPA và ví dụ được biên soạn riêng cho việc học TOEIC.',
              source: 'oxford-3000', sourceKey: deckSourceKey,
              createdAt: stamp, updatedAt: stamp,
            }
            await repository.saveDeck(deck)
            knownDecks.set(deckSourceKey, deck)
            importedDecks.push(deck)
          }

          const stamp = nowIso()
          const words = catalog.entries.flatMap((entry) => {
            const key = `${deck.id}|${normalizeHeadword(entry.english)}`
            const existing = knownWords.get(key)
            const incoming: VocabularyItem = withVocabularySenses({
              ...entry,
              id: existing?.id ?? crypto.randomUUID(), userId, deckId: deck.id,
              status: existing?.status ?? 'active' as const,
              source: 'oxford-3000' as const,
              createdAt: existing?.createdAt ?? stamp, updatedAt: stamp,
            }, entry.senses)
            if (existing) {
              const incomingKeys = new Set(entry.senses.map((sense) => sense.sourceKey))
              const customSenses = (existing.senses ?? []).filter((sense) => !incomingKeys.has(sense.sourceKey))
              const next = withVocabularySenses({
                ...existing,
                ...incoming,
                id: existing.id,
                status: existing.status,
                source: existing.source,
                sourceKey: entry.sourceKey,
                createdAt: existing.createdAt,
                updatedAt: stamp,
                acceptedAnswers: [...new Set([...existing.acceptedAnswers, ...incoming.acceptedAnswers])],
              }, [...entry.senses, ...customSenses])
              const before = JSON.stringify({ sourceKey: existing.sourceKey, acceptedAnswers: existing.acceptedAnswers, senses: existing.senses })
              const after = JSON.stringify({ sourceKey: next.sourceKey, acceptedAnswers: next.acceptedAnswers, senses: next.senses })
              if (before === after) {
                skipped += 1
                return []
              }
              updated += 1
              knownWords.set(key, next)
              return [next]
            }
            created += 1
            knownWords.set(key, incoming)
            return [incoming]
          })
          await repository.saveWords(words)
          importedWords.push(...words)
        }

        setSnapshot((state) => state ? ({
          ...state,
          decks: [...state.decks, ...importedDecks],
          vocabulary: [...importedWords, ...state.vocabulary.filter((word) => !importedWords.some((imported) => imported.id === word.id))],
        }) : state)
        return { created, updated, merged: 0, skipped, failed: 0, deckIds: selected.flatMap((level) => {
          const deck = knownDecks.get(`oxford-3000:${level.toLowerCase()}`)
          return deck ? [deck.id] : []
        }) }
      },
      async reviewWord(input) {
        const current = requireSnapshot()
        const existing = current.cards.find((item) => item.vocabularyId === input.vocabularyId)
        const card = existing ?? createSrsCard(userId, input.vocabularyId)
        const result = scheduleReview({
          card,
          mode: input.mode,
          correct: input.correct,
          submittedAnswer: input.submittedAnswer,
          responseMs: input.responseMs,
          usedHint: input.usedHint,
        })
        await Promise.all([repository.saveCard(result.card), repository.addReview(result.event)])
        setSnapshot((state) => state ? ({
          ...state,
          cards: state.cards.some((item) => item.id === result.card.id) ? state.cards.map((item) => item.id === result.card.id ? result.card : item) : [result.card, ...state.cards],
          reviews: [result.event, ...state.reviews],
        }) : state)
      },
      async recordGame(request) {
        const current = requireSnapshot()

        const reviewResults = request.source === 'learned' ? [] : aggregateGameOutcomes(request.outcomes).flatMap((outcome) => {
          const card = current.cards.find((item) => item.vocabularyId === outcome.vocabularyId)
          if (!card || !isDue(card, new Date(request.createdAt))) return []
          const correct = ratingFromGameOutcome(outcome)
          if (correct === null) return []
          return [scheduleReview({
            card,
            mode: request.inputMode === 'typing' ? 'game-typing' : 'game-touch',
            correct,
            responseMs: outcome.responseMs,
            usedHint: outcome.usedHint,
            now: new Date(request.createdAt),
            eventId: request.reviewEventIds[outcome.vocabularyId],
          })]
        })

        await repository.saveCards(reviewResults.map((result) => result.card))
        await repository.addReviews(reviewResults.map((result) => result.event))

        const run: GameRun = {
          id: request.runId,
          userId,
          deckId: request.deckId,
          score: request.score,
          wave: request.wave,
          accuracy: request.accuracy,
          durationSeconds: request.durationSeconds,
          inputMode: request.inputMode,
          createdAt: request.createdAt
        }
        await repository.addGameRun(run)

        setSnapshot((state) => {
          if (!state) return state

          const nextGameRuns = state.gameRuns.some(r => r.id === run.id)
            ? state.gameRuns.map(r => r.id === run.id ? run : r)
            : [run, ...state.gameRuns]

          const nextCards = state.cards.map((card) => {
            const updated = reviewResults.find((result) => result.card.id === card.id)
            return updated ? updated.card : card
          })

          const newEvents = reviewResults.map(r => r.event)
          const nextReviews = [...newEvents.filter(e => !state.reviews.some(sr => sr.id === e.id)), ...state.reviews]

          return {
            ...state,
            gameRuns: nextGameRuns,
            cards: nextCards,
            reviews: nextReviews,
          }
        })
      },
      async updateProfile(input) {
        const profile = { ...snapshot.profile, ...input, updatedAt: nowIso() }
        try {
          await repository.saveProfile(profile)
        } catch (e) {
          console.error('Failed to save profile to remote:', e)
          // Allow local state to update anyway so the user can use the voice for this session
        }
        setSnapshot((state) => state ? ({ ...state, profile }) : state)
      },
      async savePractice(deckId, format, targetIds, content, score = null) {
        const session: PracticeSession = {
          id: crypto.randomUUID(), userId, deckId, format, targetVocabularyIds: targetIds,
          content, score, createdAt: nowIso(),
        }
        await repository.savePracticeSession(session)
        setSnapshot((state) => state ? ({ ...state, practiceSessions: [session, ...state.practiceSessions].slice(0, 200) }) : state)
        return session
      },
      async updatePracticeSession(session) {
        await repository.savePracticeSession(session)
        setSnapshot((state) => state ? ({ ...state, practiceSessions: state.practiceSessions.map(s => s.id === session.id ? session : s) }) : state)
      },
      exportBackup() {
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `wordforge-backup-${new Date().toISOString().slice(0, 10)}.json`
        link.click()
        URL.revokeObjectURL(link.href)
      },
      async importBackup(file) {
        const parsed = JSON.parse(await file.text()) as AppSnapshot
        if (!parsed.profile || !Array.isArray(parsed.decks) || !Array.isArray(parsed.vocabulary)) throw new Error('File backup không hợp lệ.')
        const legacyBackup = (parsed.cards ?? []).some((item) => !(item.memoryLevel >= 1 && item.memoryLevel <= 6))
        const rebound: AppSnapshot = {
          ...parsed,
          profile: { ...parsed.profile, id: userId, ttsVoice: parsed.profile.ttsVoice ?? DEFAULT_TTS_VOICE, updatedAt: nowIso() },
          decks: parsed.decks.map((item) => ({ ...item, userId, source: item.source ?? 'manual', sourceKey: item.sourceKey ?? '' })),
          vocabulary: parsed.vocabulary.map((item) => ({ ...item, userId, source: item.source ?? 'manual', sourceKey: item.sourceKey ?? '' })),
          cards: (parsed.cards ?? []).map((item) => ({ ...item, userId, memoryLevel: item.memoryLevel >= 1 && item.memoryLevel <= 7 ? item.memoryLevel : (item.lastRating === 4 ? 6 : item.lastRating === 3 ? 4 : item.lastRating === 2 ? 2 : 1) })),
          reviews: (parsed.reviews ?? []).map((item) => ({ ...item, userId, rating: legacyBackup ? (item.rating === 4 ? 6 : item.rating === 3 ? 4 : item.rating === 2 ? 2 : 1) : item.rating })),
          gameRuns: (parsed.gameRuns ?? []).map((item) => ({ ...item, userId, deckId: item.deckId === 'all' ? null : item.deckId })),
          practiceSessions: (parsed.practiceSessions ?? []).map((item) => ({ ...item, userId })),
        }
        const upgraded = deduplicateSnapshot(rebound).snapshot
        await repository.restore(upgraded)
        setSnapshot(upgraded)
      },
      async adjustMemoryLevel(vocabularyId, action) {
        const current = requireSnapshot()
        const existing = current.cards.find((item) => item.vocabularyId === vocabularyId)
        if (!existing) throw new Error('Không tìm thấy thẻ ghi nhớ cho từ này.')

        let newLevel: 1 | 2 | 3 | 4 | 5 | 6 | 7 = existing.memoryLevel
        if (action === 'reset-to-one') newLevel = 1
        else if (action === 'decrement') newLevel = Math.max(1, existing.memoryLevel - 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7

        if (newLevel === existing.memoryLevel) return

        const schedule = memoryLevelInfo(newLevel)
        const stamp = nowIso()

        const updatedCard = {
          ...existing,
          memoryLevel: newLevel,
          lastRating: newLevel,
          dueAt: stamp,
          updatedAt: stamp,
          stability: schedule.delayMs >= 86400000 ? schedule.delayMs / 86400000 : existing.stability,
          scheduledDays: schedule.delayMs >= 86400000 ? schedule.delayMs / 86400000 : 0,
          learningSteps: newLevel === 1 ? 1 : 0,
          state: (newLevel === 1 ? 1 : 2) as 0 | 1 | 2 | 3,
        }

        await repository.saveCard(updatedCard)
        setSnapshot((state) => state ? ({
          ...state,
          cards: state.cards.map((item) => item.id === updatedCard.id ? updatedCard : item),
        }) : state)
      },
      learnSession,
      savingSession,
      async changeLearnDeck(deckId) {
        if (savingSession || !learnSession || !snapshot) return
        const updatedSession = sanitizeLearnSession({
          ...learnSession,
          selectedDeckId: deckId,
          queueIds: [],
          status: 'idle',
          updatedAt: new Date().toISOString()
        }, snapshot)

        const nextSession = generateNextBatch(updatedSession, snapshot, 999999)
        await saveAndSetSession(nextSession)
      },
      async deferLearnWord(vocabularyId) {
        if (savingSession || !learnSession || !snapshot) return
        const nextQueue = learnSession.queueIds.filter(id => id !== vocabularyId)
        const nextDeferred = [...learnSession.deferredIds]
        if (!nextDeferred.includes(vocabularyId)) {
          nextDeferred.push(vocabularyId)
        }

        let finalQueue = nextQueue
        let finalDeferred = nextDeferred
        let nextStatus: 'active' | 'completed' | 'idle' = nextQueue.length > 0 ? 'active' : 'idle'

        if (nextQueue.length === 0) {
          const availableIds = new Set(
            snapshot.vocabulary
              .filter(w => (learnSession.selectedDeckId === null || w.deckId === learnSession.selectedDeckId) && !snapshot.cards.some(c => c.vocabularyId === w.id))
              .map(w => w.id)
          )
          const eligibleDeferred = finalDeferred.filter(id => availableIds.has(id))
          if (eligibleDeferred.length > 0) {
            finalQueue = eligibleDeferred
            finalDeferred = finalDeferred.filter(id => !eligibleDeferred.includes(id))
            nextStatus = 'active'
          } else {
            nextStatus = 'completed'
          }
        }

        const updatedSession = sanitizeLearnSession({
          ...learnSession,
          queueIds: finalQueue,
          deferredIds: finalDeferred,
          status: nextStatus,
          updatedAt: new Date().toISOString()
        }, snapshot)

        await saveAndSetSession(updatedSession)
      },
      async nextLearnWord(input) {
        if (savingSession || !learnSession || !snapshot) return
        const current = snapshot
        const existing = current.cards.find((item) => item.vocabularyId === input.vocabularyId)
        const card = existing ?? createSrsCard(userId, input.vocabularyId)
        const result = scheduleReview({
          card,
          mode: 'learn',
          correct: input.correct,
          submittedAnswer: input.submittedAnswer,
          responseMs: input.responseMs,
          usedHint: input.usedHint,
        })

        await Promise.all([
          repository.saveCard(result.card),
          repository.addReview(result.event)
        ])

        setSnapshot((state) => state ? ({
          ...state,
          cards: state.cards.some((item) => item.id === result.card.id) ? state.cards.map((item) => item.id === result.card.id ? result.card : item) : [result.card, ...state.cards],
          reviews: [result.event, ...state.reviews],
        }) : state)

        const nextQueue = learnSession.queueIds.filter(id => id !== input.vocabularyId)

        const tempSnapshot: AppSnapshot = {
          ...current,
          cards: current.cards.some((item) => item.id === result.card.id)
            ? current.cards.map((item) => item.id === result.card.id ? result.card : item)
            : [result.card, ...current.cards]
        }

        let finalQueue = nextQueue
        let finalDeferred = [...learnSession.deferredIds]
        let nextStatus: 'active' | 'completed' | 'idle' = nextQueue.length > 0 ? 'active' : 'completed'

        if (nextQueue.length === 0 && finalDeferred.length > 0) {
          const availableIds = new Set(
            tempSnapshot.vocabulary
              .filter(w => (learnSession.selectedDeckId === null || w.deckId === learnSession.selectedDeckId) && !tempSnapshot.cards.some(c => c.vocabularyId === w.id))
              .map(w => w.id)
          )
          const eligibleDeferred = finalDeferred.filter(id => availableIds.has(id))
          if (eligibleDeferred.length > 0) {
            finalQueue = eligibleDeferred
            finalDeferred = finalDeferred.filter(id => !eligibleDeferred.includes(id))
            nextStatus = 'active'
          }
        }

        const updatedSession = sanitizeLearnSession({
          ...learnSession,
          queueIds: finalQueue,
          deferredIds: finalDeferred,
          status: nextStatus,
          updatedAt: new Date().toISOString()
        }, tempSnapshot)

        await saveAndSetSession(updatedSession)
      },
      async generateNextBatchAction() {
        if (savingSession || !learnSession || !snapshot) return
        const nextSession = generateNextBatch(learnSession, snapshot, 999999)
        await saveAndSetSession(nextSession)
      },
      reload,
    }
  }, [error, loading, reload, repository, snapshot, userId, learnSession, savingSession, saveAndSetSession])

  if (!snapshot || !learnSession) {
    return <div className="boot-screen">{loading ? 'Đang dựng thành trì từ vựng…' : <><p>{error || 'Không có dữ liệu.'}</p><button onClick={() => void reload()}>Thử lại</button></>}</div>
  }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp phải được dùng bên trong AppProvider')
  return value
}

export { EMPTY_STATS }
