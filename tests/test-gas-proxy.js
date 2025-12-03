/**
 * Lokal test för GAS-proxyn (GET + POST)
 * Kräver env:
 *   STERNBECK_GAS_URL   = publicerad Apps Script Web App URL (slutar på /exec)
 *   STERNBECK_API_TOKEN = samma token som Apps Script kontrollerar vid POST
 */

const gasProxy = require('../netlify/functions/gas-proxy-sternbeck.js');

async function run() {
  const { STERNBECK_GAS_URL, STERNBECK_API_TOKEN } = process.env;
  if (!STERNBECK_GAS_URL) {
    console.error('❌ STERNBECK_GAS_URL saknas. Sätt den till din GAS /exec-URL.');
    process.exit(1);
  }
  if (!STERNBECK_API_TOKEN) {
    console.error('❌ STERNBECK_API_TOKEN saknas. Sätt den till din hemliga token.');
    process.exit(1);
  }

  console.log('🧪 Testar GET → GAS (hämtar priser) ...');
  const getRes = await gasProxy.handler({ httpMethod: 'GET', rawQuery: `nocache=${Date.now()}` });
  console.log('GET status:', getRes.statusCode);
  try { console.log('GET body keys:', Object.keys(JSON.parse(getRes.body) || {})); } catch {}
  if (getRes.statusCode < 200 || getRes.statusCode >= 300) {
    console.error('❌ GET misslyckades:', getRes.body);
    process.exit(1);
  }

  console.log('\n🧪 Testar POST → GAS (spara priser skeleton) ...');
  const postRes = await gasProxy.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ pricing: { _selftest: true, ts: Date.now() } })
  });
  console.log('POST status:', postRes.statusCode);
  console.log('POST body:', postRes.body);
  if (postRes.statusCode < 200 || postRes.statusCode >= 300) {
    console.error('❌ POST misslyckades:', postRes.body);
    process.exit(1);
  }

  console.log('\n✅ GAS-proxy test OK (GET + POST)');
}

run().catch(err => {
  console.error('❌ Oväntat fel i test:', err);
  process.exit(1);
});



