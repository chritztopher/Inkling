import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Rate limiting utilities (inline for Deno compatibility)
// Note: In production, these would be imported from a shared Deno module

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Types for request/response
interface ChatRequest {
  transcript: string;
  personaId: string;
  bookId: string;
}

interface Persona {
  id: string;
  name: string;
  description: string;
  voiceId: string;
  systemPrompt: string;
}

interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  context: string;
}

interface BookChunk {
  id: string;
  bookId: string;
  content: string;
  chapterTitle?: string;
  pageNumber?: number;
  similarity?: number;
}

interface UsageLog {
  userId: string;
  path: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  timestamp: number;
}

// Mock persona and book data - replace with real database calls
const personas: Record<string, Persona> = {
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

const books: Record<string, Book> = {
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

// RAG retrieval stub hook for future implementation
async function retrieveChunks(bookId: string, query: string): Promise<BookChunk[]> {
  // TODO: Implement vector similarity search in Supabase pgvector
  // This will search for relevant book passages based on the user's query
  // and return the top 6 most relevant chunks with similarity scores
  
  console.log(`RAG retrieval stub called for book ${bookId} with query: ${query.substring(0, 50)}...`);
  
  // Return empty array for now - future implementation will:
  // 1. Convert query to embedding using OpenAI embeddings API
  // 2. Perform vector similarity search in Supabase
  // 3. Return top 6 relevant book passages with metadata
  return [];
}

// Usage logging function
async function logUsage(
  supabase: any,
  userId: string,
  path: string,
  tokensIn: number,
  tokensOut: number,
  latencyMs: number
): Promise<void> {
  try {
    const usageLog: UsageLog = {
      userId,
      path,
      tokensIn,
      tokensOut,
      latencyMs,
      timestamp: Date.now(),
    };

    // TODO: Insert into usage_logs table when it's created
    console.log('Usage log:', usageLog);
    
    // Future implementation will insert into Supabase table:
    // await supabase.from('usage_logs').insert(usageLog);
  } catch (error) {
    // Don't fail the request if logging fails
    console.error('Failed to log usage:', error);
  }
}

// Rate limiting check
async function checkRateLimit(supabase: any, userId: string): Promise<boolean> {
  try {
    // TODO: Implement rate limiting via Supabase RLS
    // This will check user's request count in the last time window
    
    const rateLimitPerHour = parseInt(Deno.env.get('CHAT_RATE_LIMIT_PER_HOUR') || '100');
    console.log(`Rate limit check for user ${userId} (limit: ${rateLimitPerHour}/hour)`);
    
    // Future implementation will:
    // 1. Query usage_logs for user's requests in last hour
    // 2. Return false if limit exceeded
    // 3. Use Supabase RLS policies for enforcement
    
    return true; // Allow all requests for now
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return true; // Allow request if check fails
  }
}

serve(async (req) => {
  const startTime = Date.now();
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      }
    )
  }

  let supabase: any;
  let userId = 'anonymous';
  let tokensIn = 0;
  let tokensOut = 0;

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user ID from authorization header
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      try {
        const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (user) {
          userId = user.id;
        }
      } catch (authError) {
        console.warn('Failed to get user from auth header:', authError);
      }
    }

    // Check rate limiting
    const rateLimitPassed = await checkRateLimit(supabase, userId);
    if (!rateLimitPassed) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please wait before trying again.',
          retryAfter: 3600 // 1 hour in seconds
        }),
        {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': '3600'
          },
          status: 429,
        }
      )
    }

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Parse and validate request body
    let requestBody: ChatRequest;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      throw new Error('Invalid JSON in request body');
    }

    const { transcript, personaId, bookId } = requestBody;

    // Validate required parameters
    if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
      throw new Error('transcript is required and must be a non-empty string');
    }
    if (!personaId || typeof personaId !== 'string') {
      throw new Error('personaId is required and must be a string');
    }
    if (!bookId || typeof bookId !== 'string') {
      throw new Error('bookId is required and must be a string');
    }

    // Get persona and book information
    const persona = personas[personaId];
    const book = books[bookId];

    if (!persona) {
      throw new Error(`Invalid persona ID: ${personaId}. Available personas: ${Object.keys(personas).join(', ')}`);
    }
    if (!book) {
      throw new Error(`Invalid book ID: ${bookId}. Available books: ${Object.keys(books).join(', ')}`);
    }

    // Retrieve relevant book chunks (RAG stub)
    const relevantChunks = await retrieveChunks(bookId, transcript);
    
    // Build context from retrieved chunks
    let bookContext = book.context;
    if (relevantChunks.length > 0) {
      const chunkTexts = relevantChunks.map(chunk => 
        `"${chunk.content}"${chunk.chapterTitle ? ` (from ${chunk.chapterTitle})` : ''}`
      ).join('\n\n');
      bookContext += `\n\nRelevant passages from the book:\n${chunkTexts}`;
    }

    // Build enhanced system prompt with persona and book context
    const systemPrompt = `${persona.systemPrompt}

Context: You are discussing "${book.title}" by ${book.author}. ${bookContext}

Guidelines:
- Stay in character as ${persona.name}
- Reference the book naturally in your responses
- If relevant passages are provided, incorporate them naturally into your response
- Keep responses conversational and engaging
- Aim for 1-3 sentences unless more detail is requested
- Maintain the persona's distinctive voice and perspective`;

    // Estimate input tokens (rough approximation: 1 token ≈ 4 characters)
    tokensIn = Math.ceil((systemPrompt.length + transcript.length) / 4);

    // Call OpenAI API with streaming
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
    });

    if (!openaiResponse.ok) {
      let errorMessage = `OpenAI API error: ${openaiResponse.status}`;
      try {
        const errorBody = await openaiResponse.json();
        errorMessage = errorBody.error?.message || errorMessage;
      } catch {
        // Use default error message if can't parse response
      }
      
      console.error('OpenAI API error:', {
        status: openaiResponse.status,
        statusText: openaiResponse.statusText,
        message: errorMessage
      });
      
      throw new Error(errorMessage);
    }

    // Create readable stream for Server-Sent Events
    const stream = new ReadableStream({
      start(controller) {
        const processStream = async () => {
          const reader = openaiResponse.body!.getReader();
          const decoder = new TextDecoder();
          let fullResponse = '';

          try {
            // Send initial SSE headers
            controller.enqueue(new TextEncoder().encode('data: {"type":"start"}\n\n'));

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  
                  if (data === '[DONE]') {
                    // Send completion event
                    controller.enqueue(new TextEncoder().encode('data: {"type":"complete"}\n\n'));
                    
                    // Log usage after completion
                    tokensOut = Math.ceil(fullResponse.length / 4);
                    const latencyMs = Date.now() - startTime;
                    await logUsage(supabase, userId, '/chat', tokensIn, tokensOut, latencyMs);
                    
                    controller.close();
                    return;
                  }

                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    
                    if (content) {
                      fullResponse += content;
                      
                      // Send content as SSE
                      const sseData = JSON.stringify({
                        type: 'content',
                        content: content
                      });
                      controller.enqueue(new TextEncoder().encode(`data: ${sseData}\n\n`));
                    }
                  } catch (parseError) {
                    // Skip malformed JSON chunks
                    console.warn('Failed to parse OpenAI chunk:', data);
                  }
                }
              }
            }
          } catch (streamError) {
            console.error('Stream processing error:', streamError);
            
            // Send error event
            const errorData = JSON.stringify({
              type: 'error',
              error: streamError instanceof Error ? streamError.message : 'Stream processing failed'
            });
            controller.enqueue(new TextEncoder().encode(`data: ${errorData}\n\n`));
            
            controller.error(streamError);
          } finally {
            reader.releaseLock();
          }
        };

        processStream();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Chat function error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId,
      timestamp: new Date().toISOString()
    });

    // Log failed request
    if (supabase) {
      const latencyMs = Date.now() - startTime;
      await logUsage(supabase, userId, '/chat', tokensIn, 0, latencyMs);
    }

    // Determine appropriate error status
    let status = 500;
    let errorMessage = error instanceof Error ? error.message : 'Internal server error';

    if (errorMessage.includes('required') || errorMessage.includes('Invalid')) {
      status = 400;
    } else if (errorMessage.includes('not configured') || errorMessage.includes('API key')) {
      status = 503;
      errorMessage = 'Service temporarily unavailable';
    }

    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status,
      }
    );
  }
})