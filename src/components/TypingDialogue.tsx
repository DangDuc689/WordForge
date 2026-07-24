import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

interface DialogueLine {
  speaker: string
  text: string
  isA: boolean
}

interface TypingDialogueProps {
  passage: string
  passageVi: string
  speakSentence: (text: string, rate?: number) => void
  onComplete: () => void
}

// Icon loa cho nút nghe lại
const IconVolume = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
)

export function TypingDialogue({ passage, passageVi, speakSentence, onComplete }: TypingDialogueProps) {
  // Parse đoạn hội thoại thành danh sách các dòng
  const lines = useMemo<DialogueLine[]>(() => {
    return passage.split(/\\n|\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .map(line => {
        const match = line.match(/^([A-Za-z0-9\s]+):(.*)$/)
        if (match) {
          const speaker = match[1].trim()
          return { speaker, text: match[2].trim(), isA: speaker.toUpperCase() === 'A' }
        }
        return { speaker: '', text: line, isA: true }
      })
      .filter(l => l.text.length > 0)
  }, [passage])

  const [activeLineIdx, setActiveLineIdx] = useState(0)
  const [activeCharIdx, setActiveCharIdx] = useState(0)
  const [completedLines, setCompletedLines] = useState<Set<number>>(new Set())
  const [allDone, setAllDone] = useState(false)
  const [wrongFlash, setWrongFlash] = useState(false)
  const [isFocused, setIsFocused] = useState(true)
  const [stats, setStats] = useState({ totalKeys: 0, wrongKeys: 0 })

  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const activeBubbleRef = useRef<HTMLDivElement>(null)
  const wrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeLine = lines[activeLineIdx]
  const activeText = activeLine?.text ?? ''

  // Phát âm dòng đầu tiên khi component mount
  useEffect(() => {
    if (lines.length > 0) {
      const timer = setTimeout(() => speakSentence(lines[0].text, 0.9), 400)
      return () => clearTimeout(timer)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Focus input khi dòng thay đổi
  useEffect(() => {
    inputRef.current?.focus()
  }, [activeLineIdx])

  // Cuộn mượt đến bong bóng đang active
  useEffect(() => {
    if (activeBubbleRef.current) {
      activeBubbleRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeLineIdx])

  // Cleanup timer khi unmount
  useEffect(() => {
    return () => {
      if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current)
    }
  }, [])

  // Xử lý sự kiện phím
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (allDone || !activeLine) return

    const key = e.key

    // Chặn hành vi mặc định
    if (key.length === 1 || key === ' ' || key === 'Backspace' || key === 'Tab') {
      e.preventDefault()
    }

    // Chỉ xử lý ký tự in được (gồm cả dấu cách)
    if (key.length !== 1) return

    const expected = activeText[activeCharIdx]
    if (expected === undefined) return

    // So sánh: chữ cái → không phân biệt hoa/thường; ký tự đặc biệt → khớp chính xác
    const isCorrect = /[a-zA-Z]/.test(expected)
      ? key.toLowerCase() === expected.toLowerCase()
      : key === expected

    setStats(prev => ({
      totalKeys: prev.totalKeys + 1,
      wrongKeys: prev.wrongKeys + (isCorrect ? 0 : 1)
    }))

    if (isCorrect) {
      // Gõ đúng → tiến lên ký tự tiếp theo
      const nextCharIdx = activeCharIdx + 1

      if (nextCharIdx >= activeText.length) {
        // Hoàn thành dòng hiện tại
        setCompletedLines(prev => {
          const next = new Set(prev)
          next.add(activeLineIdx)
          return next
        })

        const nextLineIdx = activeLineIdx + 1
        if (nextLineIdx >= lines.length) {
          // Hoàn thành toàn bộ hội thoại
          setAllDone(true)
          setTimeout(onComplete, 600)
        } else {
          // Chuyển sang dòng tiếp theo
          setActiveLineIdx(nextLineIdx)
          setActiveCharIdx(0)
          setTimeout(() => speakSentence(lines[nextLineIdx].text, 0.9), 500)
        }
      } else {
        setActiveCharIdx(nextCharIdx)
      }
    } else {
      // Gõ sai → flash đỏ + lắc, KHÔNG tiến lên
      if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current)
      setWrongFlash(true)
      wrongTimerRef.current = setTimeout(() => setWrongFlash(false), 350)
    }
  }, [allDone, activeLine, activeText, activeCharIdx, activeLineIdx, lines, speakSentence, onComplete])

  const handleContainerClick = () => {
    if (!allDone) inputRef.current?.focus()
  }

  // Tính toán thống kê
  const accuracy = stats.totalKeys > 0
    ? Math.round(((stats.totalKeys - stats.wrongKeys) / stats.totalKeys) * 100)
    : 100

  const progressPercent = lines.length > 0
    ? Math.round((completedLines.size / lines.length) * 100)
    : 0

  // Edge case: không có dòng nào
  if (lines.length === 0) {
    return <div className="typing-footer-hint">Không có dòng hội thoại nào để gõ.</div>
  }

  return (
    <div
      className="typing-dialogue-container"
      ref={containerRef}
      onClick={handleContainerClick}
    >
      {/* Input ẩn bắt sự kiện bàn phím */}
      <input
        ref={inputRef}
        className="typing-hidden-input"
        type="text"
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        autoFocus
        aria-label="Gõ ký tự để hoàn thành câu thoại"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      {/* Thanh tiến trình */}
      <div className="typing-progress">
        <div className="typing-progress-bar">
          <div
            className="typing-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="typing-progress-text">
          {completedLines.size}/{lines.length} câu · Chính xác: {accuracy}%
        </span>
      </div>

      {/* Các dòng hội thoại */}
      <div className="typing-lines">
        {lines.map((line, idx) => {
          const isCompleted = completedLines.has(idx)
          const isActive = idx === activeLineIdx && !allDone
          const isFuture = idx > activeLineIdx && !allDone

          if (isFuture) return null

          return (
            <div
              key={idx}
              className={`typing-bubble-wrapper ${line.isA ? 'speaker-a' : 'speaker-b'}`}
              ref={isActive ? activeBubbleRef : undefined}
            >
              <div className={`typing-bubble ${isActive ? 'typing-bubble-active' : ''} ${isCompleted ? 'typing-bubble-done' : ''}`}>
                <div className="typing-bubble-top">
                  <span className="typing-speaker-label">
                    {line.speaker ? `Lượt nói ${line.speaker}` : ''}
                  </span>
                  {(isCompleted || isActive) && (
                    <button
                      type="button"
                      className="typing-replay-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        speakSentence(line.text, 0.9)
                      }}
                      title="Nghe lại"
                    >
                      <IconVolume />
                    </button>
                  )}
                </div>

                {isCompleted && (
                  <span className="typing-done-text">
                    <span className="typing-done-check">✓</span> {line.text}
                  </span>
                )}

                {isActive && (
                  <div className="typing-char-row">
                    {activeText.split('').map((char, cIdx) => {
                      const isTyped = cIdx < activeCharIdx
                      const isCurrent = cIdx === activeCharIdx
                      let cls = 'tchar'
                      if (isTyped) cls += ' tchar-ok'
                      if (isCurrent) {
                        cls += ' tchar-cursor'
                        if (wrongFlash) cls += ' tchar-shake'
                      }

                      return (
                        <span key={cIdx} className={cls}>
                          {char === ' ' ? '\u00A0' : char}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Gợi ý khi mất focus */}
      {!allDone && !isFocused && (
        <div className="typing-focus-hint" onClick={() => inputRef.current?.focus()}>
          🖱️ Bấm vào đây để tiếp tục gõ
        </div>
      )}

      {/* Gợi ý khi đang gõ */}
      {!allDone && isFocused && (
        <div className="typing-footer-hint">
          ⌨️ Gõ từng ký tự để hoàn thành câu thoại
        </div>
      )}

      {/* Banner hoàn thành */}
      {allDone && (
        <>
          <div className="typing-complete-banner">
            <span className="typing-complete-icon">🎉</span>
            <strong>Hoàn thành hội thoại!</strong>
            <span>Chính xác {accuracy}% · Cuộn xuống để trả lời câu hỏi</span>
          </div>

          <details style={{ marginTop: '1.25rem', cursor: 'pointer' }}>
            <summary style={{ fontWeight: 600, color: 'var(--cyan)' }}>Xem bản dịch tham khảo</summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem', background: 'var(--bg2)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--line)' }}>
              {passageVi.split(/\\n|\n/).map((line, idx) => (
                <p key={idx} style={{ margin: 0, padding: '0.25rem 0', opacity: 0.9, fontSize: '0.95rem' }}>
                  {line}
                </p>
              ))}
            </div>
          </details>
        </>
      )}
    </div>
  )
}
