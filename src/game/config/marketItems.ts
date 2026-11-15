export type MarketVendorId = 'forge' | 'apothecary' | 'outfitter' | 'curios';
export type MarketCurrency = 'gold' | 'rocks';
export type CosmeticSlot = 'aura' | 'trail' | 'buddy';
export type CosmeticId = 'honey-glow' | 'violet-glow' | 'glitter-trail' | 'ups-buddy' | 'jawa-buddy';
export type EquippedCosmetics = Record<CosmeticSlot, CosmeticId | null>;

export type MarketItemId =
  | 'embersteel-edge' | 'clockwork-trigger'
  | 'peach-heart' | 'springwater-flask'
  | 'trail-boots' | 'quilted-cloak'
  | 'splitshot-charm'
  | 'mooncat-bell' | 'midnight-collar' | 'frankie-whistle' | 'tobias-lure'
  | 'clover-charm' | 'wayfinder-stone'
  | 'unlock-crossbow' | 'unlock-boomerang' | 'unlock-lantern'
  | 'unlock-hailey' | 'unlock-sheldon' | 'unlock-ron'
  | CosmeticId;

export const COSMETIC_SLOTS: readonly CosmeticSlot[] = ['aura', 'trail', 'buddy'];

export const COSMETIC_SLOT_LABELS: Record<CosmeticSlot, string> = {
  aura: 'Aura',
  trail: 'Trail',
  buddy: 'Buddy'
};

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
  /** Slot for multi-slot cosmetics; omitted for non-cosmetics. */
  cosmeticSlot?: CosmeticSlot;
  /** Currency required to purchase ranks; defaults to `'gold'`. */
  currency?: MarketCurrency;
  /** What each purchased rank adds to future runs. */
  effect: string;
  prices: readonly number[];
  maxRank: number;
  icon: 'blade' | 'gear' | 'peach' | 'flask' | 'boots' | 'cloak' | 'charm' | 'bell' | 'parcel';
  accent: number;
}

export const MARKET_VENDORS: readonly MarketVendor[] = [
  { id: 'forge', name: 'Weapons', keeper: 'Ellis', tagline: 'Arms & weapon improvements', greeting: 'Find your favorite way to take on the woods.', accent: 0xef9d64 },
  { id: 'outfitter', name: 'Cosmetics', keeper: 'Moss', tagline: 'Glows, trails & buddies', greeting: 'Wear an aura, a trail, and a little friend all at once.', accent: 0xd99abd },
  { id: 'apothecary', name: 'Upgrades', keeper: 'June', tagline: 'Permanent boosts', greeting: 'Grow stronger with every visit.', accent: 0x8bc7a8 },
  { id: 'curios', name: 'Curios & Charms', keeper: 'Wren', tagline: 'Rare rocks & companion charms', greeting: 'Bring me rare rocks from the woods, or pick a charm for your companion.', accent: 0xa7b4eb }
];

