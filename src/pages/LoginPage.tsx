import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { sendMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      await sendMagicLink(email)
      setMessage('Đã gửi liên kết đăng nhập. Hãy kiểm tra email của bạn.')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Không thể gửi email.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-orbit"><span /><i /><b /></div>
      <form className="login-card" onSubmit={submit}>
        <span className="eyebrow">Private learning vault</span>
        <h1>Vocab <em>Siege</em></h1>
        <p>Đăng nhập bằng email đã được mời để đồng bộ kho từ và lịch ôn trên mọi thiết bị.</p>
        <label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <button className="button primary" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi magic link'}</button>
        {message && <div className="form-message">{message}</div>}
      </form>
    </main>
  )
}
