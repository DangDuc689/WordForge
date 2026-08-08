import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { ACTIVITY_INTENSITY_THRESHOLDS, buildActivityCalendar } from '../lib/activityCalendar'

const WEEKDAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN']

export function ActivityCalendar() {
  const { snapshot } = useApp()
  const timezone = snapshot.profile.timezone || 'Asia/Saigon'
  const {
    weeks,
    totalActiveDays,
    attendanceRate,
    currentStreak,
    rangeLabel,
  } = useMemo(
    () => buildActivityCalendar(snapshot, timezone, new Date()),
    [snapshot, timezone],
  )

  return (
    <article className="panel activity-calendar-panel">
      <div className="section-title">
        <span>
          <b>Hành trình rèn luyện</b>
          <small>6 tháng gần nhất · {rangeLabel}</small>
        </span>
        <div className="heatmap-intensity-legend" aria-label="Mức độ hoạt động từ ít đến nhiều">
          <span>Ít</span>
          <i className="legend-box level-0" title="Chưa hoạt động" />
          {ACTIVITY_INTENSITY_THRESHOLDS.map((threshold, index) => (
            <i
              key={threshold}
              className={`legend-box level-${index + 1}`}
              title={`Mức độ hoạt động ${index + 1}`}
            />
          ))}
          <span>Nhiều</span>
        </div>
      </div>

      <div className="heatmap-frame">
        <div className="heatmap-scroll-area">
          <div className="heatmap-header-row">
            <div className="heatmap-row-label-placeholder" />
            <div className="heatmap-months">
              {weeks.map((week, colIdx) => (
                <div key={colIdx} className="heatmap-month-col">
                  {week.monthLabel ? (
                    <span className={colIdx >= weeks.length - 4 ? 'month-label-end' : ''}>
                      {week.monthLabel}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="heatmap-grid-body" role="grid" aria-label={`Lịch sử hoạt động ${rangeLabel}`}>
            <div className="heatmap-weekdays">
              {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
            </div>
            <div className="heatmap-weeks">
              {weeks.map((week, colIdx) => (
                <div key={colIdx} className="heatmap-week-col">
                  {week.days.map((day, rowIdx) => (
                    <div
                      key={`${day.dateStr}-${rowIdx}`}
                      className={`heatmap-cell ${day.status} level-${day.level}${day.isToday ? ' today' : ''}`}
                      title={day.tooltip || undefined}
                      aria-label={day.tooltip || undefined}
                      aria-current={day.isToday ? 'date' : undefined}
                      aria-hidden={day.status === 'outside' ? true : undefined}
                      role="gridcell"
                      tabIndex={day.status === 'outside' ? -1 : 0}
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
          <span>🔥 Chuỗi hiện tại: <b>{currentStreak}</b> ngày liên tiếp</span>
        </div>
      </div>
    </article>
  )
}
