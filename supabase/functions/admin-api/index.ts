// supabase/functions/admin-api/index.ts
// Central admin API Edge Function with REST-style routing

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function errorResponse(message: string, status = 400) {
  console.error(`[admin-api] ERROR: ${message}`)
  return jsonResponse({ error: message }, status)
}

// Create admin Supabase client with service_role key for bypassing RLS
function createAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

// Lightweight JWT pre-check: decode payload (no signature verify) to block
// garbage requests BEFORE calling the expensive auth.getUser().
// Cost: ~0ms, no DB/Auth server call.
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
    // Decode payload (base64url → JSON), NO signature verification
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, reason: 'Token expired' }
    }

    // Check required fields exist
    if (!payload.sub) {
      return { valid: false, reason: 'Missing sub claim' }
    }

    return { valid: true }
  } catch {
    return { valid: false, reason: 'Cannot decode JWT payload' }
  }
}

// Verify user is admin from their JWT
async function verifyAdmin(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization')

  // 1. Chặn ngay nếu không có header
  if (!authHeader) return errorResponse('Missing authorization header', 401)

  // 2. Pre-check nhẹ: decode payload, check format/exp (0ms, không tốn DB call)
  const preCheck = preCheckJwt(authHeader)
  if (!preCheck.valid) {
    console.log(`[admin-api] Pre-check blocked: ${preCheck.reason}`)
    return errorResponse(preCheck.reason, 401)
  }

  // 3. Gọi Auth server để verify chữ ký ES256 + lấy thông tin user
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) return errorResponse('Invalid token', 401)

  const role = user.app_metadata?.role
  if (role !== 'admin') return errorResponse('Admin access required', 403)

  console.log(`[admin-api] Admin verified: ${user.email}`)
  return { userId: user.id }
}

// ===== INPUT VALIDATION =====
// Whitelist allowed fields per resource to prevent arbitrary data insertion
function pick<T extends Record<string, unknown>>(obj: T, keys: string[]): Partial<T> {
  const result: Record<string, unknown> = {}
  for (const key of keys) {
    if (key in obj && obj[key] !== undefined) result[key] = obj[key]
  }
  return result as Partial<T>
}

const ALLOWED_FIELDS: Record<string, string[]> = {
  categories: ['name', 'slug', 'description', 'icon_url', 'order_index'],
  courses: ['parent_id', 'category_id', 'title', 'slug', 'description', 'cover_image_url', 'difficulty_level', 'source_type', 'source_url', 'is_published', 'is_personal', 'created_by', 'folder_id', 'order_index', 'estimated_time_minutes'],
  lessons: ['course_id', 'title', 'raw_content', 'processed_content', 'ai_summary', 'difficulty_level', 'order_index'],
  vocabulary: ['lesson_id', 'word', 'ipa_pronunciation', 'part_of_speech', 'definition_en', 'definition_vi', 'example_sentence', 'context_note', 'audio_url', 'difficulty_rank'],
  quizzes: ['lesson_id', 'title', 'quiz_type', 'time_limit_seconds', 'passing_score', 'order_index'],
  'quiz-questions': ['quiz_id', 'question_text', 'question_type', 'options', 'correct_answer', 'explanation', 'reference_position', 'order_index'],
  'difficulty-levels': ['code', 'label', 'description', 'color', 'order_index'],
}

function sanitizeBody(resource: string, body: Record<string, unknown>): Record<string, unknown> {
  const allowed = ALLOWED_FIELDS[resource]
  return allowed ? pick(body, allowed) : body
}

// ===== ROUTE HANDLERS =====

