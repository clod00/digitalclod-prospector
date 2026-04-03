# DigitalClod Prospector

Sistema di prospecting B2B per trovare e analizzare aziende italiane da contattare.

## Setup veloce

### 1. Supabase
Apri il SQL editor su [supabase.com](https://supabase.com) → progetto `augmjtoanpbvbnzliias` ed esegui `supabase/schema.sql`.

### 2. Backend
```bash
cd backend
cp .env.example .env
# Compila le env vars nel file .env
npm install
npm run dev
```

### 3. Frontend
```bash
cd frontend
cp .env.example .env
# VITE_API_URL=http://localhost:3002
npm install
npm run dev
# → http://localhost:5174
```

## Deploy

### Backend → Railway
```bash
# Prima volta: collega repo su railway.app
# Poi: autodeploy su push a main
git push origin main
```
Aggiungi env vars nel pannello Railway.

### Frontend → Vercel
```bash
cd frontend
npx vercel --prod
```
Aggiungi `VITE_API_URL=https://tuo-backend.railway.app` in Vercel → Settings → Environment Variables.

## Flusso di utilizzo

1. **Importa** → `/import` → carica Excel con le aziende
2. **Seleziona** leads in dashboard → **Arricchisci** (bulk enrichment)
3. **Filtra** per tier Hot 🟢 → leads con più opportunità
4. **Clicca** un lead → **Genera AI** → copia email/WA hook
5. **Aggiorna stato** (contattato → risposto → cliente)
6. **Esporta** per ActiveCampaign o mailing postale

## Env vars necessarie

| Var | Dove ottenerla |
|-----|----------------|
| `SUPABASE_URL` | Supabase → Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → service_role |
| `PAGESPEED_API_KEY` | Google Cloud Console → PageSpeed Insights API |
| `APIFY_API_KEY` | apify.com → Settings → Integrations |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
