const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

// GET /api/leads — list with filters
router.get('/', async (req, res) => {
  try {
    const { tier, settore, stato, sort = 'score_totale', order = 'desc', page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('prospect_leads')
      .select('*', { count: 'exact' })
      .order(sort, { ascending: order === 'asc' })
      .range(offset, offset + parseInt(limit) - 1);

    if (tier) query = query.eq('score_tier', tier);
    if (settore) query = query.eq('settore', settore);
    if (stato) query = query.eq('stato', stato);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leads/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('prospect_leads')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/leads/:id
router.patch('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('prospect_leads')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/leads/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('prospect_leads')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leads/meta/kpi
router.get('/meta/kpi', async (req, res) => {
  try {
    const [{ count: total }, { count: hot }, { count: enriched }, { count: contacted }] = await Promise.all([
      supabase.from('prospect_leads').select('*', { count: 'exact', head: true }),
      supabase.from('prospect_leads').select('*', { count: 'exact', head: true }).eq('score_tier', 'Hot'),
      supabase.from('prospect_leads').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
      supabase.from('prospect_leads').select('*', { count: 'exact', head: true }).neq('stato', 'da_contattare'),
    ]);

    // Calculate response rate
    const { count: ristorati } = await supabase
      .from('prospect_leads')
      .select('*', { count: 'exact', head: true })
      .eq('stato', 'risposto');

    const tassoRisposta = contacted > 0 ? Math.round((ristorati / contacted) * 100) : 0;

    res.json({ total, hot, enriched, tassoRisposta });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leads/meta/settori
router.get('/meta/settori', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('prospect_leads')
      .select('settore')
      .not('settore', 'is', null);
    if (error) throw error;
    const unique = [...new Set(data.map(d => d.settore))].filter(Boolean).sort();
    res.json(unique);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