export const MARKET_ITEMS: readonly MarketItem[] = [
  { id: 'unlock-crossbow', vendorId: 'forge', kind: 'weapon', name: 'Heartwood Crossbow', description: 'A new arm for any wanderer. Bolts pierce through enemies.', effect: 'Permanent weapon unlock.', prices: [15], maxRank: 1, icon: 'blade', accent: 0xef9d64 },
  { id: 'unlock-boomerang', vendorId: 'forge', kind: 'weapon', name: 'Timber Boomerang', description: 'A carved hickory arc that sweeps through packs and curves back to your hand.', effect: 'Permanent weapon unlock.', prices: [20], maxRank: 1, icon: 'blade', accent: 0xd8a862 },
  { id: 'unlock-lantern', vendorId: 'forge', kind: 'weapon', name: "Will-o'-Wisp Lantern", description: 'A warm woodland lantern launching embers that burst on impact.', effect: 'Permanent weapon unlock.', prices: [25], maxRank: 1, icon: 'charm', accent: 0xffb864 },
  { id: 'honey-glow', vendorId: 'outfitter', kind: 'cosmetic', cosmeticSlot: 'aura', name: 'Honey Glow', description: 'A warm golden halo with little dancing sparks.', effect: 'Aura slot · Visual only. Stacks with trail & buddy.', prices: [5], maxRank: 1, icon: 'charm', accent: 0xf6ce73 },
  { id: 'violet-glow', vendorId: 'outfitter', kind: 'cosmetic', cosmeticSlot: 'aura', name: 'Violet Glow', description: 'A lavender halo with soft woodland sparkles.', effect: 'Aura slot · Visual only. Stacks with trail & buddy.', prices: [5], maxRank: 1, icon: 'charm', accent: 0xc4a0ef },
  { id: 'glitter-trail', vendorId: 'outfitter', kind: 'cosmetic', cosmeticSlot: 'trail', name: 'Glitter Trail', description: 'Leave a twinkling trail of gold, pink and lilac as you walk.', effect: 'Trail slot · Visual only. Stacks with aura & buddy.', prices: [5], maxRank: 1, icon: 'charm', accent: 0xf3b5e6 },
  { id: 'jawa-buddy', vendorId: 'outfitter', kind: 'cosmetic', cosmeticSlot: 'buddy', name: 'Wandering Buddy', description: 'A tiny friend in a navy cloak, with glowing eyes and a cheerful little waddle.', effect: 'Buddy slot · Follows any wanderer. Looks only — no combat.', prices: [5], maxRank: 1, icon: 'cloak', accent: 0x6f8fb7 },
  { id: 'ups-buddy', vendorId: 'outfitter', kind: 'cosmetic', cosmeticSlot: 'buddy', name: 'UPS Buddy', description: 'A cheerful little delivery box with tiny boots. Always happy to tag along.', effect: 'Buddy slot · Follows any wanderer. Just cute — no combat.', prices: [5], maxRank: 1, icon: 'parcel', accent: 0xdca36a },
  { id: 'embersteel-edge', vendorId: 'forge', name: 'Embersteel Edge', description: 'A warm copper whetstone sharpens bolts and focuses spells.', effect: '+10% starting weapon damage per rank.', prices: [5, 10, 18], maxRank: 3, icon: 'blade', accent: 0xf6b36c },
  { id: 'clockwork-trigger', vendorId: 'forge', name: 'Clockwork Trigger', description: 'Tiny courthouse gears keep every shot ticking along.', effect: '5% shorter starting attack cooldown per rank.', prices: [7, 12, 20], maxRank: 3, icon: 'gear', accent: 0xe1bd72 },
  { id: 'splitshot-charm', vendorId: 'forge', name: 'Splitshot Charm', description: 'Two little shooting stars share one lucky silver chain.', effect: '+1 starting projectile. One special purchase.', prices: [20], maxRank: 1, icon: 'charm', accent: 0xe3c0fc },
  { id: 'peach-heart', vendorId: 'apothecary', name: 'Peach Heart', description: 'June\'s orchard preserves put a little sunshine in your heart.', effect: '+15 maximum and starting health per rank.', prices: [5, 9, 16], maxRank: 3, icon: 'peach', accent: 0xffa381 },
  { id: 'springwater-flask', vendorId: 'apothecary', name: 'Springwater Flask', description: 'A refillable tonic that gently mends you during adventures.', effect: 'Recover 1 health every 5 seconds per rank.', prices: [8, 14, 22], maxRank: 3, icon: 'flask', accent: 0x8edac8 },
  { id: 'trail-boots', vendorId: 'apothecary', name: 'Trail Boots', description: 'Soft soles and sturdy laces make the long way home shorter.', effect: '+5% starting movement speed per rank.', prices: [5, 9, 16], maxRank: 3, icon: 'boots', accent: 0xe0ad75 },
  { id: 'quilted-cloak', vendorId: 'apothecary', name: 'Quilted Cloak', description: 'A cozy patchwork cape takes the sting out of forest trouble.', effect: 'Take 5% less damage per rank.', prices: [7, 12, 20], maxRank: 3, icon: 'cloak', accent: 0x98bde4 },
  { id: 'clover-charm', vendorId: 'curios', currency: 'rocks', name: 'Clover Charm', description: 'A four-leaf clover pressed in river amber. Brings extra luck when choosing upgrades.', effect: '+1 upgrade reroll per run per rank.', prices: [1, 2], maxRank: 2, icon: 'charm', accent: 0x8ad18b },
  { id: 'wayfinder-stone', vendorId: 'curios', currency: 'rocks', name: 'Wayfinder Stone', description: 'A humming amethyst lodestone that draws gems closer and uncovers hidden chests.', effect: '+20% XP magnet radius & +5% chest drop luck per rank.', prices: [2, 3], maxRank: 2, icon: 'charm', accent: 0xc29af0 },
  { id: 'mooncat-bell', vendorId: 'curios', currency: 'gold', name: 'Mooncat Bell', description: 'A violet bell makes Mystery\'s mighty pounces even stronger.', effect: '+15% Mystery damage per rank.', prices: [6, 11, 18], maxRank: 3, icon: 'bell', accent: 0xba91ef },
  { id: 'midnight-collar', vendorId: 'curios', currency: 'gold', name: 'Midnight Collar', description: 'A silver-buckled collar that sharpens Midnight\'s sweeping swats.', effect: '+15% Midnight damage per rank.', prices: [6, 11, 18], maxRank: 3, icon: 'bell', accent: 0x8ea4e8 },
  { id: 'frankie-whistle', vendorId: 'curios', currency: 'gold', name: 'Frankie Whistle', description: 'A carved cedar bird call that rallies Sheldon\'s circling buzzards.', effect: '+15% Frankie damage per rank.', prices: [6, 11, 18], maxRank: 3, icon: 'bell', accent: 0xd9b36c },
  { id: 'tobias-lure', vendorId: 'curios', currency: 'gold', name: 'Tobias Lure', description: 'A shimmering brass lure that keeps Ron\'s flying tuna darting true.', effect: '+15% Tobias damage per rank.', prices: [6, 11, 18], maxRank: 3, icon: 'bell', accent: 0x76c7b7 },
  { id: 'unlock-ron', vendorId: 'curios', kind: 'character', name: 'Ron', description: 'A travelling bard whose ribbon staff sweeps foes aside. Tobias the flying tuna comes with him.', effect: 'On your roster from the start. Uses any weapon.', prices: [50], maxRank: 1, icon: 'cloak', accent: 0x1e4a3e },
  { id: 'unlock-sheldon', vendorId: 'curios', kind: 'character', name: 'Sheldon', description: 'Always up for the next trail. Frankie the buzzard circles above him.', effect: 'On your roster from the start. Uses any weapon.', prices: [50], maxRank: 1, icon: 'cloak', accent: 0xc7a86d },
  { id: 'unlock-hailey', vendorId: 'curios', kind: 'character', name: 'Hailey', description: 'An adventurous heart, with Midnight padding along beside her.', effect: 'On your roster from the start. Uses any weapon.', prices: [50], maxRank: 1, icon: 'cloak', accent: 0xa7b4eb }
];

