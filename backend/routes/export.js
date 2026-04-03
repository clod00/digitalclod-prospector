const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const supabase = require('../lib/supabase');

async function getFilteredLeads(query) {
  const { tier, settore, stato, ids } = query;
  let q = supabase.from('prospect_leads').select('*').order('score_totale', { ascending: false });

  if (ids) q = q.in('id', ids.split(','));
  if (tier) q = q.eq('score_tier', tier);
  if (settore) q = q.eq('settore', settore);
  if (stato) q = q.eq('stato', stato);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// GET /api/export/csv — full CSV export
router.get('/csv', async (req, res) => {
  try {
    const leads = await getFilteredLeads(req.query);

    const rows = leads.map(l => ({
      'Ragione Sociale': l.ragione_sociale,
      'P.IVA': l.piva,
      'Città': l.citta,
      'Settore': l.settore,
      'Telefono': l.telefono,
      'Email': l.email_trovata,
      'Sito Web': l.sito_web,
      'Score': l.score_totale,
      'Tier': l.score_tier,
      'Sito Esiste': l.sito_esiste ? 'Sì' : 'No',
      'PageSpeed': l.sito_pagespeed,
      'Meta Pixel': l.sito_ha_pixel ? 'Sì' : 'No',
      'Email Provider': l.sito_email_provider,
      'Google Stelle': l.gmaps_stelle,
      'Google Recensioni': l.gmaps_recensioni,
      'Instagram Follower': l.social_instagram_follower,
      'FB Ads Attivi': l.fa_ads_attivi ? 'Sì' : 'No',
      'Stato': l.stato,
      'Note': l.note,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="digitalclod-prospector.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/export/addresses — physical addresses for postal mailing
router.get('/addresses', async (req, res) => {
  try {
    const leads = await getFilteredLeads(req.query);
    const rows = leads
      .filter(l => l.indirizzo_fisico)
      .map(l => ({
        'Ragione Sociale': l.ragione_sociale,
        'Indirizzo': l.indirizzo_fisico,
        'Città': l.citta,
        'Telefono': l.telefono,
      }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Indirizzi');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="indirizzi-postali.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/export/activecampaign — email list for ActiveCampaign
router.get('/activecampaign', async (req, res) => {
  try {
    const leads = await getFilteredLeads(req.query);
    const rows = leads
      .filter(l => l.email_trovata)
      .map(l => ({
        Email: l.email_trovata,
        'First Name': l.ragione_sociale,
        'Last Name': '',
        Phone: l.telefono,
        Organization: l.ragione_sociale,
        Tags: [l.score_tier, l.settore].filter(Boolean).join(','),
      }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="activecampaign-import.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
