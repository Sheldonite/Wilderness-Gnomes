export type MarketVendorId = 'forge' | 'apothecary' | 'outfitter' | 'curios';
export type MarketItemId =
  | 'embersteel-edge' | 'clockwork-trigger'
  | 'peach-heart' | 'springwater-flask'
  | 'trail-boots' | 'quilted-cloak'
  | 'splitshot-charm' | 'mooncat-bell'
  | 'unlock-crossbow' | 'unlock-hailey' | 'unlock-sheldon' | 'unlock-ron' | 'honey-glow' | 'violet-glow' | 'glitter-trail' | 'ups-buddy' | 'jawa-buddy';

export type CosmeticId = 'honey-glow' | 'violet-glow' | 'glitter-trail' | 'ups-buddy' | 'jawa-buddy';

export interface MarketVendor {
  id: MarketVendorId;
  name: string;
  keeper: string;
  tagline: string;
  greeting: string;
  accent: number;
}

export interface MarketItem {
  id: MarketItemId;
  vendorId: MarketVendorId;
  name: string;
  description: string;
  kind?: 'weapon' | 'character' | 'cosmetic';
  /** What each purchased rank adds to future runs. */
  effect: string;
  prices: readonly number[];
  maxRank: number;
  icon: 'blade' | 'gear' | 'peach' | 'flask' | 'boots' | 'cloak' | 'charm' | 'bell' | 'parcel';
  accent: number;
}

export const MARKET_VENDORS: readonly MarketVendor[] = [
  { id: 'forge', name: 'Weapons', keeper: 'Ellis', tagline: 'Arms & weapon improvements', greeting: 'Find your favorite way to take on the woods.', accent: 0xef9d64 },
  { id: 'outfitter', name: 'Cosmetics', keeper: 'Moss', tagline: 'Glows & personal style', greeting: 'A little sparkle, just for you.', accent: 0xd99abd },
  { id: 'apothecary', name: 'Upgrades', keeper: 'June', tagline: 'Permanent boosts', greeting: 'Grow stronger with every visit.', accent: 0x8bc7a8 },
  { id: 'curios', name: 'Staffing Company', keeper: 'Wren', tagline: 'Character unlocks', greeting: 'Good adventures start with good people.', accent: 0xa7b4eb }
];

