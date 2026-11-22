import { describe, expect, it, vi } from 'vitest';
import { allowed, browserUrls, handle, type Env } from '../../cloudflare/turn.ts';

const env: Env = { TURN_KEY_ID: 'key-id', TURN_KEY_API_TOKEN: 'secret-token' };
const cloudflare = {
  iceServers: [
    { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53'] },
    {
      urls: [
        'turn:turn.cloudflare.com:3478?transport=udp',
        'turn:turn.cloudflare.com:53?transport=udp',
        'turns:turn.cloudflare.com:443?transport=tcp',
      ],
      username: 'u',
      credential: 'c',
    },
  ],
};
const ask = (origin: string | null, method = 'GET') =>
  new Request('https://sonora-turn.example.workers.dev/', { method, headers: origin ? { Origin: origin } : {} });

describe('the TURN credentials Worker', () => {
  it('answers the app’s own site only', async () => {
    const fetchFn = vi.fn(async () => Response.json(cloudflare, { status: 201 }));
    const ok = await handle(ask('https://sonora-live.github.io'), env, fetchFn);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://sonora-live.github.io');
    expect(ok.headers.get('Cache-Control')).toBe('no-store');
    for (const o of ['https://evil.example', null]) {
      const r = await handle(ask(o), env, fetchFn);
      expect(r.status).toBe(403);
      expect(r.headers.get('Access-Control-Allow-Origin')).toBeNull();
    }
    // Cloudflare asked once, for the allowed one
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('asks Cloudflare for short-lived credentials with the secret key, which never reaches the page', async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      Response.json(cloudflare, { status: 201 }),
    );
    const r = await handle(ask('https://sonora-live.github.io'), env, fetchFn as typeof fetch);
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toBe('https://rtc.live.cloudflare.com/v1/turn/keys/key-id/credentials/generate-ice-servers');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer secret-token');
    expect(JSON.parse(String(init?.body))).toEqual({ ttl: 6 * 3600 });
    const text = await r.text();
    expect(text).not.toContain('secret-token');
    expect(text).not.toContain('key-id');
    // port 53 is blocked by browsers: left out
    expect(JSON.parse(text)).toEqual({
      iceServers: [
        { urls: ['stun:stun.cloudflare.com:3478'] },
        {
          urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'],
          username: 'u',
          credential: 'c',
        },
      ],
    });
  });

  it('lasts as configured, within Cloudflare’s limit', async () => {
    const fetchFn = vi.fn(async (_u: string | URL | Request, _i?: RequestInit) => Response.json(cloudflare));
    await handle(ask('https://sonora-live.github.io'), { ...env, TTL_SECONDS: '999999' }, fetchFn as typeof fetch);
    expect(JSON.parse(String(fetchFn.mock.calls[0][1]?.body))).toEqual({ ttl: 48 * 3600 });
  });

  it('fails plainly when Cloudflare does, or when the key is missing', async () => {
    const down = vi.fn(async () => new Response('no', { status: 401 }));
    expect((await handle(ask('https://sonora-live.github.io'), env, down)).status).toBe(502);
    const none = await handle(ask('https://sonora-live.github.io'), { TURN_KEY_ID: '', TURN_KEY_API_TOKEN: '' }, down);
    expect(none.status).toBe(500);
    expect((await handle(ask('https://sonora-live.github.io', 'POST'), env, down)).status).toBe(405);
  });

  it('allows listed origins exactly, and any port of localhost when asked', () => {
    expect(allowed('https://sonora-live.github.io', 'https://sonora-live.github.io')).toBe(true);
    expect(allowed('https://sonora-live.github.io.evil.example', 'https://sonora-live.github.io')).toBe(false);
    expect(allowed('http://localhost:5173', 'https://a.example, http://localhost:*')).toBe(true);
    expect(allowed('http://localhost.evil.example', 'http://localhost:*')).toBe(false);
    expect(browserUrls('turn:x:53')).toEqual([]);
  });
});
