/**
 * emailFinder.js
 * Cascata economica per trovare email di lead B2B italiani:
 *   1. Scraping homepage (gratis)
 *   2. Scraping /contatti + altre pagine (gratis)
 *   3. Pattern guess: info@dominio.it (gratis)
 *   4. Domain guessing dal nome azienda — solo per lead senza sito (gratis)
 *   5. Google via Apify — per lead rimasti senza email (~$0.003/query)
 */

const { checkWebsite, checkContactPage } = require('./websiteCheck');

// ── Filtro food ────────────────────────────────────────────────────────────────

const FOOD_KEYWORDS = [
  'pizzeria', 'ristorante', 'trattoria', 'osteria', 'taverna', 'birreria',
  'gelateria', 'pasticceria', 'sushi', 'kebab', 'rosticceria', 'hamburgeria',
  'paninoteca', 'braceria', 'panineria', 'friggitoria', 'focacceria',
  'panificio', 'gastronomia', 'enoteca', 'vineria',
];

const FOOD_SETTORI = [
  'ristorazione', 'food', 'ristorante', 'pizzeria', 'panetteria',
  'bar e ristorazione', 'alimentare',
];

function isFood(lead) {
  const name = (lead.ragione_sociale || '').toLowerCase();
  const settore = (lead.settore || '').toLowerCase();

  if (FOOD_SETTORI.some(s => settore.includes(s))) return true;

  for (const kw of FOOD_KEYWORDS) {
    const idx = name.indexOf(kw);
    if (idx === -1) continue;
    const before = idx === 0 || /[\s\-_\/,.(]/.test(name[idx - 1]);
    const after = idx + kw.length >= name.length || /[\s\-_\/,.)&]/.test(name[idx + kw.length]);
    if (before && after) return true;
  }

  return false;
}

// ── Utility ────────────────────────────────────────────────────────────────────

function extractDomain(siteUrl) {
  try {
    const u = siteUrl.startsWith('http') ? siteUrl : 'https://' + siteUrl;
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function extractEmailsFromText(text) {
  if (!text) return [];
  const emailRegex = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;
  const SKIP = ['example.', 'noreply@', 'no-reply@', '@sentry', '@w3.org', '@schema.org', '.png', '.jpg', 'pixel'];
  return [...new Set(text.match(emailRegex) || [])].filter(
    e => !SKIP.some(s => e.toLowerCase().includes(s))
  );
}

// ── Domain guessing dal nome azienda ──────────────────────────────────────────

const LEGAL_RE = /\b(s\.?r\.?l\.?s?|s\.?p\.?a\.?|s\.?a\.?s\.?|s\.?n\.?c\.?|studio|dott\.?|avv\.?|ing\.?|arch\.?|geom\.?|di|del|della|dello|degli|e|&)\b/gi;

function guessDomainsFromName(ragioneSociale) {
  if (!ragioneSociale) return [];

  const cleaned = ragioneSociale
    .toLowerCase()
    // Remove accents (normalize NFD then strip combining marks)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(LEGAL_RE, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ').filter(w => w.length >= 3);
  if (!words.length) return [];

  const candidates = [];
  const seen = new Set();
  const add = (d) => { if (!seen.has(d)) { seen.add(d); candidates.push(d); } };

  // All words joined (es. "officinerossi.it")
  if (words.length >= 2) add(words.join('') + '.it');
  // First word only (es. "officine.it")
  add(words[0] + '.it');
  // First two words joined (es. "officinerossi.it" — già coperto sopra se 2 words)
  if (words.length >= 2) add(words[0] + words[1] + '.it');
  // First two words with hyphen (es. "officine-rossi.it")
  if (words.length >= 2) add(words[0] + '-' + words[1] + '.it');
  // .com variant
  add(words.join('') + '.com');

  return candidates.slice(0, 5);
}

// Tenta di trovare email per lead SENZA sito_web, tramite domain guessing
async function findEmailNoSite(lead) {
  const domains = guessDomainsFromName(lead.ragione_sociale);

  for (const domain of domains) {
    try {
      const siteData = await checkWebsite('https://' + domain);
      if (!siteData.exists) continue;

      // Sito trovato! Cerca email
      if (siteData.emailsFound?.length > 0) {
        return { email: siteData.emailsFound[0], source: 'sito_guessed', foundDomain: domain };
      }

      const contactEmails = await checkContactPage('https://' + domain);
      if (contactEmails.length > 0) {
        return { email: contactEmails[0], source: 'contatti_guessed', foundDomain: domain };
      }

      // Pattern fallback sul dominio trovato
      return { email: `info@${domain}`, source: 'pattern_guessed', foundDomain: domain };
    } catch (_) {}
  }

  return null; // Cade in Phase 2 Google
}

// ── Step 1–3: metodi gratuiti (con sito noto) ─────────────────────────────────

async function findEmailCheap(lead) {
  // Senza sito → prova domain guessing prima
  if (!lead.sito_web) return findEmailNoSite(lead);

  // 1. Scraping homepage
  try {
    const siteData = await checkWebsite(lead.sito_web);
    if (siteData.emailsFound?.length > 0) {
      return { email: siteData.emailsFound[0], source: 'sito' };
    }
  } catch (_) {}

  // 2. Scraping pagina contatti (+ più percorsi)
  try {
    const contactEmails = await checkContactPage(lead.sito_web);
    if (contactEmails.length > 0) {
      return { email: contactEmails[0], source: 'contatti' };
    }
  } catch (_) {}

  // 3. Pattern guess: info@dominio.it
  const domain = extractDomain(lead.sito_web);
  if (domain) {
    return { email: `info@${domain}`, source: 'pattern' };
  }

  return null;
}

// ── Step 4: Google via Apify — query per trovare email in snippet ─────────────

function buildGoogleEmailQuery(lead) {
  const city = lead.citta ? ` ${lead.citta}` : '';
  return `"${lead.ragione_sociale}"${city} email contatti`;
}

// Query separata per trovare il sito dell'azienda via Google
function buildGoogleSiteQuery(lead) {
  const city = lead.citta ? ` ${lead.citta}` : '';
  return `${lead.ragione_sociale}${city}`;
}

function parseEmailFromGoogleResults(items) {
  for (const item of items) {
    const text = `${item.snippet || ''} ${item.title || ''}`;
    const emails = extractEmailsFromText(text);
    if (emails.length > 0) return emails[0];
  }
  return null;
}

module.exports = {
  isFood,
  findEmailCheap,
  findEmailNoSite,
  buildGoogleEmailQuery,
  buildGoogleSiteQuery,
  parseEmailFromGoogleResults,
  guessDomainsFromName,
};