export const MARKET_ITEMS: readonly MarketItem[] = [
  { id: 'unlock-crossbow', vendorId: 'forge', kind: 'weapon', name: 'Heartwood Crossbow', description: 'A new arm for either wanderer. Bolts pierce through enemies.', effect: 'Permanent weapon unlock.', prices: [15], maxRank: 1, icon: 'blade', accent: 0xef9d64 },
  { id: 'jawa-buddy', vendorId: 'outfitter', kind: 'cosmetic', name: 'Wandering Buddy', description: 'A tiny friend in a navy cloak, with glowing eyes and a cheerful little waddle.', effect: 'Follows either character. Looks only — no combat.', prices: [5], maxRank: 1, icon: 'cloak', accent: 0x6f8fb7 },
  { id: 'ups-buddy', vendorId: 'outfitter', kind: 'cosmetic', name: 'UPS Buddy', description: 'A cheerful little delivery box with tiny boots. Always happy to tag along.', effect: 'Follows either character. Just cute — no combat.', prices: [5], maxRank: 1, icon: 'parcel', accent: 0xdca36a },
  { id: 'honey-glow', vendorId: 'outfitter', kind: 'cosmetic', name: 'Honey Glow', description: 'A warm golden halo with little dancing sparks.', effect: 'Visual only. Equip on either character.', prices: [5], maxRank: 1, icon: 'charm', accent: 0xf6ce73 },
  { id: 'glitter-trail', vendorId: 'outfitter', kind: 'cosmetic', name: 'Glitter Trail', description: 'Leave a twinkling trail of gold, pink and lilac as you walk.', effect: 'Visual only. Equip on either character.', prices: [5], maxRank: 1, icon: 'charm', accent: 0xf3b5e6 },
  { id: 'violet-glow', vendorId: 'outfitter', kind: 'cosmetic', name: 'Violet Glow', description: 'A lavender halo with soft woodland sparkles.', effect: 'Visual only. Equip on either character.', prices: [5], maxRank: 1, icon: 'charm', accent: 0xc4a0ef },
  { id: 'unlock-ron', vendorId: 'curios', kind: 'character', name: 'Ron', description: 'A travelling bard whose ribbon staff sweeps foes aside. Tobias the flying tuna comes with him.', effect: 'Permanent character unlock. Uses either weapon.', prices: [50], maxRank: 1, icon: 'cloak', accent: 0x1e4a3e },
  { id: 'unlock-sheldon', vendorId: 'curios', kind: 'character', name: 'Sheldon', description: 'Always up for the next trail. Hire Sheldon for your adventures.', effect: 'Permanent character unlock. Uses either weapon.', prices: [50], maxRank: 1, icon: 'cloak', accent: 0xc7a86d },
  { id: 'unlock-hailey', vendorId: 'curios', kind: 'character', name: 'Hailey', description: 'An adventurous heart, ready to join your roster.', effect: 'Permanent character unlock. Uses either weapon.', prices: [50], maxRank: 1, icon: 'cloak', accent: 0xa7b4eb },
  { id: 'embersteel-edge', vendorId: 'forge', name: 'Embersteel Edge', description: 'A warm copper whetstone sharpens bolts and focuses spells.', effect: '+10% starting weapon damage per rank.', prices: [5, 10, 18], maxRank: 3, icon: 'blade', accent: 0xf6b36c },
  { id: 'clockwork-trigger', vendorId: 'forge', name: 'Clockwork Trigger', description: 'Tiny courthouse gears keep every shot ticking along.', effect: '5% shorter starting attack cooldown per rank.', prices: [7, 12, 20], maxRank: 3, icon: 'gear', accent: 0xe1bd72 },
  { id: 'peach-heart', vendorId: 'apothecary', name: 'Peach Heart', description: 'June\'s orchard preserves put a little sunshine in your heart.', effect: '+15 maximum and starting health per rank.', prices: [5, 9, 16], maxRank: 3, icon: 'peach', accent: 0xffa381 },
  { id: 'springwater-flask', vendorId: 'apothecary', name: 'Springwater Flask', description: 'A refillable tonic that gently mends you during adventures.', effect: 'Recover 1 health every 5 seconds per rank.', prices: [8, 14, 22], maxRank: 3, icon: 'flask', accent: 0x8edac8 },
  { id: 'trail-boots', vendorId: 'apothecary', name: 'Trail Boots', description: 'Soft soles and sturdy laces make the long way home shorter.', effect: '+5% starting movement speed per rank.', prices: [5, 9, 16], maxRank: 3, icon: 'boots', accent: 0xe0ad75 },
  { id: 'quilted-cloak', vendorId: 'apothecary', name: 'Quilted Cloak', description: 'A cozy patchwork cape takes the sting out of forest trouble.', effect: 'Take 5% less damage per rank.', prices: [7, 12, 20], maxRank: 3, icon: 'cloak', accent: 0x98bde4 },
  { id: 'splitshot-charm', vendorId: 'forge', name: 'Splitshot Charm', description: 'Two little shooting stars share one lucky silver chain.', effect: '+1 starting projectile. One special purchase.', prices: [20], maxRank: 1, icon: 'charm', accent: 0xe3c0fc },
  { id: 'mooncat-bell', vendorId: 'apothecary', name: 'Mooncat Bell', description: 'A violet bell makes Mystery\'s mighty pounces even stronger.', effect: '+15% Mystery damage per rank once recruited.', prices: [6, 11, 18], maxRank: 3, icon: 'bell', accent: 0xba91ef }
];

export function getMarketItem(id: string): MarketItem | undefined {
  return MARKET_ITEMS.find(item => item.id === id);
}

export function marketItemPrice(id: string, ownedRank: number): number | null {
  const item = getMarketItem(id);
  return item && Number.isInteger(ownedRank) && ownedRank >= 0 && ownedRank < item.maxRank
    ? item.prices[ownedRank] : null;
}

/** Exact cumulative effects for the shop's current and next-rank comparison. */
export function marketItemBenefit(id: string, ownedRank: number): string {
  const item = getMarketItem(id);
  if (!item) return '';
  const rank = Number.isFinite(ownedRank) ? Math.max(0, Math.min(item.maxRank, Math.floor(ownedRank))) : 0;
  switch (item.id) {
    case 'unlock-crossbow': return rank ? 'Crossbow available to equip here' : 'Crossbow locked';
    case 'unlock-sheldon': return rank ? 'Sheldon available on the home screen' : 'Sheldon locked';
    case 'unlock-ron': return rank ? 'Ron available on the home screen' : 'Ron locked';
    case 'unlock-hailey': return rank ? 'Hailey available on the home screen' : 'Hailey locked';
    case 'jawa-buddy': return rank ? 'Wandering Buddy available to equip' : 'Wandering Buddy not owned';
    case 'ups-buddy': return rank ? 'UPS Buddy available to equip' : 'UPS Buddy not owned';
    case 'glitter-trail': return rank ? 'Glitter trail available to equip' : 'Glitter trail not owned';
    case 'honey-glow': case 'violet-glow': return rank ? 'Glow available to equip' : 'Glow not owned';
    case 'embersteel-edge': return `+${rank * 10}% weapon damage`;
    case 'clockwork-trigger': return `${rank * 5}% shorter attack cooldown`;
    case 'peach-heart': return `+${rank * 15} starting & maximum health`;
    case 'springwater-flask': return `Heal ${rank} health every 5 seconds`;
    case 'trail-boots': return `+${rank * 5}% movement speed`;
    case 'quilted-cloak': return `${rank * 5}% less damage taken`;
    case 'splitshot-charm': return `+${rank} starting projectile`;
    case 'mooncat-bell': return `+${rank * 15}% Mystery pounce damage`;
  }
}
