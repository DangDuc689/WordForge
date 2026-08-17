import type {
  AppSnapshot,
  Deck,
  GameRun,
  LearnSession,
  PracticeSession,
  Profile,
  ReviewEvent,
  SrsCard,
  VocabularyItem,
} from '../domain/types'
import { DEFAULT_TTS_VOICE } from '../domain/types'
import { deduplicateSnapshot } from '../domain/vocabulary'
import { supabase } from '../lib/supabase'

export interface AppRepository {
  load(userId: string): Promise<AppSnapshot | null>
  saveProfile(profile: Profile): Promise<void>
  saveDeck(deck: Deck): Promise<void>
  deleteDeck(deckId: string): Promise<void>
  saveWord(word: VocabularyItem): Promise<void>
  saveWords(words: VocabularyItem[]): Promise<void>
  deleteWord(wordId: string): Promise<void>
  saveCard(card: SrsCard): Promise<void>
  saveCards(cards: SrsCard[]): Promise<void>
  addReview(event: ReviewEvent): Promise<void>
  addReviews(events: ReviewEvent[]): Promise<void>
  addGameRun(run: GameRun): Promise<void>
  savePracticeSession(session: PracticeSession): Promise<void>
  restore(snapshot: AppSnapshot): Promise<void>
  loadLearnSession(userId: string): Promise<LearnSession | null>
  saveLearnSession(session: LearnSession): Promise<void>
}

const STORAGE_KEY = 'vocab-siege.snapshot.v1'

export class LocalRepository implements AppRepository {
  async load(): Promise<AppSnapshot | null> {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    try {
      return normalizeSnapshot(JSON.parse(raw) as AppSnapshot)
    } catch {
      return null
    }
  }

  private update(mutator: (snapshot: AppSnapshot) => AppSnapshot): void {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSnapshot(mutator(normalizeSnapshot(JSON.parse(raw) as AppSnapshot)))))
  }

  async saveProfile(profile: Profile) { this.update((snapshot) => ({ ...snapshot, profile })) }
  async saveDeck(deck: Deck) { this.update((snapshot) => ({ ...snapshot, decks: upsert(snapshot.decks, deck) })) }
  async deleteDeck(deckId: string) {
    this.update((snapshot) => ({
      ...snapshot,
      decks: snapshot.decks.filter((deck) => deck.id !== deckId),
      vocabulary: snapshot.vocabulary.filter((item) => item.deckId !== deckId),
      cards: snapshot.cards.filter((card) => !snapshot.vocabulary.some((item) => item.deckId === deckId && item.id === card.vocabularyId)),
      reviews: snapshot.reviews.filter((review) => !snapshot.vocabulary.some((item) => item.deckId === deckId && item.id === review.vocabularyId)),
    }))
  }
  async saveWord(word: VocabularyItem) { this.update((snapshot) => ({ ...snapshot, vocabulary: upsert(snapshot.vocabulary, word) })) }
  async saveWords(words: VocabularyItem[]) {
    if (!words.length) return
    this.update((snapshot) => ({
      ...snapshot,
      vocabulary: words.reduce((items, word) => upsert(items, word), snapshot.vocabulary),
    }))
  }
  async deleteWord(wordId: string) {
    this.update((snapshot) => ({
      ...snapshot,
      vocabulary: snapshot.vocabulary.filter((item) => item.id !== wordId),
      cards: snapshot.cards.filter((card) => card.vocabularyId !== wordId),
    }))
  }
  async saveCard(card: SrsCard) { this.update((snapshot) => ({ ...snapshot, cards: upsert(snapshot.cards, card) })) }
  async saveCards(cards: SrsCard[]) {
    if (!cards.length) return
    this.update((snapshot) => ({ ...snapshot, cards: cards.reduce((items, card) => upsert(items, card), snapshot.cards) }))
  }
  async addReview(event: ReviewEvent) { this.update((snapshot) => ({ ...snapshot, reviews: upsert(snapshot.reviews, event).slice(0, 5_000) })) }
  async addReviews(events: ReviewEvent[]) {
    if (!events.length) return
    this.update((snapshot) => ({ ...snapshot, reviews: events.reduce((items, event) => upsert(items, event), snapshot.reviews).slice(0, 5_000) }))
  }
  async addGameRun(run: GameRun) { this.update((snapshot) => ({ ...snapshot, gameRuns: upsert(snapshot.gameRuns, run).slice(0, 500) })) }
  async savePracticeSession(session: PracticeSession) {
    this.update((snapshot) => ({ ...snapshot, practiceSessions: upsert(snapshot.practiceSessions, session).slice(0, 200) }))
  }
  async restore(snapshot: AppSnapshot) { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSnapshot(snapshot))) }
  async loadLearnSession(userId: string): Promise<LearnSession | null> {
    const raw = localStorage.getItem(`vocab-siege.learn-session.v1.${userId}`)
    if (!raw) return null
    try {
      const session = JSON.parse(raw) as LearnSession
      const snapshotRaw = localStorage.getItem(STORAGE_KEY)
      if (!snapshotRaw) return session
      const { idMap } = deduplicateSnapshot(prepareSnapshot(JSON.parse(snapshotRaw) as AppSnapshot))
      const remap = (ids: string[]) => [...new Set(ids.map((id) => idMap.get(id) ?? id))]
      return { ...session, queueIds: remap(session.queueIds), deferredIds: remap(session.deferredIds) }
    } catch {
      return null
    }
  }
  async saveLearnSession(session: LearnSession) {
    localStorage.setItem(`vocab-siege.learn-session.v1.${session.userId}`, JSON.stringify(session))
  }
}

