const axios = require('axios');

async function checkFacebookAds(ragioneSociale) {
  if (!ragioneSociale) return false;
  try {
    // Facebook Ad Library public endpoint (no auth needed for basic check)
    const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=IT&q=${encodeURIComponent(ragioneSociale)}&search_type=keyword_unordered`;
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'it-IT,it;q=0.9',
      },
      validateStatus: (s) => s < 500,
    });

    const html = response.data || '';
    // If we find ad results JSON in the response
    const hasAds = html.includes('"page_name"') && html.includes('"ad_snapshot_url"');
    return hasAds;
  } catch (err) {
    console.error('FB Ads check error:', err.message);
    return false;
  }
}

module.exports = { checkFacebookAds };
