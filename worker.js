/**
 * GREGENTIC DATA WORKER v4
 * Deploy to: Cloudflare Workers → gregentic-data
 *
 * Routes:
 *   GET /        → health check
 *   GET /adsb    → adsb.lol live aircraft
 *   GET /markets → Yahoo Finance: S&P 500, Brent Crude, 30Y Treasury (^TYX)
 *   GET /news    → RSS feed proxy
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const path = url.pathname;

    // ── Health check ────────────────────────────────────
    if (path === '/') {
      return json({ status: 'GREGENTIC DATA WORKER', version: '4.0', ts: Date.now() });
    }

    // ── ADS-B: concurrent adsb.lol + OpenSky, edge-cached ─
    if (path === '/adsb') {
      const lat  = parseFloat(url.searchParams.get('lat')  || '39.1157');
      const lon  = parseFloat(url.searchParams.get('lon')  || '-77.5636');
      const dist = parseFloat(url.searchParams.get('dist') || '50');

      // Serve from edge cache if fresh (avoids upstream rate limits)
      const cache = caches.default;
      const ck = new Request(`https://cache.gregentic/adsb?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}&dist=${dist}`);
      const hit = await cache.match(ck);
      if (hit) return hit;

      // Race both sources concurrently — first success wins
      const adsbLol = fetch(
        `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${dist}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Referer': 'https://adsb.lol/',
          },
          signal: AbortSignal.timeout(6000),
        }
      ).then(r => { if (!r.ok) throw new Error(`adsb.lol ${r.status}`); return r.json(); });

      const latDelta = dist / 60;
      const lonDelta = dist / (60 * Math.cos(lat * Math.PI / 180));
      const bbox = `lamin=${(lat-latDelta).toFixed(4)}&lomin=${(lon-lonDelta).toFixed(4)}&lamax=${(lat+latDelta).toFixed(4)}&lomax=${(lon+lonDelta).toFixed(4)}`;
      const openSky = fetch(
        `https://opensky-network.org/api/states/all?${bbox}`,
        { signal: AbortSignal.timeout(6000) }
      ).then(async r => {
        if (!r.ok) throw new Error(`OpenSky ${r.status}`);
        const d = await r.json();
        return {
          ac: (d.states || []).filter(s => s[5] != null && s[6] != null).map(s => ({
            hex: s[0], flight: s[1] ? s[1].trim() : s[0],
            lat: s[6], lon: s[5],
            alt_baro: s[8] ? 0 : (s[7] != null ? Math.round(s[7] * 3.28084) : null),
            gs: s[9] != null ? Math.round(s[9] * 1.94384) : null,
            track: s[10] || 0, t: '', r: '', dbFlags: 0,
          })),
          src: 'opensky',
        };
      });

      const results = await Promise.allSettled([adsbLol, openSky]);
      const winner = results.find(r => r.status === 'fulfilled');

      if (winner) {
        const body = JSON.stringify(winner.value);
        const resp = new Response(body, {
          headers: { ...CORS, 'Cache-Control': 'public, max-age=22' },
        });
        ctx.waitUntil(cache.put(ck, resp.clone()));
        return resp;
      }

      return json({ error: 'All ADS-B sources failed', ac: [] }, 502);
    }

    // ── Markets: S&P 500, Brent Crude, 30Y Treasury ─────
    if (path === '/markets') {
      const results = {};
      await Promise.all(['^GSPC', 'BZ=F', '^TYX'].map(async sym => {
        try {
          const r = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=7d&interval=1d`,
            {
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; gregentic/4.0)' },
              signal: AbortSignal.timeout(8000)
            }
          );
          if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);
          results[sym] = await r.json();
        } catch (e) {
          results[sym] = { error: e.message };
        }
      }));
      return json(results);
    }

    // ── RSS News feed ────────────────────────────────────
    if (path === '/news') {
      const rssUrl = url.searchParams.get('url') || 'https://feeds.bbci.co.uk/news/world/rss.xml';
      try {
        const r = await fetch(rssUrl, {
          headers: { 'User-Agent': 'gregentic/4.0' },
          signal: AbortSignal.timeout(8000)
        });
        if (!r.ok) throw new Error(`RSS HTTP ${r.status}`);
        return new Response(await r.text(), {
          headers: { ...CORS, 'Content-Type': 'application/xml' }
        });
      } catch (e) {
        return json({ error: e.message }, 502);
      }
    }

    return json({ error: 'Not found' }, 404);
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}
