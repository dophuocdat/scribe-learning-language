// supabase/functions/ai-api/index.ts
// Gemini 2.5 Flash — generate vocabulary, quiz questions, summaries

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function errorResponse(message: string, status = 400) {
  console.error(`[ai-api] ERROR: ${message}`)
  return jsonResponse({ error: message }, status)
}

// Lightweight JWT pre-check: decode payload (no signature verify) to block
// garbage requests BEFORE calling the expensive auth.getUser().
function preCheckJwt(authHeader: string): { valid: false; reason: string } | { valid: true } {
  if (!authHeader.startsWith('Bearer ')) {
    return { valid: false, reason: 'Invalid Authorization format' }
  }

  const token = authHeader.slice(7)
  const parts = token.split('.')
  if (parts.length !== 3) {
    return { valid: false, reason: 'Malformed JWT (expected 3 parts)' }
  }

  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, reason: 'Token expired' }
    }

    if (!payload.sub) {
      return { valid: false, reason: 'Missing sub claim' }
    }

    return { valid: true }
  } catch {
    return { valid: false, reason: 'Cannot decode JWT payload' }
  }
}

// Verify admin JWT
async function verifyAdmin(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization')

  if (!authHeader) return errorResponse('Missing authorization header', 401)

  // Pre-check nhẹ: decode payload, check format/exp (0ms, không tốn DB call)
  const preCheck = preCheckJwt(authHeader)
  if (!preCheck.valid) {
    console.log(`[ai-api] Pre-check blocked: ${preCheck.reason}`)
    return errorResponse(preCheck.reason, 401)
  }

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) return errorResponse('Invalid token', 401)

  const role = user.app_metadata?.role
  if (role !== 'admin') return errorResponse('Admin access required', 403)

  console.log(`[ai-api] Admin verified: ${user.email}`)
  return { userId: user.id }
}

