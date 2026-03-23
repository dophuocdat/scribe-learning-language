// supabase/functions/tts/index.ts
// Lightweight TTS proxy — fetches audio from Google Translate TTS server-side
// and returns it to the client, bypassing CORS restrictions.
// No auth required (public endpoint, only serves small audio clips).

import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const url = new URL(req.url)
  const text = url.searchParams.get('text')
  const lang = url.searchParams.get('lang') || 'en'

  if (!text) {
    return new Response(JSON.stringify({ error: 'Missing ?text= parameter' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Limit text length to prevent abuse
  const safeText = text.slice(0, 200)

  try {
    const encoded = encodeURIComponent(safeText)
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encoded}`

    const response = await fetch(ttsUrl, {
      headers: {
        // Mimic a browser request to avoid 403
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/',
      },
    })

    if (!response.ok) {
      console.error(`[tts] Google TTS returned ${response.status}`)
      return new Response(JSON.stringify({ error: 'TTS service unavailable' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const audioBuffer = await response.arrayBuffer()

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400', // cache 24h
      },
    })
  } catch (err) {
    console.error('[tts] Error:', (err as Error).message)
    return new Response(JSON.stringify({ error: 'TTS failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
