// Import script: Reads quiz questions JSON and inserts via Supabase MCP
// Usage: Paste your JSON array into scripts/quiz-data.json, then I'll run the SQL INSERT

// Example quiz-data.json format:
// [
//   {
//     "quiz_id": "c930f593-ce64-4d26-9aba-0d8e38b0188d",
//     "question_text": "Biển báo 'EXIT' có nghĩa là gì?",
//     "options": ["Lối ra", "Lối vào", "Cấm vào", "Khu vực nguy hiểm"],
//     "correct_answer": "Lối ra",
//     "explanation": "EXIT = lối ra"
//   }
// ]

import { readFileSync } from 'fs'

const data = JSON.parse(readFileSync('scripts/quiz-data.json', 'utf-8'))

// Generate SQL INSERT
const values = data.map((q, i) => {
  const opts = JSON.stringify(q.options).replace(/'/g, "''")
  const qtext = q.question_text.replace(/'/g, "''")
  const ans = q.correct_answer.replace(/'/g, "''")
  const expl = (q.explanation || '').replace(/'/g, "''")
  return `('${q.quiz_id}', '${qtext}', 'multiple_choice', '${opts}'::jsonb, '${ans}', '${expl}', ${i})`
}).join(',\n')

const sql = `INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, order_index)
VALUES
${values};`

console.log(sql)
console.log(`\n-- Total: ${data.length} questions`)
