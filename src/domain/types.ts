export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'phrase' | 'adverb' | 'pronoun' | 'determiner' | 'preposition' | 'conjunction' | 'interjection' | 'numeral' | 'modal' | 'auxiliary' | 'infinitive-marker' | 'other'
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | ''
export type VocabularyStatus = 'active' | 'archived'
export type VocabularySource = 'manual' | 'starter' | 'oxford-3000'
export type ReviewMode = 'learn' | 'review' | 'game-typing' | 'game-touch' | 'ai-quiz'
/** The six fixed memory levels used by the review schedule. */
export type ReviewRating = 1 | 2 | 3 | 4 | 5 | 6

export interface Profile {
  id: string
  timezone: string
  newWordsPerSession: number
  desiredRetention: number
  aiEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface Deck {
  id: string
  userId: string
  name: string
  description: string
  source: VocabularySource
  sourceKey: string
  createdAt: string
  updatedAt: string
}

export interface VocabularyItem {
  id: string
  userId: string
  deckId: string
  english: string
  vietnamese: string
  acceptedAnswers: string[]
  partOfSpeech: PartOfSpeech
  tier: 1 | 2 | 3
  cefr: CefrLevel
  ipa: string
  exampleEn: string
  exampleVi: string
  notes: string
  status: VocabularyStatus
  source: VocabularySource
  sourceKey: string
  createdAt: string
  updatedAt: string
}

export interface OxfordCatalogEntry {
  sourceKey: string
  english: string
  vietnamese: string
  acceptedAnswers: string[]
  partOfSpeech: PartOfSpeech
  cefr: Exclude<CefrLevel, 'C1' | 'C2' | ''>
  tier: 1 | 2 | 3
  ipa: string
  exampleEn: string
  exampleVi: string
  notes: string
}

export interface OxfordCatalog {
  schemaVersion: 1
  catalogVersion: string
  variant: 'en-US'
  level: Exclude<CefrLevel, 'C1' | 'C2' | ''>
  sourceUrl: string
  generatedAt: string
  entries: OxfordCatalogEntry[]
}

export interface VocabularyImportResult {
  created: number
  skipped: number
  failed: number
  deckIds: string[]
}

export interface SrsCard {
  id: string
  userId: string
  vocabularyId: string
  memoryLevel: ReviewRating
  dueAt: string
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  state: 0 | 1 | 2 | 3
  lastReviewAt: string | null
  lastRating: ReviewRating | null
  createdAt: string
  updatedAt: string
}

export interface ReviewEvent {
  id: string
  userId: string
  vocabularyId: string
  mode: ReviewMode
  rating: ReviewRating
  correct: boolean
  responseMs: number | null
  usedHint: boolean
  submittedAnswer: string
  reviewedAt: string
}

export interface GameRun {
  id: string
  userId: string
  deckId: string
  score: number
  wave: number
  accuracy: number
  durationSeconds: number
  inputMode: 'typing' | 'touch'
  createdAt: string
}

export interface PracticeSession {
  id: string
  userId: string
  deckId: string | null
  format: 'reading' | 'quiz'
  targetVocabularyIds: string[]
  content: AiPracticeSet
  score: number | null
  createdAt: string
}

export interface AiVocabularyDraft {
  english: string
  vietnamese: string
  acceptedAnswers: string[]
  partOfSpeech: PartOfSpeech
  tier: 1 | 2 | 3
  cefr: CefrLevel
  ipa: string
  exampleEn: string
  exampleVi: string
  notes: string
}

export interface AiPracticeQuestion {
  id: string
  vocabularyId: string | null
  prompt: string
  choices: string[]
  answer: string
  explanation: string
}

export interface AiPracticeSet {
  title: string
  format: 'reading' | 'quiz'
  passage: string
  passageVi: string
  questions: AiPracticeQuestion[]
}

export interface GameWord {
  id: string
  english: string
  vietnamese: string
  acceptedAnswers: string[]
  category: PartOfSpeech
  tier: 1 | 2 | 3
  isDue: boolean
}

export interface GameOutcome {
  vocabularyId: string
  terminal: 'killed' | 'breached'
  responseMs: number
  usedHint: boolean
  hadTargetMistake: boolean
}

export interface AppSnapshot {
  profile: Profile
  decks: Deck[]
  vocabulary: VocabularyItem[]
  cards: SrsCard[]
  reviews: ReviewEvent[]
  gameRuns: GameRun[]
  practiceSessions: PracticeSession[]
}

export interface DashboardStats {
  newCount: number
  learnedCount: number
  learningCount: number
  dueCount: number
  weakCount: number
  streak: number
  accuracy: number
}
