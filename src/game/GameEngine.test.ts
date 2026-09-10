import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameWord } from '../domain/types'
import { buildWordQueue, GameEngine } from './GameEngine'

const words: GameWord[] = ['alpha', 'beta', 'gamma'].map((english, index) => ({ id: String(index), english, vietnamese: `nghia-${index}`, acceptedAnswers: [], category: 'noun', tier: 1, isDue: false }))

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

