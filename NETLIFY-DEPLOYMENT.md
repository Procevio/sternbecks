# 🚀 Netlify Deployment Guide - Sternbecks Anbudsapp

## 📁 Projektstruktur

```
sternbecks-anbudsapp/
├── index.html                    # Huvudfil
├── assets/
│   ├── css/styles.css           # Stilar
│   └── js/app.js                # Frontend JavaScript
├── netlify/
│   └── functions/
│       └── submit.js            # ✨ NY: Serverless function
├── docs/                        # Dokumentation
└── NETLIFY-DEPLOYMENT.md        # Denna fil
```

## ⚙️ Netlify Konfiguration

### 1. Environment Variable
I Netlify Dashboard → Site Settings → Environment Variables:

```
ZAPIER_WEBHOOK_URL = "https://hooks.zapier.com/hooks/catch/24181254/ut0dun8/"
```

**⚠️ VIKTIGT:** Lägg ALDRIG till webhook URL:en direkt i koden - använd alltid miljövariabel för säkerhet.

### 2. Build Settings
- **Build command:** (lämna tom)
- **Publish directory:** `/` (root)
- **Functions directory:** `netlify/functions` (auto-detekteras)

## 🔌 Frontend Integration

### Bekräftat: Fetch URL för frontend
```javascript
// I assets/js/app.js - använd denna URL:
const response = await fetch('/.netlify/functions/submit', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(anbudsData)
});
```

## 📊 Funktionalitet

### `netlify/functions/submit.js` hanterar:
- ✅ POST-requests från frontend formulär
- ✅ CORS (Cross-Origin Resource Sharing)
- ✅ Miljövariabel `ZAPIER_WEBHOOK_URL`
- ✅ Datavalidering och fel-hantering
- ✅ Vidarebefordran till Zapier webhook
- ✅ Detaljerad konsol-loggning
- ✅ Timestamp och metadata

### Request/Response exempel:

**Frontend skickar:**
```javascript
{
    kundNamn: "Testkundnamn",
    adress: "Testadress 123",
    telefon: "070-123456",
    // ... övrig anbudsdata
}
```

**Function svarar:**
```javascript
{
    success: true,
    message: "Anbudsdata skickad till Zapier",
    anbudsNummer: "SB-1234567890",
    timestamp: "2025-01-01T12:00:00.000Z",
    zapierStatus: 200
}
```

## 🚦 Deployment Steps

1. **Pusha koden till Git repository**
2. **Koppla Netlify till ditt repository**
3. **Sätt environment variable `ZAPIER_WEBHOOK_URL`**
4. **Deploy** → Functions skapas automatiskt
5. **Testa** formuläret på din live-site

## 🔍 Testing & Debugging

### Lokal utveckling:
```bash
npm install -g netlify-cli
netlify dev
# Kör på http://localhost:8888
```

### Kontrollera functions:
- Netlify Dashboard → Functions tab
- Se loggar för `submit` function
- Testa med curl:

```bash
curl -X POST https://YOUR_SITE.netlify.app/.netlify/functions/submit \
  -H "Content-Type: application/json" \
  -d '{"kundNamn": "Test Kund", "totaltInklMoms": 50000}'
```

### Test med riktig webhook:
När miljövariabeln `ZAPIER_WEBHOOK_URL` är korrekt inställd i Netlify:
```
https://hooks.zapier.com/hooks/catch/24181254/ut0dun8/
```

## 🔒 Säkerhet

- ✅ Webhook URL dold som miljövariabel
- ✅ CORS konfigurerat korrekt  
- ✅ Input validering
- ✅ Fel-hantering utan dataläckage
- ✅ Rate limiting (Netlify default)

## ✅ Checklist för Go-Live

- [ ] Git repository uppdat med ny kod
- [ ] Netlify kopplad till repository
- [ ] `ZAPIER_WEBHOOK_URL` environment variable satt
- [ ] Deployment lyckad (functions syns i dashboard)
- [ ] Testformulär skickat och mottaget i Zapier
- [ ] Frontend uppdaterad med rätt fetch URL

---

**📧 Support:** Om något inte fungerar, kontrollera Netlify Functions logs först.

**🎯 Frontend URL:** `/.netlify/functions/submit` (bekräftat)