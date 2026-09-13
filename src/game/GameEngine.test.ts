import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameWord } from '../domain/types'
import { buildWordQueue, GameEngine } from './GameEngine'

const words: GameWord[] = ['alpha', 'beta', 'gamma'].map((english, index) => ({ id: String(index), english, vietnamese: `nghia-${index}`, acceptedAnswers: [], category: 'noun', tier: 1, isDue: false, memoryLevel: 3 }))

describe('buildWordQueue', () => {
  it('schedules every vocabulary item exactly twice by default', () => {
    const queue = buildWordQueue(words, () => 0.5)
    expect(queue).toHaveLength(words.length * 2)
    for (const word of words) expect(queue.filter((queued) => queued.id === word.id)).toHaveLength(2)
  })

  it('schedules every vocabulary item exactly once when repetitions is 1', () => {
    const queue = buildWordQueue(words, () => 0.5, 1)
    expect(queue).toHaveLength(words.length)
    for (const word of words) expect(queue.filter((queued) => queued.id === word.id)).toHaveLength(1)
  })
})

describe('GameEngine completion', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('emits one completed result and stops scheduling canvas frames', () => {
    const onUpdate = vi.fn()
    const onGameOver = vi.fn()
    const canvas = {
      getContext: () => ({}),
      width: 800,
      height: 600,
    } as unknown as HTMLCanvasElement
    const engine = new GameEngine(canvas, [], 'typing', { onUpdate, onGameOver })
    const internals = engine as unknown as {
      updateWave: (dt: number) => void
      loop: (now: number) => void
      render: () => void
    }

    internals.updateWave(2)
    internals.updateWave(2)

    expect(engine.getSnapshot()).toMatchObject({ phase: 'over', endReason: 'completed' })
    expect(onGameOver).toHaveBeenCalledTimes(1)
    expect(canvas).toMatchObject({ width: 1, height: 1 })

    const requestFrame = vi.fn()
    vi.stubGlobal('requestAnimationFrame', requestFrame)
    internals.render = vi.fn()
    internals.loop(performance.now() + 200)

    expect(requestFrame).not.toHaveBeenCalled()
  })
})

describe('GameEngine two-phase mechanics', () => {
  it('requires Vietnamese for phase 1 and English for phase 2', () => {
    const onUpdate = vi.fn()
    const onGameOver = vi.fn()
    const canvas = {
      getContext: () => ({}),
      width: 800,
      height: 600,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    } as unknown as HTMLCanvasElement

    const sampleWord: GameWord = {
      id: 'test-1',
      english: 'abandon',
      vietnamese: 'từ bỏ',
      acceptedAnswers: ['rời bỏ'],
      category: 'verb',
      tier: 1,
      isDue: false,
      memoryLevel: 3,
    }

    const engine = new GameEngine(canvas, [sampleWord], 'typing', { onUpdate, onGameOver }, 1)
    const internals = engine as unknown as {
      spawn: () => void
      monsters: Array<{ killPhase: 1 | 2; killed: boolean }>
    }

    internals.spawn()
    const monster = internals.monsters[0]
    expect(monster).toBeDefined()
    expect(monster.killPhase).toBe(1)

    // Gõ tiếng Anh ở Phase 1 phải thất bại
    const englishInPhase1 = engine.submitAnswer('abandon')
    expect(englishInPhase1).toBe(false)
    expect(monster.killPhase).toBe(1)

    // Gõ tiếng Việt (hỗ trợ cả không dấu) ở Phase 1 phải chuyển sang Phase 2
    const vnInPhase1 = engine.submitAnswer('tu bo')
    expect(vnInPhase1).toBe(true)
    expect(monster.killPhase).toBe(2)

    // Gõ lại tiếng Việt ở Phase 2 phải thất bại
    const vnInPhase2 = engine.submitAnswer('từ bỏ')
    expect(vnInPhase2).toBe(false)

    // Gõ tiếng Anh ở Phase 2 phải thành công và tiêu diệt quái
    const englishInPhase2 = engine.submitAnswer('abandon')
    expect(englishInPhase2).toBe(true)
    expect(monster.killed).toBe(true)
  })
})

