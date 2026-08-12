import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import type { TtsVoice, VocabularyItem } from '../domain/types'
import { senseMeanings, vocabularySenses } from '../domain/vocabulary'
import { isAcceptedAnswer } from '../lib/normalize'
import { isDue, MEMORY_LEVELS, memoryLevelInfo, nextMemoryLevel } from '../lib/srs'
import { NewStudyPage } from './NewStudyPage'
import { useTts } from '../lib/tts'

type Phase = 'entry' | 'preview' | 'question' | 'result'

import { SpeakerIcon } from '../components/SpeakerIcon'

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`check-svg ${className}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function FlipIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`flip-svg ${className}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  )
}

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
  onClose,
  voice,
}: { 
  level: number, 
  words: (VocabularyItem & { dueAt: string })[], 
  onDecrement: (id: string) => void,
  onReset: (id: string) => void,
  adjustingId: string | null,
  onClose?: () => void,
  voice: TtsVoice,
}) {
  const info = memoryLevelInfo(level as any)
  const [search, setSearch] = useState('')
  const { speak: speakTts, isLoading: isTtsLoading } = useTts(voice)

  const handlePlayAudio = (e: React.MouseEvent, text: string) => {
    e.stopPropagation()
    void speakTts(text)
  }

  const filteredWords = useMemo(() => {
    if (!search.trim()) return words
    const q = search.toLowerCase().trim()
    return words.filter(w => 
      w.english.toLowerCase().includes(q) || 
      senseMeanings(w).some(m => m.toLowerCase().includes(q))
    )
  }, [words, search])

  return (
    <div className="memory-level-list-wrapper" style={{ '--level-color': info.color } as React.CSSProperties}>
      <div className="memory-level-list-header">
        <div className="level-title-group">
          <span className="level-badge-pill" style={{ backgroundColor: info.color }}>
            LV{level}
          </span>
          <div>
            <h4>{info.label}</h4>
            <span className="level-word-count">{words.length} từ vựng</span>
          </div>
        </div>

        <div className="level-header-actions">
          {words.length > 4 && (
            <input 
              type="text" 
              className="memory-level-search-input"
              placeholder="Tìm từ trong cấp độ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          )}
          {onClose && (
            <button 
              type="button"
              className="memory-level-close-btn"
              onClick={onClose}
              title="Đóng danh sách từ"
              aria-label="Đóng danh sách từ"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="memory-level-list-content">
        {filteredWords.length === 0 ? (
          <div className="empty-level-state">
            <p>{search ? 'Không tìm thấy từ phù hợp với từ khóa.' : 'Không có từ nào ở cấp độ này.'}</p>
          </div>
        ) : (
          <div className="memory-word-grid">
            {filteredWords.map(word => {
              const isDue = new Date(word.dueAt).getTime() <= Date.now()
              const isAdjusting = adjustingId === word.id
              const meanings = senseMeanings(word)

              return (
                <div key={word.id} className={`memory-word-card ${isAdjusting ? 'adjusting' : ''}`}>
                  <div className="word-card-header">
                    <div className="word-head-title">
                      <strong className="word-english">{word.english}</strong>
                      <button 
                        type="button" 
                        className="word-audio-btn" 
                        onClick={(e) => handlePlayAudio(e, word.english)}
                        disabled={isTtsLoading(word.english)}
                        aria-busy={isTtsLoading(word.english)}
                        title="Nghe phát âm"
                      >
                        <SpeakerIcon className="audio-icon" />
                      </button>
                    </div>
                    {word.ipa && <span className="word-ipa">/{word.ipa}/</span>}
                  </div>

                  <div className="word-card-meanings">
                    {meanings.map((m, i) => (
                      <span key={i} className="meaning-tag">{m}</span>
                    ))}
                  </div>

                  <div className="word-card-footer">
                    <div className="word-due-status">
                      <span className={`status-indicator ${isDue ? 'is-due' : 'scheduled'}`}>
                        {isDue ? '● Đến hạn ôn' : '⏳ ' + new Date(word.dueAt).toLocaleString('vi-VN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="word-card-actions">
                      {level === 1 && (
                        <span className="level-floor-tag">Cấp thấp nhất</span>
                      )}
                      {level === 2 && (
                        <button 
                          disabled={isAdjusting} 
                          onClick={() => onDecrement(word.id)} 
                          className="action-btn decrement"
                          title="Giảm xuống cấp 1"
                        >
                          ↓ Giảm cấp
                        </button>
                      )}
                      {level >= 3 && (
                        <>
                          <button 
                            disabled={isAdjusting} 
                            onClick={() => onDecrement(word.id)} 
                            className="action-btn decrement"
                            title="Giảm 1 cấp"
                          >
                            ↓ Giảm 1 cấp
                          </button>
                          <button 
                            disabled={isAdjusting} 
                            onClick={() => onReset(word.id)} 
                            className="action-btn reset"
                            title="Đưa về cấp 1"
                          >
                            ⟲ Về cấp 1
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export function StudyPage() { 
  if (useLocation().pathname === '/learn') return <NewStudyPage />

  const { pathname } = useLocation()
  const navigate = useNavigate()
  const mode = pathname === '/learn' ? 'learn' : 'review'
  const { snapshot, reviewWord, adjustMemoryLevel } = useApp()
  const { speak: speakTts, isLoading: isTtsLoading, prefetch } = useTts(snapshot.profile.ttsVoice)
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
    const cardsByLevel = new Map<string, string>()
    snapshot.cards.forEach(card => {
      const level = card.memoryLevel >= 1 && card.memoryLevel <= 7 ? card.memoryLevel : 1
      if (level === selectedMemoryLevel) cardsByLevel.set(card.vocabularyId, card.dueAt)
    })
    
    return snapshot.vocabulary
      .filter(w => (deckId === 'all' || w.deckId === deckId) && cardsByLevel.has(w.id))
      .map(w => ({ ...w, dueAt: cardsByLevel.get(w.id)! }))
      .sort((a, b) => a.english.localeCompare(b.english))
  }, [selectedMemoryLevel, snapshot.cards, snapshot.vocabulary, deckId])

  const queue = useMemo(() => {
    const active = snapshot.vocabulary.filter((word) => (deckId === 'all' || word.deckId === deckId))
    if (mode === 'learn') return active.filter((word) => !snapshot.cards.some((card) => card.vocabularyId === word.id)).slice(0, snapshot.profile.newWordsPerSession)
    const dueIds = new Set(snapshot.cards.filter((card) => isDue(card)).sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt)).map((card) => card.vocabularyId))
    return active.filter((word) => dueIds.has(word.id))
  }, [deckId, mode, snapshot.cards, snapshot.profile.newWordsPerSession, snapshot.vocabulary])

  const cardLevelMap = useMemo(() => {
    const map = new Map<string, number>()
    snapshot.cards.forEach((card) => map.set(card.vocabularyId, card.memoryLevel || 1))
    return map
  }, [snapshot.cards])

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState<string>('')
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  useEffect(() => {
    if (mode === 'review') setSelectedIds(queue.map((word) => word.id))
  }, [deckId, mode, queue])

  const filteredQueue = useMemo(() => {
    if (!searchQuery.trim()) return queue
    const q = searchQuery.toLowerCase().trim()
    return queue.filter((word) => word.english.toLowerCase().includes(q) || word.vietnamese.toLowerCase().includes(q))
  }, [queue, searchQuery])

  const handleSelectAll = () => setSelectedIds(queue.map((w) => w.id))
  const handleDeselectAll = () => setSelectedIds([])

  const launchGame = () => {
    const params = new URLSearchParams({ source: 'due', deck: deckId })
    params.set('ids', selectedIds.join(','))
    navigate(`/game?${params.toString()}`)
  }

  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>(mode === 'learn' ? 'preview' : 'entry')
  const [isFlipped, setIsFlipped] = useState(false)
  const activeIds = useMemo(() => new Set(snapshot.vocabulary.filter((word) => (deckId === 'all' || word.deckId === deckId)).map(w => w.id)), [deckId, snapshot.vocabulary])
  
  const memoryStats = useMemo(() => {
    const stats = MEMORY_LEVELS.map(m => ({ label: m.shortLabel, count: 0, color: m.color }))
    let learnedCount = 0
    snapshot.cards.forEach(card => {
      if (!activeIds.has(card.vocabularyId)) return
      learnedCount++
      const level = card.memoryLevel >= 1 && card.memoryLevel <= 7 ? card.memoryLevel : 1
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

  useEffect(() => {
    if (current) void prefetch(current.english)
  }, [current, prefetch])

  const getMemoryLevel = (vocabularyId: string) => {
    const card = snapshot.cards.find(c => c.vocabularyId === vocabularyId)
    if (!card) return { label: 'MỚI', color: 'var(--faint)' }
    const info = memoryLevelInfo((card.memoryLevel || 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7)
    return { label: info.shortLabel, color: info.color }
  }

  const resetForNext = () => {
    setIndex((value) => value + 1)
    setPhase(mode === 'learn' ? 'preview' : 'question')
    setIsFlipped(false)
    setAnswer(''); setCorrect(false); startedAt.current = Date.now()
  }

  const revealQuestion = () => {
    setPhase('question'); setAnswer(''); setIsFlipped(false); startedAt.current = Date.now()
  }

  const submit = (event?: FormEvent) => {
    if (event) event.preventDefault()
    if (!current || !answer.trim()) return
    const isAnsCorrect = isAcceptedAnswer(answer, current.english, current.acceptedAnswers)
    setCorrect(isAnsCorrect)
    setPhase('result')
    setIsFlipped(true)
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

  // Keyboard shortcut listener (Space: Flip, Enter: Submit/Grade, 1-4: Quick rating)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeEl = document.activeElement
      const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')

      if (event.code === 'Space' && !isTyping) {
        event.preventDefault()
        setIsFlipped((prev) => !prev)
      } else if (event.key === 'Enter' && phase === 'result' && !busy) {
        event.preventDefault()
        void grade()
      } else if (phase === 'result' && !busy && ['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault()
        void grade()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [phase, busy, current?.id, correct])

  const speak = (word: VocabularyItem) => {
    void speakTts(word.english)
  }

  // Step 3: All words finished or empty queue
  if (!current) return (
    <div className="page study-page">
      <PageHeader 
        eyebrow="Spaced Repetition" 
        title="Ôn từ đến hạn" 
        actions={
          <select value={deckId} onChange={(event) => { setDeckId(event.target.value); setIndex(0) }}>
            <option value="all">Tất cả bộ từ</option>
            {snapshot.decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
          </select>
        } 
      />

      <div className="memory-stats-container">
        <div className="panel memory-stats-card">
          <h3>Thống kê từ vựng của bạn</h3>
          <p className="total-learned">Tổng số từ đã học: <br /><strong>{memoryStats.learnedCount.toLocaleString()}</strong><span>/{activeIds.size}</span></p>
          
          <MemoryBarChart stats={memoryStats.stats} maxCount={memoryStats.maxCount} selectedLevel={selectedMemoryLevel} onSelectLevel={setSelectedMemoryLevel} />
          {selectedMemoryLevel !== null && <MemoryLevelList level={selectedMemoryLevel} words={listWords} onDecrement={handleDecrement} onReset={handleReset} adjustingId={adjustingId} voice={snapshot.profile.ttsVoice} />}
        </div>

        <section className="panel empty-study">
          <div className="victory-core">
            <CheckIcon className="stepper-icon" />
          </div>
          <h2>{index > 0 ? 'Hoàn thành lượt ôn tập!' : 'Đã ôn xong hôm nay'}</h2>
          <p>{index > 0 ? `Bạn đã hoàn thành ${index} từ vựng. Cấp độ ghi nhớ SRS đã được cập nhật.` : 'Không có từ nào đến hạn cần ôn lúc này.'}</p>
          <div className="button-row" style={{ marginTop: '20px', justifyContent: 'center' }}>
            <Link className="dock-btn primary" to="/game">Củng cố bằng game</Link>
            <Link className="dock-btn secondary" to="/">Về tổng quan</Link>
          </div>
        </section>
      </div>
    </div>
  )

  // Step 1: Entry / Word Selection
  if (phase === 'entry') {
    return (
      <div className="page study-page">
        <PageHeader 
          eyebrow="Spaced Repetition" 
          title={<>Ôn từ <span className="accent">đến hạn</span></>} 
          description="Xem tổng quan bộ nhớ và bắt đầu tiến trình ôn tập." 
          actions={
            <select value={deckId} onChange={(event) => { setDeckId(event.target.value); setIndex(0) }}>
              <option value="all">Tất cả bộ từ</option>
              {snapshot.decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
            </select>
          } 
        />
        
        <div className="memory-stats-container">
          <div className="panel memory-stats-card">
            <h3>Thống kê từ vựng của bạn</h3>
            <p className="total-learned">Tổng số từ đã học: <br /><strong>{memoryStats.learnedCount.toLocaleString()}</strong><span>/{activeIds.size}</span></p>
            
            <MemoryBarChart stats={memoryStats.stats} maxCount={memoryStats.maxCount} selectedLevel={selectedMemoryLevel} onSelectLevel={setSelectedMemoryLevel} />
            {selectedMemoryLevel !== null && <MemoryLevelList level={selectedMemoryLevel} words={listWords} onDecrement={handleDecrement} onReset={handleReset} adjustingId={adjustingId} voice={snapshot.profile.ttsVoice} onClose={() => setSelectedMemoryLevel(null)} />}
          </div>

          <div className="panel review-action-card">
            <div className="due-card-header">
              <div className="due-stat-hero">
                <span className="due-stat-num">{selectedIds.length}</span>
                <span className="due-stat-denom">/ {queue.length}</span>
              </div>
              <p className="due-stat-label">Từ đến hạn đã được chọn để ôn tập</p>
            </div>

            {queue.length > 0 && (
              <div className="due-list-toolbar">
                <div className="due-toolbar-left">
                  <button
                    type="button"
                    className="button mini secondary due-toolbar-btn"
                    onClick={handleSelectAll}
                    disabled={selectedIds.length === queue.length}
                  >
                    ✓ Chọn tất cả ({queue.length})
                  </button>
                  <button
                    type="button"
                    className="button mini ghost due-toolbar-btn"
                    onClick={handleDeselectAll}
                    disabled={selectedIds.length === 0}
                  >
                    ✕ Bỏ chọn
                  </button>
                </div>

                {queue.length > 5 && (
                  <div className="due-search-wrapper">
                    <input
                      type="text"
                      className="due-search-input"
                      placeholder="Tìm từ vựng..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="review-word-selection">
              {filteredQueue.length === 0 ? (
                <div className="due-empty-state">
                  {queue.length === 0
                    ? '🎉 Không có từ nào đến hạn cần ôn lúc này!'
                    : 'Không tìm thấy từ vựng khớp với từ khóa tìm kiếm.'}
                </div>
              ) : (
                filteredQueue.map((word) => {
                  const level = cardLevelMap.get(word.id) || 1
                  const isChecked = selectedSet.has(word.id)
                  return (
                    <label key={word.id} className={`due-word-card ${isChecked ? 'is-selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() =>
                          setSelectedIds((ids) =>
                            ids.includes(word.id) ? ids.filter((id) => id !== word.id) : [...ids, word.id]
                          )
                        }
                      />
                      <div className="due-card-content">
                        <div className="due-card-row">
                          <b className="due-english-text">{word.english}</b>
                          <span className={`due-srs-badge level-${level}`}>Lv.{level}</span>
                        </div>
                        <small className="due-vietnamese-text">{word.vietnamese}</small>
                      </div>
                    </label>
                  )
                })
              )}
            </div>

            <div className="button-row due-buttons-row">
              <button
                className="dock-btn primary"
                onClick={() => {
                  startedAt.current = Date.now()
                  setPhase('question')
                }}
                disabled={selectedIds.length === 0}
              >
                Bắt đầu ôn ({selectedIds.length})
              </button>
              <button className="dock-btn secondary" onClick={launchGame} disabled={selectedIds.length === 0}>
                Chơi game ({selectedIds.length})
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Step 2: Interactive 3D Card Review & Question
  return (
    <div className="page study-page">
      <PageHeader 
        eyebrow="Spaced Repetition" 
        title={<>Ôn từ <span className="accent">đến hạn</span></>} 
        description="Nhìn gợi ý tiếng Việt, gõ đáp án tiếng Anh hoặc lật thẻ kiểm tra." 
        actions={
          <select value={deckId} onChange={(event) => { setDeckId(event.target.value); setIndex(0) }}>
            <option value="all">Tất cả bộ từ</option>
            {snapshot.decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
          </select>
        } 
      />

      <div className="session-progress" style={{ maxWidth: '960px', margin: '0 auto 20px auto' }}>
        <span style={{ width: `${Math.round(((index + 1) / queue.length) * 100)}%` }} />
        <small>{index + 1} / {queue.length}</small>
      </div>

      {/* 3D Tactile Flashcard Perspective Viewport */}
      <div className={`review-card-viewport ${isFlipped || phase === 'result' ? 'is-flipped' : ''}`}>
        <div className="review-card-3d">
          {/* Card Front */}
          <div className="card-face card-face-front">
            <div className="card-top-meta">
              <span className="memory-badge" style={{ backgroundColor: getMemoryLevel(current.id).color }}>
                {getMemoryLevel(current.id).label}
              </span>
              <span className="part-of-speech">{current.partOfSpeech || 'Từ vựng'} · Việt → Anh</span>
            </div>

            <div className="card-body-content">
              {phase === 'preview' ? (
                <>
                  <h2 className="card-prompt-title">{current.english}</h2>
                  <button className="card-audio-btn" onClick={() => speak(current)} disabled={isTtsLoading(current.english)} aria-busy={isTtsLoading(current.english)} title="Phát âm">
                    <SpeakerIcon />
                  </button>
                  <p className="card-ipa">{current.ipa || 'Chưa có IPA'}</p>
                  <div className="card-meaning-text">{current.vietnamese}</div>
                </>
              ) : (
                <>
                  <h2 className="card-prompt-title">{current.vietnamese}</h2>
                  <p className="card-ipa">Nhập từ tiếng Anh tương ứng</p>
                  
                  <form onSubmit={submit} className="review-input-form">
                    <input 
                      autoFocus 
                      value={answer} 
                      onChange={(e) => setAnswer(e.target.value)} 
                      autoComplete="off" 
                      spellCheck={false} 
                      placeholder="Gõ từ tiếng Anh..." 
                    />
                  </form>
                </>
              )}
            </div>

            {current.exampleEn && (
              <div className="card-example-box">
                <div className="card-example-label">Ví dụ minh họa</div>
                <p>{current.exampleEn}</p>
                {current.exampleVi && <small>{current.exampleVi}</small>}
              </div>
            )}
          </div>

          {/* Card Back */}
          <div className="card-face card-face-back">
            <div className="card-top-meta">
              <span className="memory-badge" style={{ backgroundColor: getMemoryLevel(current.id).color }}>
                {getMemoryLevel(current.id).label}
              </span>
              <span className="part-of-speech" style={{ color: correct ? 'var(--green)' : 'var(--danger)', fontWeight: 700 }}>
                {correct ? 'CHÍNH XÁC (+1 CẤP)' : 'CHƯA ĐÚNG (-1 CẤP)'}
              </span>
            </div>

            <div className="card-body-content">
              <h2 className="card-prompt-title" style={{ fontSize: '1.8rem' }}>{current.vietnamese}</h2>
              <button className="card-audio-btn" onClick={() => speak(current)} disabled={isTtsLoading(current.english)} aria-busy={isTtsLoading(current.english)} title="Phát âm">
                <SpeakerIcon />
              </button>
              
              <div className="answer-result-box" style={{ marginTop: '10px', textAlign: 'center' }}>
                {answer && <p style={{ margin: '4px 0', fontSize: '0.92rem', color: 'var(--muted)' }}>Bạn nhập: <strong>{answer}</strong></p>}
                <p style={{ margin: '6px 0', fontSize: '1.25rem', color: 'var(--cyan)', fontWeight: 800 }}>Đáp án: {current.english}</p>
                {current.acceptedAnswers.length > 0 && (
                  <small style={{ color: 'var(--faint)' }}>Chấp nhận thêm: {current.acceptedAnswers.join(', ')}</small>
                )}
              </div>
            </div>

            {current.exampleEn && (
              <div className="card-example-box">
                <div className="card-example-label">Ví dụ minh họa</div>
                <p>{current.exampleEn}</p>
                {current.exampleVi && <small>{current.exampleVi}</small>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Dock - Completely Separated Outside Card Container (Fitts's Law) */}
      <div className="review-action-dock">
        {phase === 'preview' ? (
          <div className="dock-controls-row">
            <button className="dock-btn primary" onClick={revealQuestion}>
              Đã xem · Kiểm tra trí nhớ
            </button>
          </div>
        ) : phase === 'question' ? (
          <div className="dock-controls-row">
            <button className="dock-btn primary" onClick={() => submit()}>
              Kiểm tra <kbd className="kbd-badge">↵ Enter</kbd>
            </button>
            <button className="dock-btn secondary" onClick={() => setIsFlipped((prev) => !prev)}>
              <FlipIcon /> {isFlipped ? 'Xem mặt trước' : 'Lật thẻ đáp án'} <kbd className="kbd-badge">Space</kbd>
            </button>
          </div>
        ) : (
          <div className="dock-controls-row" style={{ width: '100%' }}>
            {(() => {
              const card = snapshot.cards.find(item => item.vocabularyId === current.id)
              const nextLevel = card ? nextMemoryLevel(card, correct) : (correct ? 2 : 1)
              const info = memoryLevelInfo(nextLevel)
              return (
                <button 
                  className="dock-btn primary" 
                  disabled={busy} 
                  onClick={() => void grade()}
                  style={{
                    width: '100%',
                    minHeight: '52px',
                    fontSize: '1.05rem',
                    background: correct ? 'var(--green)' : 'var(--danger)',
                    borderColor: correct ? 'var(--green)' : 'var(--danger)',
                    color: '#ffffff',
                    boxShadow: correct ? '0 4px 14px rgba(16, 185, 129, 0.3)' : '0 4px 14px rgba(239, 68, 68, 0.3)'
                  }}
                >
                  <span>{correct ? 'Chính xác! Tiếp tục' : 'Chưa đúng · Tiếp tục'}</span>
                  <span style={{ opacity: 0.9, fontWeight: 500, fontSize: '0.88rem', marginLeft: '6px' }}>
                    ({correct ? `Tăng lên ${info.label}` : `Trừ 1 cấp xuống ${info.label}`})
                  </span>
                  <kbd className="kbd-badge" style={{ background: 'rgba(255, 255, 255, 0.25)', borderColor: 'rgba(255, 255, 255, 0.4)', color: '#ffffff' }}>↵ Enter</kbd>
                </button>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
