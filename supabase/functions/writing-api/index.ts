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

// ===== GEMINI API =====
async function callGemini(prompt: string, maxTokens = 8192): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const model = 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  console.log(`[writing-api] Calling Gemini (${model}), prompt length: ${prompt.length}`)

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
      },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini API returned ${response.status}: ${errText}`)
  }

  const result = await response.json()
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned empty response')

  console.log(`[writing-api] Gemini response length: ${text.length}`)
  return text
}

function extractJson(raw: string): unknown {
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/```\s*$/, '').trim()
  }
  try {
    return JSON.parse(cleaned)
  } catch {
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

async function handleGenerateExercise(req: Request, userId: string) {
  const { mode, exercise_type, level, topic } = await req.json()

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
    const prompt = generateExercisePrompt(mode, exercise_type, level, topic || '')
    const raw = await callGemini(prompt, 4096)
    const content = extractJson(raw) as Record<string, unknown>

    // Save to exercise_library for reuse
    const { data: saved, error: saveErr } = await serviceClient
      .from('exercise_library')
      .insert({
        user_id: userId,
        mode,
        exercise_type,
        level,
        topic: topic || null,
        content,
      })
      .select('id')
      .single()

    if (saveErr) {
      console.error('[writing-api] Failed to save exercise:', saveErr)
    }

    console.log(`[writing-api] Exercise generated & saved: ${mode}/${exercise_type}/${level} id=${saved?.id}`)

    return jsonResponse({
      content,
      exercise_library_id: saved?.id || null,
      mode,
      exercise_type,
      level,
      topic: topic || 'General',
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
  const { mode, exercise_type, level, topic, content, user_answer, playback_speed, replay_count, exercise_library_id } = await req.json()

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
      raw = await callGemini(prompt, 4096)
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
      exercise_library_id: exercise_library_id || null,
    })

    // Update exercise_library best scores
    if (exercise_library_id) {
      const { data: lib } = await serviceClient
        .from('exercise_library')
        .select('times_practiced, best_score, best_accuracy')
        .eq('id', exercise_library_id)
        .single()

      if (lib) {
        const updates: Record<string, unknown> = {
          times_practiced: (lib.times_practiced || 0) + 1,
        }
        if (score > (lib.best_score || 0)) updates.best_score = score
        if (accuracy !== null && accuracy > (lib.best_accuracy || 0)) updates.best_accuracy = accuracy

        await serviceClient
          .from('exercise_library')
          .update(updates)
          .eq('id', exercise_library_id)
      }
    }

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
    .from('exercise_library')
    .select('id, mode, exercise_type, level, topic, content, times_practiced, best_score, best_accuracy, created_at')
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
    .from('exercise_library')
    .select('id')
    .eq('id', exercise_id)
    .eq('user_id', userId)
    .single()

  if (!ex) return errorResponse('Exercise not found', 404)

  await serviceClient.from('exercise_library').delete().eq('id', exercise_id)

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

// ===== MAIN ROUTER =====
Deno.serve(async (req: Request) => {
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

  try {
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
      default:
        return errorResponse(`Unknown endpoint: ${endpoint}`, 404)
    }
  } catch (err) {
    console.error('[writing-api] Unhandled error:', err)
    return errorResponse(`Server error: ${(err as Error).message}`, 500)
  }
})
