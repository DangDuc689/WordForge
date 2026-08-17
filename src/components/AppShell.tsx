import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { useTheme } from '../context/ThemeContext'

const links = [
  ['/', 'Tổng quan', '⌂'],
  ['/vocabulary', 'Kho từ', '◫'],
  ['/learn', 'Học mới', '✦'],
  ['/review', 'Ôn tập', '↻'],
  ['/game', 'Vocab Siege', '⌁'],
  ['/practice', 'AI Practice', '◇'],
  ['/ai-chat', 'AI Chat', '💬'],
  ['/settings', 'Cài đặt', '⚙'],
] as const

export function AppShell() {
  const { isLocalMode } = useAuth()
  const { stats, error } = useApp()
  const { theme, toggleTheme } = useTheme()
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand" aria-label="WordForge">
          <span className="brand-core" />
          <span><b>Word</b><em>Forge</em></span>
        </NavLink>
        <nav className="primary-nav" aria-label="Điều hướng chính">
          {links.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              <span aria-hidden="true">{icon}</span><span>{label}</span>
              {to === '/review' && stats.dueCount > 0 && <strong>{stats.dueCount}</strong>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-theme-row">
          <button
            className="theme-switch-btn"
            onClick={toggleTheme}
            aria-label="Chuyển đổi giao diện Sáng / Tối"
          >
            <span className="theme-switch-icon">{theme === 'light' ? '🌙' : '☀️'}</span>
            <span className="theme-switch-label">{theme === 'light' ? 'Giao diện Tối' : 'Giao diện Sáng'}</span>
          </button>
        </div>
        <div className="sidebar-foot">
          <span className={`sync-dot ${isLocalMode ? 'local' : ''}`} />
          <span>{isLocalMode ? 'Chế độ local' : 'Đã đồng bộ cloud'}</span>
        </div>
      </aside>
      <main className="main-content">
        <button
          className="mobile-floating-theme-btn"
          onClick={toggleTheme}
          aria-label="Chuyển đổi Sáng/Tối"
          title={theme === 'light' ? 'Chuyển sang Giao diện Tối' : 'Chuyển sang Giao diện Sáng'}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        {error && <div className="notice danger">{error}</div>}
        {isLocalMode && (
          <div className="notice">
            Đang chạy local để bạn dùng ngay. Thêm Supabase vào <code>.env.local</code> để bật đăng nhập và đồng bộ.
          </div>
        )}
        <Outlet />
      </main>
      <nav className="mobile-nav" aria-label="Điều hướng điện thoại">
        {links.slice(0, 5).map(([to, label, icon]) => (
          <NavLink key={to} to={to} end={to === '/'}><span>{icon}</span><small>{label}</small></NavLink>
        ))}
      </nav>
    </div>
  )
}

