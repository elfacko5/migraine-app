// "Try now" on a paused sync (2026-11-26). Each sync-aware hook already
// re-syncs on focus and visibility; this is one more trigger they all listen
// for, so a single tap retries attacks, lists, medicines and HIT-6 together
// without the screen having to reach into four hooks.
export const SYNC_NOW_EVENT = 'lidd:sync-now';

export function requestSync() {
  window.dispatchEvent(new Event(SYNC_NOW_EVENT));
}
