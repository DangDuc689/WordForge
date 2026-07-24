import { useState, useRef } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import type { PracticeSession, AiPracticeSet } from '../domain/types'
import { generatePractice } from '../lib/ai'
import { createLocalDictationSet, diffSentence, isSentenceCorrect } from '../lib/dictation'
import { Link } from 'react-router-dom'
import { TypingDialogue } from '../components/TypingDialogue'

const IconBookOpen = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
)

const IconMessageSquare = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
)

const IconHeadphones = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
)

const IconVolume2 = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
)

const IconHelpCircle = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
)

const IconSparkles = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
)

const IconCheck = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
)

const IconX = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
)

const IconHistory = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
)

const IconRotateCcw = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
)

function PracticeSkeletonLoader() {
  return (
    <section className="panel generated-practice practice-skeleton" style={{ marginTop: '1rem' }}>
      <div className="skeleton-line" style={{ width: '30%', height: '14px' }} />
      <div className="skeleton-line" style={{ width: '65%', height: '28px', margin: '8px 0' }} />
      <div className="skeleton-line" style={{ width: '100%' }} />
      <div className="skeleton-line" style={{ width: '92%' }} />
      <div className="skeleton-line" style={{ width: '85%' }} />
      <div className="skeleton-line" style={{ width: '40%', marginTop: '12px' }} />
    </section>
  )
}

