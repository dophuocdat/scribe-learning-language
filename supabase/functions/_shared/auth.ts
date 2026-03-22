// Shared auth utilities for Edge Functions
// Extracted from individual Edge Functions to avoid code duplication (Task 13)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Lightweight JWT pre-check: decode payload (no signature verify) to block
 * garbage requests BEFORE calling the expensive auth.getUser().
 * Cost: ~0ms, no DB/Auth server call.
 */
export function preCheckJwt(authHeader: string): { valid: false; reason: string } | { valid: true } {
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

/**
 * Verify user is admin from their JWT.
 * Uses lightweight pre-check first, then full auth.getUser() verification.
 */
export async function verifyAdmin(
  req: Request,
  errorResponse: (message: string, status?: number) => Response,
  tag: string = 'edge-fn'
): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization')

  if (!authHeader) return errorResponse('Missing authorization header', 401)

  const preCheck = preCheckJwt(authHeader)
  if (!preCheck.valid) {
    console.log(`[${tag}] Pre-check blocked: ${preCheck.reason}`)
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

  console.log(`[${tag}] Admin verified: ${user.email}`)
  return { userId: user.id }
}
