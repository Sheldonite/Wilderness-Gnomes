import type { WeaponId } from './types';
import {
  COSMETIC_SLOTS,
  getCosmeticSlot,
  getMarketItem,
  marketItemCurrency,
  type CosmeticId,
  type CosmeticSlot,
  type EquippedCosmetics,
  type MarketCurrency,
  type MarketItemId
} from '../config/marketItems';

export type { CosmeticId, CosmeticSlot, EquippedCosmetics, MarketCurrency, MarketItemId };
export type AnyWeaponId = WeaponId | 'boomerang' | 'lantern';

export const MARKET_STORAGE_KEY = 'wilderness-gnomes-market-v1';
export const MARKET_CORRUPT_BACKUP_KEY = `${MARKET_STORAGE_KEY}-corrupt-backup`;

export interface MarketProfile {
  version: 1;
  shopVersion: 2;
  equippedWeapon: AnyWeaponId;
  equippedCosmetics: EquippedCosmetics;
  gold: number;
  rocks: number;
  collectedRocks: string[];
  ranks: Partial<Record<MarketItemId, number>>;
  /** Persisted receipts prevent a game-over screen or page reload from paying twice. */
  settledRuns: string[];
}

export interface MarketStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type MarketStorageStatus = 'ready' | 'unavailable' | 'corrupt';

interface TransactionResult {
  balance: number;
  /** False means this session works, but the browser could not save the change. */
  saved: boolean;
  storageStatus: MarketStorageStatus;
}

export interface MarketPurchaseResult extends TransactionResult {
  status: 'purchased' | 'insufficient-gold' | 'insufficient-rocks' | 'max-rank' | 'unknown-item';
  itemId: string;
  rank: number;
  cost: number;
  currency?: MarketCurrency;
  rocksBalance?: number;
}

export interface RunSettlementResult extends TransactionResult {
  status: 'awarded' | 'already-settled' | 'invalid-run';
  goldEarned: number;
}

/**
 * Every wanderer starts hired. The unlock items survive as owned ranks so old saves that paid
 * for them still validate cleanly.
 */
export const CHARACTER_UNLOCKS: Record<string, MarketItemId | null> = {
  wizard: null, hailey: 'unlock-hailey', sheldon: 'unlock-sheldon', ron: 'unlock-ron'
};

export const WEAPON_UNLOCKS: Record<AnyWeaponId, MarketItemId | null> = {
  spell: null,
  crossbow: 'unlock-crossbow',
  boomerang: 'unlock-boomerang',
  lantern: 'unlock-lantern'
};

export function emptyEquippedCosmetics(): EquippedCosmetics {
  return { aura: null, trail: null, buddy: null };
}

export function grantedCharacterRanks(): Partial<Record<MarketItemId, number>> {
  const ranks: Partial<Record<MarketItemId, number>> = {};
  for (const item of Object.values(CHARACTER_UNLOCKS)) if (item) ranks[item] = 1;
  return ranks;
}

export function emptyMarketProfile(): MarketProfile {
  return {
    version: 1,
    shopVersion: 2,
    equippedWeapon: 'spell',
    equippedCosmetics: emptyEquippedCosmetics(),
    gold: 0,
    rocks: 0,
    collectedRocks: [],
    ranks: grantedCharacterRanks(),
    settledRuns: []
  };
}

/** Smooth milestone gold curve starting from level 3, plus 1 per level from 20 onward. */
export function goldForLevel(level: number): number {
  if (!Number.isFinite(level) || level < 3) return 0;
  const reached = Math.min(Number.MAX_SAFE_INTEGER, Math.floor(level));
  if (reached < 5) return 1;
  if (reached < 8) return 2;
  if (reached < 10) return 3;
  if (reached < 15) return 5;
  if (reached < 20) return 7;
  return 10 + (reached - 20);
}

