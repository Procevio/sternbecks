// Lösenordsskydd konfiguration
const PASSWORD_CONFIG = {
    CORRECT_PASSWORD: '123',
    MAX_ATTEMPTS: 3,
    SESSION_KEY: 'sternbecks_auth_session'
};

// --- Sternbeck Pricing API ---
const API_URL_STERNBECK = "/.netlify/functions/gas-proxy-sternbeck";
const PRICING_CACHE_KEY = "sternbeck_pricing_cache_v5";
const PRICING_TTL_MS = 10 * 60 * 1000;

// --- Version + reset helpers ---
const LAST_VERSION_KEY = 'sternbeck_pricing_version_seen';

async function hardResetStorageAndCaches() {
  try {
    // Behåll endast login-sessionen – rensa resten
    const session = localStorage.getItem(PASSWORD_CONFIG.SESSION_KEY);
    localStorage.clear();
    if (session) localStorage.setItem(PASSWORD_CONFIG.SESSION_KEY, session);

    // Rensa appens egna lokala cache-nycklar
    try { localStorage.removeItem(PRICING_CACHE_KEY); } catch {}
    try { localStorage.removeItem('sternbecks_anbud_data'); } catch {}
    try { localStorage.removeItem('sternbecks_arbetsbeskrivning_data'); } catch {}

    // Rensa ev. Service Worker caches
    if (window.caches && caches.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (e) {
    console.warn('hardResetStorageAndCaches warning:', e);
  }
}

/**
 * Körs vid inloggning: hämtar alltid färska priser (ingen cache),
 * uppdaterar CONFIG, cachar dem igen, och gör versionskontroll.
 * Returnerar en Promise som "pricingReady".
 */
async function forceFreshPricingOnLogin() {
  // 1) hämta direkt från Google Sheets, aldrig cache
  const fresh = await fetchPricingFromSheet(); // du har redan denna
  fresh.source = 'google_sheets_login';
  fresh.loadedAt = new Date().toISOString();

  // 2) spara ny cache lokalt
  setCachedPricing(fresh);

  // 3) uppdatera CONFIG i minnet
  applyPricingToConfig(fresh);

  // 4) enkel versionskontroll
  const currentVer = Number(fresh.version || 0);
  const lastSeen = Number(localStorage.getItem(LAST_VERSION_KEY) || 0);
  if (Number.isFinite(currentVer) && currentVer !== lastSeen) {
    localStorage.setItem(LAST_VERSION_KEY, String(currentVer));
    // Om du vill: visa diskret info i UI (om element finns)
    const el = document.getElementById('pricing_version');
    if (el) el.innerText = String(currentVer);
    console.log(`🔎 Ny prisversion upptäckt: ${lastSeen} → ${currentVer}`);
  }

  return fresh;
}

// --- Admin: tvinga färska priser från Google Sheets ---
// Rensar lokala caches, hämtar via proxyn (GET), applicerar på CONFIG och uppdaterar UI.
// Kastar fel om hämtningen misslyckas (så admin inte jobbar på fallback).
async function forceFreshPricingForAdmin() {
  // 1) rensa ev. lokal cache/flaggar
  try { localStorage.removeItem('sternbeck_pricing_cache'); } catch {}
  try { localStorage.removeItem('sternbecks_anbud_data'); } catch {}
  try { localStorage.removeItem('sternbecks_arbetsbeskrivning_data'); } catch {}

  // 2) hämta direkt från proxyn med cache-busting
  const url = `/.netlify/functions/gas-proxy-sternbeck?ts=${Date.now()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json', 'Cache-Control': 'no-store', 'Pragma': 'no-cache' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok || !data.data) throw new Error(data.error || 'ok=false från backend');

  // 3) applicera i CONFIG och cacha om du vill
  const fresh = data.data;
  // ta inte med "source" om den råkar finnas i arket
  delete fresh.source;

  // Uppdatera din app-konfiguration
  if (!window.CONFIG) window.CONFIG = {};
  CONFIG.PRICES = { ...CONFIG.PRICES, ...fresh };

  // Om du har en befintlig helper för att applicera priserna överallt:
  if (typeof applyPricingToConfig === 'function') {
    applyPricingToConfig(fresh);
  }

  // 4) uppdatera admin-UI om du har fält som visar priserna
  if (typeof AdminPanel?.renderPricing === 'function') {
    AdminPanel.renderPricing(CONFIG.PRICES);
  }

  // 5) sätt "seen version" om du vill visa i badge
  const ver = Number(fresh.version);
  if (Number.isFinite(ver)) {
    const el = document.getElementById('pricing_version');
    if (el) el.textContent = String(ver);
    localStorage.setItem('sternbeck_pricing_version_seen', String(ver));
  }

  return fresh;
}

// Bekväm wrapper för att köra med UI-feedback i Admin
async function refreshAdminPricingOrFail() {
  const btn = document.getElementById('admin-refresh-prices');
  if (btn) { btn.disabled = true; btn.textContent = 'Hämtar...'; }
  try {
    await forceFreshPricingForAdmin();
    console.log('✅ Admin: färska priser laddade från Google Sheets');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Uppdatera priser'; }
  }
}

// --- ARBETSBESKRIVNING: Fulltext-mapping ---
// Nycklar måste matcha exakt VALUE från WORK_DESC konstanten (inte label).
const WORK_DESCRIPTIONS = {
  "Modern - Alcro bestå": {
    "invandig": `Arbetsbeskrivning fönster, utvändig och invändig renovering – Alcro Bestå

<strong>Arbetsbeskrivning utvändigt</strong>
<strong>Fönsterkarm:</strong>
Tvättning
Skrapning och slipning till fast sittande underlag
Färgkanter slipas ner
Demontering gamla beslag, spikar etc
Demontering gammal tätningslist
Montering ny tätningslist
Uppskrapning fönsterbleck, slipning till fast sittande underlag 1 ggr grundning av trären yta - Färgtyp - Alcro.
Kant mellan fönsterbleck och karm fogas tätt, samt hål och sprickor
2 ggr strykning - Färgtyp - Alcro Bestå Utsikt

<strong>Fönsterbågar:</strong>
<strong>Ytterbåge</strong>
Hel rengöring till trären yta av yttersida samt 4 kanter
Hel kittborttagning
Kittning - LASeal
1 ggr grundning - Färgtyp - Alcro.
2 ggr strykning - Färgtyp - Alcro Bestå Utsikt

<strong>Innerbågens fyra kanter</strong>
Skrapning och slipning till fast sittande underlag
1 ggr grundning - Färgtyp - Alcro Bestå utsikt
2 ggr strykning - Färgtyp - Alcro Bestå utsikt

<strong>Mellansidor:</strong>
<strong>Ytterbågens mellansida</strong>
Skrapning och slipning till fast sittande underlag
Toppförsegling
1 ggr grundning - Färgtyp - Alcro Bestå utsikt
2 ggr strykning - Färgtyp - Alcro Bestå utsikt

<strong>Innerbågens mellansida</strong>
Skrapning och slipning till fast sittande underlag
1 ggr grundning - Färgtyp - Alcro
2 ggr strykning – Färgtyp - Alcro Bestå utsikt

<strong>Invändigt karm:</strong>
Skrapning och slipning till fast sittande underlag
Pågrundning av trären yta
I- och påspackling
1 ggr grundning - Färgtyp Alcro Vslip
1-2 ggr strykning - Färgtyp Alcro V mill

<strong>Invändigt fönsterbågar</strong>
Skrapning och slipning till fast sittande underlag
Pågrundning av trären yta
I- och påspackling
1 ggr grundning - Färgtyp Alcro Vslip
2 ggr strykning - Färgtyp Alcro V mill

<strong>Övrigt</strong>`,

    "utvandig": `Arbetsbeskrivning fönster, utvändig renovering – Alcro Bestå

<strong>Arbetsbeskrivning utvändigt</strong>
<strong>Fönsterkarm:</strong>
Tvättning
Skrapning och slipning till fast sittande underlag
Färgkanter slipas ner
Demontering gamla beslag, spikar etc
Demontering gammal tätningslist
Montering ny tätningslist
Uppskrapning fönsterbleck, slipning till fast sittande underlag 1 ggr grundning av trären yta - Färgtyp - Alcro.
Kant mellan fönsterbleck och karm fogas tätt, samt hål och sprickor
2 ggr strykning - Färgtyp - Alcro Bestå Utsikt

<strong>Fönsterbågar:</strong>
<strong>Ytterbåge</strong>
Hel rengöring till trären yta av yttersida samt 4 kanter
Hel kittborttagning
Kittning - LASeal
1 ggr grundning - Färgtyp - Alcro.
2 ggr strykning - Färgtyp - Alcro Bestå Utsikt

<strong>Innerbågens fyra kanter</strong>
Skrapning och slipning till fast sittande underlag
1 ggr grundning - Färgtyp - Alcro Bestå utsikt
2 ggr strykning - Färgtyp - Alcro Bestå utsikt

<strong>Mellansidor:</strong>
<strong>Ytterbågens mellansida</strong>
Skrapning och slipning till fast sittande underlag
Toppförsegling
1 ggr grundning - Färgtyp - Alcro Bestå utsikt
2 ggr strykning - Färgtyp - Alcro Bestå utsikt

<strong>Innerbågens mellansida</strong>
Skrapning och slipning till fast sittande underlag
1 ggr grundning - Färgtyp - Alcro
2 ggr strykning – Färgtyp - Alcro Bestå utsikt

<strong>Invändigt karm:</strong>
Ingen åtgärd

<strong>Invändigt fönsterbågar</strong>
Ingen åtgärd

<strong>Fönsterfoder</strong>
Ingen åtgärd

<strong>Övrigt</strong>`,

    "utv_plus_innermal": `Arbetsbeskrivning fönster, utvändig renovering + innerbågens insida – Alcro Bestå

<strong>Arbetsbeskrivning utvändigt</strong>
<strong>Fönsterkarm:</strong>
Tvättning
Skrapning och slipning till fast sittande underlag
Färgkanter slipas ner
Demontering gamla beslag, spikar etc
Demontering gammal tätningslist
Montering ny tätningslist
Uppskrapning fönsterbleck, slipning till fast sittande underlag
1 ggr grundning av trären yta - Färgtyp - Alcro.
Kant mellan fönsterbleck och karm fogas tätt, samt hål och sprickor
2 ggr strykning - Färgtyp - Alcro Bestå Utsikt

<strong>Fönsterbågar:</strong>
<strong>Ytterbåge</strong>
Hel rengöring till trären yta av yttersida samt 4 kanter
Hel kittborttagning
Kittning - LASeal
1 ggr grundning - Färgtyp - Alcro.
2 ggr strykning - Färgtyp - Alcro Bestå Utsikt

<strong>Innerbågens fyra kanter</strong>
Skrapning och slipning till fast sittande underlag
1 ggr grundning - Färgtyp - Alcro Bestå utsikt
2 ggr strykning - Färgtyp - Alcro Bestå utsikt

<strong>Mellansidor:</strong>
<strong>Ytterbågens mellansida</strong>
Skrapning och slipning till fast sittande underlag
Toppförsegling
1 ggr grundning - Färgtyp - Alcro Bestå utsikt
2 ggr strykning - Färgtyp - Alcro Bestå utsikt

<strong>Innerbågens mellansida</strong>
Skrapning och slipning till fast sittande underlag
1 ggr grundning - Färgtyp - Alcro
2 ggr strykning – Färgtyp - Alcro Bestå utsikt

<strong>Invändigt karm:</strong>
Ingen åtgärd

<strong>Invändigt fönsterbågar</strong>
Skrapning och slipning till fast sittande underlag
Pågrundning av trären yta
I- och påspackling
1 ggr grundning - Färgtyp Alcro Vslip
2 ggr strykning - Färgtyp Alcro V mill

<strong>Fönsterfoder</strong>
Ingen åtgärd

<strong>Övrigt</strong>`
  },

  "Traditionell - Linoljebehandling": {
    "invandig": `Arbetsbeskrivning fönster, utvändig & invändig renovering – Engwall & Claesson

<strong>Arbetsbeskrivning utvändigt</strong>
<strong>Fönsterkarm:</strong>
Tvättning
Skrapning och slipning till fast sittande underlag
Färgkanter slipas ner
Demontering gamla beslag, spikar etc
Demontering gammal tätningslist
Montering ny tätningslist
Uppskrapning fönsterbleck, slipning till fast sittande underlag
1 ggr grundning av trären yta - Färgtyp – Engwall & Claesson Linoljefärg.
Kant mellan fönsterbleck och karm fogas tätt, samt hål och sprickor
2 ggr strykning - Färgtyp – Engwall & Claesson Linoljefärg

<strong>Fönsterbågar:</strong>

<strong>Ytterbåge</strong>
Hel rengöring till trären yta av yttersida samt 4 kanter
Hel kittborttagning
Kittning - Linoljekitt
1 ggr grundning - Färgtyp – Engwall & Claesson Linoljefärg
2 ggr strykning - Färgtyp – Engwall & Claesson Linoljefärg

<strong>Innerbågens fyra kanter</strong>
Skrapning och slipning till fast sittande underlag
1 ggr grundning - Färgtyp – Engwall & Claesson Linoljefärg
2 ggr strykning - Färgtyp – Engwall & Claesson Linoljefärg

<strong>Mellansidor:</strong>
<strong>Ytterbågens mellansida</strong>
Skrapning och slipning till fast sittande underlag
Toppförsegling
1 ggr grundning - Färgtyp - Alcro Bestå utsikt
2 ggr strykning - Färgtyp - Alcro Bestå utsikt

<strong>Innerbågens mellansida</strong>
Skrapning och slipning till fast sittande underlag
1 ggr grundning - Färgtyp - Alcro
2 ggr strykning – Färgtyp - Alcro Bestå utsikt

<strong>Invändigt karm:</strong>
Slipning till fast sittande underlag
I- och påspackling
1 ggr grundning - Färgtyp - Alcro - vslip
2 ggr strykning – Färgtyp - Alcro Vmill

<strong>Invändigt fönsterbågar</strong>
Slipning till fast sittande underlag
I- och påspackling
1 ggr grundning - Färgtyp - Alcro - vslip
2 ggr strykning – Färgtyp - Alcro Vmill

<strong>Fönsterfoder</strong>
Ingen åtgärd

<strong>Övrigt</strong>`,

    "utvandig": `Arbetsbeskrivning fönster, utvändig renovering – Engwall & Claesson

<strong>Arbetsbeskrivning utvändigt</strong>
<strong>Fönsterkarm:</strong>
Tvättning
Skrapning och slipning till fast sittande underlag
Färgkanter slipas ner
Demontering gamla beslag, spikar etc
Demontering gammal tätningslist
Montering ny tätningslist
Uppskrapning fönsterbleck, slipning till fast sittande underlag
1 ggr grundning av trären yta - Färgtyp – Engwall & Claesson Linoljefärg.
Kant mellan fönsterbleck och karm fogas tätt, samt hål och sprickor
2 ggr strykning - Färgtyp – Engwall & Claesson Linoljefärg

<strong>Fönsterbågar:</strong>

<strong>Ytterbåge</strong>
Hel rengöring till trären yta av yttersida samt 4 kanter
Hel kittborttagning
Kittning - Linoljekitt
1 ggr grundning - Färgtyp – Engwall & Claesson Linoljefärg
2 ggr strykning - Färgtyp – Engwall & Claesson Linoljefärg

<strong>Innerbågens fyra kanter</strong>
Skrapning och slipning till fast sittande underlag
1 ggr grundning - Färgtyp – Engwall & Claesson Linoljefärg
2 ggr strykning - Färgtyp – Engwall & Claesson Linoljefärg

<strong>Mellansidor:</strong>
<strong>Ytterbågens mellansida</strong>
Skrapning och slipning till fast sittande underlag
Toppförsegling
1 ggr grundning - Färgtyp - Alcro Bestå utsikt
2 ggr strykning - Färgtyp - Alcro Bestå utsikt

<strong>Innerbågens mellansida</strong>
Skrapning och slipning till fast sittande underlag
1 ggr grundning - Färgtyp - Alcro
2 ggr strykning – Färgtyp - Alcro Bestå utsikt

<strong>Invändigt karm:</strong>
Ingen åtgärd

<strong>Invändigt fönsterbågar</strong>
Ingen åtgärd

<strong>Fönsterfoder</strong>
Ingen åtgärd

<strong>Övrigt</strong>`,

    "utv_plus_innermal": `Arbetsbeskrivning fönster, utvändig renovering + innerbågens insida – Engwall & Claesson

<strong>Arbetsbeskrivning utvändigt</strong>
<strong>Fönsterkarm:</strong>
Tvättning
Skrapning och slipning till fast sittande underlag
Färgkanter slipas ner
Demontering gamla beslag, spikar etc
Demontering gammal tätningslist
Montering ny tätningslist
Uppskrapning fönsterbleck, slipning till fast sittande underlag
1 ggr grundning av trären yta - Färgtyp – Engwall & Claesson Linoljefärg.
Kant mellan fönsterbleck och karm fogas tätt, samt hål och sprickor
2 ggr strykning - Färgtyp – Engwall & Claesson Linoljefärg

<strong>Fönsterbågar:</strong>

<strong>Ytterbåge</strong>
Hel rengöring till trären yta av yttersida samt 4 kanter
Hel kittborttagning
Kittning - Linoljekitt
1 ggr grundning - Färgtyp – Engwall & Claesson Linoljefärg
2 ggr strykning - Färgtyp – Engwall & Claesson Linoljefärg

<strong>Innerbågens fyra kanter</strong>
Skrapning och slipning till fast sittande underlag
1 ggr grundning - Färgtyp – Engwall & Claesson Linoljefärg
2 ggr strykning - Färgtyp – Engwall & Claesson Linoljefärg

<strong>Mellansidor:</strong>
<strong>Ytterbågens mellansida</strong>
Skrapning och slipning till fast sittande underlag
Toppförsegling
1 ggr grundning - Färgtyp - Alcro Bestå utsikt
2 ggr strykning - Färgtyp - Alcro Bestå utsikt

<strong>Innerbågens mellansida</strong>
Skrapning och slipning till fast sittande underlag
1 ggr grundning - Färgtyp - Alcro
2 ggr strykning – Färgtyp - Alcro Bestå utsikt

<strong>Invändigt karm:</strong>
Ingen åtgärd

<strong>Invändigt fönsterbågar</strong>
Slipning till fast sittande underlag
I- och påspackling
1 ggr grundning - Färgtyp - Alcro - vslip
2 ggr strykning – Färgtyp - Alcro Vmill

<strong>Fönsterfoder</strong>
Ingen åtgärd

<strong>Övrigt</strong>`
  }
};

// Hårdkodade standardpriser (nuvarande priser som fallback)
const DEFAULT_PRICES = {
    // Fönster och Dörrar (kr)
    dorrparti: 5000,
    pardorr_balong_altan: 9000,
    kallare_glugg: 3500,
    flak_bas: 6000,

    // Luftare-priser (kr)
    luftare_1_pris: 4000,
    luftare_2_pris: 5500,
    luftare_3_pris: 8250,
    luftare_4_pris: 11000,
    luftare_5_pris: 13750,
    luftare_6_pris: 16500,

    // Renoveringstyper (multiplikatorer)
    renov_modern_alcro_mult: 1.00,
    renov_trad_linolja_mult: 1.15,
    
    // Fönsteröppning (multiplikatorer)
    oppning_inat_mult: 1.00,
    oppning_utat_mult: 1.05,
    
    // Fönstertyp (delta per båge, kr)
    typ_kopplade_standard_delta: 0,
    typ_kopplade_isolerglas_delta: 500,
    typ_isolerglas_delta: -400,
    typ_insats_yttre_delta: -400,
    typ_insats_inre_delta: -1250,
    typ_insats_komplett_delta: 1000,
    
    // Arbetsbeskrivning (multiplikatorer)
    arb_utvandig_mult: 1.00,
    arb_invandig_mult: 1.25,
    arb_utv_plus_innermal_mult: 1.05,
    
    // Spröjs (kr per ruta)
    sprojs_low_price: 250,
    sprojs_high_price: 400,
    sprojs_threshold: 3,
    
    // LE-glas och Extra flak (kr)
    le_glas_per_kvm: 2500,
    flak_extra_1: 2750,
    flak_extra_2: 5500,
    flak_extra_3: 8250,
    flak_extra_4: 11000,
    flak_extra_5: 13750,
    
    // Skatter (%)
    vat: 25,
    
    // Metadata
    version: 1,
    source: 'default_fallback'
};

// --- Local cache helpers ---
function getCachedPricing() {
  try {
    const raw = localStorage.getItem(PRICING_CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.data || !obj.ts) return null;
    if (Date.now() - obj.ts > PRICING_TTL_MS) return null;
    return obj.data;
  } catch { return null; }
}

function setCachedPricing(data) {
  try {
    localStorage.setItem(PRICING_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

// --- API IO ---
async function fetchPricingFromSheet() {
  const url = API_URL_STERNBECK + "?nocache=" + Date.now();
  const res = await fetch(url, { method: "GET" });
  
  // Hantera HTTP-fel (504, 502, etc.)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  
  // Hantera tomma eller ogiltiga JSON-svar
  const text = await res.text();
  if (!text || text.trim() === '') {
    throw new Error("Empty response from server");
  }
  
  let json;
  try {
    json = JSON.parse(text);
  } catch (parseError) {
    throw new Error(`Invalid JSON response: ${parseError.message}`);
  }
  
  if (!json?.ok) throw new Error(json?.error || "Pricing GET failed");
  return json.data || {};
}

async function savePricingToSheet(kvObject) {
  const res = await fetch(API_URL_STERNBECK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pricing: kvObject }) // ingen token här
  });
  const json = await res.json();
  if (!json?.ok) throw new Error(json?.error || "Pricing POST failed");
  return json;
}

// --- Numerik & procent ↔ multiplikator (robust mot 0, 15, 0.05, 1.05, "1,05") ---
function toNumberLoose(v) {
  const s = String(v ?? '').trim().replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Tolka vad som än råkat hamna i Sheet: procenttal, bråkprocent, eller multiplikator
function toMultiplier(v) {
  const n = toNumberLoose(v);
  if (n == null) return null;
  if (n === 0) return 1;                 // 0% → 1.00
  if (Math.abs(n) >= 3) return 1 + n/100; // 15 → 1.15, -10 → 0.90, 152 → 2.52
  if (n > 0 && n < 0.5) return 1 + n;     // 0.05 → 1.05 (felinmatad bråkprocent)
  return n;                               // redan multiplikator (≈1.x)
}

function multToPct(mult) {
  const n = toMultiplier(mult);
  if (n == null) return '';
  const p = (n - 1) * 100;
  return String(+p.toFixed(2)).replace(/\.00$/, '');
}

function pctToMult(pct) {
  const n = toNumberLoose(pct);
  if (n == null) return null;
  return 1 + (n / 100);
}

function applyPricingToConfig(pr) {
  // --- Enhetspriser (kr) ---
  if (pr.dorrparti != null)               CONFIG.UNIT_PRICES.antal_dorrpartier     = Number(pr.dorrparti) || 0;
  if (pr.pardorr_balong_altan != null)    CONFIG.UNIT_PRICES.antal_pardorr_balkong = Number(pr.pardorr_balong_altan) || 0;
  if (pr.kallare_glugg != null)           CONFIG.UNIT_PRICES.antal_kallare_glugg   = Number(pr.kallare_glugg) || 0;
  if (pr.flak_bas != null)                CONFIG.UNIT_PRICES.antal_flak            = Number(pr.flak_bas) || 0;

  if (pr.luftare_1_pris != null) CONFIG.UNIT_PRICES.antal_1_luftare = Number(pr.luftare_1_pris) || 0;
  if (pr.luftare_2_pris != null) CONFIG.UNIT_PRICES.antal_2_luftare = Number(pr.luftare_2_pris) || 0;
  if (pr.luftare_3_pris != null) CONFIG.UNIT_PRICES.antal_3_luftare = Number(pr.luftare_3_pris) || 0;
  if (pr.luftare_4_pris != null) CONFIG.UNIT_PRICES.antal_4_luftare = Number(pr.luftare_4_pris) || 0;
  if (pr.luftare_5_pris != null) CONFIG.UNIT_PRICES.antal_5_luftare = Number(pr.luftare_5_pris) || 0;
  if (pr.luftare_6_pris != null) CONFIG.UNIT_PRICES.antal_6_luftare = Number(pr.luftare_6_pris) || 0;

  // --- Renovering (multiplikatorer) ---
  const trad   = toMultiplier(pr.renov_trad_linolja_mult);
  const modern = toMultiplier(pr.renov_modern_alcro_mult);
  if (trad   != null) CONFIG.RENOVATION_TYPE_MULTIPLIERS['Traditionell - Linoljebehandling'] = trad;
  if (modern != null) CONFIG.RENOVATION_TYPE_MULTIPLIERS['Modern - Alcro bestå']             = modern;

  // --- Fönsteröppning (multiplikatorer) ---
  const inat = toMultiplier(pr.oppning_inat_mult);
  const utat = toMultiplier(pr.oppning_utat_mult);
  if (inat != null) CONFIG.WINDOW_OPENING_MULTIPLIERS['Inåtgående'] = inat;
  if (utat != null) CONFIG.WINDOW_OPENING_MULTIPLIERS['Utåtgående'] = utat;

  // --- Fönstertyp (delta per båge, kr) ---
  if (pr.typ_kopplade_standard_delta      != null) CONFIG.WINDOW_TYPE_DISCOUNTS_PER_BAGE['Kopplade standard']   = Number(pr.typ_kopplade_standard_delta) || 0;
  if (pr.typ_isolerglas_delta             != null) CONFIG.WINDOW_TYPE_DISCOUNTS_PER_BAGE['Isolerglas']          = Number(pr.typ_isolerglas_delta) || 0;
  if (pr.typ_kopplade_isolerglas_delta    != null) CONFIG.WINDOW_TYPE_DISCOUNTS_PER_BAGE['Kopplade isolerglas'] = Number(pr.typ_kopplade_isolerglas_delta) || 0;
  if (pr.typ_insats_yttre_delta           != null) CONFIG.WINDOW_TYPE_DISCOUNTS_PER_BAGE['Insatsbågar yttre']   = Number(pr.typ_insats_yttre_delta) || 0;
  if (pr.typ_insats_inre_delta            != null) CONFIG.WINDOW_TYPE_DISCOUNTS_PER_BAGE['Insatsbågar inre']    = Number(pr.typ_insats_inre_delta) || 0;
  if (pr.typ_insats_komplett_delta        != null) CONFIG.WINDOW_TYPE_DISCOUNTS_PER_BAGE['Insatsbågar komplett']= Number(pr.typ_insats_komplett_delta) || 0;

  // --- Arbetsbeskrivning (multiplikatorer) ---
  const aUtv  = toMultiplier(pr.arb_utvandig_mult);
  const aInv  = toMultiplier(pr.arb_invandig_mult);
  const aPlus = toMultiplier(pr.arb_utv_plus_innermal_mult);
  if (aUtv  != null) CONFIG.WORK_DESCRIPTION_MULTIPLIERS['Utvändig renovering'] = aUtv;
  if (aInv  != null) CONFIG.WORK_DESCRIPTION_MULTIPLIERS['Invändig renovering'] = aInv;
  if (aPlus != null) CONFIG.WORK_DESCRIPTION_MULTIPLIERS['Utvändig renovering samt målning av innerbågens insida'] = aPlus;

  // --- Spröjs / LE-glas / moms ---
  if (pr.sprojs_low_price  != null) CONFIG.EXTRAS.SPROJS_LOW_PRICE  = Number(pr.sprojs_low_price)  || 0;
  if (pr.sprojs_high_price != null) CONFIG.EXTRAS.SPROJS_HIGH_PRICE = Number(pr.sprojs_high_price) || 0;
  if (pr.sprojs_threshold  != null) CONFIG.EXTRAS.SPROJS_THRESHOLD  = Number(pr.sprojs_threshold)  || 0;
  if (pr.le_glas_per_kvm   != null) CONFIG.EXTRAS.E_GLASS_PER_SQM   = Number(pr.le_glas_per_kvm)   || 0;

  if (pr.vat != null) {
    const pct = toNumberLoose(pr.vat);
    if (pct != null) CONFIG.EXTRAS.VAT_RATE = pct > 1 ? pct/100 : pct; // Sheet: 25 → 0.25
  }
}

window.pricingReady = (async () => {
    console.log('🔄 Startar prisladdning - försöker alltid Google Sheets först...');
    
    let pricing = null;
    let source = '';
    
    // Försök alltid hämta från Google Sheets först
    try {
        console.log('📡 Hämtar priser från Google Sheets...');
        pricing = await fetchPricingFromSheet();
        source = 'google_sheets';
        
        // Cacha framgångsrik hämtning
        setCachedPricing(pricing);
        console.log('✅ Priser laddade från Google Sheets');
        
    } catch (error) {
        console.warn('⚠️ Kunde inte ladda från Google Sheets:', error.message);
        
        // Försök med cache
        const cached = getCachedPricing();
        if (cached) {
            pricing = cached;
            source = 'cache';
            console.log('✅ Priser laddade från cache');
        } else {
            // Fallback till standardpriser
            pricing = { ...DEFAULT_PRICES };
            source = 'default_fallback';
            console.log('⚠️ Använder hårdkodade standardpriser som fallback');
        }
    }
    
    // Lägg till metadata
    pricing.source = source;
    pricing.loadedAt = new Date().toISOString();
    
    // Applicera priserna på CONFIG
    applyPricingToConfig(pricing);
    
    console.log(`✅ Prisladdning klar - källa: ${source}`);
    return pricing;
})();

// Konfiguration för applikationen
const CONFIG = {
    BASE_PRICE: 0, // Grundpris baserat på komponenter, inte fast summa
    
    // Prissättning per enhet (exkl. moms)
    UNIT_PRICES: {
        'antal_dorrpartier': 5000,  // Dörrpartier: 5000kr/st (exkl. moms)
        'antal_kallare_glugg': 3500, // Källare/Glugg: 3500kr/st (exkl. moms)
        'antal_pardorr_balkong': 9000, // Pardörr balkong/altan: 9000kr/st (exkl. moms)
        'antal_flak': 6000,         // Flak: 6000kr/st (exkl. moms)
        'antal_1_luftare': 4000,    // 1 luftare: 4000kr/st (exkl. moms)
        'antal_2_luftare': 5500,    // 2 luftare: 5500kr/st (exkl. moms)
        'antal_3_luftare': 8250,    // 3 luftare: 8250kr/st (exkl. moms)
        'antal_4_luftare': 11000,   // 4 luftare: 11000kr/st (exkl. moms)
        'antal_5_luftare': 13750,   // 5 luftare: 13750kr/st (exkl. moms)
        'antal_6_luftare': 16500    // 6 luftare: 16500kr/st (exkl. moms)
    },
    
    // Renoveringstyp-påslag (Typ av renovering dropdown)
    RENOVATION_TYPE_MULTIPLIERS: {
        'Traditionell - Linoljebehandling': 1.15,  // +15%
        'Modern - Alcro bestå': 1.0                // Standardpris
    },
    
    // Fönstertyp-påslag (checkboxes - kan välja flera)
    // Nya beräkningslogik: pris × antal luftare × totalt antal fönster
    // Fönstertyp rabatter per båge (negativa värden = rabatter)
    WINDOW_TYPE_DISCOUNTS_PER_BAGE: {
        'Kopplade standard': 0,                    // Standardpris (ingen rabatt)
        'Isolerglas': -400,                       // -400kr per båge
        'Kopplade isolerglas': 0,                 // Ingen rabatt (standardpris)
        'Insatsbågar yttre': -400,                // -400kr per båge
        'Insatsbågar inre': -1250,                // -1250kr per båge
        'Insatsbågar komplett': 1000,             // +1000kr per båge
    },
    
    // Fönsteröppning-multiplikatorer (påverkar luftare-grundpriset)
    WINDOW_OPENING_MULTIPLIERS: {
        'Inåtgående': 1.0,                        // Ingen förändring
        'Utåtgående': 1.05                        // +5% på luftare-grundpris
    },
    
    // Arbetsbeskrivning-påslag
    WORK_DESCRIPTION_MULTIPLIERS: {
        'Utvändig renovering': 1.0,                // 100% av totalsumman
        'Invändig renovering': 1.25,               // +25%
        'Utvändig renovering samt målning av innerbågens insida': 1.05 // +5%
    },
    
    // Tillägg (exkl. moms)
    EXTRAS: {
        SPROJS_LOW_PRICE: 250,      // 250kr per ruta för 1-3 spröjs (exkl. moms)
        SPROJS_HIGH_PRICE: 400,     // 400kr per ruta för 4+ spröjs (exkl. moms)
        SPROJS_THRESHOLD: 3,        // Gräns för prisökning
        E_GLASS_PER_SQM: 2500,      // 2500kr/kvm (exkl. moms)
        VAT_RATE: 0.25,             // 25% moms
        ROT_DEDUCTION: 0.5          // 50% ROT-avdrag
    },
    
    // WEBHOOK BORTTAGEN - exponerad säkerhetsrisk
    // WEBHOOK_URL: 'REMOVED_FOR_SECURITY'
};

// Nya konstanter för parti-konfiguration
const SPROJS_PRESETS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

const WINDOW_TYPES = [
  { value: "kopplade_standard", label: "Kopplade standard" },
  { value: "isolerglas", label: "Isolerglas" },
  { value: "kopplade_isolerglas", label: "Kopplade isolerglas" },
  { value: "insats_yttre", label: "Insatsbågar yttre" },
  { value: "insats_inre", label: "Insatsbågar inre" },
  { value: "insats_komplett", label: "Insatsbågar komplett" }
];

const PARTI_TYPES = [
  { value: "fonster", label: "Fönsterparti" },
  { value: "dorr", label: "Dörrparti" },
  { value: "kallare_glugg", label: "Källare/Glugg" },
  { value: "pardorr_balkong", label: "Pardörr balkong/altan" },
  { value: "flak", label: "Flak" }
];

const LUFTARE_TYPES = [
  { value: "1_luftare", label: "1 luftare" },
  { value: "2_luftare", label: "2 luftare" },
  { value: "3_luftare", label: "3 luftare" },
  { value: "4_luftare", label: "4 luftare" },
  { value: "5_luftare", label: "5 luftare" },
  { value: "6_luftare", label: "6 luftare" }
];

const EXTRA_LUFTARE_TYPES = [
  { value: 0, label: "0 extra luftare" },
  { value: 1, label: "1 extra luftare" },
  { value: 2, label: "2 extra luftare" },
  { value: 3, label: "3 extra luftare" },
  { value: 4, label: "4 extra luftare" },
  { value: 5, label: "5 extra luftare" }
];

const WORK_DESC = [
  { value: "utvandig", label: "Utvändig renovering" },
  { value: "invandig", label: "Invändig renovering" },
  { value: "utv_plus_innermal", label: "Utvändig renovering samt målning av innerbågens insida" }
];

const OPEN_DIR = [
  { value: "inatgaende", label: "Inåtgående" },
  { value: "utatgaende", label: "Utåtgående" }
];

/**
 * @typedef {Object} Parti
 * @property {number} id 1..N
 * @property {"fonster"|"dorr"|"kallare_glugg"|"pardorr_balkong"|"flak"|""} partiType
 * @property {"1_luftare"|"2_luftare"|"3_luftare"|"4_luftare"|"5_luftare"|"6_luftare"|""} luftareType
 * @property {number|null} extraLuftare For flak: 0-5 extra luftare
 * @property {"utvandig"|"invandig"|"utv_plus_innermal"|""} workDesc
 * @property {"inatgaende"|"utatgaende"|""} openDir
 * @property {"kopplade_standard"|"isolerglas"|"kopplade_isolerglas"|"insats_yttre"|"insats_inre"|"insats_komplett"|""} winType
 * @property {number|null} sprojs
 * @property {number|null} pris
 */

let partisState = { 
    partis: /** @type {Parti[]} */([]),
    isDuplicating: false  // Flagga för att förhindra oönskade re-creates under duplicering
};

let partiListenersBound = false; // Skydd mot dubletter av event listeners
let windowSectionsListenerBound = false; // Skydd mot dubbla window_sections listeners
let createPartiesDebounce = null; // Debounce för input-lyssnaren

class QuoteCalculator {
    constructor() {
        console.log('🚀 Initializing QuoteCalculator...');
        this.form = document.getElementById('quote-form');
        console.log('Form element:', this.form);
        
        // Alla priselement
        const priceElements = {
            'base-components-price': this.baseComponentsPriceElement = document.getElementById('base-components-price'),
            'window-type-cost': this.windowTypeCostElement = document.getElementById('window-type-cost'),
            'extras-cost': this.extrasCostElement = document.getElementById('extras-cost'),
            'renovation-markup': this.renovationMarkupElement = document.getElementById('renovation-markup'),
            'material-cost-display': this.materialCostDisplayElement = document.getElementById('material-cost-display'),
            'subtotal-price': this.subtotalPriceElement = document.getElementById('subtotal-price'),
            'subtotal-price-display': this.subtotalPriceDisplayElement = document.getElementById('subtotal-price-display'),
            'vat-cost': this.vatCostElement = document.getElementById('vat-cost'),
            'total-with-vat': this.totalWithVatElement = document.getElementById('total-with-vat'),
            'rot-deduction': this.rotDeductionElement = document.getElementById('rot-deduction'),
            'rot-row': this.rotRowElement = document.getElementById('rot-row'),
            'material-row': this.materialRowElement = document.getElementById('material-row'),
            'final-customer-price': this.finalCustomerPriceElement = document.getElementById('final-customer-price'),
            'material-deduction': this.materialDeductionElement = document.getElementById('material-deduction'),
            'kallare-glugg-cost': this.kallareGluggCostElement = document.getElementById('kallare-glugg-cost'),
            'kallare-glugg-row': this.kallareGluggRowElement = document.getElementById('kallare-glugg-row')
        };
        
        // Kontrollera att alla priselement hittades
        Object.entries(priceElements).forEach(([id, element]) => {
            if (element) {
                console.log(`✓ Found price element: ${id}`, element);
            } else {
                console.error(`❌ Missing price element: ${id}`);
            }
        });
        
        // Input elements för prisjustering
        this.priceAdjustmentPlusInput = document.getElementById('price_adjustment_plus');
        this.priceAdjustmentMinusInput = document.getElementById('price_adjustment_minus');
        
        // Form controls
        this.submitBtn = document.getElementById('submit-btn');
        this.successMessage = document.getElementById('success-message');
        this.errorMessage = document.getElementById('error-message');
        
        // Validation elements
        this.partiesValidation = document.getElementById('parties-validation');
        this.partiesValidationText = document.getElementById('parties-validation-text');
        
        // GDPR elements
        this.gdprConsent = document.getElementById('gdpr-consent');
        this.gdprConsentError = document.getElementById('gdpr-consent-error');
        this.gdprDetailsLink = document.getElementById('gdpr-details-link');
        this.gdprModal = document.getElementById('gdpr-modal');
        this.gdprModalClose = document.getElementById('gdpr-modal-close');
        this.gdprModalOk = document.getElementById('gdpr-modal-ok');

        // PDF cache för snabbare delning
        this._pdfCache = { offerBlob: null, workBlob: null, ts: 0 };

        // Diagnostik för Web Share API
        console.log('isSecureContext:', isSecureContext);
        console.log('navigator.share:', !!navigator.share);
        try {
            const can = navigator.canShare ? navigator.canShare({ files: [new File([new Blob(['x'])], 'x.txt', { type: 'text/plain' })] }) : false;
            console.log('navigator.canShare(files):', !!can);
        } catch (e) { console.log('navigator.canShare(files) threw:', e); }

        console.log('CONFIG object:', CONFIG);
        
        // Kontrollera att DOM är redo för QuoteCalculator
        const mainApp = document.getElementById('main-app');
        console.log('🔍 main-app element i QuoteCalculator:', mainApp);
        console.log('🔍 main-app display:', mainApp ? mainApp.style.display : 'not found');
        
        // Kontrollera tab-element innan initialisering
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');
        console.log('📊 QuoteCalculator DOM-kontroll:');
        console.log('  - Tab buttons:', tabButtons.length);
        console.log('  - Tab contents:', tabContents.length);
        
        this.initializeEventListeners();
        this.initializeFastighetsbeteckningAutoFill();
        this.initializeConditionalFields();
        
        console.log('🏷️ Initialiserar tabs från QuoteCalculator...');
        this.initializeTabs();
        
        console.log('🔄 Running initial price calculation...');
        this.updatePriceCalculation();
        
        // Test basic functionality
        this.testBasicCalculation();
        
        console.log('✅ QuoteCalculator konstruktor slutförd');
    }
    
    initializeEventListeners() {
        // Lyssna på alla ändringar som påverkar prissättning
        const priceAffectingFields = [
            'price_adjustment_plus', 'price_adjustment_minus', 'materialkostnad', 'window_sections', 'antal_dorrpartier',
            'antal_kallare_glugg', 'antal_pardorr_balkong', 'antal_1_luftare', 'antal_2_luftare', 'antal_3_luftare', 
            'antal_4_luftare', 'antal_5_luftare', 'antal_6_luftare',
            'antal_sprojs_per_bage', 'antal_fonster_med_sprojs', 'le_kvm', 'fastighetsbeteckning'
        ];
        
        priceAffectingFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                console.log(`✓ Found price affecting field: ${fieldId}`, field);
                
                // Special handling for window_sections - triggers parti creation
                if (fieldId === 'window_sections') {
                    this.setupWindowSectionsListener(field);
                } else {
                    field.addEventListener('input', () => {
                        console.log(`🔥 Price affecting field INPUT changed: ${fieldId}`, field.value);
                        this.updatePriceCalculation();
                        this.validateParties(); // Validera partier vid ändringar
                    });
                    field.addEventListener('change', () => {
                        console.log(`🔥 Price affecting field CHANGE changed: ${fieldId}`, field.value);
                        this.updatePriceCalculation();
                        this.validateParties(); // Validera partier vid ändringar
                    });
                }
            } else {
                console.error(`❌ Could not find price affecting field: ${fieldId}`);
            }
        });
        
        // Lyssna på ändringar i checkboxes och select
        const priceAffectingControls = [
            'typ_av_renovering', 'sprojs_choice', 'le_glas_choice', 
            'fastighet_rot_berättigad', 'är_du_berättigad_rot_avdrag'
        ];
        
        priceAffectingControls.forEach(name => {
            const fields = this.form.querySelectorAll(`[name="${name}"]`);
            if (fields.length > 0) {
                console.log(`✓ Found ${fields.length} controls for: ${name}`, fields);
            } else {
                console.error(`❌ Could not find controls for: ${name}`);
            }
            
            fields.forEach(field => {
                if (field.type === 'radio' || field.type === 'checkbox') {
                    field.addEventListener('change', () => {
                        console.log(`🔥 Price affecting control CHANGE: ${name}`, field.value, 'checked:', field.checked);
                        this.updatePriceCalculation();
                        this.clearFieldError(field);
                    });
                } else {
                    field.addEventListener('change', () => {
                        console.log(`🔥 Price affecting control CHANGE: ${name}`, field.value);
                        this.updatePriceCalculation();
                    });
                }
            });
        });
        
        // Lyssna på fönsteröppning och fönstertyp radiobuttons separat
        const windowOpeningRadios = this.form.querySelectorAll('input[name="fonsteroppning"]');
        windowOpeningRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                console.log('🔥 Window opening changed:', radio.value);
                this.updatePriceCalculation();
            });
        });
        
        const windowTypeRadios = this.form.querySelectorAll('input[name="typ_av_fonster"]');
        windowTypeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                console.log('🔥 Window type changed:', radio.value);
                this.updatePriceCalculation();
            });
        });
        
        // Lyssna på formulär submission
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmission();
        });
        
        // Lyssna på arbetsbeskrivning formulär submission
        const arbetsForm = document.getElementById('arbetsbeskrivning-form');
        if (arbetsForm) {
            arbetsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleArbetsbeskrivningSubmission();
            });
        }
        
        // Realtidsvalidering för alla inputfält
        const inputs = this.form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            input.addEventListener('blur', () => {
                this.validateField(input);
            });
            
            input.addEventListener('input', () => {
                this.clearFieldError(input);
            });
        });
        
        // GDPR modal event listeners
        if (this.gdprDetailsLink) {
            this.gdprDetailsLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showGdprModal();
            });
        }
        
        if (this.gdprModalClose) {
            this.gdprModalClose.addEventListener('click', () => {
                this.hideGdprModal();
            });
        }
        
        if (this.gdprModalOk) {
            this.gdprModalOk.addEventListener('click', () => {
                this.hideGdprModal();
            });
        }
        
        // Close modal on background click
        if (this.gdprModal) {
            this.gdprModal.addEventListener('click', (e) => {
                if (e.target === this.gdprModal) {
                    this.hideGdprModal();
                }
            });
        }

        // Offert tab event listeners
        const refreshBtn = document.getElementById('refresh-offer');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                this.updatePriceCalculation();
                this.renderOfferPreview();
                await this.getOrBuildPdfs(true); // bygg om PDF:er efter ändringar
            });
        }

        const sendBtn = document.getElementById('send-offer');
        if (sendBtn) {
            sendBtn.addEventListener('click', async () => {
                try {
                    // Tvinga fram nybyggda PDF:er precis vid klick
                    await this.getOrBuildPdfs(true);
                    await this.shareOrDownloadPdfs();
                } catch (err) {
                    console.error('Delning misslyckades:', err);
                    alert('Kunde inte skapa eller dela PDF. Vi försöker ladda ned filerna istället.');
                    // Sista utväg – tvinga fram nedladdning även om shareOrDownloadPdfs redan försökt
                    try {
                        const { offerBlob, workBlob } = await this.getOrBuildPdfs(true);
                        [{ blob: offerBlob, name: 'Anbud.pdf' }, { blob: workBlob, name: 'Arbetsbeskrivning.pdf' }].forEach(({ blob, name }) => {
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a'); a.href = url; a.download = name; a.click();
                            setTimeout(() => URL.revokeObjectURL(url), 10000);
                        });
                    } catch (_) { }
                }
            });
        }
    }
    
    initializeFastighetsbeteckningAutoFill() {
        const fastighetsbeteckningField = document.getElementById('fastighetsbeteckning');
        if (fastighetsbeteckningField) {
            // Auto-fill med "-" när användaren lämnar fältet tomt
            fastighetsbeteckningField.addEventListener('blur', () => {
                if (!fastighetsbeteckningField.value.trim()) {
                    fastighetsbeteckningField.value = '-';
                }
            });
        }
    }
    
    initializeConditionalFields() {
        console.log('🔧 Initializing conditional fields...');
        
        // Hantera Spröjs conditional field
        const sprojsChoiceRadios = this.form.querySelectorAll('input[name="sprojs_choice"]');
        const sprojsAntalGroup = document.getElementById('sprojs-antal-group');
        const sprojsFonsterGroup = document.getElementById('sprojs-fonster-group');
        
        console.log('Sprojs radios found:', sprojsChoiceRadios.length);
        console.log('Sprojs antal group:', sprojsAntalGroup);
        console.log('Sprojs fönster group:', sprojsFonsterGroup);
        
        sprojsChoiceRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === 'Ja' && radio.checked) {
                    sprojsAntalGroup.style.display = 'block';
                    sprojsFonsterGroup.style.display = 'block';
                } else if (radio.value === 'Nej' && radio.checked) {
                    sprojsAntalGroup.style.display = 'none';
                    sprojsFonsterGroup.style.display = 'none';
                    // Reset värden när de döljs
                    document.getElementById('antal_sprojs_per_bage').value = '0';
                    document.getElementById('antal_fonster_med_sprojs').value = '0';
                    this.updatePriceCalculation();
                }
            });
        });
        
        // Hantera LE-glas conditional field
        const leGlasChoiceRadios = this.form.querySelectorAll('input[name="le_glas_choice"]');
        const leGlasKvmGroup = document.getElementById('le-glas-kvm-group');
        
        console.log('LE-glas radios found:', leGlasChoiceRadios.length);
        console.log('LE-glas kvm group:', leGlasKvmGroup);
        
        leGlasChoiceRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === 'Ja' && radio.checked) {
                    leGlasKvmGroup.style.display = 'block';
                } else if (radio.value === 'Nej' && radio.checked) {
                    leGlasKvmGroup.style.display = 'none';
                    // Reset värdet när det döljs
                    document.getElementById('le_kvm').value = '0';
                    this.updatePriceCalculation();
                }
            });
        });
        
        // Hantera ROT-avdrag conditional fields - BÅDA måste vara Ja för delat ROT
        const rotPropertyRadios = this.form.querySelectorAll('input[name="fastighet_rot_berättigad"]');
        const rotCustomerRadios = this.form.querySelectorAll('input[name="är_du_berättigad_rot_avdrag"]');
        const materialkostnadSection = document.getElementById('materialkostnad-section');
        const delatRotSection = document.getElementById('delat-rot-section');
        
        console.log('ROT property radios found:', rotPropertyRadios.length);
        console.log('ROT customer radios found:', rotCustomerRadios.length);
        console.log('Materialkostnad section:', materialkostnadSection);
        console.log('Delat ROT section:', delatRotSection);
        
        // Funktion för att kontrollera ROT-sektioner baserat på båda frågorna
        const checkRotSections = () => {
            const propertyIsJa = this.form.querySelector('input[name="fastighet_rot_berättigad"]:checked')?.value === 'Ja - Villa/Radhus';
            const customerIsJa = this.form.querySelector('input[name="är_du_berättigad_rot_avdrag"]:checked')?.value === 'Ja - inkludera ROT-avdrag i anbudet';
            
            console.log('ROT check - Property Ja:', propertyIsJa, 'Customer Ja:', customerIsJa);
            
            if (propertyIsJa && customerIsJa) {
                // BÅDA är Ja - visa alla ROT-sektioner inklusive delat ROT
                materialkostnadSection.style.display = 'block';
                delatRotSection.style.display = 'block';
                console.log('✅ Visar alla ROT-sektioner (båda Ja)');
            } else if (customerIsJa && !propertyIsJa) {
                // Kund Ja men fastighet Nej - visa bara materialkostnad
                materialkostnadSection.style.display = 'block';
                delatRotSection.style.display = 'none';
                // Reset delat ROT till Nej
                const delatRotRadios = document.querySelectorAll('input[name="delat_rot_avdrag"]');
                delatRotRadios.forEach(radio => {
                    radio.checked = radio.value === 'Nej';
                });
                console.log('⚠️ Visar bara materialkostnad (kund Ja, fastighet Nej)');
            } else {
                // En eller båda är Nej - dölj alla ROT-sektioner
                materialkostnadSection.style.display = 'none';
                delatRotSection.style.display = 'none';
                // Reset värden
                document.getElementById('materialkostnad').value = '0';
                const delatRotRadios = document.querySelectorAll('input[name="delat_rot_avdrag"]');
                delatRotRadios.forEach(radio => {
                    radio.checked = radio.value === 'Nej';
                });
                console.log('❌ Döljer alla ROT-sektioner');
            }
            
            this.updatePriceCalculation();
        };
        
        // Event listeners för BÅDA ROT-frågorna
        rotPropertyRadios.forEach(radio => {
            radio.addEventListener('change', checkRotSections);
        });
        
        rotCustomerRadios.forEach(radio => {
            radio.addEventListener('change', checkRotSections);
        });
        
        // Event listeners för delat ROT-avdrag radiobuttons
        const delatRotRadios = document.querySelectorAll('input[name="delat_rot_avdrag"]');
        console.log('Delat ROT radios found:', delatRotRadios.length);
        delatRotRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                console.log('🔄 Delat ROT-avdrag ändrat till:', radio.value);
                this.updatePriceCalculation();
            });
        });
    }
    
    initializeTabs() {
        console.log('🔧 Initializing tabs...');
        
        // Get tab elements
        this.tabButtons = document.querySelectorAll('.tab-button');
        this.tabContents = document.querySelectorAll('.tab-content');
        
        console.log('Tab buttons found:', this.tabButtons.length);
        console.log('Tab contents found:', this.tabContents.length);
        
        // Add click event listeners to tab buttons
        this.tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const targetTab = button.getAttribute('data-tab');
                this.switchTab(targetTab);

                // Copy customer data and update work description when switching to arbetsbeskrivning
                if (targetTab === 'arbetsbeskrivning') {
                    this.copyCustomerData();
                    this.updateWorkDescription();
                }

                // Render offer preview when switching to offert tab
                if (targetTab === 'offert') {
                    this.updatePriceCalculation();
                    this.renderOfferPreview();
                    // Förvärm cache – snabbar upp delningen
                    this.getOrBuildPdfs(true).catch(() => {});
                }
            });
        });
        
        // Load data from localStorage on init
        this.loadTabData();
        
        // Save data on form changes
        this.initializeDataSaving();
    }
    
    switchTab(targetTab) {
        console.log('🔄 Switching to tab:', targetTab);
        
        // Update active states
        this.tabButtons.forEach(btn => {
            if (btn.getAttribute('data-tab') === targetTab) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        this.tabContents.forEach(content => {
            if (content.id === targetTab + '-tab') {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
    }
    
    copyCustomerData() {
        console.log('📋 Copying customer data to arbetsbeskrivning tab...');
        
        // Customer info mapping
        const dataMapping = [
            ['company', 'arb_company'],
            ['contact_person', 'arb_contact_person'],
            ['email', 'arb_email'],
            ['phone', 'arb_phone'],
            ['address', 'arb_address'],
            ['fastighetsbeteckning', 'arb_fastighetsbeteckning'],
            ['postal_code', 'arb_postal_code'],
            ['city', 'arb_city']
        ];
        
        dataMapping.forEach(([sourceId, targetId]) => {
            const sourceElement = document.getElementById(sourceId);
            const targetElement = document.getElementById(targetId);
            
            if (sourceElement && targetElement) {
                targetElement.value = sourceElement.value || '';
                console.log(`✓ Copied ${sourceId} -> ${targetId}:`, sourceElement.value);
            }
        });
    }
    
    loadTabData() {
        console.log('📥 Loading tab data from localStorage...');
        
        try {
            // Load anbud data
            const anbudData = localStorage.getItem('sternbecks_anbud_data');
            if (anbudData) {
                const data = JSON.parse(anbudData);
                this.loadFormData('quote-form', data);
            }
            
            // Load arbetsbeskrivning data
            const arbetsData = localStorage.getItem('sternbecks_arbetsbeskrivning_data');
            if (arbetsData) {
                const data = JSON.parse(arbetsData);
                this.loadFormData('arbetsbeskrivning-form', data);
            }
        } catch (error) {
            console.error('Error loading tab data:', error);
        }
    }
    
    saveTabData(tabName) {
        try {
            const formId = tabName === 'anbud' ? 'quote-form' : 'arbetsbeskrivning-form';
            const form = document.getElementById(formId);
            
            if (form) {
                const formData = new FormData(form);
                const data = {};
                
                for (let [key, value] of formData.entries()) {
                    data[key] = value;
                }
                
                localStorage.setItem(`sternbecks_${tabName}_data`, JSON.stringify(data));
                console.log(`💾 Saved ${tabName} data:`, data);
            }
        } catch (error) {
            console.error(`Error saving ${tabName} data:`, error);
        }
    }
    
    loadFormData(formId, data) {
        const form = document.getElementById(formId);
        if (!form) return;
        
        Object.entries(data).forEach(([key, value]) => {
            const element = form.querySelector(`[name="${key}"]`);
            if (element) {
                if (element.type === 'radio' || element.type === 'checkbox') {
                    if (element.value === value) {
                        element.checked = true;
                    }
                } else {
                    element.value = value;
                }
            }
        });
    }
    
    initializeDataSaving() {
        // Save anbud data on changes
        const anbudForm = document.getElementById('quote-form');
        if (anbudForm) {
            anbudForm.addEventListener('input', () => {
                this.saveTabData('anbud');
            });
            anbudForm.addEventListener('change', () => {
                this.saveTabData('anbud');
            });
        }
        
        // Save arbetsbeskrivning data on changes
        const arbetsForm = document.getElementById('arbetsbeskrivning-form');
        if (arbetsForm) {
            arbetsForm.addEventListener('input', () => {
                this.saveTabData('arbetsbeskrivning');
            });
            arbetsForm.addEventListener('change', () => {
                this.saveTabData('arbetsbeskrivning');
            });
        }
        
        // Add event listeners for dynamic work description updates
        const mainRenovationTypeSelect = document.getElementById('typ_av_renovering');
        if (mainRenovationTypeSelect) {
            mainRenovationTypeSelect.addEventListener('change', () => {
                this.updateWorkDescription();
            });
        }

        // Note: Arbetsbeskrivning is now per-parti, so updates are handled
        // in setupPartiEventListeners() when workDesc field changes
    }
    
    updateWorkDescription() {
        console.log('🔄 Updating automatic work description...');

        const workDescriptionContainer = document.getElementById('generated-work-description');

        if (!workDescriptionContainer) {
            console.error('Work description container not found');
            return;
        }

        // Get renovation type from anbud tab
        const renovationType = this.form.querySelector('select[name="typ_av_renovering"]')?.value || '';

        // Get work descriptions from all partis
        const partiWorkDescs = partisState.partis.map(p => ({
            id: p.id,
            type: p.partiType,
            workDesc: p.workDesc
        })).filter(p => p.workDesc); // Only partis with workDesc set

        console.log('Current selections:', { renovationType, partiWorkDescs });

        if (!renovationType || partiWorkDescs.length === 0) {
            workDescriptionContainer.innerHTML = `
                <div class="info-message">
                    <p>Arbetsbeskrivningen genereras automatiskt baserat på dina val från Anbud-fliken.</p>
                    <p>Gå till Anbud-fliken, välj renoveringstyp och konfigurera dina partier med arbetsbeskrivning för att se den detaljerade beskrivningen.</p>
                </div>
            `;
            return;
        }

        // Check if all partis have the same work description
        const allSame = partiWorkDescs.every(p => p.workDesc === partiWorkDescs[0].workDesc);

        let html = '';

        if (allSame) {
            // All partis have same work description - show ONE text
            const generatedDescription = this.generateWorkDescription(renovationType, partiWorkDescs[0].workDesc);

            // Get the label for the work description
            const workDescLabel = WORK_DESC.find(wd => wd.value === partiWorkDescs[0].workDesc)?.label || partiWorkDescs[0].workDesc;

            html = `
                <div class="selected-options">
                    <h4>Valda alternativ:</h4>
                    <p><strong>Renoveringstyp:</strong> ${renovationType}</p>
                    <p><strong>Arbetsbeskrivning:</strong> ${workDescLabel}</p>
                    <p><strong>Gäller för:</strong> Alla ${partiWorkDescs.length} ${partiWorkDescs.length === 1 ? 'parti' : 'partier'}</p>
                </div>
                <div class="work-description-text">
                    <pre style="white-space: pre-wrap; font-family: inherit;">${generatedDescription}</pre>
                </div>
            `;
        } else {
            // Different work descriptions - show ALL texts grouped by parti
            html = `
                <div class="selected-options">
                    <h4>Valda alternativ:</h4>
                    <p><strong>Renoveringstyp:</strong> ${renovationType}</p>
                    <p><strong>Arbetsbeskrivningar per parti:</strong></p>
                </div>
            `;

            partiWorkDescs.forEach(p => {
                const generatedDescription = this.generateWorkDescription(renovationType, p.workDesc);
                const partiTypeLabel = PARTI_TYPES.find(pt => pt.value === p.type)?.label || p.type;
                const workDescLabel = WORK_DESC.find(wd => wd.value === p.workDesc)?.label || p.workDesc;
                html += `
                    <div class="work-description-parti-section">
                        <h4 style="color: #c8b896; margin-top: 1.5rem;">Parti ${p.id} (${partiTypeLabel})</h4>
                        <p><strong>Arbetsbeskrivning:</strong> ${workDescLabel}</p>
                        <div class="work-description-text">
                            <pre style="white-space: pre-wrap; font-family: inherit;">${generatedDescription}</pre>
                        </div>
                        <hr style="border: 1px solid #ddd; margin: 1.5rem 0;">
                    </div>
                `;
            });
        }

        workDescriptionContainer.innerHTML = html;
        console.log('✅ Work description updated');
    }
    
    generateWorkDescription(renovationType, workDescription) {
        console.log('🎯 Generating work description for:', { renovationType, workDescription });

        const sysMap = WORK_DESCRIPTIONS[renovationType] || null;
        if (!sysMap) {
            return '<em>Arbetsbeskrivning saknas för vald renoveringstyp.</em>';
        }

        const text = sysMap[workDescription];
        if (!text || !text.trim()) {
            return '<em>Arbetsbeskrivning saknas för vald omfattning.</em>';
        }

        return text;
    }
    
    testBasicCalculation() {
        console.log('🧪 Testing basic calculation...');
        
        // Set a simple test value
        const testData = {
            doorSections: 1,
            kallareGlugg: 0,
            luftare1: 1,
            luftare2: 0,
            luftare3: 0,
            luftare4: 0,
            luftare5: 0,
            luftare6: 0,
            totalWindows: 1,
            renovationType: 'Modern - Alcro bestå',
            workDescription: 'Utvändig renovering',
            windowOpening: 'Inåtgående',
            windowType: 'Kopplade standard',
            priceAdjustmentPlus: 0,
            priceAdjustmentMinus: 0,
            materialPercentage: 0,
            hasSprojs: false,
            sprojsPerWindow: 0,
            windowsWithSprojs: 0,
            hasEGlass: false,
            eGlassSqm: 0,
            propertyRotEligible: 'Nej - Hyresrätt/Kommersiell fastighet',
            customerRotEligible: 'Nej - visa fullpris utan avdrag',
            hasRotDeduction: false
        };
        
        console.log('🧪 Test data:', testData);
        const result = this.calculateBaseComponents(testData);
        console.log('🧪 Test result (should be 9500):', result);
        
        if (result === 9500) {
            console.log('✅ Basic calculation test PASSED');
        } else {
            console.error('❌ Basic calculation test FAILED');
        }
        
        // Kör även spröjs-tester
        this.testSprojsCalculations();
    }
    
    testSprojsCalculations() {
        console.log('🧪 Testing new Spröjs calculations...');
        
        // Test 1: Lågt pris (≤3 spröjs) - 2st 3-luftare, 2 spröjs, 2 fönster med spröjs
        const testData1 = {
            luftare1: 0, luftare2: 0, luftare3: 2, luftare4: 0, luftare5: 0, luftare6: 0,
            hasSprojs: true,
            sprojsPerWindow: 2,
            windowsWithSprojs: 2,
            kallareGlugg: 0
        };
        const result1 = this.calculateExtrasCost(testData1);
        const expected1 = 250 * 2 * 3 * 2; // 250kr × 2 spröjs × 3 luftare/fönster × 2 fönster = 3,000kr
        console.log(`Test 1 - 2st 3-luftare med 2 spröjs på 2 fönster: ${result1}kr (förväntat: ${expected1}kr) - ${result1 === expected1 ? 'PASS' : 'FAIL'}`);
        
        // Test 2: Högt pris (>3 spröjs) - 1st 3-luftare, 4 spröjs, 1 fönster med spröjs  
        const testData2 = {
            luftare1: 0, luftare2: 0, luftare3: 1, luftare4: 0, luftare5: 0, luftare6: 0,
            hasSprojs: true,
            sprojsPerWindow: 4,
            windowsWithSprojs: 1,
            kallareGlugg: 0
        };
        const result2 = this.calculateExtrasCost(testData2);
        const expected2 = 400 * 4 * 3 * 1; // 400kr × 4 spröjs × 3 luftare/fönster × 1 fönster = 4,800kr
        console.log(`Test 2 - 1st 3-luftare med 4 spröjs på 1 fönster: ${result2}kr (förväntat: ${expected2}kr) - ${result2 === expected2 ? 'PASS' : 'FAIL'}`);
        
        // Test 3: Gränsvärde (=3 spröjs) - blandade luftare
        const testData3 = {
            luftare1: 0, luftare2: 2, luftare3: 2, luftare4: 0, luftare5: 0, luftare6: 0,
            hasSprojs: true,
            sprojsPerWindow: 3,
            windowsWithSprojs: 1,
            kallareGlugg: 0
        };
        const result3 = this.calculateExtrasCost(testData3);
        // Genomsnitt: (2×2 + 2×3)/(2+2) = 10/4 = 2.5 luftare/fönster
        const expected3 = 250 * 3 * 2.5 * 1; // 250kr × 3 spröjs × 2.5 luftare/fönster × 1 fönster = 1,875kr
        console.log(`Test 3 - Blandade luftare med 3 spröjs på 1 fönster: ${result3}kr (förväntat: ${expected3}kr) - ${result3 === expected3 ? 'PASS' : 'FAIL'}`);
        
        // Test 4: Exempel från specifikationen: 3 spröjs på 2st av 4st 3-luftare = 4,500kr
        const testData4 = {
            luftare1: 0, luftare2: 0, luftare3: 4, luftare4: 0, luftare5: 0, luftare6: 0,
            hasSprojs: true,
            sprojsPerWindow: 3,
            windowsWithSprojs: 2,
            kallareGlugg: 0
        };
        const result4 = this.calculateExtrasCost(testData4);
        const expected4 = 250 * 3 * 3 * 2; // 250kr × 3 spröjs × 3 luftare/fönster × 2 fönster = 4,500kr
        console.log(`Test 4 - Exempel från spec: ${result4}kr (förväntat: ${expected4}kr) - ${result4 === expected4 ? 'PASS' : 'FAIL'}`);
        
        console.log('🧪 Spröjs calculation tests completed');
    }
    
    validateParties() {
        // Validera individuella partier först
        if (partisState.partis.length > 0) {
            for (let i = 0; i < partisState.partis.length; i++) {
                const parti = partisState.partis[i];
                const partiNumber = i + 1;
                
                // Kontrollera att partiType är vald
                if (!parti.partiType) {
                    this.partiesValidationText.textContent = 
                        `Parti ${partiNumber}: Du måste välja en partiTyp`;
                    this.partiesValidation.className = 'validation-message error';
                    this.partiesValidation.style.display = 'block';
                    this.submitBtn.disabled = true;
                    this.submitBtn.style.opacity = '0.5';
                    this.scrollToParti(parti.id);
                    return false;
                }
                
                // Kontrollera luftare för fönster
                if (parti.partiType === 'fonster' && !parti.luftareType) {
                    this.partiesValidationText.textContent = 
                        `Parti ${partiNumber}: Du måste välja antal luftare för fönsterparti`;
                    this.partiesValidation.className = 'validation-message error';
                    this.partiesValidation.style.display = 'block';
                    this.submitBtn.disabled = true;
                    this.submitBtn.style.opacity = '0.5';
                    this.scrollToParti(parti.id);
                    return false;
                }
                
                // Kontrollera extra luftare för flak och pardörr balkong/altan
                if ((parti.partiType === 'flak' || parti.partiType === 'pardorr_balkong') && (parti.extraLuftare === null || parti.extraLuftare === undefined)) {
                    const partiTypeName = parti.partiType === 'flak' ? 'flak' : 'pardörr balkong/altan';
                    this.partiesValidationText.textContent = 
                        `Parti ${partiNumber}: Du måste välja antal extra luftare för ${partiTypeName}`;
                    this.partiesValidation.className = 'validation-message error';
                    this.partiesValidation.style.display = 'block';
                    this.submitBtn.disabled = true;
                    this.submitBtn.style.opacity = '0.5';
                    this.scrollToParti(parti.id);
                    return false;
                }
                
                // Kontrollera arbetsbeskrivning
                if (!parti.workDesc) {
                    this.partiesValidationText.textContent = 
                        `Parti ${partiNumber}: Du måste välja arbetsbeskrivning`;
                    this.partiesValidation.className = 'validation-message error';
                    this.partiesValidation.style.display = 'block';
                    this.submitBtn.disabled = true;
                    this.submitBtn.style.opacity = '0.5';
                    this.scrollToParti(parti.id);
                    return false;
                }
                
                // Kontrollera öppningsriktning
                if (!parti.openDir) {
                    this.partiesValidationText.textContent = 
                        `Parti ${partiNumber}: Du måste välja öppningsriktning`;
                    this.partiesValidation.className = 'validation-message error';
                    this.partiesValidation.style.display = 'block';
                    this.submitBtn.disabled = true;
                    this.submitBtn.style.opacity = '0.5';
                    this.scrollToParti(parti.id);
                    return false;
                }
                
                // Kontrollera typ av fönster/beslag
                if (!parti.winType) {
                    this.partiesValidationText.textContent = 
                        `Parti ${partiNumber}: Du måste välja typ av ${parti.partiType === 'fonster' ? 'fönster' : 'beslag/glas'}`;
                    this.partiesValidation.className = 'validation-message error';
                    this.partiesValidation.style.display = 'block';
                    this.submitBtn.disabled = true;
                    this.submitBtn.style.opacity = '0.5';
                    this.scrollToParti(parti.id);
                    return false;
                }
            }
        }
        
        // Kontrollera att antal konfigurerade partier matchar valt antal
        const windowSections = parseInt(document.getElementById('window_sections')?.value) || 0;
        if (windowSections > 0 && partisState.partis.length !== windowSections) {
            this.partiesValidationText.textContent = 
                `Du har valt att konfigurera ${windowSections} partier men har bara ${partisState.partis.length} parti(er) konfigurerade. Fyll i alla partier.`;
            this.partiesValidation.className = 'validation-message error';
            this.partiesValidation.style.display = 'block';
            this.submitBtn.disabled = true;
            this.submitBtn.style.opacity = '0.5';
            return false;
        }
        
        // Om alla individuella partier är ifyllda, visa framgångsmeddelande
        if (windowSections > 0 && partisState.partis.length > 0 && partisState.partis.length === windowSections) {
            // Kontrollera att alla partier har beräknade priser
            const allPartisValid = partisState.partis.every(parti => parti.pris != null && parti.pris > 0);
            if (allPartisValid) {
                this.partiesValidationText.textContent = 
                    `✓ Alla ${windowSections} partier är korrekt ifyllda och prissatta`;
                this.partiesValidation.className = 'validation-message success';
                this.partiesValidation.style.display = 'block';
                this.submitBtn.disabled = false;
                this.submitBtn.style.opacity = '1';
                return true;
            }
        }
        
        // Legacy validation (behålls för bakåtkompatibilitet)
        // Använd redan hämtade windowSections-värdet
        
        // Totala luftare = vanliga luftare
        const totalLuftare = 
            (parseInt(document.getElementById('antal_1_luftare')?.value) || 0) +
            (parseInt(document.getElementById('antal_2_luftare')?.value) || 0) +
            (parseInt(document.getElementById('antal_3_luftare')?.value) || 0) +
            (parseInt(document.getElementById('antal_4_luftare')?.value) || 0) +
            (parseInt(document.getElementById('antal_5_luftare')?.value) || 0) +
            (parseInt(document.getElementById('antal_6_luftare')?.value) || 0);
        
        // Totala fönsterpartier = dörrpartier + källare/glugg + pardörr balkong + luftare
        const totalParties = 
            (parseInt(document.getElementById('antal_dorrpartier')?.value) || 0) +
            (parseInt(document.getElementById('antal_kallare_glugg')?.value) || 0) +
            (parseInt(document.getElementById('antal_pardorr_balkong')?.value) || 0) +
            totalLuftare;
        
        // Kontrollera spröjs-validering
        const windowsWithSprojs = parseInt(document.getElementById('antal_fonster_med_sprojs')?.value) || 0;
        const hasSprojs = this.form.querySelector('input[name="sprojs_choice"]:checked')?.value === 'Ja';
        
        console.log('Validating parties:', { windowSections, totalParties, totalLuftare, windowsWithSprojs, hasSprojs });
        
        // Prioriterad validering: Spröjs först (om aktivt)
        if (hasSprojs && windowsWithSprojs > 0) {
            if (windowsWithSprojs > windowSections) {
                this.partiesValidationText.textContent = 
                    `Fönster med spröjs (${windowsWithSprojs}) kan inte överstiga antal fönsterpartier (${windowSections})`;
                this.partiesValidation.className = 'validation-message error';
                this.partiesValidation.style.display = 'block';
                this.submitBtn.disabled = true;
                this.submitBtn.style.opacity = '0.5';
                return false;
            }
        }
        
        // Sedan validera totala partier vs fönsterpartier
        if (windowSections > 0 || totalParties > 0) {
            if (windowSections !== totalParties) {
                this.partiesValidationText.textContent = 
                    `Totalt antal partier (${totalParties}) matchar inte antal fönsterpartier (${windowSections})`;
                this.partiesValidation.className = 'validation-message error';
                this.partiesValidation.style.display = 'block';
                this.submitBtn.disabled = true;
                this.submitBtn.style.opacity = '0.5';
                return false;
            } else if (windowSections > 0 && totalParties > 0) {
                // Visa framgångsmeddelande som inkluderar spröjs-info om relevant
                let successMessage = `✓ Antal partier (${totalParties}) matchar antal fönsterpartier (${windowSections})`;
                if (hasSprojs && windowsWithSprojs > 0) {
                    successMessage += ` • Spröjs på ${windowsWithSprojs} fönster ✓`;
                }
                
                this.partiesValidationText.textContent = successMessage;
                this.partiesValidation.className = 'validation-message success';
                this.partiesValidation.style.display = 'block';
                this.submitBtn.disabled = false;
                this.submitBtn.style.opacity = '1';
                return true;
            }
        }
        
        // Dölj meddelande om inga värden är inmatade
        this.partiesValidation.style.display = 'none';
        this.submitBtn.disabled = false;
        this.submitBtn.style.opacity = '1';
        
        return true;
    }
    
    updatePriceCalculation() {
        console.log('=== STARTING PRICE CALCULATION ===');
        
        // Samla in alla värden
        const data = this.collectPricingData();
        console.log('Collected data:', data);
        
        // Summera individuella partier (innehåller alla parti-specifika kostnader: bas, fönstertyp, spröjs, etc.)
        const partierTotalCost = partisState.partis.reduce((sum, parti) => {
            return sum + (parti.pris || 0);
        }, 0);
        console.log('Partier total cost (excl VAT):', partierTotalCost);
        
        // E-glas (inte parti-specifik) 
        const extrasCost = this.calculateExtrasCost(data);
        console.log('Extras cost (excl VAT):', extrasCost);
        
        // Beräkna prisjusteringar
        const priceAdjustment = data.priceAdjustmentPlus - data.priceAdjustmentMinus;
        console.log('Price adjustment (excl VAT):', priceAdjustment);
        
        // Applicera renoveringstyp-pålägg
        console.log('🔍 DEBUG - data.renovationType:', JSON.stringify(data.renovationType));
        console.log('🔍 DEBUG - Available multipliers:', JSON.stringify(CONFIG.RENOVATION_TYPE_MULTIPLIERS));
        const renovationTypeMultiplier = CONFIG.RENOVATION_TYPE_MULTIPLIERS[data.renovationType] || 1.0;
        const renovationAdjustedTotal = (partierTotalCost + extrasCost + priceAdjustment) * renovationTypeMultiplier;
        console.log('🔍 DEBUG - Renovation type multiplier:', renovationTypeMultiplier, 'for type:', data.renovationType);
        if (renovationTypeMultiplier === 1.0 && data.renovationType) {
            console.warn('⚠️  PROBLEM: Renovation type not found in multipliers!');
        }
        
        // Beräkna summa utan materialkostnad (partier innehåller redan allt parti-relaterat + renoveringstyp-pålägg)
        const subtotalBeforeMaterial = renovationAdjustedTotal;
        console.log('Subtotal before work markup (after renovation type):', subtotalBeforeMaterial);
        
        // Beräkna arbetsbeskrivning-pålägg (utan materialavdrag)
        const workDescriptionMarkup = this.calculateWorkDescriptionMarkup(data, subtotalBeforeMaterial, priceAdjustment, 0);
        console.log('Work description markup:', workDescriptionMarkup);
        
        // Total summa exklusive moms (utan materialkostnad)
        const subtotalExclVat = subtotalBeforeMaterial + workDescriptionMarkup;
        console.log('Subtotal excl VAT:', subtotalExclVat);
        
        // Moms
        const vatCost = subtotalExclVat * CONFIG.EXTRAS.VAT_RATE;
        console.log('VAT cost:', vatCost);
        
        // Total inklusive moms (det kunden betalar utan ROT)
        const totalInclVat = subtotalExclVat + vatCost;
        console.log('Total incl VAT (customer price):', totalInclVat); // Bara här visas inkl moms
        
        // Materialkostnad för ROT-beräkning (endast för att identifiera materialandel)
        const materialCostForRot = totalInclVat * (data.materialPercentage / 100);
        console.log('Material cost for ROT calculation:', materialCostForRot, '(' + data.materialPercentage + '% of total)');
        
        // Arbetskostnad för ROT-beräkning = totalt - material
        const workCostForRot = totalInclVat - materialCostForRot;
        console.log('Work cost for ROT calculation:', workCostForRot);
        
        // ROT-avdrag beräkning med maxbelopp
        let rotDeduction = 0;
        if (data.hasRotDeduction) {
            const calculatedRotDeduction = workCostForRot * CONFIG.EXTRAS.ROT_DEDUCTION; // 50%
            const maxRotAmount = data.isSharedRotDeduction ? 100000 : 50000; // 100k för två personer, 50k för en
            rotDeduction = Math.min(calculatedRotDeduction, maxRotAmount);
            
            console.log('ROT calculation details:');
            console.log('- Work cost for ROT:', workCostForRot);
            console.log('- 50% of work cost:', calculatedRotDeduction);
            console.log('- Max ROT amount:', maxRotAmount, data.isSharedRotDeduction ? '(två personer)' : '(en person)');
            console.log('- Final ROT deduction:', rotDeduction);
        }
        
        // Slutligt kundpris = totalt inkl moms - ROT-avdrag
        const finalCustomerPrice = totalInclVat - rotDeduction;
        console.log('Final customer price:', finalCustomerPrice);
        
        // Uppdatera alla priselement
        this.updatePriceDisplay({
            baseComponentsPrice: partierTotalCost, // Nu kommer från partier istället
            windowTypeCost: 0, // Ingår redan i partier
            extrasCost,
            renovationMarkup: workDescriptionMarkup,
            priceAdjustment,
            materialCost: materialCostForRot,
            subtotalExclVat,
            vatCost,
            totalInclVat,
            materialDeduction: materialCostForRot, // För ROT-visning
            rotDeduction,
            finalCustomerPrice,
            hasRotDeduction: data.hasRotDeduction,
            kallareGluggCount: data.kallareGlugg
        });
        
        console.log('=== PRICE CALCULATION COMPLETE ===');
    }

    getCalculatedPriceData() {
        // Samla in alla värden
        const data = this.collectPricingData();

        // Summera individuella partier
        const partierTotalCost = partisState.partis.reduce((sum, parti) => {
            return sum + (parti.pris || 0);
        }, 0);

        // E-glas (inte parti-specifik)
        const extrasCost = this.calculateExtrasCost(data);

        // Beräkna prisjusteringar
        const priceAdjustment = data.priceAdjustmentPlus - data.priceAdjustmentMinus;

        // Applicera renoveringstyp-pålägg
        const renovationTypeMultiplier = CONFIG.RENOVATION_TYPE_MULTIPLIERS[data.renovationType] || 1.0;
        const renovationAdjustedTotal = (partierTotalCost + extrasCost + priceAdjustment) * renovationTypeMultiplier;

        // Beräkna summa utan materialkostnad
        const subtotalBeforeMaterial = renovationAdjustedTotal;

        // Beräkna arbetsbeskrivning-pålägg
        const workDescriptionMarkup = this.calculateWorkDescriptionMarkup(data, subtotalBeforeMaterial, priceAdjustment, 0);

        // Total summa exklusive moms
        const subtotalExclVat = subtotalBeforeMaterial + workDescriptionMarkup;

        // Moms
        const vatCost = subtotalExclVat * CONFIG.EXTRAS.VAT_RATE;

        // Total inklusive moms
        const totalInclVat = subtotalExclVat + vatCost;

        // Materialkostnad för ROT-beräkning
        const materialCostForRot = totalInclVat * (data.materialPercentage / 100);

        // Arbetskostnad för ROT-beräkning
        const workCostForRot = totalInclVat - materialCostForRot;

        // ROT-avdrag beräkning med maxbelopp
        let rotDeduction = 0;
        if (data.hasRotDeduction) {
            const calculatedRotDeduction = workCostForRot * CONFIG.EXTRAS.ROT_DEDUCTION;
            const maxRotAmount = data.isSharedRotDeduction ? 100000 : 50000;
            rotDeduction = Math.min(calculatedRotDeduction, maxRotAmount);
        }

        // Slutligt kundpris
        const finalCustomerPrice = totalInclVat - rotDeduction;

        return {
            total_excl_vat: subtotalExclVat,
            vat_amount: vatCost,
            total_incl_vat: totalInclVat,
            rot_applicable: data.hasRotDeduction,
            rot_property_eligible: data.hasRotDeduction,
            rot_customer_eligible: data.hasRotDeduction,
            rot_deduction: rotDeduction,
            customer_pays: finalCustomerPrice
        };
    }

    collectPricingData() {
        // Hjälpfunktion för att hämta numeriska värden säkert
        const getNumericValue = (id) => {
            const element = document.getElementById(id);
            const value = element?.value?.trim();
            if (!value || value === '') return 0;
            
            // Hantera både komma och punkt som decimalavskiljare
            const normalizedValue = value.replace(',', '.');
            const parsedValue = parseFloat(normalizedValue);
            
            // Returnera 0 om värdet inte är ett giltigt nummer
            return isNaN(parsedValue) ? 0 : Math.round(parsedValue);
        };
        
        return {
            // Antal enheter
            doorSections: getNumericValue('antal_dorrpartier'),
            kallareGlugg: getNumericValue('antal_kallare_glugg'),
            pardorrBalkong: getNumericValue('antal_pardorr_balkong'),
            luftare1: getNumericValue('antal_1_luftare'),
            luftare2: getNumericValue('antal_2_luftare'),
            luftare3: getNumericValue('antal_3_luftare'),
            luftare4: getNumericValue('antal_4_luftare'),
            luftare5: getNumericValue('antal_5_luftare'),
            luftare6: getNumericValue('antal_6_luftare'),
            
            // Totalt antal fönster (för vissa beräkningar) - inkluderar fönsterpartier + källare/glugg + pardörr balkong
            totalWindows: getNumericValue('window_sections') + getNumericValue('antal_kallare_glugg') + getNumericValue('antal_pardorr_balkong'),
            
            // Renoveringstyp (dropdown)
            renovationType: document.getElementById('typ_av_renovering')?.value || '',
            
            // Arbetsbeskrivning (radio buttons)
            workDescription: this.form.querySelector('input[name="arbetsbeskrivning"]:checked')?.value || '',
            
            // Fönsteröppning (radio buttons)
            windowOpening: this.form.querySelector('input[name="fonsteroppning"]:checked')?.value || 'Inåtgående',
            
            // Fönstertyp (radio buttons - endast en kan väljas)
            windowType: this.form.querySelector('input[name="typ_av_fonster"]:checked')?.value || 'Kopplade standard',
            
            // Prisjustering och material
            priceAdjustmentPlus: getNumericValue('price_adjustment_plus'),
            priceAdjustmentMinus: getNumericValue('price_adjustment_minus'),
            materialPercentage: getNumericValue('materialkostnad') || 0, // Standardvärde 0 om tomt
            
            // Spröjs
            hasSprojs: this.form.querySelector('input[name="sprojs_choice"]:checked')?.value === 'Ja',
            sprojsPerWindow: getNumericValue('antal_sprojs_per_bage'),
            windowsWithSprojs: getNumericValue('antal_fonster_med_sprojs'),
            
            // E-glas
            hasEGlass: this.form.querySelector('input[name="le_glas_choice"]:checked')?.value === 'Ja',
            eGlassSqm: getNumericValue('le_kvm'),
            
            // ROT-avdrag
            propertyRotEligible: this.form.querySelector('input[name="fastighet_rot_berättigad"]:checked')?.value || '',
            customerRotEligible: this.form.querySelector('input[name="är_du_berättigad_rot_avdrag"]:checked')?.value || '',
            hasRotDeduction: this.form.querySelector('input[name="är_du_berättigad_rot_avdrag"]:checked')?.value === 'Ja - inkludera ROT-avdrag i anbudet',
            isSharedRotDeduction: this.form.querySelector('input[name="delat_rot_avdrag"]:checked')?.value === 'Ja'
        };
    }
    
    calculateBaseComponents(data) {
        console.log('📊 calculateBaseComponents called with data:', data);
        console.log('📊 CONFIG.UNIT_PRICES:', CONFIG.UNIT_PRICES);
        
        let total = 0;
        
        // Dörrpartier
        const doorCost = data.doorSections * CONFIG.UNIT_PRICES['antal_dorrpartier'];
        console.log(`🚪 Door sections: ${data.doorSections} × ${CONFIG.UNIT_PRICES['antal_dorrpartier']} = ${doorCost}`);
        total += doorCost;
        
        // Källare/Glugg
        const kallareCost = data.kallareGlugg * CONFIG.UNIT_PRICES['antal_kallare_glugg'];
        console.log(`🏠 Källare/Glugg: ${data.kallareGlugg} × ${CONFIG.UNIT_PRICES['antal_kallare_glugg']} = ${kallareCost}`);
        total += kallareCost;
        
        // Pardörr balkong/altan
        const pardorrCost = data.pardorrBalkong * CONFIG.UNIT_PRICES['antal_pardorr_balkong'];
        console.log(`🚪 Pardörr balkong/altan: ${data.pardorrBalkong} × ${CONFIG.UNIT_PRICES['antal_pardorr_balkong']} = ${pardorrCost}`);
        total += pardorrCost;
        
        // Luftare - med fönsteröppning-multiplikator
        const windowOpeningMultiplier = CONFIG.WINDOW_OPENING_MULTIPLIERS[data.windowOpening] || 1.0;
        console.log(`🪟 Fönsteröppning: ${data.windowOpening} (multiplikator: ${windowOpeningMultiplier})`);
        
        const luftare1Cost = data.luftare1 * CONFIG.UNIT_PRICES['antal_1_luftare'] * windowOpeningMultiplier;
        const luftare2Cost = data.luftare2 * CONFIG.UNIT_PRICES['antal_2_luftare'] * windowOpeningMultiplier;
        const luftare3Cost = data.luftare3 * CONFIG.UNIT_PRICES['antal_3_luftare'] * windowOpeningMultiplier;
        const luftare4Cost = data.luftare4 * CONFIG.UNIT_PRICES['antal_4_luftare'] * windowOpeningMultiplier;
        const luftare5Cost = data.luftare5 * CONFIG.UNIT_PRICES['antal_5_luftare'] * windowOpeningMultiplier;
        const luftare6Cost = data.luftare6 * CONFIG.UNIT_PRICES['antal_6_luftare'] * windowOpeningMultiplier;
        
        console.log(`🪟 Luftare 1: ${data.luftare1} × ${CONFIG.UNIT_PRICES['antal_1_luftare']} × ${windowOpeningMultiplier} = ${luftare1Cost}`);
        console.log(`🪟 Luftare 2: ${data.luftare2} × ${CONFIG.UNIT_PRICES['antal_2_luftare']} × ${windowOpeningMultiplier} = ${luftare2Cost}`);
        console.log(`🪟 Luftare 3: ${data.luftare3} × ${CONFIG.UNIT_PRICES['antal_3_luftare']} × ${windowOpeningMultiplier} = ${luftare3Cost}`);
        console.log(`🪟 Luftare 4: ${data.luftare4} × ${CONFIG.UNIT_PRICES['antal_4_luftare']} × ${windowOpeningMultiplier} = ${luftare4Cost}`);
        console.log(`🪟 Luftare 5: ${data.luftare5} × ${CONFIG.UNIT_PRICES['antal_5_luftare']} × ${windowOpeningMultiplier} = ${luftare5Cost}`);
        console.log(`🪟 Luftare 6: ${data.luftare6} × ${CONFIG.UNIT_PRICES['antal_6_luftare']} × ${windowOpeningMultiplier} = ${luftare6Cost}`);
        
        const totalLuftareCost = luftare1Cost + luftare2Cost + luftare3Cost + luftare4Cost + luftare5Cost + luftare6Cost;
        total += totalLuftareCost;
        
        console.log(`📊 Total base components: ${total}`);
        return total;
    }
    
    calculateRenovationTypeCost(data, basePrice) {
        if (!data.renovationType) return 0;
        
        const multiplier = CONFIG.RENOVATION_TYPE_MULTIPLIERS[data.renovationType];
        
        if (typeof multiplier === 'number') {
            // Procentuell ökning/minskning
            return basePrice * (multiplier - 1);
        }
        
        return 0;
    }
    
    calculateWindowTypeCost(data, basePrice) {
        if (!data.windowType) return 0;
        
        // Beräkna totalt antal bågar: (antal 1-luftare × 1) + (antal 2-luftare × 2) + osv
        const totalBagar = (data.luftare1 || 0) * 1 + (data.luftare2 || 0) * 2 + (data.luftare3 || 0) * 3 + 
                           (data.luftare4 || 0) * 4 + (data.luftare5 || 0) * 5 + (data.luftare6 || 0) * 6;
        
        console.log('📊 Fönstertyp calculation - Total bågar:', totalBagar);
        console.log('📊 Vald fönstertyp:', data.windowType);
        
        // Hämta rabatt per båge för den valda fönstertypen
        const discountPerBage = CONFIG.WINDOW_TYPE_DISCOUNTS_PER_BAGE[data.windowType] || 0;
        
        if (discountPerBage !== 0) {
            const totalDiscount = discountPerBage * totalBagar;
            console.log(`📊 ${data.windowType}: ${discountPerBage}kr × ${totalBagar} bågar = ${totalDiscount}kr (rabatt)`);
            return totalDiscount; // Returnerar negativ värde för rabatter
        } else {
            console.log(`📊 ${data.windowType}: Ingen rabatt (standardpris)`);
            return 0;
        }
    }
    
    calculateExtrasCost(data) {
        console.log('💎 calculateExtrasCost called with data:', data);
        console.log('💎 CONFIG.EXTRAS:', CONFIG.EXTRAS);
        
        let total = 0;
        
        // Spröjs-beräkning görs nu per parti i computePris() - ingen extra beräkning här
        console.log('💎 Spröjs beräknas nu per parti, inte centralt');
        
        // E-glas: 2500kr/kvm
        if (data.hasEGlass && data.eGlassSqm > 0) {
            const eGlassCost = CONFIG.EXTRAS.E_GLASS_PER_SQM * data.eGlassSqm;
            console.log(`✨ LE-glas: ${data.eGlassSqm} kvm × ${CONFIG.EXTRAS.E_GLASS_PER_SQM} = ${eGlassCost}`);
            total += eGlassCost;
        }
        
        console.log(`💎 Total extras cost: ${total}`);
        return total;
    }
    
    calculateWorkDescriptionMarkup(data, subtotal, priceAdjustment, materialCost) {
        if (!data.workDescription) return 0;
        
        const multiplier = CONFIG.WORK_DESCRIPTION_MULTIPLIERS[data.workDescription];
        
        // Pålägg på allt utom prisjustering och material
        const baseForMarkup = subtotal - priceAdjustment - materialCost;
        return baseForMarkup * (multiplier - 1);
    }
    
    calculateMaterialCost(data, subtotal, priceAdjustment) {
        // Materialkostnad som procent av subtotal (innan priceAdjustment)
        const baseForMaterial = subtotal - priceAdjustment;
        const materialCost = baseForMaterial * (data.materialPercentage / 100);
        console.log(`Material cost calculation: ${baseForMaterial} × ${data.materialPercentage}% = ${materialCost}`);
        return Math.round(materialCost);
    }
    
    updatePriceDisplay(prices) {
        // Uppdatera alla priselement (alla exkl moms förutom slutsumman)
        this.baseComponentsPriceElement.textContent = this.formatPrice(prices.baseComponentsPrice);
        this.windowTypeCostElement.textContent = this.formatPrice(prices.windowTypeCost);
        this.extrasCostElement.textContent = this.formatPrice(prices.extrasCost);
        this.renovationMarkupElement.textContent = this.formatPrice(prices.renovationMarkup);
        this.materialCostDisplayElement.textContent = this.formatPrice(prices.materialCost);
        this.subtotalPriceElement.innerHTML = `<strong>${this.formatPrice(prices.subtotalExclVat)}</strong>`;
        this.subtotalPriceDisplayElement.textContent = this.formatPrice(prices.subtotalExclVat);
        this.vatCostElement.textContent = this.formatPrice(prices.vatCost);
        this.totalWithVatElement.innerHTML = `<strong>${this.formatPrice(prices.totalInclVat)}</strong>`; // Total inkl moms
        this.finalCustomerPriceElement.innerHTML = `<strong>${this.formatPrice(prices.finalCustomerPrice)}</strong>`; // Slutsumma: inkl moms (efter ROT)
        this.materialDeductionElement.textContent = this.formatPrice(prices.materialDeduction);
        
        // Källare/Glugg - dölj separata prisvisningar (ingår i totalpriset)
        this.kallareGluggRowElement.style.display = 'none';
        
        // ROT-avdrag - visa/dölj beroende på om det är valt
        const rotPreliminaryTextElement = document.getElementById('rot-preliminary-text');
        if (prices.hasRotDeduction && prices.rotDeduction > 0) {
            this.rotRowElement.style.display = 'block';
            this.rotDeductionElement.textContent = `-${this.formatPrice(prices.rotDeduction)}`;
            
            // Visa preliminär text
            if (rotPreliminaryTextElement) {
                rotPreliminaryTextElement.style.display = 'block';
            }
            
            // Uppdatera text beroende på om det är begränsat av maxbelopp
            const data = this.collectPricingData();
            const workCostForRot = prices.totalInclVat - (prices.totalInclVat * (data.materialPercentage / 100));
            const calculatedRotDeduction = workCostForRot * CONFIG.EXTRAS.ROT_DEDUCTION;
            const maxRotAmount = data.isSharedRotDeduction ? 100000 : 50000;
            const isLimitedByMax = calculatedRotDeduction > maxRotAmount;
            
            const rotLabel = this.rotRowElement.querySelector('span:first-child');
            if (isLimitedByMax) {
                const maxText = data.isSharedRotDeduction ? '100 000 kr' : '50 000 kr';
                const persons = data.isSharedRotDeduction ? 'två personer' : 'en person';
                rotLabel.textContent = `ROT-avdrag (max ${maxText} för ${persons}):`;
            } else {
                rotLabel.textContent = 'ROT-avdrag (50% på arbetskostnad):';
            }
        } else {
            this.rotRowElement.style.display = 'none';
            // Dölj preliminär text
            if (rotPreliminaryTextElement) {
                rotPreliminaryTextElement.style.display = 'none';
            }
        }
        
        // Materialkostnad avdrag - visa ENDAST om ROT-avdrag är aktivt
        if (prices.hasRotDeduction) {
            this.materialRowElement.style.display = 'block';
            this.materialDeductionElement.textContent = this.formatPrice(prices.materialDeduction);
        } else {
            this.materialRowElement.style.display = 'none';
        }
    }
    
    formatPrice(amount) {
        return new Intl.NumberFormat('sv-SE', {
            style: 'currency',
            currency: 'SEK',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount)
          .replace('SEK', 'kr')
          .replace(/\u00A0/g, ' '); // Replace non-breaking spaces with regular spaces
    }
    
    showGdprModal() {
        if (this.gdprModal) {
            this.gdprModal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Prevent background scroll
        }
    }
    
    hideGdprModal() {
        if (this.gdprModal) {
            this.gdprModal.style.display = 'none';
            document.body.style.overflow = ''; // Restore scroll
        }
    }
    
    validateField(field) {
        const fieldGroup = field.closest('.form-group');
        const errorElement = fieldGroup.querySelector('.error-message');
        let isValid = true;
        let errorMessage = '';
        
        // Kontrollera obligatoriska fält
        if (field.hasAttribute('required') && !field.value.trim()) {
            isValid = false;
            errorMessage = 'Detta fält är obligatoriskt';
        }
        
        // Specifik validering baserat på fälttyp
        if (field.value.trim()) {
            switch (field.type) {
                case 'email':
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(field.value)) {
                        isValid = false;
                        errorMessage = 'Ange en giltig e-postadress';
                    }
                    break;
                    
                case 'tel':
                    const phoneRegex = /^[\d\s\-\+\(\)]{8,}$/;
                    if (!phoneRegex.test(field.value.replace(/\s/g, ''))) {
                        isValid = false;
                        errorMessage = 'Ange ett giltigt telefonnummer';
                    }
                    break;
                    
                default:
                    if (field.name === 'postal_code') {
                        const postalRegex = /^[0-9]{5}$/;
                        if (!postalRegex.test(field.value)) {
                            isValid = false;
                            errorMessage = 'Ange ett giltigt postnummer (5 siffror)';
                        }
                    }
                    break;
            }
        }
        
        // Validera radio buttons separat
        if (field.type === 'radio' && field.hasAttribute('required')) {
            const radioGroup = this.form.querySelectorAll(`input[name="${field.name}"]`);
            const isRadioSelected = Array.from(radioGroup).some(radio => radio.checked);
            if (!isRadioSelected) {
                isValid = false;
                errorMessage = 'Vänligen välj ett alternativ';
            }
        }
        
        // Visa eller dölj felmeddelande
        if (!isValid) {
            fieldGroup.classList.add('error');
            if (errorElement) {
                errorElement.textContent = errorMessage;
                errorElement.classList.add('show');
            }
        } else {
            fieldGroup.classList.remove('error');
            if (errorElement) {
                errorElement.textContent = '';
                errorElement.classList.remove('show');
            }
        }
        
        return isValid;
    }
    
    clearFieldError(field) {
        const fieldGroup = field.closest('.form-group') || field.closest('.radio-group')?.closest('.form-group');
        const errorElement = fieldGroup?.querySelector('.error-message');
        
        if (fieldGroup) {
            fieldGroup.classList.remove('error');
        }
        
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.classList.remove('show');
        }
    }
    
    validateForm() {
        let isFormValid = true;
        
        // Validera individuella partier först
        if (!this.validateParties()) {
            isFormValid = false;
        }
        
        // Kontrollera att minst ett antal-fält har värde > 0
        const quantityFields = [
            'window_sections', 'antal_dorrpartier', 'antal_kallare_glugg', 'antal_1_luftare', 'antal_2_luftare',
            'antal_3_luftare', 'antal_4_luftare', 'antal_5_luftare', 'antal_6_luftare'
        ];
        
        const hasQuantityValues = quantityFields.some(fieldId => {
            const field = document.getElementById(fieldId);
            return field && parseInt(field.value) > 0;
        });
        
        if (!hasQuantityValues) {
            // Visa felmeddelande för partier
            this.partiesValidationText.textContent = 
                'Du måste ange minst ett antal för fönsterpartier, dörrpartier eller luftare';
            this.partiesValidation.className = 'validation-message error';
            this.partiesValidation.style.display = 'block';
            isFormValid = false;
        }
        
        // Validera alla obligatoriska textfält
        const requiredFields = this.form.querySelectorAll('input[required], textarea[required]');
        requiredFields.forEach(field => {
            if (!this.validateField(field)) {
                isFormValid = false;
            }
        });
        
        // Validera dropdown och radio buttons
        const requiredSelects = [
            { name: 'typ_av_renovering', message: 'Vänligen välj typ av renovering' }
        ];
        
        requiredSelects.forEach(select => {
            const element = document.getElementById(select.name);
            if (!element || !element.value) {
                isFormValid = false;
                const groupElement = element?.closest('.form-group');
                const errorElement = groupElement?.querySelector('.error-message');
                if (groupElement) groupElement.classList.add('error');
                if (errorElement) {
                    errorElement.textContent = select.message;
                    errorElement.classList.add('show');
                }
            }
        });
        
        const radioGroups = [
            { name: 'arbetsbeskrivning', message: 'Vänligen välj arbetsbeskrivning' },
            { name: 'fastighet_rot_berättigad', message: 'Vänligen ange om fastigheten är berättigad ROT-avdrag' },
            { name: 'är_du_berättigad_rot_avdrag', message: 'Vänligen ange om kunden är berättigad ROT-avdrag' }
        ];
        
        radioGroups.forEach(group => {
            const radios = this.form.querySelectorAll(`input[name="${group.name}"]`);
            const isSelected = Array.from(radios).some(radio => radio.checked);
            if (!isSelected) {
                isFormValid = false;
                const groupElement = radios[0].closest('.form-group');
                const errorElement = groupElement.querySelector('.error-message');
                groupElement.classList.add('error');
                if (errorElement) {
                    errorElement.textContent = group.message;
                    errorElement.classList.add('show');
                }
            }
        });
        
        // Validera GDPR-godkännande
        if (this.gdprConsent && !this.gdprConsent.checked) {
            isFormValid = false;
            if (this.gdprConsentError) {
                this.gdprConsentError.textContent = 'Du måste godkänna behandling av personuppgifter för att skicka förfrågan';
                this.gdprConsentError.classList.add('show');
            }
            const gdprSection = this.gdprConsent.closest('.form-group');
            if (gdprSection) {
                gdprSection.classList.add('error');
            }
        }
        
        return isFormValid;
    }
    
    async handleFormSubmission() {
        // Validera formuläret
        if (!this.validateForm()) {
            this.scrollToFirstError();
            return;
        }
        
        // Visa loading state
        this.setSubmitButtonLoading(true);
        this.hideMessages();
        
        try {
            // Ingen Zapier: vi visar framgång när användaren genererat PDF:er i Offert
            this.showSuccessMessage();
            this.resetForm();
        } catch (error) {
            console.error('Fel vid formulärflöde:', error);
            this.showErrorMessage();
        } finally {
            this.setSubmitButtonLoading(false);
        }
    }
    
    // BORTTAGET: collectFormData() ersatt med webhook-funktionalitet
    /*collectFormData() {
        const formData = new FormData();
        
        // Auto-fill fastighetsbeteckning om tomt
        const fastighetsbeteckningField = document.getElementById('fastighetsbeteckning');
        if (fastighetsbeteckningField && !fastighetsbeteckningField.value.trim()) {
            fastighetsbeteckningField.value = '-';
        }
        
        // Auto-fill alla numeriska fält med 0 om de är tomma
        const numericFields = [
            'window_sections',
            'antal_dorrpartier', 
            'antal_1_luftare',
            'antal_2_luftare',
            'antal_3_luftare', 
            'antal_4_luftare',
            'antal_5_luftare',
            'antal_6_luftare',
            'antal_sprojs_per_bage',
            'antal_fonster_med_sprojs',
            'le_kvm',
            'price_adjustment_plus',
            'price_adjustment_minus'
        ];
        
        numericFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field && (!field.value || field.value.trim() === '')) {
                field.value = '0';
            }
        });
        
        // Samla in alla formulärfält
        Object.keys(CONFIG.FORM_FIELDS).forEach(fieldName => {
            // Special hantering för typ_av_fonster radiobuttons
            if (fieldName === 'typ_av_fonster') {
                const checkedRadio = this.form.querySelector(`input[name="typ_av_fonster"]:checked`);
                if (checkedRadio) {
                    formData.append(CONFIG.FORM_FIELDS[fieldName], checkedRadio.value);
                }
                return;
            }
            
            // Hoppa över fält som inte finns i formuläret (nya mappade fält)
            if (['fukt', 'våning', 'fastighetstyp'].includes(fieldName)) {
                return;
            }
            
            const field = this.form.querySelector(`[name="${fieldName}"]`);
            let value = '';
            
            if (field) {
                if (field.type === 'checkbox') {
                    value = field.checked ? 'Ja' : 'Nej';
                } else if (field.type === 'radio') {
                    const selectedRadio = this.form.querySelector(`input[name="${fieldName}"]:checked`);
                    value = selectedRadio ? selectedRadio.value : '';
                } else {
                    value = field.value;
                }
                
                // Endast lägg till fält med värden (undvik tomma radio buttons)
                if (value !== '') {
                    formData.append(CONFIG.FORM_FIELDS[fieldName], value);
                }
            } else {
                // Hantera radio buttons som kanske inte hittas med querySelector direkt
                if (fieldName === 'fastighet_rot_berättigad' || fieldName === 'är_du_berättigad_rot_avdrag') {
                    const selectedRadio = this.form.querySelector(`input[name="${fieldName}"]:checked`);
                    if (selectedRadio) {
                        formData.append(CONFIG.FORM_FIELDS[fieldName], selectedRadio.value);
                    }
                }
            }
        });
        
        // Lägg till detaljerad prisberäkning och ROT-avdrag information
        const data = this.collectPricingData();
        const baseComponentsPrice = this.calculateBaseComponents(data);
        const renovationTypeCost = this.calculateRenovationTypeCost(data, baseComponentsPrice);
        const windowTypeCost = this.calculateWindowTypeCost(data, baseComponentsPrice);
        const extrasCost = this.calculateExtrasCost(data);
        const subtotalBeforeMaterial = baseComponentsPrice + renovationTypeCost + windowTypeCost + extrasCost;
        const workDescriptionMarkup = this.calculateWorkDescriptionMarkup(data, subtotalBeforeMaterial, 0, 0);
        const subtotalExclVat = subtotalBeforeMaterial + workDescriptionMarkup;
        const vatCost = subtotalExclVat * CONFIG.EXTRAS.VAT_RATE;
        const totalInclVat = subtotalExclVat + vatCost;
        const materialCostForRot = totalInclVat * (data.materialPercentage / 100);
        const workCostForRot = totalInclVat - materialCostForRot;
        // ROT-avdrag med maxbelopp-logik
        let rotDeduction = 0;
        if (data.hasRotDeduction) {
            const calculatedRotDeduction = workCostForRot * CONFIG.EXTRAS.ROT_DEDUCTION;
            const maxRotAmount = data.isSharedRotDeduction ? 100000 : 50000;
            rotDeduction = Math.min(calculatedRotDeduction, maxRotAmount);
        }
        const finalCustomerPrice = totalInclVat - rotDeduction;
        
        // Lägg till beräknat ROT-avdrag som separat fält
        if (data.hasRotDeduction && rotDeduction > 0) {
            formData.append('entry.ROT_CALCULATED_AMOUNT', this.formatPrice(rotDeduction));
        }
        
        // Skapa detaljerad prissammanfattning för Google Forms
        const priceBreakdown = `
PRISBERÄKNING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Grundkomponenter:
- Luftare och dörrar: ${this.formatPrice(baseComponentsPrice)}
- Renoveringstyp (${data.renovationType}): ${this.formatPrice(renovationTypeCost)}
- Fönsteröppning (${data.windowOpening}): Inkluderat i grundpris
- Fönstertyp (${data.windowType || 'Ingen vald'}): ${this.formatPrice(windowTypeCost)}
- Spröjs/E-glas: ${this.formatPrice(extrasCost)}
- Material (endast för ROT-beräkning): -
- Arbetsbeskrivning (${data.workDescription}): ${this.formatPrice(workDescriptionMarkup)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Summa exkl. moms: ${this.formatPrice(subtotalExclVat)}
Moms (25%): ${this.formatPrice(vatCost)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Totalt inkl. moms: ${this.formatPrice(totalInclVat)}

ROT-AVDRAG INFORMATION:
- Fastighet berättigad: ${data.propertyRotEligible}
- Kund berättigad: ${data.customerRotEligible}
${data.hasRotDeduction ? `- Materialkostnad (${data.materialPercentage}%): ${this.formatPrice(materialCostForRot)}\n- Arbetskostnad: ${this.formatPrice(workCostForRot)}\n- ROT-avdrag (50% på arbetskostnad): -${this.formatPrice(rotDeduction)}` : '- ROT-avdrag: Ej tillämpligt'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KUNDEN BETALAR: ${this.formatPrice(finalCustomerPrice)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        
        formData.append('entry.calculated_price', priceBreakdown);
        
        return formData;
    }*/
    
    // Ingen Zapier / webhook – funktionen borttagen
    
    async handleArbetsbeskrivningSubmission() {
        const arbetsForm = document.getElementById('arbetsbeskrivning-form');
        if (!arbetsForm) return;
        
        // Validera formuläret
        if (!this.validateArbetsbeskrivningForm()) {
            return;
        }
        
        const submitBtn = document.getElementById('arb-submit-btn');
        const loadingSpinner = document.getElementById('arb-loading-spinner');
        
        this.setSubmitButtonLoading(true, submitBtn, loadingSpinner);
        
        try {
            // BORTTAGET: Google Forms arbetsbeskrivning submission
            // TODO: Implementera webhook för arbetsbeskrivningar om behövs
            /*
            const formData = this.collectArbetsbeskrivningData();
            await this.submitArbetsbeskrivningToGoogleForms(formData);
            */
            
            // Visa framgångsmeddelande
            this.showArbetsbeskrivningSuccessMessage();
            this.resetBothForms();
            
        } catch (error) {
            console.error('Fel vid skickning av arbetsbeskrivning:', error);
            this.showArbetsbeskrivningErrorMessage();
        } finally {
            this.setSubmitButtonLoading(false, submitBtn, loadingSpinner);
        }
    }
    
    validateArbetsbeskrivningForm() {
        const arbetsForm = document.getElementById('arbetsbeskrivning-form');
        if (!arbetsForm) return false;
        
        let isValid = true;
        
        // Validera obligatoriska fält
        const requiredFields = [
            { id: 'arb-gdpr-consent', message: 'Du måste godkänna behandling av personuppgifter', type: 'checkbox' }
        ];
        
        requiredFields.forEach(field => {
            const element = document.getElementById(field.id);
            const errorElement = document.getElementById(field.id + '-error');
            
            if (!element) return;
            
            let hasError = false;
            
            if (field.type === 'checkbox') {
                hasError = !element.checked;
            } else {
                hasError = !element.value || element.value.trim() === '';
            }
            
            if (hasError) {
                isValid = false;
                if (errorElement) {
                    errorElement.textContent = field.message;
                    errorElement.classList.add('show');
                }
                element.closest('.form-group')?.classList.add('error');
            } else {
                if (errorElement) {
                    errorElement.textContent = '';
                    errorElement.classList.remove('show');
                }
                element.closest('.form-group')?.classList.remove('error');
            }
        });
        
        // Arbetsbeskrivning validering borttagen - styrs nu från Anbud-fliken
        
        return isValid;
    }
    
    // BORTTAGET: Google Forms arbetsbeskrivning data collection
    /*collectArbetsbeskrivningData() {
        const formData = new FormData();
        const arbetsForm = document.getElementById('arbetsbeskrivning-form');
        
        if (!arbetsForm) return formData;
        
        // Samla in alla arbetsbeskrivning fält
        Object.keys(CONFIG.ARBETSBESKRIVNING_FIELDS).forEach(fieldName => {
            let value = '';
            
            if (fieldName === 'arb-gdpr-consent') {
                const field = document.getElementById('arb-gdpr-consent');
                value = field && field.checked ? 'Ja' : 'Nej';
            } else {
                const field = arbetsForm.querySelector(`[name="${fieldName}"]`);
                
                if (field) {
                    if (field.type === 'radio') {
                        const selectedRadio = arbetsForm.querySelector(`input[name="${fieldName}"]:checked`);
                        value = selectedRadio ? selectedRadio.value : '';
                    } else {
                        value = field.value || '';
                    }
                }
            }
            
            if (value !== '') {
                formData.append(CONFIG.ARBETSBESKRIVNING_FIELDS[fieldName], value);
            }
        });
        
        // Samla in moment checklista data
        const momentData = this.collectMomentChecklistaData();
        if (momentData) {
            formData.append('entry.MOMENT_CHECKLISTA', momentData);
        }
        
        return formData;
    }*/
    
    // Removed: collectMomentChecklistaData() - replaced with dynamic work description
    
    // BORTTAGET: Google Forms arbetsbeskrivning submission
    /*async submitArbetsbeskrivningToGoogleForms(formData) {
        // Hämta renoveringstyp för att välja rätt form
        const renovationTypeSelect = document.getElementById('arb_typ_av_renovering');
        const renovationType = renovationTypeSelect ? renovationTypeSelect.value : '';
        
        // Välj rätt Google Forms URL
        let formUrl = CONFIG.ARBETSBESKRIVNING_FORMS[renovationType];
        
        if (!formUrl || formUrl.includes('EXAMPLE_')) {
            throw new Error('Google Forms URL är inte konfigurerad för denna renoveringstyp');
        }
        
        const response = await fetch(formUrl, {
            method: 'POST',
            mode: 'no-cors',
            body: formData
        });
        
        return true;
    }*/
    
    showArbetsbeskrivningSuccessMessage() {
        const successMessage = document.getElementById('arb-success-message');
        if (successMessage) {
            successMessage.style.display = 'block';
            successMessage.scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    showArbetsbeskrivningErrorMessage() {
        const errorMessage = document.getElementById('arb-error-message');
        if (errorMessage) {
            errorMessage.style.display = 'block';
            errorMessage.scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    resetBothForms() {
        // Reset both forms
        this.resetForm();
        
        const arbetsForm = document.getElementById('arbetsbeskrivning-form');
        if (arbetsForm) {
            arbetsForm.reset();
        }
        
        // Clear localStorage data
        localStorage.removeItem('sternbecks_anbud_data');
        localStorage.removeItem('sternbecks_arbetsbeskrivning_data');
        
        // Clear dynamic work description
        const workDescriptionContainer = document.getElementById('generated-work-description');
        if (workDescriptionContainer) {
            workDescriptionContainer.innerHTML = `
                <div class="info-message">
                    <p>Arbetsbeskrivningen genereras automatiskt baserat på dina val från Anbud-fliken.</p>
                </div>
            `;
        }
        
        // Switch back to anbud tab
        this.switchTab('anbud');
        
        console.log('✅ Both forms reset and data cleared');
    }
    
    setSubmitButtonLoading(loading, submitBtn = null, loadingSpinner = null) {
        // Använd specifika knappar om angivna, annars använd default anbud-knappen
        const btn = submitBtn || this.submitBtn;
        const spinner = loadingSpinner || document.getElementById('loading-spinner');
        
        if (loading) {
            btn.classList.add('loading');
            btn.disabled = true;
            if (spinner) {
                spinner.style.display = 'block';
            }
        } else {
            btn.classList.remove('loading');
            btn.disabled = false;
            if (spinner) {
                spinner.style.display = 'none';
            }
        }
    }
    

    showSuccessMessage() {
        this.successMessage.style.display = 'block';
        this.form.style.display = 'none';
        this.successMessage.scrollIntoView({ behavior: 'smooth' });
    }
    
    showErrorMessage() {
        this.errorMessage.style.display = 'block';
        this.errorMessage.scrollIntoView({ behavior: 'smooth' });
    }
    
    hideMessages() {
        this.successMessage.style.display = 'none';
        this.errorMessage.style.display = 'none';
    }
    
    resetForm() {
        this.form.reset();
        
        // Återställ materialkostnad till 0% (visas bara vid ROT)
        document.getElementById('materialkostnad').value = '0';
        
        this.updatePriceCalculation();
        
        // Rensa alla felmeddelanden
        const errorElements = this.form.querySelectorAll('.error-message');
        const errorGroups = this.form.querySelectorAll('.form-group.error');
        
        errorElements.forEach(el => {
            el.textContent = '';
            el.classList.remove('show');
        });
        
        errorGroups.forEach(group => {
            group.classList.remove('error');
        });
        
        // Visa formuläret igen efter 3 sekunder för att ge användaren tid att läsa meddelandet
        setTimeout(() => {
            this.successMessage.style.display = 'none';
            this.form.style.display = 'block';
            
            // Scrolla tillbaka till toppen av formuläret
            this.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 3000);
    }
    
    scrollToFirstError() {
        const firstError = this.form.querySelector('.form-group.error');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    scrollToParti(partiId) {
        // Hitta parti-sektionen med det givna ID:t
        const partiSections = document.querySelectorAll('.parti-section');
        const targetIndex = partisState.partis.findIndex(p => p.id === partiId);
        
        if (targetIndex >= 0 && partiSections[targetIndex]) {
            partiSections[targetIndex].scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
            
            // Lägg till visuell highlight för att visa vilket parti som har problem
            partiSections[targetIndex].style.border = '2px solid #ff4444';
            setTimeout(() => {
                partiSections[targetIndex].style.border = '';
            }, 3000);
        }
    }

    // ============= HELPER FUNCTIONS =============
    
    getLuftareCount(parti) {
        // "luftare" som används i spröjsformeln beror på parti-typ:
        switch (parti.partiType) {
            case "dorr":
            case "kallare_glugg":
                return 1; // Räkna som 1-luftare
            case "flak":
                // Flak: 1 bas-luftare + extra luftare
                return 1 + (Number.isInteger(parti.extraLuftare) ? parti.extraLuftare : 0);
            case "pardorr_balkong":
                // Pardörr balkong/altan: 2 bas-luftare + extra luftare
                return 2 + (Number.isInteger(parti.extraLuftare) ? parti.extraLuftare : 0);
            case "fonster":
                // Använd valt antal luftare i partiet
                const m = String(parti.luftareType ?? '').match(/\d+/);
                return m ? parseInt(m[0], 10) : 0;
            default:
                return 0; // Ingen spröjs om parti-typ inte är vald
        }
    }
    
    // ============= PARTI MANAGEMENT FUNCTIONS =============
    
    createParties(n) {
        console.log(`🏭 createParties(${n}) ANROPAD - isDuplicating: ${partisState.isDuplicating}`);
        console.log(`🏭 Partier FÖRE createParties: ${partisState.partis.length}`);
        
        // Extra skydd: skippa om vi redan har rätt antal
        if (Array.isArray(partisState.partis) && partisState.partis.length === n) {
            console.log(`🏭 Hoppar över createParties - har redan ${n} partier`);
            return;
        }
        
        console.log(`🏭 Skapar ${n} nya tomma partier`);
        partisState.partis = Array.from({length: n}, (_, i) => ({
            id: i + 1,
            partiType: "",
            luftareType: "",
            workDesc: "",
            openDir: "",
            winType: "",
            sprojs: null,
            pris: null
        }));
        console.log('🏭 Nya partier skapade:', partisState.partis);
        this.renderParties();
        this.syncLegacyFields();
    }

    renderParties() {
        const container = document.getElementById('parties-container');
        const configSection = document.getElementById('parti-config-section');
        
        if (!container || !configSection) return;

        // Visa/dölj sektionen baserat på om det finns partier
        if (partisState.partis.length === 0) {
            configSection.style.display = 'none';
            return;
        }

        configSection.style.display = 'block';
        container.innerHTML = '';

        partisState.partis.forEach((parti, index) => {
            const partiDiv = document.createElement('div');
            partiDiv.className = 'form-section parti-section';
            partiDiv.innerHTML = this.renderPartiSection(parti);
            container.appendChild(partiDiv);
        });
    }

    renderPartiSection(parti) {
        const isCustomSprojs = parti.sprojs !== null && parti.sprojs !== undefined && !SPROJS_PRESETS.includes(parseInt(parti.sprojs));
        const isWindowType = parti.partiType === 'fonster';
        
        return `
            <div class="parti-header">
                <h4>Parti ${parti.id}</h4>
                <div class="parti-actions">
                    <button type="button" class="btn-small duplicate-btn" data-action="duplicate" data-parti-id="${parti.id}" title="Kopiera föregående parti">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Kopiera föregående
                    
                    </button>
                    <div class="price-display-inline">
                        <strong>${this.formatSEK(parti.pris || 0)}</strong>
                    </div>
                </div>
            </div>
            
            <div class="parti-controls">
                <div class="form-group compact">
                    <label for="partiType_${parti.id}">Typ av parti *</label>
                    <select id="partiType_${parti.id}" name="partiType_${parti.id}" class="form-select" required>
                        <option value="">Välj typ...</option>
                        ${PARTI_TYPES.map(type => `
                            <option value="${type.value}" ${parti.partiType === type.value ? 'selected' : ''}>${type.label}</option>
                        `).join('')}
                    </select>
                </div>

                <!-- Luftare - endast för fönster -->
                <div class="form-group compact" style="display: ${isWindowType ? 'block' : 'none'};" id="luftareGroup_${parti.id}">
                    <label for="luftareType_${parti.id}">Antal luftare *</label>
                    <select id="luftareType_${parti.id}" name="luftareType_${parti.id}" class="form-select" ${isWindowType ? 'required' : ''}>
                        <option value="">Välj antal luftare...</option>
                        ${LUFTARE_TYPES.map(luftare => `
                            <option value="${luftare.value}" ${parti.luftareType === luftare.value ? 'selected' : ''}>${luftare.label}</option>
                        `).join('')}
                    </select>
                </div>

                <!-- Extra Luftare - för flak och pardörr balkong/altan -->
                <div class="form-group compact" style="display: ${(parti.partiType === 'flak' || parti.partiType === 'pardorr_balkong') ? 'block' : 'none'};" id="extraLuftareGroup_${parti.id}">
                    <label for="extraLuftareType_${parti.id}">Antal extra luftare *</label>
                    <select id="extraLuftareType_${parti.id}" name="extraLuftareType_${parti.id}" class="form-select" ${(parti.partiType === 'flak' || parti.partiType === 'pardorr_balkong') ? 'required' : ''}>
                        <option value="">Välj antal extra luftare...</option>
                        ${EXTRA_LUFTARE_TYPES.map(extra => `
                            <option value="${extra.value}" ${parti.extraLuftare === extra.value ? 'selected' : ''}>${extra.label}</option>
                        `).join('')}
                    </select>
                </div>

                <!-- Arbetsbeskrivning - för alla typer -->
                <div class="form-group compact">
                    <label for="workDesc_${parti.id}">Arbetsbeskrivning *</label>
                    <select id="workDesc_${parti.id}" name="workDesc_${parti.id}" class="form-select" required>
                        <option value="">Välj arbetsbeskrivning...</option>
                        ${WORK_DESC.map(desc => `
                            <option value="${desc.value}" ${parti.workDesc === desc.value ? 'selected' : ''}>${desc.label}</option>
                        `).join('')}
                    </select>
                </div>

                <!-- Fönsteröppning - för alla typer -->
                <div class="form-group compact">
                    <label for="openDir_${parti.id}">${isWindowType ? 'Fönsteröppning' : 'Öppningsriktning'} *</label>
                    <select id="openDir_${parti.id}" name="openDir_${parti.id}" class="form-select" required>
                        <option value="">Välj öppningsriktning...</option>
                        ${OPEN_DIR.map(dir => `
                            <option value="${dir.value}" ${parti.openDir === dir.value ? 'selected' : ''}>${dir.label}</option>
                        `).join('')}
                    </select>
                </div>

                <!-- Typ av fönster - för alla typer -->
                <div class="form-group compact">
                    <label for="winType_${parti.id}">${isWindowType ? 'Typ av fönster' : 'Typ av beslag/glas'} *</label>
                    <select id="winType_${parti.id}" name="winType_${parti.id}" class="form-select" required>
                        <option value="">Välj typ...</option>
                        ${WINDOW_TYPES.map(type => `
                            <option value="${type.value}" ${parti.winType === type.value ? 'selected' : ''}>${type.label}</option>
                        `).join('')}
                    </select>
                </div>

                <!-- Spröjs - för alla typer -->
                <div class="form-group compact">
                    <label for="sprojs_select_${parti.id}">Antal spröjs</label>
                    <select id="sprojs_select_${parti.id}" name="sprojs_select_${parti.id}" class="form-select">
                        ${SPROJS_PRESETS.map(count => 
                            `<option value="${count}" ${parti.sprojs == count ? 'selected' : ''}>${count} spröjs</option>`
                        ).join('')}
                        <option value="custom" ${isCustomSprojs ? 'selected' : ''}>Annat</option>
                    </select>
                    <input type="number" id="sprojs_custom_${parti.id}" name="sprojs_custom_${parti.id}" 
                           min="0" placeholder="Ange antal spröjs" inputmode="numeric"
                           style="display: ${isCustomSprojs ? 'block' : 'none'}; margin-top: 8px;"
                           value="${isCustomSprojs ? parti.sprojs : ''}"
                           class="form-select compact-input">
                </div>
            </div>
        `;
    }

    formatSEK(amount) {
        return new Intl.NumberFormat('sv-SE', {
            style: 'currency',
            currency: 'SEK',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    computePris(parti) {
        let bas = 0;
        
        // Baspriser per parti-typ (använd CONFIG-priserna)
        switch (parti.partiType) {
            case "fonster":
                // För fönster, använd luftare-priser från CONFIG
                if (parti.luftareType) {
                    const luftareKey = `antal_${parti.luftareType}`;
                    bas = CONFIG.UNIT_PRICES[luftareKey] || 0;
                }
                break;
            case "dorr":
                bas = CONFIG.UNIT_PRICES['antal_dorrpartier'] || 0;
                break;
            case "kallare_glugg":
                bas = CONFIG.UNIT_PRICES['antal_kallare_glugg'] || 0;
                break;
            case "pardorr_balkong":
                bas = CONFIG.UNIT_PRICES['antal_pardorr_balkong'] || 0;
                // Lägg till extra luftare-kostnad (2750kr per extra luftare)
                if (Number.isInteger(parti.extraLuftare) && parti.extraLuftare > 0) {
                    bas += parti.extraLuftare * 2750;
                }
                break;
            case "flak":
                bas = CONFIG.UNIT_PRICES['antal_flak'] || 0;
                // Lägg till extra luftare-kostnad (2750kr per extra luftare)
                if (Number.isInteger(parti.extraLuftare) && parti.extraLuftare > 0) {
                    bas += parti.extraLuftare * 2750;
                }
                break;
            default:
                bas = 0;
        }
        
        // Arbetsbeskrivning påverkan - pålägg på baspriset
        if (parti.workDesc === "invandig") {
            // Invändig renovering: +25% på baspriset
            bas = Math.round(bas * 1.25);
        } else if (parti.workDesc === "utv_plus_innermal") {
            // Utvändig renovering samt målning av innerbågens insida: +5% på baspriset
            bas = Math.round(bas * 1.05);
        }
        
        // Fönstertyp-tillägg per luftare enligt nya specifikationen
        if (parti.winType) {
            const luftareAntal = this.getLuftareCount(parti);
            switch (parti.winType) {
                case "kopplade_standard":
                    // 0 kr (baspris)
                    break;
                case "isolerglas":
                    // -400 kr per luftare
                    bas += -400 * luftareAntal;
                    break;
                case "kopplade_isolerglas":
                    // +500 kr per luftare
                    bas += 500 * luftareAntal;
                    break;
                case "insats_yttre":
                    // -400 kr per luftare
                    bas += -400 * luftareAntal;
                    break;
                case "insats_inre":
                    // -1250 kr per luftare
                    bas += -1250 * luftareAntal;
                    break;
                case "insats_komplett":
                    // +1000 kr per luftare
                    bas += 1000 * luftareAntal;
                    break;
            }
        }
        
        // Öppningsriktning påverkan - NY LOGIK
        if (parti.openDir === "utatgaende") {
            // Utåtgående: +5% på totalsumman
            bas = Math.round(bas * 1.05);
        }
        // Inåtgående: 0% (baspris) - ingen förändring
        
        // === Spröjs per parti ===
        // Regel: 
        // - 1–3 spröjs: 250 kr per spröjs
        // - 4+ spröjs: 400 kr per spröjs (på ALLA)
        const luftareAntal = this.getLuftareCount(parti); // 1..6
        let sprojsAdd = 0;

        if (Number.isInteger(parti.sprojs) && parti.sprojs > 0 && luftareAntal > 0) {
            const rate = parti.sprojs >= 4 ? 400 : 250;
            sprojsAdd = rate * parti.sprojs * luftareAntal;
        }

        bas += sprojsAdd;
        
        return Math.round(bas);
    }

    syncLegacyFields() {
        console.log('🔧 syncLegacyFields ANROPAD - isDuplicating:', partisState.isDuplicating);
        
        const f = partisState.partis;
        
        // Räkna olika parti-typer
        const antalFonster = f.filter(p => p.partiType === 'fonster').length;
        const antalDorr = f.filter(p => p.partiType === 'dorr').length;
        const antalKallareGlugg = f.filter(p => p.partiType === 'kallare_glugg').length;
        const antalPardorrBalkong = f.filter(p => p.partiType === 'pardorr_balkong').length;
        const antalFlak = f.filter(p => p.partiType === 'flak').length;
        
        // Räkna luftare per typ (endast för fönster)
        const luftareCounts = {
            '1_luftare': 0,
            '2_luftare': 0, 
            '3_luftare': 0,
            '4_luftare': 0,
            '5_luftare': 0,
            '6_luftare': 0
        };
        
        f.filter(p => p.partiType === 'fonster').forEach(parti => {
            if (parti.luftareType) {
                luftareCounts[parti.luftareType] = (luftareCounts[parti.luftareType] || 0) + 1;
            }
        });
        
        // Spröjs-härledning (för alla parti-typer)
        const partierMedSprojs = f.filter(p => Number.isInteger(p.sprojs) && p.sprojs > 0);
        const antalMedSprojs = partierMedSprojs.length;
        let antalSprojsPerBage = 0;
        if (partierMedSprojs.length > 0) {
            const totalSprojs = partierMedSprojs.reduce((sum, p) => sum + (p.sprojs || 0), 0);
            antalSprojsPerBage = Math.round(totalSprojs / partierMedSprojs.length);
        }

        // Sätt legacy-fält
        this.setHidden("legacy_window_sections", antalFonster);
        this.setHidden("antal_dorrpartier", antalDorr);
        this.setHidden("antal_kallare_glugg", antalKallareGlugg);
        this.setHidden("antal_pardorr_balkong", antalPardorrBalkong);
        
        // Sätt luftare-fält
        Object.entries(luftareCounts).forEach(([luftareType, count]) => {
            this.setHidden(`antal_${luftareType}`, count);
        });
        
        // Sätt spröjs-fält
        this.setHidden("antal_fonster_med_sprojs", antalMedSprojs);  
        this.setHidden("antal_sprojs_per_bage", antalSprojsPerBage);

        console.log('Legacy fields updated:', {
            antalFonster, antalDorr, antalKallareGlugg, antalPardorrBalkong, antalFlak,
            luftareCounts, antalMedSprojs, antalSprojsPerBage
        });
    }

    setHidden(id, value) {
        const element = document.getElementById(id);
        if (element) {
            console.log(`🔧 setHidden: ${id} = ${value} (isDuplicating: ${partisState.isDuplicating})`);
            element.value = value;
        } else {
            console.warn(`Hidden field not found: ${id}`);
        }
    }

    setupPartiEventListeners() {
        const container = document.getElementById('parties-container');
        if (!container) return;
        if (partiListenersBound) return; // Skydd mot dubletter
        partiListenersBound = true;

        // Event listener för kopiera föregående-knappar
        container.addEventListener('click', (e) => {
            // Hitta knappen i händelsekedjan (e.target kan vara SVG eller text)
            const button = e.target.closest('[data-action]');
            if (!button) return; // Viktigt: gör INGENTING för icke-knappar
            
            const action = button.dataset.action;
            if (action === 'duplicate') {
                e.preventDefault();
                e.stopPropagation(); // Endast för just knappen
                console.log('🔄 Kopiera-knapp klickad:', button);
                const partiId = parseInt(button.dataset.partiId);
                if (partiId) {
                    console.log('🔄 Kopierar parti med ID:', partiId);
                    this.duplicatePrevParti(partiId);
                } else {
                    console.error('🔄 Inget parti-ID hittades i knappen');
                }
            }
        });

        // Event listener för ändringar
        container.addEventListener('change', (e) => {
            if (e.target.tagName === 'SELECT' || e.target.type === 'number') {
                const match = e.target.name.match(/^(partiType|luftareType|extraLuftareType|workDesc|openDir|winType|sprojs_select|sprojs_custom)_(\d+)$/) ||
                             e.target.id.match(/^(partiType|luftareType|extraLuftareType|workDesc|openDir|winType|sprojs_select|sprojs_custom)_(\d+)$/);
                if (match) {
                    const field = match[1];
                    const partiId = parseInt(match[2]);
                    const parti = partisState.partis.find(p => p.id === partiId);
                    
                    if (parti) {
                        if (field === 'partiType') {
                            parti.partiType = e.target.value;
                            
                            // Visa/dölj endast luftare-fält (andra fält visas för alla typer nu)
                            const isWindowType = e.target.value === 'fonster';
                            const isExtraLuftareType = e.target.value === 'flak' || e.target.value === 'pardorr_balkong';
                            
                            const luftareGroup = document.getElementById(`luftareGroup_${partiId}`);
                            if (luftareGroup) {
                                luftareGroup.style.display = isWindowType ? 'block' : 'none';
                                const select = luftareGroup.querySelector('select');
                                if (select) {
                                    if (isWindowType) {
                                        select.setAttribute('required', '');
                                    } else {
                                        select.removeAttribute('required');
                                    }
                                }
                            }
                            
                            const extraLuftareGroup = document.getElementById(`extraLuftareGroup_${partiId}`);
                            if (extraLuftareGroup) {
                                extraLuftareGroup.style.display = isExtraLuftareType ? 'block' : 'none';
                                const select = extraLuftareGroup.querySelector('select');
                                if (select) {
                                    if (isExtraLuftareType) {
                                        select.setAttribute('required', '');
                                    } else {
                                        select.removeAttribute('required');
                                    }
                                }
                            }
                            
                            // Rensa värden när de inte gäller
                            if (!isWindowType) {
                                parti.luftareType = "";
                            }
                            if (!isExtraLuftareType) {
                                parti.extraLuftare = null;
                            }
                            
                        } else if (field === 'sprojs_select') {
                            if (e.target.value === 'custom') {
                                document.getElementById(`sprojs_custom_${partiId}`).style.display = 'block';
                                return;
                            } else {
                                parti.sprojs = parseInt(e.target.value) || 0;
                                document.getElementById(`sprojs_custom_${partiId}`).style.display = 'none';
                            }
                        } else if (field === 'sprojs_custom') {
                            parti.sprojs = parseInt(e.target.value) || 0;
                        } else {
                            // Map field names correctly
                            const fieldMap = {
                                'luftareType': 'luftareType',
                                'extraLuftareType': 'extraLuftare',
                                'workDesc': 'workDesc',
                                'openDir': 'openDir', 
                                'winType': 'winType'
                            };
                            const mappedField = fieldMap[field] || field;
                            
                            if (field === 'extraLuftareType') {
                                parti[mappedField] = parseInt(e.target.value) || 0;
                            } else {
                                parti[mappedField] = e.target.value;
                            }
                        }
                        
                        // Uppdatera pris och rendera endast pris-displayen
                        parti.pris = this.computePris(parti);

                        // Uppdatera endast prisvisning för detta parti istället för full re-render
                        const priceDisplay = document.querySelector(`.parti-section:nth-child(${partiId}) .price-display-inline strong`);
                        if (priceDisplay) {
                            priceDisplay.textContent = this.formatSEK(parti.pris || 0);
                        }

                        this.syncLegacyFields();
                        this.updatePriceCalculation();

                        // Update work description if workDesc changed
                        if (field === 'workDesc') {
                            this.updateWorkDescription();
                        }
                    }
                }
            }
        });
    }

    setupWindowSectionsListener(field) {
        if (windowSectionsListenerBound) return;
        windowSectionsListenerBound = true;
        
        console.log('🔧 Binding window_sections listeners (only once)');
        
        // A. Direkt uppdatering medan man skriver (debouncad)
        field.addEventListener('input', (e) => {
            const n = parseInt(e.target.value, 10) || 0;
            console.log(`🏠 Window sections input: ${n} (current: ${partisState.partis.length})`);
            
            // Idempotent: gör inget om n redan stämmer
            if (n === partisState.partis.length) {
                console.log('🏠 Samma antal, hoppar över debounce');
                return;
            }

            clearTimeout(createPartiesDebounce);
            createPartiesDebounce = setTimeout(() => {
                if (n === partisState.partis.length) {
                    console.log('🏠 Dubbelkoll: samma antal, hoppar över createParties');
                    return; // dubbelkoll
                }
                console.log('🏠 Debouncad uppdatering till', n, 'partier');
                this.createParties(n);
                this.setupPartiEventListeners();
                this.syncLegacyFields();
                this.updatePriceCalculation();
            }, 120); // lagom snällt för UI:t
        });

        // B. Fallback när man lämnar fältet
        field.addEventListener('change', (e) => {
            console.log(`🏠 Window sections changed: ${e.target.value}`);
            this.handleWindowSectionsChange(e);
        });
    }

    handleWindowSectionsChange(e) {
        // Förhindra skapande av partier under duplicering
        if (partisState.isDuplicating) {
            console.log('🚨 handleWindowSectionsChange BLOCKERAD under duplicering');
            return;
        }
        
        const n = parseInt(e.target.value, 10) || 0;
        console.log('🚨 handleWindowSectionsChange … parsed =', n, ' current =', partisState.partis.length);
        
        // Idempotent: gör inget om n redan stämmer  
        if (n === partisState.partis.length) {
            console.log('🚨 Samma antal partier, hoppar över createParties');
            return;
        }
        
        // Specialfall: när n = 0, rensa alltid partier
        if (n === 0) {
            console.log('🚨 Rensar alla partier (n=0)');
            partisState.partis = [];
            this.renderParties();
            this.syncLegacyFields();
            this.updatePriceCalculation();
            return;
        }
        
        this.createParties(n);
        this.setupPartiEventListeners();
        this.syncLegacyFields();
        this.updatePriceCalculation();
    }

    duplicatePrevParti(currentId) {
        console.log('🔄 ANROPAD duplicatePrevParti med currentId:', currentId);

        // Hitta index för aktuell rad
        const idx = partisState.partis.findIndex(p => p.id === currentId);
        if (idx <= 0) {
            console.error('🔄 Ingen föregående parti att kopiera (idx:', idx, ')');
            return;
        }

        const src = partisState.partis[idx - 1];       // föregående
        const target = partisState.partis[idx];        // nuvarande som ska fyllas

        console.log('🔄 Kopierar från föregående parti:', JSON.stringify(src, null, 2));
        console.log('🔄 Till nuvarande parti:', JSON.stringify(target, null, 2));

        // Kopiera endast relevanta fält (behåll id)
        const fields = ['partiType','luftareType','extraLuftare','workDesc','openDir','winType','sprojs'];
        fields.forEach(f => { target[f] = src[f]; });

        // Räkna om priset för målpartiet
        target.pris = this.computePris(target);

        // Rendera om UI + synka/pris
        this.renderParties();
        this.syncLegacyFields();
        this.updatePriceCalculation();

        console.log('🔄 KLAR - Föregående kopierat in i nuvarande parti:', JSON.stringify(target, null, 2));
    }

    /* ============================================
       OFFERT TAB METHODS
       ============================================ */

    // Robust nummer-cast: "12 345 kr", "12,34", null → 12345.00 eller 0
    toNumber(x) {
        if (x == null) return 0;
        if (typeof x === 'number' && isFinite(x)) return x;
        const s = String(x).replace(/\s+/g, '').replace(/kr/gi, '').replace(/,/g, '.').replace(/[^\d.-]/g, '');
        const n = parseFloat(s);
        return isFinite(n) ? n : 0;
    }

    // Hämtar slutpriset "KUNDEN BETALAR" (inkl. moms, efter ROT-avdrag om tillämpligt)
    // VIKTIGT: Denna metod måste använda EXAKT samma beräkning som updatePriceCalculation()
    getFinalCustomerPrice() {
        try {
            const data = this.collectPricingData();

            // 1. Summera individuella partier (samma som updatePriceCalculation)
            // Kolla om partisState finns, annars använd global partisState
            const partisStateRef = window.partisState || partisState;
            const partierTotalCost = (partisStateRef?.partis || []).reduce((sum, parti) => {
                return sum + (parti.pris || 0);
            }, 0);

            console.log('[getFinalCustomerPrice] Partier check:', {
                hasWindowPartisState: !!window.partisState,
                hasGlobalPartisState: typeof partisState !== 'undefined',
                partisCount: partisStateRef?.partis?.length || 0,
                partierTotal: partierTotalCost
            });

            // 2. E-glas (inte parti-specifik)
            const extrasCost = this.calculateExtrasCost(data);

            // 3. Prisjusteringar
            const priceAdjustment = data.priceAdjustmentPlus - data.priceAdjustmentMinus;

            // 4. Applicera renoveringstyp-pålägg (samma som updatePriceCalculation)
            const renovationTypeMultiplier = CONFIG.RENOVATION_TYPE_MULTIPLIERS[data.renovationType] || 1.0;
            const renovationAdjustedTotal = (partierTotalCost + extrasCost + priceAdjustment) * renovationTypeMultiplier;

            // 5. Arbetsbeskrivning-pålägg
            const subtotalBeforeMaterial = renovationAdjustedTotal;
            const workDescriptionMarkup = this.calculateWorkDescriptionMarkup(data, subtotalBeforeMaterial, priceAdjustment, 0);

            // 6. Total summa exklusive moms
            const subtotalExclVat = subtotalBeforeMaterial + workDescriptionMarkup;

            // 7. Lägg till moms
            const vatCost = subtotalExclVat * CONFIG.EXTRAS.VAT_RATE;
            const totalInclVat = subtotalExclVat + vatCost;

            // 8. Beräkna ROT-avdrag om tillämpligt
            let rotDeduction = 0;
            if (data.hasRotDeduction) {
                const materialCostForRot = totalInclVat * (data.materialPercentage / 100);
                const workCostForRot = totalInclVat - materialCostForRot;
                const calculatedRotDeduction = workCostForRot * CONFIG.EXTRAS.ROT_DEDUCTION;
                const maxRotAmount = data.isSharedRotDeduction ? 100000 : 50000;
                rotDeduction = Math.min(calculatedRotDeduction, maxRotAmount);
            }

            // 9. Slutpris efter ROT-avdrag
            const finalCustomerPrice = totalInclVat - rotDeduction;

            console.log('[getFinalCustomerPrice] Breakdown:', {
                partierTotal: partierTotalCost,
                extras: extrasCost,
                adjustment: priceAdjustment,
                renovationMultiplier: renovationTypeMultiplier,
                afterRenovation: renovationAdjustedTotal,
                workDescription: workDescriptionMarkup,
                subtotalExclVat: subtotalExclVat,
                vat: vatCost,
                totalInclVat: totalInclVat,
                rotDeduction: rotDeduction,
                finalPrice: finalCustomerPrice,
                hasRotDeduction: data.hasRotDeduction,
                materialPercentage: data.materialPercentage
            });

            return finalCustomerPrice;
        } catch (error) {
            console.error('[getFinalCustomerPrice] Error:', error);
            console.error('[getFinalCustomerPrice] Stack:', error.stack);
            return 0;
        }
    }

    // --- Hämtar kundfält från formuläret
    getCustomerFields() {
        const v = id => document.getElementById(id)?.value?.trim() || '';
        return {
            company: v('company'),
            contact: v('contact_person'),
            address: v('address'),
            postal: v('postal_code'),
            city: v('city'),
            email: v('email'),
            phone: v('phone'),
            fastighet: v('fastighetsbeteckning'),
            personnummer: v('personnummer')
        };
    }

    // --- Räknar antal fönster- och dörrpartier om data finns
    getPartCounts() {
        const partis = (window.partisState?.partis || []);
        const isWindow = p => (p.partiType || '').toString().toLowerCase() === 'fonster';
        const isDoor = p => ['dorr', 'pardorr_balkong'].includes((p.partiType || '').toString().toLowerCase());

        const windows = partis.filter(isWindow).length || null;
        const doors = partis.filter(isDoor).length || null;
        return { windows, doors };
    }

    getSubtotalExclVat() {
        // Se till att ev. interna state är uppdaterat
        try { this.updatePriceCalculation?.(); } catch (_) { }

        // Data från befintliga helpers om de finns
        let data = {};
        try { data = this.collectPricingData?.() || {}; } catch (_) { }

        // 1) Summa partier
        const partis = (window.partisState?.partis || []);
        const partierTotal = partis.reduce((sum, p) => {
            // p.pris kan vara sträng
            return sum + this.toNumber(p.pris);
        }, 0);

        // 2) Extras (om funktion saknas → 0)
        let extras = 0;
        try { extras = this.toNumber(this.calculateExtrasCost?.(data)); } catch (_) { }

        // 3) Manuella justeringar
        const plus = this.toNumber(data?.priceAdjustmentPlus);
        const minus = this.toNumber(data?.priceAdjustmentMinus);
        const adjustment = plus - minus;

        // 4) Multiplikator för system (om satt)
        const rt = data?.renovationType || data?.renovationTypeSelected || '';
        const mult = this.toNumber((window.CONFIG?.RENOVATION_TYPE_MULTIPLIERS || {})[rt] || 1);

        // 5) Arbetsbeskrivningspåslag (om funktion saknas → 0)
        let wdMarkup = 0;
        try {
            wdMarkup = this.toNumber(
                this.calculateWorkDescriptionMarkup?.(data, partierTotal + extras + adjustment, adjustment, 0)
            );
        } catch (_) { }

        const subtotal = (partierTotal + extras + adjustment) * (mult || 1) + wdMarkup;

        // Rimlighetslåsning
        if (!isFinite(subtotal) || subtotal < 0) return 0;
        return subtotal;
    }

    generateOfferHTML() {
        const c = this.getCustomerFields?.() || {};

        // Hämta slutpris (samma som "KUNDEN BETALAR" i Anbud-fliken)
        const finalPrice = this.getFinalCustomerPrice();
        const prisText = `PRIS: ${this.formatPrice(finalPrice).replace(/\s*kr/i, '')} KR INKLUSIVE MOMS`;

        // Visa även totalsumma inkl. moms och ROT-avdrag i offerten
        const calc = this.getCalculatedPriceData();
        const totalInclText = `Totalt inkl. moms: ${this.formatPrice(calc.total_incl_vat)}`;
        const rotText = calc.rot_applicable
            ? `ROT-avdrag (50% på arbetskostnad): -${this.formatPrice(calc.rot_deduction)}`
            : 'ROT-avdrag: Ej tillämpligt';

        const today = new Date();
        const dateStr = today.toLocaleDateString('sv-SE');
        const ortForDate = (c.city || 'Ludvika');

        // Kontrollera GDPR-godkännande
        const gdprConsent = document.getElementById('gdpr-consent')?.checked;
        const gdprText = gdprConsent ? '<p class="offer-gdpr"><em>Kund har godkänt behandling av personuppgifter enligt GDPR.</em></p>' : '';

        // Bygg mottagarblock med alla kunduppgifter (varje rad i egen div)
        const mottagareLines = [];
        if (c.company) mottagareLines.push(`<div>${c.company}</div>`);
        if (c.contact) mottagareLines.push(`<div>${c.contact}</div>`);
        if (c.personnummer) mottagareLines.push(`<div>Personnummer: ${c.personnummer}</div>`);
        if (c.address) mottagareLines.push(`<div>${c.address}</div>`);
        if (c.postal || c.city) mottagareLines.push(`<div>${[c.postal, c.city].filter(Boolean).join(' ')}</div>`);
        if (c.fastighet) mottagareLines.push(`<div>Fastighetsbeteckning: ${c.fastighet}</div>`);
        if (c.phone) mottagareLines.push(`<div>Telefon: ${c.phone}</div>`);
        if (c.email) mottagareLines.push(`<div>E-post: ${c.email}</div>`);

        const mottagareBlock = mottagareLines.join('');

        // Antal-rader om vi kan läsa dem
        let antalWindows = '', antalDoors = '';
        try {
            const partis = (window.partisState?.partis || []);
            const windows = partis.filter(p => String(p.typ || p.type || '').toLowerCase().includes('fönster')).length;
            const doors = partis.filter(p => String(p.typ || p.type || '').toLowerCase().includes('dörr')).length;
            if (windows) antalWindows = `Antal fönsterpartier: ${windows} st`;
            if (doors) antalDoors = `Antal dörrpartier: ${doors} st`;
        } catch (_) { }

        // Adress i ingressen
        const adr = [c.address, c.city].filter(Boolean).join(', ');

        return `
    <div class="offer offer--locked">
      <h2 class="offer-company-title">Sternbecks Fönsterhantverk i Dalarna AB</h2>

      ${mottagareBlock ? `<div class="offer-recipient">${mottagareBlock}</div>` : ''}

      <h3 class="offer-title">ANBUD</h3>

      <p>Vi ber att få tacka för förfrågan och skickar härmed offert på utvändig renovering och målning av fönsterpartier${adr ? ' på ' + adr : ''}.</p>

      <p>
        ${antalWindows ? antalWindows + '<br/>' : ''}
        ${antalDoors ? antalDoors + '<br/>' : ''}
        Anbudet omfattar pris enligt bifogad arbetsbeskrivning.<br/>
        Byten av rötskadat trä, trasigt glas, trasiga beslag ingår ej i anbudssumman. Regleras med timtid och materialkostnad.
      </p>

      <p class="offer-price">${prisText}</p>
      <p style="margin: 0.5rem 0 0;">${totalInclText}</p>
      <p style="margin: 0;">${rotText}</p>

      <p>I anbudet ingår material och transporter.</p>

      <p><strong>För anbudet gäller:</strong><br/>
        1. Vi ansvarar för rengöring av fönsterglas efter renovering. Ej fönsterputs.<br/>
        2. Miljö- och kvalitetsansvarig: Johan Sternbeck<br/>
        3. Entreprenörens ombud: Johan Sternbeck<br/>
        4. Timtid vid tillkommande arbeten debiteras med 625 kr inkl moms.
      </p>

      <p>Vi förutsätter fritt tillträde till fönsterpartierna så att arbetet kan utföras rationellt.</p>

      ${gdprText}

      <div class="offer-sign">
        <div>${ortForDate} ${dateStr}</div>
        <div>Johan Sternbeck</div>
        <div>Sternbecks Fönsterhantverk i Dalarna AB</div>
        <div>Lavendelstigen 7</div>
        <div>77143 Ludvika</div>
        <div>Org.nr 559389-0717</div>
        <div>Tel.nr Johan Sternbeck 076-846 52 79 - Företaget innehar F-skatt</div>
      </div>
    </div>
  `.trim();
    }

    generateOfferTextFromHTML(html) {
        // Konvertera HTML till ren text för PDF
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // Ta bort info-message om den finns
        const infoMsg = tempDiv.querySelector('.info-message');
        if (infoMsg) return '';

        // Hitta offer-containern (antingen .offer-content eller .offer--locked)
        const content = tempDiv.querySelector('.offer-content, .offer--locked, .offer');
        if (!content) return '';

        // Extrahera text från alla element
        let text = content.textContent || content.innerText || '';

        // Rensa upp mellanslag och radbrytningar
        text = text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n');

        return text.trim();
    }

    renderOfferPreview() {
        console.log('🔍 renderOfferPreview called');
        const previewEl = document.getElementById('offer-preview');
        if (!previewEl) {
            console.error('❌ offer-preview element not found!');
            return;
        }

        const html = this.generateOfferHTML();
        console.log('✅ Generated HTML length:', html.length);
        previewEl.innerHTML = html;
    }

    async getOrBuildPdfs(force = false) {
        const maxAgeMs = 60 * 1000; // bygg om efter 60s eller vid force
        const fresh = this._pdfCache.offerBlob && this._pdfCache.workBlob && (Date.now() - this._pdfCache.ts < maxAgeMs);
        if (fresh && !force) return this._pdfCache;

        // Säkerställ att pris och förhandsvisning är uppdaterade innan PDF byggs
        try {
            this.updatePriceCalculation();
            this.renderOfferPreview();
            this.updateWorkDescription && this.updateWorkDescription();
        } catch (_) {}

        // Bygg nya blobbar
        const [offerBlob, workBlob] = await Promise.all([
            this.createOfferPdfBlob(),
            this.createWorkDescriptionPdfBlob()
        ]);
        this._pdfCache = { offerBlob, workBlob, ts: Date.now() };
        return this._pdfCache;
    }

    createOfferPdfBlob() {
        return new Promise((resolve, reject) => {
            try {
                if (!window.jspdf || !window.jspdf.jsPDF) {
                    throw new Error('jsPDF ej laddad');
                }
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();

                const customerFields = this.getCustomerFields();
                const offerHTML = this.generateOfferHTML();
                const offerText = this.generateOfferTextFromHTML(offerHTML);

                if (!offerText) {
                    reject(new Error('Ingen offertdata att generera PDF från'));
                    return;
                }

                // Header
                doc.setFontSize(20);
                doc.text('Offert', 20, 20);

                doc.setFontSize(10);
                doc.text('Sternbecks Måleri & Fönsterhantverk', 20, 30);
                doc.text(new Date().toLocaleDateString('sv-SE'), 20, 35);

                // Content
                doc.setFontSize(11);
                const lines = offerText.split('\n');
                let y = 50;

                lines.forEach(line => {
                    if (y > 270) {
                        doc.addPage();
                        y = 20;
                    }

                    if (line.match(/^(Kund|Renovering|Partier|Prissättning|ROT-avdrag)$/)) {
                        doc.setFontSize(14);
                        doc.setFont(undefined, 'bold');
                        doc.text(line, 20, y);
                        y += 7;
                        doc.setFontSize(11);
                        doc.setFont(undefined, 'normal');
                    } else if (line.trim()) {
                        const wrapped = this._pdfMultiline(doc, line, 170);
                        wrapped.forEach(wLine => {
                            doc.text(wLine, 20, y);
                            y += 6;
                        });
                    } else {
                        y += 4;
                    }
                });

                // Sammanfattningsblock (fetstil): Totalt inkl. moms, ROT, Kunden betalar
                try {
                    const calc = this.getCalculatedPriceData();
                    const totalIncl = this.formatPrice(calc.total_incl_vat);
                    const rotLine = calc.rot_applicable
                        ? `ROT-avdrag (50% på arbetskostnad): -${this.formatPrice(calc.rot_deduction)}`
                        : 'ROT-avdrag: Ej tillämpligt';
                    const customerPays = this.formatPrice(calc.customer_pays);

                    if (y > 240) { doc.addPage(); y = 20; }
                    doc.setLineWidth(0.5);
                    doc.line(20, y, 190, y); y += 6;

                    doc.setFontSize(13);
                    doc.setFont(undefined, 'bold');
                    doc.text(`Totalt inkl. moms: ${totalIncl}`, 20, y); y += 7;
                    doc.text(rotLine, 20, y); y += 7;
                    doc.text(`KUNDEN BETALAR: ${customerPays}`, 20, y); y += 7;

                    doc.setFont(undefined, 'normal');
                    doc.setFontSize(11);
                    doc.line(20, y, 190, y); y += 4;
                } catch (e) {
                    console.warn('Kunde inte rita sammanfattningsblock i PDF:', e);
                }

                const blob = doc.output('blob');
                resolve(blob);
            } catch (error) {
                console.error('Fel vid PDF-generering (Offert):', error);
                reject(error);
            }
        });
    }

    createWorkDescriptionPdfBlob() {
        return new Promise((resolve, reject) => {
            try {
                if (!window.jspdf || !window.jspdf.jsPDF) {
                    throw new Error('jsPDF ej laddad');
                }
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();

                const workDescEl = document.getElementById('generated-work-description');
                if (!workDescEl) {
                    reject(new Error('Ingen arbetsbeskrivning hittades'));
                    return;
                }

                // Extrahera text från arbetsbeskrivning
                let workText = workDescEl.innerText || workDescEl.textContent || '';

                // Ta bort "Arbetsbeskrivningen genereras automatiskt..." meddelandet
                workText = workText.replace(/Arbetsbeskrivningen genereras automatiskt.*?\n/g, '');

                if (!workText.trim()) {
                    reject(new Error('Arbetsbeskrivningen är tom'));
                    return;
                }

                // Header
                doc.setFontSize(20);
                doc.text('Arbetsbeskrivning', 20, 20);

                doc.setFontSize(10);
                doc.text('Sternbecks Måleri & Fönsterhantverk', 20, 30);
                doc.text(new Date().toLocaleDateString('sv-SE'), 20, 35);

                // Content
                doc.setFontSize(11);
                const lines = workText.split('\n');
                let y = 50;

                lines.forEach(line => {
                    if (y > 270) {
                        doc.addPage();
                        y = 20;
                    }

                    const trimmed = line.trim();
                    if (trimmed) {
                        const wrapped = this._pdfMultiline(doc, trimmed, 170);
                        wrapped.forEach(wLine => {
                            doc.text(wLine, 20, y);
                            y += 6;
                        });
                    } else {
                        y += 4;
                    }
                });

                const blob = doc.output('blob');
                resolve(blob);
            } catch (error) {
                console.error('Fel vid PDF-generering (Arbetsbeskrivning):', error);
                reject(error);
            }
        });
    }

    _pdfMultiline(doc, text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const width = doc.getTextWidth(testLine);

            if (width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });

        if (currentLine) lines.push(currentLine);
        return lines;
    }

    async shareOrDownloadPdfs() {
        try {
            // 1) Bygg/cacha PDF:er snabbt inom user gesture
            const { offerBlob, workBlob } = await this.getOrBuildPdfs(false);

            // Validera att blobbarna inte är tomma
            if (!offerBlob || offerBlob.size === 0) {
                throw new Error('Offert-PDF är tom');
            }
            if (!workBlob || workBlob.size === 0) {
                throw new Error('Arbetsbeskrivning-PDF är tom');
            }

            console.log('PDF sizes:', { offer: offerBlob.size, work: workBlob.size });

            // 2) Filnamn enligt krav: "Anbud - adress - datum"
            // Sanitera filnamn: ta bort ogiltiga tecken
            const c = this.getCustomerFields();
            const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
            const sanitizeFilename = (str) => str.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, ' ').trim();
            const base = sanitizeFilename(`${c.address || 'Okand-adress'} - ${dateStr}`);
            const offerName = `Anbud - ${base}.pdf`;
            const workName = `Arbetsbeskrivning - ${base}.pdf`;

            const files = [
                new File([offerBlob], offerName, { type: 'application/pdf', lastModified: Date.now() }),
                new File([workBlob], workName, { type: 'application/pdf', lastModified: Date.now() })
            ];

            console.log('Files created:', files.map(f => ({ name: f.name, size: f.size })));

            // 3) Share-text
            const subject = `Anbud: ${c.address || ''} (${dateStr})`;
            const text = [
                `Hej ${c.company || ''},`,
                ``,
                `Här kommer anbud och arbetsbeskrivning för ${c.address || ''}.`,
                `Återkom gärna vid frågor.`,
                ``,
                `Vänliga hälsningar,`,
                `Sternbecks Fönsterhantverk`
            ].join('\n');

            // 4) Web Share API med filer (Level 2) - endast mobil
            // Desktop browsers stödjer sällan file sharing ordentligt via Web Share API
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const canShareFiles = !!(isMobile && navigator.canShare && (() => {
                try { return navigator.canShare({ files }); } catch { return false; }
            })());

            if (navigator.share && canShareFiles) {
                console.log('Using Web Share API with files (mobile)');
                try {
                    await navigator.share({ files, title: subject, text });
                    return; // klart
                } catch (error) {
                    console.warn('Web Share API failed, falling back to download:', error);
                    // Fortsätt till fallback nedan
                }
            }

            // 5) Fallback: ladda ned PDF:er direkt (fungerar på alla plattformar)
            console.log('Fallback: direct download');

            // Ladda ned båda PDF:erna
            [{ blob: offerBlob, name: offerName }, { blob: workBlob, name: workName }].forEach(({ blob, name }) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            });

            // Vänta lite så nedladdningarna startar innan mailto öppnas
            await new Promise(resolve => setTimeout(resolve, 500));

            // Öppna mailto för att användaren kan skicka mejl med bifogade filer manuellt
            if (c.email) {
                const mailto = `mailto:${encodeURIComponent(c.email)}`
                    + `?subject=${encodeURIComponent(subject)}`
                    + `&body=${encodeURIComponent(text + '\n\n(Bifoga de nedladdade PDF-filerna manuellt)')}`;
                window.open(mailto, '_blank');
            }

            alert('PDF-filerna har laddats ned. Du kan nu bifoga dem manuellt i ditt e-postprogram.');
        } catch (error) {
            console.error('Error in shareOrDownloadPdfs:', error);
            alert(`Fel vid delning: ${error.message}`);
        }
    }
}

// Lösenordsskydd klass
class PasswordProtection {
    constructor() {
        console.log('🔐 PasswordProtection konstruktor startar...');
        
        // Hitta alla nödvändiga DOM-element
        this.passwordOverlay = document.getElementById('password-overlay');
        this.passwordForm = document.getElementById('password-form');
        this.passwordInput = document.getElementById('password-input');
        this.passwordError = document.getElementById('password-error');
        this.mainApp = document.getElementById('main-app');
        
        // Debug: Logga alla element
        console.log('📋 DOM-element kontroll:');
        console.log('  passwordOverlay:', this.passwordOverlay);
        console.log('  passwordForm:', this.passwordForm);
        console.log('  passwordInput:', this.passwordInput);
        console.log('  passwordError:', this.passwordError);
        console.log('  mainApp:', this.mainApp);
        
        // Kontrollera att alla element finns
        const missingElements = [];
        if (!this.passwordOverlay) missingElements.push('password-overlay');
        if (!this.passwordForm) missingElements.push('password-form');
        if (!this.passwordInput) missingElements.push('password-input');
        if (!this.passwordError) missingElements.push('password-error');
        if (!this.mainApp) missingElements.push('main-app');
        
        if (missingElements.length > 0) {
            console.error('❌ Saknade DOM-element:', missingElements);
            return;
        } else {
            console.log('✅ Alla nödvändiga DOM-element hittades');
        }
        
        // Försöksräknare
        this.attempts = 0;
        this.isLocked = false;
        
        console.log('🚀 Initialiserar lösenordsskydd...');
        this.initializePasswordProtection();
    }
    
    initializePasswordProtection() {
        console.log('🔍 Kontrollerar befintlig session...');
        
        // Kontrollera om användaren redan är inloggad
        const hasExistingSession = this.checkExistingSession();
        console.log('📊 Befintlig session:', hasExistingSession);
        
        if (hasExistingSession) {
            console.log('✅ Giltig session hittad - ger åtkomst automatiskt');
            this.grantAccess();
            return;
        } else {
            console.log('❌ Ingen giltig session - visar lösenordsskärm');
        }
        
        // Lyssna på formulärinlämning
        this.passwordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.validatePassword();
        });
        
        // Lyssna på Enter-tangent i lösenordsfältet
        this.passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.validatePassword();
            }
        });
        
        // Fokusera på lösenordsfältet när sidan laddas
        setTimeout(() => {
            this.passwordInput.focus();
        }, 500);
    }
    
    checkExistingSession() {
        console.log('🔎 checkExistingSession() körs...');
        
        // NYTT: Rensa session vid varje ny flik/fönster för säkerhet
        console.log('🔒 Rensar sessions för säkerhet - kräver nytt lösenord');
        localStorage.removeItem(PASSWORD_CONFIG.SESSION_KEY);
        return false;
        
        /* URSPRUNGLIG SESSION-HANTERING (inaktiverad för säkerhet):
        try {
            const session = localStorage.getItem(PASSWORD_CONFIG.SESSION_KEY);
            console.log('📦 localStorage session:', session);
            
            if (session) {
                const sessionData = JSON.parse(session);
                console.log('📋 Session data:', sessionData);
                
                // Kontrollera session-timeout (24 timmar)
                const sessionAge = Date.now() - (sessionData.timestamp || 0);
                const maxAge = 24 * 60 * 60 * 1000; // 24 timmar
                
                if (sessionAge > maxAge) {
                    console.log('⏰ Session för gammal, rensar...');
                    localStorage.removeItem(PASSWORD_CONFIG.SESSION_KEY);
                    return false;
                }
                
                const isValid = sessionData.authenticated === true && sessionData.password === PASSWORD_CONFIG.CORRECT_PASSWORD;
                console.log('🔐 Session giltig?', isValid, '(ålder:', Math.round(sessionAge / 1000 / 60), 'min)');
                
                return isValid;
            } else {
                console.log('📭 Ingen session i localStorage');
            }
        } catch (error) {
            console.warn('❌ Fel vid kontroll av befintlig session:', error);
            localStorage.removeItem(PASSWORD_CONFIG.SESSION_KEY);
        }
        return false;
        */
    }
    
    validatePassword() {
        if (this.isLocked) return;
        
        const enteredPassword = this.passwordInput.value;
        
        if (enteredPassword === PASSWORD_CONFIG.CORRECT_PASSWORD) {
            // Spara session i localStorage
            this.saveSession();
            this.grantAccess();
        } else {
            this.attempts++;
            this.showError();
            
            if (this.attempts >= PASSWORD_CONFIG.MAX_ATTEMPTS) {
                this.lockPassword();
            }
        }
    }
    
    saveSession() {
        try {
            const sessionData = {
                authenticated: true,
                password: PASSWORD_CONFIG.CORRECT_PASSWORD,
                timestamp: Date.now()
            };
            localStorage.setItem(PASSWORD_CONFIG.SESSION_KEY, JSON.stringify(sessionData));
        } catch (error) {
            console.warn('Kunde inte spara session:', error);
        }
    }
    
    grantAccess() {
        console.log('🚪 grantAccess() körs - ger användaren åtkomst...');
        
        // Dölj lösenordsskärm med animering
        console.log('🎭 Animerar bort lösenordsskärm...');
        this.passwordOverlay.style.animation = 'fadeOut 0.5s ease-out';
        
        setTimeout(async () => {
            console.log('⏰ setTimeout i grantAccess körs (efter 500ms)...');
            
            this.passwordOverlay.style.display = 'none';
            this.mainApp.style.display = 'block';
            this.mainApp.style.animation = 'fadeIn 0.5s ease-out';
            
            console.log('👁️ Visibility ändrat:');
            console.log('  - passwordOverlay display:', this.passwordOverlay.style.display);
            console.log('  - mainApp display:', this.mainApp.style.display);
            
            // 1) rensa cache + all state (men behåll sessionsnyckeln)
            console.log('🧹 Kör hårdreset av cache och state...');
            await hardResetStorageAndCaches();
            
            // 2) nollställ UI-fält etc. (din befintliga funktion)
            console.log('🔄 Nollställer appen...');
            this.resetApp();
            
            // 3) visa navigationsknappar direkt - oberoende av prishämtning
            console.log('🎯 Visar navigationsknappar direkt...');
            this.showNavigationBar();
            this.initializeNavigationButtons();
            
            // 4) tvinga färsk prisladdning för just den här inloggningen
            console.log('💰 Tvingar färsk prisladdning...');
            window.pricingReady = forceFreshPricingOnLogin();
            
            // 5) initialisera resten – din initializeMainApplication väntar på pricingReady
            console.log('🚀 Initialiserar huvudapplikation...');
            this.initializeMainApplication();
        }, 500);
    }
    
    showError() {
        let errorMessage = `Fel lösenord, försök igen (${this.attempts} av ${PASSWORD_CONFIG.MAX_ATTEMPTS} försök)`;
        
        if (this.attempts >= PASSWORD_CONFIG.MAX_ATTEMPTS) {
            errorMessage = `För många felaktiga försök. Klicka på "Försök igen" för att återställa.`;
        }
        
        this.passwordError.textContent = errorMessage;
        this.passwordError.style.display = 'block';
        this.passwordInput.value = '';
        
        if (!this.isLocked) {
            this.passwordInput.focus();
        }
    }
    
    lockPassword() {
        this.isLocked = true;
        this.passwordInput.disabled = true;
        
        // Kontrollera om reset-knappen redan finns
        let resetButton = document.getElementById('password-reset-btn');
        if (resetButton) {
            resetButton.remove();
        }
        
        // Skapa "Försök igen" knapp
        resetButton = document.createElement('button');
        resetButton.textContent = 'Försök igen';
        resetButton.id = 'password-reset-btn';
        resetButton.style.cssText = `
            background: #6c757d;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            font-size: 1rem;
            cursor: pointer;
            margin-top: 1rem;
            display: block;
            width: 100%;
            transition: background-color 0.3s ease;
        `;
        
        resetButton.addEventListener('mouseenter', () => {
            resetButton.style.backgroundColor = '#5a6268';
        });
        
        resetButton.addEventListener('mouseleave', () => {
            resetButton.style.backgroundColor = '#6c757d';
        });
        
        resetButton.addEventListener('click', () => {
            this.resetPassword();
        });
        
        // Lägg till knappen efter lösenordsfältet
        this.passwordInput.parentNode.appendChild(resetButton);
    }
    
    resetPassword() {
        this.attempts = 0;
        this.isLocked = false;
        this.passwordInput.disabled = false;
        this.passwordError.style.display = 'none';
        this.passwordInput.focus();
        
        // Ta bort resetknappen
        const resetButton = document.getElementById('password-reset-btn');
        if (resetButton) {
            resetButton.remove();
        }
    }
    
    resetApp() {
        console.log('🔄 Nollställer hela applikationen...');
        
        // Rensa individuella partier FÖRST
        console.log('📋 Rensar individuella partier...');
        partisState.partis = [];
        if (window.quoteCalculator) {
            window.quoteCalculator.renderParties();
            window.quoteCalculator.syncLegacyFields();
        }
        
        // Rensa alla textinput-fält med KORREKTA ID:n
        const textInputs = [
            'company', 'contact_person', 'address', 'phone', 'email', 'city', 'postal_code', 
            'fastighetsbeteckning', 'window_sections', 'antal_dorrpartier', 'antal_kallare_glugg', 
            'antal_pardorr_balkong', 'antal_1_luftare', 'antal_2_luftare', 
            'antal_3_luftare', 'antal_4_luftare', 'antal_5_luftare', 
            'antal_6_luftare', 'antal_sprojs_per_bage', 'antal_fonster_med_sprojs', 'le_kvm', 
            'price_adjustment_plus', 'price_adjustment_minus'
        ];
        
        console.log('📝 Rensar text/number input-fält...');
        let clearedFields = 0;
        textInputs.forEach(id => {
            const field = document.getElementById(id);
            if (field) {
                const oldValue = field.value;
                field.value = '';
                clearedFields++;
                if (oldValue) {
                    console.log(`  ✅ Rensade ${id}: "${oldValue}" → ""`);
                }
            } else {
                console.log(`  ❌ Hittade inte fält: ${id}`);
            }
        });
        console.log(`📊 Rensade ${clearedFields} av ${textInputs.length} fält`);
        
        // Återställ dropdown till standardval
        console.log('🔽 Återställer dropdown-menyer...');
        const typAvRenovering = document.getElementById('typ_av_renovering');
        if (typAvRenovering) {
            const oldValue = typAvRenovering.value;
            typAvRenovering.value = '';
            console.log(`  ✅ typ_av_renovering: "${oldValue}" → "Välj renoveringstyp..."`);
        } else {
            console.log('  ❌ typ_av_renovering hittades inte');
        }
        
        const materialkostnad = document.getElementById('materialkostnad');
        if (materialkostnad) {
            const oldValue = materialkostnad.value;
            materialkostnad.value = '0';
            console.log(`  ✅ materialkostnad: "${oldValue}" → "0"`);
        }
        
        // Återställ radiobuttons till standardval
        console.log('🔘 Återställer radiobuttons...');
        
        // Arbetsbeskrivning - Utvändig renovering (standard)
        const arbetsbeskrivningRadios = document.querySelectorAll('input[name="arbetsbeskrivning"]');
        console.log(`  🔍 Hittade ${arbetsbeskrivningRadios.length} arbetsbeskrivning radiobuttons`);
        arbetsbeskrivningRadios.forEach(radio => {
            radio.checked = radio.value === 'Utvändig renovering';
            if (radio.checked) console.log(`  ✅ Valde arbetsbeskrivning: ${radio.value}`);
        });
        
        // Fönsteröppning - Inåtgående (standard)  
        const fonsteroppningRadios = document.querySelectorAll('input[name="fonsteroppning"]');
        console.log(`  🔍 Hittade ${fonsteroppningRadios.length} fönsteröppning radiobuttons`);
        fonsteroppningRadios.forEach(radio => {
            radio.checked = radio.value === 'Inåtgående';
            if (radio.checked) console.log(`  ✅ Valde fönsteröppning: ${radio.value}`);
        });
        
        // Fönstertyp - Kopplade standard (standard)
        const fonsterTypRadios = document.querySelectorAll('input[name="typ_av_fonster"]');
        console.log(`  🔍 Hittade ${fonsterTypRadios.length} fönstertyp radiobuttons`);
        fonsterTypRadios.forEach(radio => {
            radio.checked = radio.value === 'Kopplade standard';
            if (radio.checked) console.log(`  ✅ Valde fönstertyp: ${radio.value}`);
        });
        
        // ROT-avdrag radiobuttons - Sätt standardval till "Nej"
        const rotFastighetRadios = document.querySelectorAll('input[name="fastighet_rot_berättigad"]');
        console.log(`  🔍 Hittade ${rotFastighetRadios.length} ROT fastighet radiobuttons`);
        rotFastighetRadios.forEach(radio => {
            radio.checked = radio.value === 'Nej - Hyresrätt/Kommersiell fastighet';
            if (radio.checked) console.log(`  ✅ Valde ROT fastighet: ${radio.value}`);
        });
        
        const rotKundRadios = document.querySelectorAll('input[name="är_du_berättigad_rot_avdrag"]');
        console.log(`  🔍 Hittade ${rotKundRadios.length} ROT kund radiobuttons`);
        rotKundRadios.forEach(radio => {
            radio.checked = radio.value === 'Nej - visa fullpris utan avdrag';
            if (radio.checked) console.log(`  ✅ Valde ROT kund: ${radio.value}`);
        });
        
        // Delat ROT-avdrag radiobuttons - Sätt till "Nej"
        const delatRotRadios = document.querySelectorAll('input[name="delat_rot_avdrag"]');
        console.log(`  🔍 Hittade ${delatRotRadios.length} delat ROT radiobuttons`);
        delatRotRadios.forEach(radio => {
            radio.checked = radio.value === 'Nej';
            if (radio.checked) console.log(`  ✅ Valde delat ROT: ${radio.value}`);
        });
        
        // Spröjs och LE-glas radiobuttons
        const sprojsRadios = document.querySelectorAll('input[name="sprojs_choice"]');
        console.log(`  🔍 Hittade ${sprojsRadios.length} spröjs radiobuttons`);
        sprojsRadios.forEach(radio => {
            radio.checked = radio.value === 'Nej';
            if (radio.checked) console.log(`  ✅ Valde spröjs: ${radio.value}`);
        });
        
        const leGlasRadios = document.querySelectorAll('input[name="le_glas_choice"]');
        console.log(`  🔍 Hittade ${leGlasRadios.length} LE-glas radiobuttons`);
        leGlasRadios.forEach(radio => {
            radio.checked = radio.value === 'Nej';
            if (radio.checked) console.log(`  ✅ Valde LE-glas: ${radio.value}`);
        });
        
        // Nollställ prisberäkningar
        console.log('💰 Nollställer prisvisning...');
        this.resetPriceDisplays();
        
        // Dölj villkorliga sektioner
        console.log('👁️ Döljer villkorliga sektioner...');
        const sectionsToHide = [
            { id: 'materialkostnad-section', name: 'Materialkostnad' },
            { id: 'material-row', name: 'Material-rad i prisuppdelning' },
            { id: 'sprojs-section', name: 'Spröjs-sektion' },
            { id: 'le-glas-section', name: 'LE-glas-sektion' }
        ];
        
        sectionsToHide.forEach(section => {
            const element = document.getElementById(section.id);
            if (element) {
                element.style.display = 'none';
                console.log(`  ✅ Dolde ${section.name}`);
            }
        });
        
        // Återställ tab till Anbud
        console.log('📑 Återställer tab-navigation till Anbud...');
        const anbudTab = document.querySelector('[data-tab="anbud"]');
        const arbetsbeskrivningTab = document.querySelector('[data-tab="arbetsbeskrivning"]');
        const anbudContent = document.getElementById('anbud-tab');
        const arbetsbeskrivningContent = document.getElementById('arbetsbeskrivning-tab');
        
        if (anbudTab && arbetsbeskrivningTab && anbudContent && arbetsbeskrivningContent) {
            anbudTab.classList.add('active');
            arbetsbeskrivningTab.classList.remove('active');
            anbudContent.classList.add('active');
            arbetsbeskrivningContent.classList.remove('active');
            console.log('  ✅ Återställde tab-navigation till Anbud');
        } else {
            console.log('  ❌ Kunde inte hitta alla tab-element');
            console.log(`    anbudTab: ${!!anbudTab}, arbetsbeskrivningTab: ${!!arbetsbeskrivningTab}`);
            console.log(`    anbudContent: ${!!anbudContent}, arbetsbeskrivningContent: ${!!arbetsbeskrivningContent}`);
        }
        
        // Trigga ny prisberäkning efter reset (med längre delay)
        console.log('🔄 Triggar ny prisberäkning...');
        setTimeout(() => {
            // Säkerställ att alla priser fortfarande är 0 innan triggeringen
            this.resetPriceDisplays();
            
            // Hitta QuoteCalculator-instans och kör updatePriceCalculation
            const quoteForm = document.getElementById('quote-form');
            if (quoteForm) {
                // Trigga change event för att starta om prisberäkningen
                const event = new Event('input', { bubbles: true });
                quoteForm.dispatchEvent(event);
                console.log('  ✅ Prisberäkning startad');
            }
        }, 200);
        
        console.log('✅ App nollställd komplett - alla fält ska nu vara rensade!');
    }
    
    resetPriceDisplays() {
        console.log('💰 resetPriceDisplays() körs...');
        
        // Nollställ alla priselement
        const priceElements = [
            'base-components-price',
            'window-type-cost', 
            'extras-cost',
            'subtotal-price',
            'subtotal-price-display',
            'vat-amount',
            'vat-cost',
            'total-price',
            'total-with-vat',
            'material-deduction',
            'rot-deduction',
            'rot-deduction-amount',
            'final-customer-price',
            'renovation-markup',
            'material-cost-display'
        ];
        
        let resetPrices = 0;
        priceElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                const oldValue = element.textContent;
                
                // Speciell hantering för olika element-typer
                let newValue = '0 kr';
                if (id === 'rot-deduction') {
                    newValue = '-0 kr';
                }
                
                // Vissa element använder innerHTML med <strong>-taggar
                if (['subtotal-price', 'total-with-vat', 'final-customer-price'].includes(id)) {
                    element.innerHTML = `<strong>${newValue}</strong>`;
                } else {
                    element.textContent = newValue;
                }
                resetPrices++;
                if (oldValue && oldValue !== newValue && oldValue !== '0' && oldValue !== '0 kr') {
                    console.log(`  ✅ Nollställde ${id}: "${oldValue}" → "${newValue}"`);
                }
            } else {
                console.log(`  ❌ Hittade inte priselement: ${id}`);
            }
        });
        console.log(`📊 Nollställde ${resetPrices} av ${priceElements.length} priselement`);
        
        // Rensa prisuppdelnings-textarea
        const priceBreakdown = document.getElementById('price-breakdown');
        if (priceBreakdown) {
            const oldValue = priceBreakdown.value;
            priceBreakdown.value = '';
            if (oldValue) {
                console.log('  ✅ Rensade prisuppdelning textarea');
            }
        } else {
            console.log('  ❌ Hittade inte price-breakdown textarea');
        }
    }
    
    resetFormOnly() {
        console.log('🔄 Återställer formuläret (behåller användaren inloggad)...');
        
        // Använd samma resetApp-logik men utan att påverka inloggningsstatus
        this.resetApp();
        
        // Visa bekräftelse för användaren
        this.showResetConfirmation();
    }
    
    showResetConfirmation() {
        // Skapa temporär bekräftelse-notifikation
        const notification = document.createElement('div');
        notification.className = 'reset-notification';
        notification.innerHTML = `
            <div class="reset-notification-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20,6 9,17 4,12"></polyline>
                </svg>
                <span>Formuläret har återställts!</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animera in notifikationen
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Ta bort notifikationen efter 3 sekunder
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }
    
    async logout() {
        console.log('🚪 Logout metod körs...');
        
        // Rensa gamla event listeners och instanser
        if (window.currentThemeToggleInstance) {
            window.currentThemeToggleInstance.cleanup();
            window.currentThemeToggleInstance = null;
            console.log('🧹 Rensade ThemeToggle-instans vid logout');
        }
        
        // Rensa localStorage session
        localStorage.removeItem(PASSWORD_CONFIG.SESSION_KEY);
        console.log('✅ localStorage session borttagen');
        
        // Hårdreset så att nästa inloggning börjar helt fräscht
        console.log('🧹 Kör hårdreset vid logout...');
        await hardResetStorageAndCaches();
        
        // Dölj navigationsknappar
        this.hideNavigationBar();
        
        // Visa lösenordsskärmen igen
        this.mainApp.style.display = 'none';
        this.passwordOverlay.style.display = 'flex';
        console.log('✅ Visa lösenordsskärm');
        
        // Återställ lösenordshantering
        this.attempts = 0;
        this.isLocked = false;
        this.passwordInput.disabled = false;
        this.passwordInput.value = '';
        this.passwordError.style.display = 'none';
        
        // Ta bort eventuell resetknapp
        const resetButton = document.getElementById('password-reset-btn');
        if (resetButton) {
            resetButton.remove();
        }
        
        // Fokusera på lösenordsfält
        setTimeout(() => {
            this.passwordInput.focus();
        }, 100);
        
        console.log('🚪 Logout slutförd');
    }
    
    initializeMainApplication() {
        console.log('🚀 initializeMainApplication() startar...');
        
        // Kontrollera att alla nödvändiga element finns
        const requiredElements = [
            'quote-form',
            'base-components-price',
            'window-type-cost',
            'extras-cost',
            'submit-btn'
        ];
        
        console.log('🔍 Kontrollerar nödvändiga element...');
        console.log('📋 Söker efter element:', requiredElements);
        
        // Detaljerad kontroll av varje element
        requiredElements.forEach(id => {
            const element = document.getElementById(id);
            console.log(`  - ${id}: ${element ? '✅ HITTAT' : '❌ SAKNAS'}`);
            if (!element) {
                console.log(`    🔍 Sökning efter '${id}':`, document.querySelectorAll(`#${id}, [id*="${id}"], [name="${id}"]`));
            }
        });
        
        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        
        if (missingElements.length > 0) {
            console.warn('⚠️ VISSA ELEMENT SAKNAS (men fortsätter ändå):', missingElements);
            console.log('🔍 Alla form-element:', document.querySelectorAll('form'));
            console.log('🔍 Alla input-element:', document.querySelectorAll('input'));
            console.log('🔍 Alla element med ID:', document.querySelectorAll('[id]'));
            console.log('🔍 main-app innehåll:', this.mainApp ? this.mainApp.innerHTML.substring(0, 500) + '...' : 'main-app saknas');
            // Fortsätt ändå - elementkontrollen kan vara för strikt
        }
        
        // Vänta in pricing – utan att göra funktionen async
        Promise.resolve(window.pricingReady).then(() => {
            window.quoteCalculator = new QuoteCalculator();
            new AccessibilityEnhancer();
            new ThemeToggle();

            console.log('Sternbecks Anbudsapplikation initialiserad framgångsrikt efter prisladdning.');
        }).catch(err => {
            console.error('Kunde inte ladda prislista:', err);
            // Falla tillbaka på befintliga defaultvärden i CONFIG så appen ändå fungerar
            window.quoteCalculator = new QuoteCalculator();
            new AccessibilityEnhancer();
            new ThemeToggle();

            console.log('Sternbecks Anbudsapplikation initialiserad med standardpriser efter felaktig prisladdning.');
        });
    }
    
    showNavigationBar() {
        console.log('🔄 showNavigationBar() anropad');
        const navigationBar = document.querySelector('.navigation-bar');
        const logoutBtn = document.querySelector('.logout-btn-compact');
        
        if (navigationBar) {
            console.log('📍 Navigation bar element hittat:', navigationBar);
            navigationBar.classList.add('visible');
            console.log('✅ Navigationsknappar visas - klass "visible" tillagd');
            
            // Dubbelkontroll att klassen faktiskt lades till
            if (navigationBar.classList.contains('visible')) {
                console.log('✅ Bekräftat: "visible" klass finns på navigationsbaren');
            } else {
                console.error('❌ "visible" klass kunde inte läggas till!');
            }
        } else {
            console.error('❌ Navigationsbaren hittades inte!');
            console.log('🔍 Alla nav element:', document.querySelectorAll('nav'));
            console.log('🔍 Alla .navigation-bar element:', document.querySelectorAll('.navigation-bar'));
        }
        
        // Visa logout-knappen också
        if (logoutBtn) {
            logoutBtn.classList.add('visible');
            console.log('✅ Logout-knapp visas');
        } else {
            console.error('❌ Logout-knappen hittades inte!');
        }
    }
    
    hideNavigationBar() {
        const navigationBar = document.querySelector('.navigation-bar');
        const logoutBtn = document.querySelector('.logout-btn-compact');
        
        if (navigationBar) {
            navigationBar.classList.remove('visible');
            console.log('✅ Navigationsknappar dolda');
        }
        if (logoutBtn) {
            logoutBtn.classList.remove('visible');
            console.log('✅ Logout-knapp dold');
        }
    }
    
    initializeNavigationButtons() {
        console.log('🎯 Initialiserar navigationsknappar...');
        
        // Skapa referenser till PasswordProtection-instansen
        const passwordProtection = window.passwordProtectionInstance || this;
        
        // Initiera direkt utan fördröjning - DOM är redan redo
        console.log('⏰ Initierar navigationsknappar direkt...');
        
        // Logout-knapp
        const logoutBtn = document.getElementById('logout-btn');
        console.log('🔍 Letar efter logout-btn:', logoutBtn);
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🚪 Logout-knapp klickad');
                if (confirm('Är du säker på att du vill logga ut?')) {
                    passwordProtection.logout();
                }
            });
            console.log('✅ Logout event listener tillagd för element:', logoutBtn);
        } else {
            console.error('❌ Logout-knapp hittades inte!');
            console.log('🔍 Alla element med ID logout-btn:', document.querySelectorAll('#logout-btn'));
            console.log('🔍 Alla nav-btn element:', document.querySelectorAll('.nav-btn'));
        }
        
        // Reset-knapp (NY FUNKTION)
        const resetBtn = document.getElementById('reset-btn');
        console.log('🔍 Letar efter reset-btn:', resetBtn);
        if (resetBtn) {
            resetBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🔄 Reset-knapp klickad');
                if (confirm('Är du säker på att du vill återställa alla formulärfält?')) {
                    passwordProtection.resetFormOnly();
                }
            });
            console.log('✅ Reset event listener tillagd för element:', resetBtn);
        } else {
            console.error('❌ Reset-knapp hittades inte!');
            console.log('🔍 Alla element med ID reset-btn:', document.querySelectorAll('#reset-btn'));
        }
        
        console.log('🎯 Navigationsknappar (logout + reset) initialiserade');
    }
}

