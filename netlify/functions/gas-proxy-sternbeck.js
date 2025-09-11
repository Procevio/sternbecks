// netlify/functions/gas-proxy-sternbeck.js
// Proxy för Sternbecks Apps Script (GET + POST)
// Env i Netlify:
//   STERNBECK_GAS_URL   = din NYA webapp-URL (slutar på /exec)
//   STERNBECK_API_TOKEN = samma som API_TOKEN i Apps Script

export async function handler(event) {
  try {
    const GAS_URL   = process.env.STERNBECK_GAS_URL;
    const API_TOKEN = process.env.STERNBECK_API_TOKEN;

    if (!GAS_URL) {
      return resp(500, { ok:false, error:'Missing env STERNBECK_GAS_URL' });
    }

    if (event.httpMethod === 'GET') {
      // Pris-GET → proxya rakt igenom med no-store
      const upstream = await fetch(`${GAS_URL}${event.rawQuery ? `?${event.rawQuery}` : ''}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Cache-Control': 'no-store', 'Pragma': 'no-cache' },
        cache: 'no-store',
      });
      const text = await upstream.text();
      let data; try { data = JSON.parse(text); } catch { data = { ok:false, error:'Bad JSON from GAS', raw:text }; }
      return resp(upstream.status, data);
    }

    if (event.httpMethod === 'POST') {
      if (!API_TOKEN) {
        return resp(500, { ok:false, error:'Missing env STERNBECK_API_TOKEN' });
      }

      let payload = {};
      try { payload = JSON.parse(event.body || '{}'); } catch { return resp(400, { ok:false, error:'Invalid JSON body' }); }

      // Skicka vidare till GAS med token
      const body = JSON.stringify({ token: API_TOKEN, pricing: payload.pricing || {} });

      const upstream = await fetch(GAS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-store',
          'Pragma': 'no-cache',
        },
        body,
      });

      const text = await upstream.text();
      let data; try { data = JSON.parse(text); } catch { data = { ok:false, error:'Bad JSON from GAS', raw:text }; }
      return resp(upstream.status, data);
    }

    // Övriga metoder
    return resp(405, { ok:false, error:'Method Not Allowed' });
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
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(json),
  };
}