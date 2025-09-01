/**
 * Netlify Function för Sternbecks Anbudsapp
 * POST:ar anbudsdata vidare till Zapier webhook
 * 
 * Frontend URL: /.netlify/functions/submit
 * Environment Variable: ZAPIER_WEBHOOK_URL
 */

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