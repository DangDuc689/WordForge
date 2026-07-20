import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import { GameEngine, type GameSnapshot, type ShopKey } from '../game/GameEngine'
import { buildGamePool, type GamePoolSource } from '../game/sessionPool'
import { useSearchParams } from 'react-router-dom'

const SHOP_META: Record<ShopKey, { name: string; description: string; color: string }> = {
  hp: { name: 'Gia cố core', description: '+15 HP tối đa và hồi đầy core.', color: 'green' },
  regen: { name: 'Tự sửa chữa', description: '+0,8 HP hồi mỗi giây.', color: 'cyan' },
  slow: { name: 'Slow-Time [1]', description: 'Đóng băng mọi quái trong 3 giây.', color: 'amber' },
  hint: { name: 'Reveal [2]', description: 'Lộ chữ cái đầu của một đáp án.', color: 'pink' },
}

const formatGameTime = (seconds: number) => Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0')

function GameResultPanel({
  hud,
  accuracy,
  saved,
  saveError,
  onDrill,
  onStop,
}: {
  hud: GameSnapshot
  accuracy: number
  saved: boolean
  saveError: string
  onDrill: () => void
  onStop: () => void
}) {
  return <section className="game-result-card" role="dialog" aria-modal="true" aria-labelledby="game-result-title">
    <span className={'eyebrow ' + (hud.endReason === 'breached' ? 'danger-text' : '')}>{hud.endReason === 'completed' ? 'Đã ôn hết bộ từ' : hud.endReason === 'ended' ? 'Trận đấu kết thúc sớm' : 'Core breached'}</span>
    <h2 id="game-result-title">{hud.endReason === 'completed' ? <>Hoàn thành <em>bộ từ</em></> : hud.endReason === 'ended' ? <>Tổng kết <em className="accent">kết quả</em></> : <>Siege <em className="danger-text">over</em></>}</h2>
    <div className="end-stats"><span><b>{formatGameTime(hud.time)}</b><small>Thời gian</small></span><span><b>{hud.kills}</b><small>Trả lời đúng</small></span><span><b>{accuracy}%</b><small>Accuracy</small></span><span><b>{hud.wave}</b><small>Wave</small></span></div>
    <h3>Từ đã lọt qua <small>{hud.missed.length}</small></h3>
    <div className="missed-words">{hud.missed.map((word) => <span key={word.id}><b>{word.vietnamese}</b><em>{word.english}</em></span>)}</div>
    <div className="button-row">{hud.missed.length > 0 && <button className="button primary" onClick={onDrill}>Drill từ đã sai</button>}<button className="button ghost" onClick={onStop}>Về màn chuẩn bị</button></div>
    <small>{saveError ? <span className="danger-text">❌ Lỗi: {saveError}</span> : saved ? '✓ Lịch học và game run đã được lưu' : 'Đang lưu kết quả…'}</small>
  </section>
}