// Tema toggle klass
class ThemeToggle {
    constructor() {
        // Ta bort tidigare instanser och event listeners
        this.cleanup();
        
        this.themeToggle = document.getElementById('theme-toggle');
        this.body = document.body;
        this.lightIcon = this.themeToggle?.querySelector('.theme-icon-light');
        this.darkIcon = this.themeToggle?.querySelector('.theme-icon-dark');
        
        // Bind metoden så den kan användas som event listener
        this.handleToggleClick = this.handleToggleClick.bind(this);
        
        // Ladda sparat tema från localStorage
        const savedTheme = localStorage.getItem('sternbecks-theme');
        console.log(`🎨 Laddar sparat tema: ${savedTheme}`);
        if (savedTheme === 'dark') {
            this.body.classList.add('dark');
            this.body.setAttribute('data-theme', 'dark');
        } else {
            this.body.classList.remove('dark');
            this.body.setAttribute('data-theme', 'light');
        }
        
        this.initializeThemeToggle();
        
        // Spara referens till denna instans globalt för cleanup
        window.currentThemeToggleInstance = this;
    }
    
    cleanup() {
        // Ta bort tidigare instans och event listeners
        if (window.currentThemeToggleInstance && window.currentThemeToggleInstance.themeToggle) {
            const oldToggle = window.currentThemeToggleInstance.themeToggle;
            const oldHandler = window.currentThemeToggleInstance.handleToggleClick;
            if (oldToggle && oldHandler) {
                oldToggle.removeEventListener('click', oldHandler);
                console.log('🧹 Rensade gammal ThemeToggle event listener');
            }
        }
    }
    
