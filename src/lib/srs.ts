import type {
  DashboardStats,
  GameOutcome,
  ReviewEvent,
  ReviewMode,
  ReviewRating,
  SrsCard,
  VocabularyItem,
} from '../domain/types'

export const MEMORY_LEVELS = [
  { level: 1 as ReviewRating, label: 'Cấp độ 1', shortLabel: 'LV1', delayMs: 2 * 60 * 60 * 1000, delayLabel: 'sau 2 giờ', color: '#ef4444' },
  { level: 2 as ReviewRating, label: 'Cấp độ 2', shortLabel: 'LV2', delayMs: 24 * 60 * 60 * 1000, delayLabel: 'sau 1 ngày', color: '#f97316' },
  { level: 3 as ReviewRating, label: 'Cấp độ 3', shortLabel: 'LV3', delayMs: 2 * 24 * 60 * 60 * 1000, delayLabel: 'sau 2 ngày', color: '#eab308' },
  { level: 4 as ReviewRating, label: 'Cấp độ 4', shortLabel: 'LV4', delayMs: 3 * 24 * 60 * 60 * 1000, delayLabel: 'sau 3 ngày', color: '#84cc16' },
  { level: 5 as ReviewRating, label: 'Cấp độ 5', shortLabel: 'LV5', delayMs: 5 * 24 * 60 * 60 * 1000, delayLabel: 'sau 5 ngày', color: '#10b981' },
  { level: 6 as ReviewRating, label: 'Nhớ sâu', shortLabel: 'Nhớ sâu', delayMs: 8 * 24 * 60 * 60 * 1000, delayLabel: 'sau 8 ngày', color: '#3b82f6' },
] as const

export const memoryLevelInfo = (level: ReviewRating) => MEMORY_LEVELS[level - 1]

export function nextMemoryLevel(card: SrsCard, correct: boolean): ReviewRating {
  if (card.reps === 0) {
    return 1 as ReviewRating
  }
  const current = card.memoryLevel >= 1 && card.memoryLevel <= 6 ? card.memoryLevel : 1
  return Math.max(1, Math.min(6, current + (correct ? 1 : -1))) as ReviewRating
}

export function createSrsCard(userId: string, vocabularyId: string, now = new Date()): SrsCard {
  const stamp = now.toISOString()
  const schedule = memoryLevelInfo(1)
  return {
    id: crypto.randomUUID(), userId, vocabularyId, memoryLevel: 1,
    dueAt: new Date(now.getTime() + schedule.delayMs).toISOString(),
    stability: schedule.delayMs / 86_400_000, difficulty: 0, elapsedDays: 0,
    scheduledDays: 0, learningSteps: 1, reps: 0, lapses: 0, state: 1,
    lastReviewAt: null, lastRating: null, createdAt: stamp, updatedAt: stamp,
  }
}

export interface ReviewResult {
  card: SrsCard
  event: ReviewEvent
}

export function scheduleReview(args: {
  card: SrsCard
  mode: ReviewMode
  correct: boolean
  submittedAnswer?: string
  responseMs?: number | null
  usedHint?: boolean
  now?: Date
  eventId?: string
}): ReviewResult {
  const now = args.now ?? new Date()
  const level = nextMemoryLevel(args.card, args.correct)
  const schedule = memoryLevelInfo(level)
  const stamp = now.toISOString()
  const previousReview = args.card.lastReviewAt ? new Date(args.card.lastReviewAt) : null
  const elapsedDays = previousReview ? Math.max(0, Math.floor((now.getTime() - previousReview.getTime()) / 86_400_000)) : 0
  return {
    card: {
      ...args.card,
      memoryLevel: level,
      dueAt: new Date(now.getTime() + schedule.delayMs).toISOString(),
      stability: schedule.delayMs / 86_400_000,
      elapsedDays,
      scheduledDays: schedule.delayMs >= 86_400_000 ? schedule.delayMs / 86_400_000 : 0,
      learningSteps: level === 1 ? 1 : 0,
      reps: args.card.reps + 1,
      lapses: args.card.lapses + (args.correct ? 0 : 1),
      state: level === 1 ? 1 : 2,
      lastReviewAt: stamp,
      lastRating: level,
      updatedAt: stamp,
    },
    event: {
      id: args.eventId ?? crypto.randomUUID(), userId: args.card.userId, vocabularyId: args.card.vocabularyId,
      mode: args.mode, rating: level, correct: args.correct,
      responseMs: args.responseMs != null ? Math.round(args.responseMs) : null, usedHint: args.usedHint ?? false,
      submittedAnswer: args.submittedAnswer ?? '', reviewedAt: stamp,
    },
  }
}

