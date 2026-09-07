import type {} from './desktop.d';

/**
 * Desktop save persistence. localStorage already lives in the app's user-data folder, which
 * the installer leaves alone during updates, but a plain JSON copy beside it guards against a
 * cleared web store and makes progress easy to back up or move between machines.
 * This module runs before any game module reads localStorage, so restored values are visible
 * to the very first read.
 */
const SAVE_PREFIX = 'wilderness-gnomes';
const desktop = typeof window !== 'undefined' ? window.desktop : undefined;

function snapshot(): Record<string, string> {
  const entries: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(SAVE_PREFIX)) entries[key] = localStorage.getItem(key) ?? '';
  }
  return entries;
}

export function restoreDesktopSaves(): void {
  if (!desktop) return;
  try {
    for (const [key, value] of Object.entries(desktop.loadSaves())) {
      if (key.startsWith(SAVE_PREFIX) && typeof value === 'string' && localStorage.getItem(key) === null) localStorage.setItem(key, value);
    }
  } catch { /* fall back to whatever localStorage holds */ }
}

export function mirrorDesktopSaves(): void {
  if (!desktop) return;
  let last = '';
  const flush = () => {
    try {
      const entries = snapshot(), serialized = JSON.stringify(entries);
      if (serialized === last || !Object.keys(entries).length) return;
      last = serialized;
      void desktop.storeSaves(entries);
    } catch { /* storage unavailable */ }
  };
  setInterval(flush, 3000);
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  flush();
}

restoreDesktopSaves();
