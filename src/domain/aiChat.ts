export type CharacterCategory = 'travel' | 'business' | 'learning'
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced'

export interface AICharacter {
  id: string
  name: string
  avatar: string // Emoji or image URL
  role: string // Job title or persona role
  category: CharacterCategory
  difficulty: DifficultyLevel
  greeting: string // Initial message sent by AI
  systemPrompt: string // Defines personality, rules, correction behavior
  missions: string[] // 3 suggested missions for the chat
}

export interface CorrectionFeedback {
  originalSentence: string
  correctedSentence: string
  explanation: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  correction?: CorrectionFeedback // Populated if the assistant is providing grammar correction for the previous user message
  isTranslation?: boolean // Flag to indicate if this is a translated message (optional helper)
  translation?: string // Lịch sử lưu bản dịch của tin nhắn
  showTranslation?: boolean // Trạng thái hiển thị bản dịch
}

export interface AIChatSession {
  id: string
  characterId: string
  startedAt: number
  lastUpdatedAt: number
  messages: ChatMessage[]
}