export function ratingFromGameOutcome(outcome: GameOutcome): boolean {
  return outcome.terminal === 'killed'
}

/** Collapse repeated game appearances into one review event per vocabulary item. */
export function aggregateGameOutcomes(outcomes: GameOutcome[]): GameOutcome[] {
  const grouped = new Map<string, GameOutcome>()
  for (const outcome of outcomes) {
    const previous = grouped.get(outcome.vocabularyId)
    const roundedOutcome = { ...outcome, responseMs: Math.round(outcome.responseMs) }
    if (!previous) { grouped.set(outcome.vocabularyId, roundedOutcome); continue }
    grouped.set(outcome.vocabularyId, {
      ...previous,
      terminal: previous.terminal === 'breached' || outcome.terminal === 'breached' ? 'breached' : 'killed',
      responseMs: Math.round(Math.max(previous.responseMs, roundedOutcome.responseMs)),
      usedHint: previous.usedHint || outcome.usedHint,
      hadTargetMistake: previous.hadTargetMistake || outcome.hadTargetMistake,
    })
  }
  return [...grouped.values()]
}

export function isDue(card: SrsCard | undefined, now = new Date()): boolean {
  return Boolean(card && new Date(card.dueAt).getTime() <= now.getTime())
}

export function isKnownCard(card: SrsCard | undefined): boolean {
  return Boolean(card && card.reps >= 2 && card.memoryLevel >= 2)
}

const dayKey = (value: Date | string, timezone: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(typeof value === 'string' ? new Date(value) : value)

function calculateStreak(reviews: ReviewEvent[], timezone: string, now: Date): number {
  const activeDays = new Set(reviews.map((review) => dayKey(review.reviewedAt, timezone)))
  let cursor = new Date(now)
  if (!activeDays.has(dayKey(cursor, timezone))) cursor = new Date(cursor.getTime() - 86_400_000)
  let streak = 0
  while (activeDays.has(dayKey(cursor, timezone))) {
    streak += 1
    cursor = new Date(cursor.getTime() - 86_400_000)
  }
  return streak
}

export function buildDashboardStats(
  vocabulary: VocabularyItem[], cards: SrsCard[], reviews: ReviewEvent[],
  timezone = 'Asia/Saigon', now = new Date(),
): DashboardStats {
  const activeIds = new Set(vocabulary.map((item) => item.id))
  const activeCards = cards.filter((card) => activeIds.has(card.vocabularyId))
  const reviewed = reviews.filter((event) => activeIds.has(event.vocabularyId))
  const correct = reviewed.filter((event) => event.correct).length
  const todayStr = dayKey(now, timezone)
  return {
    newCount: vocabulary.filter((item) => !cards.some((card) => card.vocabularyId === item.id)).length,
    learnedCount: activeCards.length,
    learningCount: activeCards.filter((card) => card.memoryLevel <= 1).length,
    dueCount: activeCards.filter((card) => isDue(card, now)).length,
    weakCount: activeCards.filter((card) => card.memoryLevel <= 2 || card.lapses > 0).length,
    streak: calculateStreak(reviewed, timezone, now),
    accuracy: reviewed.length ? Math.round((correct / reviewed.length) * 100) : 100,
    todayLearnedCount: activeCards.filter((card) => dayKey(card.createdAt, timezone) === todayStr).length,
    todayReviewedCount: new Set(
      reviewed
        .filter((event) => dayKey(event.reviewedAt, timezone) === todayStr)
        .map((event) => event.vocabularyId)
    ).size,
  }
}
