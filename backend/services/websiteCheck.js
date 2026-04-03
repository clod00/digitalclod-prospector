const axios = require('axios');
const cheerio = require('cheerio');

async function checkWebsite(url) {
  if (!url || !url.trim()) return { exists: false };

  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith('http')) normalizedUrl = 'https://' + normalizedUrl;

  const result = {
    exists: false,
    hasSSL: false,
    hasMobileRedirect: false,
    hasPixel: false,
    emailProvider: null,
    emailsFound: [],
    socialLinks: { instagram: null, facebook: null },
    finalUrl: normalizedUrl,
  };

  try {
    const response = await axios.get(normalizedUrl, {
      timeout: 10000,
      maxRedirects: 5,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DigitalClodBot/1.0)' },
      validateStatus: (s) => s < 500,
    });

    result.exists = response.status < 400;
    result.hasSSL = response.request?.socket?.encrypted || normalizedUrl.startsWith('https');
    result.finalUrl = response.config?.url || normalizedUrl;

    const html = response.data || '';
    const $ = cheerio.load(html);

    // Meta pixel detection
    result.hasPixel = html.includes('fbq(') || html.includes('connect.facebook.net') || html.includes('facebook.net/en_US/fbevents');

    // Email extraction
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = html.match(emailRegex) || [];
    result.emailsFound = [...new Set(emails)].filter(e => !e.includes('example') && !e.includes('pixel')).slice(0, 5);

    if (result.emailsFound.length > 0) {
      const email = result.emailsFound[0];
      const domain = email.split('@')[1];
      if (['gmail.com', 'libero.it', 'hotmail.com', 'yahoo.it', 'virgilio.it', 'outlook.com'].includes(domain)) {
        result.emailProvider = domain;
      } else {
        result.emailProvider = 'custom_domain';
      }
    }

    // Social links
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!result.socialLinks.instagram && href.includes('instagram.com')) result.socialLinks.instagram = href;
      if (!result.socialLinks.facebook && href.includes('facebook.com')) result.socialLinks.facebook = href;
    });

    // Mobile redirect (check viewport meta or m. subdomain redirect)
    result.hasMobileRedirect = html.includes('name="viewport"') || html.includes('width=device-width');

  } catch (err) {
    result.exists = false;
    result.error = err.message;
  }

  return result;
}

// Try to scrape contact page for emails
async function checkContactPage(baseUrl) {
  const paths = ['/contatti', '/contattaci', '/contact', '/chi-siamo', '/about'];
  for (const path of paths) {
    try {
      const response = await axios.get(baseUrl.replace(/\/$/, '') + path, {
        timeout: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DigitalClodBot/1.0)' },
        validateStatus: (s) => s < 400,
      });
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emails = (response.data || '').match(emailRegex) || [];
      const filtered = [...new Set(emails)].filter(e => !e.includes('example') && !e.includes('pixel'));
      if (filtered.length > 0) return filtered;
    } catch (_) {}
  }
  return [];
}

module.exports = { checkWebsite, checkContactPage };
