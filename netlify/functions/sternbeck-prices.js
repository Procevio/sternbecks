// Netlify function: POST /api/sternbeck/prices
// Proxar till GAS /exec med { token, pricing } och returnerar GAS-svaret.
// Kräver miljövariabler i Netlify Dashboard:
//  - STERNBECK_GAS_URL   (ex: https://script.google.com/macros/s/AKfy.../exec)
//  - STERNBECK_API_TOKEN (samma som i Apps Script)

exports.handler = async function(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return resp(405, { ok:false, error: 'Method Not Allowed' });
    }

    const GAS_URL   = process.env.STERNBECK_GAS_URL;
    const API_TOKEN = process.env.STERNBECK_API_TOKEN;

    if (!GAS_URL || !API_TOKEN) {
      return resp(500, { ok:false, error:'Missing env STERNBECK_GAS_URL or STERNBECK_API_TOKEN' });
    }

    let payload = {};
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return resp(400, { ok:false, error:'Invalid JSON body' });
    }

    // förväntar sig payload.pricing = { ... }
    const body = JSON.stringify({
      token: API_TOKEN,
      pricing: payload.pricing || {}
    });

    const upstream = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache'
      },
      body
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { ok:false, error:'Bad JSON from GAS', raw:text }; }

    // bubbla upp svaret
    return resp(upstream.status, data);
  } catch (err) {
    return resp(500, { ok:false, error: String(err) });
  }
}

function resp(status, json) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(json)
  };
}