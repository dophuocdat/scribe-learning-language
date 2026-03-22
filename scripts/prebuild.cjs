// scripts/prebuild.js
// Generates .env file from process.env for Cloudflare Pages builds
const fs = require('fs')

const pairs = Object.entries(process.env)
  .filter(([k]) => k.startsWith('VITE_'))

console.log('=== PREBUILD ENV DEBUG ===')
console.log('Found', pairs.length, 'VITE_ vars:')
pairs.forEach(([k, v]) => {
  console.log(' -', k, '=', v.substring(0, 15) + '...')
})

// Also check specifically for the two we need
console.log('VITE_SUPABASE_URL exists:', !!process.env.VITE_SUPABASE_URL)
console.log('VITE_SUPABASE_ANON_KEY exists:', !!process.env.VITE_SUPABASE_ANON_KEY)

if (pairs.length > 0) {
  const content = pairs.map(([k, v]) => k + '=' + v).join('\n')
  fs.writeFileSync('.env', content)
  console.log('Written .env with', pairs.length, 'vars')
} else {
  console.log('WARNING: No VITE_ vars found!')
}
console.log('=========================')