// --- Difficulty Levels ---
async function handleDifficultyLevels(req: Request, params: URLSearchParams) {
  const db = createAdminClient()
  const method = req.method
  const id = params.get('id')

  if (method === 'GET') {
    console.log('[admin-api] GET /difficulty-levels')
    const { data, error } = await db.from('difficulty_levels').select('*').order('order_index')
    if (error) return errorResponse(error.message)
    return jsonResponse(data)
  }

  if (method === 'POST') {
    const body = sanitizeBody('difficulty-levels', await req.json())
    console.log('[admin-api] POST /difficulty-levels', body)
    const { data, error } = await db.from('difficulty_levels').insert(body).select().single()
    if (error) return errorResponse(error.message)
    return jsonResponse(data, 201)
  }

  if (method === 'PUT' && id) {
    const body = sanitizeBody('difficulty-levels', await req.json())
    console.log(`[admin-api] PUT /difficulty-levels/${id}`, body)
    const { data, error } = await db.from('difficulty_levels').update(body).eq('id', id).select().single()
    if (error) return errorResponse(error.message)
    return jsonResponse(data)
  }

  if (method === 'DELETE' && id) {
    console.log(`[admin-api] DELETE /difficulty-levels/${id}`)
    const { error } = await db.from('difficulty_levels').delete().eq('id', id)
    if (error) return errorResponse(error.message)
    return jsonResponse({ success: true })
  }

  return errorResponse('Invalid method or missing id', 405)
}

async function handleStats(_req: Request, _params: URLSearchParams) {
  const db = createAdminClient()
  console.log('[admin-api] GET /stats')

  const [courses, lessons, vocabulary, users] = await Promise.all([
    db.from('courses').select('*', { count: 'exact', head: true }),
    db.from('lessons').select('*', { count: 'exact', head: true }),
    db.from('vocabulary').select('*', { count: 'exact', head: true }),
    db.from('user_profiles').select('*', { count: 'exact', head: true }),
  ])

  return jsonResponse({
    totalCourses: courses.count ?? 0,
    totalLessons: lessons.count ?? 0,
    totalVocabulary: vocabulary.count ?? 0,
    totalUsers: users.count ?? 0,
  })
}

// --- Categories ---
async function handleCategories(req: Request, params: URLSearchParams) {
  const db = createAdminClient()
  const method = req.method
  const id = params.get('id')

  if (method === 'GET') {
    console.log('[admin-api] GET /categories')
    const { data, error } = await db.from('categories').select('*').order('order_index')
    if (error) return errorResponse(error.message)
    return jsonResponse(data)
  }

  if (method === 'POST') {
    const body = sanitizeBody('categories', await req.json())
    console.log('[admin-api] POST /categories', body)
    const { data, error } = await db.from('categories').insert(body).select().single()
    if (error) return errorResponse(error.message)
    return jsonResponse(data, 201)
  }

  if (method === 'PUT' && id) {
    const body = sanitizeBody('categories', await req.json())
    console.log(`[admin-api] PUT /categories/${id}`, body)
    const { data, error } = await db.from('categories').update(body).eq('id', id).select().single()
    if (error) return errorResponse(error.message)
    return jsonResponse(data)
  }

  if (method === 'DELETE' && id) {
    console.log(`[admin-api] DELETE /categories/${id}`)
    const { error } = await db.from('categories').delete().eq('id', id)
    if (error) return errorResponse(error.message)
    return jsonResponse({ success: true })
  }

  return errorResponse('Invalid method or missing id', 405)
}

