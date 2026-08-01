import { describe, expect, it } from 'vitest'
import type { AppSnapshot, ReviewEvent } from '../domain/types'
import { buildActivityCalendar, getActivityLevel } from './activityCalendar'

const NOW = new Date('2026-07-29T12:00:00.000Z')

function review(reviewedAt: string, overrides: Partial<ReviewEvent> = {}): ReviewEvent {
  return {
    id: crypto.randomUUID(),
    userId: 'user-1',
    vocabularyId: crypto.randomUUID(),
    mode: 'review',
    rating: 2,
    correct: true,
    responseMs: 1_000,
    usedHint: false,
    submittedAnswer: 'answer',
    reviewedAt,
    ...overrides,
  }
}

function snapshot(overrides: Partial<AppSnapshot> = {}): AppSnapshot {
  return {
    profile: {
      id: 'user-1',
      timezone: 'UTC',
      newWordsPerSession: 10,
      desiredRetention: 0.9,
      aiEnabled: false,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
    decks: [],
    vocabulary: [],
    cards: [],
    reviews: [],
    gameRuns: [],
    practiceSessions: [],
    ...overrides,
  }
}

const findDay = (data: ReturnType<typeof buildActivityCalendar>, dateStr: string) => {
  const week = data.weeks.find((candidate) => candidate.days.some((day) => day.dateStr === dateStr))
  const row = week?.days.findIndex((day) => day.dateStr === dateStr) ?? -1
  return { day: week?.days[row], row }
}

describe('buildActivityCalendar', () => {
  it('always renders seven weekday rows and keeps Tuesday, Thursday, and Saturday activity', () => {
    const data = buildActivityCalendar(snapshot({
      reviews: [
        review('2026-06-02T12:00:00.000Z'),
        review('2026-06-04T12:00:00.000Z'),
        review('2026-06-06T12:00:00.000Z'),
      ],
    }), 'UTC', NOW)

    expect(data.weeks.every((week) => week.days.length === 7)).toBe(true)
    expect(findDay(data, '2026-06-02')).toMatchObject({ row: 1, day: { status: 'active' } })
    expect(findDay(data, '2026-06-04')).toMatchObject({ row: 3, day: { status: 'active' } })
    expect(findDay(data, '2026-06-06')).toMatchObject({ row: 5, day: { status: 'active' } })
  })

  it('uses a six-calendar-month trailing window with no visible future dates', () => {
    const data = buildActivityCalendar(snapshot(), 'UTC', NOW)
    const visibleDays = data.weeks.flatMap((week) => week.days)
      .filter((day) => day.status !== 'outside')

    expect(data.windowStart).toBe('2026-02-01')
    expect(data.windowEnd).toBe('2026-07-29')
    expect(visibleDays[0]?.dateStr).toBe('2026-02-01')
    expect(visibleDays.at(-1)?.dateStr).toBe('2026-07-29')
    expect(visibleDays.every((day) => day.dateStr <= '2026-07-29')).toBe(true)
    expect(data.weeks.filter((week) => week.monthLabel)).toHaveLength(6)
  })

  it('calculates attendance only from the later of tracking start and window start', () => {
    const data = buildActivityCalendar(snapshot({
      profile: {
        ...snapshot().profile,
        createdAt: '2026-07-25T00:00:00.000Z',
      },
      reviews: [
        review('2026-07-27T12:00:00.000Z'),
        review('2026-07-28T12:00:00.000Z'),
      ],
    }), 'UTC', NOW)

    expect(data.totalPastDays).toBe(5)
    expect(data.totalActiveDays).toBe(2)
    expect(data.attendanceRate).toBe(40)
    expect(data.currentStreak).toBe(2)
  })

  it('aggregates learned and reviewed event counts without using legacy XP sources', () => {
    const date = '2026-07-28T12:00:00.000Z'
    const data = buildActivityCalendar(snapshot({
      reviews: [
        review(date, { mode: 'learn' }),
        review(date),
        review(date, { mode: 'game-typing' }),
      ],
      gameRuns: [{
        id: 'run-1',
        userId: 'user-1',
        deckId: 'deck-1',
        score: 100,
        wave: 1,
        accuracy: 100,
        durationSeconds: 60,
        inputMode: 'typing',
        createdAt: date,
      }],
      practiceSessions: [{
        id: 'practice-1',
        userId: 'user-1',
        deckId: null,
        format: 'quiz',
        targetVocabularyIds: [],
        content: {
          title: 'Quiz',
          format: 'quiz',
          passage: '',
          passageVi: '',
          questions: [],
          glossary: [],
        },
        score: 40,
        completedAt: date,
        createdAt: date,
      }],
    }), 'UTC', NOW)

    const { day } = findDay(data, '2026-07-28')
    expect(day).toMatchObject({
      learnedCount: 1,
      reviewedCount: 2,
      activityCount: 3,
      intensityScore: 4,
      level: 2,
      status: 'active',
    })
    expect(day?.tooltip).toContain('Đã học 1 lượt')
    expect(day?.tooltip).toContain('Đã ôn 2 lượt')
    expect(day?.tooltip).not.toContain('XP')
  })

  it('makes learning deepen the green faster than reviewing', () => {
    const date = '2026-07-28T12:00:00.000Z'
    const learnedDay = findDay(buildActivityCalendar(snapshot({
      reviews: [review(date, { mode: 'learn' }), review(date, { mode: 'learn' })],
    }), 'UTC', NOW), '2026-07-28').day
    const reviewedDay = findDay(buildActivityCalendar(snapshot({
      reviews: [review(date), review(date)],
    }), 'UTC', NOW), '2026-07-28').day

    expect(learnedDay).toMatchObject({ intensityScore: 4, level: 2 })
    expect(reviewedDay).toMatchObject({ intensityScore: 2, level: 1 })
  })

  it('marks today independently of whether today has activity', () => {
    const emptyToday = findDay(buildActivityCalendar(snapshot(), 'UTC', NOW), '2026-07-29').day
    const activeToday = findDay(buildActivityCalendar(snapshot({
      reviews: [review('2026-07-29T08:00:00.000Z')],
    }), 'UTC', NOW), '2026-07-29').day

    expect(emptyToday).toMatchObject({ isToday: true, status: 'inactive', level: 0 })
    expect(activeToday).toMatchObject({ isToday: true, status: 'active', level: 1 })
  })
})

describe('getActivityLevel', () => {
  it.each([
    [0, 0],
    [1, 1],
    [2, 1],
    [3, 2],
    [5, 2],
    [6, 3],
    [10, 3],
    [11, 4],
  ])('maps %i intensity points to level %i', (intensityScore, level) => {
    expect(getActivityLevel(intensityScore)).toBe(level)
  })
})
