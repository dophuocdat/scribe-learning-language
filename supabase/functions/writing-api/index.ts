// supabase/functions/writing-api/index.ts
// Grammar Checker, Paraphraser & Plagiarism Checker — Gemini 2.5 Flash powered
// For regular authenticated users (not admin-only)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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
  console.error(`[writing-api] ERROR: ${message}`)
  return jsonResponse({ error: message }, status)
}

// ===== AUTH: any logged-in user =====
async function verifyUser(req: Request): Promise<{ userId: string; client: ReturnType<typeof createClient> } | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return errorResponse('Missing authorization header', 401)
  if (!authHeader.startsWith('Bearer ')) return errorResponse('Invalid Authorization format', 401)

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) return errorResponse('Invalid token', 401)

  console.log(`[writing-api] User verified: ${user.email} (${user.id})`)
  return { userId: user.id, client: userClient }
}

function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

// ===== RATE LIMIT =====
async function checkWritingRateLimit(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  checkType: 'grammar' | 'plagiarism' | 'paraphrase'
): Promise<{ allowed: boolean; checksToday: number; maxChecks: number }> {
  const fieldMap: Record<string, string> = {
    grammar: 'max_daily_grammar_checks',
    plagiarism: 'max_daily_plagiarism_checks',
    paraphrase: 'max_daily_paraphrase_checks',
  }
  const defaultMap: Record<string, number> = { grammar: 10, plagiarism: 5, paraphrase: 15 }
  const profileField = fieldMap[checkType]
  const defaultMax = defaultMap[checkType] || 10

  let maxChecks = defaultMax
  const { data: profile } = await serviceClient
    .from('user_profiles')
    .select(profileField)
    .eq('id', userId)
    .single()

  if (profile?.[profileField]) {
    maxChecks = profile[profileField]
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { count, error } = await serviceClient
    .from('writing_checks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('check_type', checkType)
    .gte('created_at', todayStart.toISOString())

  if (error) {
    console.error('[writing-api] Rate limit check error:', error)
    return { allowed: false, checksToday: maxChecks, maxChecks }
  }

  const checksToday = count || 0
  return { allowed: checksToday < maxChecks, checksToday, maxChecks }
}

// ===== GEMINI API with Model Fallback =====
const MODEL_FALLBACK_CHAIN = [
  'gemini-2.5-flash',
  'gemma-3-27b-it',
  'gemma-3-12b-it',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
]

async function callGemini(prompt: string, maxTokens = 8192, temperature = 0.3): Promise<string> {
  const apiKeys = [
    Deno.env.get('GEMINI_API_KEY'),
    Deno.env.get('GEMINI_API_KEY_2'),
  ].filter(Boolean) as string[]

  if (apiKeys.length === 0) throw new Error('GEMINI_API_KEY not configured')

  let lastError: Error | null = null

  for (const model of MODEL_FALLBACK_CHAIN) {
    for (const apiKey of apiKeys) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

      console.log(`[writing-api] Calling Gemini (${model}), prompt length: ${prompt.length}`)

      try {
        // Gemma models don't support responseMimeType
        const isGemma = model.startsWith('gemma')
        const generationConfig: Record<string, unknown> = {
          temperature,
          maxOutputTokens: maxTokens,
        }
        if (!isGemma) {
          generationConfig.responseMimeType = 'application/json'
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig,
          }),
        })

        // Retry with next model/key on rate limit or overload
        if (response.status === 429 || response.status === 503) {
          const errText = await response.text()
          console.warn(`[writing-api] ${model} returned ${response.status}, trying next model... (${errText.substring(0, 100)})`)
          lastError = new Error(`${model}: ${response.status}`)
          continue
        }

        if (!response.ok) {
          const errText = await response.text()
          throw new Error(`Gemini API returned ${response.status}: ${errText}`)
        }

        const result = await response.json()
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text
        if (!text) throw new Error('Gemini returned empty response')

        console.log(`[writing-api] Gemini (${model}) response length: ${text.length}`)
        return text
      } catch (err) {
        lastError = err as Error
        // Only retry on network/rate errors, not on parse errors
        if ((err as Error).message?.includes('429') || (err as Error).message?.includes('503')) {
          console.warn(`[writing-api] ${model} failed, trying next...`)
          continue
        }
        throw err
      }
    }
  }

  throw lastError || new Error('All Gemini models exhausted')
}

