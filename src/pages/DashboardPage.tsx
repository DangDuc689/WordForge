import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'

const statMeta = [
  ['newCount', 'Từ mới', 'Chưa bắt đầu', 'cyan'],
  ['learningCount', 'Đang học', 'Đang ở cấp độ 1', 'amber'],
  ['dueCount', 'Đến hạn', 'Nên ôn hôm nay', 'pink'],
  ['weakCount', 'Từ yếu', 'Cần củng cố', 'green'],
] as const

export function DashboardPage() {
  const { snapshot, stats } = useApp()
  const recent = snapshot.reviews.slice(0, 6)
  const words = new Map(snapshot.vocabulary.map((word) => [word.id, word]))
  return (
    <div className="page dashboard-page">
      <PageHeader
        eyebrow="Learning command center"
        title={<>Chào mừng trở lại <span className="accent">chiến tuyến</span></>}
        description="Bạn chọn cách học hôm nay. Vocab Siege sẽ giữ lịch ôn và ưu tiên những từ cần thiết nhất."
        actions={<div className="streak-pill"><span>🔥</span><b>{stats.streak}</b><small>ngày liên tiếp</small></div>}
      />

      <section className="stat-grid">
        {statMeta.map(([key, label, hint, color]) => (
          <article className={`stat-card ${color}`} key={key}>
            <span>{label}</span><strong>{stats[key]}</strong><small>{hint}</small>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel mission-panel">
          <div className="section-title"><span><b>Nhiệm vụ hôm nay</b><small>Tự chọn đường học phù hợp</small></span></div>
          <div className="mission-list">
            <Link to="/learn" className="mission"><i>✦</i><span><b>Học từ mới</b><small>Tối đa {snapshot.profile.newWordsPerSession} từ mỗi lượt</small></span><strong>{stats.newCount} →</strong></Link>
            <Link to="/review" className="mission"><i>↻</i><span><b>Ôn từ đến hạn</b><small>Lộ trình 6 cấp · lịch ôn cố định</small></span><strong>{stats.dueCount} →</strong></Link>
            <Link to="/game" className="mission"><i>⌁</i><span><b>Vào Vocab Siege</b><small>Tower-defense dùng chính kho từ của bạn</small></span><strong>Chơi →</strong></Link>
            <Link to="/practice" className="mission"><i>◇</i><span><b>Luyện với AI</b><small>Bài đọc và quiz từ những từ đã học</small></span><strong>Tạo →</strong></Link>
          </div>
        </article>

        <article className="panel progress-panel">
          <div className="section-title"><span><b>Độ chính xác</b><small>Tất cả lượt ôn</small></span><strong>{stats.accuracy}%</strong></div>
          <div className="accuracy-ring" style={{ '--accuracy': `${stats.accuracy * 3.6}deg` } as React.CSSProperties}><span>{stats.accuracy}%<small>accuracy</small></span></div>
          <div className="mini-stats"><span><b>{stats.learnedCount}/{snapshot.vocabulary.filter((word) => word.status === 'active').length}</b><small>từ đã học</small></span><span><b>{stats.newCount}</b><small>từ chưa học</small></span><span><b>{snapshot.gameRuns.length}</b><small>game runs</small></span></div>
        </article>
      </section>

      <section className="panel recent-panel">
        <div className="section-title"><span><b>Hoạt động gần đây</b><small>Những lần nhớ lại mới nhất</small></span><Link to="/review">Ôn tiếp</Link></div>
        {recent.length === 0 ? <div className="empty-state compact">Chưa có lịch sử. Hãy bắt đầu với vài từ mới.</div> : (
          <div className="recent-list">{recent.map((review) => {
            const word = words.get(review.vocabularyId)
            return <div key={review.id}><span className={review.correct ? 'result-ok' : 'result-bad'}>{review.correct ? '✓' : '×'}</span><span><b>{word?.english ?? 'Từ đã xóa'}</b><small>{word?.vietnamese}</small></span><em>{review.rating === 6 ? 'Nhớ sâu' : ('Cấp độ ' + review.rating)}</em><time>{new Date(review.reviewedAt).toLocaleDateString('vi-VN')}</time></div>
          })}</div>
        )}
      </section>
    </div>
  )
}
