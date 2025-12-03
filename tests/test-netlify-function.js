/**
 * Test för Netlify Function - Kör lokalt för att testa funktionalitet
 * Simulerar en POST-request till submit.js funktionen
 */

const submitFunction = require('./netlify/functions/submit.js');

// Mock environment variable - UPPDATERAD WEBHOOK URL
process.env.ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/24181254/ut0dun8/';

// Mock event object (simulerar POST-request från frontend)
const mockEvent = {
    httpMethod: 'POST',
    headers: {
        'content-type': 'application/json',
        'origin': 'http://localhost:3000'
    },
    body: JSON.stringify({
        // Test data som matchar anbudsapp-strukturen
        kundNamn: 'Test Kund AB',
        adress: 'Testgatan 123',
        telefon: '070-1234567',
        email: 'test@example.com',
        grundprisExklMoms: 50000,
        totaltInklMoms: 62500,
        anbudsNummer: 'TEST-' + Date.now()
    })
};

// Mock context object
const mockContext = {
    functionName: 'submit',
    requestId: 'test-123'
};

async function testFunction() {
    console.log('🧪 Testar Netlify Function lokalt...\n');
    
    try {
        const result = await submitFunction.handler(mockEvent, mockContext);
        
        console.log('✅ Function Response:');
        console.log('Status Code:', result.statusCode);
        console.log('Headers:', JSON.stringify(result.headers, null, 2));
        console.log('Body:', JSON.stringify(JSON.parse(result.body), null, 2));
        
        if (result.statusCode === 200) {
            console.log('\n🎉 TEST LYCKADES! Funktionen fungerar korrekt.');
        } else {
            console.log('\n⚠️ TEST VARNING: Funktionen returnerade fel status code.');
        }
        
    } catch (error) {
        console.error('❌ TEST MISSLYCKADES:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Kör testet
testFunction();

console.log(`
📋 TESTING INSTRUKTIONER:

1. Kör detta test:
   node test-netlify-function.js

2. För att testa med riktig Zapier webhook:
   - Sätt ZAPIER_WEBHOOK_URL environment variable
   - Kör: ZAPIER_WEBHOOK_URL="din_webhook_url" node test-netlify-function.js

3. För att testa CORS (OPTIONS request):
   - Ändra mockEvent.httpMethod till 'OPTIONS'
   - Kör testet igen

4. För deployment-test:
   - Deploy till Netlify
   - Använd curl eller Postman för att testa live function
`);