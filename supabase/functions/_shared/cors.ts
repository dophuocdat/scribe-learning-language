// Shared CORS and response utilities for Edge Functions
// Extracted from individual Edge Functions to avoid code duplication (Task 13)

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*'

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function errorResponse(message: string, status = 400): Response {
  console.error(`[edge-fn] ERROR: ${message}`)
  return jsonResponse({ error: message }, status)
}