// Extract valid JSON from Gemini response (handles markdown fences + truncation)
function extractJson(raw: string): unknown {
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/```\s*$/, '').trim()
  }
  try {
    return JSON.parse(cleaned)
  } catch {
    // Attempt to repair truncated JSON by closing open structures
    let repaired = cleaned
    const opens = (repaired.match(/{/g) || []).length
    const closes = (repaired.match(/}/g) || []).length
    const openBrackets = (repaired.match(/\[/g) || []).length
    const closeBrackets = (repaired.match(/\]/g) || []).length
    repaired = repaired.replace(/,\s*$/, '')
    for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']'
    for (let i = 0; i < opens - closes; i++) repaired += '}'
    return JSON.parse(repaired)
  }
}

// Call Gemini 2.5 Flash
async function callGemini(prompt: string, jsonMode = true, maxTokens = 8192): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const model = 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const requestBody: Record<string, unknown> = {
    contents: [{
      parts: [{ text: prompt }],
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: maxTokens,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  }

  console.log(`[ai-api] Calling Gemini (${model}), prompt length: ${prompt.length}`)

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error(`[ai-api] Gemini API error: ${errText}`)
    throw new Error(`Gemini API returned ${response.status}`)
  }

  const result = await response.json()
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    console.error(`[ai-api] Gemini returned no text. Full response:`, JSON.stringify(result))
    throw new Error('Gemini returned empty response')
  }

  console.log(`[ai-api] Gemini response length: ${text.length}`)
  return text
}

// ===== PROMPTS =====

function vocabularyPrompt(text: string, difficulty?: string, maxItems?: number): string {
  const count = maxItems || 15
  const level = difficulty || 'mixed'
  return `Bạn là giáo viên tiếng Anh chuyên nghiệp. Phân tích đoạn văn sau và trích xuất ${count} từ vựng quan trọng nhất.

Yêu cầu:
- Chọn từ vựng ở mức độ: ${level}
- Mỗi từ phải có đầy đủ thông tin
- Ưu tiên từ vựng academic/business nếu phù hợp
- Sắp xếp theo độ khó tăng dần

Đoạn văn:
"""
${text}
"""

Trả về JSON array với format:
{
  "vocabulary": [
    {
      "word": "từ vựng",
      "ipa_pronunciation": "/phiên âm IPA/",
      "part_of_speech": "noun|verb|adjective|adverb|preposition|conjunction|pronoun|phrase",
      "definition_en": "nghĩa tiếng Anh ngắn gọn",
      "definition_vi": "nghĩa tiếng Việt",
      "example_sentence": "câu ví dụ sử dụng từ này (lấy từ đoạn văn nếu có)",
      "difficulty_rank": 1
    }
  ]
}`
}

function quizPrompt(text: string, vocabContext?: string[], questionCount?: number): string {
  const count = questionCount || 10
  const vocabList = vocabContext?.length ? `\nTừ vựng liên quan: ${vocabContext.join(', ')}` : ''
  return `Bạn là giáo viên tiếng Anh. Tạo ${count} câu hỏi kiểm tra reading comprehension và vocabulary dựa trên đoạn văn sau.
${vocabList}

Yêu cầu:
- Mix các loại câu hỏi: multiple_choice, true_false, fill_blank
- Câu hỏi phải kiểm tra hiểu bài, không chỉ nhớ từ
- Mỗi câu trắc nghiệm có 4 đáp án
- Có giải thích cho mỗi đáp án đúng

Đoạn văn:
"""
${text}
"""

Trả về JSON với format:
{
  "questions": [
    {
      "question_text": "câu hỏi",
      "question_type": "multiple_choice|true_false|fill_blank",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "đáp án đúng (phải khớp chính xác 1 trong options)",
      "explanation": "giải thích tại sao đáp án này đúng",
      "order_index": 0
    }
  ]
}`
}

function summaryPrompt(text: string): string {
  return `Tóm tắt đoạn văn tiếng Anh sau bằng tiếng Việt, tập trung vào:
1. Ý chính của bài
2. Các chủ đề từ vựng chính
3. Cấu trúc ngữ pháp nổi bật

Đoạn văn:
"""
${text}
"""

Trả về JSON:
{
  "summary": "tóm tắt ngắn gọn (2-3 đoạn)"
}`
}

function formatContentPrompt(text: string): string {
  return `You are an expert English teacher creating a STRUCTURED LESSON from raw scanned/fetched text.

OUTPUT RULES (CRITICAL):
- Return ONLY valid JSON
- NO literal newlines inside string values - use " | " as line separator
- Keep ALL string values SHORT and concise

CONTENT RULES:
- formatted_content: Create a CONCISE, STRUCTURED lesson summary (NOT the raw text). Structure as:
  "📖 [Topic Title] | | 🎯 Tổng quan: [1-2 sentence overview in Vietnamese] | | 📌 Nội dung chính: | • [Key point 1 in English] | • [Key point 2 in English] | • [Key point 3 in English] | | 💬 Trích dẫn quan trọng: | • [Important quote or sentence from text] | | 📝 Ngữ pháp nổi bật: [Notable grammar pattern used in the text]"
  MAXIMUM 150 words. Do NOT copy the entire raw text. Summarize and structure it.
- ai_summary: 2 sentences in Vietnamese describing what the lesson is about and what students will learn
- vocabulary: exactly 10 important words from the text, sorted by difficulty
- exercises: exactly 8 short exercises, must include all 6 types below

EXERCISE TYPES:
- "fill_blank": give a sentence with ___ blank, student fills the correct word/form
- "word_guess": give Vietnamese meaning, student guesses the English word
- "matching": give 3-4 word-meaning pairs to match (use " | " for line breaks)
- "true_false": short statement, student picks True or False
- "translation": short sentence to translate (Vietnamese <-> English)
- "multiple_choice": question with 4 short options

Each exercise MUST have a short Vietnamese explanation (1 sentence max).

Raw Text:
"""
${text}
"""

JSON format:
{"formatted_content":"📖 Topic Title | | 🎯 Tổng quan: Overview here | | 📌 Nội dung chính: | • Point 1 | • Point 2 | | 💬 Trích dẫn: | • Quote 1 | | 📝 Ngữ pháp: Pattern here","ai_summary":"...","detected_topics":["topic1"],"vocabulary":[{"word":"grow","ipa":"/ɡroʊ/","part_of_speech":"verb","meaning_vi":"mọc, phát triển","example_sentence":"Plants grow in the rainforest."}],"exercises":[{"type":"fill_blank","question":"Plants ___ (grow) in the forest.","options":null,"correct_answer":"grow","explanation":"Dùng thì hiện tại đơn vì diễn tả sự thật."},{"type":"multiple_choice","question":"'Preserve' means?","options":["Destroy","Protect","Build","Sell"],"correct_answer":"Protect","explanation":"Preserve = bảo tồn, giữ gìn."},{"type":"true_false","question":"'Melt' is a noun.","options":["True","False"],"correct_answer":"False","explanation":"Melt là động từ = tan chảy."}]}`
}

// ===== ROUTE HANDLERS =====

async function handleGenerateVocabulary(req: Request) {
  const { text, difficulty, maxItems } = await req.json()
  if (!text?.trim()) return errorResponse('Missing text field')

  console.log(`[ai-api] Generating vocabulary from ${text.length} chars`)

  const prompt = vocabularyPrompt(text, difficulty, maxItems)
  const raw = await callGemini(prompt)

  try {
    const parsed = JSON.parse(raw)
    console.log(`[ai-api] Generated ${parsed.vocabulary?.length || 0} vocabulary items`)
    return jsonResponse(parsed)
  } catch {
    console.error(`[ai-api] Failed to parse Gemini JSON:`, raw.substring(0, 500))
    return errorResponse('Failed to parse AI response', 500)
  }
}

async function handleGenerateQuiz(req: Request) {
  const { text, vocabContext, questionCount } = await req.json()
  if (!text?.trim()) return errorResponse('Missing text field')

  console.log(`[ai-api] Generating quiz from ${text.length} chars`)

  const prompt = quizPrompt(text, vocabContext, questionCount)
  const raw = await callGemini(prompt)

  try {
    const parsed = JSON.parse(raw)
    console.log(`[ai-api] Generated ${parsed.questions?.length || 0} quiz questions`)
    return jsonResponse(parsed)
  } catch {
    console.error(`[ai-api] Failed to parse Gemini JSON:`, raw.substring(0, 500))
    return errorResponse('Failed to parse AI response', 500)
  }
}

async function handleGenerateSummary(req: Request) {
  const { text } = await req.json()
  if (!text?.trim()) return errorResponse('Missing text field')

  console.log(`[ai-api] Generating summary from ${text.length} chars`)

  const prompt = summaryPrompt(text)
  const raw = await callGemini(prompt)

  try {
    const parsed = JSON.parse(raw)
    return jsonResponse(parsed)
  } catch {
    console.error(`[ai-api] Failed to parse Gemini JSON:`, raw.substring(0, 500))
    return errorResponse('Failed to parse AI response', 500)
  }
}

async function handleFormatContent(req: Request) {
  const { text } = await req.json()
  if (!text?.trim()) return errorResponse('Missing text field')

  console.log(`[ai-api] Formatting OCR content: ${text.length} chars`)

  const prompt = formatContentPrompt(text)
  // Use JSON mode + high token limit for large structured output
  const raw = await callGemini(prompt, true, 30000)

  try {
    const parsed = extractJson(raw) as Record<string, unknown>
    console.log(`[ai-api] Formatted content: ${(parsed.formatted_content as string)?.length || 0} chars, vocab: ${(parsed.vocabulary as unknown[])?.length || 0}, exercises: ${(parsed.exercises as unknown[])?.length || 0}`)
    return jsonResponse(parsed)
  } catch (e) {
    console.error(`[ai-api] Failed to parse Gemini JSON:`, raw.substring(0, 500))
    console.error(`[ai-api] Parse error:`, (e as Error).message)
    return errorResponse('Failed to parse AI response', 500)
  }
}

async function handleGenerateAll(req: Request) {
  const { text, difficulty, maxVocab, questionCount } = await req.json()
  if (!text?.trim()) return errorResponse('Missing text field')

  console.log(`[ai-api] Generating ALL (vocab + quiz + summary) from ${text.length} chars`)

  // Run all 3 in parallel for speed
  const [vocabRaw, quizRaw, summaryRaw] = await Promise.all([
    callGemini(vocabularyPrompt(text, difficulty, maxVocab)),
    callGemini(quizPrompt(text, undefined, questionCount)),
    callGemini(summaryPrompt(text)),
  ])

  try {
    const vocab = JSON.parse(vocabRaw)
    const quiz = JSON.parse(quizRaw)
    const summary = JSON.parse(summaryRaw)

    console.log(`[ai-api] Generated ALL: ${vocab.vocabulary?.length || 0} vocab, ${quiz.questions?.length || 0} questions`)

    return jsonResponse({
      vocabulary: vocab.vocabulary || [],
      questions: quiz.questions || [],
      summary: summary.summary || '',
    })
  } catch {
    console.error(`[ai-api] Failed to parse one or more Gemini responses`)
    return errorResponse('Failed to parse AI response', 500)
  }
}

// ===== MAIN ROUTER =====
Deno.serve(async (req: Request) => {
  console.log(`[ai-api] Incoming: ${req.method} ${req.url}`)

  // Handle CORS preflight — MUST be before any auth check
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Verify admin
  const authResult = await verifyAdmin(req)
  if (authResult instanceof Response) return authResult

  // --- Determine routing: SDK body-based OR legacy URL path ---
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const urlEndpoint = pathParts.length > 1 ? pathParts[pathParts.length - 1] : ''

  let endpoint = urlEndpoint
  let handlerReq = req

  // If called via SDK, URL path is just /ai-api (no sub-path)
  // Read _endpoint from body and pass remaining payload to handler
  if (!urlEndpoint || urlEndpoint === 'ai-api') {
    try {
      const body = await req.json()
      endpoint = body._endpoint || ''

      // Strip routing field, keep payload for handlers
      const { _endpoint: _, ...payload } = body

      handlerReq = new Request(req.url, {
        method: 'POST',
        headers: req.headers,
        body: JSON.stringify(payload),
      })
    } catch {
      return errorResponse('Invalid JSON body', 400)
    }
  }

  console.log(`[ai-api] POST /${endpoint}`)

  try {
    switch (endpoint) {
      case 'generate-vocabulary':
        return await handleGenerateVocabulary(handlerReq)
      case 'generate-quiz':
        return await handleGenerateQuiz(handlerReq)
      case 'generate-summary':
        return await handleGenerateSummary(handlerReq)
      case 'generate-all':
        return await handleGenerateAll(handlerReq)
      case 'format-content':
        return await handleFormatContent(handlerReq)
      default:
        return errorResponse(`Unknown endpoint: ${endpoint}`, 404)
    }
  } catch (err) {
    console.error('[ai-api] Unhandled error:', err)
    return errorResponse(`Server error: ${(err as Error).message}`, 500)
  }
})
