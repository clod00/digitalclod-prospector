/**
 * Google Search via Apify (primary) o CSE (fallback)
 * Trova sito web, Instagram e Facebook di un'azienda
 */
const axios = require('axios');

const NON_COMPANY_DOMAINS = [
  'paginegialle', 'paginebianche', 'misterimprese', 'atoka', 'registroimprese', 'ufficiocamerale',
  'infocamere', 'cerved', 'agenziaentrate', 'europages', 'kompass', 'icribis',
  'linkedin', 'tripadvisor', 'yelp', 'booking', 'trustpilot', 'google.com',
  'maps.google', 'wikipedia', 'virgilio', 'corriere', 'sole24ore', 'repubblica',
  'subito.it', 'ebay', 'amazon', 'tuttocitta', 'chiamarapido', 'habitissimo',
  'infobel', 'pagine24', 'comuni-italiani', 'pagineinforma', 'facebook.com', 'instagram.com',
  'cylex-italia', 'impresaitalia', 'impresaitaliana', 'hotfrog', 'whereis',
];

function scoreSlug(slug, queryWords) {
  const s = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
  return queryWords.filter(w => s.includes(w.replace(/[^a-z0-9]/g, ''))).length;
}

function extractQueryWords(name) {
  return name.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= 3 && !/^(srl|spa|snc|sas|srls|di|del|la|il|le|lo|e|a|in|per|con|su|da|studio|dott|avv|ing|85|90|80|2000)$/i.test(w));
}

// ── Apify Google Search (primary) ──────────────────────────────────────────

async function apifySearch(queries) {
  const key = process.env.APIFY_API_KEY;
  if (!key) return null;

  const queryStr = Array.isArray(queries) ? queries.join('\n') : queries;

  try {
    const runRes = await axios.post(
      'https://api.apify.com/v2/acts/apify~google-search-scraper/runs',
      { queries: queryStr, maxPagesPerQuery: 1, resultsPerPage: 5, languageCode: 'it', countryCode: 'it' },
      { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    const runId = runRes.data?.data?.id;
    if (!runId) return null;

    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 4000));
      const statusRes = await axios.get('https://api.apify.com/v2/actor-runs/' + runId, {
        headers: { Authorization: 'Bearer ' + key }, timeout: 10000,
      });
      const status = statusRes.data?.data?.status;
      if (status === 'SUCCEEDED') {
        const dsId = statusRes.data?.data?.defaultDatasetId;
        const items = await axios.get('https://api.apify.com/v2/datasets/' + dsId + '/items', {
          headers: { Authorization: 'Bearer ' + key }, timeout: 10000,
        });
        // Return map: query term → organic results
        const resultMap = {};
        for (const item of items.data || []) {
          const term = item.searchQuery?.term || item.searchQuery?.query || '';
          resultMap[term] = item.organicResults || [];
        }
        return resultMap;
      }
      if (status === 'FAILED' || status === 'ABORTED') return null;
    }
    return null;
  } catch (err) {
    if (err.response?.data?.error?.type === 'monthly-usage-limit-exceeded') {
      throw new Error('Apify quota mensile esaurita — crea nuovo account su apify.com');
    }
    throw err;
  }
}

// ── Google CSE (fallback) ───────────────────────────────────────────────────

async function cseQuery(q) {
  const key = process.env.GOOGLE_CSE_KEY || process.env.PAGESPEED_API_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!key || !cx) return [];

  const { data } = await axios.get('https://www.googleapis.com/customsearch/v1', {
    params: { key, cx, q, num: 10, lr: 'lang_it', gl: 'it' },
    timeout: 10000,
  });
  return data.items || [];
}

// ── Main: searchCompany ─────────────────────────────────────────────────────