    handleToggleClick(e) {
        e.preventDefault();
        this.toggleTheme();
    }
    
    initializeThemeToggle() {
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', this.handleToggleClick);
            console.log('🎨 ThemeToggle initialiserad med event listener');
        } else {
            console.error('❌ Theme toggle button hittades inte!');
        }
    }
    
    toggleTheme() {
        this.body.classList.toggle('dark');
        
        // Uppdatera data-theme attribut för CSS
        const isDark = this.body.classList.contains('dark');
        this.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
        
        // Spara tema i localStorage
        localStorage.setItem('sternbecks-theme', isDark ? 'dark' : 'light');
        
        console.log(`🎨 Tema växlat till: ${isDark ? 'mörkt' : 'ljust'}`);
    }
}

// Utility functions för tillgänglighet och användbarhet
class AccessibilityEnhancer {
    constructor() {
        this.addKeyboardNavigation();
        this.addAriaLabels();
    }
    
    addKeyboardNavigation() {
        // Lägg till keyboard navigation för radio buttons och checkboxes
        const customInputs = document.querySelectorAll('.radio-label, .checkbox-label');
        
        customInputs.forEach(label => {
            label.setAttribute('tabindex', '0');
            
            label.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const input = label.querySelector('input');
                    if (input) {
                        input.checked = !input.checked;
                        input.dispatchEvent(new Event('change'));
                    }
                }
            });
        });
    }
    
    addAriaLabels() {
        // Lägg till aria-labels för bättre tillgänglighet
        const priceSection = document.querySelector('.price-section');
        if (priceSection) {
            priceSection.setAttribute('aria-label', 'Prisberäkning');
        }
        
        const form = document.getElementById('quote-form');
        if (form) {
            form.setAttribute('aria-label', 'Anbudsförfrågan formulär');
        }
    }
}

