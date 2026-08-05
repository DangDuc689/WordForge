import { useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useTts, TTS_VOICES } from '../lib/tts'
import { DEFAULT_TTS_VOICE } from '../domain/types'

/* ── Minimal 2px-stroke line-art icons ─────────────────────────────── */
const IconSun = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)

const IconMoon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

const IconCalendar = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

const IconZap = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
)

const IconArchive = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
  </svg>
)

const IconUser = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)

const IconHeadphones = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
  </svg>
)

const IconDownload = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '6px' }}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

const IconUpload = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '6px' }}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
)

const IconLogOut = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '6px' }}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)

const IconCheckCircle = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '6px' }}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
)

const IconAlertCircle = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '6px' }}>
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)

const IconInfo = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '6px' }}>
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
)

const IconGlobe = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '6px' }}>
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
)

/* ── Pill toggle switch ───────────────────────────────────────────────── */
function ToggleSwitch({
  id, checked, onChange, label, description,
}: {
  id: string; checked: boolean; onChange: (v: boolean) => void; label: string; description?: string
}) {
  return (
    <label className="settings-toggle-row" htmlFor={id}>
      <span className="settings-toggle-text">
        <b>{label}</b>
        {description && <small>{description}</small>}
      </span>
      <span className={`settings-toggle-pill${checked ? ' on' : ''}`} aria-hidden="true">
        <span className="settings-toggle-thumb" />
      </span>
      <input
        id={id} type="checkbox" checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="settings-toggle-input"
        role="switch" aria-checked={checked}
      />
    </label>
  )
}

/* ── Section header with icon ────────────────────────────────────────── */
function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="settings-section-header">
      <span className="settings-section-icon">{icon}</span>
      <span>
        <b>{title}</b>
        <small>{subtitle}</small>
      </span>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────────────── */
