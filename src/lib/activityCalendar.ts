import type { AppSnapshot } from '../domain/types'

export const ACTIVITY_INTENSITY_THRESHOLDS = [4, 12, 24, 44] as const
export const LEARN_INTENSITY_WEIGHT = 2
export const REVIEW_INTENSITY_WEIGHT = 1

export type ActivityLevel = 0 | 1 | 2 | 3 | 4
export type ActivityCellStatus = 'active' | 'inactive' | 'outside'

export interface ActivityDayCell {
  dateStr: string
  status: ActivityCellStatus
  level: ActivityLevel
  isToday: boolean
  activityCount: number
  intensityScore: number
  learnedCount: number
  reviewedCount: number
  tooltip: string
}

export interface ActivityWeekColumn {
  monthLabel: string
  days: ActivityDayCell[]
}

export interface ActivityCalendarData {
  weeks: ActivityWeekColumn[]
  totalActiveDays: number
  totalPastDays: number
  attendanceRate: number
  currentStreak: number
  rangeLabel: string
  windowStart: string
  windowEnd: string
}

interface DailyActivity {
  learnedCount: number
  reviewedCount: number
}

export const dayKey = (value: Date | string, timezone: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(typeof value === 'string' ? new Date(value) : value)

const dateFromKey = (key: string): Date => new Date(`${key}T12:00:00.000Z`)

const keyFromDate = (date: Date): string => [
  date.getUTCFullYear(),
  String(date.getUTCMonth() + 1).padStart(2, '0'),
  String(date.getUTCDate()).padStart(2, '0'),
].join('-')

const addDays = (key: string, amount: number): string => {
  const date = dateFromKey(key)
  date.setUTCDate(date.getUTCDate() + amount)
  return keyFromDate(date)
}

const differenceInDays = (start: string, end: string): number =>
  Math.round((dateFromKey(end).getTime() - dateFromKey(start).getTime()) / 86_400_000)

const maxDateKey = (first: string, second: string): string => first > second ? first : second

export function getActivityLevel(intensityScore: number): ActivityLevel {
  if (intensityScore < ACTIVITY_INTENSITY_THRESHOLDS[0]) return 0
  if (intensityScore < ACTIVITY_INTENSITY_THRESHOLDS[1]) return 1
  if (intensityScore < ACTIVITY_INTENSITY_THRESHOLDS[2]) return 2
  if (intensityScore < ACTIVITY_INTENSITY_THRESHOLDS[3]) return 3
  return 4
}

function buildActivityMap(snapshot: AppSnapshot, timezone: string): Map<string, DailyActivity> {
  const activityMap = new Map<string, DailyActivity>()
  const increment = (dateValue: Date | string | null | undefined, isLearn: boolean) => {
    if (!dateValue) return
    try {
      const key = dayKey(dateValue, timezone)
      const current = activityMap.get(key) ?? { learnedCount: 0, reviewedCount: 0 }
      activityMap.set(key, {
        learnedCount: current.learnedCount + (isLearn ? 1 : 0),
        reviewedCount: current.reviewedCount + (isLearn ? 0 : 1),
      })
    } catch {
      // Ignore malformed timestamps from imported legacy backups.
    }
  }

  snapshot.reviews.forEach((review) => increment(review.reviewedAt, review.mode === 'learn'))

  return activityMap
}

function formatRangeLabel(windowStart: string, windowEnd: string): string {
  const start = dateFromKey(windowStart)
  const end = dateFromKey(windowEnd)
  const startYear = start.getUTCFullYear()
  const endYear = end.getUTCFullYear()
  if (startYear === endYear) {
    return `Tháng ${start.getUTCMonth() + 1} – Tháng ${end.getUTCMonth() + 1}/${endYear}`
  }
  return `Tháng ${start.getUTCMonth() + 1}/${startYear} – Tháng ${end.getUTCMonth() + 1}/${endYear}`
}

const formatVietnameseDate = (dateKey: string): string =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(dateFromKey(dateKey))

export function buildActivityCalendar(
  snapshot: AppSnapshot,
  timezone: string,
  now = new Date(),
): ActivityCalendarData {
  const todayKey = dayKey(now, timezone)
  const today = dateFromKey(todayKey)
  const windowStart = keyFromDate(new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth() - 5,
    1,
    12,
  )))
  const windowEnd = todayKey

  const windowStartDate = dateFromKey(windowStart)
  const startIsoWeekday = (windowStartDate.getUTCDay() + 6) % 7
  const calendarStart = addDays(windowStart, -startIsoWeekday)
  const endIsoWeekday = (today.getUTCDay() + 6) % 7
  const calendarEnd = addDays(windowEnd, 6 - endIsoWeekday)

  let trackingStart = windowStart
  try {
    trackingStart = maxDateKey(windowStart, dayKey(snapshot.profile.createdAt, timezone))
  } catch {
    // A malformed legacy profile date falls back to the visible window start.
  }
  if (trackingStart > windowEnd) trackingStart = windowEnd

  const activityMap = buildActivityMap(snapshot, timezone)
  const totalPastDays = differenceInDays(trackingStart, windowEnd) + 1
  const totalActiveDays = [...activityMap.entries()].filter(
    ([key, activity]) => key >= trackingStart
      && key <= windowEnd
      && activity.learnedCount + activity.reviewedCount > 0,
  ).length
  const attendanceRate = totalPastDays > 0
    ? Math.round((totalActiveDays / totalPastDays) * 100)
    : 0

  let streakCursor = activityMap.has(windowEnd) ? windowEnd : addDays(windowEnd, -1)
  let currentStreak = 0
  while (streakCursor >= trackingStart && activityMap.has(streakCursor)) {
    currentStreak += 1
    streakCursor = addDays(streakCursor, -1)
  }

  const weeks: ActivityWeekColumn[] = []
  let lastDisplayedMonth = ''
  for (let weekStart = calendarStart; weekStart <= calendarEnd; weekStart = addDays(weekStart, 7)) {
    const firstVisibleDay = [...Array(7)].map((_, row) => addDays(weekStart, row))
      .find((key) => key >= windowStart && key <= windowEnd)
    const visibleMonth = firstVisibleDay?.slice(0, 7) ?? ''
    const monthLabel = visibleMonth && visibleMonth !== lastDisplayedMonth
      ? `Tháng ${Number(visibleMonth.slice(5, 7))}`
      : ''
    if (visibleMonth) lastDisplayedMonth = visibleMonth

    const days = [...Array(7)].map((_, row): ActivityDayCell => {
      const dateStr = addDays(weekStart, row)
      const outside = dateStr < windowStart || dateStr > windowEnd
      const activity = outside ? undefined : activityMap.get(dateStr)
      const learnedCount = activity?.learnedCount ?? 0
      const reviewedCount = activity?.reviewedCount ?? 0
      const activityCount = learnedCount + reviewedCount
      const intensityScore = learnedCount * LEARN_INTENSITY_WEIGHT
        + reviewedCount * REVIEW_INTENSITY_WEIGHT
      const level = getActivityLevel(intensityScore)
      const status: ActivityCellStatus = outside ? 'outside' : level > 0 ? 'active' : 'inactive'
      const isToday = dateStr === todayKey
      const dateFormatted = outside ? '' : formatVietnameseDate(dateStr)
      const tooltip = outside
        ? ''
        : `${dateFormatted}: Đã học ${learnedCount} lượt · Đã ôn ${reviewedCount} lượt`

      return {
        dateStr,
        status,
        level,
        isToday,
        activityCount,
        intensityScore,
        learnedCount,
        reviewedCount,
        tooltip,
      }
    })

    weeks.push({ monthLabel, days })
  }

  return {
    weeks,
    totalActiveDays,
    totalPastDays,
    attendanceRate,
    currentStreak,
    rangeLabel: formatRangeLabel(windowStart, windowEnd),
    windowStart,
    windowEnd,
  }
}
