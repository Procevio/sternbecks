# Konfigurationsguide för Google Forms Integration

## Steg-för-steg guide för att konfigurera din anbudsapplikation

### 1. Förbered ditt Google Forms

1. **Skapa ett nytt Google Forms** eller använd ditt befintliga
2. **Se till att alla dessa fält finns** (exakt samma namn):
   - Företag/Namn (kundnamn)
   - Kontaktperson  
   - E-post
   - Telefonnummer
   - Adress
   - Postnummer
   - Ort
   - Fastighetsbesiktning (checkbox)
   - Typ av renovering (multiple choice)
   - Typ av fönster (multiple choice)
   - Arbetsbeskrivning (textarea)
   - Arbetsbeskrivning övrigt / Extra timmar (number)
   - Materialkostnad (number)
   - Antal fönsterpartier (number)
   - Antal dörrpartier (number)
   - Antal 1 luftare (number)
   - Antal 2 luftare (number) 
   - Antal 3 luftare (number)
   - Antal 4 luftare (number)
   - Antal 5 luftare (number)
   - Antal 6 luftare (number)
   - Spröjs (checkbox)
   - Antal spröjs per båge (number)
   - Byte till LE-glas (checkbox)
   - LE-glas kvm (number with decimals)
   - ROT-avdrag berättigad (checkbox)

### 2. Hämta Google Forms URL och Entry IDs

#### Metod 1: Inspektera HTML-koden
1. Öppna ditt Google Forms
2. Klicka "Förhandsgranska" (ögon-ikonen)
3. Högerklicka och välj "Visa sidans källkod"
4. Sök efter "entry." för att hitta alla entry IDs
5. Kopiera Forms URL från adressfältet

#### Metod 2: Använd Developer Tools
1. Öppna ditt Google Forms i förhandsgranskningsläge
2. Öppna Developer Tools (F12)
3. Gå till Network tab
4. Fyll i formuläret och skicka det
5. Leta efter POST-request till `formResponse`
6. I request body hittar du alla entry IDs

### 3. Uppdatera konfiguration

Öppna `assets/js/app.js` och uppdatera:

```javascript
const CONFIG = {
    BASE_PRICE: 5000, // ÄNDRA TILL DITT GRUNDPRIS
    HOURLY_RATE: 700, // BEKRÄFTA ATT DETTA ÄR KORREKT
    GOOGLE_FORMS_URL: 'https://docs.google.com/forms/d/e/1FAIpQLSeWgToYq-djzYjwlx51cg6NG8hk9hhK2ryusZCJxE3FSMeDlw/formResponse',
    FORM_FIELDS: {
        // UPPDATERADE MED RIKTIGA ENTRY IDs FRÅN DITT GOOGLE FORMS
        'company': 'entry.840064910',           // Kundnamn
        'contact-person': 'entry.840064910',    // Kontaktperson (samma som kundnamn)
        'email': 'entry.34850442',             // E-post
        'phone': 'entry.1576794399',           // Telefonnummer
        'address': 'entry.451691303',          // Adress
        'postal-code': 'entry.183003918',      // Postnummer
        'city': 'entry.1773944220',            // Ort
        'property-inspection': 'entry.1947831774', // Fastighetsbeteckning
        'typ-av-renovering': 'entry.1001679891',   // Typ av renovering
        'typ-av-fonster': 'entry.1431165045',      // Typ av fönster
        'arbetsbeskrivning': 'entry.375552021',    // Arbetsbeskrivning
        'extra-hours': 'entry.280137558',          // Extra timmar
        'materialkostnad': 'entry.1087712385',     // Materialkostnad
        'window-sections': 'entry.1428207307',     // Fönsterpartier
        'antal-dorrpartier': 'entry.15247411',     // Dörrpartier
        'antal-1-luftare': 'entry.1346898155',     // 1 luftare
        'antal-2-luftare': 'entry.994599656',      // 2 luftare
        'antal-3-luftare': 'entry.882686399',      // 3 luftare
        'antal-4-luftare': 'entry.421567894',      // 4 luftare
        'antal-5-luftare': 'entry.15154510',       // 5 luftare
        'antal-6-luftare': 'entry.904743569',      // 6 luftare
        'sprojs': 'entry.105600632',               // Spröjs
        'antal-sprojs-per-bage': 'entry.1553251704', // Antal spröjs per båge
        'byte-till-le-glas': 'entry.1641252616',   // Byte till LE-glas
        'le-kvm': 'entry.1217325448',              // LE-glas kvm
        'rot-avdrag': 'entry.1617253565'           // ROT-avdrag
    }
};
```

### 4. Exempel på korrekt Google Forms URL

Din URL ska se ut så här:
```
https://docs.google.com/forms/d/e/1FAIpQLSdABC123XYZ789_DITT_RIKTIGA_FORM_ID/formResponse
```

**Viktigt:** URL:en ska sluta med `/formResponse`, inte `/viewform`

### 5. Testa konfigurationen

1. Öppna din applikation i webbläsaren
2. Fyll i alla obligatoriska fält
3. Skicka formuläret
4. Kontrollera att data kommer fram i ditt Google Forms/Google Sheets

### 6. Felsökning

**Problem: Data kommer inte fram i Google Forms**
- Kontrollera att URL:en slutar med `/formResponse`
- Verifiera att alla entry IDs är korrekta
- Se till att fältnamnen matchar exakt

**Problem: Vissa fält saknas**
- Kontrollera att alla fält finns i ditt Google Forms
- Se till att entry IDs matchar rätt fält

**Problem: Checkbox/radio buttons fungerar inte**
- För checkbox: applikationen skickar "Ja" eller "Nej"
- För radio buttons: se till att alternativen matchar exakt

### 7. Zapier Integration (om du använder det)

Om du har Zapier-automation kopplad till ditt Google Forms kommer den att fortsätta fungera automatiskt när data skickas via denna applikation.

---

**Tips:** Spara alltid en kopia av dina entry IDs på säker plats för framtida referens!