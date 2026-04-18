// Build the UUID mapping
const uuidMap = {
  '3e92af45': '3e92af45-a32b-4dc9-aeac-dcc6d36c64e4',
  'ad8d7fe1': 'ad8d7fe1-7a0e-42b4-be83-55728ca2829b',
  'c8d37c14': 'c8d37c14-8582-4318-a566-dfaf68dc0500',
  'f3fbefe7': 'f3fbefe7-eb21-435d-842e-9fe2ea9e9c7c',
  'ee10d180': 'ee10d180-ee97-486b-917b-e8d5e114e975',
  '4bc7ed22': '4bc7ed22-6653-4010-9d7c-7baae7516cbf',
  '8e5598cb': '8e5598cb-1d06-4ca4-80aa-63f262170a55',
  'e91d15db': 'e91d15db-9b5f-4ee6-be56-940e9a873316',
  'c094ea19': 'c094ea19-54f7-4c4b-a275-68474ecc9801',
  '4ef03de9': '4ef03de9-ade1-4da3-bee3-db63d7934c1c',
  'c4e17321': 'c4e17321-7ca9-41ce-8007-2895e71c77a2',
  'bd6b7329': 'bd6b7329-80bd-4a2e-87be-a5051ebde26b',
  '1700c05d': '1700c05d-6820-452f-8de1-b7fe6e43e857',
  'd4d25075': 'd4d25075-106f-45bc-b50b-1b1f5bc7ba0d',
  'f3debf7a': 'f3debf7a-26be-4d6f-b480-129f1dc51cf8',
  'a80b64ab': 'a80b64ab-5761-40f1-8a94-0e93f1e75217',
  '08581156': '08581156-35b9-438d-8d98-9fc8c27178fa',
  '0fceb390': '0fceb390-c01a-4851-b683-928caab5d43b',
  'bd8db023': 'bd8db023-eae7-42c2-82ca-85209577ee9c',
  'f47f3aa3': 'f47f3aa3-4971-4b71-9501-998b2fecdf5e',
  '11de56b9': '11de56b9-fa22-4bca-9c6e-ebb7a5575728',
  '5197af9e': '5197af9e-b529-47d7-9c21-a78774fcb12a',
  '930a1850': '930a1850-99b5-429e-a23f-a352bb5c1ff3',
  '63308e54': '63308e54-8533-41af-b10e-08350cc6152c',
  'd03fe735': 'd03fe735-c7e8-4094-9f03-efd512ee0d45',
  '5289bd94': '5289bd94-c56e-4e9f-808f-a1e82c7c37a4',
  'cf4eb31c': 'cf4eb31c-8d0c-4cbf-bb2b-8e3cc74d3a26',
  '687df7f4': '687df7f4-332c-4769-ad2a-eb06ca57bd37',
  '08367e36': '08367e36-8aa6-425c-88a1-87b84fdcfd45',
  '34165735': '34165735-1f4a-4c12-be29-2eb952d36383',
  '4908c859': '4908c859-6a7f-4135-b5fc-308e33281ce9',
  'b13b2176': 'b13b2176-9521-40bd-bb92-12fa0d321ace',
  '629eff7b': '629eff7b-fd56-44d8-adcd-fb82576b6e4d',
  '11d2f539': '11d2f539-9b7e-4cf4-9e11-1918c6dcc781',
  'd26f5a65': 'd26f5a65-d27d-4ce1-b08a-a2225d91f1d1',
  '4ea309f8': '4ea309f8-59d5-4071-9310-78e3e99d2f37',
  '3e297630': '3e297630-05fc-48a6-886f-3f9fdfdeccf6',
  '11acf6ae': '11acf6ae-8a36-4204-a6f9-ca990d7e017e',
  '6b8b49d0': '6b8b49d0-895c-4fc2-ac2e-c0d5ce7d6658',
  '9bfacf02': '9bfacf02-15d0-4ebd-91af-362cfbff91c0',
  'f4032265': 'f4032265-c05e-4c01-b6f3-fce58f831014',
  '71b58ba2': '71b58ba2-4598-4aa8-bf29-cde3de7bf89c',
  'e9ce9c96': 'e9ce9c96-86e6-48bb-94ea-6fd0c7edfb64',
  '06035948': '06035948-da93-4445-9cf0-267865bcd31f',
  'd4f5f626': 'd4f5f626-374d-4f12-9a8c-ff77be04b2b2',
  '0763e16d': '0763e16d-2e52-4fc7-a93b-e8d9afd81190',
  '8269458d': '8269458d-2ef9-4510-a26a-193b52103b52',
  '55d5d28f': '55d5d28f-5fb9-435e-9a97-af7723d80239',
  '6e54a9fe': '6e54a9fe-a98e-4b88-bf6c-cd2a6e7d13cc',
  '64a0942d': '64a0942d-ec53-486f-93e4-c1e926ab7c24',
  'ed1b7ceb': 'ed1b7ceb-d58e-40c2-9e28-5c6fb5b31fb6',
  '415ffae0': '415ffae0-fc33-4076-a79e-a0bbb4a05e8a',
  '82c4022f': '82c4022f-a01d-45be-b42d-2d3bdc03e91a',
  '39073fd0': '39073fd0-4304-4a66-b1be-a24605513e5b',
  '5ad4cdc0': '5ad4cdc0-90c3-4453-aab2-64d50f75c178',
  'a8b5cec3': 'a8b5cec3-24e3-43c0-8248-9062bfd39d5f',
  '0bf00e78': '0bf00e78-b294-41b8-ad1e-1bf760e4c848',
  '6f13fe92': '6f13fe92-980d-4abe-a824-182583e4d720',
};

const data = require('./quiz-data.json');
const CHUNK_SIZE = 18;

function esc(s) { return s.replace(/'/g, "''"); }

const chunks = [];
for (let i = 0; i < data.length; i += CHUNK_SIZE) {
  const slice = data.slice(i, i + CHUNK_SIZE);
  const values = slice.map(q => {
    const fullId = uuidMap[q.quiz_id];
    if (!fullId) throw new Error(`Missing UUID for ${q.quiz_id}`);
    const opts = JSON.stringify(q.options);
    return `('${fullId}', '${esc(q.question_text)}', 'multiple_choice', '${esc(opts)}', '${esc(q.correct_answer)}', '${esc(q.explanation)}')`;
  });
  chunks.push(`INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation)\nVALUES\n${values.join(',\n')};`);
}

const fs = require('fs');
chunks.forEach((sql, i) => {
  fs.writeFileSync(`ielts-chunk-${i+1}.sql`, sql, 'utf8');
});
console.log(`Generated ${chunks.length} SQL chunks for ${data.length} questions`);