export function GamePage() {
  const { snapshot, recordGame } = useApp()
  const [searchParams] = useSearchParams()
  const [deckId, setDeckId] = useState(searchParams.get('deck') ?? snapshot.decks[0]?.id ?? 'all')
  const [source, setSource] = useState<GamePoolSource>(searchParams.get('source') === 'due' ? 'due' : 'all')
  const selectedIds = useMemo(() => searchParams.get('ids')?.split(',').filter(Boolean) ?? [], [searchParams])
  const [running, setRunning] = useState(false)
  const [hud, setHud] = useState<GameSnapshot | null>(null)
  const [answer, setAnswer] = useState('')
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [drillIndex, setDrillIndex] = useState<number | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [isError, setIsError] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const [speedMultiplier, setSpeedMultiplier] = useState(1)
  const speedRef = useRef(1)
  speedRef.current = speedMultiplier
  const recordGameRef = useRef(recordGame)
  recordGameRef.current = recordGame
  const pool = useMemo(() => buildGamePool(snapshot.vocabulary, snapshot.cards, deckId, new Date(), { source, selectedIds: source === 'due' ? selectedIds : undefined }), [deckId, selectedIds, snapshot.cards, snapshot.vocabulary, source])
  const inputMode: 'typing' | 'touch' = typeof window !== 'undefined' && (matchMedia('(pointer: coarse)').matches || window.innerWidth < 760) ? 'touch' : 'typing'

  useEffect(() => {
    if (!running || !canvasRef.current) return
    setSaved(false)
    setSaveError('')
    const engine = new GameEngine(canvasRef.current, pool, inputMode, {
      onUpdate: setHud,
      onGameOver: (finalState, outcomes) => {
        setHud(finalState)
        const total = finalState.correct + finalState.wrong
        // A completed deck can produce many outcomes. Let React commit and the
        // browser paint the result dialog before persistence work starts.
        requestAnimationFrame(() => requestAnimationFrame(() => {
          void recordGameRef.current({
            deckId, score: finalState.score, wave: finalState.wave,
            accuracy: total ? Math.round(finalState.correct / total * 100) : 100,
            durationSeconds: Math.round(finalState.time), inputMode,
          }, outcomes)
            .then(() => {
              setSaved(true)
              // Due-word games are launched from the review flow. A full reload
              // releases any stale Chromium canvas/compositor surface and returns
              // the learner to the now-updated due queue instead of leaving the
              // completed run mounted indefinitely.
              if (source === 'due' && finalState.endReason === 'completed') {
                window.setTimeout(() => window.location.replace('/review'), 1200)
              }
            })
            .catch((err) => {
              console.error('Failed to save game:', err)
              setSaveError(err instanceof Error ? err.message : 'Lỗi kết nối')
            })
        }))
      },
    })
    engineRef.current = engine
    engine.setSpeedMultiplier(speedRef.current)
    engine.start()
    const resize = () => engine.resize()
    const hotkeys = (event: KeyboardEvent) => {
      if (event.key === '1') engine.useSlow()
      if (event.key === '2') engine.useHint()
      if (event.key === 'Escape') {
        event.preventDefault()
        engine.togglePause()
      }
    }
    window.addEventListener('resize', resize); window.addEventListener('keydown', hotkeys)
    setTimeout(() => inputRef.current?.focus(), 0)
    return () => { engine.destroy(); engineRef.current = null; window.removeEventListener('resize', resize); window.removeEventListener('keydown', hotkeys) }
  }, [deckId, inputMode, running, source, selectedIds])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!answer.trim()) return
    const success = engineRef.current?.submitAnswer(answer)
    if (!success) {
      setIsError(true)
      setTimeout(() => setIsError(false), 400)
    }
    setAnswer('')
  }

  const stop = () => {
    if (hud && hud.phase !== 'over') {
      if (!confirm('Bạn có chắc chắn muốn THOÁT trận đấu? Toàn bộ kết quả và điểm số của trận đấu này sẽ BỊ HỦY và KHÔNG ĐƯỢC LƯU.')) {
        return
      }
    }
    setRunning(false)
    setHud(null)
    setDrillIndex(null)
  }
  const accuracy = hud ? (hud.correct + hud.wrong ? Math.round(hud.correct / (hud.correct + hud.wrong) * 100) : 100) : 100

  if (!running) return <div className="page game-landing">
    <PageHeader eyebrow="Typing tower defense" title={<>Vocab <span className="accent">Siege</span></>} description="Mỗi từ xuất hiện đúng 2 lần với tốc độ cố định. Trận đấu kết thúc khi bạn đi hết bộ từ." />
    <section className="game-hero panel"><div className="game-core-art"><span /><i /><b /></div><div><span className="eyebrow">Chuẩn bị phòng thủ</span><h2>Chọn nguồn từ để vào trận</h2><p>Mỗi từ xuất hiện đúng 2 lần. Từ đến hạn sẽ được cập nhật lịch ôn sau trận.</p><label>Bộ từ<select value={deckId} onChange={(event) => setDeckId(event.target.value)}><option value="all">Tất cả bộ từ</option>{snapshot.decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select></label><label>Nguồn từ<select value={source} onChange={(event) => setSource(event.target.value as GamePoolSource)}><option value="due">Từ đến hạn</option><option value="all">Toàn bộ active</option></select></label><div className="game-readiness"><span><b>{pool.length}</b><small>từ trong trận</small></span><span><b>{pool.filter((word) => word.isDue).length}</b><small>đến hạn</small></span><span><b>{inputMode === 'touch' ? 'Chạm quái' : 'Gõ chữ'}</b><small>chế độ tự động</small></span></div>{pool.length < 1 ? <div className="notice danger">Không có từ phù hợp với nguồn đã chọn.</div> : <button className="button primary large" onClick={() => setRunning(true)}>Bắt đầu siege →</button>}</div></section>  </div>

  if (hud?.phase === 'over') {
    const currentDrillIndex = drillIndex ?? 0
    const drillWord = drillIndex === null ? null : hud.missed[currentDrillIndex]
    return <div className="game-screen game-results-screen">
      {drillWord
        ? <section className="game-result-card drill-card"><span className="eyebrow">Remedial drill · {currentDrillIndex + 1}/{hud.missed.length}</span><div className="flashcard" onClick={() => setFlipped(true)}><small>{drillWord.category} · tier {drillWord.tier}</small><h2>{drillWord.vietnamese}</h2>{flipped ? <b>{drillWord.english}</b> : <em>Chạm để lật</em>}</div><button className="button primary" onClick={() => { if (!flipped) setFlipped(true); else if (currentDrillIndex < hud.missed.length - 1) { setDrillIndex(currentDrillIndex + 1); setFlipped(false) } else setDrillIndex(null) }}>{!flipped ? 'Hiện đáp án' : currentDrillIndex < hud.missed.length - 1 ? 'Từ tiếp theo →' : 'Hoàn thành'}</button></section>
        : <GameResultPanel hud={hud} accuracy={accuracy} saved={saved} saveError={saveError} onDrill={() => { setDrillIndex(0); setFlipped(false) }} onStop={stop} />}
    </div>
  }

  return <div className="game-screen">
    <canvas ref={canvasRef} className="game-canvas" onPointerDown={(event) => engineRef.current?.tap(event.clientX, event.clientY)} />
    {hud && <>
      <div className="game-hud left"><div><span>WAVE</span><b>{hud.wave}</b></div><div><span>SCORE</span><b>{hud.score.toLocaleString()}</b></div><div><span>XP</span><b>{hud.xp}</b></div><div className="hp-meter"><span>CORE {Math.ceil(hud.hp)}/{hud.maxHp}</span><i><b style={{ width: `${Math.max(0, hud.hp / hud.maxHp * 100)}%` }} /></i></div></div>
      <div className="game-hud right"><strong className={hud.multiplier > 1 ? 'active' : ''}>×{hud.multiplier}{hud.multiplier === 5 ? ' MAX' : ''}</strong><button className={hud.slow.owned && hud.slow.timer <= 0 ? 'ready' : ''} onClick={() => engineRef.current?.useSlow()}><span>Slow-Time</span><kbd>1</kbd>{hud.slow.timer > 0 && <small>{hud.slow.timer.toFixed(1)}s</small>}</button><button className={hud.hint.owned && hud.hint.timer <= 0 ? 'ready' : ''} onClick={() => engineRef.current?.useHint()}><span>Reveal</span><kbd>2</kbd>{hud.hint.timer > 0 && <small>{hud.hint.timer.toFixed(1)}s</small>}</button></div>
      {inputMode === 'touch' ? <div className="touch-target"><small>CHẠM QUÁI CÓ NGHĨA</small><b>{hud.targetEnglish || 'Chuẩn bị…'}</b></div> : <form className={`game-input ${isError ? 'shake-error' : ''}`} onSubmit={submit}><input ref={inputRef} value={answer} onChange={(event) => setAnswer(event.target.value)} autoComplete="off" spellCheck={false} placeholder="gõ bản dịch tiếng Anh rồi Enter" /></form>}
    </>}
    <div className="game-controls">
      <button className="game-pause" onClick={() => engineRef.current?.togglePause()}>{hud?.phase === 'paused' ? 'Tiếp tục' : 'Tạm dừng'}</button>
      <div className="game-speed-control">
        <span>⚡ Tốc độ: <strong>×{speedMultiplier}</strong></span>
        <input
          type="range"
          min="1"
          max="3"
          step="1"
          value={speedMultiplier}
          onChange={(event) => {
            const val = Number(event.target.value)
            setSpeedMultiplier(val)
            engineRef.current?.setSpeedMultiplier(val)
          }}
          title={`Tốc độ di chuyển của quái ×${speedMultiplier}`}
        />
      </div>
      <button className="game-exit" onClick={stop}>Thoát</button>
    </div>

    {hud?.phase === 'shop' && <div className="game-overlay"><section><span className="eyebrow">Wave {hud.wave} cleared · Armory</span><h2>Gia cố <em>core</em></h2><p>Bạn có <b>{hud.xp} XP</b>. Nâng cấp tồn tại đến hết run này.</p><div className="shop-grid">{(Object.keys(SHOP_META) as ShopKey[]).map((key) => { const meta = SHOP_META[key], cost = engineRef.current?.getShopCost(key) ?? 0; return <article className={meta.color} key={key}><h3>{meta.name}</h3><p>{meta.description}</p><small>Đã mua ×{hud.buys[key]}</small><button disabled={hud.xp < cost} onClick={() => engineRef.current?.buy(key)}>{cost} XP</button></article> })}</div><button className="button primary" onClick={() => { engineRef.current?.continueFromShop(); inputRef.current?.focus() }}>Tiếp tục siege →</button></section></div>}

    {hud?.phase === 'paused' && <div className="game-overlay"><section><span className="eyebrow">Vocab Siege · Tạm dừng</span><h2>Trận đấu <em className="accent">đang dừng</em></h2><p>Hệ thống phòng thủ và quái vật đã được đóng băng. Bạn có thể quay lại bất cứ lúc nào.</p><div className="button-row" style={{ marginTop: '24px' }}><button className="button primary" onClick={() => engineRef.current?.togglePause()}>Tiếp tục chơi</button><button className="button secondary" onClick={() => { if (confirm('Bạn có chắc muốn kết thúc trận đấu ngay bây giờ để lưu điểm số?')) engineRef.current?.endGame() }}>Kết thúc trận</button><button className="button ghost" onClick={stop}>Thoát trận</button></div></section></div>}

  </div>
}
