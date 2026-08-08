import { Link } from 'react-router-dom'
import { ActivityCalendar } from '../components/ActivityCalendar'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'

const statMeta = [
  ['newCount', 'Từ mới', 'Chưa bắt đầu', 'cyan'],
  ['learningCount', 'Đang học', 'Đang ở cấp độ 1', 'amber'],
  ['dueCount', 'Đến hạn', 'Nên ôn hôm nay', 'pink'],
  ['todayLearnedCount', 'Từ hôm nay', 'Đã học hôm nay', 'green'],
] as const

export function DashboardPage() {
  const { snapshot, stats } = useApp()
  return (
    <div className="page dashboard-page">
      <PageHeader
        eyebrow="Learning command center"
        title={<>Chào mừng trở lại <span className="accent">chiến tuyến</span></>}
        description="Bạn chọn cách học hôm nay. Vocab Siege sẽ giữ lịch ôn và ưu tiên những từ cần thiết nhất."
        actions={
          <>
            <div className="streak-pill">
              <span>🔥</span><b>{stats.streak}</b><small>ngày liên tiếp</small>
            </div>
          </>
        }
      />

      <section className="stat-grid">
        {statMeta.map(([key, label, hint, color]) => (
          <article className={`stat-card ${color}`} key={key}>
            <span>{label}</span><strong>{stats[key]}</strong><small>{hint}</small>
          </article>
        ))}
      </section>

      <ActivityCalendar />

      <section className="dashboard-grid">
        <article className="panel mission-panel">
          <div className="section-title"><span><b>Nhiệm vụ hôm nay</b><small>Tự chọn đường học phù hợp</small></span></div>
          <div className="mission-list">
            <Link to="/learn" className="mission"><i>✦</i><span><b>Học từ mới</b><small>Học liên tục từ các bộ từ của bạn</small></span><strong>{stats.newCount} →</strong></Link>
            <Link to="/review" className="mission"><i>↻</i><span><b>Ôn từ đến hạn</b><small>Lộ trình 6 cấp · lịch ôn cố định</small></span><strong>{stats.dueCount} →</strong></Link>
            <Link to="/game" className="mission"><i>⌁</i><span><b>Vào Vocab Siege</b><small>Tower-defense dùng chính kho từ của bạn</small></span><strong>Chơi →</strong></Link>
            <Link to="/practice" className="mission"><i>◇</i><span><b>Luyện với AI</b><small>Bài đọc và quiz từ những từ đã học</small></span><strong>Tạo →</strong></Link>
          </div>
        </article>

        <article className="panel progress-panel">
          <div className="section-title"><span><b>Độ chính xác</b><small>Tất cả lượt ôn</small></span><strong>{stats.accuracy}%</strong></div>
          <div className="accuracy-ring" style={{ '--accuracy': `${stats.accuracy * 3.6}deg` } as React.CSSProperties}><span>{stats.accuracy}%<small>accuracy</small></span></div>
          <div className="mini-stats">
            <span><b>{stats.learnedCount}/{snapshot.vocabulary.length}</b><small>từ đã học</small></span>
            <span><b>{stats.newCount}</b><small>từ chưa học</small></span>
            <span><b>{stats.todayLearnedCount}</b><small>mới hôm nay</small></span>
            <span><b>{stats.todayReviewedCount}</b><small>ôn hôm nay</small></span>
          </div>
        </article>
      </section>
    </div>
  )
}
