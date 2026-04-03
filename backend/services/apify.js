const axios = require('axios');

const APIFY_BASE = 'https://api.apify.com/v2';
const GOOGLE_MAPS_ACTOR = 'nwua9Gu5YrADL7ZDj';

async function runApifyActor(actorId, input, waitSecs = 120) {
  const apiKey = process.env.APIFY_API_KEY;
  try {
    // Start actor run
    const runRes = await axios.post(
      `${APIFY_BASE}/acts/${actorId}/runs?token=${apiKey}&waitForFinish=${waitSecs}`,
      input,
      { timeout: (waitSecs + 10) * 1000 }
    );

    const runId = runRes.data?.data?.id;
    if (!runId) throw new Error('No run ID returned from Apify');

    // Get dataset items
    const dataRes = await axios.get(
      `${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${apiKey}&limit=5`,
      { timeout: 30000 }
    );

    return dataRes.data || [];
  } catch (err) {
    console.error('Apify error:', err.message);
    return [];
  }
}

async function getGoogleMapsData(ragioneSociale, citta) {
  if (!ragioneSociale) return null;

  const query = `${ragioneSociale}${citta ? ' ' + citta : ''}`;
  const items = await runApifyActor(GOOGLE_MAPS_ACTOR, {
    searchStringsArray: [query],
    maxCrawledPlacesPerSearch: 1,
    language: 'it',
    countryCode: 'it',
  });

  if (!items || items.length === 0) return null;

  const place = items[0];
  return {
    stelle: place.totalScore || place.rating || null,
    recensioni: place.reviewsCount || null,
    foto: place.imageCount || null,
    indirizzo: place.address || place.street || null,
    placeId: place.placeId || null,
    mapsUrl: place.url || null,
  };
}

async function getInstagramFollowers(instagramUrl) {
  if (!instagramUrl) return null;
  // Basic scrape via Apify Instagram Profile Scraper
  const INSTAGRAM_ACTOR = 'shu8hvrXbJbY3Eb9W';
  try {
    const username = instagramUrl.replace(/\/$/, '').split('/').pop();
    const items = await runApifyActor(INSTAGRAM_ACTOR, {
      usernames: [username],
    }, 60);
    if (!items || items.length === 0) return null;
    return items[0]?.followersCount || null;
  } catch {
    return null;
  }
}

module.exports = { getGoogleMapsData, getInstagramFollowers, runApifyActor };
