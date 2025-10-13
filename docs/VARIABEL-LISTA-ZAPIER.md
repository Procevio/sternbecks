# 📋 KOMPLETT VARIABELLISTA FÖR ZAPIER AUTOMATION

**Skapad för:** Sternbecks Anbudsapp  
**Datum:** 2025-08-21  
**Syfte:** Mappning för Zapier automation och Google Forms integration  

## 🗂️ INNEHÅLLSFÖRTECKNING

1. [Formulärfält (Input-variabler)](#1-formulärfält-input-variabler)
2. [Google Forms Mappning](#2-google-forms-mappning)
3. [JavaScript Beräknings-variabler](#3-javascript-beräknings-variabler)
4. [DOM Element-IDs och CSS-klasser](#4-dom-element-ids-och-css-klasser)
5. [Zapier Webhook Payload](#5-zapier-webhook-payload)
6. [Specialvärden och Validering](#6-specialvärden-och-validering)

---

## 1. FORMULÄRFÄLT (INPUT-VARIABLER)

### 📞 KONTAKTINFORMATION

| Fältnamn | HTML ID | HTML name | Typ | Beskrivning | Obligatoriskt |
|----------|---------|-----------|-----|-------------|---------------|
| **Företag/Namn** | `company` | `company` | text | Kundnamn eller företagsnamn | ✅ Ja |
| **Kontaktperson** | `contact_person` | `contact_person` | text | Namn på kontaktperson | ❌ Nej |
| **E-post** | `email` | `email` | email | E-postadress | ✅ Ja |
| **Telefonnummer** | `phone` | `phone` | tel | Telefonnummer | ✅ Ja |
| **Adress** | `address` | `address` | text | Gatuadress | ✅ Ja |
| **Fastighetsbeteckning** | `fastighetsbeteckning` | `fastighetsbeteckning` | text | T.ex. "Exempel 1:23" (auto-fyller "-" om tomt) | ❌ Nej |
| **Postnummer** | `postal_code` | `postal_code` | text | 5 siffror, pattern: [0-9]{5} | ✅ Ja |
| **Ort** | `city` | `city` | text | Ortnamn | ✅ Ja |

### 🔧 TYP AV RENOVERING

| Fältnamn | HTML ID | HTML name | Typ | Värden | Obligatoriskt |
|----------|---------|-----------|-----|--------|---------------|
| **Renoveringstyp** | `typ_av_renovering` | `typ_av_renovering` | select | "Traditionell - Linoljebehandling", "Modern - Alcro bestå" | ✅ Ja |

### 👷 ARBETSBESKRIVNING

| Fältnamn | HTML name | Typ | Möjliga värden | Obligatoriskt |
|----------|-----------|-----|----------------|---------------|
| **Arbetsbeskrivning** | `arbetsbeskrivning` | radio | "Utvändig renovering", "Invändig renovering", "Utvändig renovering samt målning av innerbågens insida" | ✅ Ja |

### 🪟 TYP AV FÖNSTER (CHECKBOXES - KAN VÄLJA FLERA)

| Fältnamn | HTML name | Typ | Möjliga värden | Prispåverkan |
|----------|-----------|-----|----------------|--------------|
| **Fönstertyper** | `typ_av_fonster[]` | checkbox[] | Se lista nedan | Varierande |

**Tillgängliga fönstertyp-alternativ:**
- `"Kopplade standard"` → Standard pris (1.0x)
- `"Isolerglas"` → +400kr per fönster
- `"Kopplade isolerglas"` → **+20% på totalsumman** ⭐ NY
- `"Insatsbågar yttre"` → Inget pris i nuläget (0kr) ⭐ NY
- `"Insatsbågar inre"` → Inget pris i nuläget (0kr) ⭐ NY  
- `"Insatsbågar komplett"` → Inget pris i nuläget (0kr) ⭐ NY
- `"Inåtgående"` → -5% (0.95x)
- `"Utåtgående"` → Standard pris (1.0x)

### 💰 PRISJUSTERING

| Fältnamn | HTML ID | HTML name | Typ | Beskrivning | Standardvärde |
|----------|---------|-----------|-----|-------------|---------------|
| **Tillägg (+)** | `price_adjustment_plus` | `price_adjustment_plus` | number | Tillägg i kronor | 0 |
| **Avdrag (-)** | `price_adjustment_minus` | `price_adjustment_minus` | number | Avdrag i kronor | 0 |
| **Materialkostnad** | `materialkostnad` | `materialkostnad` | select | Procent: 5, 7, 10, 13, 15, 20 | 10% |

### 🔢 ANTAL PARTIER

| Fältnamn | HTML ID | HTML name | Typ | Beskrivning | Placeholder |
|----------|---------|-----------|-----|-------------|-------------|
| **Fönsterpartier** | `window_sections` | `window_sections` | number | Totalt antal fönsterpartier | "Ange antal" |
| **Dörrpartier** | `antal_dorrpartier` | `antal_dorrpartier` | number | Antal dörrpartier (6000kr/st) | "Ange antal" |
| **1 luftare** | `antal_1_luftare` | `antal_1_luftare` | number | Antal 1-luftare (3500kr/st) | "Ange antal" |
| **2 luftare** | `antal_2_luftare` | `antal_2_luftare` | number | Antal 2-luftare (5000kr/st) | "Ange antal" |
| **3 luftare** | `antal_3_luftare` | `antal_3_luftare` | number | Antal 3-luftare (6500kr/st) | "Ange antal" |
| **4 luftare** | `antal_4_luftare` | `antal_4_luftare` | number | Antal 4-luftare (8000kr/st) | "Ange antal" |
| **5 luftare** | `antal_5_luftare` | `antal_5_luftare` | number | Antal 5-luftare (9000kr/st) | "Ange antal" |
| **6 luftare** | `antal_6_luftare` | `antal_6_luftare` | number | Antal 6-luftare (11000kr/st) | "Ange antal" |

### 🖼️ SPRÖJS

| Fältnamn | HTML name | Typ | Värden | Beskrivning |
|----------|-----------|-----|--------|-------------|
| **Spröjs val** | `sprojs_choice` | radio | "Nej" (default), "Ja" | Aktiverar spröjs-fält |
| **Antal spröjs per båge** | `antal_sprojs_per_bage` | number | Heltal | Visas endast om "Ja" valts (300kr/ruta) |

### ✨ LE-GLAS

| Fältnamn | HTML ID | HTML name | Typ | Värden | Beskrivning |
|----------|---------|-----------|-----|--------|-------------|
| **LE-glas val** | - | `le_glas_choice` | radio | "Nej" (default), "Ja" | Aktiverar LE-glas fält |
| **LE-glas kvm** | `le_kvm` | `le_kvm` | number | Decimal | Visas endast om "Ja" valts (2500kr/kvm) |

### 🏠 ROT-AVDRAG

| Fältnamn | HTML name | Typ | Möjliga värden | Obligatoriskt |
|----------|-----------|-----|----------------|---------------|
| **Fastighet ROT-berättigad** | `fastighet_rot_berättigad` | radio | "Ja - Villa/Radhus", "Nej - Hyresrätt/Kommersiell fastighet" | ✅ Ja |
| **Kund ROT-berättigad** | `är_du_berättigad_rot_avdrag` | radio | "Ja - inkludera ROT-avdrag i anbudet", "Nej - visa fullpris utan avdrag" | ✅ Ja |

---

## 2. GOOGLE FORMS MAPPNING

### 📡 CONFIG.FORM_FIELDS (assets/js/app.js)

```javascript
FORM_FIELDS: {
    'company': 'entry.840064910',
    'contact_person': 'entry.840064910',    // ⚠️ Använder samma som company
    'email': 'entry.34850442',
    'phone': 'entry.1576794399',
    'address': 'entry.451691303',
    'postal_code': 'entry.183003918',
    'city': 'entry.1773944220',
    'fastighetsbeteckning': 'entry.1947831774',
    'typ_av_renovering': 'entry.1001679891',
    'arbetsbeskrivning': 'entry.987654321',
    'typ_av_fonster': 'entry.1431165045',      // ⭐ CHECKBOX ARRAY → joinad sträng
    'extra_hours': 'entry.280137558',          // ❌ Används inte i nuvarande form
    'materialkostnad': 'entry.1087712385',
    'window_sections': 'entry.1428207307',
    'antal_dorrpartier': 'entry.15247411',
    'antal_1_luftare': 'entry.1346898155',
    'antal_2_luftare': 'entry.994599656',
    'antal_3_luftare': 'entry.882686399',
    'antal_4_luftare': 'entry.421567894',
    'antal_5_luftare': 'entry.15154510',
    'antal_6_luftare': 'entry.904743569',
    'sprojs': 'entry.105600632',               // ❌ Borde vara sprojs_choice
    'antal_sprojs_per_bage': 'entry.1553251704',
    'byte_till_le_glas': 'entry.1641252616',  // ❌ Borde vara le_glas_choice  
    'le_kvm': 'entry.1217325448',
    'fastighet_rot_berättigad': 'entry.1617253565',
    'är_du_berättigad_rot_avdrag': 'entry.234567890' // ⚠️ PLACEHOLDER - UPPDATERA!
}
```

### 📋 EXTRA GOOGLE FORMS FÄLT

Dessa fält skickas också automatiskt:

| Fältnamn | Entry ID | Värde | Beskrivning |
|----------|----------|-------|-------------|
| **ROT Beräknat belopp** | `entry.ROT_CALCULATED_AMOUNT` | Formaterad sträng | Endast om ROT-avdrag aktivt |
| **Prisberäkning** | `entry.calculated_price` | Detaljerad text | Komplett prissammanfattning |

---

## 3. JAVASCRIPT BERÄKNINGS-VARIABLER

### 💻 PRISSÄTTNING (CONFIG objekt)

```javascript
// Grundpriser per enhet (kronor)
UNIT_PRICES: {
    'antal_dorrpartier': 6000,
    'antal_1_luftare': 3500,
    'antal_2_luftare': 5000,
    'antal_3_luftare': 6500,
    'antal_4_luftare': 8000,
    'antal_5_luftare': 9000,
    'antal_6_luftare': 11000
}

// Renoveringstyp multiplikatorer
RENOVATION_TYPE_MULTIPLIERS: {
    'Traditionell - Linoljebehandling': 1.15,  // +15%
    'Modern - Alcro bestå': 1.0                // Standard
}

// Fönstertyp multiplikatorer ⭐ UPPDATERAT
WINDOW_TYPE_MULTIPLIERS: {
    'Kopplade standard': 1.0,
    'Isolerglas': 'per_window_400',        // +400kr per fönster
    'Kopplade isolerglas': 1.20,          // +20% på totalen ⭐ NY
    'Insatsbågar yttre': 0,               // Inget pris ⭐ NY
    'Insatsbågar inre': 0,                // Inget pris ⭐ NY
    'Insatsbågar komplett': 0,            // Inget pris ⭐ NY
    'Inåtgående': 0.95,                   // -5%
    'Utåtgående': 1.0
}

// Arbetsbeskrivning multiplikatorer
WORK_DESCRIPTION_MULTIPLIERS: {
    'Utvändig renovering': 1.0,
    'Invändig renovering': 1.25,          // +25%
    'Utvändig renovering samt målning av innerbågens insida': 1.05  // +5%
}

// Tillägg
EXTRAS: {
    SPROJS_PER_RUTA: 300,     // 300kr per ruta
    E_GLASS_PER_SQM: 2500,    // 2500kr/kvm
    VAT_RATE: 0.25,           // 25% moms
    ROT_DEDUCTION: 0.5        // 50% ROT-avdrag
}
```

### 🧮 BERÄKNINGS-VARIABLER (collectPricingData)

Dessa variabler skapas i JavaScript för intern beräkning:

| Variabel | Typ | Källa | Beskrivning |
|----------|-----|-------|-------------|
| `doorSections` | number | `antal_dorrpartier` | Antal dörrpartier |
| `luftare1-6` | number | `antal_X_luftare` | Antal luftare per typ |
| `totalWindows` | number | `window_sections` | Totalt antal fönster |
| `renovationType` | string | `typ_av_renovering` | Vald renoveringstyp |
| `workDescription` | string | `arbetsbeskrivning` | Vald arbetsbeskrivning |
| `windowTypes` | Array | `typ_av_fonster[]` | ⭐ Array av valda fönstertyper |
| `priceAdjustmentPlus/Minus` | number | Prisjustering | Tillägg/avdrag |
| `materialPercentage` | number | `materialkostnad` | Materialkostnad i % |
| `hasSprojs` | boolean | `sprojs_choice` | Om spröjs är valt |
| `sprojsPerWindow` | number | `antal_sprojs_per_bage` | Antal spröjs per båge |
| `hasEGlass` | boolean | `le_glas_choice` | Om LE-glas är valt |
| `eGlassSqm` | number | `le_kvm` | LE-glas kvm |
| `hasRotDeduction` | boolean | ROT-frågor | Om ROT-avdrag ska tillämpas |

### 📊 BERÄKNINGS-RESULTAT

Dessa värden beräknas och visas i prisavsnittet:

| Variabel | Beskrivning | Visas i |
|----------|-------------|---------|
| `baseComponentsPrice` | Grundpris (luftare + dörrar) | `#base-components-price` |
| `renovationTypeCost` | Renoveringstyp-tillägg | Kombineras i `#window-type-cost` |
| `windowTypeCost` | Fönstertyp-tillägg | `#window-type-cost` |
| `extrasCost` | Spröjs + LE-glas | `#extras-cost` |
| `workDescriptionMarkup` | Arbetsbeskrivning-påslag | `#renovation-markup` |
| `priceAdjustment` | Prisjustering | `#extra-hours-cost` |
| `materialCost` | Materialkostnad | `#material-cost-display` |
| `subtotalExclVat` | Summa exkl. moms | `#subtotal-price` |
| `vatCost` | Moms (25%) | `#vat-cost` |
| `totalInclVat` | ⭐ Total inkl. moms | `#total-with-vat` |
| `materialDeduction` | ⭐ Materialkostnad (från total inkl. moms) | `#material-deduction` |
| `rotDeduction` | ⭐ ROT-avdrag (efter material) | `#rot-deduction` |
| `finalCustomerPrice` | ⭐ Slutpris kunden betalar | `#final-customer-price` |

---

## 4. DOM ELEMENT-IDS OCH CSS-KLASSER

### 🎯 VIKTIGA ELEMENT-IDS

#### Formulärelement
| ID | Typ | Beskrivning |
|----|-----|-------------|
| `quote-form` | form | Huvudformuläret |
| `submit-btn` | button | Skicka-knappen |
| `loading-spinner` | div | Laddnings-animation |

#### Prisvisning  
| ID | Typ | Innehåll |
|----|-----|----------|
| `base-components-price` | span | Grundkomponenter pris |
| `window-type-cost` | span | Fönster- och renoveringstyp kostnad |
| `extras-cost` | span | Spröjs/LE-glas kostnad |
| `renovation-markup` | span | Arbetsbeskrivning påslag |
| `extra-hours-cost` | span | Prisjustering |
| `material-cost-display` | span | Materialkostnad |
| `subtotal-price` | span | Summa exkl. moms |
| `vat-cost` | span | Moms |
| `total-with-vat` | span | ⭐ Total inkl. moms |
| `material-deduction` | span | ⭐ Materialkostnad avdrag |
| `rot-row` | div | ROT-avdrag rad (visa/dölj) |
| `rot-deduction` | span | ROT-avdrag belopp |
| `final-customer-price` | span | ⭐ Slutpris |

#### Validering
| ID | Typ | Beskrivning |
|----|-----|-------------|
| `parties-validation` | div | Validering för antal partier |
| `parties-validation-text` | span | Valideringstext |
| `success-message` | div | Framgångsmeddelande |
| `error-message` | div | Felmeddelande |

#### Lösenordsskydd
| ID | Typ | Beskrivning |
|----|-----|-------------|
| `password-overlay` | div | Lösenordsskärm |
| `password-form` | form | Lösenordsformulär |
| `password-input` | input | Lösenordsfält |
| `password-error` | div | Lösenordsfel |
| `main-app` | main | Huvudapplikation |

#### Tema och Navigation
| ID | Typ | Beskrivning |
|----|-----|-------------|
| `theme-toggle` | button | Tema-växlare |

### 🎨 VIKTIGA CSS-KLASSER

#### Formulär-styling
| Klass | Beskrivning |
|-------|-------------|
| `.container` | Huvudcontainer |
| `.form-container` | Formulärcontainer |
| `.form-header` | Formulärhuvud |
| `.quote-form` | Formulärstyling |
| `.form-section` | Formulärsektioner |
| `.form-row` | Formulärrader |
| `.form-group` | Formulärgrupper |
| `.form-select` | Select-element styling |

#### Input-element
| Klass | Beskrivning |
|-------|-------------|
| `.radio-group` | Radio button grupp |
| `.radio-label` | Radio button label |
| `.radio-custom` | Anpassad radio styling |
| `.checkbox-group` | ⭐ Checkbox grupp |
| `.checkbox-label` | ⭐ Checkbox label |
| `.checkmark` | ⭐ Anpassad checkbox styling |

#### Layout
| Klass | Beskrivning |
|-------|-------------|
| `.half-width` | 50% bredd (tablet+) |
| `.third-width` | 33% bredd (tablet+) |
| `.quarter-width` | 25% bredd (tablet+) |

#### Prisvisning
| Klass | Beskrivning |
|-------|-------------|
| `.price-section` | Prissektion |
| `.price-breakdown` | Prisuppdelning |
| `.price-category` | Priskategori |
| `.price-row` | Prisrad |
| `.price-separator` | Prisseparator |
| `.final-separator` | Final prisseparator |

#### Meddelanden och Validering
| Klass | Beskrivning |
|-------|-------------|
| `.error-message` | Felmeddelanden |
| `.validation-message` | Valideringsmeddelanden |
| `.message` | Allmänna meddelanden |
| `.success-message` | Framgångsmeddelanden |

#### Knappar
| Klass | Beskrivning |
|-------|-------------|
| `.submit-btn` | Skicka-knapp |
| `.submit-btn.loading` | Knapp i laddningsläge |
| `.btn-text` | Knapptext |
| `.loading-spinner` | Laddnings-spinner |

---

## 5. ZAPIER WEBHOOK PAYLOAD

### 📡 FÖRVÄNTAD PAYLOAD-STRUKTUR

När formuläret skickas, skickas följande data till Google Forms (och därmed tillgängligt för Zapier):

```json
{
  // Kontaktinformation
  "entry.840064910": "Företagsnamn AB", 
  "entry.34850442": "kontakt@företag.se",
  "entry.1576794399": "08-123 456 78",
  "entry.451691303": "Testgatan 123",
  "entry.183003918": "12345",
  "entry.1773944220": "Stockholm",
  "entry.1947831774": "Exempel 1:23",
  
  // Projektinfo
  "entry.1001679891": "Modern - Alcro bestå",
  "entry.987654321": "Utvändig renovering",
  "entry.1431165045": "Kopplade standard, Isolerglas", // ⭐ JOINAD STRÄNG
  "entry.1087712385": "10",
  
  // Antal
  "entry.1428207307": "5",
  "entry.15247411": "1", 
  "entry.1346898155": "3",
  "entry.994599656": "2",
  "entry.882686399": "0",
  "entry.421567894": "0", 
  "entry.15154510": "0",
  "entry.904743569": "0",
  
  // Tillägg  
  "entry.1553251704": "0",
  "entry.1217325448": "0.0",
  
  // ROT-avdrag
  "entry.1617253565": "Ja - Villa/Radhus",
  "entry.234567890": "Nej - visa fullpris utan avdrag",
  
  // Beräknade värden
  "entry.ROT_CALCULATED_AMOUNT": "0 kr",
  "entry.calculated_price": "DETALJERAD PRISBERÄKNING TEXT..."
}
```

### ⚠️ VIKTIGA ANTECKNINGAR FÖR ZAPIER

1. **Checkbox-hantering:** `typ_av_fonster[]` skickas som kommaseparerad sträng
2. **ROT-beräkning:** Endast skickas om ROT-avdrag är aktivt
3. **Materialkostnad:** Nya beräkningsordningen är implementerad
4. **Tomma värden:** Fält med tomma värden skickas inte alls
5. **Automatisk fastighetsbeteckning:** Sätts till "-" om tomt

---

## 6. SPECIALVÄRDEN OCH VALIDERING

### ✅ VALIDERINGS-REGLER

1. **Obligatoriska fält:**
   - company, email, phone, address, postal_code, city
   - typ_av_renovering, arbetsbeskrivning  
   - fastighet_rot_berättigad, är_du_berättigad_rot_avdrag

2. **Antal-validering:**
   - Minst ett antal-fält > 0 krävs
   - Fönsterpartier ska matcha totala luftare

3. **Format-validering:**
   - E-post: Standard email-format
   - Telefon: Minst 8 tecken, siffror och vissa specialtecken
   - Postnummer: Exakt 5 siffror

### 🔄 AUTOMATISKA TRANSFORMATIONER

1. **Fastighetsbeteckning:** Tom → "-" 
2. **Checkbox arrays:** Multivärden → "Värde1, Värde2, Värde3"
3. **Prisformatering:** Number → "12 345 kr"
4. **ROT-beräkning:** Endast när tillämpligt

### 📋 ZAPIER INTEGRATIONS-CHECKLIST

För att uppdatera din Zapier automation:

- [ ] Kontrollera att alla `entry.XXXXXXX` ID:n stämmer
- [ ] Hantera `typ_av_fonster` som kommaseparerad sträng  
- [ ] Uppdatera `är_du_berättigad_rot_avdrag` entry ID (placeholder nu)
- [ ] Lägg till mappning för nya insatsbågar-alternativ
- [ ] Kontrollera att nya beräkningsordningen förstås
- [ ] Testa med tomma/partiella formulär
- [ ] Verifiera ROT-avdrag beräkningar

---

## 🚀 FÄRDIG FÖR ZAPIER!

Din anbudsapp är nu redo för Zapier integration med denna kompletta variabelmappning. Alla fält, beräkningar och transformationer är dokumenterade för smidig automation.

**Lycka till med din Zapier-setup! 🎉**