export function createRunId(): string {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch { /* Older browsers may not expose crypto. */ }
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function safeRank(profile: Pick<MarketProfile, 'ranks'> | undefined, id: MarketItemId): number {
  const ranks = profile?.ranks;
  const rank = ranks && Object.prototype.hasOwnProperty.call(ranks, id) ? ranks[id] : undefined;
  const cap = getMarketItem(id)!.maxRank;
  return typeof rank === 'number' && Number.isFinite(rank) ? Math.max(0, Math.min(cap, Math.floor(rank))) : 0;
}

/** A fresh value object is deliberately detached from the wallet and future purchases. */
export function marketBonuses(profile?: Pick<MarketProfile, 'ranks'>) {
  return {
    damageMultiplier: 1 + safeRank(profile, 'embersteel-edge') * 0.10,
    cooldownMultiplier: 1 - safeRank(profile, 'clockwork-trigger') * 0.05,
    extraHealth: safeRank(profile, 'peach-heart') * 15,
    regenerationPerSecond: safeRank(profile, 'springwater-flask') * 0.2,
    speedMultiplier: 1 + safeRank(profile, 'trail-boots') * 0.05,
    damageTakenMultiplier: 1 - safeRank(profile, 'quilted-cloak') * 0.05,
    extraProjectiles: safeRank(profile, 'splitshot-charm'),
    extraRerolls: safeRank(profile, 'clover-charm'),
    magnetMultiplier: 1 + safeRank(profile, 'wayfinder-stone') * 0.20,
    extraChestChance: safeRank(profile, 'wayfinder-stone') * 0.05,
    mysteryDamageMultiplier: 1 + safeRank(profile, 'mooncat-bell') * 0.15,
    midnightDamageMultiplier: 1 + safeRank(profile, 'midnight-collar') * 0.15,
    frankieDamageMultiplier: 1 + safeRank(profile, 'frankie-whistle') * 0.15,
    tobiasDamageMultiplier: 1 + safeRank(profile, 'tobias-lure') * 0.15
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validRunId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 160;
}

/** Invalid versions and malformed balances are never interpreted as spendable currency. */
export function parseMarketProfile(serialized: string): MarketProfile | null {
  try {
    const value: unknown = JSON.parse(serialized);
    if (!isRecord(value) || value.version !== 1 || !Number.isSafeInteger(value.gold)
      || (value.gold as number) < 0 || !isRecord(value.ranks) || !Array.isArray(value.settledRuns)) return null;
    const ranks: MarketProfile['ranks'] = {};
    for (const [id, rank] of Object.entries(value.ranks)) {
      const item = getMarketItem(id);
      if (!item || !Number.isInteger(rank) || (rank as number) < 0 || (rank as number) > item.maxRank) return null;
      ranks[item.id] = rank as number;
    }
    // Existing players keep the characters and arms that were freely available before shops.
    if (value.shopVersion === undefined) { ranks['unlock-crossbow'] = 1; }
    else if (value.shopVersion !== 2) return null;
    // Everyone is on the roster now, whether or not this save ever paid for them.
    Object.assign(ranks, grantedCharacterRanks());
    const equippedWeapon = value.equippedWeapon ?? 'spell';
    if (typeof equippedWeapon !== 'string' || !Object.prototype.hasOwnProperty.call(WEAPON_UNLOCKS, equippedWeapon)) return null;
    const weaponUnlock = WEAPON_UNLOCKS[equippedWeapon as AnyWeaponId];
    if (weaponUnlock !== null && !ranks[weaponUnlock]) return null;

    const equippedCosmetics = emptyEquippedCosmetics();
    if (value.equippedCosmetics !== undefined) {
      if (!isRecord(value.equippedCosmetics)) return null;
      for (const key of Object.keys(value.equippedCosmetics)) {
        if (!COSMETIC_SLOTS.includes(key as CosmeticSlot)) return null;
      }
      for (const slot of COSMETIC_SLOTS) {
        const chosen = value.equippedCosmetics[slot] ?? null;
        if (chosen === null) continue;
        if (typeof chosen !== 'string' || getCosmeticSlot(chosen) !== slot || !ranks[chosen as MarketItemId]) return null;
        equippedCosmetics[slot] = chosen as CosmeticId;
      }
      if (value.equippedCosmetic !== undefined && value.equippedCosmetic !== null) {
        if (typeof value.equippedCosmetic !== 'string' || getMarketItem(value.equippedCosmetic)?.kind !== 'cosmetic' ||
          !ranks[value.equippedCosmetic as MarketItemId]) return null;
      }
    } else if (value.equippedCosmetic !== undefined && value.equippedCosmetic !== null) {
      if (typeof value.equippedCosmetic !== 'string') return null;
      const slot = getCosmeticSlot(value.equippedCosmetic);
      if (!slot || !ranks[value.equippedCosmetic as MarketItemId]) return null;
      equippedCosmetics[slot] = value.equippedCosmetic as CosmeticId;
    }

    if (!value.settledRuns.every(validRunId) || new Set(value.settledRuns).size !== value.settledRuns.length) return null;
    const rocks = value.rocks === undefined ? 0 : value.rocks;
    const collectedRocks = value.collectedRocks === undefined ? [] : value.collectedRocks;
    if (!Number.isSafeInteger(rocks) || (rocks as number) < 0 || !Array.isArray(collectedRocks) ||
      !collectedRocks.every(validRunId) || new Set(collectedRocks).size !== collectedRocks.length) return null;
    return {
      version: 1,
      shopVersion: 2,
      equippedWeapon: equippedWeapon as AnyWeaponId,
      equippedCosmetics,
      gold: value.gold as number,
      rocks: rocks as number,
      collectedRocks: [...collectedRocks],
      ranks,
      settledRuns: [...value.settledRuns]
    };
  } catch {
    return null;
  }
}

function browserStorage(): MarketStorage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export class MarketProgress {
  private current = emptyMarketProfile();
  private readonly storage: MarketStorage | null;
  private dirty = false;
  private status: MarketStorageStatus = 'ready';
  private corruptPayload: string | null = null;

  constructor(storage: MarketStorage | null = browserStorage()) {
    this.storage = storage;
    this.refresh();
  }

  get equippedWeapon(): AnyWeaponId { return this.current.equippedWeapon; }
  get equippedCosmetic(): CosmeticId | null {
    const { aura, trail, buddy } = this.current.equippedCosmetics;
    return aura ?? trail ?? buddy;
  }
  get equippedCosmetics(): EquippedCosmetics {
    return { ...this.current.equippedCosmetics };
  }
  get storageStatus(): MarketStorageStatus { return this.status; }
  get profile(): MarketProfile {
    return {
      ...this.current,
      equippedCosmetics: { ...this.current.equippedCosmetics },
      ranks: { ...this.current.ranks },
      settledRuns: [...this.current.settledRuns],
      collectedRocks: [...this.current.collectedRocks]
    };
  }

  /** Refresh before sequential transactions to observe changes saved by other tabs. */
  refresh(): MarketProfile {
    if (this.dirty) return this.profile;
    if (!this.storage) {
      this.status = 'unavailable';
      return this.profile;
    }
    try {
      const serialized = this.storage.getItem(MARKET_STORAGE_KEY);
      if (serialized === null) {
        this.current = emptyMarketProfile();
        this.status = 'ready';
        this.corruptPayload = null;
      } else {
        const parsed = parseMarketProfile(serialized);
        if (parsed) { this.current = parsed; this.status = 'ready'; this.corruptPayload = null; }
        else { this.status = 'corrupt'; this.corruptPayload = serialized; }
      }
    } catch { this.status = 'unavailable'; }
    return this.profile;
  }

  private persist(next: MarketProfile): boolean {
    this.current = next;
    this.dirty = true;
    if (!this.storage) { this.status = 'unavailable'; return false; }
    try {
      if (this.corruptPayload !== null) {
        // Keep unsupported versions and malformed saves recoverable before replacing them.
        // A second different corrupt save gets its own backup instead of erasing the first.
        const existingBackup = this.storage.getItem(MARKET_CORRUPT_BACKUP_KEY);
        if (existingBackup !== this.corruptPayload) {
          const backupKey = existingBackup === null ? MARKET_CORRUPT_BACKUP_KEY
            : `${MARKET_CORRUPT_BACKUP_KEY}-${createRunId()}`;
          this.storage.setItem(backupKey, this.corruptPayload);
        }
        this.corruptPayload = null;
      }
      this.storage.setItem(MARKET_STORAGE_KEY, JSON.stringify(next));
      this.dirty = false;
      this.status = 'ready';
      return true;
    } catch { this.status = 'unavailable'; return false; }
  }

  private result(currency: MarketCurrency = 'gold'): TransactionResult {
    const balance = currency === 'rocks' ? this.current.rocks : this.current.gold;
    return { balance, saved: !this.dirty && this.status === 'ready', storageStatus: this.status };
  }

  /** Bank each find immediately; pickup receipts make retries safe. */
  collectRock(id: string): { balance: number; saved: boolean; awarded: boolean } {
    this.refresh();
    if (!validRunId(id)) return { balance: this.current.rocks, saved: false, awarded: false };
    if (this.current.collectedRocks.includes(id)) {
      if (this.dirty) this.persist(this.current);
      return { balance: this.current.rocks, saved: !this.dirty && this.status === 'ready', awarded: false };
    }
    const balance = Math.min(Number.MAX_SAFE_INTEGER, this.current.rocks + 1);
    const saved = this.persist({ ...this.current, rocks: balance, collectedRocks: [...this.current.collectedRocks, id] });
    return { balance, saved, awarded: true };
  }

  settleRun(runId: string, level: number, bonusGold = 0): RunSettlementResult {
    this.refresh();
    if (!validRunId(runId) || !Number.isFinite(level) || level < 1) {
      return { status: 'invalid-run', goldEarned: 0, ...this.result() };
    }
    if (this.current.settledRuns.includes(runId)) {
      // A repeated screen may also be an opportunity to recover from a temporary save failure.
      if (this.dirty) this.persist(this.current);
      return { status: 'already-settled', goldEarned: 0, ...this.result() };
    }
    const safeBonus = Number.isFinite(bonusGold) && bonusGold > 0
      ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(bonusGold)) : 0;
    const room = Number.MAX_SAFE_INTEGER - this.current.gold;
    const levelEarned = Math.min(goldForLevel(level), room);
    const goldEarned = levelEarned + Math.min(safeBonus, room - levelEarned);
    this.persist({ ...this.current, gold: this.current.gold + goldEarned, settledRuns: [...this.current.settledRuns, runId] });
    return { status: 'awarded', goldEarned, ...this.result() };
  }

  /** Every wanderer is available from the first run. */
  characterUnlocked(id: string): boolean {
    return Object.prototype.hasOwnProperty.call(CHARACTER_UNLOCKS, id) && CHARACTER_UNLOCKS[id] !== undefined;
  }

  weaponUnlocked(id: string): boolean {
    if (!Object.prototype.hasOwnProperty.call(WEAPON_UNLOCKS, id)) return false;
    const item = WEAPON_UNLOCKS[id as AnyWeaponId];
    return item === null || !!this.current.ranks[item];
  }

  equipWeapon(id: AnyWeaponId): boolean {
    this.refresh();
    if (!this.weaponUnlocked(id)) return false;
    this.persist({ ...this.current, equippedWeapon: id });
    return true;
  }

  equipCosmetic(id: CosmeticId | null): boolean {
    this.refresh();
    if (id === null) {
      this.persist({ ...this.current, equippedCosmetics: emptyEquippedCosmetics() });
      return true;
    }
    const slot = getCosmeticSlot(id);
    if (!slot || !this.current.ranks[id]) return false;
    this.persist({ ...this.current, equippedCosmetics: { ...this.current.equippedCosmetics, [slot]: id } });
    return true;
  }

  equipCosmeticSlot(slot: CosmeticSlot, id: CosmeticId | null): boolean {
    this.refresh();
    if (!COSMETIC_SLOTS.includes(slot)) return false;
    if (id !== null && (getCosmeticSlot(id) !== slot || !this.current.ranks[id])) return false;
    this.persist({ ...this.current, equippedCosmetics: { ...this.current.equippedCosmetics, [slot]: id } });
    return true;
  }

  purchase(itemId: string): MarketPurchaseResult {
    this.refresh();
    const item = getMarketItem(itemId);
    const rank = item && Object.prototype.hasOwnProperty.call(this.current.ranks, item.id)
      ? (this.current.ranks[item.id] ?? 0) : 0;
    const cost = item?.prices[rank] ?? 0;
    const currency: MarketCurrency = item ? marketItemCurrency(item) : 'gold';
    const details = { itemId, rank, cost, currency };
    if (!item) return { status: 'unknown-item', ...details, rocksBalance: this.current.rocks, ...this.result('gold') };
    if (rank >= item.maxRank) return { status: 'max-rank', ...details, rocksBalance: this.current.rocks, ...this.result(currency) };
    const available = currency === 'rocks' ? this.current.rocks : this.current.gold;
    if (available < cost) {
      return {
        status: currency === 'rocks' ? 'insufficient-rocks' : 'insufficient-gold',
        ...details,
        rocksBalance: this.current.rocks,
        ...this.result(currency)
      };
    }
    const next: MarketProfile = {
      ...this.current,
      gold: currency === 'gold' ? this.current.gold - cost : this.current.gold,
      rocks: currency === 'rocks' ? this.current.rocks - cost : this.current.rocks,
      ranks: { ...this.current.ranks, [item.id]: rank + 1 }
    };
    this.persist(next);
    return { status: 'purchased', ...details, rank: rank + 1, rocksBalance: this.current.rocks, ...this.result(currency) };
  }
}

/** Shared Newnan Market Day wallet, including session-only progress if storage is blocked. */
export const marketProgress = new MarketProgress();
