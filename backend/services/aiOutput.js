const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildLeadContext(lead) {
  const gaps = [];
  const breakdown = lead.score_breakdown || [];

  if (!lead.sito_esiste) gaps.push('nessun sito web');
  else if (lead.sito_pagespeed && lead.sito_pagespeed < 50) gaps.push(`sito web molto lento (PageSpeed: ${lead.sito_pagespeed}/100)`);
  if (!lead.social_instagram_url && !lead.social_facebook_url) gaps.push('assenza totale sui social media');
  else if (lead.social_instagram_follower < 200) gaps.push(`presenza social debole (solo ${lead.social_instagram_follower} follower su Instagram)`);
  if (!lead.fa_ads_attivi) gaps.push('nessuna campagna pubblicitaria online attiva');
  if (!lead.sito_ha_pixel) gaps.push('nessun pixel di tracciamento per retargeting');
  if (lead.sito_email_provider && lead.sito_email_provider !== 'custom_domain') gaps.push(`email aziendale su ${lead.sito_email_provider} (non professionale)`);

  return {
    nome: lead.ragione_sociale,
    citta: lead.citta,
    settore: lead.settore,
    sito: lead.sito_web,
    score: lead.score_totale,
    tier: lead.score_tier,
    gaps: gaps.slice(0, 3),
    gmaps: lead.gmaps_stelle ? `${lead.gmaps_stelle}★ su Google Maps (${lead.gmaps_recensioni} recensioni)` : null,
  };
}

async function generateAIOutput(lead) {
  const ctx = buildLeadContext(lead);
  const gapsStr = ctx.gaps.length > 0 ? ctx.gaps.join(', ') : 'presenza digitale migliorabile';

  const prompt = `Sei un consulente di marketing digitale e automazione della mia agenzia DigitalClod. Devo contattare questa azienda per proporre i nostri servizi.

AZIENDA: ${ctx.nome}
CITTÀ: ${ctx.citta || 'Italia'}
SETTORE: ${ctx.settore || 'non specificato'}
SITO WEB: ${ctx.sito || 'assente'}
GAP DIGITALI IDENTIFICATI: ${gapsStr}
${ctx.gmaps ? `GOOGLE MAPS: ${ctx.gmaps}` : ''}
SCORE DIGITALE: ${ctx.score}/20 (${ctx.tier})

Genera in formato JSON con questi 4 campi:

{
  "email_template": "Email professionale personalizzata (max 180 parole). Oggetto: [scrivi un oggetto]. Menziona i gap specifici trovati, proponi 2-3 soluzioni concrete, finisci con una CTA chiara. Tono diretto ma non aggressivo.",
  "email_oggetto_ab": ["Oggetto A (curiosità/problema)", "Oggetto B (benefit/risultato)"],
  "whatsapp_hook": "Messaggio WhatsApp max 3 righe. Informale ma professionale. Deve incuriosire senza sembrare spam.",
  "idee_automazione": ["Idea 1 specifica per il settore ${ctx.settore}", "Idea 2 concreta con ROI chiaro", "Idea 3 quick win implementabile in poco tempo"]
}

Rispondi SOLO con il JSON, nessun testo extra.`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0]?.text || '{}';
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in AI response');
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('AI output error:', err.message);
    return {
      email_template: `Gentile ${ctx.nome},\n\nHo analizzato la vostra presenza digitale e ho identificato alcune opportunità concrete per migliorare l'acquisizione clienti online.\n\nSarei lieto di mostrarvi come altri business nel settore ${ctx.settore || 'del vostro settore'} stanno ottenendo risultati concreti.\n\nPossiamo fissare una chiamata di 15 minuti?\n\nCordiali saluti,\nDigitalClod`,
      email_oggetto_ab: ['Ho trovato 3 problemi nel vostro sito', 'Come acquisire clienti online nel settore ' + (ctx.settore || 'del vostro settore')],
      whatsapp_hook: `Ciao! Ho analizzato ${ctx.nome} e ho trovato alcune opportunità interessanti. Posso mandarti un'analisi rapida?`,
      idee_automazione: ['Automazione follow-up clienti via email', 'Chatbot per preventivi automatici', 'Sistema di raccolta recensioni Google Maps'],
    };
  }
}

module.exports = { generateAIOutput };
