import type { UpgradeId } from '../core/types';

const paths: Record<string, string> = {
  rock: '<path d="m3 22 3-12 10-7 11 8 3 12-10 6-12-1Z" fill="#6e568d" stroke="#d8bdff"/><path d="m6 10 10-7 2 15Z" fill="#b89adc" stroke="none"/><path d="m16 3 11 8-9 7Z" fill="#9170b5" stroke="none"/><path d="m7 21 11-3 4 7" stroke="#eadbff"/>',
  gold: '<ellipse cx="16" cy="16" rx="11" ry="13"/><ellipse cx="16" cy="16" rx="7" ry="10"/><path d="M19 10h-5l-2 6h7l-2 6h-5m4-14v16"/>',
  market: '<path d="M4 14v14h24V14M2 13l4-9h20l4 9M2 13c0 5 7 5 7 0 0 5 7 5 7 0 0 5 7 5 7 0 0 5 7 5 7 0M11 28V18h10v10"/>',
  crownfire: '<path d="m3 14 7 5 6-8 6 8 7-5-3 14H6ZM12 9c-3-5 3-6 4-9 1 4 7 5 4 9"/>',
  stormcall: '<path d="M7 13C0 12 3 4 9 6 10-2 23 1 23 6c9-1 11 9 3 10H9m8-5-7 11h8l-4 9 12-14h-9Z"/>',
  phoenix: '<path d="M16 28C4 25 1 15 3 6l9 10-2-13 6 8 6-8-2 13L29 6c2 9-1 19-13 22ZM16 16v8m-4-4h8"/>',
  chest: '<path d="M4 15V9a5 5 0 0 1 5-5h14a5 5 0 0 1 5 5v19H4Zm0 0h24M9 4v24M23 4v24"/><path d="M13 13h6v7h-6Zm3 3v2"/>',
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
  buzzard: '<path d="M4 18c6-8 10-6 12-2 2-4 6-6 12-2"/><path d="M16 16c2 4 1 8-2 12m2-12c2 5 6 8 10 8"/><path d="M14 14 8 10m8 4 4-6"/>',
  pause: '<path d="M11 6v20M21 6v20"/>',
  ribbon: '<path d="M3 24c6-2 8-8 14-10s10 2 12-4"/><path d="M4 17c5 0 8-4 13-5s10 3 11-3"/><path d="m26 6 3 3-3 3-3-3Z"/>',
  shout: '<path d="M6 13h5l7-6v18l-7-6H6Z"/><path d="M22 10c3 3 3 9 0 12m4-16c5 5 5 15 0 20"/>',
  spin: '<path d="M16 5a11 11 0 1 1-9 4.6"/><path d="M6 3v7h7"/><path d="M16 11v10m-5-5h10"/>',
  fish: '<path d="M3 16c5-7 12-9 18-6 3 1.5 5 4 8 6-3 2-5 4.5-8 6-6 3-13 1-18-6Z"/><path d="m29 16 3-6v12Z"/><circle cx="9" cy="14" r="1.4"/>',
  arrow: '<path d="M5 16h22m-8-8 8 8-8 8"/>',
  star: '<path d="m16 2 4 10 10 4-10 4-4 10-4-10-10-4 10-4Z"/>',
  cross: '<path d="m7 7 18 18M25 7 7 25"/>',
  diamond: '<path d="m16 2 10 14-10 14L6 16Zm0 0v28M6 16h20"/>'
};

export function icon(name: string): string {
  return `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.leaf}</svg>`;
}

export const UPGRADE_ICONS: Record<UpgradeId, string> = {
  crownfire: 'crownfire', stormcall: 'stormcall', 'phoenix-heart': 'phoenix',
  'midnight-mighty-swat': 'paw',
  'ricochet-charm': 'ricochet', 'firefly-orbit': 'firefly', 'bramble-snare': 'roots', 'spore-trail': 'mushroom',
  'acorn-shower': 'acorn', 'barkskin-ward': 'shield', 'woodland-magnet': 'magnet', 'mystery-double-pounce': 'pounce',
  'projectile-damage': 'spell', 'fire-rate': 'clock', 'move-speed': 'boot',
  'max-health': 'heart', 'projectile-count': 'split',
  'ribbon-sweep': 'ribbon', 'inspiring-shout': 'shout', 'dizzying-flurry': 'spin'
};
