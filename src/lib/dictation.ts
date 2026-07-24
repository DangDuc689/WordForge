import type { AiPracticeSet, DictationItem, SrsCard, VocabularyItem } from '../domain/types'

export interface WordDiffToken {
  word: string
  expectedWord?: string
  status: 'correct' | 'wrong' | 'missing'
}

/**
 * Normalizes text for comparison by removing punctuation and converting to lowercase.
 */
export function normalizeSentence(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.,?!:;'"“”‘’()-]/g, '')
    .replace(/\s+/g, ' ')
}

/**
 * Compares user input with the target sentence word by word and returns diff tokens.
 */
export function diffSentence(userText: string, targetText: string): WordDiffToken[] {
  const targetWords = targetText.trim().split(/\s+/).filter(Boolean)
  const normUserWords = normalizeSentence(userText).split(/\s+/).filter(Boolean)
  const normTargetWords = targetWords.map((w) => normalizeSentence(w))

  const tokens: WordDiffToken[] = []
  let userIdx = 0

  for (let i = 0; i < targetWords.length; i++) {
    const rawTarget = targetWords[i]
    const normTarget = normTargetWords[i]
    const normUser = normUserWords[userIdx]

    if (!normUser) {
      tokens.push({
        word: rawTarget,
        status: 'missing',
      })
      continue
    }

    if (normUser === normTarget) {
      tokens.push({
        word: rawTarget,
        status: 'correct',
      })
      userIdx++
    } else {
      // Check if user skipped a word or typed extra
      const nextMatchInUser = normUserWords.indexOf(normTarget, userIdx)
      if (nextMatchInUser !== -1 && nextMatchInUser - userIdx <= 2) {
        tokens.push({
          word: rawTarget,
          status: 'correct',
        })
        userIdx = nextMatchInUser + 1
      } else {
        tokens.push({
          word: rawTarget,
          expectedWord: rawTarget,
          status: 'wrong',
        })
        userIdx++
      }
    }
  }

  return tokens
}

/**
 * Calculates whether a user answer matches the target sentence (>= 85% normalized match or exact).
 */
export function isSentenceCorrect(userAnswer: string, targetSentence: string): boolean {
  const normUser = normalizeSentence(userAnswer)
  const normTarget = normalizeSentence(targetSentence)
  if (!normUser || !normTarget) return false
  if (normUser === normTarget) return true

  const diffs = diffSentence(userAnswer, targetSentence)
  const correctCount = diffs.filter((d) => d.status === 'correct').length
  return diffs.length > 0 && correctCount / diffs.length >= 0.85
}

/**
 * Creates a local dictation set from learned vocabulary items, prioritizing due and weak cards.
 */
export function createLocalDictationSet(
  vocabItems: VocabularyItem[],
  cards: SrsCard[] = [],
  deckId: string | null = null
): AiPracticeSet {
  const filtered = deckId && deckId !== 'all'
    ? vocabItems.filter((v) => v.deckId === deckId)
    : vocabItems

  const cardMap = new Map(cards.map((c) => [c.vocabularyId, c]))
  const now = new Date()

  // 1. Exclusively target learned words (matching AI practice target selection)
  const learnedWords = filtered.filter((v) => cardMap.has(v.id))
  const pool = learnedWords.length > 0 ? learnedWords : filtered

  // 2. Prioritize due / weak cards within the learned words pool
  const dueOrWeak = pool.filter((v) => {
    const card = cardMap.get(v.id)
    if (!card) return false
    const isDue = new Date(card.dueAt) <= now
    return isDue || card.memoryLevel <= 2 || card.reps < 3 || card.lapses > 0
  })

  const remaining = pool.filter((v) => !dueOrWeak.some((w) => w.id === v.id))
  const shuffle = <T>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5)

  const selectedTargets: VocabularyItem[] = []
  selectedTargets.push(...shuffle(dueOrWeak))
  if (selectedTargets.length < 5) {
    selectedTargets.push(...shuffle(remaining))
  }

  const finalTargets = selectedTargets.slice(0, 5)

  const dictations: DictationItem[] = finalTargets.map((v, idx) => {
    const hasCustomExample = v.exampleEn && v.exampleEn.trim().length > 3
    const sentence = hasCustomExample
      ? v.exampleEn
      : `I am practicing the word ${v.english} today.`
    const translationVi = v.exampleVi || `Ví dụ với từ "${v.english}" (${v.vietnamese})`

    return {
      id: `dict_${v.id}_${idx}_${Date.now()}`,
      sentence,
      translationVi,
      vocabularyId: v.id,
      hint: `Từ mục tiêu: ${v.english} (${v.vietnamese})`,
    }
  })

  const glossary = selectedTargets.map((v) => ({
    vocabularyId: v.id,
    english: v.english,
    vietnamese: v.vietnamese,
  }))

  return {
    title: 'Luyện Nghe & Chép câu (Từ đã học)',
    format: 'dictation',
    passage: '',
    passageVi: '',
    questions: [],
    dictations,
    glossary,
  }
}
