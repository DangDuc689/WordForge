import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameWord } from '../domain/types'
import { buildWordQueue, GameEngine } from './GameEngine'

const words: GameWord[] = ['alpha', 'beta', 'gamma'].map((english, index) => ({ id: String(index), english, vietnamese: `nghia-${index}`, acceptedAnswers: [], category: 'noun', tier: 1, isDue: false }))

describe('buildWordQueue', () => {
  it('schedules every vocabulary item exactly twice', () => {
    const queue = buildWordQueue(words, () => 0.5)
    expect(queue).toHaveLength(words.length * 2)
    for (const word of words) expect(queue.filter((queued) => queued.id === word.id)).toHaveLength(2)
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
