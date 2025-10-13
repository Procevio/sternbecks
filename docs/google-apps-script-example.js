/**
 * Google Apps Script för Sternbecks Anbudsapp Prishantering
 * 
 * Denna fil visar hur Google Apps Script kan användas för att hantera priser
 * för Sternbecks anbudsapplikation via Google Sheets.
 * 
 * Installation:
 * 1. Skapa ett nytt Google Sheets-dokument
 * 2. Gå till Extensions > Apps Script
 * 3. Klistra in denna kod
 * 4. Publicera som web app
 * 5. Kopiera URL:en till adminpanelen i app.js
 */

// Säkerhetstoken - bör vara samma som i app.js
const API_TOKEN = "YOUR_API_TOKEN_HERE";

// Google Sheets konfiguration
const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID_HERE";
const SHEET_NAME = "Priser";

// Marker för att identifiera svar
const MARKER = "sternbeck_pricing_v1";

// JSON response helper
function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}

// Helper för att hämta eller skapa sheet
function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Sätt headers om sheet är nytt
    sheet.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
  }
  return sheet;
}

/**
 * Hanterar HTTP GET-requests (hämta priser)
 */
function doGet(e) {
  try {
    Logger.log('GET request mottagen');
    
    const prices = getPricesFromSheet();
    
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: true,
        data: prices,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      
  } catch (error) {
    Logger.log('Fel i doGet: ' + error.toString());
    
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Hanterar HTTP POST-requests (spara priser)
 */
function doPost(e){
  const lock = LockService.getScriptLock();
  lock.tryLock(5000);
  try {
    const body = JSON.parse(e.postData?.contents || '{}');
    if (body.token !== API_TOKEN) return json({ ok:false, error:'Unauthorized', marker:MARKER });
    const updates = body.pricing || {};
    if (typeof updates !== 'object' || Array.isArray(updates)) return json({ ok:false, error:'Invalid pricing', marker:MARKER });

    const sh   = getSheet_();
    const vals = sh.getDataRange().getDisplayValues(); // jobba mot display
    const idx  = new Map();
    for (let i = 1; i < vals.length; i++){
      const key = String(vals[i][0]).trim();
      if (key) idx.set(key, i + 1);
    }

    // Hämta nuvarande version (om finns), annars 0
    let currVer = 0;
    if (idx.has('version')) {
      const vStr = String(sh.getRange(idx.get('version'), 2).getDisplayValue()).trim().replace(',', '.');
      const vNum = Number(vStr);
      if (Number.isFinite(vNum)) currVer = vNum;
    }
    const nextVer = currVer + 1;

    // Skriv uppdateringar (ignorera ev. inkommande "version")
    for (const [k, v] of Object.entries(updates)){
      if (k === 'version') continue;
      if (idx.has(k)) sh.getRange(idx.get(k), 2).setValue(v);
      else {
        sh.appendRow([k, v]);
        idx.set(k, sh.getLastRow());
      }
    }

    // Skriv version och updated_at
    const nowIso = new Date().toISOString();
    if (idx.has('version')) sh.getRange(idx.get('version'), 2).setValue(nextVer);
    else sh.appendRow(['version', nextVer]);

    if (idx.has('updated_at')) sh.getRange(idx.get('updated_at'), 2).setValue(nowIso);
    else sh.appendRow(['updated_at', nowIso]);

    return json({ ok:true, version: nextVer, updated_at: nowIso, marker:MARKER });
  } catch(e) {
    return json({ ok:false, error:String(e), marker:MARKER });
  } finally {
    try { lock.releaseLock(); } catch(_) {}
  }
}

/**
 * Hämtar priser från Google Sheets
 */
function getPricesFromSheet() {
  try {
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();
    
    // Första raden bör vara headers
    if (data.length < 2) {
      // Om sheetet är tomt, skapa standardpriser
      return createDefaultPrices();
    }
    
    // Konvertera till objekt
    const prices = {};
    for (let i = 1; i < data.length; i++) {
      const [key, value] = data[i];
      prices[key] = parseFloat(value) || 0;
    }
    
    return prices;
    
  } catch (error) {
    Logger.log('Fel vid hämtning av priser: ' + error.toString());
    throw error;
  }
}

/**
 * Sparar priser till Google Sheets
 */
function savePricesToSheet(pricing) {
  try {
    const sheet = getOrCreateSheet();
    
    // Rensa befintligt innehåll
    sheet.clear();
    
    // Sätt headers
    sheet.getRange(1, 1, 1, 2).setValues([['Prisnamn', 'Värde']]);
    
    // Konvertera pricing objekt till array för Sheets
    const data = Object.entries(pricing).map(([key, value]) => [key, value]);
    
    // Skriv data till sheet
    if (data.length > 0) {
      sheet.getRange(2, 1, data.length, 2).setValues(data);
    }
    
    // Formatera sheetet
    sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
    sheet.autoResizeColumns(1, 2);
    
    Logger.log('Priser sparade framgångsrikt till sheet');
    
  } catch (error) {
    Logger.log('Fel vid sparning av priser: ' + error.toString());
    throw error;
  }
}

/**
 * Hämtar eller skapar prissheetet
 */
function getOrCreateSheet() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    let sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(SHEET_NAME);
      Logger.log('Nytt prissheet skapat: ' + SHEET_NAME);
    }
    
    return sheet;
    
  } catch (error) {
    Logger.log('Fel vid åtkomst till sheet: ' + error.toString());
    throw new Error('Kunde inte komma åt Google Sheets. Kontrollera SPREADSHEET_ID.');
  }
}

