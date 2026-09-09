import { useCallback, useEffect, useReducer, useState } from 'react'
import { supabase } from './supabase'
import { DEFAULT_TTS_VOICE, type TtsVoice } from '../domain/types'

export type TtsRate = 'normal' | 'slow'
export type TtsStatus = 'idle' | 'loading' | 'playing' | 'error'

export const TTS_VOICES: readonly { value: TtsVoice; label: string; description: string }[] = [
  { value: 'en-US-EmmaMultilingualNeural', label: 'Emma (Mỹ)', description: 'Rõ, tự nhiên, phù hợp học phát âm' },
  { value: 'en-US-AriaNeural', label: 'Aria (Mỹ)', description: 'Giọng Mỹ sáng và rõ' },
  { value: 'en-GB-SoniaNeural', label: 'Sonia (Anh)', description: 'Giọng Anh-Anh chuẩn' },
]

const RATE_CONFIG: Record<TtsRate, { edge: '-10%' | '-25%'; browser: number }> = {
  normal: { edge: '-10%', browser: 0.9 },
  slow: { edge: '-25%', browser: 0.75 },
}

export const STORAGE_KEY_TTS_VOICE = 'wordforge_tts_voice'

export function getStoredTtsVoice(): TtsVoice {
  return (localStorage.getItem(STORAGE_KEY_TTS_VOICE) as TtsVoice) || DEFAULT_TTS_VOICE
}

export function saveStoredTtsVoice(voice: TtsVoice): void {
  localStorage.setItem(STORAGE_KEY_TTS_VOICE, voice)
}

interface TtsState {
  key: string | null
  status: TtsStatus
}

let state: TtsState = { key: null, status: 'idle' }
let sequence = 0
const listeners = new Set<() => void>()
const urlCache = new Map<string, string>()
const audio = typeof Audio !== 'undefined' ? new Audio() : null

if (audio) audio.preload = 'auto'

function notify() {
  listeners.forEach((listener) => listener())
}

function setState(next: TtsState) {
  state = next
  notify()
}

export function subscribeTts(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getTtsState(): TtsState {
  return state
}

export function normalizeTtsText(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ')
}

export function ttsCacheKey(text: string, voice: TtsVoice, rate: TtsRate): string {
  return `${voice}|${rate}|${normalizeTtsText(text)}`
}

function fallbackSpeak(text: string, voice: TtsVoice, rate: TtsRate): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return false
  const utterance = new SpeechSynthesisUtterance(text)
  const isGb = voice === 'en-GB-SoniaNeural'
  utterance.lang = isGb ? 'en-GB' : 'en-US'
  utterance.rate = RATE_CONFIG[rate].browser

  const allVoices = window.speechSynthesis.getVoices()
  const matchingVoice = allVoices.find((v) => v.lang === (isGb ? 'en-GB' : 'en-US'))
    || allVoices.find((v) => v.lang.startsWith(isGb ? 'en-GB' : 'en-US'))
    || allVoices.find((v) => v.lang.startsWith('en'))
  if (matchingVoice) utterance.voice = matchingVoice

  window.speechSynthesis.speak(utterance)
  return true
}

async function getOptimisticUrl(text: string, voice: TtsVoice, rate: TtsRate): Promise<string> {
  const rateKey = rate === 'slow' ? 'slow-25' : 'normal-10'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  const hash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  const path = `v2/${voice}/${rateKey}/${hash}.mp3`
  return supabase!.storage.from('tts-cache').getPublicUrl(path).data.publicUrl
}

function parseFunctionResponse(data: unknown): string {
  if (!data || typeof data !== 'object' || typeof (data as { url?: unknown }).url !== 'string') {
    throw new Error('TTS trả về URL không hợp lệ.')
  }
  return (data as { url: string }).url
}

function stopAudio() {
  if (!audio) return
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
}

export function stopTts() {
  sequence += 1
  stopAudio()
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  setState({ key: null, status: 'idle' })
}

