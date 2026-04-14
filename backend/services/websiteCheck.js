const axios = require('axios');
const cheerio = require('cheerio');

const BOT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

function normalizeUrl(url) {
  if (!url || !url.trim()) return null;
  let u = url.trim();
  if (!u.startsWith('http')) u = 'https://' + u;
  return u;
}

async function checkWebsite(rawUrl) {
  const url = normalizeUrl(rawUrl);
  if (!url) return { exists: false };

  const result = {
    exists: false,
    hasSSL: url.startsWith('https'),
    hasPixel: false,
    hasGoogleAds: false,
    hasGTM: false,
    hasWhatsApp: false,
    hasMobileRedirect: false,
    emailsFound: [],
    emailProvider: null,
    socialLinks: { instagram: null, facebook: null },
    addressFromSite: null,
    finalUrl: url,
  };

  let html = '';

  try {
    const response = await axios.get(url, {
      timeout: 12000,
      maxRedirects: 5,
      headers: { 'User-Agent': BOT_UA },
      validateStatus: (s) => s < 600,
    });

    // 403 = bot block but site IS alive, only 5xx = truly down
    result.exists = response.status < 500;
    result.finalUrl = response.config?.url || url;
    html = typeof response.data === 'string' ? response.data : '';
  } catch (err) {
    result.exists = false;
    result.error = err.message;
    return result;
  }

  if (!html) return result;

  // ── Meta Pixel ────────────────────────────────────────────────────────────
  let metaPixel = html.includes('facebook.com/tr') ||
    html.includes('fbq(') ||
    html.includes('connect.facebook.net');

  // ── Google Ads ────────────────────────────────────────────────────────────
  let googleAds = html.includes('google_conversion') ||
    html.includes('googleads.g') ||
    html.includes('googleads.g.doubleclick.net') ||
    html.includes("'AW-") ||
    html.includes('"AW-') ||
    html.includes('/AW-') ||
    html.includes('google_conversion_id');

  // ── GTM deep-check ────────────────────────────────────────────────────────
  const hasGTM = html.includes('googletagmanager.com') || html.includes('gtag(');
  if (hasGTM && (!googleAds || !metaPixel)) {
    const gtmIdMatch = html.match(/GTM-[A-Z0-9]+/);
    if (gtmIdMatch) {
      try {
        const gtmRes = await axios.get(
          `https://www.googletagmanager.com/gtm.js?id=${gtmIdMatch[0]}`,
          { timeout: 8000, headers: { 'User-Agent': BOT_UA }, validateStatus: () => true }
        );
        const gtmJs = typeof gtmRes.data === 'string' ? gtmRes.data : '';
        if (!googleAds && (gtmJs.includes('AW-') || gtmJs.includes('google_conversion'))) {
          googleAds = true;
        }
        if (!metaPixel && (gtmJs.includes('fbq') || gtmJs.includes('facebook.com/tr') || gtmJs.includes('connect.facebook.net'))) {
          metaPixel = true;
        }
      } catch (_) {}
    }
  }

  result.hasPixel = metaPixel;
  result.hasGoogleAds = googleAds;
  result.hasGTM = hasGTM;

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  result.hasWhatsApp = html.includes('wa.me/') ||
    html.includes('api.whatsapp.com') ||
    html.toLowerCase().includes('whatsapp');

  // ── Mobile viewport ───────────────────────────────────────────────────────
  result.hasMobileRedirect = html.includes('name="viewport"') || html.includes('width=device-width');

  // ── Instagram extraction (precise regex, exclude path segments) ───────────
  const igMatch = html.match(/instagram\.com\/([a-zA-Z0-9_.]{2,40})['"\/\s?#]/);
  if (igMatch && !['p', 'reel', 'stories', 'explore', 'accounts', 'reels', 'tagged', 'tv'].includes(igMatch[1])) {
    result.socialLinks.instagram = `https://www.instagram.com/${igMatch[1]}`;
  }

  // ── Facebook extraction ───────────────────────────────────────────────────
  const fbMatch = html.match(/facebook\.com\/([a-z0-9.\-]{3,80})/i);
  if (fbMatch && !['tr', 'sharer', 'dialog', 'plugins', 'photo', 'video'].includes(fbMatch[1])) {
    result.socialLinks.facebook = `https://www.facebook.com/${fbMatch[1]}`;
  }

  // ── Address extraction (JSON-LD first, then regex) ────────────────────────
  const ldMatches = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const ldRaw of ldMatches) {
    try {
      const ld = JSON.parse(ldRaw.replace(/<script[^>]*>|<\/script>/gi, '').trim());
      const items = Array.isArray(ld) ? ld : [ld];
      for (const item of items) {
        const addr = item?.address?.streetAddress || item?.location?.address?.streetAddress;
        if (addr) { result.addressFromSite = addr.trim(); break; }
      }
    } catch (_) {}
    if (result.addressFromSite) break;
  }
  if (!result.addressFromSite) {
    const addrMatch = html.match(/(?:via|viale|corso|piazza|strada|contrada|loc\.?)\s+[A-Za-zÀ-ÿ\s.'0-9,]+\d{5}/i);
    if (addrMatch) result.addressFromSite = addrMatch[0].replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  // ── Email extraction (filter system/placeholder emails) ───────────────────
  const emailRegex = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;
  const rawEmails = html.match(emailRegex) || [];
  const SYSTEM_EMAIL_PATTERNS = ['example.', 'noreply@', 'no-reply@', 'test@', '@sentry', '@w3.org', '@schema.org', '.png', '.jpg', 'pixel', 'placeholder'];
  result.emailsFound = [...new Set(rawEmails)]
    .filter(e => !SYSTEM_EMAIL_PATTERNS.some(p => e.toLowerCase().includes(p)))
    .slice(0, 5);

  if (result.emailsFound.length > 0) {
    const domain = result.emailsFound[0].split('@')[1];
    const GENERIC = ['gmail.com', 'libero.it', 'hotmail.com', 'yahoo.it', 'virgilio.it', 'outlook.com', 'pec.it'];
    result.emailProvider = GENERIC.includes(domain) ? domain : 'custom_domain';
  }

  return result;
}

async function checkContactPage(baseUrl) {
  const url = normalizeUrl(baseUrl);
  if (!url) return [];

  const paths = ['/contatti', '/contattaci', '/contact', '/chi-siamo', '/about',
                 '/contatto', '/info', '/dove-siamo', '/about-us', '/team', '/staff'];
  for (const path of paths) {
    try {
      const response = await axios.get(url.replace(/\/$/, '') + path, {
        timeout: 8000,
        headers: { 'User-Agent': BOT_UA },
        validateStatus: (s) => s < 400,
      });
      const html = typeof response.data === 'string' ? response.data : '';
      const emailRegex = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;
      const SYSTEM_EMAIL_PATTERNS = ['example.', 'noreply@', 'no-reply@', '@sentry', '@w3.org', '@schema.org'];
      const emails = [...new Set(html.match(emailRegex) || [])]
        .filter(e => !SYSTEM_EMAIL_PATTERNS.some(p => e.toLowerCase().includes(p)));
      if (emails.length > 0) return emails;
    } catch (_) {}
  }
  return [];
}

module.exports = { checkWebsite, checkContactPage };
