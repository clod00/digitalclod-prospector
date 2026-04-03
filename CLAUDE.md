# DigitalClod Prospector

B2B prospecting tool per DigitalClod — trova aziende italiane da contattare, le analizza e genera outreach personalizzato con AI.

## Stack

- **Frontend**: React + Vite + Tailwind CSS → `frontend/` → Vercel
- **Backend**: Node.js + Express → `backend/` → Railway
- **DB**: Supabase (PostgreSQL) — tabella `prospect_leads`
- **AI**: Claude claude-sonnet-4-6 via Anthropic SDK
- **Scraping**: Apify (Google Maps actor `nwua9Gu5YrADL7ZDj`)

## Comandi

```bash
# Frontend dev
cd frontend && npm run dev      # porta 5174

# Backend dev
cd backend && npm run dev       # porta 3002

# Deploy frontend
cd frontend && npx vercel --prod

# Deploy backend
git push  # Railway autodeploy da main
```

## Variabili d'ambiente

### Backend (.env)
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`
- `PAGESPEED_API_KEY` — Google PageSpeed Insights
- `APIFY_API_KEY` — la tua chiave Apify (Settings → Integrations su apify.com)
- `ANTHROPIC_API_KEY`
- `FRONTEND_URL` — URL Vercel per CORS

### Frontend (.env)
- `VITE_API_URL` — URL Railway backend

## Supabase

**Tabella**: `prospect_leads` — SQL in `supabase/schema.sql`

## Architettura enrichment

Ogni lead passa per questa pipeline (in ordine):
1. **Website check** — `services/websiteCheck.js` — fetch sito, estrai email, social, pixel
2. **PageSpeed** — `services/pagespeed.js` — Google API
3. **Google Maps** — `services/apify.js` — Apify actor
4. **Instagram follower** — `services/apify.js`
5. **FB Ads check** — `services/facebookAds.js`
6. **Scoring** — `services/scoring.js` — score 0-20, tier Hot/Warm/Cold
7. **AI output** — `services/aiOutput.js` — Claude genera email + WA hook + idee

## Design system

- bg: `#080C14` | surface: `#0F1829` | accent: `#3B82F6` | amber: `#F59E0B`
- Font: DM Sans
