export const SOUND_STORAGE_KEY = 'wilderness-gnomes-sound-v1';

export interface SoundSettings {
  muted: boolean;
  sfxVolume: number;
  musicVolume: number;
}

export interface SoundStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DEFAULT_SOUND_PREFERENCES: Readonly<SoundSettings> = Object.freeze({
  muted: false,
  sfxVolume: 0.7,
  musicVolume: 0.45
});

export function defaultSoundPreferences(): SoundSettings {
  return { ...DEFAULT_SOUND_PREFERENCES };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clampUnitVolume(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function browserStorage(): SoundStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function resolveStorage(storage?: SoundStorage | null): SoundStorage | null {
  return storage === undefined ? browserStorage() : storage;
}

/** Validates and clamps persisted or partial sound preferences back to safe defaults. */
export function normalizeSoundPreferences(
  value: unknown,
  fallback: SoundSettings = DEFAULT_SOUND_PREFERENCES
): SoundSettings {
  if (!isRecord(value)) return { ...fallback };
  return {
    muted: typeof value.muted === 'boolean' ? value.muted : fallback.muted,
    sfxVolume: clampUnitVolume(value.sfxVolume, fallback.sfxVolume),
    musicVolume: clampUnitVolume(value.musicVolume, fallback.musicVolume)
  };
}

/** Reads sound settings from storage, gracefully falling back when unavailable or corrupt. */
export function loadSoundPreferences(storage?: SoundStorage | null): SoundSettings {
  const target = resolveStorage(storage);
  if (!target) return defaultSoundPreferences();
  try {
    const raw = target.getItem(SOUND_STORAGE_KEY);
    if (raw === null) return defaultSoundPreferences();
    const parsed: unknown = JSON.parse(raw);
    return normalizeSoundPreferences(parsed, DEFAULT_SOUND_PREFERENCES);
  } catch {
    return defaultSoundPreferences();
  }
}

/** Persists sound settings safely under 'wilderness-gnomes-sound-v1', returning normalized settings. */
export function saveSoundPreferences(
  preferences: Partial<SoundSettings>,
  storage?: SoundStorage | null
): SoundSettings {
  const target = resolveStorage(storage);
  const hasAllFields =
    typeof preferences.muted === 'boolean' &&
    typeof preferences.sfxVolume === 'number' &&
    typeof preferences.musicVolume === 'number';
  const base = hasAllFields ? DEFAULT_SOUND_PREFERENCES : loadSoundPreferences(target);
  const next = normalizeSoundPreferences({ ...base, ...preferences }, base);
  if (target) {
    try {
      target.setItem(SOUND_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* Storage may be blocked or full; keep session state usable without throwing. */
    }
  }
  return next;
}

/** Flips the stored muted flag and returns the updated preferences snapshot. */
export function toggleMuted(storage?: SoundStorage | null): SoundSettings {
  const current = loadSoundPreferences(storage);
  return saveSoundPreferences({ ...current, muted: !current.muted }, storage);
}

/** Lightweight reactive preferences store backed by safe localStorage persistence. */
export class SoundPreferences {
  private readonly storage: SoundStorage | null;
  private readonly listeners = new Set<(settings: SoundSettings) => void>();
  private state: SoundSettings;

  constructor(storage?: SoundStorage | null) {
    this.storage = resolveStorage(storage);
    this.state = loadSoundPreferences(this.storage);
  }

  get current(): SoundSettings {
    return { ...this.state };
  }

  get muted(): boolean {
    return this.state.muted;
  }

  get sfxVolume(): number {
    return this.state.sfxVolume;
  }

  get musicVolume(): number {
    return this.state.musicVolume;
  }

  refresh(): SoundSettings {
    this.state = loadSoundPreferences(this.storage);
    return this.current;
  }

  update(patch: Partial<SoundSettings>): SoundSettings {
    const next = normalizeSoundPreferences({ ...this.state, ...patch }, this.state);
    this.state = next;
    saveSoundPreferences(next, this.storage);
    this.emit();
    return this.current;
  }

  setMuted(muted: boolean): SoundSettings {
    return this.update({ muted: Boolean(muted) });
  }

  toggleMuted(): SoundSettings {
    return this.update({ muted: !this.state.muted });
  }

  setVolumes(
    sfxOrPatch: number | Partial<Pick<SoundSettings, 'sfxVolume' | 'musicVolume'>>,
    musicVolume?: number
  ): SoundSettings {
    if (typeof sfxOrPatch === 'object' && sfxOrPatch !== null) {
      return this.update({
        ...(sfxOrPatch.sfxVolume !== undefined ? { sfxVolume: sfxOrPatch.sfxVolume } : {}),
        ...(sfxOrPatch.musicVolume !== undefined ? { musicVolume: sfxOrPatch.musicVolume } : {})
      });
    }
    return this.update({
      sfxVolume: sfxOrPatch,
      ...(musicVolume !== undefined ? { musicVolume } : {})
    });
  }

  reset(): SoundSettings {
    return this.update(defaultSoundPreferences());
  }

  subscribe(listener: (settings: SoundSettings) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snapshot = this.current;
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

export const soundPreferences = new SoundPreferences();