function upsert<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((current) => current.id === item.id)
  if (index === -1) return [item, ...items]
  return items.map((current) => current.id === item.id ? item : current)
}

const INTEGER_KEYS = new Set(['responseMs', 'response_ms', 'durationSeconds', 'duration_seconds', 'score', 'wave', 'accuracy', 'reps', 'lapses', 'state', 'memoryLevel', 'memory_level', 'lastRating', 'last_rating', 'learningSteps', 'learning_steps', 'scheduledDays', 'scheduled_days'])

const toSnake = (value: Record<string, unknown>) => Object.fromEntries(
  Object.entries(value).map(([key, item]) => {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
    const finalVal = typeof item === 'number' && INTEGER_KEYS.has(key) ? Math.round(item) : item
    return [snakeKey, finalVal]
  }),
)

const toCamel = (value: Record<string, unknown>) => Object.fromEntries(
  Object.entries(value).map(([key, item]) => [key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), item]),
)

const legacyLevel = (rating: number | null | undefined): ReviewEvent['rating'] =>
  rating === 4 ? 6 : rating === 3 ? 4 : rating === 2 ? 2 : 1

function normalizeCard(card: SrsCard): SrsCard {
  if (card.memoryLevel >= 1 && card.memoryLevel <= 7) return card
  const memoryLevel = legacyLevel(card.lastRating)
  return { ...card, memoryLevel, lastRating: card.lastRating === null ? null : memoryLevel }
}

function prepareSnapshot(snapshot: AppSnapshot): AppSnapshot {
  const cards = snapshot.cards ?? []
  const legacy = cards.some((card) => !(card.memoryLevel >= 1 && card.memoryLevel <= 6))
  const decks = (snapshot.decks ?? []).map((deck) => ({
    ...deck,
    source: deck.source ?? ((deck.name === 'Vocab Siege Starter' || deck.name === 'WordForge Starter') ? 'starter' as const : 'manual' as const),
    sourceKey: deck.sourceKey ?? '',
  }))
  const deckSources = new Map(decks.map((deck) => [deck.id, deck.source]))
  return {
    ...snapshot,
    profile: { ...snapshot.profile, ttsVoice: snapshot.profile.ttsVoice ?? DEFAULT_TTS_VOICE },
    decks,
    vocabulary: (snapshot.vocabulary ?? []).map((word) => ({
      ...word,
      source: word.source ?? (deckSources.get(word.deckId) === 'starter' ? 'starter' as const : 'manual' as const),
      sourceKey: word.sourceKey ?? '',
    })),
    cards: cards.map(normalizeCard),
    reviews: legacy ? (snapshot.reviews ?? []).map((review) => ({ ...review, rating: legacyLevel(review.rating) })) : (snapshot.reviews ?? []),
    gameRuns: snapshot.gameRuns ?? [],
    practiceSessions: snapshot.practiceSessions ?? [],
  }
}

function normalizeSnapshot(snapshot: AppSnapshot): AppSnapshot {
  return deduplicateSnapshot(prepareSnapshot(snapshot)).snapshot
}

async function upsertCloud(table: string, value: Record<string, unknown>): Promise<void> {
  if (!supabase) throw new Error('Supabase chưa được cấu hình')
  const { error } = await supabase.from(table).upsert(toSnake(value))
  if (error) throw error
}

async function fetchCloudRows(
  table: string,
  userId: string,
  orderColumn: string,
  ascending: boolean,
  maximum = Number.POSITIVE_INFINITY,
): Promise<Record<string, unknown>[]> {
  if (!supabase) throw new Error('Supabase chưa được cấu hình')
  const pageSize = 500
  const rows: Record<string, unknown>[] = []
  while (rows.length < maximum) {
    const size = Math.min(pageSize, maximum - rows.length)
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order(orderColumn, { ascending })
      .order('id', { ascending: true })
      .range(rows.length, rows.length + size - 1)
    if (error) throw error
    const page = (data ?? []) as Record<string, unknown>[]
    rows.push(...page)
    if (page.length < size) break
  }
  return rows
}