async function searchCompany(ragioneSociale, citta) {
  if (!process.env.APIFY_API_KEY && !process.env.GOOGLE_CSE_ID) return null;

  const queryWords = extractQueryWords(ragioneSociale);
  const base = citta ? `"${ragioneSociale}" ${citta}` : `"${ragioneSociale}"`;
  const result = { website_url: null, instagram_url: null, facebook_url: null };

  const igQuery = `${base} site:instagram.com`;
  const fbQuery = `${base} site:facebook.com`;
  const webQuery = `${ragioneSociale}${citta ? ' ' + citta : ''}`;

  // Try Apify first (batches all 3 queries in 1 run)
  if (process.env.APIFY_API_KEY) {
    try {
      const resultMap = await apifySearch([igQuery, fbQuery, webQuery]);
      if (resultMap) {
        // Instagram
        const igResults = resultMap[igQuery] || [];
        const igCandidates = [];
        for (const item of igResults) {
          const url = (item.link || item.url || '').toLowerCase();
          const m = url.match(/instagram\.com\/([a-z0-9_.]{2,40})/);
          if (m && !['p', 'reel', 'stories', 'explore', 'accounts', 'reels', 'tv'].includes(m[1])) {
            igCandidates.push({ url: `https://www.instagram.com/${m[1]}`, score: scoreSlug(m[1], queryWords) });
          }
        }
        igCandidates.sort((a, b) => b.score - a.score);
        if (igCandidates.length) result.instagram_url = igCandidates[0].url;

        // Facebook
        const fbResults = resultMap[fbQuery] || [];
        const fbCandidates = [];
        for (const item of fbResults) {
          const url = (item.link || item.url || '').toLowerCase();
          const m = url.match(/facebook\.com\/(?:p\/)?([a-z0-9.\-]{3,80})/);
          if (m && !['sharer', 'share', 'login', 'dialog', 'tr', 'plugins', 'groups', 'events', 'pages', 'photo', 'video', 'watch', 'profile.php', '100', 'pg'].includes(m[1])) {
            fbCandidates.push({ url: `https://www.facebook.com/${m[1]}`, score: scoreSlug(m[1], queryWords) });
          }
        }
        // Also accept /p/ pages (business pages)
        for (const item of fbResults) {
          const url = (item.link || item.url || '');
          if (url.includes('facebook.com/p/') && !fbCandidates.length) {
            fbCandidates.push({ url, score: 1 });
          }
        }
        fbCandidates.sort((a, b) => b.score - a.score);
        if (fbCandidates.length) result.facebook_url = fbCandidates[0].url;

        // Website
        const webResults = resultMap[webQuery] || [];
        const siteCandidates = [];
        for (const item of webResults) {
          const url = item.link || item.url || '';
          const urlLower = url.toLowerCase();
          const isNonCompany = NON_COMPANY_DOMAINS.some(d => urlLower.includes(d));
          if (!isNonCompany) {
            const domain = (url.match(/^https?:\/\/(?:www\.)?([^/]+)/)?.[1] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const domScore = queryWords.filter(w => domain.includes(w.replace(/[^a-z0-9]/g, ''))).length;
            if (domScore > 0) siteCandidates.push({ url, score: domScore });
          }
        }
        siteCandidates.sort((a, b) => b.score - a.score);
        if (siteCandidates.length) result.website_url = siteCandidates[0].url;

        return result;
      }
    } catch (err) {
      console.warn('  ⚠️  Apify search error:', err.message);
      // Fall through to CSE
    }
  }

  // Fallback: Google CSE
  if (process.env.GOOGLE_CSE_ID) {
    try {
      const igItems = await cseQuery(igQuery);
      const igCandidates = [];
      for (const item of igItems) {
        const url = (item.link || '').toLowerCase();
        const m = url.match(/instagram\.com\/([a-z0-9_.]{2,40})/);
        if (m && !['p', 'reel', 'stories', 'explore', 'accounts', 'reels', 'tv'].includes(m[1])) {
          igCandidates.push({ url: `https://www.instagram.com/${m[1]}`, score: scoreSlug(m[1], queryWords) });
        }
      }
      igCandidates.sort((a, b) => b.score - a.score);
      if (igCandidates.length) result.instagram_url = igCandidates[0].url;

      await new Promise(r => setTimeout(r, 200));

      const fbItems = await cseQuery(fbQuery);
      const fbCandidates = [];
      for (const item of fbItems) {
        const url = (item.link || '').toLowerCase();
        const m = url.match(/facebook\.com\/([a-z0-9.\-]{3,80})/);
        if (m && !['sharer', 'share', 'login', 'dialog', 'tr', 'plugins', 'groups', 'events', 'pages', 'photo', 'video'].includes(m[1])) {
          fbCandidates.push({ url: `https://www.facebook.com/${m[1]}`, score: scoreSlug(m[1], queryWords) });
        }
      }
      fbCandidates.sort((a, b) => b.score - a.score);
      if (fbCandidates.length) result.facebook_url = fbCandidates[0].url;

      await new Promise(r => setTimeout(r, 200));

      const webItems = await cseQuery(webQuery);
      const siteCandidates = [];
      for (const item of webItems) {
        const url = item.link || '';
        const urlLower = url.toLowerCase();
        const isNonCompany = NON_COMPANY_DOMAINS.some(d => urlLower.includes(d));
        if (!isNonCompany) {
          const domain = (url.match(/^https?:\/\/(?:www\.)?([^/]+)/)?.[1] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const domScore = queryWords.filter(w => domain.includes(w.replace(/[^a-z0-9]/g, ''))).length;
          if (domScore > 0) siteCandidates.push({ url, score: domScore });
        }
      }
      siteCandidates.sort((a, b) => b.score - a.score);
      if (siteCandidates.length) result.website_url = siteCandidates[0].url;

    } catch (err) {
      const status = err.response?.status;
      const errMsg = err.response?.data?.error?.message || '';
      if (status === 429 || err.response?.data?.error?.code === 429) {
        throw new Error('Google CSE quota esaurita (100/giorno)');
      }
      if (status === 403) {
        throw new Error(`CSE API key non autorizzata — aggiungi "Custom Search JSON API" nelle credenziali. Dettaglio: ${errMsg}`);
      }
      if (err.response?.data?.error?.code) console.warn('CSE error:', err.response.data.error.code, errMsg);
    }
  }

  return result;
}

// ── Batch search for multiple leads (efficiente: 1 Apify run per batch) ────

// Extract instagram/facebook URLs from any search result list
function extractSocialUrls(items, qWords) {
  const ig = [], fb = [];
  const IG_SKIP = ['p', 'reel', 'stories', 'explore', 'accounts', 'reels', 'tv', 'popular', 'tags'];
  const FB_SKIP = ['sharer', 'share', 'login', 'dialog', 'tr', 'plugins', 'groups', 'events', 'pages', 'photo', 'video', 'watch'];

  for (const item of items) {
    const url = item.link || item.url || '';
    const urlLower = url.toLowerCase();

    const igM = urlLower.match(/instagram\.com\/([a-z0-9_.]{2,40})/);
    if (igM && !IG_SKIP.includes(igM[1])) {
      ig.push({ url: `https://www.instagram.com/${igM[1]}`, score: scoreSlug(igM[1], qWords) });
    }

    const fbM = url.match(/facebook\.com\/(?:p\/)?([a-zA-Z0-9.\-]{3,80})/);
    if (fbM) {
      const slug = fbM[1];
      if (!FB_SKIP.includes(slug.toLowerCase()) && !/^\d{6,}$/.test(slug)) {
        fb.push({ url, score: scoreSlug(slug, qWords) });
      }
    }
    // Accept /p/ pages directly
    if (url.includes('facebook.com/p/') && !fb.length) {
      fb.push({ url, score: 1 });
    }
  }

  ig.sort((a, b) => b.score - a.score);
  fb.sort((a, b) => b.score - a.score);
  return { ig: ig[0]?.url || null, fb: fb[0]?.url || null };
}

async function batchSearchLeads(leads) {
  const key = process.env.APIFY_API_KEY;
  if (!key || !leads.length) return {};

  const queries = [];
  const queryMap = {}; // query → { leadId, type }

  for (const lead of leads) {
    const nameClean = lead.ragione_sociale;
    const shortName = extractQueryWords(nameClean).slice(0, 3).join(' ');
    const city = lead.citta || '';
    // Query 1: exact name + site:instagram (precise but sometimes misses profiles)
    const igQ = `"${nameClean}" ${city} site:instagram.com`.trim();
    // Query 2: short name plain web search WITHOUT quotes (catches more IG profiles)
    const plainQ = `${shortName} instagram OR facebook`.trim();
    // Query 3: facebook site search
    const fbQ = `"${nameClean}" ${city} site:facebook.com`.trim();

    queries.push(igQ, plainQ, fbQ);
    queryMap[igQ]    = { id: lead.id, type: 'ig_site',  name: lead.ragione_sociale };
    queryMap[plainQ] = { id: lead.id, type: 'plain',    name: lead.ragione_sociale };
    queryMap[fbQ]    = { id: lead.id, type: 'fb_site',  name: lead.ragione_sociale };
  }

  try {
    const resultMap = await apifySearch(queries);
    if (!resultMap) return {};

    const results = {}; // leadId → { instagram_url, facebook_url }

    for (const [query, items] of Object.entries(resultMap)) {
      const meta = queryMap[query];
      if (!meta) continue;
      const qWords = extractQueryWords(meta.name);
      if (!results[meta.id]) results[meta.id] = {};

      const { ig, fb } = extractSocialUrls(items, qWords);

      // ig_site and plain queries contribute to instagram_url (don't overwrite if already set)
      if ((meta.type === 'ig_site' || meta.type === 'plain') && ig && !results[meta.id].instagram_url) {
        results[meta.id].instagram_url = ig;
      }
      // plain and fb_site queries contribute to facebook_url
      if ((meta.type === 'fb_site' || meta.type === 'plain') && fb && !results[meta.id].facebook_url) {
        results[meta.id].facebook_url = fb;
      }
    }

    return results;
  } catch (err) {
    console.error('batchSearchLeads error:', err.message);
    return {};
  }
}

module.exports = { searchCompany, batchSearchLeads, apifySearch };
