const fs = require('fs');
const https = require('https');

const PROJECT_ID = 'euvxtwyiimeeiawtkztv';
const SUPABASE_URL = `https://${PROJECT_ID}.supabase.co`;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('ERROR: Set SUPABASE_SERVICE_ROLE_KEY env var');
  process.exit(1);
}

async function executeSql(sql) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query: sql });
    const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`);
    // Use pg endpoint instead
    const options = {
      hostname: `${PROJECT_ID}.supabase.co`,
      path: '/pg/query',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  const startChunk = parseInt(process.argv[2] || '3');
  const endChunk = parseInt(process.argv[3] || '10');
  
  for (let i = startChunk; i <= endChunk; i++) {
    const file = `ielts-chunk-${i}.sql`;
    if (!fs.existsSync(file)) {
      console.log(`SKIP: ${file} not found`);
      continue;
    }
    const sql = fs.readFileSync(file, 'utf8');
    console.log(`Executing ${file} (${sql.length} chars)...`);
    try {
      const result = await executeSql(sql);
      console.log(`  -> Status: ${result.status}`);
      if (result.status !== 200) {
        console.log(`  -> Body: ${result.body.substring(0, 200)}`);
      }
    } catch (err) {
      console.error(`  -> ERROR: ${err.message}`);
    }
  }
}

main();