// --- Courses ---
async function handleCourses(req: Request, params: URLSearchParams) {
  const db = createAdminClient()
  const method = req.method
  const id = params.get('id')

  if (method === 'GET' && id) {
    console.log(`[admin-api] GET /courses/${id}`)
    const { data, error } = await db.from('courses').select('*').eq('id', id).single()
    if (error) return errorResponse(error.message)
    return jsonResponse(data)
  }

  if (method === 'GET') {
    console.log('[admin-api] GET /courses')
    const { data, error } = await db.from('courses')
      .select('*, categories(*)')
      .eq('is_personal', false)
      .order('created_at', { ascending: false })
    if (error) return errorResponse(error.message)

    // Single batch query for lesson counts (fixes N+1)
    const courseIds = (data ?? []).map((c: Record<string, unknown>) => c.id)
    const countMap: Record<string, number> = {}
    if (courseIds.length > 0) {
      const { data: lessonRows } = await db.from('lessons')
        .select('course_id')
        .in('course_id', courseIds)
      for (const row of (lessonRows || []) as { course_id: string }[]) {
        countMap[row.course_id] = (countMap[row.course_id] || 0) + 1
      }
    }
    const coursesWithCount = (data ?? []).map((course: Record<string, unknown>) => ({
      ...course,
      category: course.categories,
      lessons_count: countMap[course.id as string] || 0,
    }))
    return jsonResponse(coursesWithCount)
  }

  if (method === 'POST') {
    const body = sanitizeBody('courses', await req.json())
    console.log('[admin-api] POST /courses', body)
    const { data, error } = await db.from('courses').insert(body).select().single()
    if (error) return errorResponse(error.message)
    return jsonResponse(data, 201)
  }

  if (method === 'PUT' && id) {
    const body = sanitizeBody('courses', await req.json())
    console.log(`[admin-api] PUT /courses/${id}`, body)
    const { data, error } = await db.from('courses')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) return errorResponse(error.message)
    return jsonResponse(data)
  }

  if (method === 'DELETE' && id) {
    console.log(`[admin-api] DELETE /courses/${id}`)
    const { error } = await db.from('courses').delete().eq('id', id)
    if (error) return errorResponse(error.message)
    return jsonResponse({ success: true })
  }

  return errorResponse('Invalid method or missing id', 405)
}

// --- Lessons ---
async function handleLessons(req: Request, params: URLSearchParams) {
  const db = createAdminClient()
  const method = req.method
  const id = params.get('id')
  const courseId = params.get('courseId')

  if (method === 'GET' && id) {
    console.log(`[admin-api] GET /lessons/${id}`)
    const { data, error } = await db.from('lessons').select('*').eq('id', id).single()
    if (error) return errorResponse(error.message)
    return jsonResponse(data)
  }

  if (method === 'GET' && courseId) {
    console.log(`[admin-api] GET /lessons?courseId=${courseId}`)
    const { data, error } = await db.from('lessons')
      .select('*').eq('course_id', courseId).order('order_index')
    if (error) return errorResponse(error.message)
    return jsonResponse(data)
  }

  if (method === 'POST') {
    const body = sanitizeBody('lessons', await req.json())
    console.log('[admin-api] POST /lessons', body)
    const { data, error } = await db.from('lessons').insert(body).select().single()
    if (error) return errorResponse(error.message)
    return jsonResponse(data, 201)
  }

  if (method === 'PUT' && id) {
    const body = sanitizeBody('lessons', await req.json())
    console.log(`[admin-api] PUT /lessons/${id}`, body)
    const { data, error } = await db.from('lessons')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) return errorResponse(error.message)
    return jsonResponse(data)
  }

  if (method === 'DELETE' && id) {
    console.log(`[admin-api] DELETE /lessons/${id}`)
    const { error } = await db.from('lessons').delete().eq('id', id)
    if (error) return errorResponse(error.message)
    return jsonResponse({ success: true })
  }

  return errorResponse('Missing courseId or invalid method', 400)
}

