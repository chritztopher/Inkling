import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mock persona and book data - replace with real database calls
const personas: Record<string, any> = {
  'jane-austen': {
    id: 'jane-austen',
    name: 'Jane Austen',
    description: 'English novelist known for her wit and social commentary',
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    systemPrompt: 'You are Jane Austen, the celebrated English novelist. Respond with wit, charm, and keen social observations. Draw from your knowledge of Regency society and human nature.',
  },
  'shakespeare': {
    id: 'shakespeare',
    name: 'William Shakespeare',
    description: 'English playwright and poet',
    voiceId: 'pNInz6obpgDQGcFmaJgB',
    systemPrompt: 'You are William Shakespeare, the greatest playwright and poet in the English language. Respond with eloquence, wisdom, and poetic insight. Draw from your vast knowledge of human nature and the arts.',
  },
}

const books: Record<string, any> = {
  'pride-and-prejudice': {
    id: 'pride-and-prejudice',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    description: 'A romantic novel about Elizabeth Bennet and Mr. Darcy',
    context: 'This novel explores themes of love, reputation, and social class in Regency England.',
  },
  'hamlet': {
    id: 'hamlet',
    title: 'Hamlet',
    author: 'William Shakespeare',
    description: 'A tragedy about the Prince of Denmark',
    context: 'This tragedy explores themes of revenge, madness, and moral corruption.',
  },
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Parse request body
    const { transcript, personaId, bookId } = await req.json()

    if (!transcript || !personaId || !bookId) {
      throw new Error('Missing required parameters: transcript, personaId, bookId')
    }

    // Get persona and book information
    const persona = personas[personaId]
    const book = books[bookId]

    if (!persona || !book) {
      throw new Error('Invalid persona or book ID')
    }

    // Build system prompt
    const systemPrompt = `${persona.systemPrompt}

Context: You are discussing "${book.title}" by ${book.author}. ${book.context}

Guidelines:
- Stay in character as ${persona.name}
- Reference the book naturally in your responses
- Keep responses conversational and engaging
- Aim for 1-3 sentences unless more detail is requested`

    // Call OpenAI API with streaming
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript }
        ],
        stream: true,
        max_tokens: 500,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('OpenAI API error:', error)
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    // Create readable stream for SSE
    const stream = new ReadableStream({
      start(controller) {
        const processStream = async () => {
          const reader = response.body!.getReader()
          const decoder = new TextDecoder()

          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              const chunk = decoder.decode(value, { stream: true })
              const lines = chunk.split('\n')

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6)
                  if (data === '[DONE]') {
                    controller.close()
                    return
                  }

                  try {
                    const parsed = JSON.parse(data)
                    const content = parsed.choices?.[0]?.delta?.content
                    if (content) {
                      // Send just the text content, not the full SSE format
                      controller.enqueue(new TextEncoder().encode(content))
                    }
                  } catch (e) {
                    // Skip malformed JSON
                  }
                }
              }
            }
          } catch (error) {
            controller.error(error)
          }
        }

        processStream()
      },
    })

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })

  } catch (error) {
    console.error('Chat function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
}) 