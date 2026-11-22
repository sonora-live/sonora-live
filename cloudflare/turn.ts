// The TURN relay's credentials, from Cloudflare Realtime TURN, for the app (VITE_TURN_API points here).
//
// A Cloudflare Worker: it holds the long-term TURN key (as Worker secrets, set with `wrangler secret put`, never in
// this repository) and gives each lesson page short-lived credentials, only when asked from the app's own site.
// The relay is used only when two browsers cannot reach each other directly; it then carries the whole lesson
// (sound and picture), so it must not be open to anyone who reads the page's code.
//
//   GET /  →  { "iceServers": [ { "urls": [...], "username": "…", "credential": "…" } ] }
//
// Secrets:   TURN_KEY_ID, TURN_KEY_API_TOKEN   (Cloudflare dashboard → Realtime → TURN Server → create a key)
// Variables: ALLOWED_ORIGINS (comma separated; default https://sonora-live.github.io), TTL_SECONDS (default 6 h)

export interface Env {
  TURN_KEY_ID: string;
  TURN_KEY_API_TOKEN: string;
  ALLOWED_ORIGINS?: string;
  TTL_SECONDS?: string;
}

const DEFAULT_ORIGINS = 'https://sonora-live.github.io';
/** longer than a lesson (a credential that expires cuts a relayed lesson), short enough to be worth little if copied */
const DEFAULT_TTL = 6 * 3600;
/** Cloudflare's own limit */
const MAX_TTL = 48 * 3600;

/** Origins allowed to ask (exact match; `http://localhost:*` allows any local port, for development). */
export function allowed(origin: string | null, list: string): boolean {
  if (!origin) return false;
  return list
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .some((o) => (o.endsWith(':*') ? origin.startsWith(o.slice(0, -1)) && /:\d+$/.test(origin) : origin === o));
}

/** Port 53 is blocked by browsers (Cloudflare's note): a URL on it would only time out. */
export function browserUrls(urls: string | string[]): string[] {
  return [urls].flat().filter((u) => !/:53(\?|$)/.test(u));
}

export async function handle(req: Request, env: Env, fetchFn: typeof fetch = fetch): Promise<Response> {
  const origin = req.headers.get('Origin');
  const ok = allowed(origin, env.ALLOWED_ORIGINS || DEFAULT_ORIGINS);
  const cors: Record<string, string> = ok
    ? { 'Access-Control-Allow-Origin': origin!, 'Access-Control-Allow-Methods': 'GET', Vary: 'Origin' }
    : { Vary: 'Origin' };
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors },
    });
  if (req.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers: cors });
  if (!ok) return json(403, { error: 'origin not allowed' });
  if (req.method !== 'GET') return json(405, { error: 'GET only' });
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return json(500, { error: 'TURN key not configured' });
  const ttl = Math.min(MAX_TTL, Math.max(600, Number(env.TTL_SECONDS) || DEFAULT_TTL));
  let r: Response;
  try {
    r = await fetchFn(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.TURN_KEY_ID)}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl }),
      },
    );
  } catch {
    return json(502, { error: 'TURN service unreachable' });
  }
  if (!r.ok) return json(502, { error: `TURN service answered ${r.status}` });
  const data = (await r.json().catch(() => null)) as { iceServers?: RTCIceServer[] } | null;
  const list = Array.isArray(data?.iceServers) ? data.iceServers : [];
  const iceServers = list.map((s) => ({ ...s, urls: browserUrls(s.urls) })).filter((s) => s.urls.length > 0);
  return json(200, { iceServers });
}

export default { fetch: (req: Request, env: Env) => handle(req, env) };
