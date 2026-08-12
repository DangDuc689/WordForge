import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import type { VocabularyItem } from '../domain/types'
import { vocabularySenses } from '../domain/vocabulary'
import { isAcceptedAnswer } from '../lib/normalize'
import { isDue } from '../lib/srs'
import { useTts } from '../lib/tts'
import { gradeSentence } from '../lib/ai'

type Tab = 'flashcard' | 'meaning' | 'word' | 'example'

const tabs = [
  { id: 'flashcard', step: 1, label: 'Thẻ từ' },
  { id: 'meaning', step: 2, label: 'Chọn nghĩa' },
  { id: 'word', step: 3, label: 'Gõ từ Anh' },
  { id: 'example', step: 4, label: 'Đặt câu' }
] as const

function SpeakerIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`speaker-svg ${className}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
    </svg>
  )
}

const Stats = ({ total, learn, review }: { total: number; learn: number; review: number }) => (
  <div className="learn-stats">
    <div className="learn-stat total"><strong>{total}</strong><span>TỔNG SỐ TỪ</span></div>
    <div className="learn-stat learn"><strong>{learn}</strong><span>ĐÃ HỌC</span></div>
    <div className="learn-stat review"><strong>{review}</strong><span>CẦN ÔN LẠI</span></div>
  </div>
)

export function NewStudyPage() {
  const {
    snapshot,
    learnSession,
    savingSession,
    changeLearnDeck,
    deferLearnWord,
    nextLearnWord,
    generateNextBatchAction
  } = useApp()
  const { speak: speakTts, isLoading: isTtsLoading, prefetch } = useTts(snapshot.profile.ttsVoice)
  const speak = (w: VocabularyItem) => { void speakTts(w.english) }
  const speakText = (text: string) => { void speakTts(text) }

  const [tab, setTab] = useState<Tab>('flashcard')
  
  const [answer, setAnswer] = useState('')
  const [choice, setChoice] = useState('')
  const [checked, setChecked] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false)
  const [showVi, setShowVi] = useState(false)
  const [aiFeedback, setAiFeedback] = useState('')
  const [isAiGrading, setIsAiGrading] = useState(false)
  const started = useRef(Date.now())
  const exampleInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (tab === 'example') {
      setTimeout(() => {
        exampleInputRef.current?.focus()
      }, 50)
    }
  }, [tab])

  // Automatically generate next batch if status is idle and queue is empty
  useEffect(() => {
    if (learnSession && learnSession.status === 'idle' && learnSession.queueIds.length === 0 && !savingSession) {
      void generateNextBatchAction()
    }
  }, [learnSession?.status, learnSession?.queueIds.length, savingSession, generateNextBatchAction])

  const deck = learnSession?.selectedDeckId || 'all'

  const queue = useMemo(() => {
    if (!learnSession) return []
    return learnSession.queueIds
      .map(id => snapshot.vocabulary.find(w => w.id === id))
      .filter((w): w is VocabularyItem => !!w)
  }, [learnSession?.queueIds, snapshot.vocabulary])

  const queuedWord = queue[0]
  const word = useMemo(() => {
    if (!queuedWord) return undefined
    const senses = vocabularySenses(queuedWord)
    const reps = snapshot.cards.find((card) => card.vocabularyId === queuedWord.id)?.reps ?? 0
    return { ...queuedWord, ...senses[reps % senses.length], sourceKey: queuedWord.sourceKey }
  }, [queuedWord, snapshot.cards])

  useEffect(() => {
    if (word) void prefetch(word.english)
  }, [word, prefetch])

  const choices = useMemo(() => {
    if (!word) return []
    const d = snapshot.vocabulary
      .filter(w => w.id !== word.id)
      .flatMap(w => vocabularySenses(w).map((sense) => sense.vietnamese))
      .filter(Boolean)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
    return [word.vietnamese, ...d].sort(() => Math.random() - 0.5)
  }, [word, snapshot.vocabulary])

  useEffect(() => {
    setAnswer('')
    setChoice('')
    setChecked(false)
    setCorrect(false)
    setHint(false)
    setIsFlipped(false)
    setShowVi(false)
    setAiFeedback('')
    setIsAiGrading(false)
    if (tab === 'flashcard') {
      started.current = Date.now()
    }
  }, [word?.id, tab])

  const nextWord = async (ok = correct, submitted = answer) => {
    if (!word || busy || savingSession) return
    setBusy(true)
    await nextLearnWord({
      vocabularyId: word.id,
      correct: ok,
      submittedAnswer: submitted,
      responseMs: Date.now() - started.current,
      usedHint: hint
    })
    setBusy(false)
    setTab('flashcard')
  }

  const skipWord = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!word || busy || savingSession) return
    setBusy(true)
    await deferLearnWord(word.id)
    setBusy(false)
    setTab('flashcard')
  }

  const handleNextTab = () => {
    setTab(currentTab => {
      if (currentTab === 'flashcard') return 'meaning'
      if (currentTab === 'meaning') return 'word'
      if (currentTab === 'word') return 'example'
      return currentTab
    })
  }

  const checkWord = (e: FormEvent) => {
    e.preventDefault()
    if (word && answer.trim()) {
      const isOk = isAcceptedAnswer(answer, word.english, word.acceptedAnswers)
      setCorrect(isOk)
      setChecked(true)
      if (isOk) {
        setTimeout(() => handleNextTab(), 700)
      }
    }
  }

  const checkMeaning = (selectedChoice = choice) => {
    if (word && selectedChoice) {
      const isOk = selectedChoice === word.vietnamese
      setCorrect(isOk)
      setChecked(true)
      if (isOk) {
        setTimeout(() => handleNextTab(), 700)
      }
    }
  }

  const checkExample = (e: FormEvent) => {
    e.preventDefault()
    if (word && answer.trim()) {
      const cleanAnswer = answer.trim()
      const exampleText = word.exampleEn || `Is this ${word.english} in a different context?`
      
      const normalize = (s: string) => s.replace(/[.,!?]/g, '').trim().toLowerCase()
      const isExactMatch = normalize(cleanAnswer) === normalize(exampleText)
      
      if (!isExactMatch) {
        setCorrect(false)
        setChecked(true)
        setAiFeedback('Bạn chưa nhập đúng nguyên văn câu mẫu. (Hoặc dùng "Đánh giá AI" nếu bạn tự đặt câu mới)')
        return
      }

      setCorrect(true)
      setChecked(true)
      setAiFeedback('')
    }
  }

  const handleAiGrade = async (e: FormEvent) => {
    e.preventDefault()
    if (!word || !answer.trim() || busy || savingSession || isAiGrading) return
    
    setIsAiGrading(true)
    setAiFeedback('')
    
    try {
      const res = await gradeSentence(word.english, word.vietnamese, answer.trim())
      setCorrect(res.isCorrect)
      setAiFeedback(res.feedback + (res.correctedSentence && res.correctedSentence !== answer.trim() ? `\n\nGợi ý sửa: ${res.correctedSentence}` : ''))
      setChecked(true)
    } catch (err) {
      setCorrect(false)
      setChecked(true)
      setAiFeedback(`Lỗi: ${err instanceof Error ? err.message : 'Không thể kết nối AI. Vui lòng thử Kiểm tra câu thông thường.'}`)
    } finally {
      setIsAiGrading(false)
    }
  }

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      if (tab === 'flashcard') {
        if (!isInput && e.code === 'Space') {
          e.preventDefault()
          setIsFlipped(prev => !prev)
        } else if (!isInput && e.key === 'Enter') {
          e.preventDefault()
          handleNextTab()
        }
      } else if (tab === 'meaning') {
        if (!isInput && ['1', '2', '3', '4'].includes(e.key)) {
          const idx = parseInt(e.key, 10) - 1
          if (choices[idx] && !checked) {
            e.preventDefault()
            setChoice(choices[idx])
            checkMeaning(choices[idx])
          }
        } else if (e.key === 'Enter') {
          if (checked) {
            e.preventDefault()
            if (correct) handleNextTab()
            else { setChecked(false); setChoice(''); }
          }
        }
      } else if (tab === 'word') {
        if (e.key === 'Enter' && checked) {
          e.preventDefault()
          if (correct) handleNextTab()
          else { setChecked(false); setAnswer(''); }
        }
      } else if (tab === 'example') {
        if (e.key === 'Enter') {
          if (!checked && answer.trim()) {
            e.preventDefault()
            checkExample({ preventDefault: () => {} } as FormEvent)
          } else if (checked) {
            e.preventDefault()
            if (correct) void nextWord(true)
            else { setChecked(false); setAnswer(''); setAiFeedback(''); }
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [tab, isFlipped, choices, choice, checked, correct, word, answer])
  
  const total = snapshot.vocabulary.filter(w => (deck === 'all' || w.deckId === deck)).length
  const learnedCount = snapshot.vocabulary.filter(w => (deck === 'all' || w.deckId === deck) && snapshot.cards.some(c => c.vocabularyId === w.id)).length
  const reviewCount = snapshot.cards.filter(c => {
    if (!isDue(c)) return false
    const vocab = snapshot.vocabulary.find(w => w.id === c.vocabularyId)
    if (!vocab || vocab.status !== 'active') return false
    return deck === 'all' || vocab.deckId === deck
  }).length

  if (!word) {
    const hasMoreToLearn = learnedCount < total
    return (
      <div className="page learn-page">
        <Stats total={total} learn={learnedCount} review={reviewCount} />
        <section className="learn-empty panel">
          <div className="empty-check-icon">✓</div>
          {hasMoreToLearn ? (
            <>
              <h2>Hoàn thành lượt học!</h2>
              <p>Bạn đã xử lý toàn bộ từ mới trong lượt này.</p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
                <button
                  className="button primary"
                  disabled={busy || savingSession}
                  onClick={() => void generateNextBatchAction()}
                >
                  Học tiếp lượt mới
                </button>
                <Link className="button ghost" to="/">Về tổng quan</Link>
              </div>
            </>
          ) : (
            <>
              <h2>Đã hoàn thành!</h2>
              <p>Bạn đã học tất cả từ vựng trong bộ từ này.</p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
                <Link className="button primary" to="/study">Ôn tập từ vựng</Link>
                <Link className="button ghost" to="/">Về tổng quan</Link>
              </div>
            </>
          )}
        </section>
      </div>
    )
  }

  const ipa = word.ipa || '/əˈveɪ.lə.bəl/'
  const example = word.exampleEn || `Is this ${word.english} in a different context?`
  const activeStepIdx = tabs.findIndex(t => t.id === tab)

  return (
    <div className="page learn-page">
      <Stats total={total} learn={learnedCount} review={reviewCount} />
      
      <div className="learn-toolbar">
        {/* Workflow Stepper Progress Indicator */}
        <div className="learn-stepper" role="progressbar" aria-label="Tiến trình học từ vựng">
          {tabs.map(({ id, step, label }, idx) => {
            const isCurrent = tab === id
            const isCompleted = idx < activeStepIdx
            return (
              <Fragment key={id}>
                <div 
                  className={`stepper-item ${isCurrent ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                >
                  <div className="stepper-badge">
                    {isCompleted ? '✓' : step}
                  </div>
                  <span className="stepper-label">
                    <small className="step-name">{label}</small>
                  </span>
                </div>
                {idx < tabs.length - 1 && (
                  <div className={`stepper-line ${idx < activeStepIdx ? 'completed' : ''}`} />
                )}
              </Fragment>
            )
          })}
        </div>

        <select 
          className="deck-select"
          value={deck} 
          disabled={busy || savingSession}
          onChange={e => { void changeLearnDeck(e.target.value === 'all' ? null : e.target.value) }}
        >
          <option value="all">Tất cả bộ từ</option>
          {snapshot.decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {tab === 'flashcard' && (
        <div className="flashcard-container-3d">
          <section 
            className={`learn-card flashcard-3d ${isFlipped ? 'flipped' : ''}`}
            onClick={() => !busy && !savingSession && setIsFlipped(!isFlipped)}
            title="Nhấp chuột hoặc nhấn phím Space để lật thẻ"
          >
            <div className="flashcard-3d-inner">
              {/* Mặt trước */}
              <div className="flashcard-face flashcard-front">
                <span className="new-badge">Từ mới</span>
                
                <div className="learn-word">
                  <h1>
                    {word.english} <em>({word.partOfSpeech})</em>{' '}
                    <button 
                      type="button" 
                      className="speaker-btn"
                      disabled={busy || savingSession || isTtsLoading(word.english)}
                      aria-busy={isTtsLoading(word.english)}
                      onClick={(e) => { e.stopPropagation(); speak(word); }}
                      title="Phát âm"
                    >
                      <SpeakerIcon />
                    </button>
                  </h1>
                  <p className="ipa">{ipa}</p>
                </div>

                <div className="flip-hint">
                  Chạm hoặc nhấn <kbd>Space</kbd> để xem nghĩa
                </div>
              </div>

              {/* Mặt sau */}
              <div className="flashcard-face flashcard-back">
                <span className="new-badge vi-badge">Nghĩa tiếng Việt</span>
                
                <div className="learn-word">
                  <h1 className="vietnamese-title">{word.vietnamese}</h1>
                  {word.exampleEn && (
                    <blockquote className="flashcard-example">
                      <p>“{word.exampleEn}”</p>
                      {word.exampleVi && <small>{word.exampleVi}</small>}
                    </blockquote>
                  )}
                </div>

                <div className="flip-hint">
                  Chạm hoặc nhấn <kbd>Space</kbd> để lật lại
                </div>
              </div>
            </div>
          </section>

          {/* External Card Actions to avoid misclicks */}
          <div className="learn-card-external-actions">
            <button className="button ghost defer-btn" disabled={busy || savingSession} onClick={skipWord}>
              Để sau
            </button>
            <button className="button mastered-btn" disabled={busy || savingSession} onClick={() => void nextWord(true, '')}>
              Đã thuộc
            </button>
            <button className="button next-step-btn" disabled={busy || savingSession} onClick={() => handleNextTab()}>
              Tiếp tục
            </button>
          </div>
        </div>
      )}

      {tab === 'meaning' && (
        <section className="learn-card meaning-learn">
          <div className="question-heading">CHỌN NGHĨA ĐÚNG</div>
          <h1>
            {word.english} <em>({word.partOfSpeech})</em>{' '}
            <button type="button" className="speaker-btn" disabled={busy || savingSession || isTtsLoading(word.english)} aria-busy={isTtsLoading(word.english)} onClick={() => speak(word)} title="Nghe phát âm">
              <SpeakerIcon />
            </button>
          </h1>
          
          <div className="meaning-choices">
            {choices.map((c, idx) => (
              <button 
                key={c} 
                className={`${choice === c ? 'selected ' : ''}${checked && c === word.vietnamese ? 'answer-correct ' : ''}${checked && choice === c && c !== word.vietnamese ? 'answer-wrong' : ''}`} 
                disabled={checked || busy || savingSession} 
                onClick={() => { setChoice(c); checkMeaning(c); }}
              >
                <span className="choice-num">{idx + 1}</span>
                <span className="choice-label">{c}</span>
              </button>
            ))}
          </div>

          {!checked ? (
            <button className="learn-check" disabled={!choice || busy || savingSession} onClick={() => checkMeaning()}>
              Kiểm tra
            </button>
          ) : (
            <div className={`learn-feedback ${correct ? 'ok' : 'bad'}`}>
              <span>{correct ? 'Chính xác!' : 'Chưa đúng, hãy chọn lại.'}</span>
              <button disabled={busy || savingSession} onClick={() => correct ? handleNextTab() : (setChecked(false), setChoice(''))}>
                {correct ? 'Tiếp tục →' : 'Thử lại'}
              </button>
            </div>
          )}
        </section>
      )}

      {tab === 'word' && (
        <section className="learn-card word-learn">
          <div className="question-heading">NHẬP TỪ TIẾNG ANH TƯƠNG ỨNG</div>
          <h1 className="vi-prompt">“{word.vietnamese}”</h1>
          
          <form onSubmit={checkWord} className="word-answer-form">
            <input 
              autoFocus 
              value={answer} 
              onChange={e => setAnswer(e.target.value)} 
              placeholder="Nhập từ tiếng Anh…" 
              autoComplete="off" 
              spellCheck={false}
              disabled={checked || busy || savingSession}
            />
            <button 
              type="button" 
              className="hint-button-text" 
              disabled={busy || savingSession || checked} 
              onClick={() => { setHint(true); setAnswer(word.english) }}
              title="Xem gợi ý"
            >
              Gợi ý
            </button>
            <button 
              type="button" 
              className="speaker-button-icon" 
              disabled={busy || savingSession || isTtsLoading(word.english)}
              aria-busy={isTtsLoading(word.english)}
              onClick={() => speak(word)}
              title="Nghe phát âm"
            >
              <SpeakerIcon />
            </button>
            <button className="learn-check" disabled={!answer.trim() || checked || busy || savingSession}>
              Kiểm tra
            </button>
          </form>

          {checked && (
            <div className={`learn-feedback ${correct ? 'ok' : 'bad'}`}>
              <span>{correct ? 'Chính xác!' : `Chưa đúng. Đáp án đúng: "${word.english}"`}</span>
              <button disabled={busy || savingSession} onClick={() => correct ? handleNextTab() : (setChecked(false), setAnswer(''))}>
                {correct ? 'Tiếp tục →' : 'Thử lại'}
              </button>
            </div>
          )}
        </section>
      )}

      {tab === 'example' && (
        <section className="learn-card example-learn">
          <div className="question-heading">ĐẶT CÂU VỚI TỪ VỰNG</div>
          <h1>
            {word.english} <em>({word.partOfSpeech})</em>{' '}
            <button type="button" className="speaker-btn" disabled={busy || savingSession || isTtsLoading(word.english)} aria-busy={isTtsLoading(word.english)} onClick={() => speak(word)} title="Nghe phát âm">
              <SpeakerIcon />
            </button>
          </h1>
          
          <div className="example-meaning">
            {word.vietnamese} <span>{ipa}</span>
          </div>
          
          <div 
            className="example-hint" 
            onClick={() => !busy && !savingSession && word.exampleVi && setShowVi(v => !v)}
            style={word.exampleVi ? { cursor: 'pointer' } : undefined}
          >
            <b>Ví dụ mẫu {word.exampleVi && <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--faint)', marginLeft: '0.5rem' }}>(Chạm để xem dịch)</span>}</b>
            <p>{example}</p>
            {showVi && word.exampleVi && <p className="vi-subtext">{word.exampleVi}</p>}
            <button type="button" className="speaker-btn-small" disabled={busy || savingSession || isTtsLoading(example)} aria-busy={isTtsLoading(example)} onClick={(e) => { e.stopPropagation(); speakText(example); }} title="Nghe câu ví dụ">
              <SpeakerIcon />
            </button>
          </div>

          <form onSubmit={checkExample}>
            <textarea 
              ref={exampleInputRef}
              style={checked && !correct ? { borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)' } : undefined}
              autoFocus
              value={answer} 
              onChange={e => setAnswer(e.target.value)} 
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (!checked && answer.trim()) {
                    checkExample({ preventDefault: () => {} } as FormEvent)
                  } else if (checked) {
                    if (correct) void nextWord(true)
                    else { setChecked(false); setAnswer(''); }
                  }
                }
              }}
              placeholder="Viết một câu tiếng Anh có chứa từ vựng trên..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={checked || busy || savingSession}
            />
            
            <div className="example-actions">
              <button type="button" className="ai-grade" disabled={!answer.trim() || checked || busy || savingSession || isAiGrading} onClick={handleAiGrade}>
                {isAiGrading ? 'Đang chấm...' : 'Đánh giá AI'}
              </button>
              <button className="learn-check" disabled={!answer.trim() || checked || busy || savingSession || isAiGrading}>
                Kiểm tra câu
              </button>
            </div>
          </form>

          {checked && (
            <div className={`learn-feedback ${correct ? 'ok' : 'bad'}`}>
              <div className="feedback-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <span>{correct ? 'Hoàn thành từ vựng này!' : 'Chưa đạt yêu cầu.'}</span>
                {aiFeedback && <p className="ai-feedback-text" style={{ fontSize: '0.9rem', opacity: 0.9, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{aiFeedback}</p>}
              </div>
              <button disabled={busy || savingSession} onClick={() => correct ? void nextWord(true) : (setChecked(false), setAnswer(''), setAiFeedback(''))}>
                {correct ? 'Hoàn thành →' : 'Thử lại'}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
