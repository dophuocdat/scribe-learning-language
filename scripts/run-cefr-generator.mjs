// Script to invoke generate-cefr-content Edge Function
// Run: node scripts/run-cefr-generator.mjs

const SUPABASE_URL = 'https://euvxtwyiimeeiawtkztv.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1dnh0d3lpaW1lZWlhd3RrenR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MjYyNDQsImV4cCI6MjA4OTEwMjI0NH0.cdZZpAaFeABFcg7S4y6ujVGVVLrmD4HhpJ5ygTwum80'

// IMPORTANT: Replace with your admin JWT token
// Get it from browser: localStorage.getItem('sb-euvxtwyiimeeiawtkztv-auth-token')
// Or login via API below

const ADMIN_EMAIL = 'datdo775@gmail.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

async function getAdminToken() {
  if (!ADMIN_PASSWORD) {
    console.error('Set ADMIN_PASSWORD env variable first!')
    console.error('Usage: ADMIN_PASSWORD=yourpassword node scripts/run-cefr-generator.mjs')
    process.exit(1)
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })

  if (!res.ok) {
    console.error('Login failed:', await res.text())
    process.exit(1)
  }

  const data = await res.json()
  return data.access_token
}

async function invokeFunction(token, mode, batchIndex) {
  const body = { mode }
  if (batchIndex !== undefined) body.batch_index = batchIndex

  console.log(`\n🚀 Invoking: mode=${mode}${batchIndex !== undefined ? `, batch=${batchIndex}` : ''}`)
  console.log('⏳ Waiting for response (may take 1-2 minutes)...')

  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-cefr-content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  const result = await res.json()
  console.log(`✅ Status: ${res.status}`)
  console.log(JSON.stringify(result, null, 2))
  return result
}

async function main() {
  const token = await getAdminToken()
  console.log('🔑 Admin token obtained')

  const mode = process.argv[2] || 'enrich'
  const batchIndex = process.argv[3] !== undefined ? parseInt(process.argv[3]) : undefined

  if (mode === 'enrich-all') {
    // Run all 7 batches sequentially
    for (let i = 0; i <= 6; i++) {
      const result = await invokeFunction(token, 'enrich', i)
      if (result.error) {
        console.error(`❌ Batch ${i} failed:`, result.error)
        break
      }
      if (result.message?.includes('No more')) {
        console.log(`✅ All batches complete at batch ${i}`)
        break
      }
      console.log(`⏳ Waiting 5s before next batch...`)
      await new Promise(r => setTimeout(r, 5000))
    }
  } else {
    await invokeFunction(token, mode, batchIndex)
  }
}

main().catch(console.error)
