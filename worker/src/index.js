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

export default {
  async fetch(req, env) {
    const h = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url);
    if (url.pathname === '/scan' && req.method === 'GET') {
      if (h['Access-Control-Allow-Origin'] === 'null') return json({ error: 'Origin not allowed' }, 403, h);
      const target = safeUrl(url.searchParams.get('url') || '');
      if (!target) return json({ error: 'Enter a valid http(s) recipe link.' }, 400, h);
      try {
        const r = extractRecipe(await fetchPage(target));
        if (!r) return json({ error: 'No recipe data found on that page.' }, 422, h);
        const ings = (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : []).map(parseIngredient).filter(i => i.name);
        return json({ name: decode(r.name), ings, notes: steps(r.recipeInstructions).map((t, i) => (i + 1) + '. ' + t).join('\n'), source: target.href }, 200, h);
      } catch (e) { return json({ error: 'Could not read that page.' }, 502, h); }
    }
    return json({ error: 'Not found' }, 404, h);
  },
};