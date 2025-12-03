# Sternbecks Anbudsapplikation

En professionell webbapplikation för anbudsgenerering för Sternbecks Måleri & Fönsterhantverk. Applikationen ersätter Google Forms-formulär och integrerar med befintlig Zapier-automation.

## 🌟 Funktioner

- **Responsiv design** - Fungerar perfekt på både mobil och desktop
- **Avancerad prissättningslogik** - Komplett prisberäkning med komponenter, pålägg och avdrag
- **Realtidsberäkning** - Automatisk uppdatering av alla priskomponenter vid ändringar
- **Förenklad prisvisning** - Fokuserad visning av slutligt kundpris (dolda delpriser)
- **ROT-avdrag beräkning** - Automatisk beräkning av 50% ROT-avdrag på arbetskostnad
- **Google Forms Integration** - Automatisk inskickning med detaljerad prissammanfattning
- **Formulärvalidering** - Omfattande validering med felhantering
- **Auto-fill funktioner** - Automatisk ifyllning av fastighetsbeteckning
- **Lösenordsskydd** - Säker åtkomst till anbudsformuläret
- **Mörkt tema** - Temaväxling med localStorage persistence
- **Modern design** - Elegant design som speglar företagets kvalitetshantverk
- **Tillgänglighet** - Byggd med tillgänglighet i fokus (WCAG-riktlinjer)

## 🎨 Design

