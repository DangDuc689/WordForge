import type { GameOutcome, GameWord } from '../domain/types'
import { isAcceptedAnswer, normalizeVietnamese } from '../lib/normalize'

export interface GameSnapshot {
  phase: 'playing' | 'paused' | 'shop' | 'over'
  endReason: 'completed' | 'breached' | 'ended' | null
  time: number
  wave: number
  score: number
  xp: number
  hp: number
  maxHp: number
  combo: number
  multiplier: number
  correct: number
  wrong: number
  kills: number
  targetEnglish: string
  slow: { owned: boolean; timer: number; cd: number; active: number }
  hint: { owned: boolean; timer: number; cd: number }
  buys: Record<ShopKey, number>
  missed: GameWord[]
}

export type ShopKey = 'hp' | 'regen' | 'slow' | 'hint'

interface Monster {
  id: string
  word: GameWord
  x: number
  y: number
  radius: number
  speed: number
  spawnAt: number
  hintUntil: number
  dying: number
  killed: boolean
  seed: number
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }

interface Callbacks {
  onUpdate: (snapshot: GameSnapshot) => void
  onGameOver: (snapshot: GameSnapshot, outcomes: GameOutcome[]) => void
}

const COLORS = { 1: '#4fd6a0', 2: '#f5c451', 3: '#f5628f' }
const POINTS = { 1: 10, 2: 20, 3: 35 }
const DAMAGE = { 1: 8, 2: 12, 3: 18 }
const WORDS_PER_WAVE = 6
const SPAWN_INTERVAL = 1.75
const MONSTER_SPEED = 34

export function buildWordQueue(words: GameWord[], random = Math.random) {
  const shuffle = (items: GameWord[]) => {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1))
      ;[items[index], items[swapIndex]] = [items[swapIndex], items[index]]
    }
    return items
  }
  return [...shuffle([...words]), ...shuffle([...words])]
}
const SHOP_COST: Record<ShopKey, (count: number) => number> = {
  hp: (count) => 40 + count * 30,
  regen: (count) => 55 + count * 40,
  slow: (count) => 80 + count * 45,
  hint: (count) => 50 + count * 35,
}