// Initialisera applikationen när DOM är redo
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM Content Loaded - Starting application...');
    
    // DEBUG: Omfattande felsökning aktiverad - se console för detaljerade loggar
    
    // Starta med lösenordsskydd och spara global referens
    window.passwordProtectionInstance = new PasswordProtection();
    
    // QuoteCalculator och ThemeToggle initialiseras i initializeMainApplication() efter lyckad inloggning
    
    // Lägg till smooth scrolling för alla interna länkar
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Personnummer-formatering: 12 siffror → 10 siffror (YYMMDD-XXXX)
    const personnummerInput = document.getElementById('personnummer');
    if (personnummerInput) {
        personnummerInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, ''); // Ta bort allt utom siffror

            // Om 12 siffror (YYYYMMDDXXXX), ta bort de första 2 siffrorna
            if (value.length === 12) {
                value = value.substring(2);
            }

            // Formatera med bindestreck efter 6 siffror
            if (value.length > 6) {
                value = value.substring(0, 6) + '-' + value.substring(6, 10);
            }

            // Begränsa till 10 siffror + bindestreck
            if (value.replace('-', '').length > 10) {
                value = value.substring(0, 11); // YYMMDD-XXXX = 11 tecken
            }

            e.target.value = value;
        });

        // Validering vid blur
        personnummerInput.addEventListener('blur', (e) => {
            const value = e.target.value.replace(/\D/g, '');
            const errorEl = document.getElementById('personnummer-error');

            if (value && value.length !== 10) {
                if (errorEl) errorEl.textContent = 'Personnummer måste vara 10 siffror';
                e.target.classList.add('error');
            } else {
                if (errorEl) errorEl.textContent = '';
                e.target.classList.remove('error');
            }
        });
    }

    // Setup tab navigation (kör med fördröjning för att säkerställa att DOM är redo)
    setTimeout(() => {
        console.log('🔧 Setting up tab navigation (delayed)...');

        const goToArbetsbeskrivningBtn = document.getElementById('go-to-arbetsbeskrivning-btn');
        const goToOffertBtn = document.getElementById('go-to-offert-btn');
        const arbetsbeskrivningTabBtn = document.querySelector('[data-tab="arbetsbeskrivning"]');
        const offertTabBtn = document.querySelector('[data-tab="offert"]');

        console.log('Tab navigation elements:', {
            goToArbetsbeskrivningBtn: !!goToArbetsbeskrivningBtn,
            goToOffertBtn: !!goToOffertBtn,
            arbetsbeskrivningTabBtn: !!arbetsbeskrivningTabBtn,
            offertTabBtn: !!offertTabBtn
        });

        if (goToArbetsbeskrivningBtn && arbetsbeskrivningTabBtn) {
            goToArbetsbeskrivningBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('✅ Navigating to Arbetsbeskrivning tab');
                arbetsbeskrivningTabBtn.click();
                setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
            });
            console.log('✅ "Till arbetsbeskrivning" button setup complete');
        } else {
            console.error('❌ Could not setup "Till arbetsbeskrivning" button');
        }

        if (goToOffertBtn && offertTabBtn) {
            goToOffertBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('✅ Navigating to Offert tab');
                offertTabBtn.click();
                setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
            });
            console.log('✅ "Till offert" button setup complete');
        } else {
            console.error('❌ Could not setup "Till offert" button');
        }
    }, 1000);

    // Initialisera adminpanel
    window.adminPanelInstance = new AdminPanel();
});

