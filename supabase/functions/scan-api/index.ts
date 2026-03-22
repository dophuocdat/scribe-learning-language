// supabase/functions/scan-api/index.ts
// Google Vision API OCR — scan images/PDFs/documents to extract text

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
  console.error(`[scan-api] ERROR: ${message}`)
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
    console.log(`[scan-api] Pre-check blocked: ${preCheck.reason}`)
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

  console.log(`[scan-api] Admin verified: ${user.email}`)
  return { userId: user.id }
}

// Call Google Vision API
async function callVisionAPI(
  imageContent: { content?: string; source?: { imageUri: string } },
  features: { type: string; maxResults?: number }[]
): Promise<string> {
  const apiKey = Deno.env.get('GOOGLE_VISION_API_KEY')
  if (!apiKey) throw new Error('GOOGLE_VISION_API_KEY not configured')

  const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`

  const requestBody = {
    requests: [{
      image: imageContent,
      features,
    }],
  }

  console.log(`[scan-api] Calling Vision API with features: ${features.map(f => f.type).join(', ')}`)

  const response = await fetch(visionUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error(`[scan-api] Vision API error: ${errText}`)
    throw new Error(`Vision API returned ${response.status}: ${errText}`)
  }

  const result = await response.json()
  const annotations = result.responses?.[0]

  if (annotations?.error) {
    throw new Error(`Vision API error: ${annotations.error.message}`)
  }

  // Try fullTextAnnotation first (for DOCUMENT_TEXT_DETECTION), fallback to textAnnotations
  const fullText = annotations?.fullTextAnnotation?.text
  if (fullText) {
    console.log(`[scan-api] Extracted ${fullText.length} chars (fullTextAnnotation)`)
    return fullText
  }

  const textAnnotations = annotations?.textAnnotations
  if (textAnnotations && textAnnotations.length > 0) {
    const text = textAnnotations[0].description
    console.log(`[scan-api] Extracted ${text.length} chars (textAnnotations)`)
    return text
  }

  console.log('[scan-api] No text found in image')
  return ''
}

// ===== ROUTE HANDLERS =====

// Scan base64 image
async function handleScanImage(req: Request) {
  const { imageBase64, mimeType } = await req.json()

  if (!imageBase64) {
    return errorResponse('Missing imageBase64 field')
  }

  console.log(`[scan-api] Scanning image (${mimeType || 'image/*'}, ${Math.round(imageBase64.length / 1024)}KB base64)`)

  try {
    const text = await callVisionAPI(
      { content: imageBase64 },
      [
        { type: 'DOCUMENT_TEXT_DETECTION' },
        { type: 'TEXT_DETECTION' },
      ]
    )

    return jsonResponse({
      text: text.trim(),
      charCount: text.trim().length,
    })
  } catch (err) {
    return errorResponse(`Scan failed: ${(err as Error).message}`, 500)
  }
}

// Scan image from URL
async function handleScanUrl(req: Request) {
  const { imageUrl } = await req.json()

  if (!imageUrl) {
    return errorResponse('Missing imageUrl field')
  }

  console.log(`[scan-api] Scanning URL: ${imageUrl}`)

  try {
    const text = await callVisionAPI(
      { source: { imageUri: imageUrl } },
      [
        { type: 'DOCUMENT_TEXT_DETECTION' },
        { type: 'TEXT_DETECTION' },
      ]
    )

    return jsonResponse({
      text: text.trim(),
      charCount: text.trim().length,
    })
  } catch (err) {
    return errorResponse(`Scan failed: ${(err as Error).message}`, 500)
  }
}

// Fetch webpage content and extract text
async function handleFetchUrl(req: Request) {
  const { url: pageUrl } = await req.json()

  if (!pageUrl) {
    return errorResponse('Missing url field')
  }

  console.log(`[scan-api] Fetching webpage: ${pageUrl}`)

  try {
    const response = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      return errorResponse(`Failed to fetch URL: HTTP ${response.status}`, 502)
    }

    const html = await response.text()
    console.log(`[scan-api] Fetched ${html.length} chars of HTML`)

    // Strip HTML to plain text
    let text = html
      // Remove script and style blocks entirely
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      // Convert common block elements to newlines
      .replace(/<\/?(p|div|br|li|h[1-6]|tr|blockquote|section|article)[^>]*>/gi, '\n')
      // Remove all remaining tags
      .replace(/<[^>]+>/g, '')
      // Decode common HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&rdquo;/g, '"')
      .replace(/&ldquo;/g, '"')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&#\d+;/g, '')
      // Clean whitespace
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim()

    // Limit to ~8000 chars to keep AI prompt manageable
    if (text.length > 8000) {
      text = text.substring(0, 8000) + '\n\n[... content truncated ...]'
    }

    console.log(`[scan-api] Extracted ${text.length} chars of text from webpage`)

    return jsonResponse({
      text,
      charCount: text.length,
      sourceUrl: pageUrl,
    })
  } catch (err) {
    return errorResponse(`Fetch failed: ${(err as Error).message}`, 500)
  }
}

// ===== MAIN ROUTER =====
Deno.serve(async (req: Request) => {
  console.log(`[scan-api] Incoming: ${req.method} ${req.url}`)

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

  // If called via SDK, URL path is just /scan-api (no sub-path)
  // Read _endpoint from body and pass remaining payload to handler
  if (!urlEndpoint || urlEndpoint === 'scan-api') {
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

  console.log(`[scan-api] POST /${endpoint}`)

  try {
    switch (endpoint) {
      case 'scan-image':
        return await handleScanImage(handlerReq)
      case 'scan-url':
        return await handleScanUrl(handlerReq)
      case 'fetch-url':
        return await handleFetchUrl(handlerReq)
      default:
        return errorResponse(`Unknown endpoint: ${endpoint}. Use scan-image, scan-url, or fetch-url`, 404)
    }
  } catch (err) {
    console.error('[scan-api] Unhandled error:', err)
    return errorResponse(`Server error: ${(err as Error).message}`, 500)
  }
})