function extractJson(raw: string): unknown {
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/```\s*$/, '').trim()
  }

  // First try: direct parse
  try {
    return JSON.parse(cleaned)
  } catch {
    // Repair truncated JSON from Gemini
    let repaired = cleaned

    // Fix unterminated strings: find last unmatched quote and close it
    let inString = false
    let lastQuotePos = -1
    for (let i = 0; i < repaired.length; i++) {
      const ch = repaired[i]
      if (ch === '\\' && inString) { i++; continue } // skip escaped chars
      if (ch === '"') {
        inString = !inString
        if (inString) lastQuotePos = i
      }
    }
    if (inString && lastQuotePos >= 0) {
      repaired += '"'
    }

    // Remove trailing commas before closing brackets
    repaired = repaired.replace(/,\s*$/, '')
    repaired = repaired.replace(/,\s*([}\]])/g, '$1')

    // Close unmatched brackets/braces
    const opens = (repaired.match(/{/g) || []).length
    const closes = (repaired.match(/}/g) || []).length
    const openBrackets = (repaired.match(/\[/g) || []).length
    const closeBrackets = (repaired.match(/\]/g) || []).length
    for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']'
    for (let i = 0; i < opens - closes; i++) repaired += '}'

    try {
      return JSON.parse(repaired)
    } catch (e2) {
      console.error('[writing-api] JSON repair failed, raw:', raw.substring(0, 500))
      throw e2
    }
  }
}

// ===== PROMPTS =====

function grammarCheckPrompt(text: string): string {
  return `You are an expert English grammar teacher and writing coach. Analyze the following text for ALL types of writing issues.

TASK: Find and report every grammar, spelling, punctuation, style, and clarity issue in the text.

ISSUE CATEGORIES:
- "grammar": Subject-verb agreement, tense errors, article misuse, preposition errors, etc.
- "spelling": Misspelled words, wrong homophones (their/there/they're), etc.
- "punctuation": Missing/wrong commas, periods, semicolons, apostrophes, etc.
- "style": Wordiness, passive voice overuse, informal language in formal context, clichés, etc.
- "clarity": Ambiguous sentences, unclear references, run-on sentences, awkward phrasing, etc.

RULES:
- For each issue, provide the EXACT original text (character-for-character match from input)
- Provide the corrected replacement text
- Provide a short explanation in Vietnamese (for Vietnamese learners)
- Position: provide character start and end index (0-indexed) of the original text in the input
- Also provide the full corrected version of the entire text
- Quality score: 0-100 (100 = perfect, 0 = very poor)

TEXT TO ANALYZE:
"""
${text}
"""

Return JSON:
{
  "issues": [
    {
      "type": "grammar|spelling|punctuation|style|clarity",
      "original": "exact text with error",
      "replacement": "corrected text",
      "explanation_vi": "Giải thích ngắn gọn bằng tiếng Việt",
      "position": { "start": 0, "end": 10 }
    }
  ],
  "corrected_text": "full corrected version of the entire text",
  "quality_score": 85,
  "summary_vi": "Tóm tắt tổng quan về chất lượng viết bằng tiếng Việt (2-3 câu)"
}`
}

function plagiarismCheckPrompt(text: string, previousTexts: string[]): string {
  const prevContext = previousTexts.length > 0
    ? `\n\nPREVIOUS SUBMISSIONS BY THIS USER (for internal comparison):\n${previousTexts.map((t, i) => `--- Previous #${i + 1} ---\n${t.substring(0, 500)}\n`).join('\n')}`
    : ''

  return `You are an expert academic integrity analyst. Analyze the following text for potential plagiarism and originality issues.

TASK: Evaluate the text for signs of plagiarism, unoriginal content, and AI-generated patterns.

FLAG CATEGORIES:
- "likely_copied": Text that appears to be directly copied from common sources (textbooks, Wikipedia patterns, well-known articles)
- "needs_citation": Text containing facts, statistics, or specific claims that should have citations
- "paraphrased": Text that appears to be closely paraphrased from common sources (slight rewording of well-known content)
- "ai_generated": Text showing patterns typical of AI-generated content (repetitive structures, overly formal style, perfect but generic sentences)

ANALYSIS APPROACH:
1. Look for well-known phrases, definitions, or commonly copied passages
2. Check for academic writing that lacks original voice
3. Detect patterns common in AI-generated text
4. Compare with the user's previous submissions if available (check for self-plagiarism)
5. Evaluate overall writing originality
${prevContext}

RULES:
- Be fair: some common phrases are unavoidable (e.g. "on the other hand")
- Focus on substantial copied sections, not minor common phrases
- Provide originality score 0-100 (100 = fully original)
- For each flagged section, provide the exact text and position
- Provide Vietnamese explanation and rewrite suggestion for each flag

TEXT TO ANALYZE:
"""
${text}
"""

Return JSON:
{
  "originality_score": 85,
  "flags": [
    {
      "text": "exact flagged text passage",
      "type": "likely_copied|needs_citation|paraphrased|ai_generated",
      "confidence": 0.8,
      "suggestion_vi": "Gợi ý cách viết lại bằng tiếng Việt",
      "position": { "start": 0, "end": 50 }
    }
  ],
  "summary_vi": "Tóm tắt đánh giá tổng thể về tính nguyên gốc bằng tiếng Việt (2-3 câu)"
}`
}

function paraphrasePrompt(text: string, mode: string): string {
  const modeInstructions: Record<string, string> = {
    standard: 'Rewrite naturally while preserving meaning. Use different vocabulary and sentence structures.',
    formal: 'Rewrite in a formal, professional tone. Use sophisticated vocabulary and proper academic style.',
    simple: 'Rewrite using simple, easy-to-understand language. Use short sentences and common words. Target A2-B1 English level.',
    creative: 'Rewrite creatively with vivid language, varied sentence lengths, and engaging expressions.',
    academic: 'Rewrite in academic style with precise terminology, objective tone, and complex sentence structures suitable for research papers.',
    shorten: 'Rewrite more concisely while keeping all key information. Remove redundancy and wordiness.',
    expand: 'Expand the text with more details, examples, and explanations while keeping the original meaning.',
  }

  const instruction = modeInstructions[mode] || modeInstructions.standard

  return `You are an expert English writing assistant specializing in paraphrasing and rewriting text.

TASK: Paraphrase the following text.
MODE: ${mode}
INSTRUCTION: ${instruction}

RULES:
- Preserve the original meaning completely
- Use different vocabulary and sentence structures from the original
- The result should read naturally and fluently
- Provide a Vietnamese explanation of what changes were made
- Rate how different the paraphrase is from the original (0-100, 100 = completely different wording)

ORIGINAL TEXT:
"""
${text}
"""

Return JSON:
{
  "paraphrased_text": "the full paraphrased version",
  "changes_summary_vi": "Tóm tắt những thay đổi chính bằng tiếng Việt (2-3 câu)",
  "difference_score": 75,
  "word_count_original": 50,
  "word_count_paraphrased": 48
}`
}

// ===== LISTENING PRACTICE PROMPTS =====

function generateExercisePrompt(mode: string, exerciseType: string, level: string, topic: string): string {
  const levelDesc: Record<string, string> = {
    A1: 'Beginner. Use very simple words (1-2 syllables), present tense only, 3-6 word sentences.',
    A2: 'Elementary. Use common vocabulary, simple past/future, 5-10 word sentences.',
    B1: 'Intermediate. Use varied vocabulary, multiple tenses, compound sentences of 8-15 words.',
    B2: 'Upper-intermediate. Use advanced vocabulary, complex structures, 12-20 word sentences.',
    C1: 'Advanced. Use sophisticated vocabulary, nuanced expressions, academic/professional language.',
    C2: 'Proficiency. Use native-level complexity, idioms, subtle distinctions, complex arguments.',
  }

  if (mode === 'dictation') {
    const typeInstructions: Record<string, string> = {
      word: 'Generate a single English word appropriate for this level. Include the word and its Vietnamese meaning.',
      phrase: 'Generate a short phrase (2-4 words) appropriate for this level. Include the phrase and its Vietnamese meaning.',
      short_sentence: 'Generate a simple sentence (5-10 words) appropriate for this level.',
      complex_sentence: 'Generate a complex sentence (10-20 words) with subordinate clauses.',
      short_paragraph: 'Generate a short paragraph (2-3 sentences) appropriate for this level.',
      long_paragraph: 'Generate a paragraph (4-6 sentences) appropriate for this level.',
    }

    return `You are an English language teacher creating dictation exercises.

LEVEL: ${level} — ${levelDesc[level] || levelDesc.B1}
TOPIC: ${topic || 'General'}
TYPE: ${exerciseType}

TASK: ${typeInstructions[exerciseType] || typeInstructions.short_sentence}

RULES:
- Content must be natural, realistic English
- Match the difficulty level precisely
- Topic should relate to: ${topic || 'everyday situations'}
- Include Vietnamese translation
- For paragraphs, ensure logical flow between sentences

Return JSON:
{
  "text": "the English text to dictate",
  "translation_vi": "Bản dịch tiếng Việt",
  "word_count": 10,
  "difficulty_note_vi": "Ghi chú ngắn về độ khó bằng tiếng Việt",
  "key_vocabulary": [
    { "word": "example", "meaning_vi": "ví dụ", "phonetic": "/ɪɡˈzæmpəl/" }
  ]
}`
  }

  // Comprehension mode
  const typeInstructions: Record<string, string> = {
    fill_blank: `Generate a short passage (2-3 sentences) and create 3-5 fill-in-the-blank questions.
Remove key words from the text and ask the user to fill them in after listening.`,
    short_answer: `Generate a passage (3-4 sentences) and create 3 short-answer questions.
Questions should test comprehension of the main ideas.`,
    summary: `Generate a passage (4-6 sentences) and ask the user to write a summary in 2-3 sentences.
Provide a model summary for comparison.`,
    opinion: `Generate a topic/argument passage (4-6 sentences) presenting a viewpoint.
Ask the user to write their opinion response (3-5 sentences).`,
    essay: `Generate an academic/debate passage (6-8 sentences) presenting multiple viewpoints.
Ask the user to write a short analytical essay response (5-8 sentences).`,
  }

  return `You are an English language teacher creating listening comprehension and writing exercises.

LEVEL: ${level} — ${levelDesc[level] || levelDesc.B1}
TOPIC: ${topic || 'General'}
TYPE: ${exerciseType}

TASK: ${typeInstructions[exerciseType] || typeInstructions.short_answer}

RULES:
- Content must be natural, realistic English at the specified level
- Questions should genuinely test listening comprehension
- Include Vietnamese instructions for the user
- Provide a model/sample answer

Return JSON:
{
  "passage": "the English passage to listen to",
  "passage_translation_vi": "Bản dịch đoạn văn",
  "word_count": 50,
  "instruction_vi": "Hướng dẫn cho người dùng bằng tiếng Việt",
  "questions": [
    {
      "question": "What is the main idea?",
      "question_vi": "Ý chính là gì?",
      "type": "short_answer|fill_blank|open_ended",
      "blank_text": "The cat sat on the ___",
      "answer": "expected answer"
    }
  ],
  "sample_answer": "A model response for open-ended questions",
  "key_vocabulary": [
    { "word": "example", "meaning_vi": "ví dụ", "phonetic": "/ɪɡˈzæmpəl/" }
  ]
}`
}

function evaluateDictationPrompt(original: string, userAnswer: string): string {
  return `You are an English teacher evaluating a dictation exercise.

ORIGINAL TEXT (what was dictated):
"${original}"

STUDENT'S ANSWER:
"${userAnswer}"

TASK: Compare word-by-word and evaluate accuracy.

RULES:
- Compare each word, ignoring case differences
- Minor punctuation differences are acceptable (don't penalize missing periods/commas too harshly)
- Flag: correct words, misspelled words, missing words, extra words
- Provide corrections in Vietnamese
- Calculate accuracy as percentage of correct words

Return JSON:
{
  "accuracy": 85.5,
  "total_words": 20,
  "correct_words": 17,
  "word_comparison": [
    { "original": "the", "user": "the", "status": "correct" },
    { "original": "beautiful", "user": "beautful", "status": "misspelled", "note_vi": "Thiếu chữ 'i'" },
    { "original": "garden", "user": "", "status": "missing", "note_vi": "Thiếu từ 'garden' (vườn)" }
  ],
  "feedback_vi": "Nhận xét tổng thể bằng tiếng Việt",
  "score": 85
}`
}

function evaluateComprehensionPrompt(passage: string, questions: string, userAnswers: string): string {
  return `You are an English teacher evaluating a listening comprehension exercise.

ORIGINAL PASSAGE:
"${passage}"

QUESTIONS AND EXPECTED ANSWERS:
${questions}

STUDENT'S ANSWERS:
${userAnswers}

TASK: Evaluate each answer for accuracy, relevance, and language quality.

RULES:
- Check if answers demonstrate comprehension of the passage
- Evaluate grammar and vocabulary usage
- Be encouraging but honest
- Provide corrections and suggestions in Vietnamese
- Score 0-100 overall

Return JSON:
{
  "score": 75,
  "answers_evaluation": [
    {
      "question_index": 0,
      "is_correct": true,
      "score": 80,
      "feedback_vi": "Nhận xét bằng tiếng Việt",
      "corrected_answer": "Better version if needed"
    }
  ],
  "grammar_issues": [
    { "original": "error text", "correction": "corrected", "explanation_vi": "Giải thích" }
  ],
  "overall_feedback_vi": "Nhận xét tổng thể bằng tiếng Việt (2-3 câu)",
  "vocabulary_score": 70,
  "grammar_score": 80,
  "comprehension_score": 75
}`
}

// ===== ROUTE HANDLERS =====

async function handleCheckGrammar(req: Request, userId: string) {
  const { text } = await req.json()
  if (!text?.trim()) return errorResponse('Missing text field')
  if (text.length > 5000) return errorResponse('Text quá dài. Tối đa 5000 ký tự.', 400)

  const serviceClient = getServiceClient()

  // Rate limit check
  const rateLimit = await checkWritingRateLimit(serviceClient, userId, 'grammar')
  if (!rateLimit.allowed) {
    return errorResponse(
      `Bạn đã sử dụng hết ${rateLimit.maxChecks} lượt kiểm tra ngữ pháp hôm nay. Vui lòng quay lại ngày mai!`,
      429
    )
  }

  console.log(`[writing-api] Grammar check for user ${userId}: ${text.length} chars`)

  try {
    const prompt = grammarCheckPrompt(text)
    const raw = await callGemini(prompt, 16000)
    const parsed = extractJson(raw) as Record<string, unknown>

    // Save to DB
    await serviceClient.from('writing_checks').insert({
      user_id: userId,
      check_type: 'grammar',
      input_text: text,
      input_char_count: text.length,
      result: parsed,
      quality_score: (parsed.quality_score as number) || null,
    })

    console.log(`[writing-api] Grammar check complete: ${(parsed.issues as unknown[])?.length || 0} issues, score ${parsed.quality_score}`)

    return jsonResponse({
      ...parsed,
      usage: {
        checksToday: rateLimit.checksToday + 1,
        maxChecks: rateLimit.maxChecks,
        remainingChecks: rateLimit.maxChecks - rateLimit.checksToday - 1,
      },
    })
  } catch (err) {
    console.error('[writing-api] Grammar check error:', err)
    return errorResponse(`Grammar check failed: ${(err as Error).message}`, 500)
  }
}

async function handleCheckPlagiarism(req: Request, userId: string) {
  const { text } = await req.json()
  if (!text?.trim()) return errorResponse('Missing text field')
  if (text.length > 10000) return errorResponse('Text quá dài. Tối đa 10000 ký tự.', 400)

  const serviceClient = getServiceClient()

  // Rate limit check
  const rateLimit = await checkWritingRateLimit(serviceClient, userId, 'plagiarism')
  if (!rateLimit.allowed) {
    return errorResponse(
      `Bạn đã sử dụng hết ${rateLimit.maxChecks} lượt kiểm tra đạo văn hôm nay. Vui lòng quay lại ngày mai!`,
      429
    )
  }

  // Fetch recent submissions for internal comparison
  const { data: previousChecks } = await serviceClient
    .from('writing_checks')
    .select('input_text')
    .eq('user_id', userId)
    .eq('check_type', 'plagiarism')
    .order('created_at', { ascending: false })
    .limit(5)

  const previousTexts = (previousChecks || []).map((c: { input_text: string }) => c.input_text)

  console.log(`[writing-api] Plagiarism check for user ${userId}: ${text.length} chars, ${previousTexts.length} previous submissions`)

  try {
    const prompt = plagiarismCheckPrompt(text, previousTexts)
    const raw = await callGemini(prompt, 16000)
    const parsed = extractJson(raw) as Record<string, unknown>

    // Save to DB
    await serviceClient.from('writing_checks').insert({
      user_id: userId,
      check_type: 'plagiarism',
      input_text: text,
      input_char_count: text.length,
      result: parsed,
      quality_score: (parsed.originality_score as number) || null,
    })

    console.log(`[writing-api] Plagiarism check complete: ${(parsed.flags as unknown[])?.length || 0} flags, originality ${parsed.originality_score}`)

    return jsonResponse({
      ...parsed,
      usage: {
        checksToday: rateLimit.checksToday + 1,
        maxChecks: rateLimit.maxChecks,
        remainingChecks: rateLimit.maxChecks - rateLimit.checksToday - 1,
      },
    })
  } catch (err) {
    console.error('[writing-api] Plagiarism check error:', err)
    return errorResponse(`Plagiarism check failed: ${(err as Error).message}`, 500)
  }
}

async function handleParaphrase(req: Request, userId: string) {
  const { text, mode } = await req.json()
  if (!text?.trim()) return errorResponse('Missing text field')
  if (text.length > 5000) return errorResponse('Text quá dài. Tối đa 5000 ký tự.', 400)

  const paraphraseMode = mode || 'standard'
  const validModes = ['standard', 'formal', 'simple', 'creative', 'academic', 'shorten', 'expand']
  if (!validModes.includes(paraphraseMode)) {
    return errorResponse(`Invalid mode. Use: ${validModes.join(', ')}`, 400)
  }

  const serviceClient = getServiceClient()

  const rateLimit = await checkWritingRateLimit(serviceClient, userId, 'paraphrase')
  if (!rateLimit.allowed) {
    return errorResponse(
      `Bạn đã sử dụng hết ${rateLimit.maxChecks} lượt paraphrase hôm nay. Vui lòng quay lại ngày mai!`,
      429
    )
  }

  console.log(`[writing-api] Paraphrase (${paraphraseMode}) for user ${userId}: ${text.length} chars`)

  try {
    const prompt = paraphrasePrompt(text, paraphraseMode)
    const raw = await callGemini(prompt, 8192)
    const parsed = extractJson(raw) as Record<string, unknown>

    await serviceClient.from('writing_checks').insert({
      user_id: userId,
      check_type: 'paraphrase',
      input_text: text,
      input_char_count: text.length,
      result: { ...parsed, mode: paraphraseMode },
      quality_score: (parsed.difference_score as number) || null,
    })

    console.log(`[writing-api] Paraphrase complete: mode=${paraphraseMode}, diff=${parsed.difference_score}`)

    return jsonResponse({
      ...parsed,
      mode: paraphraseMode,
      usage: {
        checksToday: rateLimit.checksToday + 1,
        maxChecks: rateLimit.maxChecks,
        remainingChecks: rateLimit.maxChecks - rateLimit.checksToday - 1,
      },
    })
  } catch (err) {
    console.error('[writing-api] Paraphrase error:', err)
    return errorResponse(`Paraphrase failed: ${(err as Error).message}`, 500)
  }
}

// ===== LISTENING PRACTICE HANDLERS =====

async function checkListeningRateLimit(
  serviceClient: ReturnType<typeof createClient>,
  userId: string
): Promise<{ allowed: boolean; exercisesToday: number; maxExercises: number }> {
  const defaultMax = 20
  let maxExercises = defaultMax

  const { data: profile } = await serviceClient
    .from('user_profiles')
    .select('max_daily_listening_exercises')
    .eq('id', userId)
    .single()

  if (profile?.max_daily_listening_exercises) {
    maxExercises = profile.max_daily_listening_exercises
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { count, error } = await serviceClient
    .from('listening_exercises')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', todayStart.toISOString())

  if (error) {
    console.error('[writing-api] Listening rate limit error:', error)
    return { allowed: false, exercisesToday: maxExercises, maxExercises }
  }

  const exercisesToday = count || 0
  return { allowed: exercisesToday < maxExercises, exercisesToday, maxExercises }
}

// Concrete scenario pools to force unique content per variation
const SCENARIO_POOLS = {
  settings: [
    'at a hospital', 'in a supermarket', 'at the airport', 'in a school classroom',
    'at a restaurant', 'in a park', 'at a train station', 'in an office meeting',
    'at a hotel reception', 'at a pharmacy', 'in a library', 'at a gym',
    'at a beach resort', 'in a taxi', 'at a post office', 'in a cinema',
    'at a pet shop', 'in a bakery', 'at a car repair shop', 'at a museum',
    'at a bus stop', 'in a bookstore', 'at a birthday party', 'at a wedding',
    'in a hospital waiting room', 'at a bank', 'in a kitchen', 'at a zoo',
  ],
  characters: [
    'a nurse and patient', 'two college students', 'a boss and employee',
    'a tourist and local guide', 'a parent and teacher', 'two neighbors',
    'a shop owner and customer', 'a doctor and patient', 'two best friends',
    'a landlord and tenant', 'a police officer and citizen', 'a coach and athlete',
  ],
}

function buildVariationSeed(variationIndex: number | undefined, mode: string): string {
  if (!variationIndex || variationIndex <= 1) return ''

  // Use variation_index to pick a SPECIFIC scenario from the pool
  const settingIdx = (variationIndex * 7 + Date.now() % 100) % SCENARIO_POOLS.settings.length
  const charIdx = (variationIndex * 3 + Date.now() % 50) % SCENARIO_POOLS.characters.length
  const setting = SCENARIO_POOLS.settings[settingIdx]
  const chars = SCENARIO_POOLS.characters[charIdx]

  return `\n\nCRITICAL UNIQUENESS REQUIREMENT (Variation #${variationIndex}):
- Set this exercise specifically ${setting}
- Characters: ${chars}
- Do NOT reuse any sentences or vocabulary from other exercises in this batch
- Use a completely different narrative and word choices
- Random seed: ${Math.random().toString(36).substring(2, 10)}\n`
}

async function handleGenerateExercise(req: Request, userId: string) {
  const { mode, exercise_type, level, topic, variation_index } = await req.json()

  if (!mode || !exercise_type || !level) {
    return errorResponse('Missing required fields: mode, exercise_type, level')
  }

  const validModes = ['dictation', 'comprehension']
  const validLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

  if (!validModes.includes(mode)) return errorResponse(`Invalid mode. Use: ${validModes.join(', ')}`)
  if (!validLevels.includes(level)) return errorResponse(`Invalid level. Use: ${validLevels.join(', ')}`)

  const serviceClient = getServiceClient()
  const rateLimit = await checkListeningRateLimit(serviceClient, userId)
  if (!rateLimit.allowed) {
    return errorResponse(
      `Bạn đã sử dụng hết ${rateLimit.maxExercises} bài tập hôm nay. Vui lòng quay lại ngày mai!`,
      429
    )
  }

  console.log(`[writing-api] Generate exercise: ${mode}/${exercise_type}/${level} topic=${topic || 'general'}`)

  try {
    const seed = buildVariationSeed(variation_index, mode)
    const temp = variation_index > 1 ? 0.9 : 0.3
    const prompt = seed + generateExercisePrompt(mode, exercise_type, level, topic || '')
    const raw = await callGemini(prompt, 4096, temp)
    const content = extractJson(raw) as Record<string, unknown>

    console.log(`[writing-api] Exercise generated: ${mode}/${exercise_type}/${level}`)

    // Wrap in exercises[] format for batch compatibility
    return jsonResponse({
      exercises: [{ content, exercise_library_id: null, source: 'ai' }],
      usage: {
        exercisesToday: rateLimit.exercisesToday + 1,
        maxExercises: rateLimit.maxExercises,
        remaining: rateLimit.maxExercises - rateLimit.exercisesToday - 1,
      },
    })
  } catch (err) {
    console.error('[writing-api] Generate exercise error:', err)
    return errorResponse(`Generate exercise failed: ${(err as Error).message}`, 500)
  }
}

async function handleEvaluateExercise(req: Request, userId: string) {
  const { mode, exercise_type, level, topic, content, user_answer, playback_speed, replay_count } = await req.json()

  if (!mode || !content || !user_answer) {
    return errorResponse('Missing required fields: mode, content, user_answer')
  }

  const serviceClient = getServiceClient()
  console.log(`[writing-api] Evaluate: ${mode}/${exercise_type}/${level}`)

  try {
    let raw: string
    let parsed: Record<string, unknown>

    if (mode === 'dictation') {
      const originalText = (content as Record<string, string>).text || ''
      const prompt = evaluateDictationPrompt(originalText, user_answer)
      raw = await callGemini(prompt, 8192)
      parsed = extractJson(raw) as Record<string, unknown>
    } else {
      const passage = (content as Record<string, string>).passage || ''
      const questions = JSON.stringify((content as Record<string, unknown>).questions || [])
      const prompt = evaluateComprehensionPrompt(passage, questions, user_answer)
      raw = await callGemini(prompt, 8192)
      parsed = extractJson(raw) as Record<string, unknown>
    }

    const score = (parsed.score as number) || 0
    const accuracy = (parsed.accuracy as number) || null

    // Calculate XP
    let xpEarned = 0
    if (mode === 'dictation') {
      const acc = accuracy || 0
      if (acc >= 90) xpEarned = 15
      else if (acc >= 70) xpEarned = 10
      else xpEarned = 5
    } else {
      if (score >= 80) xpEarned = 20
      else if (score >= 60) xpEarned = 12
      else xpEarned = 8
    }

    // Reduce XP for excessive replays
    const replays = replay_count || 0
    if (replays > 1) xpEarned = Math.max(1, xpEarned - (replays - 1) * 2)

    // Save attempt to DB
    await serviceClient.from('listening_exercises').insert({
      user_id: userId,
      mode,
      exercise_type: exercise_type || 'unknown',
      level: level || 'B1',
      topic: topic || null,
      content,
      user_answer,
      result: parsed,
      score,
      accuracy,
      xp_earned: xpEarned,
      playback_speed: playback_speed || 1.0,
      replay_count: replays,
    })

    // Award XP
    if (xpEarned > 0) {
      await serviceClient.rpc('add_xp', { p_user_id: userId, p_xp: xpEarned })
    }

    console.log(`[writing-api] Evaluation complete: score=${score}, accuracy=${accuracy}, xp=${xpEarned}`)

    return jsonResponse({
      ...parsed,
      xp_earned: xpEarned,
    })
  } catch (err) {
    console.error('[writing-api] Evaluate exercise error:', err)
    return errorResponse(`Evaluate exercise failed: ${(err as Error).message}`, 500)
  }
}

async function handleListExercises(req: Request, userId: string) {
  const { mode, level, limit } = await req.json().catch(() => ({}))
  const serviceClient = getServiceClient()

  let query = serviceClient
    .from('listening_exercises')
    .select('id, mode, exercise_type, level, topic, content, score, accuracy, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit || 20)

  if (mode) query = query.eq('mode', mode)
  if (level) query = query.eq('level', level)

  const { data, error } = await query

  if (error) {
    console.error('[writing-api] List exercises error:', error)
    return errorResponse('Failed to fetch exercises', 500)
  }

  return jsonResponse({ exercises: data || [] })
}

async function handleDeleteExercise(req: Request, userId: string) {
  const { exercise_id } = await req.json()
  if (!exercise_id) return errorResponse('Missing exercise_id')

  const serviceClient = getServiceClient()

  // Verify ownership
  const { data: ex } = await serviceClient
    .from('listening_exercises')
    .select('id')
    .eq('id', exercise_id)
    .eq('user_id', userId)
    .single()

  if (!ex) return errorResponse('Exercise not found', 404)

  await serviceClient.from('listening_exercises').delete().eq('id', exercise_id)

  return jsonResponse({ deleted: true })
}

async function handleWritingStatus(_req: Request, userId: string) {
  const serviceClient = getServiceClient()

  const [grammarLimit, plagiarismLimit, paraphraseLimit, listeningLimit] = await Promise.all([
    checkWritingRateLimit(serviceClient, userId, 'grammar'),
    checkWritingRateLimit(serviceClient, userId, 'plagiarism'),
    checkWritingRateLimit(serviceClient, userId, 'paraphrase'),
    checkListeningRateLimit(serviceClient, userId),
  ])

  return jsonResponse({
    grammar: {
      checksToday: grammarLimit.checksToday,
      maxChecks: grammarLimit.maxChecks,
      remainingChecks: grammarLimit.maxChecks - grammarLimit.checksToday,
    },
    plagiarism: {
      checksToday: plagiarismLimit.checksToday,
      maxChecks: plagiarismLimit.maxChecks,
      remainingChecks: plagiarismLimit.maxChecks - plagiarismLimit.checksToday,
    },
    paraphrase: {
      checksToday: paraphraseLimit.checksToday,
      maxChecks: paraphraseLimit.maxChecks,
      remainingChecks: paraphraseLimit.maxChecks - paraphraseLimit.checksToday,
    },
    listening: {
      exercisesToday: listeningLimit.exercisesToday,
      maxExercises: listeningLimit.maxExercises,
      remaining: listeningLimit.maxExercises - listeningLimit.exercisesToday,
    },
  })
}

// ===== LISTENING: FILL-IN-THE-BLANKS =====

function fillBlankPrompt(level: string, blankType: string, topic: string): string {
  return `You are an English listening exercise generator creating fill-in-the-blank exercises for Vietnamese learners.

Create a passage with blanks for a ${level} CEFR level student.

Blank type focus: ${blankType}
Topic: ${topic || 'general daily conversation'}

RULES:
- Write a natural, coherent passage of 3-5 sentences
- Replace 4-6 key words with blanks marked as ___1___, ___2___, etc. in "passage"
- Also return "full_text" which is the COMPLETE passage with all words (no blanks) - this is used for text-to-speech
- Focus blanks on: ${blankType === 'verbs' ? 'verbs (different tenses)' : blankType === 'prepositions' ? 'prepositions' : blankType === 'vocabulary' ? 'new vocabulary words' : 'a mix of verbs, prepositions, and vocabulary'}
- Provide Vietnamese translation of full passage
- Provide hints in Vietnamese for each blank
- The "word_type" must be one of: "verb", "preposition", "noun", "adjective", "adverb"
- Key vocabulary with phonetic transcription

Return ONLY valid JSON with this exact structure:
{
  "passage": "Yesterday I ___1___ to the park and sat ___2___ a bench.",
  "full_text": "Yesterday I went to the park and sat on a bench.",
  "passage_translation_vi": "Hôm qua tôi đã đi đến công viên và ngồi trên ghế dài.",
  "blanks": [
    { "index": 1, "answer": "went", "hint_vi": "động từ quá khứ", "word_type": "verb" },
    { "index": 2, "answer": "on", "hint_vi": "giới từ chỉ vị trí", "word_type": "preposition" }
  ],
  "word_count": 12,
  "difficulty_note_vi": "Bài tập sử dụng thì quá khứ đơn và giới từ.",
  "key_vocabulary": [
    { "word": "bench", "meaning_vi": "ghế dài", "phonetic": "/bentʃ/" }
  ]
}`
}

async function handleGenerateFillBlank(req: Request, userId: string) {
  try {
    const { level, exercise_type, topic, variation_index } = await req.json()
    if (!level) return errorResponse('level is required')

    const seed = buildVariationSeed(variation_index, 'fill_blank')
    const temp = variation_index > 1 ? 0.9 : 0.3
    const prompt = fillBlankPrompt(level, exercise_type || 'mixed', topic || '') + seed
    const rawResponse = await callGemini(prompt, 8192, temp)
    const result = extractJson(rawResponse)

    return jsonResponse({
      exercises: [{ content: result, exercise_library_id: null, source: 'ai' }],
      usage: null,
    })
  } catch (err) {
    return errorResponse(`Fill-blank generation failed: ${(err as Error).message}`, 500)
  }
}

async function handleEvaluateFillBlank(req: Request, userId: string) {
  try {
    const { content, user_answer } = await req.json()
    if (!content || !user_answer) return errorResponse('content and user_answer required')

    const blanks = content.blanks || []
    const answers: Array<{
      blank_index: number; expected: string; user_answer: string;
      is_correct: boolean; feedback_vi: string;
    }> = []

    let correct = 0
    for (const blank of blanks) {
      const userAns = (user_answer[String(blank.index)] || '').trim().toLowerCase()
      const expected = blank.answer.trim().toLowerCase()
      const isCorrect = userAns === expected

      if (isCorrect) correct++

      answers.push({
        blank_index: blank.index,
        expected: blank.answer,
        user_answer: user_answer[String(blank.index)] || '',
        is_correct: isCorrect,
        feedback_vi: isCorrect ? 'Đúng!' : `Đáp án đúng là "${blank.answer}" (${blank.word_type})`,
      })
    }

    const score = blanks.length > 0 ? Math.round((correct / blanks.length) * 100) : 0
    const xp = Math.round(score / 10)

    return jsonResponse({
      score,
      total_blanks: blanks.length,
      correct_blanks: correct,
      answers,
      overall_feedback_vi: score >= 80
        ? 'Xuất sắc! Bạn đã nắm rất tốt.'
        : score >= 60
          ? 'Khá tốt! Cần luyện thêm một chút.'
          : 'Hãy nghe lại và chú ý từng từ nhé!',
      xp_earned: xp,
    })
  } catch (err) {
    return errorResponse(`Fill-blank evaluation failed: ${(err as Error).message}`, 500)
  }
}

// ===== LISTENING: DIALOGUE =====

function dialoguePrompt(level: string, dialogueType: string, topic: string): string {
  return `You are an English listening exercise generator creating dialogue comprehension exercises for Vietnamese learners.

Create a 2-person dialogue for a ${level} CEFR level student.

Dialogue type: ${dialogueType}
Topic: ${topic || 'daily conversation'}

RULES:
- Write a natural dialogue between 2 speakers (Speaker A and Speaker B)
- 6-10 lines of dialogue
- Create 3-4 comprehension questions (mix of multiple_choice and true_false)
- Include Vietnamese translations for scenario and questions
- Dialogue should feel realistic and contextually appropriate
- For ${level} level:
  ${level === 'A1' || level === 'A2' ? '- Use simple vocabulary and short sentences' : ''}
  ${level === 'B1' || level === 'B2' ? '- Use intermediate vocabulary with some idioms' : ''}
  ${level === 'C1' || level === 'C2' ? '- Include advanced vocabulary, nuance, and implied meaning' : ''}

Return ONLY valid JSON with this exact structure:
{
  "scenario": "Ordering coffee at a cafe",
  "scenario_vi": "Gọi cà phê tại quán",
  "speaker_a": "Barista",
  "speaker_b": "Customer",
  "dialogue": [
    { "speaker": "A", "text": "Hi there! What can I get for you today?" },
    { "speaker": "B", "text": "I'd like a large latte, please." },
    { "speaker": "A", "text": "Would you like any syrup with that?" },
    { "speaker": "B", "text": "Vanilla, please. And could I get it iced?" }
  ],
  "questions": [
    {
      "question": "What drink did the customer order?",
      "question_vi": "Khách hàng đã gọi đồ uống gì?",
      "type": "multiple_choice",
      "options": ["A cappuccino", "A large latte", "An espresso", "A mocha"],
      "answer": "A large latte",
      "explanation_vi": "Khách nói: I'd like a large latte"
    },
    {
      "question": "The customer wanted a hot drink.",
      "question_vi": "Khách hàng muốn đồ uống nóng.",
      "type": "true_false",
      "answer": "False",
      "explanation_vi": "Khách yêu cầu iced (\u0111á)"
    }
  ],
  "word_count": 35,
  "key_vocabulary": [
    { "word": "latte", "meaning_vi": "cà phê sữa", "phonetic": "/\u02c8l\u0251\u02d0te\u026a/" }
  ]
}`
}

async function handleGenerateDialogue(req: Request, userId: string) {
  try {
    const { level, exercise_type, topic, variation_index } = await req.json()
    if (!level) return errorResponse('level is required')

    const seed = buildVariationSeed(variation_index, 'dialogue')
    const temp = variation_index > 1 ? 0.9 : 0.3
    const prompt = dialoguePrompt(level, exercise_type || 'daily', topic || '') + seed
    const rawResponse = await callGemini(prompt, 8192, temp)
    const result = extractJson(rawResponse)

    return jsonResponse({
      exercises: [{ content: result, exercise_library_id: null, source: 'ai' }],
      usage: null,
    })
  } catch (err) {
    return errorResponse(`Dialogue generation failed: ${(err as Error).message}`, 500)
  }
}

async function handleEvaluateDialogue(req: Request, userId: string) {
  try {
    const { content, user_answer } = await req.json()
    if (!content || !user_answer) return errorResponse('content and user_answer required')

    const questions = content.questions || []
    const answers: Array<{
      question_index: number; is_correct: boolean; user_answer: string;
      correct_answer: string; feedback_vi: string;
    }> = []

    let correct = 0
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const userAns = (user_answer[String(i)] || '').trim()
      const correctAns = q.answer.trim()
      const isCorrect = userAns.toLowerCase() === correctAns.toLowerCase()

      if (isCorrect) correct++

      answers.push({
        question_index: i,
        is_correct: isCorrect,
        user_answer: userAns,
        correct_answer: correctAns,
        feedback_vi: isCorrect
          ? 'Đúng rồi!'
          : q.explanation_vi || `Đáp án đúng: ${correctAns}`,
      })
    }

    const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0
    const xp = Math.round(score / 10)

    return jsonResponse({
      score,
      answers,
      overall_feedback_vi: score >= 80
        ? 'Tuyệt vời! Bạn hiểu rất tốt đoạn hội thoại.'
        : score >= 60
          ? 'Khá tốt! Thử nghe lại những phần bạn chưa chắc.'
          : 'Hãy nghe lại và chú ý context của cuộc hội thoại nhé!',
      xp_earned: xp,
    })
  } catch (err) {
    return errorResponse(`Dialogue evaluation failed: ${(err as Error).message}`, 500)
  }
}

// ===== MAIN ROUTER =====
// ═══════════════════════════════════════════════════════════
// ═══════ SPEAKING MODULE ═══════════════════════════════════
// ═══════════════════════════════════════════════════════════

function pronunciationPrompt(level: string, topic: string): string {
  return `You are an English pronunciation exercise generator for Vietnamese learners.

Create a SINGLE sentence for pronunciation practice at ${level} CEFR level.
Topic: ${topic || 'daily conversation'}

RULES:
- Create ONE natural, conversational sentence (8-20 words depending on level)
- Include at least 2 sounds that are commonly difficult for Vietnamese speakers
  (e.g. /θ/, /ð/, /ʃ/, /ʒ/, /r/, /l/, final consonants, consonant clusters)
- Provide full IPA transcription
- List 2-4 key difficult sounds with Vietnamese pronunciation tips
- Vietnamese translation

Return ONLY valid JSON:
{
  "sentence": "I think the weather will be better this Thursday.",
  "sentence_vi": "Tôi nghĩ thời tiết sẽ tốt hơn vào thứ Năm này.",
  "phonetic_guide": "/aɪ θɪŋk ðə ˈwɛðər wɪl bi ˈbɛtər ðɪs ˈθɜːrzdeɪ/",
  "key_sounds": [
    { "sound": "th /θ/", "tip_vi": "Đặt đầu lưỡi giữa 2 hàm răng, thổi nhẹ", "ipa": "/θ/" },
    { "sound": "th /ð/", "tip_vi": "Giống /θ/ nhưng rung dây thanh", "ipa": "/ð/" }
  ],
  "difficulty_note_vi": "Câu này luyện âm 'th' - âm mà người Việt hay phát âm thành 'd' hoặc 't'."
}`
}

function shadowingPrompt(level: string, topic: string): string {
  return `You are an English shadowing exercise generator for Vietnamese learners.

Create a SINGLE sentence for shadowing practice at ${level} CEFR level.
Topic: ${topic || 'daily conversation'}

RULES:
- Create ONE natural sentence (10-25 words depending on level)
- Include natural stress and intonation patterns
- Mark stressed words in UPPERCASE in "stress_pattern"
- Provide estimated speaking speed in WPM
- Include 2-3 key pronunciation points
- Vietnamese translation

Return ONLY valid JSON:
{
  "sentence": "I'd like to order a large coffee with extra milk, please.",
  "sentence_vi": "Tôi muốn gọi một ly cà phê lớn với thêm sữa, làm ơn.",
  "stress_pattern": "I'd LIKE to ORDER a LARGE COFFEE with EXTRA MILK, please.",
  "speed_wpm": 130,
  "phonetic_guide": "/aɪd laɪk tuː ˈɔːrdər ə lɑːrdʒ ˈkɒfi wɪð ˈɛkstrə mɪlk pliːz/",
  "key_sounds": [
    { "sound": "'d like", "tip_vi": "Nối 'I would' thành 'I'd' - nói nhanh, nhẹ", "ipa": "/aɪd/" },
    { "sound": "extra /ks/", "tip_vi": "Cụm phụ âm /kstr/ - phát âm rõ k-s-t-r", "ipa": "/ˈɛkstrə/" }
  ],
  "difficulty_note_vi": "Luyện nối âm và nhấn trọng âm tự nhiên trong câu gọi đồ uống."
}`
}

function evaluatePronunciationPrompt(original: string, userText: string): string {
  return `You are an English pronunciation evaluator for Vietnamese learners.

Compare the user's spoken text (from speech-to-text) with the original sentence.

Original: "${original}"
User said: "${userText}"

RULES:
- Compare word by word
- Mark each word as correct or incorrect
- For incorrect words: provide IPA and a short Vietnamese tip
- Score 0-100 based on percentage of correct words
- Give encouraging feedback in Vietnamese
- If user_word is empty or missing, mark it as incorrect with the original word

Return ONLY valid JSON:
{
  "score": 75,
  "word_results": [
    { "word": "think", "user_word": "tink", "correct": false, "ipa": "/θɪŋk/", "tip_vi": "Đặt lưỡi giữa răng cho âm 'th'" },
    { "word": "the", "user_word": "the", "correct": true }
  ],
  "overall_feedback_vi": "Khá tốt! Chú ý âm 'th' nhé - đặt lưỡi ra giữa 2 hàm răng.",
  "xp_earned": 8
}`
}

function evaluateShadowingPrompt(original: string, userText: string): string {
  return `You are an English shadowing evaluator for Vietnamese learners.

Compare the user's spoken text with the original sentence. Evaluate both accuracy AND fluency.

Original: "${original}"
User said: "${userText}"

RULES:
- accuracy_score: % of words correctly spoken (0-100)
- fluency_score: estimate based on word order, completeness, naturalness (0-100)
  - Words skipped or repeated = lower fluency
  - Extra filler words ("um", "uh") = lower fluency
  - Complete and natural = high fluency
- overall_score: weighted average (accuracy 60% + fluency 40%)
- Compare word by word for accuracy
- Give fluency feedback in Vietnamese

Return ONLY valid JSON:
{
  "accuracy_score": 80,
  "fluency_score": 70,
  "overall_score": 76,
  "word_results": [
    { "word": "order", "user_word": "order", "correct": true },
    { "word": "large", "user_word": "lard", "correct": false }
  ],
  "fluency_feedback_vi": "Bạn nói khá trôi chảy nhưng hơi ngập ngừng ở giữa câu.",
  "overall_feedback_vi": "Tốt lắm! Thử nói nhanh hơn một chút để tự nhiên hơn.",
  "xp_earned": 10
}`
}
// ─── Reading Prompts ──────────────────────────────────

function readingArticlePrompt(level: string, topic: string): string {
  const wordTargets: Record<string, string> = {
    'A1': '100-150 words. Use only simple present tense, short sentences (5-8 words), basic vocabulary.',
    'A2': '150-250 words. Use present and past tense, compound sentences, everyday vocabulary.',
    'B1': '250-400 words. Use multiple tenses, complex sentences, introduce some advanced vocabulary.',
    'B2': '400-550 words. Use varied sentence structures, nuanced vocabulary, abstract topics.',
    'C1': '500-700 words. Use academic language, subtle arguments, sophisticated vocabulary.',
    'C2': '600-800 words. Use native-level complexity, idiomatic expressions, nuanced discussion.',
  }

  return `You are an English reading comprehension content creator for Vietnamese learners.

TASK: Create an engaging article/story at CEFR level ${level} about "${topic || 'a random interesting topic'}".

REQUIREMENTS:
- Length: ${wordTargets[level] || '200-400 words'}
- Level-appropriate vocabulary and grammar
- Naturally interesting and educational content
- Include a clear title

ALSO GENERATE:
1. 4-5 comprehension questions (multiple choice, 4 options A/B/C/D)
   - Question types: main_idea, detail, inference, vocabulary_in_context
   - Each question must have exactly one correct answer
   - Provide explanation in Vietnamese for each answer

2. 15-25 vocabulary words from the article that learners might not know
   - Include IPA pronunciation, part of speech, Vietnamese meaning, example sentence
   - Focus on words appropriate for ${level} level learners

Return JSON:
{
  "title": "Article Title",
  "content": "Full article text here...",
  "word_count": 350,
  "questions": [
    {
      "question": "What is the main idea of the article?",
      "type": "main_idea",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correct_answer": "B",
      "explanation_vi": "Đáp án B vì..."
    }
  ],
  "vocabulary": [
    {
      "word": "ubiquitous",
      "meaning_vi": "có mặt ở khắp nơi, phổ biến",
      "ipa": "/juːˈbɪkwɪtəs/",
      "part_of_speech": "adj",
      "example": "Smartphones are ubiquitous in modern life."
    }
  ]
}`
}

function evaluateReadingPrompt(questions: unknown[], userAnswers: Record<string, string>): string {
  return `You are an English reading comprehension evaluator for Vietnamese learners.

QUESTIONS AND CORRECT ANSWERS:
${JSON.stringify(questions, null, 2)}

USER'S ANSWERS:
${JSON.stringify(userAnswers, null, 2)}

TASK: Evaluate each answer. For each question:
- Check if user's answer matches correct_answer
- Provide feedback in Vietnamese

Return JSON:
{
  "score": 80,
  "total_questions": 5,
  "correct_count": 4,
  "results": [
    {
      "question_index": 0,
      "user_answer": "B",
      "correct_answer": "B",
      "is_correct": true,
      "explanation_vi": "Đúng! Đáp án B vì..."
    }
  ],
  "overall_feedback_vi": "Bạn làm rất tốt! ...",
  "xp_earned": 15
}`
}

function lookupWordPrompt(word: string, context: string): string {
  return `You are an English dictionary for Vietnamese learners.

WORD: "${word}"
CONTEXT (sentence where the word appears): "${context}"

Provide:
- Vietnamese meaning (considering the context)
- IPA pronunciation
- Part of speech
- An example sentence

Return JSON:
{
  "word": "${word}",
  "meaning_vi": "nghĩa tiếng Việt",
  "ipa": "/..../",
  "part_of_speech": "noun/verb/adj/adv/...",
  "example": "Example sentence using the word."
}`
}

function readingAloudPrompt(level: string, topic: string): string {
  const wordTargets: Record<string, string> = {
    'A1': '40-60 words',
    'A2': '60-100 words',
    'B1': '100-150 words',
    'B2': '150-200 words',
    'C1': '180-250 words',
    'C2': '200-300 words',
  }

  return `You are an English reading content creator for Vietnamese learners.

TASK: Create a short passage at CEFR level ${level} about "${topic || 'daily life'}" for reading aloud practice.

REQUIREMENTS:
- Length: ${wordTargets[level] || '100-150 words'}
- Natural, flowing text suitable for reading aloud
- Good rhythm and variety of sentence lengths
- Avoid overly complex words that would trip up readers

Return JSON:
{
  "title": "Passage Title",
  "content": "Full passage text here...",
  "word_count": 120,
  "estimated_wpm": 130,
  "difficulty_note_vi": "Lưu ý khi đọc..."
}`
}

// ─── Reading Handlers ─────────────────────────────────

async function handleGenerateReading(req: Request, _userId: string) {
  try {
    const { level, topic, variation_index, mode } = await req.json()
    if (!level) return errorResponse('level is required')

    const seed = buildVariationSeed(variation_index, 'reading')
    const temp = variation_index > 1 ? 0.9 : 0.3

    if (mode === 'reading_aloud') {
      const prompt = readingAloudPrompt(level, topic || '') + seed
      const rawResponse = await callGemini(prompt, 4096, temp)
      const result = extractJson(rawResponse)
      return jsonResponse({
        exercises: [{ content: result, exercise_library_id: null, source: 'ai' }],
        usage: null,
      })
    }

    // Default: level_reading (article + questions + vocabulary)
    const prompt = readingArticlePrompt(level, topic || '') + seed
    const rawResponse = await callGemini(prompt, 16000, temp)
    const result = extractJson(rawResponse)

    return jsonResponse({
      exercises: [{ content: result, exercise_library_id: null, source: 'ai' }],
      usage: null,
    })
  } catch (err) {
    return errorResponse(`Reading generation failed: ${(err as Error).message}`, 500)
  }
}

async function handleEvaluateReading(req: Request, _userId: string) {
  try {
    const { questions, user_answers } = await req.json()
    if (!questions || !user_answers) {
      return errorResponse('questions and user_answers are required')
    }

    // Server-side scoring (no AI needed for MCQ)
    let correctCount = 0
    const results = (questions as Array<{correct_answer: string; explanation_vi: string; question: string}>).map((q, i) => {
      const userAnswer = user_answers[String(i)] || ''
      const isCorrect = userAnswer.toUpperCase() === q.correct_answer.toUpperCase()
      if (isCorrect) correctCount++
      return {
        question_index: i,
        user_answer: userAnswer,
        correct_answer: q.correct_answer,
        is_correct: isCorrect,
        explanation_vi: q.explanation_vi || '',
      }
    })

    const totalQuestions = questions.length
    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
    const xpEarned = Math.round(score / 10) + (score >= 80 ? 5 : 0)

    return jsonResponse({
      score,
      total_questions: totalQuestions,
      correct_count: correctCount,
      results,
      overall_feedback_vi: score >= 80 ? 'Xuất sắc! Bạn hiểu bài đọc rất tốt.' :
                           score >= 60 ? 'Khá tốt! Tiếp tục luyện tập nhé.' :
                           'Cần cải thiện. Hãy đọc lại bài và thử lần nữa.',
      xp_earned: xpEarned,
    })
  } catch (err) {
    return errorResponse(`Reading evaluation failed: ${(err as Error).message}`, 500)
  }
}

async function handleLookupWord(req: Request, _userId: string) {
  try {
    const { word, context } = await req.json()
    if (!word) return errorResponse('word is required')

    const cleanWord = word.toLowerCase().trim()
    const serviceClient = getServiceClient()

    // 1) Check vocabulary_cache first
    const { data: cached } = await serviceClient
      .from('vocabulary_cache')
      .select('word, meaning_vi, ipa, part_of_speech, example')
      .eq('word', cleanWord)
      .maybeSingle()

    if (cached) {
      console.log(`[writing-api] Vocabulary cache HIT: "${cleanWord}"`)
      return jsonResponse(cached)
    }

    // 2) Cache MISS → call AI
    console.log(`[writing-api] Vocabulary cache MISS: "${cleanWord}", calling AI...`)
    const prompt = lookupWordPrompt(cleanWord, context || '')
    const rawResponse = await callGemini(prompt, 1024)
    const result = extractJson(rawResponse) as {
      word: string; meaning_vi: string; ipa: string; part_of_speech: string; example: string
    }

    // 3) Save to cache (fire-and-forget, don't block response)
    serviceClient
      .from('vocabulary_cache')
      .upsert({
        word: cleanWord,
        meaning_vi: result.meaning_vi || '',
        ipa: result.ipa || '',
        part_of_speech: result.part_of_speech || '',
        example: result.example || '',
        context: (context || '').substring(0, 500),
      }, { onConflict: 'word' })
      .then(({ error }) => {
        if (error) console.error(`[writing-api] Cache save error:`, error.message)
        else console.log(`[writing-api] Cached: "${cleanWord}"`)
      })

    return jsonResponse(result)
  } catch (err) {
    return errorResponse(`Word lookup failed: ${(err as Error).message}`, 500)
  }
}

async function handleEvaluateReadingAloud(req: Request, _userId: string) {
  try {
    const { original_text, user_transcript, duration_sec } = await req.json()
    if (!original_text || !user_transcript) {
      return errorResponse('original_text and user_transcript are required')
    }

    // Word-by-word comparison
    const originalWords = original_text.toLowerCase().replace(/[^\w\s']/g, '').split(/\s+/).filter(Boolean)
    const userWords = user_transcript.toLowerCase().replace(/[^\w\s']/g, '').split(/\s+/).filter(Boolean)

    let matchedCount = 0
    let userIdx = 0
    const wordResults = originalWords.map((word: string) => {
      // Try to find the word in user's transcript (allowing some offset)
      let found = false
      for (let i = userIdx; i < Math.min(userIdx + 3, userWords.length); i++) {
        if (userWords[i] === word || levenshteinDistance(userWords[i], word) <= 1) {
          found = true
          userIdx = i + 1
          matchedCount++
          break
        }
      }
      return { word, matched: found }
    })

    const accuracy = originalWords.length > 0 ? Math.round((matchedCount / originalWords.length) * 100) : 0
    const wpm = duration_sec > 0 ? Math.round((userWords.length / duration_sec) * 60) : 0
    const xpEarned = Math.round(accuracy / 10) + (wpm >= 100 ? 3 : 0)

    return jsonResponse({
      accuracy,
      wpm,
      total_words: originalWords.length,
      matched_words: matchedCount,
      missed_words: originalWords.length - matchedCount,
      word_results: wordResults,
      xp_earned: xpEarned,
      feedback_vi: accuracy >= 90 ? 'Tuyệt vời! Bạn đọc rất chính xác và trôi chảy.' :
                   accuracy >= 70 ? 'Khá tốt! Cố gắng đọc rõ ràng hơn những từ bị thiếu.' :
                   'Hãy luyện tập thêm. Thử đọc chậm hơn và rõ ràng hơn.',
    })
  } catch (err) {
    return errorResponse(`Reading aloud evaluation failed: ${(err as Error).message}`, 500)
  }
}

// Simple Levenshtein distance for fuzzy word matching
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= a.length; i++) matrix[i] = [i]
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  return matrix[a.length][b.length]
}

// ═════════════════════════════════════════════════════
// ═══ WRITING PRACTICE ENDPOINTS ══════════════════════
// ═════════════════════════════════════════════════════

function sentenceBuildingPrompt(level: string, topic: string, count: number, variationIdx: number): string {
  const seed = buildVariationSeed(variationIdx)
  return `You are an English teacher creating sentence building exercises.
Level: ${level} (CEFR). Topic: ${topic}. ${seed}

Generate EXACTLY ${count} sentence(s). For each sentence:
1. Write a correct, natural English sentence appropriate for ${level} level
2. Split into individual words
3. Create a shuffled (random) order of those words
4. Add 1-2 distractor words that DON'T belong (for B1+, skip for A1-A2)

Return JSON:
{
  "exercises": [
    {
      "correct_sentence": "I like to go to school",
      "words_shuffled": ["school", "to", "like", "go", "I", "to"],
      "distractors": [],
      "grammar_hint_vi": "Cấu trúc: S + V + to-infinitive",
      "translation_vi": "Tôi thích đi học"
    }
  ]
}

IMPORTANT: Each sentence must be unique. Use varied grammar structures.
For A1-A2: 4-8 words, simple structures, NO distractors. B1-B2: 8-15 words, compound/complex, 1 distractor. C1+: 12-20 words, 2 distractors.
Return ONLY valid JSON.`
}

function paraphraseExercisePrompt(level: string, topic: string, count: number, variationIdx: number): string {
  const seed = buildVariationSeed(variationIdx)
  return `You are an English teacher creating paraphrase exercises.
Level: ${level} (CEFR). Topic: ${topic}. ${seed}

Generate EXACTLY ${count} sentence(s) for paraphrasing practice. For each:
1. Write an original sentence
2. Provide a hint about what style to use
3. Provide 2-3 example rewrites

Return JSON:
{
  "exercises": [
    {
      "original": "The weather is very hot today",
      "hint_vi": "Dùng từ vựng nâng cao hơn",
      "hint_style": "formal",
      "example_rewrites": [
        "It is absolutely boiling today",
        "Today temperatures are extremely high"
      ],
      "key_structures": ["adjective intensifiers", "it pattern"]
    }
  ]
}

For A1-A2: simple sentences, basic paraphrasing. B1+: complex structures, varied vocabulary.
Return ONLY valid JSON.`
}

function evaluateParaphrasePrompt(original: string, userRewrite: string): string {
  return `You are evaluating a student paraphrase attempt.

Original sentence: "${original}"
Student rewrite: "${userRewrite}"

Evaluate on 3 criteria (0-100 each):
1. meaning_score: Does the rewrite preserve the original meaning?
2. naturalness_score: Does it sound natural?
3. level_upgrade_score: Is the vocabulary/grammar more advanced?

Return JSON:
{
  "meaning_score": 85,
  "naturalness_score": 90,
  "level_upgrade_score": 70,
  "overall_score": 82,
  "is_correct": true,
  "feedback_vi": "Câu viết lại giữ nguyên nghĩa và tự nhiên.",
  "corrections": [],
  "better_alternatives": ["alternative 1", "alternative 2"],
  "xp_earned": 12
}

xp_earned: 15 if all scores >= 80, 10 if meaning >= 70, 5 otherwise.
Return ONLY valid JSON.`
}

function essayPromptGenerate(level: string, topic: string, essayType: string, variationIdx: number): string {
  const seed = buildVariationSeed(variationIdx)
  const typeMap: Record<string, string> = {
    email: 'a short email (80-150 words)',
    paragraph: 'a paragraph (100-200 words)',
    essay: 'a short essay (150-300 words)',
  }
  const typeDesc = typeMap[essayType] || typeMap['paragraph']
  return `You are an English teacher creating a writing prompt.
Level: ${level} (CEFR). Topic: ${topic}. Type: ${essayType}. ${seed}

Generate a writing prompt for the student to write ${typeDesc}.

Return JSON:
{
  "prompt_en": "Write an email to your teacher explaining why you were absent yesterday",
  "prompt_vi": "Viết một email cho giáo viên giải thích vì sao bạn vắng mặt hôm qua",
  "essay_type": "${essayType}",
  "word_limit_min": 80,
  "word_limit_max": 150,
  "hints_vi": ["Mở đầu: Chào hỏi", "Thân bài: Giải thích", "Kết: Cảm ơn"],
  "useful_phrases": ["I am writing to inform you that...", "I sincerely apologize for..."]
}

Return ONLY valid JSON.`
}

function evaluateEssayPrompt(promptText: string, userEssay: string, level: string): string {
  return `You are an IELTS-trained English writing evaluator.

Writing prompt: "${promptText}"
Student level: ${level} (CEFR)
Student essay:
"""
${userEssay}
"""

Evaluate on 4 criteria (0-100 each):
1. task_response: Did the student address the prompt? Appropriate length?
2. grammar_score: Grammar accuracy, sentence variety
3. vocabulary_score: Range, accuracy, appropriateness
4. coherence_score: Organization, logical flow, linking words

Return JSON:
{
  "task_response": 75,
  "grammar_score": 70,
  "vocabulary_score": 65,
  "coherence_score": 80,
  "overall_score": 73,
  "band_estimate": "B1",
  "feedback_vi": "Bài viết trả lời đúng yêu cầu đề bài.",
  "corrections": [
    {"original": "I go yesterday", "corrected": "I went yesterday", "type": "grammar", "explanation_vi": "Dùng quá khứ đơn"}
  ],
  "better_vocab": [
    {"original_word": "good", "better_word": "excellent", "context": "The food was good", "explanation_vi": "excellent mạnh hơn good"}
  ],
  "structure_feedback_vi": "Cấu trúc bài viết rõ ràng.",
  "xp_earned": 20,
  "word_count": 120
}

xp_earned: 25 if overall >= 80, 20 if >= 60, 10 if >= 40, 5 otherwise.
Return ONLY valid JSON.`
}

async function handleGenerateSentenceBuilding(req: Request, _userId: string) {
  try {
    const { level = 'A2', topic = 'General', count = 3, variation_index = 0 } = await req.json()
    const prompt = sentenceBuildingPrompt(level, topic, Math.min(count, 10), variation_index)
    const raw = await callGemini(prompt, 4096)
    const result = extractJson(raw)
    return jsonResponse(result)
  } catch (err) {
    return errorResponse(`Sentence building generation failed: ${(err as Error).message}`, 500)
  }
}

async function handleEvaluateSentence(req: Request, _userId: string) {
  try {
    const { correct_sentence, user_answer } = await req.json()
    if (!correct_sentence || !user_answer) return errorResponse('correct_sentence and user_answer are required')
    const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()
    const isCorrect = normalize(correct_sentence) === normalize(user_answer)
    return jsonResponse({
      is_correct: isCorrect,
      correct_sentence,
      user_answer,
      xp_earned: isCorrect ? 8 : 0,
      feedback_vi: isCorrect ? 'Chính xác! Bạn đã sắp xếp đúng câu.' : `Chưa đúng. Câu đúng là: "${correct_sentence}"`,
    })
  } catch (err) {
    return errorResponse(`Sentence evaluation failed: ${(err as Error).message}`, 500)
  }
}

async function handleGenerateParaphraseExercise(req: Request, _userId: string) {
  try {
    const { level = 'B1', topic = 'General', count = 3, variation_index = 0 } = await req.json()
    const prompt = paraphraseExercisePrompt(level, topic, Math.min(count, 5), variation_index)
    const raw = await callGemini(prompt, 4096)
    const result = extractJson(raw)
    return jsonResponse(result)
  } catch (err) {
    return errorResponse(`Paraphrase exercise generation failed: ${(err as Error).message}`, 500)
  }
}

async function handleEvaluateParaphrase(req: Request, _userId: string) {
  try {
    const { original, user_rewrite } = await req.json()
    if (!original || !user_rewrite) return errorResponse('original and user_rewrite are required')
    const prompt = evaluateParaphrasePrompt(original, user_rewrite)
    const raw = await callGemini(prompt, 2048)
    const result = extractJson(raw)
    return jsonResponse(result)
  } catch (err) {
    return errorResponse(`Paraphrase evaluation failed: ${(err as Error).message}`, 500)
  }
}

async function handleGenerateEssayPrompt(req: Request, _userId: string) {
  try {
    const { level = 'B1', topic = 'General', essay_type = 'paragraph', variation_index = 0 } = await req.json()
    const prompt = essayPromptGenerate(level, topic, essay_type, variation_index)
    const raw = await callGemini(prompt, 2048)
    const result = extractJson(raw)
    return jsonResponse(result)
  } catch (err) {
    return errorResponse(`Essay prompt generation failed: ${(err as Error).message}`, 500)
  }
}

async function handleEvaluateEssay(req: Request, _userId: string) {
  try {
    const { prompt_text, user_essay, level = 'B1' } = await req.json()
    if (!prompt_text || !user_essay) return errorResponse('prompt_text and user_essay are required')
    const prompt = evaluateEssayPrompt(prompt_text, user_essay, level)
    const raw = await callGemini(prompt, 4096)
    const result = extractJson(raw)
    return jsonResponse(result)
  } catch (err) {
    return errorResponse(`Essay evaluation failed: ${(err as Error).message}`, 500)
  }
}

async function handleGeneratePronunciation(req: Request, _userId: string) {
  try {
    const { level, topic, variation_index } = await req.json()
    if (!level) return errorResponse('level is required')

    const seed = buildVariationSeed(variation_index, 'pronunciation')
    const temp = variation_index > 1 ? 0.9 : 0.3
    const prompt = pronunciationPrompt(level, topic || '') + seed
    const rawResponse = await callGemini(prompt, 4096, temp)
    const result = extractJson(rawResponse)

    return jsonResponse({
      exercises: [{ content: result, exercise_library_id: null, source: 'ai' }],
      usage: null,
    })
  } catch (err) {
    return errorResponse(`Pronunciation generation failed: ${(err as Error).message}`, 500)
  }
}

async function handleEvaluatePronunciation(req: Request, _userId: string) {
  try {
    const { original_text, user_transcript } = await req.json()
    if (!original_text || !user_transcript) {
      return errorResponse('original_text and user_transcript are required')
    }

    const prompt = evaluatePronunciationPrompt(original_text, user_transcript)
    const rawResponse = await callGemini(prompt, 4096)
    const result = extractJson(rawResponse)

    return jsonResponse(result)
  } catch (err) {
    return errorResponse(`Pronunciation evaluation failed: ${(err as Error).message}`, 500)
  }
}

async function handleGenerateShadowing(req: Request, _userId: string) {
  try {
    const { level, topic, variation_index } = await req.json()
    if (!level) return errorResponse('level is required')

    const seed = buildVariationSeed(variation_index, 'shadowing')
    const temp = variation_index > 1 ? 0.9 : 0.3
    const prompt = shadowingPrompt(level, topic || '') + seed
    const rawResponse = await callGemini(prompt, 4096, temp)
    const result = extractJson(rawResponse)

    return jsonResponse({
      exercises: [{ content: result, exercise_library_id: null, source: 'ai' }],
      usage: null,
    })
  } catch (err) {
    return errorResponse(`Shadowing generation failed: ${(err as Error).message}`, 500)
  }
}

async function handleEvaluateShadowing(req: Request, _userId: string) {
  try {
    const { original_text, user_transcript } = await req.json()
    if (!original_text || !user_transcript) {
      return errorResponse('original_text and user_transcript are required')
    }

    const prompt = evaluateShadowingPrompt(original_text, user_transcript)
    const rawResponse = await callGemini(prompt, 4096)
    const result = extractJson(rawResponse)

    return jsonResponse(result)
  } catch (err) {
    return errorResponse(`Shadowing evaluation failed: ${(err as Error).message}`, 500)
  }
}

// ═══════════════════════════════════════════════════════════
// ═══════ MAIN ROUTER ══════════════════════════════════════
// ═══════════════════════════════════════════════════════════

Deno.serve(async (req: Request) => {
  try {
    console.log(`[writing-api] Incoming: ${req.method} ${req.url}`)

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    // Verify user (any logged-in user)
    const authResult = await verifyUser(req)
    if (authResult instanceof Response) return authResult
    const { userId } = authResult

    // Route determination
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const urlEndpoint = pathParts.length > 1 ? pathParts[pathParts.length - 1] : ''

    let endpoint = urlEndpoint
    let handlerReq = req

    if (!urlEndpoint || urlEndpoint === 'writing-api') {
      try {
        const body = await req.json()
        endpoint = body._endpoint || ''
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

    console.log(`[writing-api] POST /${endpoint}`)

    switch (endpoint) {
      case 'check-grammar':
        return await handleCheckGrammar(handlerReq, userId)
      case 'check-plagiarism':
        return await handleCheckPlagiarism(handlerReq, userId)
      case 'paraphrase':
        return await handleParaphrase(handlerReq, userId)
      case 'generate-exercise':
        return await handleGenerateExercise(handlerReq, userId)
      case 'evaluate-exercise':
        return await handleEvaluateExercise(handlerReq, userId)
      case 'list-exercises':
        return await handleListExercises(handlerReq, userId)
      case 'delete-exercise':
        return await handleDeleteExercise(handlerReq, userId)
      case 'writing-status':
        return await handleWritingStatus(handlerReq, userId)

      // ─── Listening: Fill-blank ───
      case 'generate-fill-blank':
        return await handleGenerateFillBlank(handlerReq, userId)
      case 'evaluate-fill-blank':
        return await handleEvaluateFillBlank(handlerReq, userId)

      // ─── Listening: Dialogue ───
      case 'generate-dialogue':
        return await handleGenerateDialogue(handlerReq, userId)
      case 'evaluate-dialogue':
        return await handleEvaluateDialogue(handlerReq, userId)

      // ─── Speaking: Pronunciation ───
      case 'generate-pronunciation':
        return await handleGeneratePronunciation(handlerReq, userId)
      case 'evaluate-pronunciation':
        return await handleEvaluatePronunciation(handlerReq, userId)

      // ─── Speaking: Shadowing ───
      case 'generate-shadowing':
        return await handleGenerateShadowing(handlerReq, userId)
      case 'evaluate-shadowing':
        return await handleEvaluateShadowing(handlerReq, userId)

      // ─── Reading ───
      case 'generate-reading':
        return await handleGenerateReading(handlerReq, userId)
      case 'evaluate-reading':
        return await handleEvaluateReading(handlerReq, userId)
      case 'lookup-word':
        return await handleLookupWord(handlerReq, userId)
      case 'evaluate-reading-aloud':
        return await handleEvaluateReadingAloud(handlerReq, userId)

      // ─── Writing Practice ───
      case 'generate-sentence-building':
        return await handleGenerateSentenceBuilding(handlerReq, userId)
      case 'evaluate-sentence':
        return await handleEvaluateSentence(handlerReq, userId)
      case 'generate-paraphrase-exercise':
        return await handleGenerateParaphraseExercise(handlerReq, userId)
      case 'evaluate-paraphrase':
        return await handleEvaluateParaphrase(handlerReq, userId)
      case 'generate-essay-prompt':
        return await handleGenerateEssayPrompt(handlerReq, userId)
      case 'evaluate-essay':
        return await handleEvaluateEssay(handlerReq, userId)

      default:
        return errorResponse(`Unknown endpoint: ${endpoint}`, 404)
    }
  } catch (err) {
    console.error('[writing-api] Unhandled error:', err)
    // Always return CORS headers even on crash
    return new Response(JSON.stringify({ error: `Server error: ${(err as Error).message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
