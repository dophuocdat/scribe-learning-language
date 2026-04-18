import { readFileSync, writeFileSync } from 'fs'

const d = JSON.parse(readFileSync('scripts/quiz-data.json', 'utf8'))

// Group by quiz_id to set proper order_index
const groups = {}
d.forEach(q => {
  if (!groups[q.quiz_id]) groups[q.quiz_id] = []
  groups[q.quiz_id].push(q)
})

const vals = []
Object.entries(groups).forEach(([qid, qs]) => {
  qs.forEach((q, i) => {
    const esc = s => s.replace(/'/g, "''")
    const qt = esc(q.question_text)
    const opts = esc(JSON.stringify(q.options))
    const ca = esc(q.correct_answer)
    const ex = esc(q.explanation || '')
    vals.push(`('${qid}', '${qt}', 'multiple_choice', '${opts}'::jsonb, '${ca}', '${ex}', ${i + 1})`)
  })
})

const sql = `INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, order_index) VALUES\n${vals.join(',\n')};`

writeFileSync('scripts/batch2.sql', sql)
console.log(`Generated SQL: ${vals.length} rows`)
console.log(sql.substring(0, 500) + '...')