// AdminPanel klass för att hantera prisredigering och Google Sheets integration
class AdminPanel {
    constructor() {
        console.log('🔧 Initializing AdminPanel...');
        
        // Initializera async kommer att hämta färska priser
        
        // Google Sheets konfiguration
        this.PRICING_API_URL = API_URL_STERNBECK;
        // Token hanteras nu på serversidan via proxyn
        
        // Prisversionshantering
        this.currentVersion = 1;
        this.lastUpdated = null;
        
        // DOM-element
        this.adminBtn = document.getElementById('admin-btn');
        this.adminPanel = document.getElementById('adminPanel');
        this.closeBtn = document.getElementById('btn_close_admin');
        this.adminCloseBtn = document.getElementById('btn_admin_close');
        this.fillBtn = document.getElementById('btn_admin_fill');
        this.saveBtn = document.getElementById('btn_admin_save');
        this.statusElement = document.getElementById('admin_status');
        this.versionElement = document.getElementById('current_version');
        this.lastUpdatedElement = document.getElementById('last_updated');
        this.logsContainer = document.getElementById('admin_logs');
        
        // Prisfält - alla nya fält baserat på uppdaterad prisstruktur
        this.priceFields = {
            // Fönster och Dörrar
            p_dorrpartier: document.getElementById('p_dorrpartier'),
            p_pardorr_balkong: document.getElementById('p_pardorr_balkong'),
            p_kallare_glugg: document.getElementById('p_kallare_glugg'),
            p_flak: document.getElementById('p_flak'),
            
            // Luftare-priser
            p_1_luftare: document.getElementById('p_1_luftare'),
            p_2_luftare: document.getElementById('p_2_luftare'),
            p_3_luftare: document.getElementById('p_3_luftare'),
            p_4_luftare: document.getElementById('p_4_luftare'),
            p_5_luftare: document.getElementById('p_5_luftare'),
            p_6_luftare: document.getElementById('p_6_luftare'),
            
            // Renoveringstyper
            p_modern_renovering: document.getElementById('p_modern_renovering'),
            p_traditionell_renovering: document.getElementById('p_traditionell_renovering'),
            
            // Fönsteröppning
            p_inatgaende: document.getElementById('p_inatgaende'),
            p_utatgaende: document.getElementById('p_utatgaende'),
            
            // Fönstertyp
            p_kopplade_standard: document.getElementById('p_kopplade_standard'),
            p_kopplade_isolerglas: document.getElementById('p_kopplade_isolerglas'),
            p_isolerglas: document.getElementById('p_isolerglas'),
            p_insats_yttre: document.getElementById('p_insats_yttre'),
            p_insats_inre: document.getElementById('p_insats_inre'),
            p_insats_komplett: document.getElementById('p_insats_komplett'),
            
            // Arbetsbeskrivning
            p_utvandig_renovering: document.getElementById('p_utvandig_renovering'),
            p_invandig_renovering: document.getElementById('p_invandig_renovering'),
            p_utv_plus_inner: document.getElementById('p_utv_plus_inner'),
            
            // Spröjs
            p_sprojs_under4: document.getElementById('p_sprojs_under4'),
            p_sprojs_over4: document.getElementById('p_sprojs_over4'),
            
            // LE-glas och Extra luftare
            p_le_glas: document.getElementById('p_le_glas'),
            p_extra_1: document.getElementById('p_extra_1'),
            p_extra_2: document.getElementById('p_extra_2'),
            p_extra_3: document.getElementById('p_extra_3'),
            p_extra_4: document.getElementById('p_extra_4'),
            p_extra_5: document.getElementById('p_extra_5'),
            
            // Skatter och avdrag
            p_vat: document.getElementById('p_vat'),
            p_rot: document.getElementById('p_rot'),
            p_ver: document.getElementById('p_ver')
        };
        
        this.initializeEventListeners();
        this.addResetDefaultsButton();
        this.initAdminPricing();
        this.updateVersionDisplay();
    }
    
