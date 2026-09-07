import type { UpgradeId } from '../core/types';

const paths: Record<string, string> = {
  ricochet: '<path d="m4 26 8-15 10 10 6-17m-7 3 7-3 1 8"/><circle cx="12" cy="11" r="3"/><circle cx="22" cy="21" r="3"/>',
  firefly: '<ellipse cx="16" cy="20" rx="4" ry="8"/><path d="M13 16C-3-1 0 25 12 20m7-4C35-1 32 25 20 20M14 11l-3-5m7 5 3-5"/>',
  roots: '<path d="M16 3v16m0-9L8 5m8 8 8-6M16 19l-9 6-4 4m13-10 8 4 4 6m-12-10-1 10M8 5 6 11m18-4 3 5"/>',
  mushroom: '<path d="M3 18C3 0 29 0 29 18Zm10 0-2 11h10l-2-11"/><circle cx="10" cy="13" r="2"/><circle cx="19" cy="9" r="2"/><path d="m24 15 1 1"/>',
  acorn: '<path d="M8 15c-2 10 6 12 8 15 2-3 10-5 8-15M5 15c0-11 22-11 22 0Zm11-8V2m0 3 5-3M8 11l4 4m1-6 6 6m0-6 5 4"/>',
  shield: '<path d="m16 3 12 5-3 15-9 7-9-7L4 8Zm-6 17 5 3 8-11"/><path d="M13 17c-5-8 7-7 8-9 1 7-2 11-8 9Z"/>',
  magnet: '<path d="M7 7v11a9 9 0 0 0 18 0V7h-6v11a3 3 0 0 1-6 0V7ZM7 12h6m6 0h6M3 2l3 2m23-2-3 2"/>',
  pounce: '<path d="M3 24c4-20 17-20 26-7m-8-1 8 1-1-8"/><ellipse cx="19" cy="24" rx="5" ry="4"/><circle cx="12" cy="20" r="2"/><circle cx="18" cy="17" r="2"/><circle cx="24" cy="19" r="2"/>',
  leaf: '<path d="M27 5C11 3 4 11 7 21c9 5 19-2 20-16Z"/><path d="m5 28 17-17M11 22v-8m5 3h7"/>',
  spell: '<path d="m19 3-12 16h9l-3 10 13-17h-9Z"/>',
  crossbow: '<path d="M4 16h18m-6-8 8 8-8 8"/><path d="M22 8v16M6 12v8"/><path d="M4 16h8"/>',
  bolt: '<path d="m6 16 22-6-8 6 8 6Z"/><path d="M4 12v8l6-4Z"/>',
  clock: '<circle cx="16" cy="17" r="11"/><path d="M16 10v8l5 3M12 2h8"/>',
  boot: '<path d="M10 4h12l-3 14 7 4v6H5v-8l5-3Z"/><path d="M11 9h7m-8 5h7M5 24h21"/>',
  heart: '<path d="M16 28 4 16C-2 7 9 0 16 9 23 0 34 7 28 16Z"/>',
  split: '<path d="M16 28V15M16 18 6 8m10 10L26 8M3 13V5h8m10 0h8v8"/>',
  paw: '<ellipse cx="16" cy="23" rx="8" ry="6"/><ellipse cx="5" cy="14" rx="3" ry="4"/><ellipse cx="12" cy="7" rx="3" ry="4"/><ellipse cx="21" cy="7" rx="3" ry="4"/><ellipse cx="28" cy="14" rx="3" ry="4"/>',
  pause: '<path d="M11 6v20M21 6v20"/>',
  arrow: '<path d="M5 16h22m-8-8 8 8-8 8"/>',
  star: '<path d="m16 2 4 10 10 4-10 4-4 10-4-10-10-4 10-4Z"/>',
  cross: '<path d="m7 7 18 18M25 7 7 25"/>',
  diamond: '<path d="m16 2 10 14-10 14L6 16Zm0 0v28M6 16h20"/>'
};

export function icon(name: string): string {
  return `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.leaf}</svg>`;
}

export const UPGRADE_ICONS: Record<UpgradeId, string> = {
  'gain-companion-midnight': 'paw',
  'ricochet-charm': 'ricochet', 'firefly-orbit': 'firefly', 'bramble-snare': 'roots', 'spore-trail': 'mushroom',
  'acorn-shower': 'acorn', 'barkskin-ward': 'shield', 'woodland-magnet': 'magnet', 'mystery-double-pounce': 'pounce',
  'projectile-damage': 'spell', 'fire-rate': 'clock', 'move-speed': 'boot',
  'max-health': 'heart', 'projectile-count': 'split', 'gain-companion-mystery': 'paw'
};
