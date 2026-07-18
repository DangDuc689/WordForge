import { useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export function SettingsPage() {
  const { snapshot, updateProfile, exportBackup, importBackup } = useApp()
  const { isLocalMode, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')

  const importFile = async (file?: File) => {
    if (!file) return
    try { await importBackup(file); setMessage('Đã khôi phục backup thành công.') }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Không thể khôi phục.') }
  }

  return <div className="page settings-page">
    <PageHeader eyebrow="Preferences & safety" title={<>Cài đặt <span className="accent">cá nhân</span></>} description="Điều chỉnh lịch học, AI và bảo vệ dữ liệu của bạn." />
    <div className="settings-grid">
      <section className="panel settings-section"><div className="section-title"><span><b>Giao diện</b><small>Chế độ hiển thị Sáng và Tối</small></span></div>
        <div className="theme-options">
          <button
            type="button"
            className={`theme-option-card ${theme === 'light' ? 'active' : ''}`}
            onClick={() => setTheme('light')}
          >
            <span>☀️</span><b>Sáng</b><small>Giao diện trong trẻo ban ngày</small>
          </button>
          <button
            type="button"
            className={`theme-option-card ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => setTheme('dark')}
          >
            <span>🌙</span><b>Tối</b><small>Neon nổi bật, bảo vệ mắt ban đêm</small>
          </button>
        </div>
      </section>
      <section className="panel settings-section"><div className="section-title"><span><b>Lịch học</b><small>Mốc ôn cố định theo 6 cấp nhớ</small></span></div>
        <label>Số từ mới mỗi lượt <input type="number" min="1" max="50" value={snapshot.profile.newWordsPerSession} onChange={(event) => void updateProfile({ newWordsPerSession: Number(event.target.value) })} /></label>
        <div className="privacy-note">Cấp 1: 2 giờ · Cấp 2: 1 ngày · Cấp 3: 2 ngày · Cấp 4: 3 ngày · Cấp 5: 5 ngày · Nhớ sâu: 8 ngày.</div>
        <label>Múi giờ <select value={snapshot.profile.timezone} onChange={(event) => void updateProfile({ timezone: event.target.value })}><option value="Asia/Saigon">Asia/Saigon (UTC+7)</option><option value="UTC">UTC</option></select></label>
      </section>

      <section className="panel settings-section"><div className="section-title"><span><b>AI Practice</b><small>Gemini chỉ nhận phần dữ liệu học cần thiết</small></span></div>
        <label className="toggle-row"><span><b>Bật tính năng AI</b><small>AI luôn tạo bản nháp, không tự lưu từ.</small></span><input type="checkbox" checked={snapshot.profile.aiEnabled} onChange={(event) => void updateProfile({ aiEnabled: event.target.checked })} /></label>
        <div className="privacy-note">Gemini Free Tier có thể dùng nội dung request để cải thiện sản phẩm. Không gửi email hoặc dữ liệu nhận dạng; chỉ gửi từ mục tiêu và tối đa 80 từ đã biết.</div>
      </section>
      <section className="panel settings-section"><div className="section-title"><span><b>Backup dữ liệu</b><small>Supabase Free không có automatic backup</small></span></div>
        <p>Xuất toàn bộ bộ từ, lộ trình 6 cấp nhớ, game run và AI practice thành một file JSON.</p>
        <div className="button-row"><button className="button secondary" onClick={exportBackup}>Xuất backup</button><button className="button ghost" onClick={() => fileRef.current?.click()}>Nhập backup</button></div>
        <input hidden ref={fileRef} type="file" accept="application/json" onChange={(event) => void importFile(event.target.files?.[0])} />
        {message && <div className="form-message">{message}</div>}
      </section>
      <section className="panel settings-section"><div className="section-title"><span><b>Tài khoản</b><small>{isLocalMode ? 'Dữ liệu nằm trên trình duyệt này' : 'Đang đồng bộ bằng Supabase'}</small></span></div>
        {!isLocalMode && <button className="button danger" onClick={() => void signOut()}>Đăng xuất</button>}
        {isLocalMode && <p>Để bật cloud, sao chép <code>.env.example</code> thành <code>.env.local</code> và thêm thông tin Supabase.</p>}
      </section>
    </div>
  </div>
}
