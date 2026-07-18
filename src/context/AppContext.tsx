import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  AiPracticeSet,
  AppSnapshot,
  Deck,
  GameOutcome,
  GameRun,
  VocabularyImportResult,
  PracticeSession,
  Profile,
  ReviewMode,
  VocabularyItem,
} from '../domain/types'
import { CloudRepository, LocalRepository, type AppRepository } from '../data/repository'
import { loadOxfordCatalog, type OxfordLevel } from '../data/oxfordCatalog'
import { STARTER_WORDS } from '../data/starterWords'
import { aggregateGameOutcomes, buildDashboardStats, createSrsCard, isDue, memoryLevelInfo, ratingFromGameOutcome, scheduleReview } from '../lib/srs'
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
  archiveWord: (word: VocabularyItem) => Promise<void>
  deleteWord: (id: string) => Promise<void>
  saveDeck: (name: string, description: string, id?: string) => Promise<Deck>
  deleteDeck: (id: string) => Promise<void>
  importOxfordLevels: (levels: OxfordLevel[]) => Promise<VocabularyImportResult>
  reviewWord: (input: ReviewInput) => Promise<void>
  recordGame: (run: Omit<GameRun, 'id' | 'userId' | 'createdAt'>, outcomes: GameOutcome[]) => Promise<void>
  updateProfile: (input: Partial<Pick<Profile, 'newWordsPerSession' | 'desiredRetention' | 'aiEnabled' | 'timezone'>>) => Promise<void>
  savePractice: (deckId: string | null, format: 'reading' | 'quiz', targetIds: string[], content: AiPracticeSet, score?: number | null) => Promise<void>
  exportBackup: () => void
  importBackup: (file: File) => Promise<void>
  reload: () => Promise<void>
  adjustMemoryLevel: (vocabularyId: string, action: 'decrement' | 'reset-to-one') => Promise<void>
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
      createdAt: now,
      updatedAt: now,
    },
    decks: [{
      id: deckId,
      userId,
      name: 'Vocab Siege Starter',
      description: '72 từ mẫu được chuyển từ prototype ban đầu.',
      source: 'starter',
      sourceKey: 'vocab-siege-starter-v1',
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
      notes: index < 72 ? 'Từ mẫu của Vocab Siege.' : '',
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

const EMPTY_STATS = { newCount: 0, learningCount: 0, dueCount: 0, weakCount: 0, streak: 0, accuracy: 100 }

export function AppProvider({ children }: { children: ReactNode }) {
  const { userId, isLocalMode } = useAuth()
  const repository = useMemo<AppRepository>(() => isLocalMode ? new LocalRepository() : new CloudRepository(), [isLocalMode])
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null)
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải dữ liệu.')
    } finally {
      setLoading(false)
    }
  }, [repository, userId])

  useEffect(() => { void reload() }, [reload])

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
        const stamp = nowIso()
        const word: VocabularyItem = {
          ...input,
          id: input.id ?? crypto.randomUUID(),
          userId,
          source: existing?.source ?? 'manual',
          sourceKey: existing?.sourceKey ?? '',
          createdAt: existing?.createdAt ?? stamp,
          updatedAt: stamp,
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
      async archiveWord(word) {
        const archived = { ...word, status: word.status === 'active' ? 'archived' as const : 'active' as const, updatedAt: nowIso() }
        await repository.saveWord(archived)
        setSnapshot((state) => state ? ({ ...state, vocabulary: state.vocabulary.map((item) => item.id === word.id ? archived : item) }) : state)
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
        const knownSourceKeys = new Set(current.vocabulary.filter((word) => word.source === 'oxford-3000').map((word) => word.sourceKey))
        const knownDecks = new Map(current.decks.filter((deck) => deck.source === 'oxford-3000').map((deck) => [deck.sourceKey, deck]))
        const importedDecks: Deck[] = []
        const importedWords: VocabularyItem[] = []
        let created = 0
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
            if (knownSourceKeys.has(entry.sourceKey)) {
              skipped += 1
              return []
            }
            knownSourceKeys.add(entry.sourceKey)
            return [{
              ...entry,
              id: crypto.randomUUID(), userId, deckId: deck.id,
              status: 'active' as const,
              source: 'oxford-3000' as const,
              createdAt: stamp, updatedAt: stamp,
            }]
          })
          await repository.saveWords(words)
          importedWords.push(...words)
          created += words.length
        }

        setSnapshot((state) => state ? ({
          ...state,
          decks: [...state.decks, ...importedDecks],
          vocabulary: [...importedWords, ...state.vocabulary],
        }) : state)
        return { created, skipped, failed: 0, deckIds: selected.flatMap((level) => {
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
      async recordGame(runInput, outcomes) {
        const current = requireSnapshot()
        const run: GameRun = { ...runInput, id: crypto.randomUUID(), userId, createdAt: nowIso() }
        await repository.addGameRun(run)
        const reviewResults = aggregateGameOutcomes(outcomes).flatMap((outcome) => {
          const card = current.cards.find((item) => item.vocabularyId === outcome.vocabularyId)
          if (!card || !isDue(card)) return []
          return [scheduleReview({
            card,
            mode: run.inputMode === 'typing' ? 'game-typing' : 'game-touch',
            correct: ratingFromGameOutcome(outcome),
            responseMs: outcome.responseMs,
            usedHint: outcome.usedHint,
          })]
        })
        await Promise.all(reviewResults.flatMap((result) => [repository.saveCard(result.card), repository.addReview(result.event)]))
        setSnapshot((state) => state ? ({
          ...state,
          gameRuns: [run, ...state.gameRuns],
          cards: state.cards.map((card) => reviewResults.find((result) => result.card.id === card.id)?.card ?? card),
          reviews: [...reviewResults.map((result) => result.event), ...state.reviews],
        }) : state)
      },
      async updateProfile(input) {
        const profile = { ...snapshot.profile, ...input, updatedAt: nowIso() }
        await repository.saveProfile(profile)
        setSnapshot((state) => state ? ({ ...state, profile }) : state)
      },
      async savePractice(deckId, format, targetIds, content, score = null) {
        const session: PracticeSession = {
          id: crypto.randomUUID(), userId, deckId, format, targetVocabularyIds: targetIds,
          content, score, createdAt: nowIso(),
        }
        await repository.savePracticeSession(session)
        setSnapshot((state) => state ? ({ ...state, practiceSessions: [session, ...state.practiceSessions] }) : state)
      },
      exportBackup() {
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `vocab-siege-backup-${new Date().toISOString().slice(0, 10)}.json`
        link.click()
        URL.revokeObjectURL(link.href)
      },
      async importBackup(file) {
        const parsed = JSON.parse(await file.text()) as AppSnapshot
        if (!parsed.profile || !Array.isArray(parsed.decks) || !Array.isArray(parsed.vocabulary)) throw new Error('File backup không hợp lệ.')
        const legacyBackup = (parsed.cards ?? []).some((item) => !(item.memoryLevel >= 1 && item.memoryLevel <= 6))
        const rebound: AppSnapshot = {
          ...parsed,
          profile: { ...parsed.profile, id: userId, updatedAt: nowIso() },
          decks: parsed.decks.map((item) => ({ ...item, userId, source: item.source ?? 'manual', sourceKey: item.sourceKey ?? '' })),
          vocabulary: parsed.vocabulary.map((item) => ({ ...item, userId, source: item.source ?? 'manual', sourceKey: item.sourceKey ?? '' })),
          cards: (parsed.cards ?? []).map((item) => ({ ...item, userId, memoryLevel: item.memoryLevel >= 1 && item.memoryLevel <= 6 ? item.memoryLevel : (item.lastRating === 4 ? 6 : item.lastRating === 3 ? 4 : item.lastRating === 2 ? 2 : 1) })),
          reviews: (parsed.reviews ?? []).map((item) => ({ ...item, userId, rating: legacyBackup ? (item.rating === 4 ? 6 : item.rating === 3 ? 4 : item.rating === 2 ? 2 : 1) : item.rating })),
          gameRuns: (parsed.gameRuns ?? []).map((item) => ({ ...item, userId })),
          practiceSessions: (parsed.practiceSessions ?? []).map((item) => ({ ...item, userId })),
        }
        await repository.restore(rebound)
        setSnapshot(rebound)
      },
      async adjustMemoryLevel(vocabularyId, action) {
        const current = requireSnapshot()
        const existing = current.cards.find((item) => item.vocabularyId === vocabularyId)
        if (!existing) throw new Error('Không tìm thấy thẻ ghi nhớ cho từ này.')
        
        let newLevel: 1 | 2 | 3 | 4 | 5 | 6 = existing.memoryLevel
        if (action === 'reset-to-one') newLevel = 1
        else if (action === 'decrement') newLevel = Math.max(1, existing.memoryLevel - 1) as 1 | 2 | 3 | 4 | 5 | 6
        
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
      reload,
    }
  }, [error, loading, reload, repository, snapshot, userId])

  if (!snapshot) {
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
