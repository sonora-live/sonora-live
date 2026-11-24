import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasBuiltInTurn, iceServers } from '../../src/net/ice.ts';
import { NO_TURN, scramble, unscramble } from '../../src/net/scramble.ts';

afterEach(() => vi.unstubAllGlobals());

const built = {
  urls: 'turn:free.relay.example:3478?transport=udp,turn:free.relay.example:3478?transport=tcp',
  username: 'u1',
  credential: 'p1-secret-password',
  api: 'https://api.relay.example/credentials?apiKey=k-secret-key',
};

describe('ICE servers', () => {
  it('lists the fixed relay before the one from the credentials endpoint (browsers use the first that works)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json([
          { urls: 'turn:fallback.relay.example:80', username: 'u2', credential: 'p2' },
          { urls: 'turns:fallback.relay.example:443?transport=tcp', username: 'u2', credential: 'p2' },
        ]),
      ),
    );
    const list = await iceServers(null, built);
    const relays = list.flatMap((s) => [s.urls].flat()).filter((u) => /^turns?:/.test(u));
    expect(relays).toEqual([
      'turn:free.relay.example:3478?transport=udp',
      'turn:free.relay.example:3478?transport=tcp',
      'turn:fallback.relay.example:80',
      'turns:fallback.relay.example:443?transport=tcp',
    ]);
    expect(list.find((s) => [s.urls].flat().some((u) => u.includes('free.relay')))).toMatchObject({
      username: 'u1',
      credential: 'p1-secret-password',
    });
    expect(hasBuiltInTurn(built)).toBe(true);
  });

  it('works with nothing built in (direct paths only)', async () => {
    const list = await iceServers(null, NO_TURN);
    expect(list.flatMap((s) => [s.urls].flat()).every((u) => u.startsWith('stun:'))).toBe(true);
    expect(hasBuiltInTurn(NO_TURN)).toBe(false);
  });
});

describe('the built-in relay settings, scrambled', () => {
  const key = (n: number) => Uint8Array.from({ length: 24 }, (_, i) => (i * 37 + n) & 255);

  it('come back exactly, and nothing of them reads in the page', () => {
    const s = scramble(built, key(1));
    expect(unscramble(s)).toEqual(built);
    for (const plain of ['turn:', 'relay', 'secret', 'apiKey', 'p1-', 'u1', 'https']) expect(s).not.toContain(plain);
  });

  it('look different with every build (a new key each time)', () => {
    expect(scramble(built, key(1))).not.toBe(scramble(built, key(2)));
    expect(unscramble(scramble(built, key(2)))).toEqual(built);
  });

  it('give nothing (no relay) when absent or damaged', () => {
    expect(scramble(NO_TURN, key(1))).toBe('');
    expect(unscramble('')).toEqual(NO_TURN);
    expect(unscramble('abc~def')).toEqual(NO_TURN);
    expect(unscramble('not scrambled at all')).toEqual(NO_TURN);
  });
});
