// Menu Planner API (Cloudflare Worker). Step 1: GET /scan?url=<recipe page>
const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 8000;
const UNITS = 'cups?|c|tablespoons?|tbsps?|tbs|teaspoons?|tsps?|pounds?|lbs?|ounces?|oz|fl oz|grams?|g|kilograms?|kg|ml|liters?|l|cloves?|cans?|packages?|pkgs?|sticks?|slices?|pinch|dash|bunch|sprigs?';
const FRAC = { '½': '1/2', '¼': '1/4', '¾': '3/4', '⅓': '1/3', '⅔': '2/3', '⅛': '1/8' };

const cors = (req, env) => {
  const o = req.headers.get('Origin') || '';
  const ok = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).includes(o);
  return { 'Access-Control-Allow-Origin': ok ? o : 'null', 'Access-Control-Allow-Methods': 'GET,OPTIONS', 'Vary': 'Origin' };
};
const json = (data, status, h) => new Response(JSON.stringify(data), { status, headers: { ...h, 'Content-Type': 'application/json' } });

function safeUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || /^[\d.]+$/.test(h) || h.includes(':')) return null; // no IP literals
  return u;
}

async function fetchPage(u) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(u.href, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MenuPlannerBot/1.0)', Accept: 'text/html' } });
    if (!res.ok) throw new Error('Site returned ' + res.status);
    if (!safeUrl(res.url)) throw new Error('Blocked redirect');
    const reader = res.body.getReader(); const dec = new TextDecoder(); let html = '', n = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; n += value.length; html += dec.decode(value, { stream: true }); if (n > MAX_BYTES) { ctl.abort(); break; } }
    return html;
  } finally { clearTimeout(t); }
}

const decode = s => String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;|&#34;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, c) => String.fromCharCode(c)).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function findRecipe(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n); if (r) return r; } return null; }
  const t = node['@type'];
  if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) return node;
  return findRecipe(node['@graph']);
}

function extractRecipe(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) { try { const r = findRecipe(JSON.parse(m[1].trim())); if (r) return r; } catch {} }
  return null;
}

function steps(x) {
  if (!x) return [];
  if (typeof x === 'string') return [decode(x)];
  if (Array.isArray(x)) return x.flatMap(steps);
  if (x.itemListElement) return steps(x.itemListElement);
  return x.text ? [decode(x.text)] : [];
}

// Fractions and long decimals become tidy decimals: 1/3 -> 0.33, 2 2/3 -> 2.67, 0.3333333 -> 0.33
const toNum = t => {
  const m = t.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
  const v = m ? (m[1] ? +m[1] : 0) + (+m[2]) / (+m[3]) : parseFloat(t);
  return String(Math.round(v * 100) / 100);
};
const tidyQty = q => q.replace(/\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?/g, toNum);

function parseIngredient(line) {
  let s = decode(line).replace(/[½¼¾⅓⅔⅛]/g, c => ' ' + FRAC[c]).replace(/\s+/g, ' ').trim();
  const q = s.match(new RegExp('^((?:\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d+(?:\\.\\d+)?)(?:\\s*(?:-|to)\\s*(?:\\d+/\\d+|\\d+(?:\\.\\d+)?))?)\\s*(?:(' + UNITS + ')\\b\\.?)?\\s*(?:of\\s+)?(.*)$', 'i'));
  if (!q || !q[3]) return { qty: '', name: s };
  return { qty: (tidyQty(q[1]) + (q[2] ? ' ' + q[2] : '')).trim(), name: q[3].trim() };
}


// ---- Kroger (Fred Meyer) prices ----
const KROGER = 'https://api.kroger.com/v1';
const DAY = 86400;

async function krogerToken(env) {
  const cached = await env.CACHE.get('token');
  if (cached) return cached;
  const res = await fetch(KROGER + '/connect/oauth2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(env.KROGER_ID + ':' + env.KROGER_SECRET), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&scope=product.compact',
  });
  if (!res.ok) throw new Error('Kroger auth failed');
  const d = await res.json();
  await env.CACHE.put('token', d.access_token, { expirationTtl: Math.max(60, (d.expires_in || 1800) - 120) });
  return d.access_token;
}

async function krogerGet(env, path) {
  const res = await fetch(KROGER + path, { headers: { Authorization: 'Bearer ' + (await krogerToken(env)), Accept: 'application/json' } });
  if (!res.ok) throw new Error('Kroger ' + res.status);
  return res.json();
}

async function findStores(env, zip) {
  // No chain filter (its exact value is unreliable); keep Fred Meyer stores by chain/name instead.
  const d = await krogerGet(env, '/locations?filter.zipCode.near=' + zip + '&filter.radiusInMiles=25&filter.limit=50');
  return (d.data || [])
    .filter(l => /fred/i.test((l.chain || '') + ' ' + (l.name || '')))
    .slice(0, 5)
    .map(l => ({ id: l.locationId, name: l.name, address: [l.address && l.address.addressLine1, l.address && l.address.city].filter(Boolean).join(', ') }));
}

