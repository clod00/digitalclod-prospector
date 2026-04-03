const axios = require('axios');

async function getPageSpeedScore(url) {
  if (!url) return null;
  try {
    const apiKey = process.env.PAGESPEED_API_KEY;
    const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&key=${apiKey}`;
    const response = await axios.get(endpoint, { timeout: 30000 });
    const score = response.data?.lighthouseResult?.categories?.performance?.score;
    return score ? Math.round(score * 100) : null;
  } catch (err) {
    console.error('PageSpeed error:', err.message);
    return null;
  }
}

module.exports = { getPageSpeedScore };
