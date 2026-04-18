// Shared helpers for invoking Supabase Edge Functions
//
// Uses the standard supabase.functions.invoke() pattern.
// The SDK's built-in fetchWithAuth() automatically sends:
//   - apikey: SUPABASE_ANON_KEY
//   - Authorization: Bearer <user_jwt> (from auth.getSession())
//
// NOTE: verify_jwt is disabled at the Gateway level because Supabase Auth
// issues ES256 JWTs while the Gateway expects HS256. Authentication is
// enforced INSIDE each Edge Function via auth.getUser() + admin role check.

import { supabase } from './supabase'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Generic Edge Function invoker — DRY helper used by all API callers.
 */
async function invokeEdgeFunction<T = any>(
  functionName: string,
  body: Record<string, any>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, { body })

    if (error) {
      let errMsg = error.message || 'Edge Function error'
      try {
        if (error.context && typeof error.context.json === 'function') {
          const errBody = await error.context.json()
          errMsg = errBody?.error || errMsg
        }
      } catch { /* ignore */ }
      console.error(`[${functionName}]:`, errMsg)
      return { data: null, error: errMsg }
    }

    return { data: data as T, error: null }
  } catch (err) {
    console.error(`[${functionName}]:`, err)
    return { data: null, error: (err as Error).message }
  }
}

/**
 * Invoke the admin-api Edge Function.
 */
export async function invokeAdminApi<T = any>(
  resource: string,
  method: string = 'GET',
  params?: Record<string, string>,
  body?: Record<string, any>
): Promise<{ data: T | null; error: string | null }> {
  return invokeEdgeFunction<T>('admin-api', {
    _resource: resource,
    _method: method,
    _params: params || {},
    ...body,
  })
}

/**
 * Invoke the scan-api Edge Function.
 */
export async function invokeScanApi<T = any>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<{ data: T | null; error: string | null }> {
  return invokeEdgeFunction<T>('scan-api', { _endpoint: endpoint, ...body })
}

/**
 * Invoke the ai-api Edge Function.
 */
export async function invokeAiApi<T = any>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<{ data: T | null; error: string | null }> {
  return invokeEdgeFunction<T>('ai-api', { _endpoint: endpoint, ...body })
}

/**
 * Invoke the scan-api-user Edge Function (regular users).
 */
export async function invokeScanApiUser<T = any>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<{ data: T | null; error: string | null }> {
  return invokeEdgeFunction<T>('scan-api-user', { _endpoint: endpoint, ...body })
}

/**
 * Invoke the writing-api Edge Function.
 * Uses a longer timeout (120s) since generate-lesson-skills may take 30+ seconds
 * with sequential AI calls and fallbacks.
 */
export async function invokeWritingApi<T = any>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<{ data: T | null; error: string | null }> {
  const TIMEOUT_MS = 120_000 // 2 minutes

  try {
    const { data: { session } } = await supabase.auth.getSession()
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/writing-api`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${session?.access_token || anonKey}`,
      },
      body: JSON.stringify({ _endpoint: endpoint, ...body }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}))
      const errMsg = errBody?.error || `HTTP ${response.status}`
      console.error('[writing-api]:', errMsg)
      return { data: null, error: errMsg }
    }

    const data = await response.json()
    return { data: data as T, error: null }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.error('[writing-api]: Request timed out after', TIMEOUT_MS / 1000, 's')
      return { data: null, error: 'Request timed out. Vui lòng thử lại hoặc giảm số lượng bài.' }
    }
    console.error('[writing-api]:', err)
    return { data: null, error: (err as Error).message }
  }
}
