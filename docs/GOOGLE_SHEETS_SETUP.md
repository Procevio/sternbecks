# Google Sheets Integration Setup

Denna guide visar hur du kopplar Sternbecks anbudsapp till Google Sheets för prishantering via adminpanelen.

## Steg 1: Skapa Google Sheets

1. Gå till [Google Sheets](https://sheets.google.com)
2. Skapa ett nytt kalkylblad
3. Ge det namnet "Sternbecks Anbudsapp Priser"
4. Kopiera spreadsheet ID från URL:en (den långa strängen i mitten)
   - Exempel: `https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit`

## Steg 2: Skapa Google Apps Script

1. I ditt Google Sheets, gå till **Extensions** > **Apps Script**
2. Ta bort standardkoden och klistra in innehållet från `google-apps-script-example.js`
3. Uppdatera konfigurationsvariabler:
   ```javascript
   const API_TOKEN = "DIN_SÄKRA_TOKEN_HÄR"; // Välj ett starkt lösenord
   const SPREADSHEET_ID = "DIN_SPREADSHEET_ID_HÄR";
   ```

## Steg 3: Publicera som Web App

1. I Apps Script-editorn, klicka på **Deploy** > **New deployment**
2. Välj typ: **Web app**
3. Konfiguration:
   - **Description**: "Sternbecks Prishantering API"
   - **Execute as**: Me
   - **Who has access**: Anyone
4. Klicka **Deploy**
5. Kopiera **Web app URL**

## Steg 4: Uppdatera Anbudsappen

1. Öppna `assets/js/app.js`
2. Hitta AdminPanel klassen (rad ~3658)
3. Uppdatera konfigurationen:
   ```javascript
   this.PRICING_API_URL = "DIN_WEB_APP_URL_HÄR";
   this.API_TOKEN = "SAMMA_TOKEN_SOM_I_APPS_SCRIPT";
   ```

## Steg 5: Testa Integrationen

1. Öppna anbudsappen i webbläsaren
2. Logga in med lösenordet
3. Klicka på kugghjulsikonen (Admin) i navigationsbaren
4. Klicka på "Fyll från nuvarande" för att ladda befintliga priser
5. Ändra några priser och klicka "Spara till Google Sheets"
6. Kontrollera att priserna sparats i ditt Google Sheets

## Säkerhetsrekommendationer

### API Token
- Använd ett starkt, unikt lösenord som API_TOKEN
- Dela aldrig denna token offentligt
- Överväg att rotera token regelbundet

### Åtkomstbehörigheter
- Håll Google Sheets-dokumentet privat
- Dela endast med personer som ska kunna redigera priser
- Överväg att använda Google Workspace för bättre åtkomstkontroll

### Backup
- Skapa regelbundna säkerhetskopior av prisdatan
- Använd Google Sheets versionshistorik för att spåra ändringar
- Överväg att exportera data till andra format som backup

## Felsökning

### Vanliga Problem

**"Ogiltig säkerhetstoken"**
- Kontrollera att API_TOKEN är identisk i både app.js och Apps Script
- Se till att token inte innehåller extra mellanslag

**"Kunde inte komma åt Google Sheets"**
- Verifiera att SPREADSHEET_ID är korrekt
- Kontrollera att Apps Script har behörighet att komma åt Sheets
- Se till att Google Sheets-dokumentet inte är raderat

**"CORS-fel"**
- Kontrollera att Web App är publicerad med "Who has access: Anyone"
- Se till att du använder den senaste deployment URL:en

### Debug-tips

1. **Apps Script Logger**: Använd `Logger.log()` för att se vad som händer
2. **Browser Console**: Kontrollera nätverkstrafik i Developer Tools
3. **Test Function**: Kör `testSetup()` i Apps Script för att verifiera konfiguration

## Avancerade Funktioner

### Automatisk Backup
Lägg till denna funktion i Apps Script för dagliga backups:

```javascript
function createDailyBackup() {
  const sheet = getOrCreateSheet();
  const backupName = `Backup_${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')}`;
  sheet.copyTo(SpreadsheetApp.openById(SPREADSHEET_ID)).setName(backupName);
}
```

Sätt upp en trigger för att köra denna dagligen.

### Ändringsnotifikationer
För att få e-postnotifikationer vid prisändringar:

```javascript
function sendChangeNotification(pricing) {
  const email = "admin@sternbecks.se";
  const subject = "Prisändring i anbudsapp";
  const body = `Priser uppdaterade:\n${JSON.stringify(pricing, null, 2)}`;
  GmailApp.sendEmail(email, subject, body);
}
```

## Support

Vid problem med Google Sheets-integrationen:
1. Kontrollera att alla steg följts korrekt
2. Verifiera behörigheter och URL:er
3. Använd browser developer tools för att debugga
4. Kontakta systemadministratör om problemet kvarstår

## Versionshantering

Adminpanelen hanterar versionshantering automatiskt:
- Varje prisuppdatering ökar versionsnumret
- Ändringar loggas med tidsstämpel
- Tidigare versioner kan återställas från Google Sheets versionshistorik