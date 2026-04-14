/**
 * POST /api/email-scrape/hot-warm
 * Trova email per tutti i lead Hot e Warm senza email, esclude food e freddi.
 * Risposta: SSE stream con progresso in tempo reale.
 *
 * Cascata economica:
 *   Phase 1 — homepage scrape + /contatti + altre pagine + pattern guess (gratis)
 *             per lead senza sito: domain guessing dal nome azienda (gratis)
 *   Phase 2 — Google via Apify per lead rimasti senza email:
 *             prima cerca il sito → lo scrapa; fallback su snippet (~$0.003/query)
 */

const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { checkWebsite, checkContactPage } = require('../services/websiteCheck');
const {
  isFood,
  findEmailCheap,
  buildGoogleEmailQuery,
  buildGoogleSiteQuery,
  parseEmailFromGoogleResults,
} = require('../services/emailFinder');

const NON_COMPANY_DOMAINS = [
  'paginegialle', 'paginebianche', 'misterimprese', 'atoka', 'registroimprese', 'ufficiocamerale',
  'infocamere', 'cerved', 'agenziaentrate', 'europages', 'kompass', 'icribis',
  'linkedin', 'tripadvisor', 'yelp', 'booking', 'trustpilot', 'google.com',
  'maps.google', 'wikipedia', 'virgilio', 'corriere', 'sole24ore', 'repubblica',
  'subito.it', 'ebay', 'amazon', 'tuttocitta', 'chiamarapido', 'habitissimo',
  'infobel', 'pagine24', 'comuni-italiani', 'pagineinforma', 'facebook.com', 'instagram.com',
  'cylex-italia', 'impresaitalia', 'impresaitaliana', 'hotfrog',
];

function extractDomain(siteUrl) {
  try {
    const u = siteUrl.startsWith('http') ? siteUrl : 'https://' + siteUrl;
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function findCompanySiteFromResults(items) {
  for (const item of items) {
    const url = item.link || item.url || '';
    if (!url) continue;
    const isDirectory = NON_COMPANY_DOMAINS.some(d => url.toLowerCase().includes(d));
    if (!isDirectory) return url;
  }
  return null;
}

async function handleEmailScrape(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    // Carica tutti gli Hot e Warm senza email (salta freddi e chi ha già email)
    const { data: leads, error } = await supabase
      .from('prospect_leads')
      .select('id, ragione_sociale, citta, settore, sito_web, email_trovata')
      .in('score_tier', ['Hot', 'Warm'])
      .is('email_trovata', null);

    if (error) throw error;

    // Escludi food
    const valid = leads.filter(l => !isFood(l));
    const skippedFood = leads.length - valid.length;

    send({ phase: 'start', total: valid.length, skipped_food: skippedFood });

    if (valid.length === 0) {
      send({ phase: 'done', found: 0, total: 0 });
      return res.end();
    }

    // ── Phase 1: metodi gratuiti (scraping + domain guessing) ────────────────
    const needsGoogle = [];
    let found = 0;

    for (let i = 0; i < valid.length; i++) {
      const lead = valid[i];
      send({ phase: 1, done: i, total: valid.length, current: lead.ragione_sociale });

      try {
        const result = await findEmailCheap(lead);
        if (result) {
          await supabase
            .from('prospect_leads')
            .update({ email_trovata: result.email })
            .eq('id', lead.id);
          send({ found_id: lead.id, email: result.email, source: result.source });
          found++;
        } else {
          // Nessun sito e domain guessing fallito → tenta con Google
          needsGoogle.push(lead);
        }
      } catch (err) {
        console.error(`emailFinder error for ${lead.ragione_sociale}:`, err.message);
        needsGoogle.push(lead);
      }
    }

    // ── Phase 2: Google Apify — per lead rimasti senza email ─────────────────
    if (needsGoogle.length > 0 && process.env.APIFY_API_KEY) {
      send({
        phase: 2,
        msg: `Ricerca Google per ${needsGoogle.length} lead...`,
        total: needsGoogle.length,
      });

      const { apifySearch } = require('../services/googleSearch');

      // Per ogni lead: query sito + query email snippet (2 query → 1 Apify run batch)
      const queries = [];
      const queryMeta = {};
      for (const lead of needsGoogle) {
        const siteQ = buildGoogleSiteQuery(lead);
        const emailQ = buildGoogleEmailQuery(lead);
        queries.push(siteQ, emailQ);
        queryMeta[siteQ]  = { id: lead.id, type: 'site',  lead };
        queryMeta[emailQ] = { id: lead.id, type: 'email', lead };
      }

      try {
        const resultMap = await apifySearch(queries);
        if (resultMap) {
          // Passo A: prova a trovare il sito → scrapa
          const foundByLead = {};

          for (const [query, items] of Object.entries(resultMap)) {
            const meta = queryMeta[query];
            if (!meta || meta.type !== 'site' || foundByLead[meta.id]) continue;

            const siteUrl = findCompanySiteFromResults(items);
            if (!siteUrl) continue;

            try {
              const siteData = await checkWebsite(siteUrl);
              if (siteData.emailsFound?.length > 0) {
                foundByLead[meta.id] = { email: siteData.emailsFound[0], source: 'google_site' };
                continue;
              }
              const contactEmails = await checkContactPage(siteUrl);
              if (contactEmails.length > 0) {
                foundByLead[meta.id] = { email: contactEmails[0], source: 'google_contatti' };
                continue;
              }
              const domain = extractDomain(siteUrl);
              if (domain) {
                foundByLead[meta.id] = { email: `info@${domain}`, source: 'google_pattern' };
              }
            } catch (_) {}
          }

          // Passo B: fallback su snippet per chi non ha ancora email
          for (const [query, items] of Object.entries(resultMap)) {
            const meta = queryMeta[query];
            if (!meta || meta.type !== 'email' || foundByLead[meta.id]) continue;

            const email = parseEmailFromGoogleResults(items);
            if (email) foundByLead[meta.id] = { email, source: 'google_snippet' };
          }

          // Salva risultati
          for (const [leadId, result] of Object.entries(foundByLead)) {
            await supabase
              .from('prospect_leads')
              .update({ email_trovata: result.email })
              .eq('id', leadId);
            send({ found_id: leadId, email: result.email, source: result.source });
            found++;
          }
        }
      } catch (err) {
        send({ warning: `Google search non disponibile: ${err.message}` });
      }
    } else if (needsGoogle.length > 0 && !process.env.APIFY_API_KEY) {
      send({ warning: `${needsGoogle.length} lead saltati (APIFY_API_KEY mancante)` });
    }

    send({ phase: 'done', found, total: valid.length, skipped_food: skippedFood });
  } catch (err) {
    console.error('emailScrape error:', err);
    send({ error: err.message });
  }

  res.end();
}

// Alias /hot mantenuto per compatibilità; /hot-warm è il nome aggiornato
router.post('/hot', handleEmailScrape);
router.post('/hot-warm', handleEmailScrape);

module.exports = router;