/**
 * Skapar standardpriser om sheetet är tomt
 */
function createDefaultPrices() {
  return {
    fonster_grundpris: 4000,
    dorr_grundpris: 5000,
    luftare_pris: 200,
    sprojs_pris: 250,
    traditionell_paslag: 15,
    modern_paslag: 0,
    le_glas_per_kvm: 2500,
    kallare_glugg_pris: 3500,
    moms_procent: 25,
    rot_procent: 50,
    version: 1
  };
}

/**
 * Loggar prisändringar för spårning
 */
function logPriceChange(pricing) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    let logSheet = spreadsheet.getSheetByName('Ändringslogg');
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet('Ändringslogg');
      logSheet.getRange(1, 1, 1, 4).setValues([['Datum', 'Version', 'Användare', 'Ändringar']]);
      logSheet.getRange(1, 1, 1, 4).setFontWeight('bold');
    }
    
    const timestamp = new Date();
    const version = pricing.version || 1;
    const changes = JSON.stringify(pricing);
    
    logSheet.appendRow([timestamp, version, 'Admin', changes]);
    
    Logger.log('Prisändring loggad: Version ' + version);
    
  } catch (error) {
    Logger.log('Fel vid loggning av ändringar: ' + error.toString());
    // Låt inte loggfel stoppa huvudfunktionen
  }
}

/**
 * Testfunktion för att verifiera setup
 */
function testSetup() {
  try {
    Logger.log('Testar Google Apps Script setup...');
    
    // Testa att hämta priser
    const prices = getPricesFromSheet();
    Logger.log('Priser hämtade: ' + JSON.stringify(prices));
    
    // Testa att spara priser
    const testPricing = {
      fonster_grundpris: 4500,
      version: 999
    };
    
    savePricesToSheet(testPricing);
    Logger.log('Testpriser sparade framgångsrikt');
    
    // Återställ originalpriser
    const defaultPrices = createDefaultPrices();
    savePricesToSheet(defaultPrices);
    
    Logger.log('Setup test slutförd framgångsrikt!');
    
  } catch (error) {
    Logger.log('Setup test misslyckades: ' + error.toString());
  }
}

/**
 * CORS-hantering för OPTIONS requests
 */
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}