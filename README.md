

En professionell webbapplikation för anbudsgenerering för. Applikationen ersätter Google Forms-formulär och integrerar med

## 🌟 Funktioner

- **Responsiv design** - Fungerar perfekt på både mobil och desktop
- **Avancerad prissättningslogik** - Komplett prisberäkning med komponenter, pålägg och avdrag
- **Realtidsberäkning** - Automatisk uppdatering av alla priskomponenter vid ändringar
- **Förenklad prisvisning** - Fokuserad visning av slutligt kundpris (dolda delpriser)
- **ROT-avdrag beräkning** - Automatisk beräkning av 50% ROT-avdrag på arbetskostnad
- **Google Forms Integration** - Automatisk inskickning med detaljerad prissammanfattning

## 🎨 Design

Applikationen använder företagets färgschema:
- **Mörk antracit** (#2c2c2c) - Huvudfärg
- **Krämbeige** (#d4c4a0) - Accent färg  
- **Guld/beige** (#c8b896) - Kompletterande färg

## 📋 Formulärfält


### 3. Förenklad prisvisning (synlig för kunden)
```
Totalt inkl. moms: XX,XXX kr
ROT-avdrag (50%): -X,XXX kr (om tillämpligt)
────────────────────────────────────
KUNDEN BETALAR: XX,XXX kr
```

### 4. Detaljerad prissammanfattning (skickas till Google Forms)
```

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
### Alternativa deployment-alternativ

- **Netlify**: Dra och släpp `sternbecks-anbudsapp` mappen
- **Vercel**: Anslut GitHub repository
- **Egen webbserver**: Ladda upp alla filer till din webbserver

## 📁 Filstruktur

```

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

##### Styling ser fel ut

1. Kontrollera att `styles.css` laddas korrekt
2. Rensa browser cache
3. Kontrollera att Google Fonts laddas

## 📞 Support

För teknisk support eller frågor om applikationen, kontakta utvecklaren eller konsultera denna dokumentation.

## 🚀 Framtida förbättringar

