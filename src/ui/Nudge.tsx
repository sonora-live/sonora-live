// How much later than its reference this side hears the track or the metronome, and a by-ear adjustment of it:
// when the person it is in time with still sounds ahead of the clicks here, or behind them (an unusual device, a
// singer who sings ahead of the beat), this listener moves them, for that person, and it is kept.

import { session } from '../app/session.ts';
import { settings, update } from '../app/settings.ts';
import { MAX_NUDGE_MS, NUDGE_STEP_MS } from '../app/sync.ts';
import { t } from '../app/i18n.ts';

export function InTimeHere({ delay, refId }: { delay: number; refId: string }) {
  const name = session.peers.value.find((p) => p.id === refId)?.info.name;
  if (!name || delay <= 0) return null;
  const cur = settings.value.nudge[name] ?? 0;
  const set = (v: number) => {
    const next = { ...settings.peek().nudge };
    const ms = Math.max(-MAX_NUDGE_MS, Math.min(MAX_NUDGE_MS, Math.round(v)));
    if (ms) next[name] = ms;
    else delete next[name];
    update({ nudge: next });
  };
  return (
    <span
      class="nudge"
      data-testid="nudge"
      title={t(
        '{name} still sounds behind the clicks and the track here? Press + to play them later. Ahead? Press −. Kept for {name}.',
        { name },
      )}
    >
      <small class="muted">{t('+{ms} ms here', { ms: delay })}</small>
      <button
        type="button"
        class="nudge-btn"
        aria-label={t('Earlier here')}
        disabled={cur <= -MAX_NUDGE_MS}
        onClick={() => set(cur - NUDGE_STEP_MS)}
      >
        −
      </button>
      {cur !== 0 && (
        <button
          type="button"
          class="nudge-val"
          onClick={() => set(0)}
          title={t('Set by ear: back to what was worked out')}
          data-testid="nudge-val"
        >
          {cur > 0 ? `+${cur}` : cur}
        </button>
      )}
      <button
        type="button"
        class="nudge-btn"
        aria-label={t('Later here')}
        disabled={cur >= MAX_NUDGE_MS}
        onClick={() => set(cur + NUDGE_STEP_MS)}
      >
        +
      </button>
    </span>
  );
}