export function getMarketItem(id: string): MarketItem | undefined {
  return MARKET_ITEMS.find(item => item.id === id);
}

export function marketItemCurrency(item: Pick<MarketItem, 'currency'>): MarketCurrency {
  return item.currency ?? 'gold';
}

export function getCosmeticSlot(id: string): CosmeticSlot | null {
  const item = getMarketItem(id);
  return item?.kind === 'cosmetic' ? (item.cosmeticSlot ?? null) : null;
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
    case 'unlock-boomerang': return rank ? 'Timber Boomerang available to equip here' : 'Timber Boomerang locked';
    case 'unlock-lantern': return rank ? "Will-o'-Wisp Lantern available to equip here" : "Will-o'-Wisp Lantern locked";
    case 'unlock-sheldon': return 'Sheldon is on the home screen';
    case 'unlock-ron': return 'Ron is on the home screen';
    case 'unlock-hailey': return 'Hailey is on the home screen';
    case 'jawa-buddy': return rank ? 'Wandering Buddy available to equip (Buddy slot)' : 'Wandering Buddy not owned';
    case 'ups-buddy': return rank ? 'UPS Buddy available to equip (Buddy slot)' : 'UPS Buddy not owned';
    case 'glitter-trail': return rank ? 'Glitter Trail available to equip (Trail slot)' : 'Glitter Trail not owned';
    case 'honey-glow': case 'violet-glow': return rank ? 'Glow available to equip (Aura slot)' : 'Glow not owned';
    case 'embersteel-edge': return `+${rank * 10}% weapon damage`;
    case 'clockwork-trigger': return `${rank * 5}% shorter attack cooldown`;
    case 'peach-heart': return `+${rank * 15} starting & maximum health`;
    case 'springwater-flask': return `Heal ${rank} health every 5 seconds`;
    case 'trail-boots': return `+${rank * 5}% movement speed`;
    case 'quilted-cloak': return `${rank * 5}% less damage taken`;
    case 'splitshot-charm': return `+${rank} starting projectile`;
    case 'clover-charm': return `+${rank} upgrade reroll${rank === 1 ? '' : 's'} per run`;
    case 'wayfinder-stone': return `+${rank * 20}% magnet radius, +${rank * 5}% chest luck`;
    case 'mooncat-bell': return `+${rank * 15}% Mystery pounce damage`;
    case 'midnight-collar': return `+${rank * 15}% Midnight swat damage`;
    case 'frankie-whistle': return `+${rank * 15}% Frankie stoop damage`;
    case 'tobias-lure': return `+${rank * 15}% Tobias dart damage`;
  }
}