describe('GameEngine breached tracking', () => {
  it('increments breached count and reduces remaining words when monster breaches', () => {
    const onUpdate = vi.fn()
    const onGameOver = vi.fn()
    const canvas = {
      getContext: () => ({}),
      width: 800,
      height: 600,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    } as unknown as HTMLCanvasElement

    const sampleWord: GameWord = {
      id: 'test-breach-1',
      english: 'abandon',
      vietnamese: 'từ bỏ',
      acceptedAnswers: [],
      category: 'verb',
      tier: 1,
      isDue: false,
      memoryLevel: 3,
    }

    const engine = new GameEngine(canvas, [sampleWord], 'typing', { onUpdate, onGameOver }, 1)
    const internals = engine as unknown as {
      spawn: () => void
      monsters: Array<{ id: string; word: GameWord; dying: number; killed: boolean }>
      breach: (monster: any) => void
    }

    internals.spawn()
    expect(engine.getSnapshot().breached).toBe(0)
    expect(engine.getSnapshot().totalWords).toBe(1)
    expect(engine.getSnapshot().kills).toBe(0)

    const monster = internals.monsters[0]
    internals.breach(monster)

    const snapshot = engine.getSnapshot()
    expect(snapshot.breached).toBe(1)
    expect(snapshot.kills).toBe(0)
    expect(snapshot.missed).toHaveLength(1)
    const remaining = Math.max(0, snapshot.totalWords - snapshot.kills - snapshot.breached)
    expect(remaining).toBe(0)
  })
})

describe('GameEngine adaptive speed', () => {
  const createEngine = (memoryLevel: number, adaptiveSpeed = true) => {
    const canvas = {
      getContext: () => ({}),
      width: 800,
      height: 600,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    } as unknown as HTMLCanvasElement

    const word: GameWord = {
      id: `w-${memoryLevel}`,
      english: 'test',
      vietnamese: 'kiểm tra',
      acceptedAnswers: [],
      category: 'noun',
      tier: 1,
      isDue: false,
      memoryLevel,
    }

    const engine = new GameEngine(canvas, [word], 'typing', { onUpdate: vi.fn(), onGameOver: vi.fn() }, 1, adaptiveSpeed)
    const internals = engine as unknown as {
      spawn: () => void
      monsters: Array<{ speed: number; word: GameWord }>
      estimateLabelWidth: (word: GameWord, inputMode: 'typing' | 'touch', killPhase: 1 | 2) => number
    }
    return { engine, internals, word }
  }

  it('reduces speed by 30% for memory level 1 (factor 0.7)', () => {
    const { internals } = createEngine(1, true)
    internals.spawn()
    expect(internals.monsters[0].speed).toBeCloseTo(22 * 0.7)
  })

  it('reduces speed by 10% for memory level 2 (factor 0.9)', () => {
    const { internals } = createEngine(2, true)
    internals.spawn()
    expect(internals.monsters[0].speed).toBeCloseTo(22 * 0.9)
  })

  it('keeps normal speed for memory level 3 (factor 1.0)', () => {
    const { internals } = createEngine(3, true)
    internals.spawn()
    expect(internals.monsters[0].speed).toBeCloseTo(22)
  })

  it('keeps normal speed for all levels when adaptiveSpeed is disabled', () => {
    const { internals } = createEngine(1, false)
    internals.spawn()
    expect(internals.monsters[0].speed).toBeCloseTo(22)
  })

  it('accounts for badge in estimateLabelWidth when adaptiveSpeed is active for levels 1 and 2', () => {
    const { internals: adaptiveInternals, word: wordL1 } = createEngine(1, true)
    const { internals: standardInternals } = createEngine(1, false)

    const widthAdaptive = adaptiveInternals.estimateLabelWidth(wordL1, 'typing', 1)
    const widthStandard = standardInternals.estimateLabelWidth(wordL1, 'typing', 1)

    expect(widthAdaptive).toBe(widthStandard + 22)
  })
})

