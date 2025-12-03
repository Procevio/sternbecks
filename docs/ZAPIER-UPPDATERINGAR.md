# 🔄 ZAPIER-INTEGRATION UPPDATERINGAR

**Datum:** 2025-08-21  
**Status:** ✅ IMPLEMENTERAT - Klar för Zapier-integration  

## 📋 SAMMANFATTNING AV ÄNDRINGAR

Din anbudsapp har uppdaterats för att stämma överens med din Zapier-automation enligt dina specifikationer.

## ✅ GENOMFÖRDA ÄNDRINGAR

### 1. 🗂️ **GOOGLE FORMS MAPPNING UTÖKAD**

**Nya entry-fält tillagda i `CONFIG.FORM_FIELDS`:**
```javascript
// Nya fält för specifika fönstertyper
'insatsbagaryttre': 'entry.XXXXXXX',        // ⚠️ UPPDATERA MED KORREKT ENTRY ID
'insatsbagarinre': 'entry.XXXXXXX',         // ⚠️ UPPDATERA MED KORREKT ENTRY ID  
'insatsbagarkomplett': 'entry.XXXXXXX',     // ⚠️ UPPDATERA MED KORREKT ENTRY ID
'kopplade_isolerglas': 'entry.XXXXXXX'      // ⚠️ UPPDATERA MED KORREKT ENTRY ID
```

**⚠️ VIKTIGT:** Du måste gå till din Google Forms och hämta de riktiga entry-ID:n för dessa nya fält!

### 2. 🪟 **FÖNSTERTYPER - CHECKBOXES UPPDATERADE**

**HTML-struktur (index.html):**
- ✅ Checkboxes fungerar för flera val samtidigt
- ✅ Uppdaterade alternativ med tydlig prissättning:

```html
☑️ Kopplade standard
☑️ Isolerglas (+400kr per fönster)
☑️ Kopplade isolerglas
☑️ Insatsbågar yttre
☑️ Insatsbågar inre  
☑️ Insatsbågar komplett
☑️ Inåtgående (-5%)
☑️ Utåtgående
```

### 3. 💰 **PRISSTRUKTUR UPPDATERAD**

**Nya priser (exkl. moms) i `CONFIG.UNIT_PRICES`:**
```javascript
UNIT_PRICES: {
    'antal_dorrpartier': 6000,  // Dörrpartier: 6000kr/st (exkl. moms) ✅
    'antal_1_luftare': 3500,    // 1 luftare: 3500kr/st (exkl. moms) ✅
    'antal_2_luftare': 5000,    // 2 luftare: 5000kr/st (exkl. moms) ✅
    'antal_3_luftare': 6500,    // 3 luftare: 6500kr/st (exkl. moms) ✅
    'antal_4_luftare': 8000,    // 4 luftare: 8000kr/st (exkl. moms) ✅
    'antal_5_luftare': 9000,    // 5 luftare: 9000kr/st (exkl. moms) ✅
    'antal_6_luftare': 11000    // 6 luftare: 11000kr/st (exkl. moms) ✅
}

EXTRAS: {
    SPROJS_PER_RUTA: 300,       // 300kr per ruta (exkl. moms) ✅
    E_GLASS_PER_SQM: 2500,      // 2500kr/kvm (exkl. moms) ✅
    ROT_DEDUCTION: 0.5          // 50% ROT-avdrag ✅
}
```

### 4. 🧮 **NY BERÄKNINGSORDNING IMPLEMENTERAD**

**Korrekt sekvens:**
1. ✅ **Total exkl. moms** → beräknas från alla komponenter
2. ✅ **Lägg på moms (25%)** → total inkl. moms  
3. ✅ **Dra av materialkostnad** FRÅN total inkl. moms
4. ✅ **ROT-avdrag (50%)** på resterande summa

**Formel:**
```
Slutpris = ((Total_exkl_moms × 1.25) - Materialkostnad) - (Resterande × 0.5)
```

### 5. 🎨 **UX-FÖRBÄTTRINGAR**

**Formularförbättringar:**
- ✅ **Ta bort 0-värden:** Standardvärden borttagna från antal-fält
- ✅ **Placeholders:** "Ange antal" tillagda överallt
- ✅ **Prisjustering:** "Ange tillägg i kr" / "Ange avdrag i kr"
- ✅ **Validering:** Hindrar formulär med bara 0:or/tomma fält

### 6. 📡 **FÖRBÄTTRAD GOOGLE FORMS INTEGRATION**