    initializeEventListeners() {
        // Adminpanel toggle
        this.adminBtn?.addEventListener('click', () => this.showAdminPanel());
        this.closeBtn?.addEventListener('click', () => this.hideAdminPanel());
        
        // Stäng panel om man klickar utanför
        this.adminPanel?.addEventListener('click', (e) => {
            if (e.target === this.adminPanel) {
                this.hideAdminPanel();
            }
        });
        
        // Escape-tangent för att stänga
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.adminPanel?.classList.contains('hidden')) {
                this.hideAdminPanel();
            }
        });
        
        // Knapparnas funktionalitet
        this.closeBtn?.addEventListener('click', () => this.hideAdminPanel());
        this.adminCloseBtn?.addEventListener('click', () => this.hideAdminPanel());
        this.fillBtn?.addEventListener('click', () => this.fillCurrentPrices());
        this.saveBtn?.addEventListener('click', () => this.savePricesToGoogle());
        
        // Uppdatera priser-knapp
        const refreshBtn = document.getElementById('admin-refresh-prices');
        refreshBtn?.addEventListener('click', async () => {
            try {
                await refreshAdminPricingOrFail();
                this.addLogEntry('Priser uppdaterade från Google Sheets', 'success');
                this.fillCurrentPrices(); // Uppdatera admin-fälten med nya priser
            } catch (e) {
                this.addLogEntry(`Fel vid prisuppdatering: ${e.message}`, 'error');
                console.error('Admin pricing refresh error:', e);
            }
        });
    }
    
    showAdminPanel() {
        this.adminPanel?.classList.remove('hidden');
        this.addLogEntry('Adminpanel öppnad', 'info');
        this.updateStatus('Redo');
    }
    
    hideAdminPanel() {
        this.adminPanel?.classList.add('hidden');
    }
    
    async initAdminPricing() {
        try {
            await forceFreshPricingForAdmin();   // ← tvinga färskt från Sheets
        } catch (e) {
            console.error('Admin: kunde inte hämta priser från Sheets', e);
            alert('Kunde inte hämta priser från Google Sheets. Prova igen.');
            return; // avbryt om det misslyckas
        }
        
        try {
            const cached = getCachedPricing();
            const data = cached || (await fetchPricingFromSheet());
            setCachedPricing(data);

            // Fyll inputs från Sheet-data med korrekta nycklar
            // Fönster & dörrar
            if (this.priceFields.p_dorrpartier) this.priceFields.p_dorrpartier.value = data.dorrparti || '';
            if (this.priceFields.p_pardorr_balkong) this.priceFields.p_pardorr_balkong.value = data.pardorr_balong_altan || '';
            if (this.priceFields.p_kallare_glugg) this.priceFields.p_kallare_glugg.value = data.kallare_glugg || '';
            if (this.priceFields.p_flak) this.priceFields.p_flak.value = data.flak_bas || '';

            // Luftare
            if (this.priceFields.p_1_luftare) this.priceFields.p_1_luftare.value = data.luftare_1_pris || '';
            if (this.priceFields.p_2_luftare) this.priceFields.p_2_luftare.value = data.luftare_2_pris || '';
            if (this.priceFields.p_3_luftare) this.priceFields.p_3_luftare.value = data.luftare_3_pris || '';
            if (this.priceFields.p_4_luftare) this.priceFields.p_4_luftare.value = data.luftare_4_pris || '';
            if (this.priceFields.p_5_luftare) this.priceFields.p_5_luftare.value = data.luftare_5_pris || '';
            if (this.priceFields.p_6_luftare) this.priceFields.p_6_luftare.value = data.luftare_6_pris || '';

            // Renoveringstyper (%)
            if (this.priceFields.p_traditionell_renovering) this.priceFields.p_traditionell_renovering.value = multToPct(data.renov_trad_linolja_mult);
            if (this.priceFields.p_modern_renovering) this.priceFields.p_modern_renovering.value = multToPct(data.renov_modern_alcro_mult);

            // Fönsteröppning (%)
            if (this.priceFields.p_inatgaende) this.priceFields.p_inatgaende.value = multToPct(data.oppning_inat_mult);
            if (this.priceFields.p_utatgaende) this.priceFields.p_utatgaende.value = multToPct(data.oppning_utat_mult);

            // Fönstertyper (delta per båge)
            if (this.priceFields.p_kopplade_standard) this.priceFields.p_kopplade_standard.value = data.typ_kopplade_standard_delta ?? 0;
            if (this.priceFields.p_isolerglas) this.priceFields.p_isolerglas.value = data.typ_isolerglas_delta ?? -400;
            if (this.priceFields.p_kopplade_isolerglas) this.priceFields.p_kopplade_isolerglas.value = data.typ_kopplade_isolerglas_delta ?? 0;
            if (this.priceFields.p_insats_yttre) this.priceFields.p_insats_yttre.value = data.typ_insats_yttre_delta ?? -400;
            if (this.priceFields.p_insats_inre) this.priceFields.p_insats_inre.value = data.typ_insats_inre_delta ?? -1250;
            if (this.priceFields.p_insats_komplett) this.priceFields.p_insats_komplett.value = data.typ_insats_komplett_delta ?? 1000;

            // Arbetsbeskrivning (%)
            if (this.priceFields.p_utvandig_renovering) this.priceFields.p_utvandig_renovering.value = multToPct(data.arb_utvandig_mult);
            if (this.priceFields.p_invandig_renovering) this.priceFields.p_invandig_renovering.value = multToPct(data.arb_invandig_mult);
            if (this.priceFields.p_utv_plus_inner) this.priceFields.p_utv_plus_inner.value = multToPct(data.arb_utv_plus_innermal_mult);

            // Spröjs + LE-glas
            if (this.priceFields.p_sprojs_under4) this.priceFields.p_sprojs_under4.value = data.sprojs_low_price ?? 250;
            if (this.priceFields.p_sprojs_over4) this.priceFields.p_sprojs_over4.value = data.sprojs_high_price ?? 400;
            if (this.priceFields.p_le_glas) this.priceFields.p_le_glas.value = data.le_glas_per_kvm ?? 2500;

            // Extra flak (adminfält p_extra_1..5)
            if (this.priceFields.p_extra_1) this.priceFields.p_extra_1.value = data.flak_extra_1 ?? 2750;
            if (this.priceFields.p_extra_2) this.priceFields.p_extra_2.value = data.flak_extra_2 ?? 5500;
            if (this.priceFields.p_extra_3) this.priceFields.p_extra_3.value = data.flak_extra_3 ?? 8250;
            if (this.priceFields.p_extra_4) this.priceFields.p_extra_4.value = data.flak_extra_4 ?? 11000;
            if (this.priceFields.p_extra_5) this.priceFields.p_extra_5.value = data.flak_extra_5 ?? 13750;

            // Skatter och version
            if (this.priceFields.p_vat) this.priceFields.p_vat.value = toNumberLoose(data.vat) ?? 25;
            // p_rot lämnas orörd (den finns inte i sheet)
            if (this.priceFields.p_ver) this.priceFields.p_ver.value = data.version ?? this.currentVersion;
            
            this.updateStatus('Prislista laddad');
            this.addLogEntry('Prislista laddad från Google Sheets', 'success');
        } catch (e) {
            console.error(e);
            this.updateStatus('Kunde inte ladda prislista: ' + e.message);
            this.addLogEntry('Fel vid laddning av prislista: ' + e.message, 'error');
        }
    }
    
    fillCurrentPrices() {
        this.initAdminPricing();
        this.addLogEntry('Formulär ifyllt från Google Sheets', 'info');
    }
    
    async savePricesToGoogle() {
        try {
            this.updateStatus('Sparar...');
            this.addLogEntry('Startar sparning av priser till Google Sheets', 'info');
            
            const payload = this.collectPricingData();       // utan "version"
            const res = await savePricingToSheet(payload);
            // uppdatera cache & CONFIG med serverns siffra
            const merged = { ...payload, version: res.version };
            localStorage.setItem(PRICING_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: merged }));
            applyPricingToConfig(merged);
            const versionEl = document.getElementById("pricing_version");
            if (versionEl) versionEl.innerText = String(res.version);
            window.quoteCalculator?.updatePriceCalculation?.();
            
            this.updateStatus('Sparat');
            this.addLogEntry('Priser sparade framgångsrikt till Google Sheets', 'success');
            this.updateVersionDisplay();
            
            this.currentVersion = res.version;
            this.lastUpdated = new Date(res.updated_at || Date.now());
            
            alert('Priser uppdaterade framgångsrikt!');
            
        } catch (error) {
            this.updateStatus('Fel');
            this.addLogEntry('Fel vid sparning: ' + error.message, 'error');
            alert('Fel vid uppdatering: ' + error.message);
        }
    }
    
    collectPricingData() {
        return {
            // Fönster och Dörrar - använd exakta Sheet-nycklar
            dorrparti: Number(this.priceFields.p_dorrpartier?.value) || 5000,
            pardorr_balong_altan: Number(this.priceFields.p_pardorr_balkong?.value) || 9000,
            kallare_glugg: Number(this.priceFields.p_kallare_glugg?.value) || 3500,
            flak_bas: Number(this.priceFields.p_flak?.value) || 6000,
            
            // Luftare-priser - använd exakta Sheet-nycklar
            luftare_1_pris: Number(this.priceFields.p_1_luftare?.value) || 4000,
            luftare_2_pris: Number(this.priceFields.p_2_luftare?.value) || 5500,
            luftare_3_pris: Number(this.priceFields.p_3_luftare?.value) || 8250,
            luftare_4_pris: Number(this.priceFields.p_4_luftare?.value) || 11000,
            luftare_5_pris: Number(this.priceFields.p_5_luftare?.value) || 13750,
            luftare_6_pris: Number(this.priceFields.p_6_luftare?.value) || 16500,
            
            // Renoveringstyper - använd exakta Sheet-nycklar (multiplikatorer)
            renov_modern_alcro_mult: pctToMult(this.priceFields.p_modern_renovering?.value) ?? 1.00,
            renov_trad_linolja_mult: pctToMult(this.priceFields.p_traditionell_renovering?.value) ?? 1.15,
            
            // Fönsteröppning - använd exakta Sheet-nycklar (multiplikatorer)
            oppning_inat_mult: pctToMult(this.priceFields.p_inatgaende?.value) ?? 1.00,
            oppning_utat_mult: pctToMult(this.priceFields.p_utatgaende?.value) ?? 1.05,
            
            // Fönstertyp - använd exakta Sheet-nycklar (delta per båge)
            typ_kopplade_standard_delta: Number(this.priceFields.p_kopplade_standard?.value) || 0,
            typ_kopplade_isolerglas_delta: Number(this.priceFields.p_kopplade_isolerglas?.value) || 0,
            typ_isolerglas_delta: Number(this.priceFields.p_isolerglas?.value) || -400,
            typ_insats_yttre_delta: Number(this.priceFields.p_insats_yttre?.value) || -400,
            typ_insats_inre_delta: Number(this.priceFields.p_insats_inre?.value) || -1250,
            typ_insats_komplett_delta: Number(this.priceFields.p_insats_komplett?.value) || 1000,
            
            // Arbetsbeskrivning - använd exakta Sheet-nycklar (multiplikatorer)
            arb_utvandig_mult: pctToMult(this.priceFields.p_utvandig_renovering?.value) ?? 1.00,
            arb_invandig_mult: pctToMult(this.priceFields.p_invandig_renovering?.value) ?? 1.25,
            arb_utv_plus_innermal_mult: pctToMult(this.priceFields.p_utv_plus_inner?.value) ?? 1.05,
            
            // Spröjs - använd exakta Sheet-nycklar
            sprojs_low_price: Number(this.priceFields.p_sprojs_under4?.value) || 250,
            sprojs_high_price: Number(this.priceFields.p_sprojs_over4?.value) || 400,
            
            // LE-glas och Extra flak - använd exakta Sheet-nycklar
            le_glas_per_kvm: Number(this.priceFields.p_le_glas?.value) || 2500,
            flak_extra_1: Number(this.priceFields.p_extra_1?.value) || 2750,
            flak_extra_2: Number(this.priceFields.p_extra_2?.value) || 5500,
            flak_extra_3: Number(this.priceFields.p_extra_3?.value) || 8250,
            flak_extra_4: Number(this.priceFields.p_extra_4?.value) || 11000,
            flak_extra_5: Number(this.priceFields.p_extra_5?.value) || 13750,
            
            // Skatter - använd exakta Sheet-nycklar
            vat: toNumberLoose(this.priceFields.p_vat?.value) ?? 25
        };
    }
    
    
    updateStatus(status) {
        if (this.statusElement) {
            this.statusElement.textContent = status;
        }
    }
    
    updateVersionDisplay() {
        if (this.versionElement) {
            this.versionElement.textContent = this.currentVersion;
        }
        if (this.lastUpdatedElement && this.lastUpdated) {
            this.lastUpdatedElement.textContent = this.lastUpdated.toLocaleString('sv-SE');
        }
    }
    
    addLogEntry(message, type = 'info') {
        if (!this.logsContainer) return;
        
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `${new Date().toLocaleTimeString('sv-SE')}: ${message}`;
        
        this.logsContainer.appendChild(entry);
        this.logsContainer.scrollTop = this.logsContainer.scrollHeight;
        
        // Begränsa antal loggposter
        const entries = this.logsContainer.querySelectorAll('.log-entry');
        if (entries.length > 50) {
            entries[0].remove();
        }
        
        console.log(`[AdminPanel ${type.toUpperCase()}] ${message}`);
    }
    
    addResetDefaultsButton() {
        const adminActions = document.querySelector('.admin-actions');
        if (!adminActions) return;
        
        const resetDefaultsBtn = document.createElement('button');
        resetDefaultsBtn.className = 'btn secondary';
        resetDefaultsBtn.id = 'btn_reset_defaults';
        resetDefaultsBtn.innerHTML = 'Återställ priser';
        resetDefaultsBtn.title = 'Återställer priserna till hårdkodade standardvärden';
        
        const saveBtn = document.getElementById('btn_admin_save');
        if (saveBtn) {
            adminActions.insertBefore(resetDefaultsBtn, saveBtn);
        } else {
            adminActions.appendChild(resetDefaultsBtn);
        }
        
        resetDefaultsBtn.addEventListener('click', () => {
            this.resetToDefaultPrices();
        });
        
        this.addLogEntry('Återställ standardpriser-knapp tillagd', 'info');
    }

    async resetToDefaultPrices() {
        const confirmed = confirm(
            'Är du säker på att du vill återställa alla priser till standardvärden?\n\n' +
            'Detta kommer att:\n' +
            '• Återställa alla prisfält till hårdkodade standardvärden\n' +
            '• Spara standardpriserna till Google Sheets\n' +
            '• Uppdatera prisberäkningarna direkt\n\n' +
            'Denna åtgärd kan inte ångras.'
        );
        
        if (!confirmed) {
            this.addLogEntry('Återställning av standardpriser avbruten av användaren', 'info');
            return;
        }
        
        try {
            this.updateStatus('Återställer standardpriser...');
            this.addLogEntry('Startar återställning till standardpriser', 'info');
            
            this.fillFieldsWithDefaults();
            this.addLogEntry('Admin-formulär ifyllt med standardpriser', 'info');
            
            const payload = this.collectPricingDataFromDefaults();
            const res = await savePricingToSheet(payload);
            
            const merged = { ...payload, version: res.version, source: 'reset_to_defaults' };
            setCachedPricing(merged);
            applyPricingToConfig(merged);
            
            if (window.quoteCalculator) {
                window.quoteCalculator.updatePriceCalculation();
            }
            
            this.currentVersion = res.version;
            this.lastUpdated = new Date(res.updated_at || Date.now());
            this.updateVersionDisplay();
            
            this.updateStatus('Standardpriser återställda');
            this.addLogEntry('✅ Standardpriser återställda och sparade till Google Sheets', 'success');
            
            alert('Standardpriser har återställts framgångsrikt!\n\nAlla priser är nu återställda till originalvärdena.');
            
        } catch (error) {
            this.updateStatus('Fel vid återställning');
            this.addLogEntry('❌ Fel vid återställning av standardpriser: ' + error.message, 'error');
            alert('Fel vid återställning av standardpriser:\n' + error.message);
        }
    }

    fillFieldsWithDefaults() {
        // Fönster och Dörrar
        if (this.priceFields.p_dorrpartier) this.priceFields.p_dorrpartier.value = DEFAULT_PRICES.dorrparti;
        if (this.priceFields.p_pardorr_balkong) this.priceFields.p_pardorr_balkong.value = DEFAULT_PRICES.pardorr_balong_altan;
        if (this.priceFields.p_kallare_glugg) this.priceFields.p_kallare_glugg.value = DEFAULT_PRICES.kallare_glugg;
        if (this.priceFields.p_flak) this.priceFields.p_flak.value = DEFAULT_PRICES.flak_bas;
        
        // Luftare
        if (this.priceFields.p_1_luftare) this.priceFields.p_1_luftare.value = DEFAULT_PRICES.luftare_1_pris;
        if (this.priceFields.p_2_luftare) this.priceFields.p_2_luftare.value = DEFAULT_PRICES.luftare_2_pris;
        if (this.priceFields.p_3_luftare) this.priceFields.p_3_luftare.value = DEFAULT_PRICES.luftare_3_pris;
        if (this.priceFields.p_4_luftare) this.priceFields.p_4_luftare.value = DEFAULT_PRICES.luftare_4_pris;
        if (this.priceFields.p_5_luftare) this.priceFields.p_5_luftare.value = DEFAULT_PRICES.luftare_5_pris;
        if (this.priceFields.p_6_luftare) this.priceFields.p_6_luftare.value = DEFAULT_PRICES.luftare_6_pris;
        
        // Renoveringstyper (konvertera multiplikatorer till procent)
        if (this.priceFields.p_modern_renovering) this.priceFields.p_modern_renovering.value = multToPct(DEFAULT_PRICES.renov_modern_alcro_mult);
        if (this.priceFields.p_traditionell_renovering) this.priceFields.p_traditionell_renovering.value = multToPct(DEFAULT_PRICES.renov_trad_linolja_mult);
        
        // Fönsteröppning (konvertera multiplikatorer till procent)
        if (this.priceFields.p_inatgaende) this.priceFields.p_inatgaende.value = multToPct(DEFAULT_PRICES.oppning_inat_mult);
        if (this.priceFields.p_utatgaende) this.priceFields.p_utatgaende.value = multToPct(DEFAULT_PRICES.oppning_utat_mult);
        
        // Fönstertyper (delta per båge)
        if (this.priceFields.p_kopplade_standard) this.priceFields.p_kopplade_standard.value = DEFAULT_PRICES.typ_kopplade_standard_delta;
        if (this.priceFields.p_kopplade_isolerglas) this.priceFields.p_kopplade_isolerglas.value = DEFAULT_PRICES.typ_kopplade_isolerglas_delta;
        if (this.priceFields.p_isolerglas) this.priceFields.p_isolerglas.value = DEFAULT_PRICES.typ_isolerglas_delta;
        if (this.priceFields.p_insats_yttre) this.priceFields.p_insats_yttre.value = DEFAULT_PRICES.typ_insats_yttre_delta;
        if (this.priceFields.p_insats_inre) this.priceFields.p_insats_inre.value = DEFAULT_PRICES.typ_insats_inre_delta;
        if (this.priceFields.p_insats_komplett) this.priceFields.p_insats_komplett.value = DEFAULT_PRICES.typ_insats_komplett_delta;
        
        // Arbetsbeskrivning (konvertera multiplikatorer till procent)
        if (this.priceFields.p_utvandig_renovering) this.priceFields.p_utvandig_renovering.value = multToPct(DEFAULT_PRICES.arb_utvandig_mult);
        if (this.priceFields.p_invandig_renovering) this.priceFields.p_invandig_renovering.value = multToPct(DEFAULT_PRICES.arb_invandig_mult);
        if (this.priceFields.p_utv_plus_inner) this.priceFields.p_utv_plus_inner.value = multToPct(DEFAULT_PRICES.arb_utv_plus_innermal_mult);
        
        // Spröjs
        if (this.priceFields.p_sprojs_under4) this.priceFields.p_sprojs_under4.value = DEFAULT_PRICES.sprojs_low_price;
        if (this.priceFields.p_sprojs_over4) this.priceFields.p_sprojs_over4.value = DEFAULT_PRICES.sprojs_high_price;
        
        // LE-glas och Extra flak
        if (this.priceFields.p_le_glas) this.priceFields.p_le_glas.value = DEFAULT_PRICES.le_glas_per_kvm;
        if (this.priceFields.p_extra_1) this.priceFields.p_extra_1.value = DEFAULT_PRICES.flak_extra_1;
        if (this.priceFields.p_extra_2) this.priceFields.p_extra_2.value = DEFAULT_PRICES.flak_extra_2;
        if (this.priceFields.p_extra_3) this.priceFields.p_extra_3.value = DEFAULT_PRICES.flak_extra_3;
        if (this.priceFields.p_extra_4) this.priceFields.p_extra_4.value = DEFAULT_PRICES.flak_extra_4;
        if (this.priceFields.p_extra_5) this.priceFields.p_extra_5.value = DEFAULT_PRICES.flak_extra_5;
        
        // Skatter
        if (this.priceFields.p_vat) this.priceFields.p_vat.value = DEFAULT_PRICES.vat;
        if (this.priceFields.p_ver) this.priceFields.p_ver.value = DEFAULT_PRICES.version;
    }

    collectPricingDataFromDefaults() {
        return { ...DEFAULT_PRICES };
    }

    // Metod för att integrera med Google Sheets API (att implementeras senare)
    async initializeGoogleSheetsAPI() {
        // TODO: Implementera Google Sheets API-integration
        // Detta kommer att kräva:
        // 1. Google Apps Script deployment
        // 2. API-nycklar och autentisering
        // 3. Korrekt URL till deployed script

        this.addLogEntry('Google Sheets API inte implementerad ännu', 'info');
    }
}