export function SettingsPage() {
  const { snapshot, updateProfile, exportBackup, importBackup } = useApp()
  const { isLocalMode, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const selectedVoice = snapshot.profile.ttsVoice ?? DEFAULT_TTS_VOICE
  const { speak, isLoading: isTtsLoading } = useTts(selectedVoice)
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const importFile = async (file?: File) => {
    if (!file) return
    try {
      await importBackup(file)
      setMessage({ text: 'Đã khôi phục backup thành công.', type: 'success' })
    } catch (cause) {
      setMessage({ text: cause instanceof Error ? cause.message : 'Không thể khôi phục.', type: 'error' })
    }
  }

  return (
    <div className="page settings-page">
      <PageHeader
        eyebrow="Preferences & safety"
        title={<>Cài đặt <span className="accent">cá nhân</span></>}
        description="Điều chỉnh giao diện, lịch học, AI và bảo vệ dữ liệu của bạn."
      />
      <div className="settings-grid">
        <section className="panel settings-section no-lift">
          <SectionHeader icon={<IconSun />} title="Giao diện" subtitle="Chế độ hiển thị Sáng và Tối" />
          <div className="theme-options">
            <button type="button" id="theme-light"
              className={`theme-option-card${theme === 'light' ? ' active' : ''}`}
              onClick={() => setTheme('light')} aria-pressed={theme === 'light'}>
              <span className="theme-icon"><IconSun size={22} /></span>
              <b>Sáng</b><small>Giao diện trong trẻo ban ngày</small>
            </button>
            <button type="button" id="theme-dark"
              className={`theme-option-card${theme === 'dark' ? ' active' : ''}`}
              onClick={() => setTheme('dark')} aria-pressed={theme === 'dark'}>
              <span className="theme-icon"><IconMoon size={22} /></span>
              <b>Tối</b><small>Neon nổi bật, bảo vệ mắt ban đêm</small>
            </button>
          </div>
        </section>

        <section className="panel settings-section no-lift">
          <SectionHeader icon={<IconCalendar />} title="Lịch học" subtitle="Mốc ôn cố định theo 6 cấp nhớ" />
          <div className="spaced-repeat-levels">
            {[{l:1,v:'2 giờ'},{l:2,v:'1 ngày'},{l:3,v:'2 ngày'},{l:4,v:'3 ngày'},{l:5,v:'5 ngày'},{l:6,v:'8 ngày'}].map(({l,v}) => (
              <span key={l} className="srl-badge">
                <span className="srl-num">Cấp {l}</span>
                <span className="srl-val">{v}</span>
              </span>
            ))}
          </div>
          <label className="settings-field-row" htmlFor="timezone-select">
            <span className="settings-field-label"><IconGlobe />Múi giờ</span>
            <select id="timezone-select" value={snapshot.profile.timezone}
              onChange={e => void updateProfile({ timezone: e.target.value })}
              className="settings-select">
              <option value="Asia/Saigon">Asia/Saigon (UTC+7)</option>
              <option value="UTC">UTC (UTC+0)</option>
            </select>
          </label>
        </section>

        <section className="panel settings-section no-lift">
          <SectionHeader icon={<IconZap />} title="AI Practice" subtitle="Gemini 3.5 Flash Lite chỉ nhận phần dữ liệu học cần thiết" />
          <ToggleSwitch id="ai-enabled" checked={snapshot.profile.aiEnabled}
            onChange={v => void updateProfile({ aiEnabled: v })}
            label="Bật tính năng AI" description="AI luôn tạo bản nháp, không tự lưu từ." />
          <div className="privacy-note">
            <IconInfo size={13} />
            Gemini API sẽ nhận nội dung request để tạo phản hồi. Không gửi email hoặc dữ liệu nhận dạng; chỉ gửi từ mục tiêu và từ nền đã biết.
          </div>
        </section>

        <section className="panel settings-section no-lift">
          <SectionHeader icon={<IconHeadphones />} title="Giọng đọc" subtitle="Edge Neural TTS khi dùng Supabase, trình duyệt khi offline" />
          <label className="settings-field-row" htmlFor="tts-voice-select">
            <span className="settings-field-label"><IconHeadphones />Giọng tiếng Anh</span>
            <select
              id="tts-voice-select"
              value={selectedVoice}
              onChange={e => void updateProfile({ ttsVoice: e.target.value as typeof selectedVoice })}
              className="settings-select"
            >
              {TTS_VOICES.map((voice) => <option key={voice.value} value={voice.value}>{voice.label} — {voice.description}</option>)}
            </select>
          </label>
          <div className="button-row">
            <button
              className="button ghost"
              type="button"
              onClick={() => void speak('Hello, let us learn English together.')}
              disabled={isTtsLoading('Hello, let us learn English together.')}
              aria-busy={isTtsLoading('Hello, let us learn English together.')}
            >
              <IconHeadphones size={14} /> Nghe thử
            </button>
          </div>
        </section>

        <section className="panel settings-section no-lift">
          <SectionHeader icon={<IconArchive />} title="Backup dữ liệu" subtitle="Supabase Free không có automatic backup" />
          <p>Xuất toàn bộ bộ từ, lộ trình 6 cấp nhớ, game run và AI practice thành một file JSON.</p>
          <div className="button-row">
            <button className="button secondary" onClick={exportBackup}><IconDownload />Xuất backup</button>
            <button className="button ghost" onClick={() => fileRef.current?.click()}><IconUpload />Nhập backup</button>
          </div>
          <input hidden ref={fileRef} type="file" accept="application/json"
            onChange={e => void importFile(e.target.files?.[0])} />
          {message && (
            <div className={`settings-status-msg ${message.type}`} role="status" aria-live="polite">
              {message.type === 'success' ? <IconCheckCircle /> : <IconAlertCircle />}
              {message.text}
            </div>
          )}
        </section>

        <section className="panel settings-section no-lift settings-account">
          <SectionHeader icon={<IconUser />} title="Tài khoản"
            subtitle={isLocalMode ? 'Dữ liệu nằm trên trình duyệt này' : 'Đang đồng bộ bằng Supabase'} />
          {!isLocalMode && (
            <button className="button danger" onClick={() => void signOut()}><IconLogOut />Đăng xuất</button>
          )}
          {isLocalMode && (
            <div className="privacy-note">
              <IconInfo size={13} />
              Để bật cloud, sao chép <code>.env.example</code> thành <code>.env.local</code> và thêm thông tin Supabase.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
