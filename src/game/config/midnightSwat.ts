import { BALANCE } from './balance';

export function midnightSwatPower(rank: number) {
  const r = Math.max(0, Math.min(10, Math.floor(rank)));
  return {
    damage: BALANCE.companion.midnightDamage + r * 16,
    range: BALANCE.companion.midnightSwatRange + r * 3,
    cooldownMs: BALANCE.companion.midnightCooldownMs - r * 25,
    arcDegrees: r >= 10 ? 360 : r >= 5 ? 180 : 120
  };
}

export function describeMidnightSwat(rank: number): string {
  const p = midnightSwatPower(rank);
  return `${p.damage} swat damage · ${p.range} reach · ${(p.cooldownMs / 1000).toFixed(3).replace(/0+$/, '')}s cooldown.${rank >= 10 ? ' Hits all around her.' : rank >= 5 ? ' Sweeps a wider arc.' : ''}`;
}
