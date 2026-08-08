import { callGemini, corsHeaders, json, requireUser } from '../_shared/gemini.ts'

const chatSchema = {
  type: 'OBJECT',
  properties: {
    replyContent: { type: 'STRING' },
    correction: {
      type: ['OBJECT', 'NULL'],
      properties: {
        originalSentence: { type: 'STRING' },
        correctedSentence: { type: 'STRING' },
        explanation: { type: 'STRING' }
      },
      required: ['originalSentence', 'correctedSentence', 'explanation']
    }
  },
  required: ['replyContent']
}

const suggestSchema = {
  type: 'OBJECT',
  properties: {
    suggestions: {
      type: 'ARRAY',
      items: { type: 'STRING' }
    }
  },
  required: ['suggestions']
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    // Optionally require auth if needed, or allow anon for practice
    // const { client, user } = await requireUser(request)
    
    const payload = await request.json()
    const action = payload.action || 'chat'

    if (action === 'chat') {
      const { systemPrompt, messages, userMessage } = payload

      if (!systemPrompt || !messages || !Array.isArray(messages)) {
        return json({ error: 'Thiếu dữ liệu bắt buộc (systemPrompt, messages).' }, 400)
      }

      let conversationContext = "SYSTEM INSTRUCTION:\n" + systemPrompt + "\n\nCHAT HISTORY:\n"
      
      for (const msg of messages) {
        if (msg.role === 'user') {
          conversationContext += `User: ${msg.content}\n`
        } else {
          conversationContext += `Assistant: ${msg.content}\n`
        }
      }
      
      if (userMessage) {
        conversationContext += `User: ${userMessage}\n`
      }

      conversationContext += "\nASSISTANT'S TURN:\nPlease generate the next response as the Assistant according to the SYSTEM INSTRUCTION. If the user makes a significant English grammar or vocabulary mistake in their latest message, include a correction object."

      const result = await callGemini(conversationContext, chatSchema)
      return json(result)
    } 
    else if (action === 'suggest') {
      const { transcript, characterName, characterRole } = payload
      
      if (!transcript) {
        return json({ error: 'Thiếu transcript.' }, 400)
      }

      const prompt = `You are a helpful English learning assistant. 
Review the following chat transcript between the User and ${characterName} (${characterRole}).
Suggest 3 natural, context-appropriate English sentences that the User could say next to continue the conversation.

Chat Transcript:
${transcript}`

      const result = await callGemini(prompt, suggestSchema)
      return json(result)
    }

    return json({ error: 'Action không hợp lệ.' }, 400)
    
  } catch (error) {
    console.error('AI Chat Error:', error)
    return json({ error: error instanceof Error ? error.message : 'AI Chat thất bại.' }, 500)
  }
})