async function upsertCloudBatch(table: string, values: Record<string, unknown>[]): Promise<void> {
  if (!supabase) throw new Error('Supabase chưa được cấu hình')
  const batchSize = 250
  for (let offset = 0; offset < values.length; offset += batchSize) {
    const { error } = await supabase.from(table).upsert(values.slice(offset, offset + batchSize).map(toSnake))
    if (error) throw error
  }
}

export class CloudRepository implements AppRepository {
  async load(userId: string): Promise<AppSnapshot | null> {
    if (!supabase) throw new Error('Supabase chưa được cấu hình')
    const [profileResult, decks, vocabulary, cards, reviews, gameRuns, practiceSessions] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      fetchCloudRows('decks', userId, 'created_at', true),
      fetchCloudRows('vocabulary_items', userId, 'created_at', true),
      fetchCloudRows('srs_cards', userId, 'created_at', true),
      fetchCloudRows('review_events', userId, 'reviewed_at', false, 5_000),
      fetchCloudRows('game_runs', userId, 'created_at', false, 500),
      fetchCloudRows('practice_sessions', userId, 'created_at', false, 200),
    ])
    if (profileResult.error) throw profileResult.error
    if (!profileResult.data || !decks.length) return null
    const convert = <T,>(rows: Record<string, unknown>[]): T[] => rows.map((row) => toCamel(row) as unknown as T)
    return normalizeSnapshot({
      profile: toCamel(profileResult.data) as unknown as Profile,
      decks: convert<Deck>(decks),
      vocabulary: convert<VocabularyItem>(vocabulary),
      cards: convert<SrsCard>(cards).map(normalizeCard),
      reviews: convert<ReviewEvent>(reviews),
      gameRuns: convert<GameRun>(gameRuns),
      practiceSessions: convert<PracticeSession>(practiceSessions),
    })
  }

  async saveProfile(profile: Profile) { await upsertCloud('profiles', profile as unknown as Record<string, unknown>) }
  async saveDeck(deck: Deck) { await upsertCloud('decks', deck as unknown as Record<string, unknown>) }
  async deleteDeck(deckId: string) {
    if (!supabase) throw new Error('Supabase chưa được cấu hình')
    const { error } = await supabase.from('decks').delete().eq('id', deckId)
    if (error) throw error
  }
  async saveWord(word: VocabularyItem) { await upsertCloud('vocabulary_items', word as unknown as Record<string, unknown>) }
  async saveWords(words: VocabularyItem[]) {
    await upsertCloudBatch('vocabulary_items', words as unknown as Record<string, unknown>[])
  }
  async deleteWord(wordId: string) {
    if (!supabase) throw new Error('Supabase chưa được cấu hình')
    const { error } = await supabase.from('vocabulary_items').delete().eq('id', wordId)
    if (error) throw error
  }
  async saveCard(card: SrsCard) { await upsertCloud('srs_cards', card as unknown as Record<string, unknown>) }
  async saveCards(cards: SrsCard[]) {
    if (!cards.length) return
    await upsertCloudBatch('srs_cards', cards as unknown as Record<string, unknown>[])
  }
  async addReview(event: ReviewEvent) { await upsertCloud('review_events', event as unknown as Record<string, unknown>) }
  async addReviews(events: ReviewEvent[]) {
    if (!events.length) return
    await upsertCloudBatch('review_events', events as unknown as Record<string, unknown>[])
  }
  async addGameRun(run: GameRun) { await upsertCloud('game_runs', run as unknown as Record<string, unknown>) }
  async savePracticeSession(session: PracticeSession) {
    try {
      await upsertCloud('practice_sessions', session as unknown as Record<string, unknown>)
    } catch (err) {
      console.warn('Lưu practice_session lên cloud thất bại:', err)
    }
  }
  async restore(snapshot: AppSnapshot) {
    snapshot = deduplicateSnapshot(snapshot).snapshot
    await this.saveProfile(snapshot.profile)
    await Promise.all(snapshot.decks.map((item) => this.saveDeck(item)))
    await this.saveWords(snapshot.vocabulary)
    await Promise.all(snapshot.cards.map((item) => this.saveCard(item)))
    await Promise.all(snapshot.reviews.map((item) => this.addReview(item)))
    await Promise.all(snapshot.gameRuns.map((item) => this.addGameRun(item)))
    await Promise.all(snapshot.practiceSessions.map((item) => this.savePracticeSession(item)))
  }
  async loadLearnSession(userId: string): Promise<LearnSession | null> {
    if (!supabase) throw new Error('Supabase chưa được cấu hình')
    const { data, error } = await supabase
      .from('learn_sessions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return toCamel(data) as unknown as LearnSession
  }
  async saveLearnSession(session: LearnSession) {
    if (!supabase) throw new Error('Supabase chưa được cấu hình')
    const { error } = await supabase
      .from('learn_sessions')
      .upsert(toSnake(session as unknown as Record<string, unknown>))
    if (error) throw error
  }
}
