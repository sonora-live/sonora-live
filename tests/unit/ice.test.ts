import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('ICE servers', () => {
  it('lists the fixed relay before the one from the credentials endpoint (browsers use the first that works)', async () => {
    vi.stubEnv(
      'VITE_TURN_URLS',
      'turn:free.relay.example:3478?transport=udp,turn:free.relay.example:3478?transport=tcp',
    );
    vi.stubEnv('VITE_TURN_USERNAME', 'u1');
    vi.stubEnv('VITE_TURN_CREDENTIAL', 'p1');
    vi.stubEnv('VITE_TURN_API', 'https://api.relay.example/credentials');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json([
          { urls: 'turn:fallback.relay.example:80', username: 'u2', credential: 'p2' },
          { urls: 'turns:fallback.relay.example:443?transport=tcp', username: 'u2', credential: 'p2' },
        ]),
      ),
    );
    const { iceServers } = await import('../../src/net/ice.ts');
    const list = await iceServers();
    const relays = list.flatMap((s) => [s.urls].flat()).filter((u) => /^turns?:/.test(u));
    expect(relays).toEqual([
      'turn:free.relay.example:3478?transport=udp',
      'turn:free.relay.example:3478?transport=tcp',
      'turn:fallback.relay.example:80',
      'turns:fallback.relay.example:443?transport=tcp',
    ]);
  });

  it('works with the endpoint alone, or with nothing (direct paths only)', async () => {
    vi.stubEnv('VITE_TURN_URLS', '');
    vi.stubEnv('VITE_TURN_API', '');
    const { iceServers } = await import('../../src/net/ice.ts');
    const list = await iceServers();
    expect(list.flatMap((s) => [s.urls].flat()).every((u) => u.startsWith('stun:'))).toBe(true);
  });
});
