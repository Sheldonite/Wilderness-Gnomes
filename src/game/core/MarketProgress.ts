import { getMarketItem, type MarketItemId } from '../config/marketItems';

export const MARKET_STORAGE_KEY = 'wilderness-gnomes-market-v1';
export const MARKET_CORRUPT_BACKUP_KEY = `${MARKET_STORAGE_KEY}-corrupt-backup`;

export interface MarketProfile {
  version: 1;
  gold: number;
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
  status: 'purchased' | 'insufficient-gold' | 'max-rank' | 'unknown-item';
  itemId: string;
  rank: number;
  cost: number;
}

export interface RunSettlementResult extends TransactionResult {
  status: 'awarded' | 'already-settled' | 'invalid-run';
  goldEarned: number;
}

export function emptyMarketProfile(): MarketProfile {
  return { version: 1, gold: 0, ranks: {}, settledRuns: [] };
}

/** Milestone rewards are totals for the run, not payments made at each level. */
export function goldForLevel(level: number): number {
  if (!Number.isFinite(level) || level < 10) return 0;
  const reached = Math.min(Number.MAX_SAFE_INTEGER, Math.floor(level));
  return reached < 20 ? 5 : 10 + (reached - 20);
}

export function createRunId(): string {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch { /* Older browsers may not expose crypto. */ }
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function safeRank(profile: Pick<MarketProfile, 'ranks'> | undefined, id: MarketItemId): number {
  const rank = profile?.ranks?.[id];
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
    mysteryDamageMultiplier: 1 + safeRank(profile, 'mooncat-bell') * 0.15
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validRunId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 160;
}

/** Invalid versions and malformed balances are never interpreted as spendable gold. */
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
    if (!value.settledRuns.every(validRunId) || new Set(value.settledRuns).size !== value.settledRuns.length) return null;
    return { version: 1, gold: value.gold as number, ranks, settledRuns: [...value.settledRuns] };
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

  get storageStatus(): MarketStorageStatus { return this.status; }
  get profile(): MarketProfile {
    return { ...this.current, ranks: { ...this.current.ranks }, settledRuns: [...this.current.settledRuns] };
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

  private result(): TransactionResult {
    return { balance: this.current.gold, saved: !this.dirty && this.status === 'ready', storageStatus: this.status };
  }

  settleRun(runId: string, level: number): RunSettlementResult {
    this.refresh();
    if (!validRunId(runId) || !Number.isFinite(level) || level < 1) {
      return { status: 'invalid-run', goldEarned: 0, ...this.result() };
    }
    if (this.current.settledRuns.includes(runId)) {
      // A repeated screen may also be an opportunity to recover from a temporary save failure.
      if (this.dirty) this.persist(this.current);
      return { status: 'already-settled', goldEarned: 0, ...this.result() };
    }
    const goldEarned = Math.min(goldForLevel(level), Number.MAX_SAFE_INTEGER - this.current.gold);
    this.persist({ ...this.current, gold: this.current.gold + goldEarned, settledRuns: [...this.current.settledRuns, runId] });
    return { status: 'awarded', goldEarned, ...this.result() };
  }

  purchase(itemId: string): MarketPurchaseResult {
    this.refresh();
    const item = getMarketItem(itemId);
    const rank = item ? this.current.ranks[item.id] ?? 0 : 0;
    const cost = item?.prices[rank] ?? 0;
    const details = { itemId, rank, cost };
    if (!item) return { status: 'unknown-item', ...details, ...this.result() };
    if (rank >= item.maxRank) return { status: 'max-rank', ...details, ...this.result() };
    if (this.current.gold < cost) return { status: 'insufficient-gold', ...details, ...this.result() };
    this.persist({ ...this.current, gold: this.current.gold - cost, ranks: { ...this.current.ranks, [item.id]: rank + 1 } });
    return { status: 'purchased', ...details, rank: rank + 1, ...this.result() };
  }
}

/** Shared Newnan Market Day wallet, including session-only progress if storage is blocked. */
export const marketProgress = new MarketProgress();