export class GameEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private wordQueue: GameWord[]
  private inputMode: 'typing' | 'touch'
  private callbacks: Callbacks
  private state: GameSnapshot
  private monsters: Monster[] = []
  private particles: Particle[] = []
  private outcomes: GameOutcome[] = []
  private targetMistakes = new Set<string>()
  private waveTotal = 0
  private spawned = 0
  private spawnTimer = 0
  private shakeTimer = 0
  private spawnInterval = SPAWN_INTERVAL
  private interWaveDelay = 0
  private regen = 0
  private speedMultiplier = 1
  private lastKillAt = -999
  private frame = 0
  private lastFrame = performance.now()
  private lastUiUpdate = 0
  private width = 0
  private height = 0
  private centerX = 0
  private centerY = 0
  private dpr = 1
  private audioContext: AudioContext | null = null

  constructor(canvas: HTMLCanvasElement, words: GameWord[], inputMode: 'typing' | 'touch', callbacks: Callbacks) {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D không khả dụng')
    this.canvas = canvas
    this.ctx = context
    this.wordQueue = buildWordQueue(words)
    this.inputMode = inputMode
    this.callbacks = callbacks
    this.state = {
      phase: 'playing', endReason: null, time: 0, wave: 1, score: 0, xp: 0, hp: 100, maxHp: 100,
      combo: 0, multiplier: 1, correct: 0, wrong: 0, kills: 0, targetEnglish: '',
      slow: { owned: false, timer: 0, cd: 15, active: 0 },
      hint: { owned: false, timer: 0, cd: 10 },
      buys: { hp: 0, regen: 0, slow: 0, hint: 0 }, missed: [],
    }
  }

  start() {
    this.resize()
    this.startWave(1)
    this.lastFrame = performance.now()
    this.frame = requestAnimationFrame(this.loop)
    this.emit(true)
  }

  destroy() { cancelAnimationFrame(this.frame); void this.audioContext?.close() }
  resize() {
    const rect = this.canvas.getBoundingClientRect()
    this.dpr = Math.min(2, window.devicePixelRatio || 1)
    this.width = Math.max(320, rect.width); this.height = Math.max(360, rect.height)
    this.centerX = this.width / 2; this.centerY = this.height / 2
    this.canvas.width = this.width * this.dpr; this.canvas.height = this.height * this.dpr
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  getSnapshot() { return structuredClone(this.state) }
  getShopCost(key: ShopKey) { return SHOP_COST[key](this.state.buys[key]) }

  submitAnswer(value: string): boolean {
    if (this.state.phase !== 'playing' || !value.trim()) return false
    const matches = this.monsters.filter((monster) => !monster.dying && isAcceptedAnswer(value, monster.word.english, monster.word.acceptedAnswers))
    if (!matches.length) { this.registerWrong(); return false }
    matches.sort((a, b) => this.distance(a) - this.distance(b))
    this.kill(matches[0], false)
    return true
  }

  tap(clientX: number, clientY: number): boolean {
    if (this.state.phase !== 'playing' || this.inputMode !== 'touch') return false
    const rect = this.canvas.getBoundingClientRect()
    const x = clientX - rect.left, y = clientY - rect.top
    const tapped = [...this.monsters].reverse().find((monster) => !monster.dying && Math.hypot(x - monster.x, y - monster.y) <= monster.radius + 18)
    const target = this.getTarget()
    if (!tapped || !target) return false
    if (tapped.word.id === target.word.id) { this.kill(target, false); return true }
    this.targetMistakes.add(target.word.id)
    this.registerWrong()
    return false
  }

  useSlow() {
    const skill = this.state.slow
    if (this.state.phase !== 'playing' || !skill.owned || skill.timer > 0) return
    skill.active = 3; skill.timer = skill.cd; this.beep(520, .12, 'sine'); this.emit(true)
  }

  useHint() {
    const skill = this.state.hint
    if (this.state.phase !== 'playing' || !skill.owned || skill.timer > 0) return
    const target = this.inputMode === 'touch' ? this.getTarget() : this.liveMonsters()[Math.floor(Math.random() * this.liveMonsters().length)]
    if (!target) return
    target.hintUntil = this.state.time + 4
    skill.timer = skill.cd; this.beep(680, .12, 'sine'); this.emit(true)
  }

  buy(key: ShopKey): boolean {
    if (this.state.phase !== 'shop') return false
    const cost = this.getShopCost(key)
    if (this.state.xp < cost) return false
    this.state.xp -= cost
    if (key === 'hp') { this.state.maxHp += 15; this.state.hp = this.state.maxHp }
    if (key === 'regen') this.regen += .8
    if (key === 'slow') { this.state.slow.owned = true; if (this.state.buys.slow > 0) this.state.slow.cd = Math.max(6, this.state.slow.cd - 3) }
    if (key === 'hint') { this.state.hint.owned = true; if (this.state.buys.hint > 0) this.state.hint.cd = Math.max(4, this.state.hint.cd - 2) }
    this.state.buys[key] += 1; this.beep(780, .1, 'triangle'); this.emit(true); return true
  }

  continueFromShop() {
    if (this.state.phase !== 'shop') return
    this.state.phase = 'playing'; this.startWave(this.state.wave + 1); this.emit(true)
  }

  togglePause() {
    if (this.state.phase === 'playing') {
      this.state.phase = 'paused'
      this.beep(400, 0.15, 'triangle')
      this.emit(true)
    } else if (this.state.phase === 'paused') {
      this.state.phase = 'playing'
      this.lastFrame = performance.now()
      this.beep(600, 0.1, 'triangle')
      this.emit(true)
    }
  }

  endGame() {
    this.finishGame('ended')
  }

  setSpeedMultiplier(multiplier: number) {
    this.speedMultiplier = Math.max(1, Math.min(3, multiplier))
  }

  private loop = (now: number) => {
    const dt = Math.min(.05, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    this.update(dt)
    this.render()
    if (now - this.lastUiUpdate > 100) { this.emit(); this.lastUiUpdate = now }
    this.frame = requestAnimationFrame(this.loop)
  }

  private update(dt: number) {
    if (this.state.phase === 'paused') return
    if (this.state.phase !== 'playing') return
    this.state.time += dt
    this.shakeTimer = Math.max(0, this.shakeTimer - dt)
    this.state.slow.timer = Math.max(0, this.state.slow.timer - dt)
    this.state.slow.active = Math.max(0, this.state.slow.active - dt)
    this.state.hint.timer = Math.max(0, this.state.hint.timer - dt)
    this.state.hp = Math.min(this.state.maxHp, this.state.hp + this.regen * dt)
    this.updateWave(dt)
    for (const monster of this.monsters) {
      if (monster.killed) { monster.dying -= dt; continue }
      if (this.state.slow.active <= 0) {
        const dx = this.centerX - monster.x, dy = this.centerY - monster.y, distance = Math.hypot(dx, dy) || 1
        const effectiveSpeed = monster.speed * this.speedMultiplier
        const vx = dx / distance * effectiveSpeed
        const vy = dy / distance * effectiveSpeed
        
        const wobbleSpeed = 3.5 + monster.seed
        const wobbleAmp = 15 + monster.word.tier * 4
        const wobble = Math.sin(this.state.time * wobbleSpeed + monster.seed * 5) * wobbleAmp
        
        const px = -dy / distance
        const py = dx / distance
        
        monster.x += (vx + px * wobble) * dt
        monster.y += (vy + py * wobble) * dt
      }
      if (this.distance(monster) < 42 + monster.radius) this.breach(monster)
    }
    this.monsters = this.monsters.filter((monster) => monster.dying !== -1 && !(monster.killed && monster.dying <= 0))
    for (const particle of this.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vx *= .95; particle.vy *= .95; particle.life -= dt }
    this.particles = this.particles.filter((particle) => particle.life > 0)
    this.updateTarget()
  }

  private startWave(wave: number) {
    this.state.wave = wave; this.waveTotal = Math.min(WORDS_PER_WAVE, this.wordQueue.length); this.spawned = 0
    this.spawnInterval = SPAWN_INTERVAL; this.spawnTimer = .25; this.interWaveDelay = 1.2
  }

  private updateWave(dt: number) {
    if (this.spawned < this.waveTotal) {
      this.spawnTimer -= dt
      if (this.spawnTimer <= 0) { this.spawn(); this.spawned += 1; this.spawnTimer = this.spawnInterval }
    } else if (this.liveMonsters().length === 0) {
      this.interWaveDelay -= dt
      if (this.interWaveDelay <= 0) {
        if (this.wordQueue.length === 0) this.finishGame('completed')
        else if (this.state.wave % 5 === 0) { this.state.phase = 'shop'; this.emit(true) }
        else this.startWave(this.state.wave + 1)
      }
    }
  }

  private takeNextWord(): GameWord | undefined {
    if (this.inputMode !== 'touch') return this.wordQueue.shift()
    const liveMeanings = new Set(this.liveMonsters().map((monster) => normalizeVietnamese(monster.word.vietnamese)))
    const distinctIndex = this.wordQueue.findIndex((word) => !liveMeanings.has(normalizeVietnamese(word.vietnamese)))
    const index = distinctIndex >= 0 ? distinctIndex : 0
    return this.wordQueue.splice(index, 1)[0]
  }

  private spawn() {
    const word = this.takeNextWord()
    if (!word) return
    const margin = 45, edge = Math.floor(Math.random() * 4)
    let x = 0, y = 0
    if (edge === 0) { x = Math.random() * this.width; y = -margin }
    else if (edge === 1) { x = this.width + margin; y = Math.random() * this.height }
    else if (edge === 2) { x = Math.random() * this.width; y = this.height + margin }
    else { x = -margin; y = Math.random() * this.height }
    this.monsters.push({ id: crypto.randomUUID(), word, x, y, radius: word.category === 'phrase' ? 30 : 24, speed: MONSTER_SPEED, spawnAt: this.state.time, hintUntil: 0, dying: 0, killed: false, seed: Math.random() * Math.PI * 2 })
  }

  private kill(monster: Monster, usedHint: boolean) {
    if (monster.dying || monster.killed) return
    monster.dying = .28; monster.killed = true
    const responseMs = Math.max(200, (this.state.time - monster.spawnAt) * 1000)
    const wasHinted = usedHint || monster.hintUntil > this.state.time
    this.outcomes.push({ vocabularyId: monster.word.id, terminal: 'killed', responseMs, usedHint: wasHinted, hadTargetMistake: this.targetMistakes.has(monster.word.id) })
    if (this.state.time - this.lastKillAt > 4) this.state.combo = 0
    this.state.combo += 1; this.lastKillAt = this.state.time; this.state.multiplier = Math.min(5, 1 + Math.floor(this.state.combo / 2))
    const points = POINTS[monster.word.tier] * this.state.multiplier
    this.state.score += points; this.state.xp += Math.round(points * .6); this.state.correct += 1; this.state.kills += 1
    this.burst(monster.x, monster.y, COLORS[monster.word.tier], 12 + monster.word.tier * 4)
    this.beep(260 + this.state.multiplier * 80, .08, 'square'); this.emit(true)
  }

  private breach(monster: Monster) {
    if (monster.dying || monster.killed) return
    monster.dying = -1
    this.shakeTimer = 0.45
    this.state.hp = Math.max(0, this.state.hp - DAMAGE[monster.word.tier]); this.state.combo = 0; this.state.multiplier = 1
    this.outcomes.push({ vocabularyId: monster.word.id, terminal: 'breached', responseMs: Math.max(200, (this.state.time - monster.spawnAt) * 1000), usedHint: monster.hintUntil > this.state.time, hadTargetMistake: this.targetMistakes.has(monster.word.id) })
    if (!this.state.missed.some((word) => word.id === monster.word.id)) this.state.missed.push(monster.word)
    this.beep(95, .18, 'sawtooth')
    if (this.state.hp <= 0) {
      this.finishGame('breached')
    }
  }

  private finishGame(reason: 'completed' | 'breached' | 'ended') {
    if (this.state.phase === 'over') return
    this.state.phase = 'over'; this.state.endReason = reason
    this.emit(true); this.callbacks.onGameOver(this.getSnapshot(), [...this.outcomes])
  }

  private registerWrong() {
    const target = this.getTarget()
    if (target) this.targetMistakes.add(target.word.id)
    this.shakeTimer = 0.3; this.state.wrong += 1; this.state.combo = 0; this.state.multiplier = 1; this.beep(120, .1, 'sawtooth'); this.emit(true)
  }
  private liveMonsters() { return this.monsters.filter((monster) => !monster.killed && monster.dying === 0) }
  private distance(monster: Monster) { return Math.hypot(monster.x - this.centerX, monster.y - this.centerY) }
  private getTarget() { return this.liveMonsters().sort((a, b) => this.distance(a) - this.distance(b))[0] }
  private updateTarget() { this.state.targetEnglish = this.inputMode === 'touch' ? this.getTarget()?.word.english ?? '' : '' }

  private burst(x: number, y: number, color: string, count: number) {
    for (let index = 0; index < count; index++) { const angle = Math.random() * Math.PI * 2, speed = 60 + Math.random() * 180; this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .5 + Math.random() * .4, color, size: 2 + Math.random() * 3 }) }
  }
  private beep(frequency: number, duration: number, type: OscillatorType) {
    try {
      this.audioContext ??= new AudioContext()
      const oscillator = this.audioContext.createOscillator(), gain = this.audioContext.createGain()
      oscillator.type = type; oscillator.frequency.value = frequency; gain.gain.value = .035
      gain.gain.exponentialRampToValueAtTime(.0001, this.audioContext.currentTime + duration)
      oscillator.connect(gain).connect(this.audioContext.destination); oscillator.start(); oscillator.stop(this.audioContext.currentTime + duration)
    } catch { /* Audio is optional. */ }
  }
  private emit(force = false) { if (force || this.state.phase !== 'playing') this.callbacks.onUpdate(this.getSnapshot()); else this.callbacks.onUpdate(this.getSnapshot()) }

  private get isDarkTheme() {
    if (typeof document === 'undefined') return false
    const root = document.documentElement
    return root.getAttribute('data-theme') === 'dark' || root.classList.contains('dark')
  }

  private render() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    ctx.save()
    if (this.shakeTimer > 0) {
      const shakeIntensity = 6
      const dx = (Math.random() - 0.5) * shakeIntensity
      const dy = (Math.random() - 0.5) * shakeIntensity
      ctx.translate(dx, dy)
    }

    const isDark = this.isDarkTheme
    const bg = ctx.createRadialGradient(this.centerX, this.centerY, 15, this.centerX, this.centerY, Math.max(this.width, this.height) * .75)
    if (isDark) {
      bg.addColorStop(0, '#172554')
      bg.addColorStop(.55, '#0b0f19')
      bg.addColorStop(1, '#020617')
    } else {
      bg.addColorStop(0, '#eff6ff')
      bg.addColorStop(.55, '#f8fafc')
      bg.addColorStop(1, '#f1f5f9')
    }
    ctx.fillStyle = bg; ctx.fillRect(0, 0, this.width, this.height)
    ctx.strokeStyle = isDark ? 'rgba(59, 130, 246, 0.14)' : 'rgba(37, 99, 235, 0.07)'; ctx.lineWidth = 1.2
    for (let radius = 120; radius < Math.max(this.width, this.height); radius += 120) { ctx.beginPath(); ctx.arc(this.centerX, this.centerY, radius, 0, Math.PI * 2); ctx.stroke() }
    this.drawCore()
    for (const monster of this.monsters) if (monster.dying >= 0) this.drawMonster(monster)
    for (const particle of this.particles) { 
      const lifeRatio = Math.max(0, Math.min(1, particle.life / 0.75))
      ctx.globalAlpha = lifeRatio
      ctx.fillStyle = particle.color
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, particle.size * lifeRatio, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  private drawCore() {
    const ctx = this.ctx, pulse = 1 + Math.sin(this.state.time * 2.4) * .05, radius = 34 * pulse
    const glow = ctx.createRadialGradient(this.centerX, this.centerY, 2, this.centerX, this.centerY, radius * 3)
    glow.addColorStop(0, 'rgba(37, 99, 235, 0.15)')
    glow.addColorStop(.4, 'rgba(37, 99, 235, 0.05)')
    glow.addColorStop(1, 'rgba(37, 99, 235, 0)')
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(this.centerX, this.centerY, radius * 3, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = this.state.hp / this.state.maxHp > .3 ? '#3b82f6' : '#ef4444'; ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2.5
    ctx.beginPath()
    for (let index = 0; index < 8; index++) { const angle = index / 8 * Math.PI * 2 - Math.PI / 2, x = this.centerX + Math.cos(angle) * radius, y = this.centerY + Math.sin(angle) * radius; index ? ctx.lineTo(x, y) : ctx.moveTo(x, y) }
    ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.fillStyle = this.isDarkTheme ? '#f8fafc' : '#ffffff'; ctx.beginPath(); ctx.arc(this.centerX, this.centerY, 9, 0, Math.PI * 2); ctx.fill()
  }

  private drawMonster(monster: Monster) {
    const isDark = this.isDarkTheme
    const ctx = this.ctx, color = COLORS[monster.word.tier], alpha = monster.dying > 0 ? Math.max(0, monster.dying / .28) : 1
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(monster.x, monster.y)
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, monster.radius * 2); glow.addColorStop(0, `${color}33`); glow.addColorStop(1, `${color}00`)
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, monster.radius * 2, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = isDark ? '#1e293b' : '#ffffff'; ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath()
    const spikes = monster.word.tier + 5
    for (let index = 0; index <= spikes * 2; index++) { const angle = index / (spikes * 2) * Math.PI * 2, point = index % 2 === 0 ? monster.radius : monster.radius * .74, wobble = 1 + Math.sin(this.state.time * 3 + monster.seed + index) * .05; const x = Math.cos(angle) * point * wobble, y = Math.sin(angle) * point * wobble; index ? ctx.lineTo(x, y) : ctx.moveTo(x, y) }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(-7, -2, 3, 0, Math.PI * 2); ctx.arc(7, -2, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore()
    let label = monster.word.vietnamese
    if (monster.hintUntil > this.state.time && this.inputMode === 'typing') label += `  →  ${monster.word.english[0]}…`
    ctx.font = `600 ${this.width < 520 ? 12 : 14}px "Be Vietnam Pro", sans-serif`; const width = ctx.measureText(label).width + 22
    const labelY = monster.y - monster.radius - 26; ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255,255,255,0.95)'; this.roundRect(monster.x - width / 2, labelY - 15, width, 30, 8); ctx.fill()
    ctx.strokeStyle = `${color}aa`; ctx.stroke(); ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, monster.x, labelY)
  }

  private roundRect(x: number, y: number, width: number, height: number, radius: number) {
    const ctx = this.ctx; ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.arcTo(x + width, y, x + width, y + height, radius); ctx.arcTo(x + width, y + height, x, y + height, radius); ctx.arcTo(x, y + height, x, y, radius); ctx.arcTo(x, y, x + width, y, radius); ctx.closePath()
  }
}

