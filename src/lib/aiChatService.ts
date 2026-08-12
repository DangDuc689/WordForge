import { ChatMessage, AICharacter, CorrectionFeedback } from '../domain/aiChat'
import { supabase } from './supabase'
import { FunctionsHttpError } from '@supabase/supabase-js'

/**
 * Sends a message to the AI character and returns the AI's response via Supabase Edge Function.
 */
export async function sendChatMessage(
  character: AICharacter,
  chatHistory: ChatMessage[],
  newMessageText: string
): Promise<{ replyContent: string; correction?: CorrectionFeedback }> {
  if (!supabase) {
    throw new Error('Supabase client is not initialized.')
  }

  // Remove timestamp and correction from history to minimize payload and match expected format
  const cleanMessages = chatHistory.map(msg => ({
    role: msg.role,
    content: msg.content
  }))

  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: {
      action: 'chat',
      systemPrompt: character.systemPrompt,
      messages: cleanMessages,
      userMessage: newMessageText
    }
  })

  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const errData = await error.context.json()
        if (errData && typeof errData === 'object' && 'error' in errData) {
          throw new Error(String(errData.error))
        }
      } catch (e) {
        // Fallback
      }
    }
    throw new Error(error.message || 'Lỗi kết nối tới AI Chat.')
  }

  if (!data || !data.replyContent) {
    throw new Error('AI trả về dữ liệu không hợp lệ.')
  }

  return {
    replyContent: data.replyContent,
    correction: data.correction
  }
}

/**
 * Generates 3 reply suggestions for the user based on the chat history.
 */
export async function generateReplySuggestions(
  character: AICharacter,
  chatHistory: ChatMessage[]
): Promise<string[]> {
  if (!supabase) return []

  const recentHistory = chatHistory.slice(-5)
  const transcript = recentHistory.map(msg => `${msg.role === 'assistant' ? character.name : 'User'}: ${msg.content}`).join('\n')

  try {
    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: {
        action: 'suggest',
        transcript: transcript,
        characterName: character.name,
        characterRole: character.role
      }
    })

    if (error) throw error

    if (data && Array.isArray(data.suggestions)) {
      return data.suggestions.slice(0, 3)
    }
    return []
  } catch (error) {
    console.error('Failed to generate suggestions', error)
    return []
  }
}

/**
 * Translates a given text to Vietnamese using the AI chat edge function.
 */
export async function translateMessageText(text: string): Promise<string | null> {
  if (!supabase || !text.trim()) return null

  try {
    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: {
        action: 'translate',
        text: text
      }
    })

    if (error) throw error
    if (data && typeof data.translation === 'string') {
      return data.translation
    }
    return null
  } catch (error) {
    console.error('Failed to translate text', error)
    return null
  }
}
