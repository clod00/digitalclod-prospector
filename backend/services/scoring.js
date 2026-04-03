const HIGH_OPPORTUNITY_SECTORS = [
  'edilizia', 'costruzioni', 'legale', 'avvocato', 'medico', 'dentista', 'clinica',
  'immobiliare', 'agenzia immobiliare', 'ristorazione', 'ristorante', 'bar', 'pizzeria',
  'automotive', 'concessionaria', 'officina', 'estetica', 'parrucchiere', 'spa',
  'commercialista', 'contabilità', 'assicurazioni', 'agenzia di viaggi',
];

const GENERIC_EMAIL_PROVIDERS = ['gmail.com', 'libero.it', 'hotmail.com', 'yahoo.it', 'virgilio.it', 'outlook.com'];

function computeScore(lead) {
  const breakdown = [];
  let score = 0;

  // Website checks
  if (!lead.sito_esiste) {
    score += 4;
    breakdown.push({ label: 'Nessun sito web', points: 4, icon: '🚫' });
  } else if (lead.sito_pagespeed !== null && lead.sito_pagespeed < 50) {
    score += 3;
    breakdown.push({ label: `Sito lento (PageSpeed ${lead.sito_pagespeed})`, points: 3, icon: '🐢' });
  } else if (lead.sito_pagespeed !== null && lead.sito_pagespeed < 70) {
    score += 1;
    breakdown.push({ label: `Sito datato (PageSpeed ${lead.sito_pagespeed})`, points: 1, icon: '⚠️' });
  }

  // No Meta Pixel
  if (lead.sito_esiste && !lead.sito_ha_pixel) {
    score += 1;
    breakdown.push({ label: 'Nessun Meta Pixel', points: 1, icon: '📊' });
  }

  // Email provider generica
  if (lead.sito_email_provider && GENERIC_EMAIL_PROVIDERS.includes(lead.sito_email_provider)) {
    score += 1;
    breakdown.push({ label: `Email generica (${lead.sito_email_provider})`, points: 1, icon: '📧' });
  }

  // Social
  const hasInstagram = !!lead.social_instagram_url;
  const hasFacebook = !!lead.social_facebook_url;
  if (!hasInstagram && !hasFacebook) {
    score += 3;
    breakdown.push({ label: 'Nessun social media', points: 3, icon: '📵' });
  } else if (lead.social_instagram_follower !== null && lead.social_instagram_follower < 200) {
    score += 2;
    breakdown.push({ label: `Social debole (${lead.social_instagram_follower} follower IG)`, points: 2, icon: '📉' });
  } else if (lead.social_instagram_follower !== null && lead.social_instagram_follower < 1000) {
    score += 1;
    breakdown.push({ label: `Social limitato (${lead.social_instagram_follower} follower IG)`, points: 1, icon: '📊' });
  }

  // No Facebook Ads
  if (!lead.fa_ads_attivi) {
    score += 1;
    breakdown.push({ label: 'Nessuna campagna Meta Ads attiva', points: 1, icon: '💡' });
  }

  // Settore alto opportunità
  const settoreLower = (lead.settore || '').toLowerCase();
  if (HIGH_OPPORTUNITY_SECTORS.some(s => settoreLower.includes(s))) {
    score += 2;
    breakdown.push({ label: `Settore ad alta opportunità (${lead.settore})`, points: 2, icon: '🎯' });
  }

  // Google Maps reviews (azienda seria con budget)
  if (lead.gmaps_recensioni > 50 && lead.gmaps_stelle >= 4.0) {
    score += 1;
    breakdown.push({ label: `Azienda con reputazione (${lead.gmaps_recensioni} rec, ${lead.gmaps_stelle}★)`, points: 1, icon: '⭐' });
  }

  // High estimated revenue signals (many reviews = established)
  if (lead.gmaps_recensioni > 200) {
    score += 3;
    breakdown.push({ label: `Azienda consolidata (${lead.gmaps_recensioni}+ recensioni)`, points: 3, icon: '💼' });
  }

  // Tier
  let tier;
  if (score >= 14) tier = 'Hot';
  else if (score >= 8) tier = 'Warm';
  else tier = 'Cold';

  return { score: Math.min(score, 20), tier, breakdown };
}

module.exports = { computeScore };
