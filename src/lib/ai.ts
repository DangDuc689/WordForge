import { z } from 'zod'
import type { AiPracticeSet, AiVocabularyDraft } from '../domain/types'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

const vocabularyDraftSchema = z.object({
  english: z.string().min(1),
  vietnamese: z.string().min(1),
  acceptedAnswers: z.array(z.string()).default([]),
  partOfSpeech: z.enum(['noun', 'verb', 'adjective', 'phrase', 'adverb', 'other']),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  cefr: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', '']),
  ipa: z.string().default(''),
  exampleEn: z.string().default(''),
  exampleVi: z.string().default(''),
  notes: z.string().default(''),
})

const practiceSetSchema = z.object({
  title: z.string().min(1),
  format: z.enum(['reading', 'quiz', 'dialogue', 'dictation']),
  passage: z.string().default(''),
  passageVi: z.string().default(''),
  questions: z.array(z.object({
    id: z.string(),
    vocabularyId: z.string().nullable(),
    prompt: z.string(),
    choices: z.array(z.string()).min(2),
    answer: z.string(),
    explanation: z.string(),
  })).default([]),
  dictations: z.array(z.object({
    id: z.string(),
    sentence: z.string(),
    translationVi: z.string(),
    vocabularyId: z.string().nullable().optional(),
    hint: z.string().optional(),
  })).optional(),
  glossary: z.array(z.object({
    vocabularyId: z.string(),
    english: z.string(),
    vietnamese: z.string(),
  })).default([]),
})

async function invoke<T>(functionName: string, body: Record<string, unknown>, schema: z.ZodTypeAny): Promise<T> {
  if (!supabase) throw new Error('AI cần Supabase được cấu hình. Bạn vẫn có thể nhập và học thủ công.')
  const { data, error } = await supabase.functions.invoke(functionName, { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const errData = await error.context.json()
        if (errData && typeof errData === 'object' && 'error' in errData) {
          throw new Error(String(errData.error))
        }
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message !== 'AI hiện không phản hồi.') {
          throw parseErr
        }
      }
    }
    throw new Error(error.message || 'AI hiện không phản hồi.')
  }
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw new Error('AI trả về dữ liệu không hợp lệ. Vui lòng thử lại.')
  return parsed.data as T
}

export const enrichVocabulary = (term: string, deckId: string): Promise<AiVocabularyDraft> =>
  invoke('ai-enrich-vocabulary', { term, deckId }, vocabularyDraftSchema)

export const generatePractice = (deckId: string | null, format: 'reading' | 'dialogue' | 'dictation'): Promise<AiPracticeSet> =>
  invoke('ai-generate-practice', { deckId, format }, practiceSetSchema)

export const aiSentenceGradingSchema = z.object({
  isCorrect: z.boolean(),
  feedback: z.string(),
  correctedSentence: z.string()
})

export type AiSentenceGrading = z.infer<typeof aiSentenceGradingSchema>

export const gradeSentence = (word: string, meaning: string, sentence: string): Promise<AiSentenceGrading> =>
  invoke('ai-grade-sentence', { word, meaning, sentence }, aiSentenceGradingSchema)
