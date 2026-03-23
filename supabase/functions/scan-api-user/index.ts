// supabase/functions/scan-api-user/index.ts
// Google Vision OCR + Gemini AI for regular authenticated users
// Rate limited: max 2 scans/day, content hash dedup

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
  console.error(`[scan-api-user] ERROR: ${message}`)
  return jsonResponse({ error: message }, status)
}

// ===== AUTH: any logged-in user (NOT admin-only) =====
async function verifyUser(req: Request): Promise<{ userId: string; client: ReturnType<typeof createClient> } | Response> {
  const authHeader = req.headers.get('Authorization')
  console.log(`[scan-api-user] Auth header present: ${!!authHeader}, starts with Bearer: ${authHeader?.startsWith('Bearer ')}`)

  if (!authHeader) return errorResponse('Missing authorization header', 401)

  if (!authHeader.startsWith('Bearer ')) {
    return errorResponse('Invalid Authorization format', 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error } = await userClient.auth.getUser()
  if (error) {
    console.error(`[scan-api-user] Auth error: ${error.message}`)
    return errorResponse(`Authentication failed: ${error.message}`, 401)
  }
  if (!user) return errorResponse('Invalid token - no user', 401)

  console.log(`[scan-api-user] User verified: ${user.email} (${user.id})`)
  return { userId: user.id, client: userClient }
}

// Service client for DB operations (bypasses RLS where needed)
function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

// ===== RATE LIMIT CHECK =====
async function checkRateLimit(serviceClient: ReturnType<typeof createClient>, userId: string): Promise<{ allowed: boolean; scansToday: number; maxScans: number }> {
  // Read per-user scan limit from user_profiles (admin can customize)
  let maxScans = 2
  const { data: profile } = await serviceClient
    .from('user_profiles')
    .select('max_daily_scans')
    .eq('id', userId)
    .single()

  if (profile?.max_daily_scans) {
    maxScans = profile.max_daily_scans
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { count, error } = await serviceClient
    .from('user_scan_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', todayStart.toISOString())

  if (error) {
    console.error('[scan-api-user] Rate limit check error:', error)
    return { allowed: false, scansToday: maxScans, maxScans }
  }

  const scansToday = count || 0
  return { allowed: scansToday < maxScans, scansToday, maxScans }
}

// ===== SHA-256 HASH =====
async function sha256(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ===== GOOGLE VISION API =====
async function callVisionAPI(imageContent: { content?: string; source?: { imageUri: string } }): Promise<string> {
  const apiKey = Deno.env.get('GOOGLE_VISION_API_KEY')
  if (!apiKey) throw new Error('GOOGLE_VISION_API_KEY not configured')

  console.log('[scan-api-user] Vision API key found, calling API...')

  const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`

  // Timeout 25s to prevent indefinite hang
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)

  try {
    const response = await fetch(visionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        requests: [{
          image: imageContent,
          features: [
            { type: 'DOCUMENT_TEXT_DETECTION' },
            { type: 'TEXT_DETECTION' },
          ],
        }],
      }),
    })

    console.log(`[scan-api-user] Vision API responded: ${response.status}`)

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Vision API returned ${response.status}: ${errText}`)
    }

    const result = await response.json()
    const annotations = result.responses?.[0]

    if (annotations?.error) {
      throw new Error(`Vision API error: ${annotations.error.message}`)
    }

    const fullText = annotations?.fullTextAnnotation?.text
    if (fullText) {
      console.log(`[scan-api-user] Extracted ${fullText.length} chars`)
      return fullText
    }

    const textAnnotations = annotations?.textAnnotations
    if (textAnnotations?.length > 0) {
      console.log(`[scan-api-user] Extracted ${textAnnotations[0].description.length} chars (fallback)`)
      return textAnnotations[0].description
    }

    console.log('[scan-api-user] No text found in image')
    return ''
  } finally {
    clearTimeout(timeout)
  }
}

// ===== GEMINI API =====
async function callGemini(prompt: string, maxTokens = 30000): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const model = 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
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