**Checkbox-hantering:**
```javascript
// Huvudfält: kommaseparerad sträng
"entry.1431165045": "Kopplade standard, Isolerglas, Kopplade isolerglas"

// Separata boolean-fält för Zapier:
"entry.XXXXXXX": "Ja"  // kopplade_isolerglas (om vald)
"entry.XXXXXXX": "Ja"  // insatsbagaryttre (om vald)  
"entry.XXXXXXX": "Ja"  // insatsbagarinre (om vald)
"entry.XXXXXXX": "Ja"  // insatsbagarkomplett (om vald)
```

## 🔧 TEKNISKA DETALJER

### **Filer som modifierats:**
1. **`assets/js/app.js`**
   - CONFIG.FORM_FIELDS utökad
   - UNIT_PRICES uppdaterad  
   - WINDOW_TYPE_MULTIPLIERS uppdaterad
   - Checkbox-hantering förbättrad
   
2. **`index.html`**
   - Fönstertyp-checkboxes uppdaterade
   - Prisjustering-fält förbättrade

### **Validering:**
```javascript
// Kräver minst ett antal > 0
const hasQuantityValues = quantityFields.some(fieldId => {
    const field = document.getElementById(fieldId);
    return field && parseInt(field.value) > 0;
});
```

## ⚠️ ÅTGÄRDER SOM KRÄVS FRÅN DIG

### 1. **UPPDATERA GOOGLE FORMS ENTRY-ID:N**

Du måste ersätta `entry.XXXXXXX` med riktiga entry-ID:n från din Google Forms:

```javascript
// I assets/js/app.js, rad ~85-88:
'insatsbagaryttre': 'entry.1234567890',     // ← Ersätt med riktigt ID
'insatsbagarinre': 'entry.2345678901',      // ← Ersätt med riktigt ID
'insatsbagarkomplett': 'entry.3456789012',  // ← Ersätt med riktigt ID
'kopplade_isolerglas': 'entry.4567890123'   // ← Ersätt med riktigt ID
```

**Hur får du entry-ID:n:**
1. Öppna din Google Forms
2. Gå till "Svar" → "Skapa kalkylblad"
3. Skapa nya frågor för de fyra nya fönstertyp-fälten
4. Inspektera HTML-koden för att hitta `entry.XXXXXXX`
5. Uppdatera JavaScript-koden med rätt ID:n

### 2. **TESTA INTEGRATIONEN**

**Testscenario:**
1. ✅ Välj flera fönstertyper (checkboxes)
2. ✅ Fyll i antal-fält utan 0-värden  
3. ✅ Kontrollera beräkningsordning
4. ✅ Verifiera att data skickas korrekt till Google Forms
5. ✅ Kontrollera Zapier-mottagning

## 📊 ZAPIER WEBHOOK PAYLOAD

**Förväntad data från Google Forms:**
```json
{
  // Standard formulärfält...
  "entry.1431165045": "Kopplade standard, Isolerglas, Kopplade isolerglas",
  
  // Nya specifika fönstertyp-fält:
  "entry.XXXXXXX": "Ja",  // kopplade_isolerglas (endast om vald)
  "entry.XXXXXXX": "Ja",  // insatsbagaryttre (endast om vald)
  "entry.XXXXXXX": "Ja",  // insatsbagarinre (endast om vald)  
  "entry.XXXXXXX": "Ja",  // insatsbagarkomplett (endast om vald)
  
  // Beräknad prissammanfattning...
  "entry.calculated_price": "DETALJERAD PRISBERÄKNING..."
}
```

## ✅ FÄRDIG CHECKLISTA

- [x] Google Forms mappning utökad
- [x] Checkboxes för fönstertyper implementerade  
- [x] Nya fönstertyp-alternativ tillagda
- [x] Prisstruktur uppdaterad (exkl. moms)
- [x] Ny beräkningsordning implementerad
- [x] UX förbättrad (placeholders, validering)
- [x] Google Forms integration förbättrad
- [ ] **Entry-ID:n från Google Forms** (DIN UPPGIFT)
- [ ] **Testa Zapier-integration** (DIN UPPGIFT)

## 🚀 NÄSTA STEG

1. **Hämta entry-ID:n** från din Google Forms
2. **Uppdatera JavaScript-koden** med riktiga ID:n  
3. **Testa formuläret** med olika kombinationer
4. **Verifiera Zapier-mottagning** av alla nya fält
5. **Dokumentera** eventuella ytterligare justeringar

**Din anbudsapp är nu tekniskt redo för Zapier-integration! 🎉**

---

## 📞 SUPPORT

Om du stöter på problem:
1. Kontrollera att alla entry-ID:n är korrekta
2. Testa formuläret i utvecklarverktygen (F12)
3. Verifiera att Google Forms tar emot data korrekt
4. Kontrollera Zapier webhook-loggar

**Lycka till med integrationen! 🚀**