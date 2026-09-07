import type { WeaponId } from '../core/types';

export type ExtraTargetMode = 'bounce' | 'pierce';

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  description: string;
  shortTrait: string;
  key: string;
  icon: string;
  extraTargetMode: ExtraTargetMode;
  extraTargetRetention: number;
  baseExtraTargets: number;
  cooldownMs: number;
  projectileSpeed: number;
  projectileDamage: number;
  projectileLifetimeMs: number;
  projectileRadius: number;
  projectileCount: number;
  spreadRadians: number;
  texture: string;
  displaySize: number;
  trailColor: number;
  armTexture?: string;
  overlayTexture?: string;
  overlayOrigin?: { x: number; y: number };
  overlayWidth?: number;
  muzzleOffset?: number;
}

export const WEAPON_IDS: WeaponId[] = ['spell', 'crossbow'];

export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
  spell: {
    id: 'spell',
    name: 'Spell Charm',
    description: 'A spark of woodland magic.',
    shortTrait: 'spell bolts',
    key: '3',
    icon: 'spell',
    extraTargetMode: 'bounce',
    extraTargetRetention: 0.7,
    baseExtraTargets: 0,
    cooldownMs: 850,
    projectileSpeed: 560,
    projectileDamage: 18,
    projectileLifetimeMs: 1250,
    projectileRadius: 7,
    projectileCount: 1,
    spreadRadians: 0.22,
    texture: 'spell-bolt',
    displaySize: 30,
    trailColor: 0x83e4f5
  },
  crossbow: {
    id: 'crossbow',
    name: 'Heartwood Crossbow',
    description: 'Stout quarrels punch through the pack.',
    shortTrait: 'piercing quarrels',
    key: '4',
    icon: 'crossbow',
    extraTargetMode: 'pierce',
    extraTargetRetention: 0.8,
    baseExtraTargets: 1,
    cooldownMs: 1150,
    projectileSpeed: 760,
    projectileDamage: 28,
    projectileLifetimeMs: 1550,
    projectileRadius: 8,
    projectileCount: 1,
    spreadRadians: 0.14,
    texture: 'crossbow-bolt',
    displaySize: 38,
    trailColor: 0xd5a35c,
    armTexture: 'heartwood-crossbow',
    overlayTexture: 'heartwood-crossbow-top',
    overlayOrigin: { x: 0.39, y: 0.5 },
    overlayWidth: 46,
    muzzleOffset: 30
  }
};

export function getWeapon(id?: string): WeaponDefinition {
  return id === 'crossbow' ? WEAPONS.crossbow : WEAPONS.spell;
}

export const CROSSBOW_STAT_UPGRADES: Partial<Record<string, { title: string; description: string; icon: string }>> = {
  'projectile-damage': { title: 'Honed Quarrels', description: '+8 quarrel damage', icon: 'bolt' },
  'fire-rate': { title: 'Swift String', description: 'Loose 15% faster', icon: 'clock' },
  'projectile-count': { title: 'Twin Quarrels', description: '+1 quarrel per volley', icon: 'split' }
};