// --- Vocabulary ---
async function handleVocabulary(req: Request, params: URLSearchParams) {
  const db = createAdminClient()
  const method = req.method
  const id = params.get('id')
  const lessonId = params.get('lessonId')

  if (method === 'GET' && lessonId) {
    console.log(`[admin-api] GET /vocabulary?lessonId=${lessonId}`)
    const { data, error } = await db.from('vocabulary')
      .select('*').eq('lesson_id', lessonId).order('created_at')
    if (error) return errorResponse(error.message)
    return jsonResponse(data)
  }

  if (method === 'POST') {
    const body = sanitizeBody('vocabulary', await req.json())
    console.log('[admin-api] POST /vocabulary', body)
    const { data, error } = await db.from('vocabulary').insert(body).select().single()
    if (error) return errorResponse(error.message)
    return jsonResponse(data, 201)
  }

  if (method === 'PUT' && id) {
    const body = sanitizeBody('vocabulary', await req.json())
    console.log(`[admin-api] PUT /vocabulary/${id}`, body)
    const { data, error } = await db.from('vocabulary').update(body).eq('id', id).select().single()
    if (error) return errorResponse(error.message)
    return jsonResponse(data)
  }

  if (method === 'DELETE' && id) {
    console.log(`[admin-api] DELETE /vocabulary/${id}`)
    const { error } = await db.from('vocabulary').delete().eq('id', id)
    if (error) return errorResponse(error.message)
    return jsonResponse({ success: true })
  }

  return errorResponse('Missing lessonId or invalid method', 400)
}

// --- Quizzes ---
async function handleQuizzes(req: Request, params: URLSearchParams) {
  const db = createAdminClient()
  const method = req.method
  const id = params.get('id')
  const lessonId = params.get('lessonId')

  if (method === 'GET' && lessonId) {
    console.log(`[admin-api] GET /quizzes?lessonId=${lessonId}`)
    const { data, error } = await db.from('quizzes')
      .select('*, quiz_questions(*)').eq('lesson_id', lessonId).order('order_index')
    if (error) return errorResponse(error.message)
    const mapped = (data ?? []).map((q: Record<string, unknown>) => ({
      ...q,
      questions: q.quiz_questions,
    }))
    return jsonResponse(mapped)
  }

  if (method === 'POST') {
    const body = sanitizeBody('quizzes', await req.json())
    console.log('[admin-api] POST /quizzes', body)
    const { data, error } = await db.from('quizzes').insert(body).select().single()
    if (error) return errorResponse(error.message)
    return jsonResponse(data, 201)
  }

  if (method === 'DELETE' && id) {
    console.log(`[admin-api] DELETE /quizzes/${id}`)
    const { error } = await db.from('quizzes').delete().eq('id', id)
    if (error) return errorResponse(error.message)
    return jsonResponse({ success: true })
  }

  return errorResponse('Missing lessonId or invalid method', 400)
}

// --- Quiz Questions ---
async function handleQuizQuestions(req: Request, params: URLSearchParams) {
  const db = createAdminClient()
  const method = req.method
  const id = params.get('id')

  if (method === 'POST') {
    const body = await req.json()
    console.log('[admin-api] POST /quiz-questions', body)
    const { data, error } = await db.from('quiz_questions').insert(body).select().single()
    if (error) return errorResponse(error.message)
    return jsonResponse(data, 201)
  }

  if (method === 'PUT' && id) {
    const body = await req.json()
    console.log(`[admin-api] PUT /quiz-questions/${id}`, body)
    const { data, error } = await db.from('quiz_questions').update(body).eq('id', id).select().single()
    if (error) return errorResponse(error.message)
    return jsonResponse(data)
  }

  if (method === 'DELETE' && id) {
    console.log(`[admin-api] DELETE /quiz-questions/${id}`)
    const { error } = await db.from('quiz_questions').delete().eq('id', id)
    if (error) return errorResponse(error.message)
    return jsonResponse({ success: true })
  }

  return errorResponse('Invalid method or missing id', 405)
}

// --- Batch Vocabulary ---
async function handleVocabularyBatch(req: Request) {
  const db = createAdminClient()
  const { items } = await req.json()

  if (!Array.isArray(items) || items.length === 0) {
    return errorResponse('Missing or empty items array')
  }

  console.log(`[admin-api] POST /vocabulary-batch: ${items.length} items`)
  const { data, error } = await db.from('vocabulary').insert(items).select()
  if (error) return errorResponse(error.message)
  return jsonResponse(data, 201)
}

