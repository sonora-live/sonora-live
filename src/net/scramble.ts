// The built-in relay settings, scrambled in the published page (vite.config.ts writes them, src/net/ice.ts reads
// them). Not encryption: the browser must hand the real password to WebRTC, where anyone can see it (Chrome's
// chrome://webrtc-internals). It only keeps the password and the API key out of plain text, so that scripts that
// search public JavaScript for relay credentials do not find them. The key changes with every build.

export interface BuiltInTurn {
  urls: string;
  username: string;
  credential: string;
  api: string;
}

export const NO_TURN: BuiltInTurn = { urls: '', username: '', credential: '', api: '' };

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const t = atob(s);
  const out = new Uint8Array(t.length);
  for (let i = 0; i < t.length; i++) out[i] = t.charCodeAt(i);
  return out;
}

/** Each byte mixed with the key and with the byte before it (no repeating pattern to spot). */
function mix(data: Uint8Array, key: Uint8Array, undo: boolean): Uint8Array {
  const out = new Uint8Array(data.length);
  let prev = key.length;
  for (let i = 0; i < data.length; i++) {
    const k = (key[i % key.length] + prev * 31 + i * 7) & 255;
    out[i] = data[i] ^ k;
    prev = undo ? out[i] : data[i];
  }
  return out;
}

/** Build time: the settings as one opaque string (`key` random, 16 bytes or more). */
export function scramble(t: BuiltInTurn, key: Uint8Array): string {
  if (!t.urls && !t.api) return '';
  const body = enc.encode(JSON.stringify([t.urls, t.username, t.credential, t.api]));
  return `${toB64(key)}~${toB64(mix(body, key, false))}`;
}

/** In the page: the settings back (none, or nothing usable: no relay built in). */
export function unscramble(s: string): BuiltInTurn {
  try {
    const [k, d] = s.split('~');
    if (!k || !d) return NO_TURN;
    const v = JSON.parse(dec.decode(mix(fromB64(d), fromB64(k), true))) as unknown;
    if (!Array.isArray(v) || v.length !== 4 || !v.every((x) => typeof x === 'string')) return NO_TURN;
    const [urls, username, credential, api] = v as string[];
    return { urls, username, credential, api };
  } catch {
    return NO_TURN;
  }
}
