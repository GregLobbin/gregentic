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

    // ── ADS-B via adsb.lol ──────────────────────────────
    if (path === '/adsb') {
      const lat  = url.searchParams.get('lat')  || '39.1157';
      const lon  = url.searchParams.get('lon')  || '-77.5636';
      const dist = url.searchParams.get('dist') || '50';
      let lastErr;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          if (attempt > 1) await new Promise(r => setTimeout(r, 1500));
          const r = await fetch(
            `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${dist}`,
            { signal: AbortSignal.timeout(attempt === 1 ? 8000 : 7000) }
          );
          if (!r.ok) throw new Error(`adsb.lol HTTP ${r.status}`);
          return json(await r.json());
        } catch (e) {
          lastErr = e;
        }
      }
      return json({ error: lastErr.message, ac: [] }, 502);
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
