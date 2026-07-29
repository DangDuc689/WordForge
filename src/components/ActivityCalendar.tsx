import { useMemo } from 'react'
import { useApp } from '../context/AppContext'

const dayKey = (value: Date | string, timezone: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(typeof value === 'string' ? new Date(value) : value)

interface DayCell {
  dateStr: string
  status: 'active' | 'inactive' | 'future' | 'outside'
  tooltip: string
  count: number
}

interface WeekColumn {
  monthLabel: string
  days: DayCell[]
}

export function ActivityCalendar() {
  const { snapshot, stats } = useApp()
  const timezone = snapshot.profile.timezone || 'Asia/Saigon'

  const { weeks, totalActiveDays, totalPastDays, currentYear } = useMemo(() => {
    // 1. Tổng hợp tần suất hoạt động học tập hàng ngày
    const activityMap = new Map<string, number>()
    const increment = (dateValue?: Date | string | null) => {
      if (!dateValue) return
      try {
        const key = dayKey(dateValue, timezone)
        activityMap.set(key, (activityMap.get(key) || 0) + 1)
      } catch {
        // Bỏ qua mốc thời gian không hợp lệ
      }
    }

    snapshot.reviews.forEach((item) => increment(item.reviewedAt))
    snapshot.gameRuns.forEach((item) => increment(item.createdAt))
    snapshot.practiceSessions.forEach((item) => increment(item.createdAt))
    snapshot.cards.forEach((item) => increment(item.lastReviewAt || item.createdAt))

    // 2. Tính toán khung thời gian theo năm dương lịch hiện tại (Từ Tháng 1 đến Tháng 12)
    const nowStr = dayKey(new Date(), timezone)
    const [nowYear, nowMonth, nowDay] = nowStr.split('-').map(Number)
    // Lấy thời gian 12:00 trưa (noon) để đảm bảo không bị nhảy ngày khi qua các mốc Daylight Saving
    const today = new Date(nowYear, nowMonth - 1, nowDay, 12, 0, 0)

    const currentYear = today.getFullYear()
    // Ngày 1 tháng 1 của năm hiện tại
    const jan1 = new Date(currentYear, 0, 1, 12, 0, 0)
    const dayOfWeek = jan1.getDay()
    // Đổi ngày trong tuần sang chuẩn ISO (Thứ 2 = 0, Chủ nhật = 6)
    const isoDayOfWeek = (dayOfWeek + 6) % 7

    // Ngày Thứ 2 đầu tiên của tuần chứa ngày 1/1
    const startMonday = new Date(jan1)
    startMonday.setDate(jan1.getDate() - isoDayOfWeek)

    const generatedWeeks: WeekColumn[] = []
    let activeDaysCount = 0
    let pastDaysCount = 0
    let lastDisplayedMonth: number | null = null

    let col = 0
    while (true) {
      const weekMonday = new Date(startMonday)
      weekMonday.setDate(startMonday.getDate() + col * 7)

      // Nếu ngày Thứ 2 của tuần đã lọt hẳn sang năm tiếp theo (và đã lặp qua ít nhất 52 tuần) thì dừng lại
      if (weekMonday.getFullYear() > currentYear && col >= 52) {
        break
      }
      if (col > 53) break // Giới hạn an toàn tránh lặp vô hạn

      // Sử dụng ngày Thứ 5 (giữa tuần - chuẩn ISO 8601) để xác định chính xác tuần thuộc tháng nào
      const midWeek = new Date(weekMonday)
      midWeek.setDate(weekMonday.getDate() + 3)
      const currentMonth = midWeek.getMonth()
      const midWeekYear = midWeek.getFullYear()

      let monthLabel = ''
      // Gán nhãn cho tuần đầu tiên chuyển sang tháng mới trong năm hiện tại
      if (midWeekYear === currentYear && currentMonth !== lastDisplayedMonth) {
        monthLabel = `Tháng ${currentMonth + 1}`
        lastDisplayedMonth = currentMonth
      }

      const days: DayCell[] = []
      for (let row = 0; row < 7; row++) {
        const cellDate = new Date(weekMonday)
        cellDate.setDate(weekMonday.getDate() + row)

        const dateStr = dayKey(cellDate, timezone)
        const count = activityMap.get(dateStr) || 0

        const dateFormatted = new Intl.DateTimeFormat('vi-VN', {
          weekday: 'long',
          day: 'numeric',
          month: 'numeric',
          year: 'numeric',
        }).format(cellDate)

        let status: 'active' | 'inactive' | 'future' | 'outside' = 'inactive'
        let tooltip = `${dateFormatted}: Chưa hoạt động`

        // Những ngày thuộc năm cũ hoặc năm sau ở các ô biên sẽ được ẩn đi để form dạng chính xác theo năm
        if (cellDate.getFullYear() !== currentYear) {
          status = 'outside'
          tooltip = ''
        } else if (cellDate.getTime() > today.getTime()) {
          status = 'future'
          tooltip = `${dateFormatted}: Chưa đến`
        } else {
          pastDaysCount++
          if (count > 0) {
            status = 'active'
            activeDaysCount++
            tooltip = `${dateFormatted}: Có hoạt động (${count} lượt học/ôn)`
          }
        }

        days.push({ dateStr, status, tooltip, count })
      }

      generatedWeeks.push({ monthLabel, days })
      col++
    }

    return {
      weeks: generatedWeeks,
      totalActiveDays: activeDaysCount,
      totalPastDays: pastDaysCount,
      currentYear,
    }
  }, [snapshot, timezone])

  const attendanceRate = totalPastDays > 0 ? Math.round((totalActiveDays / totalPastDays) * 100) : 0

  return (
    <article className="panel activity-calendar-panel">
      <div className="section-title">
        <span>
          <b>Hành trình rèn luyện</b>
          <small>Theo dõi tần suất và duy trì nhịp độ học tập trong toàn bộ năm {currentYear}</small>
        </span>
        <div className="heatmap-legend">
          <span className="legend-item">
            <i className="legend-box active" />
            Có hoạt động
          </span>
          <span className="legend-item">
            <i className="legend-box inactive" />
            Chưa hoạt động
          </span>
        </div>
      </div>

      <div className="heatmap-frame">
        <div className="heatmap-scroll-area">
          <div className="heatmap-header-row">
            <div className="heatmap-row-label-placeholder" />
            <div className="heatmap-months">
              {weeks.map((week, colIdx) => (
                <div key={colIdx} className="heatmap-month-col">
                  {week.monthLabel ? <span>{week.monthLabel}</span> : null}
                </div>
              ))}
            </div>
          </div>

          <div className="heatmap-grid-body" role="grid" aria-label={`Lịch sử hoạt động năm ${currentYear}`}>
            <div className="heatmap-weekdays">
              <span>Thứ 2</span>
              <span />
              <span>Thứ 4</span>
              <span />
              <span>Thứ 6</span>
              <span />
              <span>CN</span>
            </div>
            <div className="heatmap-weeks">
              {weeks.map((week, colIdx) => (
                <div key={colIdx} className="heatmap-week-col">
                  {week.days.map((day, rowIdx) => (
                    <div
                      key={rowIdx}
                      className={`heatmap-cell ${day.status}`}
                      title={day.tooltip}
                      aria-label={day.tooltip}
                      role="gridcell"
                      tabIndex={0}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="heatmap-footer">
          <span>⚡ <b>{totalActiveDays}</b> ngày hoạt động</span>
          <span>🎯 Tỷ lệ chuyên cần: <b>{attendanceRate}%</b></span>
          <span>🔥 Chuỗi hiện tại: <b>{stats.streak}</b> ngày liên tiếp</span>
        </div>
      </div>
    </article>
  )
}
