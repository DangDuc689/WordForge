import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import { GameEngine, type GameSnapshot, type ShopKey } from '../game/GameEngine'
import { buildGamePool } from '../game/sessionPool'
import type { GameSaveRequest, GamePoolSource } from '../domain/types'
import { useSearchParams, useBlocker } from 'react-router-dom'

const IconArrowRight = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px' }}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
)

const IconZap = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '4px' }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
)

const IconCheck = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '4px' }}><polyline points="20 6 9 17 4 12"/></svg>
)

const IconAlertCircle = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '4px' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
)

const IconSnowflake = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '4px' }}><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/></svg>
)

const IconEye = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '4px' }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
)

const IconPause = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '4px' }}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
)

const IconPlay = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '4px' }}><polygon points="5 3 19 12 5 21 5 3"/></svg>
)

const IconLogOut = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '4px' }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
)

const IconShield = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '4px' }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
)

const IconRefresh = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '4px' }}><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
)

const IconClock = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '4px' }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
)

const IconTarget = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '4px' }}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
)

const IconTrophy = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '4px' }}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>
)

const SHOP_META: Record<ShopKey, { name: string; description: string; color: string; icon: React.ReactNode }> = {
  hp: { name: 'Gia cố core', description: '+15 HP tối đa và hồi đầy core.', color: 'green', icon: <IconShield /> },
  regen: { name: 'Tự sửa chữa', description: '+0,8 HP hồi mỗi giây.', color: 'cyan', icon: <IconRefresh /> },
  slow: { name: 'Slow-Time', description: 'Đóng băng mọi quái trong 3 giây.', color: 'amber', icon: <IconSnowflake /> },
  hint: { name: 'Reveal', description: 'Lộ chữ cái đầu của một đáp án.', color: 'pink', icon: <IconEye /> },
}

const formatGameTime = (seconds: number) => Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0')

function GameResultPanel({
  hud,
  accuracy,
  saveStatus,
  saveError,
  onDrill,
  onStop,
  onRetrySave,
}: {
  hud: GameSnapshot
  accuracy: number
  saveStatus: 'idle' | 'saving' | 'saved' | 'failed'
  saveError: string
  onDrill: () => void
  onStop: () => void
  onRetrySave: () => void
}) {
  const isSaving = saveStatus === 'saving'
  return <section className="game-result-card" role="dialog" aria-modal="true" aria-labelledby="game-result-title">
    <span className={'eyebrow ' + (hud.endReason === 'breached' ? 'danger-text' : '')}>{hud.endReason === 'completed' ? 'Đã ôn hết bộ từ' : hud.endReason === 'ended' ? 'Trận đấu kết thúc sớm' : 'Core breached'}</span>
    <h2 id="game-result-title">{hud.endReason === 'completed' ? <>Hoàn thành <em>bộ từ</em></> : hud.endReason === 'ended' ? <>Tổng kết <em className="accent">kết quả</em></> : <>Siege <em className="danger-text">over</em></>}</h2>
    <div className="end-stats">
      <span><IconClock /><b>{formatGameTime(hud.time)}</b><small>Thời gian</small></span>
      <span><IconCheck /><b>{hud.kills}</b><small>Trả lời đúng</small></span>
      <span><IconTarget /><b>{accuracy}%</b><small>Accuracy</small></span>
      <span><IconTrophy /><b>{hud.wave}</b><small>Wave</small></span>
    </div>
    <h3>Từ đã lọt qua <small>{hud.missed.length}</small></h3>
    <div className="missed-words">{hud.missed.map((word) => <span key={word.id}><b>{word.vietnamese}</b><em>{word.english}</em></span>)}</div>
    <div className="button-row">{hud.missed.length > 0 && <button className="button primary" onClick={onDrill} disabled={isSaving}><span>Drill từ đã sai</span> <IconArrowRight /></button>}<button className="button ghost" onClick={onStop} disabled={isSaving}>Về màn chuẩn bị</button></div>
    {saveStatus === 'failed' && <div className="button-row" style={{ marginTop: '12px' }}><button className="button secondary" onClick={onRetrySave}>Thử lưu lại</button></div>}
    <small>{saveStatus === 'failed' ? <span className="danger-text"><IconAlertCircle /> Lỗi: {saveError} (Không cần chơi lại)</span> : saveStatus === 'saved' ? <><IconCheck /> Lịch học và game run đã được lưu</> : 'Đang lưu kết quả…'}</small>
  </section>
}

