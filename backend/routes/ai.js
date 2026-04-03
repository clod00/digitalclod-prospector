const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { generateAIOutput } = require('../services/aiOutput');

// POST /api/ai/:id — generate AI output for lead
router.post('/:id', async (req, res) => {
  try {
    const { data: lead, error: fetchErr } = await supabase
      .from('prospect_leads')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !lead) return res.status(404).json({ error: 'Lead not found' });

    const aiOutput = await generateAIOutput(lead);

    const { data, error } = await supabase
      .from('prospect_leads')
      .update({
        ai_email_template: aiOutput.email_template,
        ai_whatsapp_hook: aiOutput.whatsapp_hook,
        ai_idee_automazione: JSON.stringify(aiOutput.idee_automazione),
        ai_oggetto_ab: JSON.stringify(aiOutput.email_oggetto_ab),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ ...data, ai_parsed: aiOutput });
  } catch (err) {
    console.error('AI route error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
