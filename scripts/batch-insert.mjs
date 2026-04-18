// Generate full SQL with resolved UUIDs
import { readFileSync, writeFileSync } from 'fs'

const idMap = {
  '34927863': '34927863-ec9c-4a30-83db-aabb6f3186db',
  'e98ad60a': 'e98ad60a-72ba-48dc-90a1-c1edb15c417e',
  '2af3a4b2': '2af3a4b2-4eb7-4c64-ab5d-826b4595d59e',
  'e15a1a14': 'e15a1a14-f26e-4652-858e-1a1c0f912816',
  '7ea89040': '7ea89040-363b-4381-8af1-7e9a9cec9b5e',
  '344cd504': '344cd504-401e-410f-9cde-36dd57f66215',
  '5490e9b2': '5490e9b2-f3a1-4a92-9ed1-13dd36fb034a',
  '400ab212': '400ab212-bf68-4c17-9407-3aa902b939a7',
  '16bc0959': '16bc0959-15c1-4740-bbb0-e496e9500104',
  '218d9a71': '218d9a71-421a-4ee5-afe6-486edff31282',
  'd1ef0ff7': 'd1ef0ff7-abf9-457f-aaf3-becf3ac523cb',
  'b0cc9fb7': 'b0cc9fb7-8f1d-4058-83ff-6fa5cc3a2a9d',
  'b13f5875': 'b13f5875-f8a4-4edb-8eec-d376774fed83',
  'af9f5e2c': 'af9f5e2c-4519-4a91-b981-e3e852187324',
  '75f049b1': '75f049b1-4379-4a1f-b357-0a6db7bf7edb',
  '6afaf984': '6afaf984-4857-4850-884a-a6693be7764c',
  'a08fb0a9': 'a08fb0a9-f200-41ed-90b9-3167dbe13866',
  '8de64bb9': '8de64bb9-c2d0-43e8-abf6-d574dd98d740',
  '5e9e0def': '5e9e0def-ef8e-46f0-b9bd-d5e76ffa9c19',
  '7c74ea6e': '7c74ea6e-408f-4b32-8c3f-758849c94a06',
  'bdd1cff0': 'bdd1cff0-656d-4b5a-b07b-922d6484af9c',
  '0c4a7555': '0c4a7555-1ba4-4dc5-b58b-763633cd5a93',
  '205501be': '205501be-2ee1-47bc-b8c8-def285289e37',
  '882be395': '882be395-b3a6-4fd9-8928-9d8441c6af70',
  '7eaf2c1f': '7eaf2c1f-72d3-46c2-b2b6-1172f78cd7fb',
  'a6f97bb0': 'a6f97bb0-14ca-4698-a965-fda4ae1599b6',
  'ea2150a5': 'ea2150a5-b8c9-4fe2-8946-ba0befe866d0',
  'e687077e': 'e687077e-7682-4866-8adc-aeb6e4dc3bf9',
  '7603b416': '7603b416-bd52-426d-b462-d3f9f130c5d3',
  '34ae0783': '34ae0783-6f59-4803-b573-d6a2a0011797',
  '958d3fe4': '958d3fe4-3f33-49df-9dca-39be4838a57c',
  'f5ceab96': 'f5ceab96-d679-4696-a39f-ab41f7eaee14',
  '111ffbae': '111ffbae-8100-4bc8-86e7-8bf637abd98d',
  '580b7d5b': '580b7d5b-b6b6-44c5-88b8-8b23b510bcf4',
  '759e68c4': '759e68c4-b334-4235-ae17-ff6cb77828ad',
  '1ef00f18': '1ef00f18-1052-4ae6-94d0-6f6a58d0308d',
  'c77d06e2': 'c77d06e2-9ebf-42d1-b134-3816355e4661',
  'e94c6834': 'e94c6834-73b9-44c1-8f20-f519fd21d718',
  'a5157126': 'a5157126-a9b0-4d9c-b1e5-82e191d90033',
  '18334652': '18334652-2670-454e-91d2-e978cb1f6e29',
  '9a07fdd6': '9a07fdd6-0b32-4915-95f6-54230bad537b',
  '5fa96e68': '5fa96e68-f982-46d5-8c92-5e14add03791',
  'a34b9ad6': 'a34b9ad6-3a61-415c-ae16-b250dcaeb2f2',
  'cc283f34': 'cc283f34-edc4-483e-8390-a57540e76591',
  'e8478114': 'e8478114-4e61-467e-b195-f79178fd03a7',
  '0e90d13b': '0e90d13b-00f4-4ce3-87c5-748054972421',
  '30e7e6a0': '30e7e6a0-c2b0-4d63-bdf3-66de6ec0998f',
  '5b47891e': '5b47891e-cc7e-43a1-a566-87b49491d418',
  '8b372e76': '8b372e76-b24a-4478-9044-4d576dfca373',
  '939fbb43': '939fbb43-b743-464e-8b52-8dd9bd506788',
  'c20f9f73': 'c20f9f73-0f69-4463-bd8e-f188bdf183c4',
  'f16591bf': 'f16591bf-4ba8-442c-ac93-850e389f885d',
  '8dac243e': '8dac243e-829f-4658-b5e8-139192d4f8a3',
  'f502243d': 'f502243d-0b81-474e-86ad-1be773d31d72',
  'bd249531': 'bd249531-5d65-40c0-8731-854f1f64061a',
  '0efefd79': '0efefd79-4fbc-45da-b644-503be50944f8',
  '706beb68': '706beb68-1201-45e8-b988-325218716e54',
  '5add7ef2': '5add7ef2-07aa-4f0d-a46c-23b71be76314',
  'daaca8f7': 'daaca8f7-d187-41ec-b2d4-b437aee48e1e',
  'b4664d95': 'b4664d95-958b-4483-af5b-17f9b569c452'
}

const data = JSON.parse(readFileSync('scripts/quiz-data.json', 'utf8'))

// Group by quiz_id for order_index
const groups = {}
data.forEach(q => {
  const fullId = idMap[q.quiz_id] || q.quiz_id
  if (!groups[fullId]) groups[fullId] = []
  groups[fullId].push(q)
})

const esc = s => s.replace(/'/g, "''")
const allVals = []

Object.entries(groups).forEach(([fullId, qs]) => {
  qs.forEach((q, i) => {
    const qt = esc(q.question_text)
    const opts = esc(JSON.stringify(q.options))
    const ca = esc(q.correct_answer)
    const ex = esc(q.explanation || '')
    allVals.push(`('${fullId}', '${qt}', 'multiple_choice', '${opts}'::jsonb, '${ca}', '${ex}', ${i + 1})`)
  })
})

// Split into chunks of 20 for MCP
const chunkSize = 20
for (let i = 0; i < allVals.length; i += chunkSize) {
  const chunk = allVals.slice(i, i + chunkSize)
  const sql = `INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, order_index) VALUES\n${chunk.join(',\n')};`
  const idx = Math.floor(i / chunkSize)
  writeFileSync(`scripts/chunk-${idx}.sql`, sql)
  console.log(`chunk-${idx}.sql: ${chunk.length} rows`)
}

console.log(`\nTotal: ${allVals.length} rows in ${Math.ceil(allVals.length / chunkSize)} chunks`)