function formatContentPrompt(text: string, maxVocab: number = 10, maxExercises: number = 8): string {
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
- title: A short descriptive title for this lesson (max 8 words, in English)
- vocabulary: up to ${maxVocab} important words from the text, sorted by difficulty. Include fewer if the text doesn't contain enough meaningful vocabulary.
- exercises: up to ${maxExercises} short exercises, must include all 6 types below. Include fewer if the content doesn't support that many exercises.

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
{"title":"Lesson Title","formatted_content":"📖 Topic Title | | 🎯 Tổng quan: Overview here | | 📌 Nội dung chính: | • Point 1 | • Point 2 | | 💬 Trích dẫn: | • Quote 1 | | 📝 Ngữ pháp: Pattern here","ai_summary":"...","detected_topics":["topic1"],"vocabulary":[{"word":"grow","ipa":"/ɡroʊ/","part_of_speech":"verb","meaning_vi":"mọc, phát triển","example_sentence":"Plants grow in the rainforest."}],"exercises":[{"type":"fill_blank","question":"Plants ___ (grow) in the forest.","options":null,"correct_answer":"grow","explanation":"Dùng thì hiện tại đơn vì diễn tả sự thật."},{"type":"multiple_choice","question":"'Preserve' means?","options":["Destroy","Protect","Build","Sell"],"correct_answer":"Protect","explanation":"Preserve = bảo tồn, giữ gìn."},{"type":"true_false","question":"'Melt' is a noun.","options":["True","False"],"correct_answer":"False","explanation":"Melt là động từ = tan chảy."}]}`
}

// Map exercise type to quiz_type
function mapExerciseType(type: string): string {
  const map: Record<string, string> = {
    fill_blank: 'fill_blank',
    word_guess: 'fill_blank',
    matching: 'matching',
    true_false: 'true_false',
    translation: 'fill_blank',
    multiple_choice: 'multiple_choice',
  }
  return map[type] || 'multiple_choice'
}

// ===== ROUTE HANDLERS =====

// 1. Scan image — OCR with rate limit + dedup
async function handleUserScanImage(req: Request, userId: string) {
  const body = await req.json()
  const folderId = body.folderId as string

  // Support both single image (legacy) and array of images
  let imageList: string[] = []
  if (body.imageBase64List && Array.isArray(body.imageBase64List)) {
    imageList = body.imageBase64List.slice(0, 3) // max 3
  } else if (body.imageBase64) {
    imageList = [body.imageBase64]
  }

  if (imageList.length === 0) return errorResponse('Missing imageBase64 or imageBase64List field')
  if (!folderId) return errorResponse('Missing folderId field')

  console.log(`[scan-api-user] ${imageList.length} image(s), total base64: ${imageList.reduce((s, i) => s + i.length, 0)} chars`)

  const serviceClient = getServiceClient()

  // Rate limit check
  console.log('[scan-api-user] Checking rate limit...')
  const rateLimit = await checkRateLimit(serviceClient, userId)
  console.log(`[scan-api-user] Rate limit: ${rateLimit.scansToday}/${rateLimit.maxScans}`)
  if (!rateLimit.allowed) {
    return errorResponse(
      `Bạn đã sử dụng hết ${rateLimit.maxScans} lượt scan hôm nay. Vui lòng quay lại ngày mai!`,
      429
    )
  }

  // Content hash (hash all images concatenated)
  console.log('[scan-api-user] Computing content hash...')
  const contentHash = await sha256(imageList.join('|'))
  console.log(`[scan-api-user] Hash computed: ${contentHash.substring(0, 16)}...`)

  const { data: existing } = await serviceClient
    .from('user_scan_logs')
    .select('id, course_id, scan_status')
    .eq('user_id', userId)
    .eq('content_hash', contentHash)
    .maybeSingle()

  if (existing) {
    return jsonResponse({
      duplicate: true,
      message: 'Tài liệu này đã được scan trước đó',
      scanLogId: existing.id,
      courseId: existing.course_id,
      status: existing.scan_status,
    })
  }

  console.log(`[scan-api-user] Scanning ${imageList.length} image(s) for user ${userId}, folder ${folderId}`)

  // Call Vision API for each image
  try {
    const textParts: string[] = []

    for (let i = 0; i < imageList.length; i++) {
      console.log(`[scan-api-user] Calling Vision API for image ${i + 1}/${imageList.length}...`)
      const pageText = await callVisionAPI({ content: imageList[i] })
      console.log(`[scan-api-user] Image ${i + 1} returned ${pageText.length} chars`)
      if (pageText.trim()) {
        textParts.push(pageText.trim())
      }
    }

    const fullText = textParts.join('\n\n--- Page ---\n\n')
    console.log(`[scan-api-user] Total OCR text: ${fullText.length} chars from ${textParts.length} pages`)

    if (!fullText.trim()) {
      return errorResponse('Không tìm thấy văn bản trong ảnh. Vui lòng thử lại với ảnh rõ hơn.', 422)
    }

    // Save scan log
    console.log('[scan-api-user] Saving scan log to DB...')
    const { data: scanLog, error: insertErr } = await serviceClient
      .from('user_scan_logs')
      .insert({
        user_id: userId,
        folder_id: folderId,
        content_hash: contentHash,
        extracted_text: fullText,
        scan_status: 'scanned',
      })
      .select()
      .single()

    if (insertErr) {
      console.error('[scan-api-user] DB insert error:', insertErr)
      if (insertErr.code === '23505') {
        return jsonResponse({
          duplicate: true,
          message: 'Tài liệu này đã được scan trước đó',
        })
      }
      throw insertErr
    }

    console.log(`[scan-api-user] Scan log saved: ${scanLog.id}`)
    const responseData = {
      text: fullText,
      charCount: fullText.length,
      scanLogId: scanLog.id,
      remainingScans: rateLimit.maxScans - rateLimit.scansToday - 1,
      pagesScanned: textParts.length,
    }
    console.log(`[scan-api-user] Returning response: charCount=${responseData.charCount}, pages=${responseData.pagesScanned}`)
    return jsonResponse(responseData)
  } catch (err) {
    console.error('[scan-api-user] Scan catch error:', (err as Error).message)
    return errorResponse(`Scan failed: ${(err as Error).message}`, 500)
  }
}

// 2. Check scan status / remaining scans
async function handleScanStatus(_req: Request, userId: string) {
  const serviceClient = getServiceClient()
  const rateLimit = await checkRateLimit(serviceClient, userId)

  return jsonResponse({
    scansToday: rateLimit.scansToday,
    maxScans: rateLimit.maxScans,
    remainingScans: rateLimit.maxScans - rateLimit.scansToday,
  })
}

// 3. Generate lesson from scanned text
async function handleGenerateLesson(req: Request, userId: string) {
  const { scanLogId } = await req.json()
  if (!scanLogId) return errorResponse('Missing scanLogId field')

  const serviceClient = getServiceClient()

  // Fetch scan log
  const { data: scanLog, error: fetchErr } = await serviceClient
    .from('user_scan_logs')
    .select('*')
    .eq('id', scanLogId)
    .eq('user_id', userId)
    .single()

  if (fetchErr || !scanLog) return errorResponse('Scan log not found', 404)

  if (scanLog.scan_status === 'completed' && scanLog.course_id) {
    return jsonResponse({
      message: 'Bài tập đã được tạo trước đó',
      courseId: scanLog.course_id,
    })
  }

  if (scanLog.scan_status === 'generating') {
    return jsonResponse({ message: 'AI đang tạo bài tập, vui lòng chờ...' }, 202)
  }

  // Read per-user generation limits
  let maxVocab = 10
  let maxExercises = 8
  const { data: profile } = await serviceClient
    .from('user_profiles')
    .select('max_vocab_per_scan, max_exercises_per_scan')
    .eq('id', userId)
    .single()

  if (profile) {
    maxVocab = profile.max_vocab_per_scan ?? 10
    maxExercises = profile.max_exercises_per_scan ?? 8
  }
  console.log(`[scan-api-user] Generation limits: vocab=${maxVocab}, exercises=${maxExercises}`)

  // Mark as generating
  await serviceClient
    .from('user_scan_logs')
    .update({ scan_status: 'generating' })
    .eq('id', scanLogId)

  try {
    console.log(`[scan-api-user] Generating lesson for scan ${scanLogId}`)

    // Call Gemini with per-user limits
    const prompt = formatContentPrompt(scanLog.extracted_text, maxVocab, maxExercises)
    const raw = await callGemini(prompt)
    const parsed = extractJson(raw) as Record<string, unknown>

    const title = (parsed.title as string) || 'Scanned Document'
    const formattedContent = (parsed.formatted_content as string) || ''
    const aiSummary = (parsed.ai_summary as string) || ''
    const vocabularyList = (parsed.vocabulary as Array<Record<string, unknown>>) || []
    const exercisesList = (parsed.exercises as Array<Record<string, unknown>>) || []

    // Create personal course
    const courseSlug = `scan-${scanLogId.substring(0, 8)}-${Date.now()}`
    const { data: course, error: courseErr } = await serviceClient
      .from('courses')
      .insert({
        title: `📸 ${title}`,
        slug: courseSlug,
        description: aiSummary,
        is_published: false,
        is_personal: true,
        created_by: userId,
        folder_id: scanLog.folder_id,
        source_type: 'scan',
      })
      .select()
      .single()

    if (courseErr) throw courseErr

    // Create lesson
    const { data: lesson, error: lessonErr } = await serviceClient
      .from('lessons')
      .insert({
        course_id: course.id,
        title,
        raw_content: scanLog.extracted_text,
        processed_content: formattedContent.replace(/ \| /g, '\n'),
        ai_summary: aiSummary,
        order_index: 0,
      })
      .select()
      .single()

    if (lessonErr) throw lessonErr

    // Create vocabulary
    if (vocabularyList.length > 0) {
      const vocabInserts = vocabularyList.map((v, i) => ({
        lesson_id: lesson.id,
        word: (v.word as string) || '',
        ipa_pronunciation: (v.ipa as string) || null,
        part_of_speech: (v.part_of_speech as string) || null,
        definition_vi: (v.meaning_vi as string) || null,
        example_sentence: (v.example_sentence as string) || null,
        difficulty_rank: i + 1,
      }))

      const { error: vocabErr } = await serviceClient
        .from('vocabulary')
        .insert(vocabInserts)

      if (vocabErr) console.error('[scan-api-user] Vocab insert error:', vocabErr)
    }

    // Create quiz + questions from exercises
    if (exercisesList.length > 0) {
      const { data: quiz, error: quizErr } = await serviceClient
        .from('quizzes')
        .insert({
          lesson_id: lesson.id,
          title: 'Bài tập từ tài liệu scan',
          quiz_type: 'multiple_choice',
          passing_score: 60,
          order_index: 0,
        })
        .select()
        .single()

      if (quizErr) throw quizErr

      const questionInserts = exercisesList.map((e, i) => ({
        quiz_id: quiz.id,
        question_text: (e.question as string) || '',
        question_type: mapExerciseType((e.type as string) || ''),
        options: (e.options as string[]) || null,
        correct_answer: (e.correct_answer as string) || '',
        explanation: (e.explanation as string) || null,
        order_index: i,
      }))

      const { error: qErr } = await serviceClient
        .from('quiz_questions')
        .insert(questionInserts)

      if (qErr) console.error('[scan-api-user] Questions insert error:', qErr)
    }

    // Update scan log
    await serviceClient
      .from('user_scan_logs')
      .update({ course_id: course.id, scan_status: 'completed' })
      .eq('id', scanLogId)

    console.log(`[scan-api-user] Lesson generated: course=${course.id}, lesson=${lesson.id}`)

    return jsonResponse({
      courseId: course.id,
      lessonId: lesson.id,
      title,
      vocabularyCount: vocabularyList.length,
      exercisesCount: exercisesList.length,
    })
  } catch (err) {
    console.error('[scan-api-user] Generate lesson error:', err)

    await serviceClient
      .from('user_scan_logs')
      .update({ scan_status: 'failed' })
      .eq('id', scanLogId)

    return errorResponse(`AI generation failed: ${(err as Error).message}`, 500)
  }
}

// ===== MAIN ROUTER =====
Deno.serve(async (req: Request) => {
  console.log(`[scan-api-user] Incoming: ${req.method} ${req.url}`)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  // Verify user (any logged-in user, NOT admin-only)
  const authResult = await verifyUser(req)
  if (authResult instanceof Response) return authResult
  const { userId } = authResult

  // Route determination
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const urlEndpoint = pathParts.length > 1 ? pathParts[pathParts.length - 1] : ''

  let endpoint = urlEndpoint
  let handlerReq = req

  if (!urlEndpoint || urlEndpoint === 'scan-api-user') {
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

  console.log(`[scan-api-user] POST /${endpoint}`)

  try {
    switch (endpoint) {
      case 'user-scan-image':
        return await handleUserScanImage(handlerReq, userId)
      case 'user-scan-status':
        return await handleScanStatus(handlerReq, userId)
      case 'user-generate-lesson':
        return await handleGenerateLesson(handlerReq, userId)
      default:
        return errorResponse(`Unknown endpoint: ${endpoint}. Use user-scan-image, user-scan-status, or user-generate-lesson`, 404)
    }
  } catch (err) {
    console.error('[scan-api-user] Unhandled error:', err)
    return errorResponse(`Server error: ${(err as Error).message}`, 500)
  }
})