function HighlightedText({ text, glossary }: { text: string; glossary?: { english: string }[] }) {
  if (!text) return null
  if (!glossary || glossary.length === 0) return <>{text}</>
  const words = glossary.map((g) => g.english).filter(Boolean)
  if (words.length === 0) return <>{text}</>

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
  const [format, setFormat] = useState<'reading' | 'dialogue' | 'dictation'>('reading')
  const [session, setSession] = useState<PracticeSession | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [hintsShown, setHintsShown] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [dialogueTypingDone, setDialogueTypingDone] = useState(false)
  const questionsRef = useRef<HTMLDivElement>(null)

  const hasEnoughWords = snapshot.cards.length >= 3

  const speakSentence = (text: string, rate: number = 1.0) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'en-US'
      utterance.rate = rate
      window.speechSynthesis.speak(utterance)
    }
  }

  const create = async () => {
    if (!snapshot.profile.aiEnabled && format !== 'dictation') {
      setMessage('Hãy bật AI trong Cài đặt trước.')
      return
    }
    setBusy(true)
    setMessage('')
    setSession(null)
    setSubmitted(false)
    setAnswers({})
    setHintsShown({})
    setDialogueTypingDone(false)

    try {
      let result: AiPracticeSet
      if (format === 'dictation') {
        try {
          if (snapshot.profile.aiEnabled) {
            result = await generatePractice(deckId === 'all' ? null : deckId, 'dictation')
          } else {
            result = createLocalDictationSet(snapshot.vocabulary || [], snapshot.cards || [], deckId)
          }
        } catch {
          result = createLocalDictationSet(snapshot.vocabulary || [], snapshot.cards || [], deckId)
        }
        if (!result.dictations || result.dictations.length === 0) {
          result = createLocalDictationSet(snapshot.vocabulary || [], snapshot.cards || [], deckId)
        }
      } else {
        result = await generatePractice(deckId === 'all' ? null : deckId, format)
      }

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
    setDialogueTypingDone(true)
    setMessage('')
  }

  const submit = async () => {
    if (!session) return
    let calculatedScore = 0
    if (session.format === 'dictation' && session.content.dictations) {
      calculatedScore = session.content.dictations.filter((d) =>
        isSentenceCorrect(answers[d.id] || '', d.sentence)
      ).length
    } else {
      calculatedScore = (session.content.questions || []).filter((q) => answers[q.id] === q.answer).length
    }

    setSubmitted(true)
    const updated = {
      ...session,
      score: calculatedScore,
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
    ? session.format === 'dictation' && session.content.dictations
      ? session.content.dictations.filter((d) => isSentenceCorrect(answers[d.id] || '', d.sentence)).length
      : (session.content.questions || []).filter((question) => answers[question.id] === question.answer).length
    : 0

  const totalItems = session
    ? session.format === 'dictation' && session.content.dictations
      ? session.content.dictations.length
      : (session.content.questions || []).length
    : 0

  const aiEnabled = snapshot.profile.aiEnabled

  return (
    <div className="page practice-page">
      <PageHeader
        eyebrow="Context from your history"
        title={
          <>
            Luyện tập với <span className="accent">AI & Audio</span>
          </>
        }
        description="Luyện bài đọc, hội thoại hoặc nghe & viết lại câu với bộ từ vựng cá nhân của bạn."
      />

      {!aiEnabled && format !== 'dictation' ? (
        <section className="panel notice danger">
          Tính năng AI đang tắt. Vui lòng bật AI trong phần Cài đặt để sử dụng tính năng bài đọc/hội thoại.
        </section>
      ) : !hasEnoughWords ? (
        <section className="panel notice warning">
          Bạn cần học (có thẻ ghi nhớ) ít nhất 3 từ vựng trước khi tạo bài luyện. Hãy vào{' '}
          <Link to="/learn" className="accent">Học từ mới</Link> trước nhé.
        </section>
      ) : (
        <div className="practice-grid">
          <div className="practice-main">
            <section className="panel practice-builder">
              <div className="practice-field">
                <label htmlFor="deck-select" className="field-label">Bộ từ vựng</label>
                <select id="deck-select" value={deckId} onChange={(event) => setDeckId(event.target.value)}>
                  <option value="all">Tất cả bộ từ</option>
                  {snapshot.decks.map((deck) => (
                    <option key={deck.id} value={deck.id}>
                      {deck.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="practice-field">
                <span className="field-label">Định dạng bài luyện</span>
                <div className="practice-format-toggle">
                  <button
                    type="button"
                    className={format === 'reading' ? 'active' : ''}
                    onClick={() => setFormat('reading')}
                  >
                    <IconBookOpen /> Bài đọc ngắn
                  </button>
                  <button
                    type="button"
                    className={format === 'dialogue' ? 'active' : ''}
                    onClick={() => setFormat('dialogue')}
                  >
                    <IconMessageSquare /> Hội thoại
                  </button>
                  <button
                    type="button"
                    className={format === 'dictation' ? 'active' : ''}
                    onClick={() => setFormat('dictation')}
                  >
                    <IconHeadphones /> Nghe & Viết lại
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="button primary large practice-submit-btn"
                disabled={busy}
                onClick={() => void create()}
              >
                <IconSparkles /> {busy ? 'Đang soạn bài luyện…' : format === 'dictation' ? 'Tạo bài luyện Nghe & Chép câu' : 'Tạo bài luyện mới với AI'}
              </button>
            </section>
            
            {message && <div className="notice danger" style={{ marginTop: '1rem' }}>{message}</div>}

            {busy && <PracticeSkeletonLoader />}

            {!session && !busy && (
              <section className="panel ai-empty" style={{ marginTop: '1rem' }}>
                <span>◇</span>
                <h2>{format === 'dictation' ? 'Nghe và chép lại chính xác từng câu' : 'Bài đọc biên soạn riêng cho bạn'}</h2>
                <p>
                  {format === 'dictation'
                    ? 'Luyện phản xạ nghe và kiểm tra ngữ pháp tiếng Anh từ các ví dụ thực tế trong bộ từ của bạn.'
                    : 'Những từ đã biết giúp AI viết câu dễ hiểu; từ yếu và đến hạn trở thành trọng tâm của ngữ cảnh.'}
                </p>
              </section>
            )}

            {session && !busy && (
              <section className="panel generated-practice" style={{ marginTop: '1rem' }}>
                <span className="eyebrow">
                  {session.format === 'reading' ? 'AI generated · Bài đọc' : session.format === 'dialogue' ? 'AI generated · Hội thoại' : 'Audio Dictation · Nghe & Viết lại câu'}
                </span>
                <h2>{session.content.title}</h2>

                {session.content.glossary && session.content.glossary.length > 0 && (
                  <div className="practice-glossary">
                    <h3><IconSparkles size={14} /> Từ vựng mục tiêu trong bài</h3>
                    <div className="glossary-tags">
                      {session.content.glossary.map((g) => (
                        <div key={g.vocabularyId} className="glossary-tag">
                          <strong>{g.english}</strong>: <span>{g.vietnamese}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {session.format === 'dictation' && session.content.dictations ? (
                  <div className="dictation-list" style={{ marginTop: '1.5rem' }}>
                    {session.content.dictations.map((item, index) => {
                      const isCorrect = submitted && isSentenceCorrect(answers[item.id] || '', item.sentence)
                      const diffTokens = submitted ? diffSentence(answers[item.id] || '', item.sentence) : []

                      return (
                        <div key={item.id} className={`dictation-card ${submitted ? (isCorrect ? 'correct-card' : 'wrong-card') : ''}`}>
                          <div className="dictation-card-header">
                            <span className="dictation-number">Câu {index + 1}</span>
                            <div className="dictation-audio-controls">
                              <button
                                type="button"
                                className="button mini primary"
                                onClick={() => speakSentence(item.sentence, 1.0)}
                                title="Nghe câu tốc độ chuẩn (1.0x)"
                              >
                                <IconVolume2 size={14} /> Nghe (1.0x)
                              </button>
                              <button
                                type="button"
                                className="button mini secondary"
                                onClick={() => speakSentence(item.sentence, 0.75)}
                                title="Nghe chậm (0.75x)"
                              >
                                <IconVolume2 size={14} /> 🐢 Chậm (0.75x)
                              </button>
                              <button
                                type="button"
                                className="button mini ghost"
                                onClick={() => setHintsShown((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                              >
                                <IconHelpCircle size={14} /> {hintsShown[item.id] ? 'Ẩn gợi ý' : 'Gợi ý'}
                              </button>
                            </div>
                          </div>

                          {Boolean(hintsShown[item.id]) && (
                            <div className="dictation-hint-box">
                              <strong>Nghĩa / Gợi ý:</strong> {item.translationVi} {item.hint ? `— ${item.hint}` : ''}
                            </div>
                          )}

                          <div className="dictation-input-wrapper">
                            <textarea
                              rows={2}
                              className="dictation-input"
                              disabled={submitted}
                              placeholder="Nghe và gõ lại câu tiếng Anh..."
                              value={answers[item.id] || ''}
                              onChange={(e) => setAnswers((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            />
                          </div>

                          {submitted && (
                            <div className="dictation-result-box">
                              <div className="dictation-diff-title">
                                <strong>Kết quả chấm bài:</strong>
                              </div>
                              <div className="dictation-diff-tokens">
                                {diffTokens.map((token, tIdx) => (
                                  <span
                                    key={tIdx}
                                    className={`diff-token diff-${token.status}`}
                                    title={token.status === 'wrong' ? `Gõ sai. Đáp án đúng: ${token.word}` : token.status === 'missing' ? 'Từ còn thiếu' : 'Chính xác'}
                                  >
                                    {token.word}
                                  </span>
                                ))}
                              </div>
                              <div className="dictation-reference">
                                <div><strong>Đáp án chuẩn:</strong> {item.sentence}</div>
                                <div><strong>Dịch nghĩa:</strong> {item.translationVi}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : session.format === 'dialogue' && !dialogueTypingDone ? (
                  <TypingDialogue
                    passage={session.content.passage}
                    passageVi={session.content.passageVi}
                    speakSentence={speakSentence}
                    onComplete={() => {
                      setDialogueTypingDone(true)
                      setTimeout(() => {
                        questionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }, 800)
                    }}
                  />
                ) : (
                  <article style={{ lineHeight: 1.65, fontSize: '1.1rem' }}>
                    {session.format === 'dialogue' ? (
                      <div className="dialogue-container">
                        {session.content.passage.split(/\\n|\n/).map((line, idx) => {
                          const trimmed = line.trim()
                          if (!trimmed) return null
                          const match = trimmed.match(/^([A-Za-z0-9\s]+):(.*)$/)
                          if (match) {
                            const speaker = match[1].trim()
                            const dialogueText = match[2].trim()
                            const isA = speaker.toUpperCase() === 'A'
                            return (
                              <div key={idx} className={`dialogue-bubble-wrapper ${isA ? 'speaker-a' : 'speaker-b'}`}>
                                <div className="dialogue-bubble">
                                  <span className="dialogue-speaker-name">
                                    Lượt nói {speaker}
                                  </span>
                                  <HighlightedText text={dialogueText} glossary={session.content.glossary} />
                                </div>
                              </div>
                            )
                          }
                          return (
                            <div key={idx} style={{ padding: '0.5rem 1rem', fontStyle: 'italic', opacity: 0.85 }}>
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
                    <details style={{ marginTop: '1.5rem', cursor: 'pointer' }}>
                      <summary style={{ fontWeight: 600, color: 'var(--cyan)' }}>Xem bản dịch tham khảo</summary>
                      {session.format === 'dialogue' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem', background: 'var(--bg2)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--line)' }}>
                          {session.content.passageVi.split(/\\n|\n/).map((line, idx) => (
                            <p key={idx} style={{ margin: 0, padding: '0.25rem 0', opacity: 0.9, fontSize: '0.95rem' }}>
                              {line}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p style={{ whiteSpace: 'pre-wrap', marginTop: '0.75rem', background: 'var(--bg2)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--line)', fontSize: '0.95rem' }}>{session.content.passageVi}</p>
                      )}
                    </details>
                  </article>
                )}

                {session.format !== 'dictation' && (session.format !== 'dialogue' || dialogueTypingDone) && (
                  <div className="question-list" ref={questionsRef} style={{ marginTop: '2.5rem' }}>
                    {session.content.questions.map((question, index) => (
                      <fieldset key={question.id} style={{ marginBottom: '2rem', border: 'none', padding: 0 }}>
                        <legend style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.75rem', color: 'var(--text)' }}>
                          {index + 1}. {question.prompt}
                        </legend>
                        <div className="quiz-options">
                          {question.choices.map((choice) => {
                            let labelClass = ''
                            if (submitted) {
                              if (choice === question.answer) labelClass = 'right-choice'
                              else if (answers[question.id] === choice) labelClass = 'wrong-choice'
                            }
                            return (
                              <label
                                key={choice}
                                className={`quiz-option ${labelClass} ${submitted ? 'disabled' : ''}`}
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
                                <span style={{ flex: 1 }}>{choice}</span>
                                {submitted && choice === question.answer && <IconCheck size={18} />}
                                {submitted && answers[question.id] === choice && choice !== question.answer && <IconX size={18} />}
                              </label>
                            )
                          })}
                        </div>
                        {submitted && (
                          <div className="quiz-explanation">
                            <strong>Giải thích:</strong> {question.explanation}
                          </div>
                        )}
                      </fieldset>
                    ))}
                  </div>
                )}

                <div className="form-actions" style={{ marginTop: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  {submitted ? (
                    <>
                      <strong style={{ fontSize: '1.25rem', color: 'var(--cyan)' }}>
                        Kết quả: {score}/{totalItems}
                      </strong>
                      <button className="button secondary" onClick={resetPractice}>
                        <IconRotateCcw /> Làm lại
                      </button>
                    </>
                  ) : (session.format !== 'dialogue' || dialogueTypingDone) ? (
                    <button
                      className="button primary"
                      disabled={Object.keys(answers).length < totalItems}
                      onClick={() => void submit()}
                    >
                      <IconCheck /> Chấm bài
                    </button>
                  ) : null}
                  <button className="button ghost" onClick={() => setSession(null)}>
                    Đóng bài
                  </button>
                </div>
              </section>
            )}
          </div>

          <aside className="practice-history">
            <div className="panel">
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <IconHistory /> Lịch sử (20 bài gần nhất)
              </h3>
              {snapshot.practiceSessions.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Chưa có bài luyện nào.</p>
              ) : (
                <ul className="practice-history-list">
                  {snapshot.practiceSessions.slice(0, 20).map((s) => (
                    <li
                      key={s.id}
                      onClick={() => loadOldPractice(s)}
                      className={`practice-history-item ${session?.id === s.id ? 'active' : ''}`}
                    >
                      <div style={{ fontWeight: 700, color: 'var(--text)' }}>
                        {s.format === 'reading'
                          ? 'Bài đọc'
                          : s.format === 'dialogue'
                          ? 'Hội thoại'
                          : s.format === 'dictation'
                          ? 'Nghe & Viết lại'
                          : 'Quiz cũ'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                        <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                        <strong>{s.score !== null ? `${s.score}/${s.content.dictations?.length || s.content.questions?.length || 3}` : 'Chưa chấm'}</strong>
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