Applikationen använder företagets färgschema:
- **Mörk antracit** (#2c2c2c) - Huvudfärg
- **Krämbeige** (#d4c4a0) - Accent färg  
- **Guld/beige** (#c8b896) - Kompletterande färg

## 📋 Formulärfält

### Kontaktinformation
- Företag/Namn (obligatorisk)
- Kontaktperson
- E-post (obligatorisk)
- Telefonnummer (obligatorisk)
- Adress (obligatorisk)
- Postnummer (obligatorisk)
- Ort (obligatorisk)
- Fastighetsbeteckning (auto-fill med "-" om tomt)

### Typ av renovering
- **Typ av renovering** (obligatorisk dropdown):
  - Traditionell - Linoljebehandling (+15%)
  - Modern - Alcro bestå (standardpris)

### Arbetsbeskrivning  
- **Arbetsbeskrivning** (obligatorisk radio button):
  - Utvändig renovering (100% av totalsumman)
  - Invändig renovering (+25% på totalsumman)
  - Utvändig renovering samt målning av innerbågens insida (+5% på totalsumman)

### Typ av fönster
- **Typ av fönster** (dropdown):
  - Kopplade standard (standardpris)
  - Isolerglas (+400kr/fönster)
  - Insatsbågar (+300kr/fönster)
  - Inåtgående (-5%)
  - Utåtgående (standardpris)
- **Extra timmar** (700 kr/timme)
- **Materialkostnad** (procentuell dropdown: 5%, 7%, 10%, 13%, 15%, 20%)

### Antal partier
- **Fönsterpartier** (används för spröjs och fönstertyp-beräkningar)
- **Dörrpartier** (6000kr/st)
- **1 luftare** (3500kr/st)
- **2 luftare** (5000kr/st)
- **3 luftare** (6500kr/st)
- **4 luftare** (8000kr/st)
- **5 luftare** (9000kr/st)
- **6 luftare** (11000kr/st)

### Tillägg och specialalternativ
- **Spröjs** (checkbox + antal per båge)
  - 300kr per ruta × antal spröjs × antal fönster
- **E-glas upgrade** (checkbox + kvm)
  - 2500kr/kvm
- **ROT-avdrag berättigande** (radio buttons):
  - Fastighet ROT-berättigad: Ja (Villa/Radhus) / Nej (Hyresrätt/Kommersiell)
  - Kund ROT-berättigad: Ja (inkludera i anbud) / Nej (visa fullpris)
  - 50% avdrag på arbetskostnad (exkl. material)

## 💰 Prissättningslogik

Applikationen använder en avancerad prissättningsmodell med följande komponenter:

### 1. Grundkomponenter
- **Luftare och dörrar**: Fast prissättning per enhet enligt tabell ovan
- **Renoveringstyp-tillägg**: Procentuella tillägg från dropdown (Traditionell +15%, Modern standard)
- **Fönstertyp-tillägg**: Procentuella eller fasta tillägg beroende på typ
- **Spröjs/E-glas**: Tillägg baserat på antal och area
- **Extra timmar**: 700kr per timme
- **Material**: Procentuell kostnad (5-20% av subtotal)
- **Arbetsbeskrivning-pålägg**: Procentuellt pålägg från radio buttons

### 2. Uppdaterad beräkningsordning
1. Beräkna grundkomponenter (luftare + dörrar)
2. Lägg till renoveringstyp-tillägg (dropdown)
3. Lägg till fönstertyp-tillägg
4. Lägg till spröjs/E-glas kostnader
5. Lägg till extra timmar
6. Beräkna materialkostnad (procentuellt)
7. Applicera arbetsbeskrivning-pålägg (radio buttons)
8. Beräkna moms (25%)
9. Applicera ROT-avdrag (50% på arbetskostnad exkl. material)

### 3. Förenklad prisvisning (synlig för kunden)
```
Totalt inkl. moms: XX,XXX kr
ROT-avdrag (50%): -X,XXX kr (om tillämpligt)
────────────────────────────────────
KUNDEN BETALAR: XX,XXX kr
```

### 4. Detaljerad prissammanfattning (skickas till Google Forms)
```
Grundkomponenter:
├── Luftare och dörrar: XX,XXX kr
├── Renoveringstyp (Traditionell/Modern): +X,XXX kr
├── Fönstertyp: +X,XXX kr
├── Spröjs/E-glas: +X,XXX kr
├── Extra timmar: +X,XXX kr
├── Material (X%): +X,XXX kr
└── Arbetsbeskrivning: +X,XXX kr
────────────────────────────────────
Summa exkl. moms: XX,XXX kr
Moms (25%): +X,XXX kr
────────────────────────────────────
Totalt inkl. moms: XX,XXX kr

ROT-AVDRAG INFORMATION:
- Fastighet berättigad: Ja/Nej
- Kund berättigad: Ja/Nej
- ROT-avdrag (50%): -X,XXX kr
────────────────────────────────────
KUNDEN BETALAR: XX,XXX kr
```

## ⚙️ Installation & Setup

### 1. Klona eller ladda ner projektet
```bash
git clone [repository-url]
cd sternbecks-anbudsapp
```

### 2. Konfigurera Google Forms Integration

**VIKTIGT:** Du måste uppdatera följande i `assets/js/app.js`:

*För detaljerad konfigurationsguide, se `docs/config-example.md`*

1. **Google Forms URL**: Ersätt placeholder-URL med din riktiga Google Forms URL
```javascript
GOOGLE_FORMS_URL: 'https://docs.google.com/forms/d/e/YOUR_REAL_FORM_ID/formResponse'
```

2. **Form Field Mapping**: Uppdatera entry IDs för att matcha ditt Google Forms:
```javascript
FORM_FIELDS: {
    'company': 'entry.840064910',           // Kundnamn
    'contact-person': 'entry.840064910',    // Kontaktperson
    'email': 'entry.34850442',             // E-post
    'phone': 'entry.1576794399',           // Telefonnummer
    'address': 'entry.451691303',          // Adress
    'postal-code': 'entry.183003918',      // Postnummer
    'city': 'entry.1773944220',            // Ort
    'fastighetsbeteckning': 'entry.1947831774', // Fastighetsbeteckning
    'typ-av-renovering': 'entry.1001679891',   // Typ av renovering (dropdown)
    'arbetsbeskrivning': 'entry.987654321',    // Arbetsbeskrivning (radio buttons) - UPPDATERA MED KORREKT ENTRY ID
    'typ-av-fonster': 'entry.1431165045',      // Typ av fönster
    'extra-hours': 'entry.280137558',          // Extra timmar
    'materialkostnad': 'entry.1087712385',     // Materialkostnad (procent)
    'window-sections': 'entry.1428207307',     // Antal fönsterpartier
    'antal-dorrpartier': 'entry.15247411',     // Antal dörrpartier
    'antal-1-luftare': 'entry.1346898155',     // Antal 1 luftare
    'antal-2-luftare': 'entry.994599656',      // Antal 2 luftare
    'antal-3-luftare': 'entry.882686399',      // Antal 3 luftare
    'antal-4-luftare': 'entry.421567894',      // Antal 4 luftare
    'antal-5-luftare': 'entry.15154510',       // Antal 5 luftare
    'antal-6-luftare': 'entry.904743569',      // Antal 6 luftare
    'sprojs': 'entry.105600632',               // Spröjs
    'antal-sprojs-per-bage': 'entry.1553251704', // Antal spröjs per båge
    'byte-till-le-glas': 'entry.1641252616',   // Byte till LE-glas
    'le-kvm': 'entry.1217325448',              // LE-glas kvm
    'fastighet-rot-berättigad': 'entry.1617253565', // Fastighet ROT-berättigad
    'är-du-berättigad-rot-avdrag': 'entry.234567890' // Kund ROT-berättigad - UPPDATERA MED KORREKT ENTRY ID
}
```

**⚠️ VIKTIGT**: Du måste uppdatera följande entry IDs med korrekta värden:
- `arbetsbeskrivning`: Ersätt `entry.987654321`
- `är-du-berättigad-rot-avdrag`: Ersätt `entry.234567890`

#### Hur får jag Google Forms entry IDs?

1. Öppna ditt Google Forms i redigeringsläge
2. Klicka på "Förhandsgranska" 
3. Öppna Developer Tools (F12)
4. Gå till Network tab
5. Fyll i och skicka formuläret
6. Leta efter POST-request till Google Forms
7. Kopiera entry-ID:n från request body

### 3. Konfigurera lösenordsskydd

Applikationen har inbyggt lösenordsskydd. Standardlösenordet är:
```javascript
PASSWORD_CONFIG = {
    CORRECT_PASSWORD: 'sternbecks2025'
};
```

**Rekommendation**: Byt till ditt eget säkra lösenord i `assets/js/app.js`.

### 4. Justera prissättning

Applikationen är redan konfigurerad med din prissättning, men du kan justera värdena i `assets/js/app.js`:

```javascript
const CONFIG = {
    HOURLY_RATE: 700,    // Pris per extra timme
    
    // Renoveringstyp-påslag (dropdown)
    RENOVATION_TYPE_MULTIPLIERS: {
        'Traditionell - Linoljebehandling': 1.15,  // +15%
        'Modern - Alcro bestå': 1.0                // Standardpris
    },
    
    // Fönstertyp-påslag
    WINDOW_TYPE_MULTIPLIERS: {
        'Kopplade standard': 1.0,                  // Standardpris
        'Isolerglas': 'per_window_400',            // +400kr per fönster
        'Insatsbågar': 'per_window_300',           // +300kr per fönster
        'Inåtgående': 0.95,                        // -5%
        'Utåtgående': 1.0                          // Standardpris
    },
    
    // Arbetsbeskrivning-påslag (radio buttons)
    WORK_DESCRIPTION_MULTIPLIERS: {
        'Utvändig renovering': 1.0,                // 100% av totalsumman
        'Invändig renovering': 1.25,               // +25%
        'Utvändig renovering samt målning av innerbågens insida': 1.05 // +5%
    },
    
    // Prissättning per enhet
    UNIT_PRICES: {
        'antal-dorrpartier': 6000,  // Dörrpartier: 6000kr/st
        'antal-1-luftare': 3500,    // 1 luftare: 3500kr/st
        'antal-2-luftare': 5000,    // 2 luftare: 5000kr/st
        'antal-3-luftare': 6500,    // 3 luftare: 6500kr/st
        'antal-4-luftare': 8000,    // 4 luftare: 8000kr/st
        'antal-5-luftare': 9000,    // 5 luftare: 9000kr/st
        'antal-6-luftare': 11000    // 6 luftare: 11000kr/st
    },
    
    // Tillägg
    EXTRAS: {
        SPROJS_PER_RUTA: 300,       // 300kr per ruta
        E_GLASS_PER_SQM: 2500,      // 2500kr/kvm
        VAT_RATE: 0.25,             // 25% moms
        ROT_DEDUCTION: 0.5          // 50% ROT-avdrag
    }
};
```

### 5. Anpassa företagsinformation

Uppdatera företagsnamn och andra detaljer i `index.html` om nödvändigt.

## 🚀 Deployment

### GitHub Pages (Rekommenderat)

1. **Skapa GitHub repository**
```bash
git init
git add .
git commit -m "Initial commit: Sternbecks anbudsapplikation"
git branch -M main
git remote add origin https://github.com/dittanvändarnamn/sternbecks-anbudsapp.git
git push -u origin main
```

2. **Aktivera GitHub Pages**
   - Gå till Settings i ditt GitHub repository
   - Scrolla ner till "Pages" sektionen  
   - Välj "Deploy from a branch"
   - Välj "main" branch och "/ (root)"
   - Klicka "Save"

3. **Din app kommer att vara tillgänglig på:**
```
https://dittanvändarnamn.github.io/sternbecks-anbudsapp/
```

### Alternativa deployment-alternativ

- **Netlify**: Dra och släpp `sternbecks-anbudsapp` mappen
- **Vercel**: Anslut GitHub repository
- **Egen webbserver**: Ladda upp alla filer till din webbserver

## 📁 Filstruktur

```
sternbecks-anbudsapp/
├── index.html              # Huvudfil med komplett formulär och prisvisning
├── README.md               # Denna fil (uppdaterad dokumentation)
├── assets/
│   ├── css/
│   │   └── styles.css      # Komplett styling inkl. prisvisning
│   ├── js/
│   │   └── app.js          # Avancerad prissättningslogik och validering
│   └── images/
│       └── Sternbecks logotyp.png  # Företagets logotyp
├── docs/                   # Dokumentation och konfigurationsfiler
│   ├── config-example.md   # Detaljerad konfigurationsguide
│   ├── ENTRY-ID-UPPDATERING.md     # Guide för Google Forms entry IDs
│   ├── TEST-RAPPORT.md     # Testrapporter och validering
│   ├── UI-TOMFALT-UPPDATERINGAR.md # UI-förbättringar och uppdateringar
│   ├── VARIABEL-LISTA-ZAPIER.md    # Zapier variabler och integration
│   └── ZAPIER-UPPDATERINGAR.md     # Zapier-uppdateringar och ändringar
└── tests/                  # Testfiler och testning
    ├── detailed-test.js    # Detaljerade JavaScript-tester
    ├── test-functionality.html     # HTML-funktionalitetstester
    └── test-sprojs-berakningar.html # Spröjs-beräkningstester
```

## ✨ Avancerade funktioner

### Automatisk prisberäkning
- **Realtidsuppdatering**: Priserna uppdateras automatiskt när användaren ändrar värden
- **Komponentbaserad**: Varje del av priset visas separat för transparens
- **ROT-optimering**: Automatisk beräkning och visning av ROT-avdrag när tillämpligt

### Intelligent formulärvalidering
- **Realtidsvalidering**: Felmeddelanden visas direkt vid felaktig inmatning
- **Kontextuell hjälp**: Hjälptexter visar prisinfo för varje alternativ
- **Responsiv design**: Fungerar perfekt på alla enheter

### Google Forms integration
- **Detaljerad prissammanfattning**: Komplett prisuppdelning skickas till Google Forms
- **Automatisk formatering**: Priserna formateras elegant för läsbarhet
- **Zapier-kompatibel**: Fungerar med befintliga automationer

### Tillgänglighetsfunktioner
- **Tangentbordsnavigation**: Komplett stöd för tangentbordsanvändare
- **Skärmläsaroptimerad**: ARIA-labels och semantisk HTML
- **Kontrastoptimerad**: Färger som uppfyller WCAG-riktlinjer

## 🔧 Anpassning

### Lägga till företagslogotyp

1. Lägg logotyp i `assets/images/`
2. Uppdatera `index.html` header-sektionen:
```html
<div class="logo-section">
    <img src="assets/images/logo.png" alt="Sternbecks Måleri & Fönsterhantverk" class="company-logo">
    <h1 class="company-name">Sternbecks Måleri & Fönsterhantverk</h1>
    <!-- ... -->
</div>
```

3. Lägg till CSS för logotypen i `styles.css`:
```css
.company-logo {
    max-height: 80px;
    margin-bottom: 1rem;
}
```

### Ändra färgschema

Uppdatera CSS custom properties i `styles.css`:
```css
:root {
    --primary-dark: #2c2c2c;    /* Din huvudfärg */
    --cream-beige: #d4c4a0;     /* Din accent färg */
    --gold-beige: #c8b896;      /* Din kompletterande färg */
}
```

## 🆕 Senaste uppdateringar (v2.0)

### Stora strukturella förändringar:

#### ✅ Omstrukturerade formulärkategorier
- **Typ av renovering**: Flyttad till egen dropdown (Traditionell +15%, Modern standard)
- **Arbetsbeskrivning**: Ny radio button-sektion för renoveringstyp
- **Typ av fönster**: Förenklad dropdown utan prisvisning

#### ✅ Förenklad användargränssnitt
- **Dold prisvisning**: Individuella priser visas inte längre för kunden
- **Fokuserad slutpris**: Endast "Totalt inkl. moms", "ROT-avdrag" och "KUNDEN BETALAR"
- **Detaljerad Google Forms-data**: Full prissammanfattning skickas fortfarande

#### ✅ Automatisering och förbättringar
- **Auto-fill fastighetsbeteckning**: Sätts automatiskt till "-" om tomt
- **Lösenordsskydd**: Säker åtkomst med `sternbecks2025`
- **Mörkt tema**: Toggle-knapp med localStorage
- **Auto-reset**: Formulär återställs efter submission
- **Förbättrad ROT-integration**: Separata fält för fastighet och kundberättigande

#### ✅ Uppdaterad prissättningslogik
1. Grundkomponenter (luftare + dörrar)
2. **Renoveringstyp-pålägg** (ny dropdown)
3. Fönstertyp-tillägg
4. Spröjs/E-glas
5. Extra timmar
6. **Materialkostnad** (procentbaserad)
7. **Arbetsbeskrivning-pålägg** (nya radio buttons)
8. Moms och ROT-avdrag

### Tekniska förbättringar:
- Separata beräkningsfunktioner för renoveringstyp och arbetsbeskrivning
- Förbättrad validering för nya formulärfält
- Optimerad prissammanfattning för Google Forms
- Utökad fältmappning för alla nya kategorier

## 📱 Browser-stöd

Applikationen stödjer alla moderna webbläsare:
- Chrome (senaste 2 versionerna)
- Firefox (senaste 2 versionerna)
- Safari (senaste 2 versionerna)
- Edge (senaste 2 versionerna)

## 🐛 Felsökning

### Google Forms skickar inte data

1. Kontrollera att `GOOGLE_FORMS_URL` är korrekt
2. Verifiera att alla `entry.` IDs matchar ditt formulär
3. Testa att skicka data direkt till Google Forms först

### Prisberäkning fungerar inte

1. Kontrollera att alla CONFIG-objekt är korrekt konfigurerade:
   - `RENOVATION_TYPE_MULTIPLIERS`
   - `WINDOW_TYPE_MULTIPLIERS` 
   - `WORK_DESCRIPTION_MULTIPLIERS`
   - `UNIT_PRICES`
2. Kontrollera browser console för JavaScript-fel
3. Verifiera att alla nya fält har rätt namn och ID:n

### ROT-avdrag visas inte korrekt

1. Kontrollera att båda ROT radio button-grupper har unika entry IDs
2. Verifiera att `är-du-berättigad-rot-avdrag` har korrekt entry ID
3. Kontrollera att ROT-logiken använder rätt fältnamn

### Styling ser fel ut

1. Kontrollera att `styles.css` laddas korrekt
2. Rensa browser cache
3. Kontrollera att Google Fonts laddas

## 📞 Support

För teknisk support eller frågor om applikationen, kontakta utvecklaren eller konsultera denna dokumentation.

## 🚀 Framtida förbättringar

### Klara funktioner ✅ (v2.0)
- [x] **Omstrukturerad formulärdesign** - Tydliga kategorier med dropdown och radio buttons
- [x] **Förenklad prisvisning** - Fokuserad på slutpris för bättre användarupplevelse
- [x] **Auto-fill funktioner** - Automatisk ifyllning av fastighetsbeteckning
- [x] **Lösenordsskydd** - Säker åtkomst till anbudsformulär
- [x] **Mörkt tema** - Toggle med localStorage persistence
- [x] **Komplett prissättningslogik** - Avancerad prisberäkning med separata kategorier
- [x] **Förbättrad ROT-avdrag integration** - Separata fält för fastighet och kund
- [x] **Detaljerad Google Forms-data** - Full prissammanfattning trots förenklad visning
- [x] **Auto-reset funktionalitet** - Formulär återställs efter submission
- [x] **Responsiv design** - Fungerar perfekt på alla enheter
- [x] **Omfattande validering** - Realtidsvalidering för alla fälttyper

### Potentiella framtida tillägg
- [ ] **PDF-generering** - Generera PDF-anbud direkt från applikationen
- [ ] **CRM-integration** - Anslut till befintliga kundhanteringssystem
- [ ] **Admin-panel** - Webbgränssnitt för att ändra priser utan kodändringar
- [ ] **Prishistorik** - Spåra prisförändringar över tid
- [ ] **Analytics dashboard** - Detaljerad statistik över förfrågningar
- [ ] **E-postsignering** - Digitala signaturer för anbud
- [ ] **Kalenderbookning** - Integrera möjlighet att boka besiktning
- [ ] **Multilingual support** - Stöd för flera språk

---

**Sternbecks Måleri & Fönsterhantverk**  
*Kvalitet och hantverkstradition sedan 2015*