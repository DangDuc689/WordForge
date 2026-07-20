import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import type { VocabularyItem } from '../domain/types'
import { senseMeanings, vocabularySenses } from '../domain/vocabulary'
import { isAcceptedAnswer } from '../lib/normalize'
import { isDue, memoryLevelInfo, nextMemoryLevel } from '../lib/srs'
import { NewStudyPage } from './NewStudyPage'

type Phase = 'entry' | 'preview' | 'question' | 'result'

function MemoryBarChart({ stats, maxCount, selectedLevel, onSelectLevel }: { stats: any[], maxCount: number, selectedLevel: number | null, onSelectLevel: (level: number | null) => void }) {
  return (
    <div className="memory-bar-chart">
      {stats.map((s, idx) => {
        const level = idx + 1
        const isSelected = selectedLevel === level
        const isDimmed = selectedLevel !== null && !isSelected
        return (
          <button 
            key={s.label} 
            className={`memory-bar-col ${isSelected ? 'selected' : ''} ${isDimmed ? 'dimmed' : ''}`}
            onClick={() => onSelectLevel(isSelected ? null : level)}
            aria-label={`Xem từ ở ${s.label}`}
          >
            {s.count > 0 && <span className="memory-bar-val">{s.count.toLocaleString()}</span>}
            <div className="memory-bar" style={{ height: `${Math.max((s.count / maxCount) * 100, 2)}%`, '--bar-color': s.color } as React.CSSProperties} />
            <span className="memory-bar-label">{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function MemoryLevelList({ 
  level, 
  words, 
  onDecrement, 
  onReset,
  adjustingId,
}: { 
  level: number, 
  words: (VocabularyItem & { dueAt: string })[], 
  onDecrement: (id: string) => void,
  onReset: (id: string) => void,
  adjustingId: string | null,
}) {
  const info = memoryLevelInfo(level as any)
  return (
    <div className="memory-level-list">
      <div className="memory-level-list-header">
        <h4>{info.label} ({words.length} từ)</h4>
      </div>
      <div className="memory-level-list-content">
        {words.length === 0 ? (
          <p className="empty-message">Không có từ nào ở cấp độ này.</p>
        ) : (
          words.map(word => {
            const isDue = new Date(word.dueAt).getTime() <= Date.now()
            const isAdjusting = adjustingId === word.id
            return (
              <div key={word.id} className={`memory-word-item ${isAdjusting ? 'adjusting' : ''}`}>
                <div className="word-info">
                  <strong>{word.english}</strong>
                  <span>{senseMeanings(word).join(' · ')}</span>
                  <small className={isDue ? 'due' : ''}>{isDue ? 'Đến hạn ngay' : `Đến hạn: ${new Date(word.dueAt).toLocaleString('vi-VN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}</small>
                </div>
                <div className="word-actions">
                  {level === 1 && <button disabled className="button ghost small">Đã ở cấp thấp nhất</button>}
                  {level === 2 && <button disabled={isAdjusting} onClick={() => onDecrement(word.id)} className="button ghost small">Giảm xuống cấp 1</button>}
                  {level >= 3 && (
                    <>
                      <button disabled={isAdjusting} onClick={() => onDecrement(word.id)} className="button ghost small">Giảm 1 cấp</button>
                      <button disabled={isAdjusting} onClick={() => onReset(word.id)} className="button ghost small danger">Đưa về cấp 1</button>
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export function StudyPage() { if (useLocation().pathname === '/learn') return <NewStudyPage />

  const { pathname } = useLocation()
  const navigate = useNavigate()
  const mode = pathname === '/learn' ? 'learn' : 'review'
  const { snapshot, reviewWord, adjustMemoryLevel } = useApp()
  const [selectedMemoryLevel, setSelectedMemoryLevel] = useState<number | null>(null)
  const [adjustingId, setAdjustingId] = useState<string | null>(null)

  const handleDecrement = async (id: string) => {
    try {
      setAdjustingId(id)
      await adjustMemoryLevel(id, 'decrement')
    } catch (e) {
      alert('Có lỗi xảy ra khi giảm cấp độ: ' + (e instanceof Error ? e.message : ''))
    } finally {
      setAdjustingId(null)
    }
  }

  const handleReset = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn đưa từ này về cấp 1? Việc này sẽ khiến bạn phải ôn lại từ đầu.')) return
    try {
      setAdjustingId(id)
      await adjustMemoryLevel(id, 'reset-to-one')
    } catch (e) {
      alert('Có lỗi xảy ra khi đặt lại cấp độ: ' + (e instanceof Error ? e.message : ''))
    } finally {
      setAdjustingId(null)
    }
  }

  const [deckId, setDeckId] = useState('all')
  const listWords = useMemo(() => {
    if (selectedMemoryLevel === null) return []
    const cardsByLevel = new Map<string, string>() // id -> dueAt
    snapshot.cards.forEach(card => {
      const level = card.memoryLevel >= 1 && card.memoryLevel <= 6 ? card.memoryLevel : 1
      if (level === selectedMemoryLevel) cardsByLevel.set(card.vocabularyId, card.dueAt)
    })
    
    return snapshot.vocabulary
      .filter(w => w.status === 'active' && (deckId === 'all' || w.deckId === deckId) && cardsByLevel.has(w.id))
      .map(w => ({ ...w, dueAt: cardsByLevel.get(w.id)! }))
      .sort((a, b) => a.english.localeCompare(b.english))
  }, [selectedMemoryLevel, snapshot.cards, snapshot.vocabulary, deckId])
  const queue = useMemo(() => {
    const active = snapshot.vocabulary.filter((word) => word.status === 'active' && (deckId === 'all' || word.deckId === deckId))
    if (mode === 'learn') return active.filter((word) => !snapshot.cards.some((card) => card.vocabularyId === word.id)).slice(0, snapshot.profile.newWordsPerSession)
    const dueIds = new Set(snapshot.cards.filter((card) => isDue(card)).sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt)).map((card) => card.vocabularyId))
    return active.filter((word) => dueIds.has(word.id))
  }, [deckId, mode, snapshot.cards, snapshot.profile.newWordsPerSession, snapshot.vocabulary])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  useEffect(() => {
    if (mode === 'review') setSelectedIds(queue.map((word) => word.id))
  }, [deckId, mode, queue])
  const launchGame = () => {
    const params = new URLSearchParams({ source: 'due', deck: deckId })
    params.set('ids', selectedIds.join(','))
    navigate(`/game?${params.toString()}`)
  }

  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>(mode === 'learn' ? 'preview' : 'entry')
  const activeIds = useMemo(() => new Set(snapshot.vocabulary.filter((word) => word.status === 'active' && (deckId === 'all' || word.deckId === deckId)).map(w => w.id)), [deckId, snapshot.vocabulary])
  
  const memoryStats = useMemo(() => {
    const stats = [
      { label: 'LV1', count: 0, color: '#ef4444' }, { label: 'LV2', count: 0, color: '#f97316' },
      { label: 'LV3', count: 0, color: '#eab308' }, { label: 'LV4', count: 0, color: '#84cc16' },
      { label: 'LV5', count: 0, color: '#10b981' }, { label: 'Nhớ sâu', count: 0, color: '#3b82f6' },
    ]
    let learnedCount = 0
    snapshot.cards.forEach(card => {
      if (!activeIds.has(card.vocabularyId)) return
      learnedCount++
      const level = card.memoryLevel >= 1 && card.memoryLevel <= 6 ? card.memoryLevel : 1
      stats[level - 1].count++
    })
    const maxCount = Math.max(...stats.map(s => s.count), 1)
    return { stats, maxCount, learnedCount }
  }, [snapshot.cards, activeIds])
  const [answer, setAnswer] = useState('')
  const [correct, setCorrect] = useState(false)
  const [busy, setBusy] = useState(false)
  const startedAt = useRef(Date.now())
  const currentWord = queue[index]
  const current = useMemo(() => {
    if (!currentWord) return undefined
    const senses = vocabularySenses(currentWord)
    const reps = snapshot.cards.find((card) => card.vocabularyId === currentWord.id)?.reps ?? 0
    return { ...currentWord, ...senses[reps % senses.length], sourceKey: currentWord.sourceKey }
  }, [currentWord, snapshot.cards])

  const getMemoryLevel = (vocabularyId: string) => {
    const card = snapshot.cards.find(c => c.vocabularyId === vocabularyId)
    if (!card) return { label: 'MỚI', color: 'var(--faint)' }
    const info = memoryLevelInfo((card.memoryLevel || 1) as 1 | 2 | 3 | 4 | 5 | 6)
    return { label: info.shortLabel, color: info.color }
  }

  const resetForNext = () => {
    setIndex((value) => value + 1)
    setPhase(mode === 'learn' ? 'preview' : 'question')
    setAnswer(''); setCorrect(false); startedAt.current = Date.now()
  }

  const revealQuestion = () => {
    setPhase('question'); setAnswer(''); startedAt.current = Date.now()
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!current || !answer.trim()) return
    setCorrect(isAcceptedAnswer(answer, current.english, current.acceptedAnswers))
    setPhase('result')
  }

  const grade = async () => {
    if (!current) return
    setBusy(true)
    await reviewWord({
      vocabularyId: current.id,
      mode,
      correct,
      submittedAnswer: answer,
      responseMs: Date.now() - startedAt.current,
    })
    setBusy(false)
    resetForNext()
  }

  useEffect(() => {
    if (phase !== 'result' || busy) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return
      event.preventDefault()
      void grade()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, busy, current?.id, correct])

  const speak = (word: VocabularyItem) => {
    if (!('speechSynthesis' in window)) return
    const utterance = new SpeechSynthesisUtterance(word.english); utterance.lang = 'en-US'; utterance.rate = .85
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance)
  }

  if (!current) return (
    <div className="page study-page">
      <PageHeader eyebrow={mode === 'learn' ? 'New vocabulary' : 'Spaced repetition'} title={mode === 'learn' ? 'Học từ mới' : 'Ôn từ đến hạn'} actions={<select value={deckId} onChange={(event) => { setDeckId(event.target.value); setIndex(0) }}><option value="all">Tất cả bộ từ</option>{snapshot.decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select>} />
      
      <div className="memory-stats-container">
        <div className="panel memory-stats-card">
          <h3>Thống kê từ vựng của bạn</h3>
          <p className="total-learned">Tổng số từ đã học: <br /><strong>{memoryStats.learnedCount.toLocaleString()}</strong><span>/{activeIds.size}</span></p>
          
          <MemoryBarChart stats={memoryStats.stats} maxCount={memoryStats.maxCount} selectedLevel={selectedMemoryLevel} onSelectLevel={setSelectedMemoryLevel} />
          {selectedMemoryLevel !== null && <MemoryLevelList level={selectedMemoryLevel} words={listWords} onDecrement={handleDecrement} onReset={handleReset} adjustingId={adjustingId} />}
        </div>

        <section className="panel empty-study">
          <div className="victory-core">✓</div>
          <h2>{index > 0 ? 'Hoàn thành lượt học!' : mode === 'learn' ? 'Không còn từ mới' : 'Đã ôn xong hôm nay'}</h2>
          <p>{index > 0 ? `Bạn đã xử lý ${index} từ. Lộ trình 6 cấp nhớ đã được cập nhật.` : 'Chọn bộ từ khác hoặc quay lại vào lần sau.'}</p>
          <div>
            <Link className="button primary" to="/game">Củng cố bằng game</Link>
            <Link className="button ghost" to="/">Về tổng quan</Link>
          </div>
        </section>
      </div>
    </div>
  )

  if (phase === 'entry') {
    return (
      <div className="page study-page">
        <PageHeader eyebrow="Spaced repetition" title={<>Ôn từ <span className="accent">đến hạn</span></>} description="Xem tổng quan bộ nhớ và bắt đầu ôn tập." actions={<select value={deckId} onChange={(event) => { setDeckId(event.target.value); setIndex(0) }}><option value="all">Tất cả bộ từ</option>{snapshot.decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select>} />
        
        <div className="memory-stats-container">
          <div className="panel memory-stats-card">
            <h3>Thống kê từ vựng của bạn</h3>
            <p className="total-learned">Tổng số từ đã học: <br /><strong>{memoryStats.learnedCount.toLocaleString()}</strong><span>/{activeIds.size}</span></p>
            
            <MemoryBarChart stats={memoryStats.stats} maxCount={memoryStats.maxCount} selectedLevel={selectedMemoryLevel} onSelectLevel={setSelectedMemoryLevel} />
            {selectedMemoryLevel !== null && <MemoryLevelList level={selectedMemoryLevel} words={listWords} onDecrement={handleDecrement} onReset={handleReset} adjustingId={adjustingId} />}
          </div>

          <div className="panel review-action-card">
            <h2>{selectedIds.length.toLocaleString('en-US')} <span>/ {queue.length} từ</span></h2>
            <p>Chọn từ muốn ôn bằng game</p>
            <div className="review-word-selection">
              {queue.map((word) => (
                <label key={word.id}>
                  <input type="checkbox" checked={selectedSet.has(word.id)} onChange={() => setSelectedIds((ids) => ids.includes(word.id) ? ids.filter((id) => id !== word.id) : [...ids, word.id])} />
                  <span><b>{word.vietnamese}</b><small>{word.english}</small></span>
                </label>
              ))}
            </div>
            <div className="button-row">
              <button className="button primary large" onClick={launchGame} disabled={selectedIds.length === 0}>Chơi để ôn →</button>
              <button className="button ghost" onClick={() => { startedAt.current = Date.now(); setPhase('question') }} disabled={queue.length === 0}>Ôn bằng thẻ</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page study-page">
      <PageHeader eyebrow={mode === 'learn' ? 'New vocabulary' : 'Spaced repetition'} title={mode === 'learn' ? <>Học <span className="accent">từ mới</span></> : <>Ôn từ <span className="accent">đến hạn</span></>} description={mode === 'learn' ? 'Xem ngữ cảnh trước, sau đó tự nhớ lại Việt → Anh.' : 'Gõ đáp án rồi bấm Tiếp tục để cập nhật cấp nhớ.'} actions={<select value={deckId} onChange={(event) => { setDeckId(event.target.value); setIndex(0) }}><option value="all">Tất cả bộ từ</option>{snapshot.decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select>} />
      <div className="session-progress"><span style={{ width: `${Math.round(index / queue.length * 100)}%` }} /><small>{index + 1} / {queue.length}</small></div>
      <div className={`flashcard-container ${phase === 'result' ? 'flipped' : ''}`}>
        <div className="flashcard-inner">
          {/* Mặt trước: Preview hoặc Question */}
          <section className="review-card panel front">
            {phase === 'preview' ? (
              <>
                <div className="card-top-meta">
                  <span className="memory-badge" style={{ backgroundColor: getMemoryLevel(current.id).color }}>{getMemoryLevel(current.id).label}</span>
                  <span className="part-of-speech">{current.partOfSpeech}</span>
                </div>
                <h2>{current.english}</h2>
                <button className="round-speak" onClick={() => speak(current)}>◖</button>
                <p className="ipa">{current.ipa || 'Chưa có IPA'}</p>
                <div className="meaning">{current.vietnamese}</div>
                {current.exampleEn && <blockquote><b>{current.exampleEn}</b><span>{current.exampleVi}</span></blockquote>}
                <button className="button primary wide" onClick={revealQuestion}>Đã xem · Kiểm tra trí nhớ →</button>
              </>
            ) : (
              <>
                <div className="card-top-meta">
                  <span className="memory-badge" style={{ backgroundColor: getMemoryLevel(current.id).color }}>{getMemoryLevel(current.id).label}</span>
                  <span className="part-of-speech">{current.partOfSpeech} · Việt → Anh</span>
                </div>
                <h2 className="prompt-vi">{current.vietnamese}</h2>
                <form onSubmit={submit} className="answer-form">
                  <input autoFocus value={answer} onChange={(event) => setAnswer(event.target.value)} autoComplete="off" spellCheck={false} placeholder="Nhập từ tiếng Anh…" />
                  <button className="button primary">Kiểm tra</button>
                </form>
              </>
            )}
          </section>

          {/* Mặt sau: Result & Rating */}
          <section className="review-card panel back">
            <div className="card-top-meta">
              <span className="memory-badge" style={{ backgroundColor: getMemoryLevel(current.id).color }}>{getMemoryLevel(current.id).label}</span>
              <span className="part-of-speech">{correct ? 'CHÍNH XÁC' : 'CHƯA ĐÚNG'}</span>
            </div>
            <h2 className="prompt-vi">{current.vietnamese}</h2>
            <div className={`answer-result ${correct ? 'correct' : 'wrong'}`}>
              <small>Bạn đã nhập</small><b>{answer}</b>
              <small>Đáp án</small><strong>{current.english}</strong>
              {current.acceptedAnswers.length > 0 && <em>Chấp nhận: {current.acceptedAnswers.join(', ')}</em>}
            </div>
            {current.exampleEn && <blockquote><b>{current.exampleEn}</b><span>{current.exampleVi}</span></blockquote>}
            <div className="rating-grid memory-next" aria-label="Cập nhật cấp nhớ">
              {(() => {
                const card = snapshot.cards.find(item => item.vocabularyId === current.id)
                const nextLevel = card ? nextMemoryLevel(card, correct) : (correct ? 2 : 1)
                const info = memoryLevelInfo(nextLevel)
                return <button className="suggested" disabled={busy} onClick={() => void grade()}>
                  <b>Tiếp tục · {info.label}</b><small>{correct ? 'Tăng cấp' : 'Lùi một cấp'} · ôn {info.delayLabel}</small><kbd>↵</kbd>
                </button>
              })()}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
