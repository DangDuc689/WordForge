import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import type { PracticeSession } from '../domain/types'
import { generatePractice } from '../lib/ai'
import { Link } from 'react-router-dom'

function HighlightedText({ text, glossary }: { text: string; glossary?: { english: string }[] }) {
  if (!text) return null
  if (!glossary || glossary.length === 0) return <>{text}</>
  const words = glossary.map((g) => g.english).filter(Boolean)
  if (words.length === 0) return <>{text}</>

  // Sort by length descending to match longest phrases first
  words.sort((a, b) => b.length - a.length)
  const regex = new RegExp(`\\b(${words.join('|')})\\b`, 'gi')
  const parts = text.split(regex)

  return (
    <>
      {parts.map((part, i) => {
        const isMatch = words.some((w) => w.toLowerCase() === part.toLowerCase())
        return isMatch ? (
          <strong key={i} className="accent">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      })}
    </>
  )
}

export function PracticePage() {
  const { snapshot, savePractice, updatePracticeSession } = useApp()
  const [deckId, setDeckId] = useState<string>('all')
  const [format, setFormat] = useState<'reading' | 'dialogue'>('reading')
  const [session, setSession] = useState<PracticeSession | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const hasEnoughWords = snapshot.cards.length >= 3

  const create = async () => {
    if (!snapshot.profile.aiEnabled) {
      setMessage('Hãy bật AI trong Cài đặt trước.')
      return
    }
    setBusy(true)
    setMessage('')
    setSubmitted(false)
    setAnswers({})
    try {
      const result = await generatePractice(deckId === 'all' ? null : deckId, format)
      const ids = (result.glossary ?? []).map((g) => g.vocabularyId)
      const newSession = await savePractice(deckId === 'all' ? null : deckId, format, ids, result)
      setSession(newSession)
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Không thể tạo bài luyện.')
    } finally {
      setBusy(false)
    }
  }

  const loadOldPractice = (oldSession: PracticeSession) => {
    setSession(oldSession)
    setAnswers(oldSession.answers ?? {})
    setSubmitted(oldSession.score !== null)
    setMessage('')
  }

  const submit = async () => {
    if (!session) return
    const score = session.content.questions.filter((q) => answers[q.id] === q.answer).length
    setSubmitted(true)
    const updated = {
      ...session,
      score,
      answers,
      completedAt: new Date().toISOString(),
    }
    setSession(updated)
    await updatePracticeSession(updated)
  }

  const resetPractice = () => {
    if (!session) return
    setAnswers({})
    setSubmitted(false)
  }

  const score = session
    ? session.content.questions.filter((question) => answers[question.id] === question.answer).length
    : 0

  const aiEnabled = snapshot.profile.aiEnabled

  return (
    <div className="page practice-page">
      <PageHeader
        eyebrow="Context from your history"
        title={
          <>
            Luyện tập với <span className="accent">AI</span>
          </>
        }
        description="AI dùng từ đến hạn, từ yếu và những từ bạn đã nhớ — không tự đoán trình độ của bạn."
      />

      {!aiEnabled ? (
        <section className="panel notice danger">
          Tính năng AI đang tắt. Vui lòng bật AI trong phần Cài đặt để sử dụng tính năng này.
        </section>
      ) : !hasEnoughWords ? (
        <section className="panel notice warning">
          Bạn cần học (có thẻ ghi nhớ) ít nhất 3 từ vựng trước khi tạo bài luyện AI. Hãy vào{' '}
          <Link to="/learn" className="accent">Học từ mới</Link> trước nhé.
        </section>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem', alignItems: 'start' }}>
          <div className="practice-main">
            <section className="panel practice-builder">
              <label>
                Bộ từ
                <select value={deckId} onChange={(event) => setDeckId(event.target.value)}>
                  <option value="all">Tất cả bộ từ</option>
                  {snapshot.decks.map((deck) => (
                    <option key={deck.id} value={deck.id}>
                      {deck.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="segmented">
                <button
                  className={format === 'reading' ? 'active' : ''}
                  onClick={() => setFormat('reading')}
                >
                  Bài đọc ngắn
                </button>
                <button
                  className={format === 'dialogue' ? 'active' : ''}
                  onClick={() => setFormat('dialogue')}
                >
                  Hội thoại
                </button>
              </div>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void create()}
              >
                {busy ? 'Đang tạo ngữ cảnh…' : '◇ Tạo bài luyện mới'}
              </button>
            </section>
            
            {message && <div className="notice danger" style={{ marginTop: '1rem' }}>{message}</div>}

            {!session && (
              <section className="panel ai-empty" style={{ marginTop: '1rem' }}>
                <span>◇</span>
                <h2>Một bài luyện chỉ dành cho bạn</h2>
                <p>Những từ đã biết giúp AI viết câu dễ hiểu; từ yếu và đến hạn trở thành trọng tâm của bài.</p>
              </section>
            )}

            {session && (
              <section className="panel generated-practice" style={{ marginTop: '1rem' }}>
                <span className="eyebrow">
                  AI generated · {session.format === 'reading' ? 'Bài đọc' : 'Hội thoại'}
                </span>
                <h2>{session.content.title}</h2>

                {session.content.glossary && session.content.glossary.length > 0 && (
                  <div className="glossary" style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.05)', borderRadius: '8px' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', textTransform: 'uppercase' }}>Từ vựng mục tiêu</h3>
                    <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                      {session.content.glossary.map(g => (
                        <li key={g.vocabularyId}>
                          <strong>{g.english}</strong>: {g.vietnamese}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <article style={{ lineHeight: 1.6, fontSize: '1.1rem' }}>
                  {session.format === 'dialogue' ? (
                    <div className="dialogue-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', margin: '1.5rem 0' }}>
                      {session.content.passage.split('\n').map((line, idx) => {
                        const trimmed = line.trim()
                        if (!trimmed) return null
                        const match = trimmed.match(/^([A-Za-z0-9\s]+):(.*)$/)
                        if (match) {
                          const speaker = match[1].trim()
                          const dialogueText = match[2].trim()
                          const isA = speaker.toUpperCase() === 'A'
                          return (
                            <div key={idx} style={{ display: 'flex', justifyContent: isA ? 'flex-start' : 'flex-end', width: '100%' }}>
                              <div style={{
                                background: isA ? 'rgba(255, 255, 255, 0.05)' : 'rgba(59, 130, 246, 0.15)',
                                border: isA ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(59, 130, 246, 0.3)',
                                padding: '0.75rem 1.25rem',
                                borderRadius: isA ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
                                maxWidth: '75%',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                              }}>
                                <strong style={{ opacity: 0.6, fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem', color: isA ? 'var(--accent)' : 'rgb(96, 165, 250)' }}>
                                  Lượt nói {speaker}
                                </strong>
                                <HighlightedText text={dialogueText} glossary={session.content.glossary} />
                              </div>
                            </div>
                          )
                        }
                        return (
                          <div key={idx} style={{ padding: '0.5rem 1rem', fontStyle: 'italic', opacity: 0.8 }}>
                            <HighlightedText text={trimmed} glossary={session.content.glossary} />
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p style={{ whiteSpace: 'pre-wrap' }}>
                      <HighlightedText text={session.content.passage} glossary={session.content.glossary} />
                    </p>
                  )}
                  <details style={{ marginTop: '1.5rem' }}>
                    <summary>Xem bản dịch tham khảo</summary>
                    {session.format === 'dialogue' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', background: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '8px' }}>
                        {session.content.passageVi.split('\n').map((line, idx) => (
                          <p key={idx} style={{ margin: 0, padding: '0.25rem 0', opacity: 0.9 }}>
                            {line}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p style={{ whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>{session.content.passageVi}</p>
                    )}
                  </details>
                </article>

                <div className="question-list" style={{ marginTop: '2rem' }}>
                  {session.content.questions.map((question, index) => (
                    <fieldset key={question.id} style={{ marginBottom: '1.5rem', border: 'none', padding: 0 }}>
                      <legend style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                        {index + 1}. {question.prompt}
                      </legend>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {question.choices.map((choice) => {
                          let labelClass = ''
                          if (submitted) {
                            if (choice === question.answer) labelClass = 'right-choice'
                            else if (answers[question.id] === choice) labelClass = 'wrong-choice'
                          }
                          return (
                            <label
                              key={choice}
                              className={labelClass}
                              style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                            >
                              <input
                                type="radio"
                                name={question.id}
                                value={choice}
                                disabled={submitted}
                                checked={answers[question.id] === choice}
                                onChange={() =>
                                  setAnswers((state) => ({ ...state, [question.id]: choice }))
                                }
                              />
                              {choice}
                            </label>
                          )
                        })}
                      </div>
                      {submitted && (
                        <p className="explanation" style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
                          Giải thích: {question.explanation}
                        </p>
                      )}
                    </fieldset>
                  ))}
                </div>

                <div className="form-actions" style={{ marginTop: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  {submitted ? (
                    <>
                      <strong style={{ fontSize: '1.2rem' }}>
                        Kết quả: {score}/{session.content.questions.length}
                      </strong>
                      <button className="button ghost" onClick={resetPractice}>
                        Làm lại
                      </button>
                    </>
                  ) : (
                    <button
                      className="button primary"
                      disabled={Object.keys(answers).length < session.content.questions.length}
                      onClick={() => void submit()}
                    >
                      Chấm bài
                    </button>
                  )}
                  <button className="button ghost" onClick={() => setSession(null)}>
                    Đóng
                  </button>
                </div>
              </section>
            )}
          </div>

          <aside className="practice-history">
            <div className="panel">
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Lịch sử (20 bài gần nhất)</h3>
              {snapshot.practiceSessions.length === 0 ? (
                <p style={{ color: '#666', fontSize: '0.9rem' }}>Chưa có bài luyện nào.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {snapshot.practiceSessions.slice(0, 20).map((s) => (
                    <li
                      key={s.id}
                      onClick={() => loadOldPractice(s)}
                      style={{
                        padding: '0.5rem',
                        background: session?.id === s.id ? 'var(--bg-accent, #eef2ff)' : 'transparent',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        border: '1px solid var(--border)',
                        fontSize: '0.9rem'
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{s.content.format === 'reading' ? 'Bài đọc' : s.content.format === 'dialogue' ? 'Hội thoại' : 'Quiz cũ'}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}>
                        <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                        <span>{s.score !== null ? `${s.score}/${s.content.questions?.length || 3}` : 'Chưa chấm'}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
