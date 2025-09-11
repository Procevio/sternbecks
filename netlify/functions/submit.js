/**
 * Netlify Function för Sternbecks Anbudsapp
 * POST:ar anbudsdata vidare till Zapier webhook
 * 
 * Frontend URL: /.netlify/functions/submit
 * Environment Variable: ZAPIER_WEBHOOK_URL
 */

// Sternbeck: hämta hela prisobjektet från appens konfiguration
function collectPricingForSternbeck() {
  // Hämta från CONFIG-objektet - det innehåller flera objekt
  if (!window.CONFIG) return {};
  
  // Samla ihop alla prisobjekt från CONFIG
  const pricing = {
    // Kopiera hela underobjekt från CONFIG
    ...CONFIG.UNIT_PRICES,
    ...CONFIG.RENOVATION_TYPE_MULTIPLIERS,
    ...CONFIG.WINDOW_OPENING_MULTIPLIERS,
    ...CONFIG.WINDOW_TYPE_DISCOUNTS_PER_BAGE,
    ...CONFIG.WORK_DESCRIPTION_MULTIPLIERS,
    ...CONFIG.EXTRAS
  };

  // Säker fallback: tvinga fram plain-objekt (ingen referens till CONFIG)
  return JSON.parse(JSON.stringify(pricing));
}

// Koppla knappen "Spara priser" i appen
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn_admin_save'); // Korrekt ID från HTML
  if (!btn) return;

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = 'Sparar...';

    try {
      const pricing = collectPricingForSternbeck();   // <-- NY
      const res = await fetch('/api/sternbeck/prices', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Accept':'application/json' },
        body: JSON.stringify({ pricing })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Misslyckades');

      // uppdatera versionsvisning (om du har en badge)
      const badge = document.getElementById('pricing_version');
      if (badge && data.saved?.version != null) badge.textContent = String(data.saved.version);

      alert(`Priser sparade. Ny version: ${data.saved.version}`);
    } catch (err) {
      console.error(err);
      alert(String(err.message || err));
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  });
});

exports.handler = async (event, context) => {
    console.log('🚀 Submit function anropad');
    console.log('Method:', event.httpMethod);
    console.log('Headers:', JSON.stringify(event.headers, null, 2));

    // Hantera CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: ''
        };
    }

    // Endast POST-requests tillåtna
    if (event.httpMethod !== 'POST') {
        console.log('❌ Endast POST-requests tillåtna');
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                error: 'Method not allowed. Använd POST.' 
            })
        };
    }

    try {
        // Kontrollera att miljövariabel finns
        const zapierWebhookUrl = process.env.ZAPIER_WEBHOOK_URL;
        if (!zapierWebhookUrl) {
            console.error('❌ ZAPIER_WEBHOOK_URL miljövariabel saknas');
            return {
                statusCode: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    error: 'Server configuration error: Webhook URL saknas' 
                })
            };
        }

        // Parse inkommande data
        let requestData;
        try {
            requestData = JSON.parse(event.body);
            console.log('📦 Data mottaget från frontend:', Object.keys(requestData));
        } catch (parseError) {
            console.error('❌ Fel vid parsing av request body:', parseError);
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    error: 'Invalid JSON in request body' 
                })
            };
        }

        // Lägg till timestamp och metadata
        const enrichedData = {
            ...requestData,
            timestamp: new Date().toISOString(),
            anbudsNummer: requestData.anbudsNummer || `SB-${Date.now()}`,
            source: 'Sternbecks Anbudsapp',
            netlifyFunction: 'submit.js'
        };

        console.log('📊 Skickar data till Zapier webhook...');
        console.log('🎯 Webhook URL:', zapierWebhookUrl.substring(0, 50) + '...');

        // POST till Zapier webhook
        const response = await fetch(zapierWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Sternbecks-Anbudsapp-Netlify/1.0'
            },
            body: JSON.stringify(enrichedData)
        });

        console.log('📡 Zapier response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Zapier webhook fel:', response.status, errorText);
            
            return {
                statusCode: 502,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error: 'Webhook submission failed',
                    details: `Status: ${response.status}`,
                    zapierError: errorText.substring(0, 200) // Begränsa fel-meddelandet
                })
            };
        }

        const zapierResponse = await response.text();
        console.log('✅ Zapier response:', zapierResponse.substring(0, 100));

        // Framgångsrikt svar till frontend
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: true,
                message: 'Anbudsdata skickad till Zapier',
                anbudsNummer: enrichedData.anbudsNummer,
                timestamp: enrichedData.timestamp,
                zapierStatus: response.status
            })
        };

    } catch (error) {
        console.error('❌ Oväntat fel i submit function:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: 'Internal server error',
                message: 'Ett oväntat fel uppstod vid skickning av anbudsdata'
            })
        };
    }
};