// Package size -> comparable amount (weight in oz, volume in fl oz, or a count).
const WU = { lb: 16, lbs: 16, oz: 1, g: 0.03527, kg: 35.274 };
const VU = { 'fl oz': 1, gal: 128, qt: 32, pt: 16, l: 33.814, ml: 0.03381, liter: 33.814 };
const sizeAmt = t => {
  const m = String(t || '').toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(fl oz|[a-z]+)/);
  if (!m) return null;
  const n = parseFloat(m[1]), u = m[2];
  if (WU[u]) return { d: 'w', v: n * WU[u] };
  if (VU[u]) return { d: 'v', v: n * VU[u] };
  if (u === 'ct' || u === 'each') return { d: 'c', v: n };
  return null;
};

// Kroger's search has no sort-by-price option, so we pull the top matches and pick the cheapest per unit ourselves.
// Only the first 12 relevance-ranked results are considered, and only ones measured the same way as the top match.
// Prices are cached per store and ingredient for 24 hours, so they refresh daily.
async function findPrice(env, store, q) {
  const key = 'p2:' + store + ':' + q.toLowerCase();
  const hit = await env.CACHE.get(key, 'json');
  if (hit) return hit;
  const d = await krogerGet(env, '/products?filter.term=' + encodeURIComponent(q) + '&filter.locationId=' + store + '&filter.limit=15');
  const c = [];
  for (const p of (d.data || []).slice(0, 12)) {
    const it = (p.items || []).find(i => i.price && i.price.regular > 0);
    if (!it) continue;
    const price = it.price.promo > 0 ? it.price.promo : it.price.regular;
    const a = sizeAmt(it.size);
    c.push({ p, it, a, unit: a && a.v > 0 ? price / a.v : null });
  }
  let pick = c[0];
  if (pick && pick.a) {
    const same = c.filter(x => x.unit !== null && x.a.d === pick.a.d);
    pick = same.reduce((b, x) => (x.unit < b.unit ? x : b), same[0]);
  }
  const out = pick
    ? { price: { regular: pick.it.price.regular, promo: pick.it.price.promo > 0 ? pick.it.price.promo : null }, desc: pick.p.description, brand: pick.p.brand || '', size: pick.it.size || '' }
    : { price: null };
  await env.CACHE.put(key, JSON.stringify(out), { expirationTtl: DAY });
  return out;
}

// Per-IP rate limiting (Cloudflare Workers rate limiting bindings). Fails open if a binding is missing or errors.
async function limited(env, name, req) {
  const l = env[name];
  if (!l) return false;
  try {
    const ip = req.headers.get('CF-Connecting-IP') || 'anon';
    const { success } = await l.limit({ key: name + ':' + ip });
    return !success;
  } catch { return false; }
}
const tooMany = (h, msg) => json({ error: msg }, 429, { ...h, 'Retry-After': '60' });

export default {
  async fetch(req, env) {
    const h = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url);
    if (url.pathname === '/scan' && req.method === 'GET') {
      if (h['Access-Control-Allow-Origin'] === 'null') return json({ error: 'Origin not allowed' }, 403, h);
      if (await limited(env, 'SCAN_LIMITER', req)) return tooMany(h, 'Too many scans. Try again in a minute.');
      const target = safeUrl(url.searchParams.get('url') || '');
      if (!target) return json({ error: 'Enter a valid http(s) recipe link.' }, 400, h);
      try {
        const r = extractRecipe(await fetchPage(target));
        if (!r) return json({ error: 'No recipe data found on that page.' }, 422, h);
        const ings = (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : []).map(parseIngredient).filter(i => i.name);
        return json({ name: decode(r.name), ings, notes: steps(r.recipeInstructions).map((t, i) => (i + 1) + '. ' + t).join('\n'), source: target.href }, 200, h);
      } catch (e) { return json({ error: 'Could not read that page.' }, 502, h); }
    }
    if ((url.pathname === '/stores' || url.pathname === '/price') && req.method === 'GET') {
      if (h['Access-Control-Allow-Origin'] === 'null') return json({ error: 'Origin not allowed' }, 403, h);
      if (await limited(env, 'API_LIMITER', req)) return tooMany(h, 'Too many requests. Try again in a minute.');
      try {
        if (url.pathname === '/stores') {
          const zip = url.searchParams.get('zip') || '';
          if (!/^\d{5}$/.test(zip)) return json({ error: 'Enter a 5-digit ZIP.' }, 400, h);
          return json({ stores: await findStores(env, zip) }, 200, h);
        }
        const store = url.searchParams.get('store') || '', q = (url.searchParams.get('q') || '').trim();
        if (!/^\w{8}$/.test(store) || !q || q.length > 60) return json({ error: 'Bad request.' }, 400, h);
        return json(await findPrice(env, store, q), 200, h);
      } catch (e) { return json({ error: 'Price lookup unavailable.' }, 502, h); }
    }
    return json({ error: 'Not found' }, 404, h);
  },
};