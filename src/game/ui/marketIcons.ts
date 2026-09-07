import type { MarketItem } from '../config/marketItems';

const wares: Record<MarketItem['icon'], string> = {
  parcel: '<path d="m6 10 25-5 11 8v23l-25 6L6 32Zm0 0 11 9 25-6M17 19v23M18 8l11 8v7M15 38v7h-5m23-7v7h5"/><circle cx="24" cy="26" r="1"/><circle cx="35" cy="24" r="1"/><path d="M26 31q4 4 8-2"/>',
  blade: '<path d="m13 28 12-12 7-3 11-11-3 11-13 13-7 2M9 24l15 15M5 39l9-9 5 5-9 9Z"/>',
  gear: '<path d="m18 3 2 6 8 0 2-6 7 4-3 6 4 7 7 0v8l-7 1-4 7 3 5-7 4-3-6h-7l-3 6-7-4 3-5-4-7-6-1v-8l6-1 4-7-3-5Z"/><circle cx="24" cy="24" r="8"/>',
  peach: '<path d="M24 14C10 4 0 17 8 32c4 9 11 14 16 11 5 3 14-4 18-13 5-13-5-22-18-16Zm0 0c-6 8 1 20 0 29M24 14V5c7-6 15-3 14 0-4 5-9 7-14 5"/>',
  flask: '<path d="M18 4h12m-10 0v13L9 34c-4 7 1 10 6 10h19c6 0 7-5 4-10L28 17V4M14 30c9-6 13 5 21 0"/><path d="m20 12 8 0"/><circle cx="20" cy="34" r="2"/>',
  boots: '<path d="M17 5h21l-4 22 9 7v9H7V30l10-7Zm2 8h13m-14 7h12M8 38h35M17 23l8 5-4 8"/>',
  cloak: '<path d="M14 11c0-14 20-14 20 0l11 29c-14 7-28 7-42 0Zm0 0 10 10 10-10M24 21v23M7 32l10-5 7 8 8-8 9 5"/><circle cx="24" cy="18" r="2"/>',
  charm: '<path d="M12 3C-3 12 9 29 24 29S51 12 36 3M16 25l3 7 8 1-6 5 1 8-7-4-7 4 1-8-6-5 9-1ZM33 16l3 5 6 1-4 4 1 6-6-3-5 3 1-6-5-4 6-1Z"/>',
  bell: '<path d="M13 31V19c0-16 22-16 22 0v12l6 6H7Zm5 6c0 11 12 11 12 0M22 5V2h4v3"/><path d="m7 9-4-5m38 5 4-5M4 17H0m48 0h-4"/>'
};
export function marketItemIcon(name: MarketItem['icon']): string {
  return `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${wares[name]}</svg>`;
}
