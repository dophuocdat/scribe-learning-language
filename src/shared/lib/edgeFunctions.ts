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
