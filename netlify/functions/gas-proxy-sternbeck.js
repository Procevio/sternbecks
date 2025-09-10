// netlify/functions/gas-proxy-sternbeck.js
// Proxy till Sternbecks GAS – injicerar token på serversidan.
const GAS_URL   = "https://script.google.com/macros/s/AKfycbwdJe2jnRtq4sewClA-O38q8l24B3WIjR3byAY92cSteuaHPxDwwxAiV2ULtnzpWNXU0A/exec";
const API_TOKEN = process.env.STERNBECK_TOKEN; // sätt i Netlify Environment variables

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400"
      },
      body: ""
    };
  }

  // ping
  if (event.httpMethod === "GET" && event.rawQuery && /(^|&)action=ping(&|$)/.test(event.rawQuery)) {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({ ok: true, proxy: "sternbeck:alive" })
    };
  }

  try {
    const qs = event.rawQuery ? `?${event.rawQuery}` : "";
    const init = { method: event.httpMethod, headers: {} };

    if (["POST","PUT","PATCH"].includes(event.httpMethod)) {
      const ct = event.headers && (event.headers["content-type"] || event.headers["Content-Type"]) || "application/json";
      init.headers["Content-Type"] = ct;

      let bodyObj = {};
      try { bodyObj = JSON.parse(event.body || "{}"); } catch { bodyObj = {}; }

      // Injicera/överskriv token server-side
      bodyObj.token = API_TOKEN;
      init.body = JSON.stringify(bodyObj);
    }

    // Lägg till timeout för att undvika 504-fel
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout (under Netlify's 30s gräns)
    
    try {
      init.signal = controller.signal;
      const resp = await fetch(GAS_URL + qs, init);
      clearTimeout(timeoutId);
      
      const text = await resp.text();
      const contentType = resp.headers.get("content-type") || "application/json";

      return {
        statusCode: resp.status,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": contentType,
          "Cache-Control": "no-store"
        },
        body: text
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        return {
          statusCode: 408,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ ok: false, error: "Request timeout", detail: "Google Apps Script took too long to respond" })
        };
      }
      
      throw fetchError; // Re-throw other errors to be caught by outer catch
    }
  } catch (err) {
    return {
      statusCode: 502,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ok: false, error: "Proxy failure", detail: String(err) })
    };
  }
};