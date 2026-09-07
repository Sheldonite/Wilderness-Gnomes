export type MarketVendorId = 'forge' | 'apothecary' | 'outfitter' | 'curios';
export type MarketItemId =
  | 'embersteel-edge' | 'clockwork-trigger'
  | 'peach-heart' | 'springwater-flask'
  | 'trail-boots' | 'quilted-cloak'
  | 'splitshot-charm' | 'mooncat-bell';

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
  /** What each purchased rank adds to future runs. */
  effect: string;
  prices: readonly number[];
  maxRank: number;
  icon: 'blade' | 'gear' | 'peach' | 'flask' | 'boots' | 'cloak' | 'charm' | 'bell';
  accent: number;
}

export const MARKET_VENDORS: readonly MarketVendor[] = [
  { id: 'forge', name: 'Ember & Anvil', keeper: 'Ellis', tagline: 'Hand-forged tools for brave little wanderers.', greeting: 'A little town steel goes a long way in the woods.', accent: 0xef9d64 },
  { id: 'apothecary', name: 'Peach & Petal', keeper: 'June', tagline: 'Orchard remedies and fresh spring tonics.', greeting: 'Take a sip, take a breath. There is always another adventure.', accent: 0xe7a6a2 },
  { id: 'outfitter', name: 'The Wandering Stitch', keeper: 'Moss', tagline: 'Comfortable stitches for winding forest trails.', greeting: 'Every stitch is a little promise to bring you home.', accent: 0x8bc7a8 },
  { id: 'curios', name: 'Moonlight Curios', keeper: 'Wren', tagline: 'Small oddities with wonderfully big surprises.', greeting: 'The square is full of stories. These carry a little magic.', accent: 0xc5a0ed }
];

export const MARKET_ITEMS: readonly MarketItem[] = [
  { id: 'embersteel-edge', vendorId: 'forge', name: 'Embersteel Edge', description: 'A warm copper whetstone sharpens bolts and focuses spells.', effect: '+10% starting weapon damage per rank.', prices: [5, 10, 18], maxRank: 3, icon: 'blade', accent: 0xf6b36c },
  { id: 'clockwork-trigger', vendorId: 'forge', name: 'Clockwork Trigger', description: 'Tiny courthouse gears keep every shot ticking along.', effect: '5% shorter starting attack cooldown per rank.', prices: [7, 12, 20], maxRank: 3, icon: 'gear', accent: 0xe1bd72 },
  { id: 'peach-heart', vendorId: 'apothecary', name: 'Peach Heart', description: 'June\'s orchard preserves put a little sunshine in your heart.', effect: '+15 maximum and starting health per rank.', prices: [5, 9, 16], maxRank: 3, icon: 'peach', accent: 0xffa381 },
  { id: 'springwater-flask', vendorId: 'apothecary', name: 'Springwater Flask', description: 'A refillable tonic that gently mends you during adventures.', effect: 'Recover 1 health every 5 seconds per rank.', prices: [8, 14, 22], maxRank: 3, icon: 'flask', accent: 0x8edac8 },
  { id: 'trail-boots', vendorId: 'outfitter', name: 'Trail Boots', description: 'Soft soles and sturdy laces make the long way home shorter.', effect: '+5% starting movement speed per rank.', prices: [5, 9, 16], maxRank: 3, icon: 'boots', accent: 0xe0ad75 },
  { id: 'quilted-cloak', vendorId: 'outfitter', name: 'Quilted Cloak', description: 'A cozy patchwork cape takes the sting out of forest trouble.', effect: 'Take 5% less damage per rank.', prices: [7, 12, 20], maxRank: 3, icon: 'cloak', accent: 0x98bde4 },
  { id: 'splitshot-charm', vendorId: 'curios', name: 'Splitshot Charm', description: 'Two little shooting stars share one lucky silver chain.', effect: '+1 starting projectile. One special purchase.', prices: [20], maxRank: 1, icon: 'charm', accent: 0xe3c0fc },
  { id: 'mooncat-bell', vendorId: 'curios', name: 'Mooncat Bell', description: 'A violet bell makes Mystery\'s mighty pounces even stronger.', effect: '+15% Mystery damage per rank once recruited.', prices: [6, 11, 18], maxRank: 3, icon: 'bell', accent: 0xba91ef }
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