// --- Batch Quiz Questions ---
async function handleQuizQuestionsBatch(req: Request) {
  const db = createAdminClient()
  const { items, lessonId } = await req.json()

  if (!Array.isArray(items) || items.length === 0) {
    return errorResponse('Missing or empty items array')
  }

  console.log(`[admin-api] POST /quiz-questions-batch: ${items.length} items`)

  // Ensure a quiz exists for the lesson
  let quizId = items[0]?.quiz_id
  if (!quizId && lessonId) {
    const { data: existing } = await db.from('quizzes')
      .select('id').eq('lesson_id', lessonId).limit(1).single()

    if (existing) {
      quizId = existing.id
    } else {
      const { data: newQuiz, error: qErr } = await db.from('quizzes').insert({
        lesson_id: lessonId,
        title: 'AI Generated Quiz',
        quiz_type: 'multiple_choice',
        passing_score: 70,
        order_index: 0,
      }).select().single()
      if (qErr) return errorResponse(qErr.message)
      quizId = newQuiz.id
    }
  }

  // Attach quiz_id to all items
  const withQuizId = items.map((item: Record<string, unknown>, i: number) => ({
    ...item,
    quiz_id: quizId,
    order_index: item.order_index ?? i,
  }))

  const { data, error } = await db.from('quiz_questions').insert(withQuizId).select()
  if (error) return errorResponse(error.message)
  return jsonResponse(data, 201)
}

// ===== MAIN ROUTER =====
Deno.serve(async (req: Request) => {
  console.log(`[admin-api] Incoming: ${req.method} ${req.url}`)

  // Handle CORS preflight — MUST be before any auth check
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Verify admin for all routes
  const authResult = await verifyAdmin(req)
  if (authResult instanceof Response) return authResult

  // --- Determine routing: SDK body-based OR legacy URL path ---
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const urlResource = pathParts.length > 1 ? pathParts[pathParts.length - 1] : ''

  let resource = urlResource
  let method = req.method
  let params = url.searchParams
  let handlerReq = req  // Request forwarded to handlers

  // If called via supabase.functions.invoke(), URL path is just /admin-api
  // Routing info (_resource, _method, _params) is in the JSON body
  if (!urlResource || urlResource === 'admin-api') {
    try {
      const body = await req.json()
      resource = body._resource || ''
      method = body._method || 'POST'

      // Convert _params to URLSearchParams
      if (body._params && typeof body._params === 'object') {
        params = new URLSearchParams()
        for (const [k, v] of Object.entries(body._params)) {
          if (v !== undefined && v !== null) params.set(k, String(v))
        }
      }

      // Strip routing fields, keep actual payload for handlers
      const { _resource: _, _method: __, _params: ___, ...payload } = body

      // Create a synthetic request with the real method + remaining body
      handlerReq = new Request(req.url, {
        method,
        headers: req.headers,
        body: Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined,
      })
    } catch {
      return errorResponse('Invalid JSON body', 400)
    }
  }

  console.log(`[admin-api] ${method} /${resource} params=${params.toString()}`)

  try {
    switch (resource) {
      case 'stats':
        return await handleStats(handlerReq, params)
      case 'categories':
        return await handleCategories(handlerReq, params)
      case 'courses':
        return await handleCourses(handlerReq, params)
      case 'lessons':
        return await handleLessons(handlerReq, params)
      case 'vocabulary':
        return await handleVocabulary(handlerReq, params)
      case 'vocabulary-batch':
        return await handleVocabularyBatch(handlerReq)
      case 'quizzes':
        return await handleQuizzes(handlerReq, params)
      case 'quiz-questions':
        return await handleQuizQuestions(handlerReq, params)
      case 'quiz-questions-batch':
        return await handleQuizQuestionsBatch(handlerReq)
      case 'difficulty-levels':
        return await handleDifficultyLevels(handlerReq, params)
      default:
        return errorResponse(`Unknown resource: ${resource}`, 404)
    }
  } catch (err) {
    console.error('[admin-api] Unhandled error:', err)
    return errorResponse(`Server error: ${(err as Error).message}`, 500)
  }
})
