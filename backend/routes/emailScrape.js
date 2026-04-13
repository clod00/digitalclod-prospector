/**
 * POST /api/email-scrape/hot
 * Trova email per tutti i lead Hot senza email, esclude food.
 * Risposta: SSE stream con progresso in tempo reale.
 *
 * Cascata economica:
 *   Phase 1 — homepage scrape + /contatti scrape + pattern guess (gratis)
 *   Phase 2 — Google via Apify solo per lead senza sito_web (~$0.003/query)
 */

const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const {
  isFood,
  findEmailCheap,
  buildGoogleEmailQuery,
  parseEmailFromGoogleResults,
} = require('../services/emailFinder');

router.post('/hot', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    // Carica tutti gli Hot senza email
    const { data: leads, error } = await supabase
      .from('prospect_leads')
      .select('id, ragione_sociale, citta, settore, sito_web, email_trovata')
      .eq('score_tier', 'Hot')
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

    // ── Phase 1: metodi gratuiti ──────────────────────────────────────────────
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
          // Nessun sito_web → tenta con Google
          needsGoogle.push(lead);
        }
      } catch (err) {
        console.error(`emailFinder error for ${lead.ragione_sociale}:`, err.message);
        needsGoogle.push(lead);
      }
    }

    // ── Phase 2: Google Apify (batch, solo lead senza sito) ───────────────────
    if (needsGoogle.length > 0 && process.env.APIFY_API_KEY) {
      send({
        phase: 2,
        msg: `Ricerca Google per ${needsGoogle.length} lead senza sito...`,
        total: needsGoogle.length,
      });

      const { apifySearch } = require('../services/googleSearch');
      const queries = needsGoogle.map(buildGoogleEmailQuery);
      // Map: query string → lead object
      const queryToLead = Object.fromEntries(needsGoogle.map((l, i) => [queries[i], l]));

      try {
        const resultMap = await apifySearch(queries);
        if (resultMap) {
          for (const [query, items] of Object.entries(resultMap)) {
            const lead = queryToLead[query];
            if (!lead) continue;
            const email = parseEmailFromGoogleResults(items);
            if (email) {
              await supabase
                .from('prospect_leads')
                .update({ email_trovata: email })
                .eq('id', lead.id);
              send({ found_id: lead.id, email, source: 'google' });
              found++;
            }
          }
        }
      } catch (err) {
        send({ warning: `Google search non disponibile: ${err.message}` });
      }
    } else if (needsGoogle.length > 0 && !process.env.APIFY_API_KEY) {
      send({ warning: `${needsGoogle.length} lead senza sito saltati (APIFY_API_KEY mancante)` });
    }

    send({ phase: 'done', found, total: valid.length, skipped_food: skippedFood });
  } catch (err) {
    console.error('emailScrape error:', err);
    send({ error: err.message });
  }

  res.end();
});

module.exports = router;