export async function speakTts(text: string, voice?: TtsVoice, rate: TtsRate = 'normal'): Promise<'edge' | 'browser' | 'failed' | 'cancelled'> {
  const normalized = normalizeTtsText(text)
  if (!normalized) return 'failed'

  const effectiveVoice = voice || getStoredTtsVoice()
  const key = ttsCacheKey(normalized, effectiveVoice, rate)
  const requestId = ++sequence
  stopAudio()
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  setState({ key, status: 'loading' })

  if (effectiveVoice.startsWith('browser://')) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setState({ key: null, status: 'error' })
      return 'failed'
    }
    const voiceName = effectiveVoice.slice(10)
    const utterance = new SpeechSynthesisUtterance(normalized)
    const voices = window.speechSynthesis.getVoices()
    const targetVoice = voices.find(v => v.name === voiceName)
    if (targetVoice) utterance.voice = targetVoice
    utterance.lang = targetVoice ? targetVoice.lang : 'en-US'
    utterance.rate = RATE_CONFIG[rate].browser

    return new Promise((resolve) => {
      utterance.onend = () => {
        if (requestId === sequence) setState({ key: null, status: 'idle' })
        resolve('browser')
      }
      utterance.onerror = () => {
        if (requestId === sequence) setState({ key: null, status: 'error' })
        resolve('failed')
      }
      window.speechSynthesis.speak(utterance)
      setState({ key, status: 'playing' })
    })
  }

  if (!audio) {
    const usedFallback = fallbackSpeak(normalized, effectiveVoice, rate)
    setState({ key: null, status: usedFallback ? 'idle' : 'error' })
    return usedFallback ? 'browser' : 'failed'
  }

  try {
    if (urlCache.has(key)) {
      const cachedUrl = urlCache.get(key)!
      audio.src = cachedUrl
      setState({ key, status: 'playing' })
      await audio.play()
      if (requestId !== sequence) return 'cancelled'
      return 'edge'
    }

    if (!supabase) {
      const usedFallback = fallbackSpeak(normalized, effectiveVoice, rate)
      setState({ key: null, status: usedFallback ? 'idle' : 'error' })
      return usedFallback ? 'browser' : 'failed'
    }

    try {
      const optimisticUrl = await getOptimisticUrl(normalized, effectiveVoice, rate)
      const res = await fetch(optimisticUrl, { method: 'HEAD' })
      if (res.ok) {
        urlCache.set(key, optimisticUrl)
        audio.src = optimisticUrl
        setState({ key, status: 'playing' })
        await audio.play()
        if (requestId !== sequence) return 'cancelled'
        return 'edge'
      }
    } catch (e) {
      // Optimistic URL check failed, fallback to Edge Function synthesis
    }

    const { data, error } = await supabase.functions.invoke('tts-synthesize', {
      body: { text: normalized, voice: effectiveVoice, rate: RATE_CONFIG[rate].edge },
    })

    if (error || !data) {
      console.warn('Edge TTS failed, using fallback speech:', error)
      const usedFallback = fallbackSpeak(normalized, effectiveVoice, rate)
      setState({ key: null, status: usedFallback ? 'idle' : 'error' })
      return usedFallback ? 'browser' : 'failed'
    }

    const audioUrl = parseFunctionResponse(data)
    urlCache.set(key, audioUrl)
    audio.src = audioUrl
    audio.onended = () => {
      if (requestId === sequence) setState({ key: null, status: 'idle' })
    }
    audio.onerror = () => {
      if (requestId !== sequence) return
      console.warn('Audio playback failed for synthesised file, using fallback speech')
      const usedFallback = fallbackSpeak(normalized, effectiveVoice, rate)
      setState({ key: null, status: usedFallback ? 'idle' : 'error' })
    }
    setState({ key, status: 'playing' })
    try {
      await audio.play()
    } catch (playError) {
      if (requestId !== sequence) return 'cancelled'
      console.warn('Audio play blocked or failed, using fallback speech:', playError)
      const usedFallback = fallbackSpeak(normalized, effectiveVoice, rate)
      setState({ key: null, status: usedFallback ? 'idle' : 'error' })
      return usedFallback ? 'browser' : 'failed'
    }
    if (requestId !== sequence) return 'cancelled'
    return 'edge'
  } catch (error) {
    if (requestId !== sequence) return 'cancelled'
    const usedFallback = fallbackSpeak(normalized, effectiveVoice, rate)
    setState({ key: null, status: usedFallback ? 'idle' : 'error' })
    if (usedFallback) return 'browser'
    console.warn('TTS playback failed:', error)
    return 'failed'
  }
}

export function useTts(voice?: TtsVoice) {
  const effectiveVoice = voice || getStoredTtsVoice()
  const [, forceRender] = useReducer((value: number) => value + 1, 0)

  useEffect(() => {
    const unsubscribe = subscribeTts(forceRender)
    return () => { unsubscribe() }
  }, [])

  const speak = useCallback((text: string, rate: TtsRate = 'normal') => speakTts(text, effectiveVoice, rate), [effectiveVoice])
  
  const prefetch = useCallback(async (text: string, rate: TtsRate = 'normal'): Promise<void> => {
    const normalized = normalizeTtsText(text)
    if (!normalized || !supabase) return
    const key = ttsCacheKey(normalized, effectiveVoice, rate)
    if (effectiveVoice.startsWith('browser://') || urlCache.has(key)) return

    try {
      const optimisticUrl = await getOptimisticUrl(normalized, effectiveVoice, rate)
      const res = await fetch(optimisticUrl, { method: 'HEAD' })
      if (res.ok) {
        urlCache.set(key, optimisticUrl)
        return
      }
    } catch (e) {
      // Ignore
    }

    try {
      const { data, error } = await supabase.functions.invoke('tts-synthesize', {
        body: { text: normalized, voice: effectiveVoice, rate: RATE_CONFIG[rate].edge },
      })
      if (!error && data) {
        urlCache.set(key, parseFunctionResponse(data))
      }
    } catch (e) {
      // Ignore errors on prefetch
    }
  }, [effectiveVoice])

  const isLoading = useCallback((text: string, rate: TtsRate = 'normal') => {
    const current = getTtsState()
    return current.status === 'loading' && current.key === ttsCacheKey(text, effectiveVoice, rate)
  }, [effectiveVoice])

  return { speak, stop: stopTts, isLoading, prefetch, state: getTtsState() }
}

export function useBrowserVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const updateVoices = () => {
      const allVoices = window.speechSynthesis.getVoices()
      const popularKeywords = ['Google US English', 'Google UK English Female', 'Google UK English Male', 'David', 'Zira', 'Mark', 'Samantha', 'Alex', 'Daniel']
      const popular = allVoices.filter(v => 
        v.lang.startsWith('en') && 
        popularKeywords.some(k => v.name.includes(k))
      )
      setVoices(popular)
    }
    updateVoices()
    if ('onvoiceschanged' in window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = updateVoices
    }
  }, [])
  return voices
}
