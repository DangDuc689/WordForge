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
  utterance.lang = voice === 'en-GB-SoniaNeural' ? 'en-GB' : 'en-US'
  utterance.rate = RATE_CONFIG[rate].browser
  window.speechSynthesis.cancel()
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

export async function speakTts(text: string, voice: TtsVoice = DEFAULT_TTS_VOICE, rate: TtsRate = 'normal'): Promise<'edge' | 'browser' | 'failed' | 'cancelled'> {
  const normalized = normalizeTtsText(text)
  if (!normalized) return 'failed'

  const key = ttsCacheKey(normalized, voice, rate)
  const requestId = ++sequence
  stopAudio()
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  setState({ key, status: 'loading' })

  if (voice.startsWith('browser://')) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setState({ key: null, status: 'error' })
      return 'failed'
    }
    const voiceName = voice.slice(10)
    const utterance = new SpeechSynthesisUtterance(normalized)
    const voices = window.speechSynthesis.getVoices()
    const targetVoice = voices.find(v => v.name === voiceName)
    if (targetVoice) utterance.voice = targetVoice
    utterance.lang = targetVoice ? targetVoice.lang : 'en-US'
    utterance.rate = RATE_CONFIG[rate].browser

    return new Promise((resolve) => {
      utterance.onstart = () => {
        if (requestId === sequence) setState({ key, status: 'playing' })
      }
      utterance.onend = () => {
        if (requestId === sequence) setState({ key: null, status: 'idle' })
        resolve('browser')
      }
      utterance.onerror = (e) => {
        console.warn('Browser TTS error', e)
        if (requestId === sequence) setState({ key: null, status: 'error' })
        resolve('failed')
      }
      window.speechSynthesis.speak(utterance)
    })
  }

  try {
    let url = urlCache.get(key)
    if (!url) {
      if (!supabase) throw new Error('Supabase chưa được cấu hình.')
      
      try {
        const optimisticUrl = await getOptimisticUrl(normalized, voice, rate)
        const res = await fetch(optimisticUrl, { method: 'HEAD' })
        if (res.ok) {
          url = optimisticUrl
        }
      } catch (e) {
        // Fallback to edge function if network error occurs during HEAD request
      }

      if (!url) {
        const { data, error } = await supabase.functions.invoke('tts-synthesize', {
          body: { text: normalized, voice, rate: RATE_CONFIG[rate].edge },
        })
        if (error) throw error
        url = parseFunctionResponse(data)
      }
      urlCache.set(key, url)
    }

    if (requestId !== sequence) return 'cancelled'
    if (!audio) throw new Error('Trình duyệt không hỗ trợ audio.')

    audio.src = url
    audio.currentTime = 0
    audio.onended = () => {
      if (requestId === sequence) setState({ key: null, status: 'idle' })
    }
    audio.onerror = () => {
      if (requestId !== sequence) return
      const usedFallback = fallbackSpeak(normalized, voice, rate)
      setState({ key: null, status: usedFallback ? 'idle' : 'error' })
    }
    setState({ key, status: 'playing' })
    await audio.play()
    if (requestId !== sequence) return 'cancelled'
    return 'edge'
  } catch (error) {
    if (requestId !== sequence) return 'cancelled'
    const usedFallback = fallbackSpeak(normalized, voice, rate)
    setState({ key: null, status: usedFallback ? 'idle' : 'error' })
    if (usedFallback) return 'browser'
    console.warn('TTS playback failed:', error)
    return 'failed'
  }
}

export function useTts(voice: TtsVoice = DEFAULT_TTS_VOICE) {
  const [, forceRender] = useReducer((value: number) => value + 1, 0)

  useEffect(() => {
    const unsubscribe = subscribeTts(forceRender)
    return () => { unsubscribe() }
  }, [])

  const speak = useCallback((text: string, rate: TtsRate = 'normal') => speakTts(text, voice, rate), [voice])
  
  const prefetch = useCallback(async (text: string, rate: TtsRate = 'normal'): Promise<void> => {
    const normalized = normalizeTtsText(text)
    if (!normalized || !supabase) return
    const key = ttsCacheKey(normalized, voice, rate)
    if (voice.startsWith('browser://') || urlCache.has(key)) return

    try {
      const optimisticUrl = await getOptimisticUrl(normalized, voice, rate)
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
        body: { text: normalized, voice, rate: RATE_CONFIG[rate].edge },
      })
      if (!error && data) {
        urlCache.set(key, parseFunctionResponse(data))
      }
    } catch (e) {
      // Ignore errors on prefetch
    }
  }, [voice])

  const isLoading = useCallback((text: string, rate: TtsRate = 'normal') => {
    const current = getTtsState()
    return current.status === 'loading' && current.key === ttsCacheKey(text, voice, rate)
  }, [voice])

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
