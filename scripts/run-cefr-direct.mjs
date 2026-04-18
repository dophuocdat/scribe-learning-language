// Direct token runner v2 — per-course enrichment 
const URL = 'https://euvxtwyiimeeiawtkztv.supabase.co/functions/v1/generate-cefr-content'
const TOKEN = process.env.ADMIN_TOKEN
if (!TOKEN) { console.error('Set ADMIN_TOKEN!'); process.exit(1) }

const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` }

async function call(body) {
  const res = await fetch(URL, { method: 'POST', headers, body: JSON.stringify(body) })
  return await res.json()
}

async function main() {
  const mode = process.argv[2] || 'list'

  if (mode === 'list') {
    console.log('📋 Listing courses needing enrichment...')
    const r = await call({ mode: 'list' })
    console.log(`Found ${r.total} courses:`)
    for (const c of r.courses_to_enrich || []) {
      console.log(`  ${c.level} | ${c.title} | ${c.lessons}L ${c.questions}Q (ratio: ${c.ratio})`)
    }
    // Output IDs for piping
    console.log('\n--- Course IDs ---')
    for (const c of r.courses_to_enrich || []) console.log(c.id)
    return
  }

  if (mode === 'enrich-all') {
    console.log('📋 Getting course list...')
    const list = await call({ mode: 'list' })
    const courses = list.courses_to_enrich || []
    console.log(`Found ${courses.length} courses to enrich\n`)

    let totalInserted = 0
    for (let i = 0; i < courses.length; i++) {
      const c = courses[i]
      console.log(`\n[${i+1}/${courses.length}] ${c.level} | ${c.title}`)
      const r = await call({ mode: 'enrich', course_id: c.id })
      if (r.error) { console.error(`  ❌ ${r.error}`); continue }
      console.log(`  ✅ +${r.questions_inserted} questions (${r.processed_lessons} lessons)`)
      if (r.errors) console.log(`  ⚠️ Errors: ${r.errors.join(', ')}`)
      totalInserted += r.questions_inserted || 0
      
      // Wait between courses to avoid rate limit
      if (i < courses.length - 1) {
        console.log('  ⏳ Waiting 10s...')
        await new Promise(r => setTimeout(r, 10000))
      }
    }
    console.log(`\n🎉 Total inserted: ${totalInserted} questions`)
    return
  }

  if (mode === 'enrich') {
    const courseId = process.argv[3]
    if (!courseId) { console.error('Usage: node script.mjs enrich <course_id>'); return }
    const r = await call({ mode: 'enrich', course_id: courseId })
    console.log(JSON.stringify(r, null, 2))
    return
  }

  if (mode === 'create') {
    console.log('🆕 Creating 3 new courses...')
    const r = await call({ mode: 'create' })
    console.log(JSON.stringify(r, null, 2))
    return
  }
}

main().catch(console.error)
