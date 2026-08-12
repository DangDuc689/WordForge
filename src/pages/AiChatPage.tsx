import { useState, useEffect, useRef } from 'react'
import { PageHeader } from '../components/PageHeader'
import { AICharacter, ChatMessage } from '../domain/aiChat'
import { aiCharacters } from '../data/aiCharacters'
import { sendChatMessage, generateReplySuggestions, translateMessageText } from '../lib/aiChatService'
import { useApp } from '../context/AppContext'
import { useTts } from '../lib/tts'
import { SpeakerIcon } from '../components/SpeakerIcon'
// Simple Icons
const IconTranslate = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6" /></svg>
const IconBack = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
const IconSend = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
const IconLightbulb = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18h6M10 22h4M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
const IconAlertCircle = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>

export function AiChatPage() {
  const [selectedCharacter, setSelectedCharacter] = useState<AICharacter | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  const { snapshot } = useApp()
  const { speak, isLoading: isTtsLoading } = useTts(snapshot.profile.ttsVoice)
  
  const [translatingId, setTranslatingId] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const handleToggleTranslation = async (msgId: string, content: string, currentTranslation?: string) => {
    if (currentTranslation) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, showTranslation: !m.showTranslation } : m))
      return
    }
    
    setTranslatingId(msgId)
    try {
      const translatedText = await translateMessageText(content)
      if (translatedText) {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, translation: translatedText, showTranslation: true } : m))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setTranslatingId(null)
    }
  }

  // Load chat session from local storage on character select
  useEffect(() => {
    if (selectedCharacter) {
      const stored = localStorage.getItem(`ai_chat_${selectedCharacter.id}`)
      if (stored) {
        setMessages(JSON.parse(stored))
      } else {
        // Initial greeting
        const initialMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: selectedCharacter.greeting,
          timestamp: Date.now()
        }
        setMessages([initialMsg])
      }
    } else {
      setMessages([])
      setSuggestions([])
      setErrorMsg(null)
    }
  }, [selectedCharacter])

  // Save to local storage whenever messages change
  useEffect(() => {
    if (selectedCharacter && messages.length > 0) {
      localStorage.setItem(`ai_chat_${selectedCharacter.id}`, JSON.stringify(messages))
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, selectedCharacter])

  const handleSendMessage = async (text: string = inputText) => {
    if (!text.trim() || !selectedCharacter || isLoading) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: Date.now()
    }

    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInputText('')
    setSuggestions([])
    setIsLoading(true)
    setErrorMsg(null)

    try {
      const { replyContent, correction } = await sendChatMessage(selectedCharacter, newMessages, userMsg.content)
      
      // Kích hoạt phát âm ngay lập tức (không await) để bù trừ delay tải audio
      void speak(replyContent)
      
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: replyContent,
        timestamp: Date.now(),
        correction: correction
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      // Giữ lại tin nhắn người dùng thay vì xóa đi
    } finally {
      setIsLoading(false)
    }
  }

  const handleGetSuggestions = async () => {
    if (!selectedCharacter || messages.length === 0) return
    setIsSuggesting(true)
    try {
      const sugs = await generateReplySuggestions(selectedCharacter, messages)
      setSuggestions(sugs)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSuggesting(false)
    }
  }

  const resetChat = () => {
    if (!selectedCharacter) return
    if (confirm('Are you sure you want to clear the chat history for this character?')) {
      localStorage.removeItem(`ai_chat_${selectedCharacter.id}`)
      const initialMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: selectedCharacter.greeting,
        timestamp: Date.now()
      }
      setMessages([initialMsg])
      setSuggestions([])
    }
  }

  if (!selectedCharacter) {
    return (
      <div className="page ai-chat-page">
        <PageHeader 
          eyebrow="AI Roleplay"
          title={<>Trò chuyện <span className="accent">Tiếng Anh</span></>}
          description="Luyện tập giao tiếp thực tế với các nhân vật ảo."
        />
        
        <div className="settings-grid" style={{ marginTop: '2rem' }}>
          {['travel', 'business', 'learning'].map(category => (
            <section key={category} className="panel settings-section no-lift">
              <div className="settings-section-header">
                <b>{category === 'travel' ? '🧳 Du lịch & Đời sống' : category === 'business' ? '💼 Công sở & Phỏng vấn' : '🎓 Học tập & Hướng dẫn'}</b>
              </div>
              <div className="theme-options" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                {aiCharacters.filter(c => c.category === category).map(char => (
                  <button 
                    key={char.id}
                    type="button" 
                    className="theme-option-card"
                    onClick={() => setSelectedCharacter(char)}
                    style={{ alignItems: 'flex-start', textAlign: 'left', padding: '1.25rem' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '2.5rem' }}>{char.avatar}</span>
                      <div>
                        <b style={{ display: 'block', fontSize: '1.1rem' }}>{char.name}</b>
                        <small className="accent">{char.role}</small>
                      </div>
                    </div>
                    <small style={{ display: 'block', opacity: 0.8 }}>
                      Difficulty: <b>{char.difficulty}</b>
                    </small>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="page ai-chat-room" style={{ height: 'calc(100vh - 4rem)', display: 'flex', flexDirection: 'column' }}>
      <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', borderBottom: '1px solid var(--border)', borderRadius: '0' }}>
        <button className="button ghost icon-only" onClick={() => setSelectedCharacter(null)}>
          <IconBack />
        </button>
        <span style={{ fontSize: '2rem' }}>{selectedCharacter.avatar}</span>
        <div style={{ flex: 1 }}>
          <b style={{ display: 'block' }}>{selectedCharacter.name}</b>
          <small>{selectedCharacter.role}</small>
        </div>
        <button className="button ghost" onClick={resetChat}><small>Clear Chat</small></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', maxWidth: '85%', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
              <div 
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  backgroundColor: msg.role === 'user' ? 'var(--accent)' : 'var(--panel-bg)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text)',
                  border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                  boxShadow: 'var(--shadow-sm)',
                  lineHeight: 1.5
                }}
              >
                {msg.content}
              </div>
              <div style={{ display: 'flex', flexDirection: 'row', gap: '0.25rem' }}>
                <button 
                  className="button ghost icon-only" 
                  onClick={() => speak(msg.content)} 
                  disabled={isTtsLoading(msg.content)}
                  title="Nghe phát âm"
                  style={{ opacity: 0.5, padding: '0.25rem', width: '32px', height: '32px' }}
                >
                  <SpeakerIcon />
                </button>
                <button 
                  className="button ghost icon-only" 
                  onClick={() => handleToggleTranslation(msg.id, msg.content, msg.translation)}
                  disabled={translatingId === msg.id}
                  title="Dịch sang tiếng Việt"
                  style={{ opacity: msg.showTranslation ? 1 : 0.5, padding: '0.25rem', width: '32px', height: '32px', color: msg.showTranslation ? 'var(--cyan)' : 'inherit' }}
                >
                  {translatingId === msg.id ? <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>...</span> : <IconTranslate />}
                </button>
              </div>
            </div>
            
            {msg.showTranslation && msg.translation && (
              <div style={{ 
                marginTop: '0.5rem',
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                borderLeft: msg.role === 'assistant' ? '3px solid var(--cyan)' : 'none',
                borderRight: msg.role === 'user' ? '3px solid var(--cyan)' : 'none',
                borderRadius: '8px',
                maxWidth: '85%',
                fontSize: '0.95rem',
                color: 'var(--text)',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start'
              }}>
                {msg.translation}
              </div>
            )}
            
            {msg.correction && (
              <div style={{ 
                marginTop: '0.5rem', 
                padding: '0.75rem', 
                backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                maxWidth: '80%',
                fontSize: '0.85rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#ef4444', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                  <IconAlertCircle /> Grammar Suggestion
                </div>
                <div style={{ textDecoration: 'line-through', opacity: 0.7 }}>{msg.correction.originalSentence}</div>
                <div style={{ color: 'var(--text)', margin: '0.25rem 0' }}>👉 {msg.correction.correctedSentence}</div>
                <div style={{ opacity: 0.8, fontStyle: 'italic', marginTop: '0.25rem' }}>{msg.correction.explanation}</div>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div style={{ alignSelf: 'flex-start', padding: '0.75rem', color: 'var(--text-muted)' }}>
            <small>typing...</small>
          </div>
        )}
        {errorMsg && (
          <div style={{ alignSelf: 'center', padding: '0.5rem 1rem', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '4px', fontSize: '0.85rem', marginTop: '1rem' }}>
            {errorMsg}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg)' }}>
        {suggestions.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.75rem', marginBottom: '0.5rem' }}>
            {suggestions.map((sug, i) => (
              <button key={i} className="button ghost" style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }} onClick={() => handleSendMessage(sug)}>
                {sug}
              </button>
            ))}
          </div>
        )}
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="button ghost icon-only" 
            title="Gợi ý trả lời" 
            onClick={handleGetSuggestions}
            disabled={isLoading || isSuggesting}
          >
            <IconLightbulb />
          </button>
          <input 
            type="text" 
            className="settings-input" 
            style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '24px' }}
            placeholder="Type your message..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
            disabled={isLoading}
          />
          <button 
            className="button primary icon-only" 
            style={{ borderRadius: '50%' }}
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isLoading}
          >
            <IconSend />
          </button>
        </div>
        
        {/* Simple Missions display */}
        {!suggestions.length && (
           <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
             <small className="accent"><b>Missions:</b></small>
             {selectedCharacter.missions.map((m, i) => (
               <small key={i} style={{ opacity: 0.7 }}>• {m}</small>
             ))}
           </div>
        )}
      </div>
    </div>
  )
}
