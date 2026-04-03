const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { checkWebsite, checkContactPage } = require('../services/websiteCheck');
const { getPageSpeedScore } = require('../services/pagespeed');
const { getGoogleMapsData, getInstagramFollowers } = require('../services/apify');
const { checkFacebookAds } = require('../services/facebookAds');
const { computeScore } = require('../services/scoring');

// POST /api/enrich/:id — enrich single lead
router.post('/:id', async (req, res) => {
  try {
    const { data: lead, error: fetchErr } = await supabase
      .from('prospect_leads')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !lead) return res.status(404).json({ error: 'Lead not found' });

    const updates = await enrichLead(lead);
    const { score, tier, breakdown } = computeScore({ ...lead, ...updates });

    const finalUpdates = {
      ...updates,
      score_totale: score,
      score_tier: tier,
      score_breakdown: breakdown,
      enriched_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('prospect_leads')
      .update(finalUpdates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Enrich error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/enrich/bulk — enrich multiple leads
router.post('/bulk', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }

  // SSE for progress
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendProgress = (done, total, current) => {
    res.write(`data: ${JSON.stringify({ done, total, current })}\n\n`);
  };

  try {
    const { data: leads } = await supabase
      .from('prospect_leads')
      .select('*')
      .in('id', ids);

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      sendProgress(i, leads.length, lead.ragione_sociale);

      try {
        const updates = await enrichLead(lead);
        const { score, tier, breakdown } = computeScore({ ...lead, ...updates });

        await supabase
          .from('prospect_leads')
          .update({
            ...updates,
            score_totale: score,
            score_tier: tier,
            score_breakdown: breakdown,
            enriched_at: new Date().toISOString(),
          })
          .eq('id', lead.id);
      } catch (err) {
        console.error(`Enrich failed for ${lead.ragione_sociale}:`, err.message);
      }
    }

    sendProgress(leads.length, leads.length, 'done');
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

async function enrichLead(lead) {
  const updates = {};

  // 1. Website check
  if (lead.sito_web) {
    const siteData = await checkWebsite(lead.sito_web);
    updates.sito_esiste = siteData.exists;
    updates.sito_ha_pixel = siteData.hasPixel;

    if (siteData.emailsFound?.length > 0) {
      updates.email_trovata = siteData.emailsFound[0];
      updates.sito_email_provider = siteData.emailProvider;
    }

    if (!updates.email_trovata) {
      const contactEmails = await checkContactPage(lead.sito_web);
      if (contactEmails.length > 0) {
        updates.email_trovata = contactEmails[0];
      }
    }

    if (siteData.socialLinks?.instagram) updates.social_instagram_url = siteData.socialLinks.instagram;
    if (siteData.socialLinks?.facebook) updates.social_facebook_url = siteData.socialLinks.facebook;

    // 2. PageSpeed
    if (siteData.exists) {
      updates.sito_pagespeed = await getPageSpeedScore(lead.sito_web);
    }
  } else {
    updates.sito_esiste = false;
  }

  // 3. Google Maps
  const mapsData = await getGoogleMapsData(lead.ragione_sociale, lead.citta);
  if (mapsData) {
    if (mapsData.stelle !== null) updates.gmaps_stelle = mapsData.stelle;
    if (mapsData.recensioni !== null) updates.gmaps_recensioni = mapsData.recensioni;
    if (mapsData.foto !== null) updates.gmaps_foto = mapsData.foto;
    if (mapsData.indirizzo) updates.indirizzo_fisico = mapsData.indirizzo;
  }

  // 4. Instagram followers
  if (updates.social_instagram_url || lead.social_instagram_url) {
    const followers = await getInstagramFollowers(updates.social_instagram_url || lead.social_instagram_url);
    if (followers !== null) updates.social_instagram_follower = followers;
  }

  // 5. Facebook Ads check
  updates.fa_ads_attivi = await checkFacebookAds(lead.ragione_sociale);

  return updates;
}

module.exports = router;
