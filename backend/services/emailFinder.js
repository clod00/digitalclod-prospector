/**
 * emailFinder.js
 * Cascata economica per trovare email di lead B2B italiani:
 *   1. Scraping homepage (gratis)
 *   2. Scraping /contatti (gratis)
 *   3. Pattern guess: info@dominio.it (gratis)
 *   4. Google via Apify — solo per lead SENZA sito web (~$0.003/query)
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

  // Word-boundary check per evitare falsi positivi (es. "Scarpe Bar" = falso)
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

// ── Step 1–3: metodi gratuiti ──────────────────────────────────────────────────

async function findEmailCheap(lead) {
  if (!lead.sito_web) return null;

  // 1. Scraping homepage
  try {
    const siteData = await checkWebsite(lead.sito_web);
    if (siteData.emailsFound?.length > 0) {
      return { email: siteData.emailsFound[0], source: 'sito' };
    }
  } catch (_) {}

  // 2. Scraping pagina contatti
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

// ── Step 4: Google via Apify (solo lead senza sito) ───────────────────────────

function buildGoogleEmailQuery(lead) {
  const city = lead.citta ? ` ${lead.citta}` : '';
  return `"${lead.ragione_sociale}"${city} email contatti`;
}

function parseEmailFromGoogleResults(items) {
  for (const item of items) {
    const text = `${item.snippet || ''} ${item.title || ''}`;
    const emails = extractEmailsFromText(text);
    if (emails.length > 0) return emails[0];
  }
  return null;
}

module.exports = { isFood, findEmailCheap, buildGoogleEmailQuery, parseEmailFromGoogleResults };
