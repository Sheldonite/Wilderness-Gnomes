import type { UpgradeId } from '../core/types';

const paths: Record<string, string> = {
  leaf: '<path d="M27 5C11 3 4 11 7 21c9 5 19-2 20-16Z"/><path d="m5 28 17-17M11 22v-8m5 3h7"/>',
  spell: '<path d="m19 3-12 16h9l-3 10 13-17h-9Z"/>',
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
  'projectile-damage': 'spell', 'fire-rate': 'clock', 'move-speed': 'boot',
  'max-health': 'heart', 'projectile-count': 'split', 'gain-companion-mystery': 'paw'
};
