import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import type { VocabularyItem } from '../domain/types'
import { vocabularySenses } from '../domain/vocabulary'
import { isAcceptedAnswer } from '../lib/normalize'
import { isDue } from '../lib/srs'

type Tab = 'flashcard' | 'meaning' | 'word' | 'example'
const tabs = [
  ['flashcard', '▱', 'Flashcard'],
  ['meaning', '♧', 'Meaning'],
  ['word', 'T', 'Word'],
  ['example', '⌁', 'Example']
] as const

const speak = (w: VocabularyItem) => {
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(w.english)
  u.lang = 'en-US'
  speechSynthesis.cancel()
  speechSynthesis.speak(u)
}

const Stats = ({ total, learn, review }: { total: number; learn: number; review: number }) => (
  <div className="learn-stats">
    <div className="learn-stat total"><strong>{total}</strong><span>TOTAL</span></div>
    <div className="learn-stat learn"><strong>{learn}</strong><span>LEARNED</span></div>
    <div className="learn-stat review"><strong>{review}</strong><span>TO REVIEW</span></div>
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

  const [tab, setTab] = useState<Tab>('flashcard')
  
  const [answer, setAnswer] = useState('')
  const [choice, setChoice] = useState('')
  const [checked, setChecked] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false)
  const [showVi, setShowVi] = useState(false)
  const started = useRef(Date.now())

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

  const choices = useMemo(() => {
    if (!word) return []
    const d = snapshot.vocabulary
      .filter(w => w.status === 'active' && w.id !== word.id)
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
        setTimeout(() => handleNextTab(), 800)
      }
    }
  }

  const checkMeaning = () => {
    if (word && choice) {
      const isOk = choice === word.vietnamese
      setCorrect(isOk)
      setChecked(true)
      if (isOk) {
        setTimeout(() => handleNextTab(), 800)
      }
    }
  }

  const checkExample = (e: FormEvent) => {
    e.preventDefault()
    if (word && answer.trim()) {
      const isOk = answer.toLowerCase().includes(word.english.toLowerCase())
      setCorrect(isOk)
      setChecked(true)
    }
  }
  
  const total = snapshot.vocabulary.filter(w => w.status === 'active' && (deck === 'all' || w.deckId === deck)).length
  const learnedCount = snapshot.vocabulary.filter(w => w.status === 'active' && (deck === 'all' || w.deckId === deck) && snapshot.cards.some(c => c.vocabularyId === w.id)).length
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
          <div>✓</div>
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
                  Học tiếp
                </button>
                <Link className="button ghost" to="/">Về tổng quan</Link>
              </div>
            </>
          ) : (
            <>
              <h2>Tuyệt vời! 🎉</h2>
              <p>Bạn đã học hết toàn bộ từ mới trong bộ từ này rồi.</p>
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

  return (
    <div className="page learn-page">
      <Stats total={total} learn={learnedCount} review={reviewCount} />
      
      <div className="learn-toolbar">
        <div className="learn-tabs" role="tablist">
          {tabs.map(([id, icon, label]) => (
            <button 
              key={id} 
              className={tab === id ? 'active' : ''} 
              disabled
              role="tab" 
              aria-selected={tab === id}
            >
              <i>{icon}</i>{label}
            </button>
          ))}
        </div>
        <select 
          value={deck} 
          disabled={busy || savingSession}
          onChange={e => { void changeLearnDeck(e.target.value === 'all' ? null : e.target.value) }}
        >
          <option value="all">Tất cả bộ từ</option>
          {snapshot.decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {tab === 'flashcard' && (
        <section 
          className={`learn-card flashcard-learn ${isFlipped ? 'flipped' : ''}`}
          onClick={() => !busy && !savingSession && setIsFlipped(!isFlipped)}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <span className="new-badge">✨ Từ mới</span>
          
          <div className="learn-word">
            {!isFlipped ? (
              <>
                <h1>{word.english} <em>({word.partOfSpeech})</em> <button type="button" disabled={busy || savingSession} onClick={(e) => { e.stopPropagation(); speak(word); }}>◖</button></h1>
                <p>{ipa}</p>
                <div style={{ marginTop: '20px', color: 'var(--faint)', fontSize: '0.9rem', fontWeight: 500 }}>Chạm để lật thẻ</div>
              </>
            ) : (
              <>
                <h1>{word.vietnamese}</h1>
                <div style={{ marginTop: '20px', color: 'var(--faint)', fontSize: '0.9rem', fontWeight: 500 }}>Chạm để lật lại</div>
              </>
            )}
          </div>

          <div className="learn-card-actions" onClick={e => e.stopPropagation()}>
            <button className="button ghost" disabled={busy || savingSession} onClick={skipWord}>Để sau</button>
            <button className="mastered-button" disabled={busy || savingSession} onClick={() => void nextWord(true, '')}>Mastered</button>
            <button className="next-button" disabled={busy || savingSession} onClick={() => handleNextTab()}>Next&nbsp; →</button>
          </div>
        </section>
      )}

      {tab === 'meaning' && (
        <section className="learn-card meaning-learn">
          <div className="question-heading">🧠 &nbsp;WHAT DOES THIS MEAN?</div>
          <h1>{word.english} <em>({word.partOfSpeech})</em> <button type="button" disabled={busy || savingSession} onClick={() => speak(word)}>◖</button></h1>
          
          <div className="meaning-choices">
            {choices.map(c => (
              <button 
                key={c} 
                className={`${choice === c ? 'selected ' : ''}${checked && c === word.vietnamese ? 'answer-correct ' : ''}${checked && choice === c && c !== word.vietnamese ? 'answer-wrong' : ''}`} 
                disabled={checked || busy || savingSession} 
                onClick={() => setChoice(c)}
              >
                <span />{c}
              </button>
            ))}
          </div>

          {!checked ? (
            <button className="learn-check" disabled={!choice || busy || savingSession} onClick={checkMeaning}>Check</button>
          ) : (
            <div className={`learn-feedback ${correct ? 'ok' : 'bad'}`}>
              {correct ? 'Chính xác! 🎉' : 'Chưa chính xác, hãy chọn lại nhé.'}
              <button disabled={busy || savingSession} onClick={() => correct ? handleNextTab() : (setChecked(false), setChoice(''))}>
                {correct ? 'Next →' : 'Thử lại'}
              </button>
            </div>
          )}
        </section>
      )}

      {tab === 'word' && (
        <section className="learn-card word-learn">
          <div className="question-heading">📕 &nbsp;WHICH ENGLISH WORD?</div>
          <h1>“{word.vietnamese}”</h1>
          
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
            <button type="button" className="hint-button" disabled={busy || savingSession || checked} onClick={() => { setHint(true); setAnswer(word.english) }}>💡</button>
            <button type="button" className="mic-button" disabled={busy || savingSession} onClick={() => speak(word)}>♩</button>
            <button className="learn-check" disabled={!answer.trim() || checked || busy || savingSession}>Check</button>
          </form>

          {checked && (
            <div className={`learn-feedback ${correct ? 'ok' : 'bad'}`}>
              {correct ? 'Chính xác! 🎉' : 'Chưa chính xác, hãy nhập lại nhé.'}
              <button disabled={busy || savingSession} onClick={() => correct ? handleNextTab() : setChecked(false)}>
                {correct ? 'Next →' : 'Thử lại'}
              </button>
            </div>
          )}
        </section>
      )}

      {tab === 'example' && (
        <section className="learn-card example-learn">
          <div className="question-heading">📝 &nbsp;MAKE A SENTENCE WITH THIS WORD</div>
          <h1>{word.english} <em>({word.partOfSpeech})</em> <button type="button" disabled={busy || savingSession} onClick={() => speak(word)}>◖</button></h1>
          
          <div className="example-meaning">{word.vietnamese} <span>{ipa}</span></div>
          
          <div 
            className="example-hint" 
            onClick={() => !busy && !savingSession && word.exampleVi && setShowVi(v => !v)}
            style={word.exampleVi ? { cursor: 'pointer' } : undefined}
          >
            <b>📖 Gợi ý {word.exampleVi && <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--faint)', marginLeft: '0.5rem' }}>(Chạm để xem nghĩa)</span>}</b>
            <p>{example}</p>
            {showVi && word.exampleVi && <p style={{ color: 'var(--faint)', fontSize: '0.9rem', marginTop: '0.5rem' }}>{word.exampleVi}</p>}
            <button type="button" disabled={busy || savingSession} onClick={(e) => { e.stopPropagation(); speak(word); }}>◖</button>
          </div>

          <form onSubmit={checkExample}>
            <textarea 
              value={answer} 
              onChange={e => setAnswer(e.target.value)} 
              placeholder="Write an English sentence (AI graded) or copy the example above…"
              disabled={checked || busy || savingSession}
            />
            
            <div className="example-actions">
              <button type="button" className="ai-grade" disabled={!answer.trim() || checked || busy || savingSession} onClick={() => checkExample({ preventDefault: () => {} } as FormEvent)}>🤖 Grade with AI</button>
              <button className="learn-check" disabled={!answer.trim() || checked || busy || savingSession}>Check</button>
            </div>
          </form>

          {checked && (
            <div className={`learn-feedback ${correct ? 'ok' : 'bad'}`}>
              {correct ? 'Câu trả lời tốt! 🎉' : 'Hãy thử dùng đúng từ vựng trong câu.'}
              <button disabled={busy || savingSession} onClick={() => correct ? void nextWord(true) : setChecked(false)}>
                {correct ? 'Hoàn thành →' : 'Thử lại'}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