export function GamePage() {
  const { snapshot, recordGame } = useApp()
  const [searchParams] = useSearchParams()
  const [deckId, setDeckId] = useState(searchParams.get('deck') ?? snapshot.decks[0]?.id ?? 'all')
  const [source, setSource] = useState<GamePoolSource>(searchParams.get('source') === 'due' ? 'due' : searchParams.get('source') === 'learned' ? 'learned' : 'all')
  const selectedIds = useMemo(() => searchParams.get('ids')?.split(',').filter(Boolean) ?? [], [searchParams])
  const [running, setRunning] = useState(false)
  const [hud, setHud] = useState<GameSnapshot | null>(null)
  const [answer, setAnswer] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [saveError, setSaveError] = useState('')
  const [saveRequest, setSaveRequest] = useState<GameSaveRequest | null>(null)
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
  const pool = useMemo(() => buildGamePool(snapshot.vocabulary, snapshot.cards, deckId, new Date(), { source, selectedIds: source === 'due' ? selectedIds : undefined, limit: source === 'due' && selectedIds.length > 0 ? selectedIds.length : undefined }), [deckId, selectedIds, snapshot.cards, snapshot.vocabulary, source])
  const inputMode: 'typing' | 'touch' = typeof window !== 'undefined' && (matchMedia('(pointer: coarse)').matches || window.innerWidth < 760) ? 'touch' : 'typing'
  const redirectTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => { if (redirectTimerRef.current) window.clearTimeout(redirectTimerRef.current) }
  }, [])

  useEffect(() => {
    if (!running || !canvasRef.current) return
    setSaveStatus('idle')
    setSaveError('')
    const engine = new GameEngine(canvasRef.current, pool, inputMode, {
      onUpdate: setHud,
      onGameOver: (finalState, outcomes) => {
        setHud(finalState)
        const total = finalState.correct + finalState.wrong
        const req: GameSaveRequest = {
          runId: crypto.randomUUID(),
          deckId: deckId === 'all' ? null : deckId,
          source,
          score: finalState.score, wave: finalState.wave,
          accuracy: total ? Math.round(finalState.correct / total * 100) : 100,
          durationSeconds: Math.round(finalState.time), inputMode,
          createdAt: new Date().toISOString(),
          outcomes,
          reviewEventIds: Object.fromEntries(outcomes.map(o => [o.vocabularyId, crypto.randomUUID()]))
        }
        setSaveRequest(req)
        setSaveStatus('saving')

        requestAnimationFrame(() => requestAnimationFrame(() => {
          void recordGameRef.current(req)
            .then(() => {
              setSaveStatus('saved')
              if (source === 'due' && finalState.endReason === 'completed') {
                redirectTimerRef.current = window.setTimeout(() => window.location.replace('/review'), 1200)
              }
            })
            .catch((err: any) => {
              console.error('Failed to save game:', err)
              setSaveStatus('failed')
              setSaveError(err?.message || (typeof err === 'string' ? err : 'Lỗi kết nối'))
            })
        }))
      },
    })
    engineRef.current = engine
    engine.setSpeedMultiplier(speedRef.current)
    engine.start()
    const resize = () => engine.resize()
    const hotkeys = (event: KeyboardEvent) => {
      const activeEl = document.activeElement
      const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')

      if ((event.altKey && event.key === '1') || (!isTyping && event.key === '1')) {
        event.preventDefault()
        engine.useSlow()
      }
      if ((event.altKey && event.key === '2') || (!isTyping && event.key === '2')) {
        event.preventDefault()
        engine.useHint()
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        engine.togglePause()
      }
    }
    window.addEventListener('resize', resize); window.addEventListener('keydown', hotkeys)
    setTimeout(() => inputRef.current?.focus(), 0)
    return () => { engine.destroy(); engineRef.current = null; window.removeEventListener('resize', resize); window.removeEventListener('keydown', hotkeys) }
  }, [deckId, inputMode, running, source, selectedIds])

  useBlocker(() => {
    if (hud?.phase === 'over' && saveStatus !== 'saved') {
      if (saveStatus === 'saving') return true
      return !window.confirm('Dữ liệu chưa được lưu. Nếu rời đi bạn sẽ không thể thử lưu lại và kết quả sẽ bị hủy. Bạn có chắc chắn muốn thoát?')
    }
    return false
  })

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hud?.phase === 'over' && saveStatus !== 'saved') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hud?.phase, saveStatus])

  const handleRetrySave = () => {
    if (!saveRequest) return
    setSaveError('')
    setSaveStatus('saving')
    recordGameRef.current(saveRequest)
      .then(() => {
        setSaveStatus('saved')
        if (source === 'due' && hud?.endReason === 'completed') {
          redirectTimerRef.current = window.setTimeout(() => window.location.replace('/review'), 1200)
        }
      })
      .catch((err: any) => {
        console.error('Failed to save game:', err)
        setSaveStatus('failed')
        setSaveError(err?.message || (typeof err === 'string' ? err : 'Lỗi kết nối'))
      })
  }

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
    if (hud && hud.phase === 'over' && saveStatus === 'failed') {
      if (!window.confirm('Dữ liệu chưa được lưu. Nếu rời đi bạn sẽ không thể thử lưu lại và kết quả sẽ bị hủy. Bạn có chắc chắn muốn thoát?')) {
        return
      }
    } else if (hud && hud.phase !== 'over') {
      if (!window.confirm('Bạn có chắc chắn muốn THOÁT trận đấu? Toàn bộ kết quả và điểm số của trận đấu này sẽ BỊ HỦY và KHÔNG ĐƯỢC LƯU.')) {
        return
      }
    }
    if (redirectTimerRef.current) window.clearTimeout(redirectTimerRef.current)
    setRunning(false)
    setHud(null)
    setDrillIndex(null)
  }
  const accuracy = hud ? (hud.correct + hud.wrong ? Math.round(hud.correct / (hud.correct + hud.wrong) * 100) : 100) : 100

  if (!running) return <div className="page game-landing">
    <PageHeader eyebrow="Typing tower defense" title={<>Vocab <span className="accent">Siege</span></>} description="Mỗi từ xuất hiện đúng 2 lần với tốc độ cố định. Trận đấu kết thúc khi bạn đi hết bộ từ." />
    <section className="game-hero panel"><div className="game-core-art"><span /><i /><b /></div><div><span className="eyebrow">Chuẩn bị phòng thủ</span><h2>Chọn nguồn từ để vào trận</h2><p>Mỗi từ xuất hiện đúng 2 lần. Từ đến hạn sẽ được cập nhật lịch ôn sau trận.</p><label>Bộ từ<select value={deckId} onChange={(event) => setDeckId(event.target.value)}><option value="all">Tất cả bộ từ</option>{snapshot.decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select></label><label>Nguồn từ<select value={source} onChange={(event) => setSource(event.target.value as GamePoolSource)}><option value="due">Từ đến hạn (ôn)</option><option value="learned">Từ đã học</option><option value="all">Toàn bộ active</option></select></label><div className="game-readiness"><span><b>{pool.length}</b><small>từ trong trận</small></span><span><b>{pool.filter((word) => word.isDue).length}</b><small>đến hạn</small></span><span><b>{inputMode === 'touch' ? 'Chạm quái' : 'Gõ chữ'}</b><small>chế độ tự động</small></span></div>{pool.length < 1 ? <div className="notice danger">Không có từ phù hợp với nguồn đã chọn.</div> : <button className="button primary large" onClick={() => setRunning(true)}><span>Bắt đầu siege</span> <IconArrowRight /></button>}</div></section>  </div>

  if (hud?.phase === 'over') {
    const currentDrillIndex = drillIndex ?? 0
    const drillWord = drillIndex === null ? null : hud.missed[currentDrillIndex]
    return <div className="game-screen game-results-screen">
      {drillWord
        ? <section className="game-result-card drill-card"><span className="eyebrow">Remedial drill · {currentDrillIndex + 1}/{hud.missed.length}</span><div className="flashcard" onClick={() => setFlipped(true)}><small>{drillWord.category} · tier {drillWord.tier}</small><h2>{drillWord.vietnamese}</h2>{flipped ? <b>{drillWord.english}</b> : <em>Chạm để lật</em>}</div><button className="button primary" onClick={() => { if (!flipped) setFlipped(true); else if (currentDrillIndex < hud.missed.length - 1) { setDrillIndex(currentDrillIndex + 1); setFlipped(false) } else setDrillIndex(null) }}>{!flipped ? 'Hiện đáp án' : currentDrillIndex < hud.missed.length - 1 ? <><span>Từ tiếp theo</span> <IconArrowRight /></> : 'Hoàn thành'}</button></section>
        : <GameResultPanel hud={hud} accuracy={accuracy} saveStatus={saveStatus} saveError={saveError} onDrill={() => { setDrillIndex(0); setFlipped(false) }} onStop={stop} onRetrySave={handleRetrySave} />}
    </div>
  }

  return <div className="game-screen">
    <canvas ref={canvasRef} className="game-canvas" onPointerDown={(event) => engineRef.current?.tap(event.clientX, event.clientY)} />
    {hud && <>
      <div className="game-hud left"><div><span>WAVE</span><b>{hud.wave}</b></div><div><span>SCORE</span><b>{hud.score.toLocaleString()}</b></div><div><span>XP</span><b>{hud.xp}</b></div><div className="hp-meter"><span>CORE {Math.ceil(hud.hp)}/{hud.maxHp}</span><i><b style={{ width: `${Math.max(0, hud.hp / hud.maxHp * 100)}%` }} /></i></div></div>
      <div className="game-hud right"><strong className={hud.multiplier > 1 ? 'active' : ''}>×{hud.multiplier}{hud.multiplier === 5 ? ' MAX' : ''}</strong></div>
      {inputMode === 'touch' ? <div className="touch-target"><small>CHẠM QUÁI CÓ NGHĨA</small><b>{hud.targetEnglish || 'Chuẩn bị…'}</b></div> : <form className={`game-input ${isError ? 'shake-error' : ''}`} onSubmit={submit}><input ref={inputRef} value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(e) } }} autoComplete="off" spellCheck={false} placeholder="gõ bản dịch tiếng Anh rồi Enter" /><button type="submit" style={{ display: 'none' }} /></form>}
    </>}
    <div className="game-controls">
      <button className="game-pause" onClick={() => engineRef.current?.togglePause()}>
        {hud?.phase === 'paused' ? <><IconPlay />Tiếp tục</> : <><IconPause />Tạm dừng</>}
      </button>
      <div className="game-speed-control">
        <span><IconZap />Tốc độ: <strong>×{speedMultiplier}</strong></span>
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
      <button className="game-exit" onClick={stop}><IconLogOut />Thoát</button>
    </div>

    {hud?.phase === 'shop' && <div className="game-overlay"><section><span className="eyebrow">Wave {hud.wave} cleared · Armory</span><h2>Gia cố <em>core</em></h2><p>Bạn có <b>{hud.xp} XP</b>. Nâng cấp tồn tại đến hết run này.</p><div className="shop-grid">{(Object.keys(SHOP_META) as ShopKey[]).map((key) => { const meta = SHOP_META[key], cost = engineRef.current?.getShopCost(key) ?? 0; return <article className={meta.color} key={key}><h3>{meta.icon} {meta.name}</h3><p>{meta.description}</p><small>Đã mua ×{hud.buys[key]}</small><button disabled={hud.xp < cost} onClick={() => engineRef.current?.buy(key)}>{cost} XP</button></article> })}</div><button className="button primary" onClick={() => { engineRef.current?.continueFromShop(); inputRef.current?.focus() }}><span>Tiếp tục siege</span> <IconArrowRight /></button></section></div>}

    {hud?.phase === 'paused' && <div className="game-overlay"><section><span className="eyebrow">Vocab Siege · Tạm dừng</span><h2>Trận đấu <em className="accent">đang dừng</em></h2><p>Hệ thống phòng thủ và quái vật đã được đóng băng. Bạn có thể quay lại bất cứ lúc nào.</p><div className="button-row" style={{ marginTop: '24px' }}><button className="button primary" onClick={() => engineRef.current?.togglePause()}>Tiếp tục chơi</button><button className="button secondary" onClick={() => { if (confirm('Bạn có chắc muốn kết thúc trận đấu ngay bây giờ để lưu điểm số?')) engineRef.current?.endGame() }}>Kết thúc trận</button><button className="button ghost" onClick={stop}>Thoát trận</button></div></section></div>}

  </div>
}
