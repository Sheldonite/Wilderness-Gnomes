import type Phaser from 'phaser';
import {
  SoundPreferences,
  soundPreferences,
  type SoundSettings
} from '../core/SoundPreferences';

export type SoundId =
  | 'shot-spell'
  | 'shot-crossbow'
  | 'shot-boomerang'
  | 'shot-lantern'
  | 'xp'
  | 'level'
  | 'awakening'
  | 'hit'
  | 'defeat'
  | 'dash'
  | 'chest'
  | 'rock'
  | 'shrine'
  | 'boss-spawn'
  | 'boss-warn'
  | 'boss-impact'
  | 'boss-defeat'
  | 'companion-hit'
  | 'ui-click'
  | 'upgrade-pick';

export const SOUND_IDS: readonly SoundId[] = Object.freeze([
  'shot-spell',
  'shot-crossbow',
  'shot-boomerang',
  'shot-lantern',
  'xp',
  'level',
  'awakening',
  'hit',
  'defeat',
  'dash',
  'chest',
  'rock',
  'shrine',
  'boss-spawn',
  'boss-warn',
  'boss-impact',
  'boss-defeat',
  'companion-hit',
  'ui-click',
  'upgrade-pick'
]);

export type MusicMode = 'title' | 'market' | 'woods' | 'boss' | 'silent';

export interface PlaySoundOptions {
  volume?: number;
  pitch?: number;
  pan?: number;
  cooldownMs?: number;
  force?: boolean;
}

export interface AudioParamLike {
  value: number;
  setValueAtTime?(value: number, startTime: number): unknown;
  linearRampToValueAtTime?(value: number, endTime: number): unknown;
  exponentialRampToValueAtTime?(value: number, endTime: number): unknown;
  setTargetAtTime?(target: number, startTime: number, timeConstant: number): unknown;
  cancelAndHoldAtTime?(cancelTime: number): unknown;
  cancelScheduledValues?(cancelTime: number): unknown;
}

export interface AudioNodeLike {
  connect(destination: unknown): unknown;
  disconnect?(): void;
}

export interface GainNodeLike extends AudioNodeLike {
  gain: AudioParamLike;
}

export interface OscillatorNodeLike extends AudioNodeLike {
  type: OscillatorType;
  frequency: AudioParamLike;
  detune?: AudioParamLike;
  onended: ((event?: unknown) => void) | null;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface BiquadFilterNodeLike extends AudioNodeLike {
  type: BiquadFilterType;
  frequency: AudioParamLike;
  Q?: AudioParamLike;
}

export interface AudioBufferSourceNodeLike extends AudioNodeLike {
  buffer: unknown;
  loop?: boolean;
  onended: ((event?: unknown) => void) | null;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface StereoPannerNodeLike extends AudioNodeLike {
  pan: AudioParamLike;
}

export interface AudioContextLike {
  readonly state: 'suspended' | 'running' | 'closed' | string;
  readonly currentTime: number;
  readonly sampleRate?: number;
  readonly destination: unknown;
  resume?(): Promise<void> | void;
  close?(): Promise<void> | void;
  createGain(): GainNodeLike;
  createOscillator(): OscillatorNodeLike;
  createBiquadFilter?(): BiquadFilterNodeLike;
  createBuffer?(channels: number, length: number, sampleRate: number): {
    getChannelData?(channel: number): Float32Array;
  };
  createBufferSource?(): AudioBufferSourceNodeLike;
  createStereoPanner?(): StereoPannerNodeLike;
}

export interface AudioSystemOptions {
  preferences?: SoundPreferences;
  createContext?: () => AudioContextLike | null;
  now?: () => number;
}

interface ActiveVoice {
  stop?(when?: number): void;
  disconnect?(): void;
  onended?: ((event?: unknown) => void) | null;
}

interface MusicTrack {
  gain: GainNodeLike;
  voices: Set<ActiveVoice>;
}

interface TimestampSample {
  wallMs: number;
  ctxMs: number;
  customMs?: number;
}

interface ToneSpec {
  wave: OscillatorType;
  freq: number;
  freqEnd?: number;
  delaySec?: number;
  attackSec?: number;
  durationSec: number;
  gain: number;
  filterType?: BiquadFilterType;
  filterFreq?: number;
  filterQ?: number;
  pan?: number;
}

interface NoiseSpec {
  delaySec?: number;
  attackSec?: number;
  durationSec: number;
  gain: number;
  filterType: BiquadFilterType;
  filterFreq: number;
  filterFreqEnd?: number;
  filterQ?: number;
  fallbackFreq?: number;
  fallbackFreqEnd?: number;
  pan?: number;
}

interface MusicPattern {
  stepMs: number;
  cutoffHz: number;
  bassCutoffHz: number;
  noteDurationSec: number;
  bassDurationSec: number;
  melodyGain: number;
  bassGain: number;
  melody: readonly (number | null)[];
  bass: readonly (number | null)[];
}

const SFX_HEADROOM = 0.72;
const MUSIC_HEADROOM = 0.28;
const MUSIC_CROSSFADE_SEC = 0.24;
const XP_COMBO_WINDOW_MS = 350;
const XP_BASE_HZ = 659.25; // E5 warm crystal chime
const XP_SEMITONES = [0, 2, 4, 7, 9, 12, 14, 16, 19] as const;

const DEFAULT_COOLDOWN_MS: Partial<Record<SoundId, number>> = {
  hit: 35,
  defeat: 35,
  'companion-hit': 45,
  'boss-impact': 60,
  'shot-spell': 35,
  'shot-crossbow': 35,
  'shot-boomerang': 35,
  'shot-lantern': 35
};

const MUSIC_PATTERNS: Record<Exclude<MusicMode, 'silent'>, MusicPattern> = {
  title: {
    stepMs: 780,
    cutoffHz: 960,
    bassCutoffHz: 420,
    noteDurationSec: 0.72,
    bassDurationSec: 1.4,
    melodyGain: 0.17,
    bassGain: 0.13,
    // Gentle D major pentatonic music-box lullaby
    melody: [587.33, null, 739.99, 880, null, 659.25, 587.33, null, 739.99, 987.77, 880, null, 739.99, 659.25, 587.33, null],
    bass: [146.83, null, null, null, 220.0, null, null, null, 196.0, null, null, null, 164.81, null, 220.0, null]
  },
  market: {
    stepMs: 520,
    cutoffHz: 1180,
    bassCutoffHz: 480,
    noteDurationSec: 0.44,
    bassDurationSec: 0.9,
    melodyGain: 0.16,
    bassGain: 0.12,
    // Warm C major town-square stroll
    melody: [523.25, 659.25, 783.99, null, 880, 783.99, 659.25, 587.33, 523.25, 587.33, 659.25, null, 783.99, 659.25, 587.33, null],
    bass: [130.81, null, 196.0, null, 174.61, null, 196.0, null, 220.0, null, 164.81, null, 196.0, null, 130.81, null]
  },
  woods: {
    stepMs: 460,
    cutoffHz: 940,
    bassCutoffHz: 390,
    noteDurationSec: 0.42,
    bassDurationSec: 0.85,
    melodyGain: 0.15,
    bassGain: 0.13,
    // Serene A Dorian woodland wandering motif
    melody: [440, null, 523.25, 659.25, 587.33, null, 523.25, 493.88, 440, 587.33, 659.25, null, 739.99, 659.25, 523.25, null],
    bass: [110.0, null, 164.81, null, 146.83, null, 164.81, null, 110.0, null, 196.0, null, 146.83, null, 164.81, null]
  },
  boss: {
    stepMs: 238,
    cutoffHz: 1820,
    bassCutoffHz: 560,
    noteDurationSec: 0.36,
    bassDurationSec: 0.28,
    melodyGain: 0.23,
    bassGain: 0.22,
    // Four bars of D minor, B-flat, G minor, and A leading back to D.
    melody: [
      293.66, null, 349.23, 440, 587.33, null, 440, 349.23,
      466.16, null, 440, 349.23, 293.66, 349.23, 466.16, null,
      392, null, 466.16, 587.33, 698.46, null, 587.33, 466.16,
      440, null, 659.25, 587.33, 554.37, 440, 554.37, null
    ],
    bass: [
      73.42, 73.42, null, 110, 73.42, null, 110, 73.42,
      58.27, 58.27, null, 87.31, 58.27, null, 87.31, 58.27,
      49, 49, null, 73.42, 49, null, 73.42, 49,
      55, 55, null, 82.41, 55, null, 82.41, 55
    ]
  }
};

const BOSS_CHORDS = [
  [146.83, 174.61, 220],
  [116.54, 146.83, 174.61],
  [98, 146.83, 233.08],
  [110, 164.81, 277.18]
] as const;

function defaultCreateContext(): AudioContextLike | null {
  try {
    const scope = globalThis as unknown as {
      AudioContext?: new () => AudioContextLike;
      webkitAudioContext?: new () => AudioContextLike;
    };
    const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
    return Ctor ? new Ctor() : null;
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function semitoneFrequency(baseHz: number, semitones: number): number {
  return baseHz * Math.pow(2, semitones / 12);
}

function setParam(param: AudioParamLike, value: number, time: number): void {
  param.value = value;
  param.setValueAtTime?.(value, time);
}

function linearRamp(param: AudioParamLike, value: number, endTime: number): void {
  if (typeof param.linearRampToValueAtTime === 'function') {
    param.linearRampToValueAtTime(value, endTime);
  } else {
    param.value = value;
  }
}

function expRamp(param: AudioParamLike, value: number, endTime: number): void {
  const safe = Math.max(0.0001, value);
  if (typeof param.exponentialRampToValueAtTime === 'function') {
    param.exponentialRampToValueAtTime(safe, endTime);
  } else {
    param.value = safe;
  }
}

function safeDisconnect(node?: { disconnect?: () => void } | null): void {
  if (!node?.disconnect) return;
  try {
    node.disconnect();
  } catch {
    /* Already disconnected or mock node. */
  }
}

function safeStop(node?: { stop?: (when?: number) => void } | null): void {
  if (!node?.stop) return;
  try {
    node.stop(0);
  } catch {
    try {
      node.stop();
    } catch {
      /* Already stopped. */
    }
  }
}

function emitRemoveListener(
  emitter: { off?: (e: string, fn: (...args: any[]) => void) => void; removeListener?: (e: string, fn: (...args: any[]) => void) => void },
  event: string,
  handler: (...args: any[]) => void
): void {
  if (typeof emitter.off === 'function') emitter.off(event, handler);
  else emitter.removeListener?.(event, handler);
}

/**
 * Procedural Web Audio synthesizer for Wilderness Gnomes SFX and ambient woodland/market music.
 * Requires zero external audio assets and safely no-ops when Web Audio is unavailable or suspended.
 */
export class AudioSystem {
  private readonly preferences: SoundPreferences;
  private readonly createContext: () => AudioContextLike | null;
  private readonly customNow?: () => number;
  private readonly unsubscribePreferences: () => void;
  private readonly lastPlayedAt = new Map<SoundId, TimestampSample>();
  private readonly fadingMusicTracks = new Set<MusicTrack>();
  private readonly sceneDetachers = new Map<object, () => void>();
  private readonly sceneGestureCleanups = new Set<() => void>();

  private ctx: AudioContextLike | null = null;
  private contextAttempted = false;
  private masterGain: GainNodeLike | null = null;
  private sfxGain: GainNodeLike | null = null;
  private musicGain: GainNodeLike | null = null;
  private noiseBuffer: unknown = null;

  private musicMode: MusicMode = 'silent';
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicTrack: MusicTrack | null = null;
  private musicStep = 0;

  private xpStreak = 0;
  private lastXpSample: TimestampSample | null = null;

  private destroyed = false;

  constructor(options: AudioSystemOptions = {}) {
    this.preferences = options.preferences ?? soundPreferences;
    this.createContext = options.createContext ?? defaultCreateContext;
    this.customNow = options.now;
    this.unsubscribePreferences = this.preferences.subscribe(settings => {
      this.applyPreferences(settings);
    });
  }

  /** Plays a synthesized storybook sound effect, returning true if audio nodes were scheduled. */
  play(sound: SoundId, options: PlaySoundOptions = {}): boolean {
    if (this.destroyed || this.isMuted()) return false;
    if (this.preferences.sfxVolume <= 0) return false;

    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return false;
    this.ensureGraph(ctx);
    if (!this.sfxGain) return false;

    const sample = this.captureTime(ctx);
    const minInterval = options.force ? 0 : (options.cooldownMs ?? DEFAULT_COOLDOWN_MS[sound] ?? 0);
    if (minInterval > 0) {
      const prev = this.lastPlayedAt.get(sound);
      if (prev && this.elapsedBetween(prev, sample) < minInterval) return false;
    }
    this.lastPlayedAt.set(sound, sample);

    const volume = clamp(options.volume ?? 1, 0, 2);
    if (volume <= 0) return false;
    const pitch = clamp(options.pitch ?? 1, 0.25, 4);
    const pan = options.pan !== undefined ? clamp(options.pan, -1, 1) : undefined;

    return this.triggerSound(ctx, this.sfxGain, sound, volume, pitch, pan);
  }

  /** Crossfades soundtracks on a mode change and stops cleanly on 'silent'. */
  setMusicMode(mode: MusicMode): void {
    if (this.destroyed) return;
    if (mode !== this.musicMode) {
      this.musicMode = mode;
      this.musicStep = 0;
      this.stopMusicLoop(mode !== 'silent');
    }
    this.maybeStartMusicLoop();
  }

  getMusicMode(): MusicMode {
    return this.musicMode;
  }

  /** Flips mute state, persists via SoundPreferences, and returns the new muted status. */
  toggleMute(): boolean {
    const next = this.preferences.toggleMuted();
    return next.muted;
  }

  setMuted(muted: boolean): void {
    this.preferences.setMuted(muted);
  }

  isMuted(): boolean {
    return this.preferences.muted;
  }

  /** Updates SFX and/or music volumes (accepts positional args or an object) and persists them. */
  setVolumes(
    sfxOrVolumes: number | Partial<Pick<SoundSettings, 'sfxVolume' | 'musicVolume'>>,
    musicVolume?: number
  ): void {
    this.preferences.setVolumes(sfxOrVolumes, musicVolume);
  }

  getVolumes(): { sfxVolume: number; musicVolume: number } {
    return {
      sfxVolume: this.preferences.sfxVolume,
      musicVolume: this.preferences.musicVolume
    };
  }

  getPreferences(): SoundSettings {
    return this.preferences.current;
  }

  /** Attempts to initialize/resume Web Audio inside a user gesture and starts pending ambient music. */
  async unlock(): Promise<boolean> {
    if (this.destroyed) return false;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state === 'closed') return false;

    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      try {
        const pending = ctx.resume();
        if (pending && typeof (pending as PromiseLike<void>).then === 'function') {
          await pending;
        }
      } catch {
        return false;
      }
    }

    if (this.destroyed || ctx.state !== 'running') return false;
    this.ensureGraph(ctx);
    this.clearGestureListeners();
    this.maybeStartMusicLoop();
    return true;
  }

  /**
   * Connects a Phaser scene's presentation/audio events and first-gesture unlock listeners,
   * automatically detaching everything when the scene shuts down.
   */
  attachScene(scene: Phaser.Scene): () => void {
    if (this.destroyed || !scene?.events) return () => {};

    const existing = this.sceneDetachers.get(scene);
    if (existing) existing();

    const onHit = () => { this.play('hit'); };
    const onDefeat = () => { this.play('defeat'); };
    const onCollect = () => { this.play('xp'); };
    const onLevel = () => { this.play('level'); };
    const onAudioPlay = (soundOrPayload: unknown, options?: PlaySoundOptions) => {
      if (typeof soundOrPayload === 'string') {
        this.play(soundOrPayload as SoundId, options);
        return;
      }
      if (typeof soundOrPayload === 'object' && soundOrPayload !== null) {
        const payload = soundOrPayload as { sound?: unknown } & PlaySoundOptions;
        if (typeof payload.sound === 'string') {
          const { sound, ...rest } = payload;
          this.play(sound as SoundId, rest);
        }
      }
    };

    const events = scene.events as unknown as {
      on(event: string, fn: (...args: any[]) => void): void;
      off?(event: string, fn: (...args: any[]) => void): void;
      removeListener?(event: string, fn: (...args: any[]) => void): void;
    };

    events.on('presentation:hit', onHit);
    events.on('presentation:defeat', onDefeat);
    events.on('presentation:collect', onCollect);
    events.on('presentation:level', onLevel);
    events.on('audio:play', onAudioPlay);

    const onGesture = () => { void this.unlock(); };
    const cleanGestures: Array<() => void> = [];

    const input = scene.input as unknown as {
      on?(event: string, fn: () => void): void;
      off?(event: string, fn: () => void): void;
      keyboard?: {
        on?(event: string, fn: () => void): void;
        off?(event: string, fn: () => void): void;
      };
    } | undefined;

    if (!this.isContextRunning()) {
      if (typeof input?.on === 'function') {
        input.on('pointerdown', onGesture);
        cleanGestures.push(() => input.off?.('pointerdown', onGesture));
      }
      if (typeof input?.keyboard?.on === 'function') {
        input.keyboard.on('keydown', onGesture);
        cleanGestures.push(() => input.keyboard?.off?.('keydown', onGesture));
      }
      if (typeof globalThis.window?.addEventListener === 'function') {
        globalThis.window.addEventListener('pointerdown', onGesture, { passive: true });
        globalThis.window.addEventListener('keydown', onGesture, { passive: true });
        cleanGestures.push(() => {
          globalThis.window?.removeEventListener?.('pointerdown', onGesture);
          globalThis.window?.removeEventListener?.('keydown', onGesture);
        });
      }
    }

    const cleanupGestures = () => {
      while (cleanGestures.length > 0) {
        cleanGestures.pop()?.();
      }
      this.sceneGestureCleanups.delete(cleanupGestures);
    };
    this.sceneGestureCleanups.add(cleanupGestures);

    let detached = false;
    const detach = () => {
      if (detached) return;
      detached = true;
      emitRemoveListener(events, 'presentation:hit', onHit);
      emitRemoveListener(events, 'presentation:defeat', onDefeat);
      emitRemoveListener(events, 'presentation:collect', onCollect);
      emitRemoveListener(events, 'presentation:level', onLevel);
      emitRemoveListener(events, 'audio:play', onAudioPlay);
      emitRemoveListener(events, 'shutdown', detach);
      cleanupGestures();
      this.sceneDetachers.delete(scene);
    };

    events.on('shutdown', detach);
    this.sceneDetachers.set(scene, detach);
    return detach;
  }

  /** Stops all procedural music, detaches scenes, unsubscribes preferences, and closes AudioContext. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopMusicLoop();
    this.clearGestureListeners();
    for (const detach of [...this.sceneDetachers.values()]) {
      detach();
    }
    this.sceneDetachers.clear();
    this.unsubscribePreferences();
    this.lastPlayedAt.clear();
    this.lastXpSample = null;
    this.xpStreak = 0;

    safeDisconnect(this.sfxGain);
    safeDisconnect(this.musicGain);
    safeDisconnect(this.masterGain);
    this.sfxGain = null;
    this.musicGain = null;
    this.masterGain = null;
    this.noiseBuffer = null;

    if (this.ctx && this.ctx.state !== 'closed' && typeof this.ctx.close === 'function') {
      try {
        void this.ctx.close();
      } catch {
        /* Ignore close failures on mocked or already-closed contexts. */
      }
    }
    this.ctx = null;
  }

  private ensureContext(): AudioContextLike | null {
    if (this.destroyed) return null;
    if (this.ctx) {
      if (this.ctx.state === 'closed') {
        this.ctx = null;
        this.contextAttempted = false;
      } else {
        return this.ctx;
      }
    }
    if (this.contextAttempted) return null;
    this.contextAttempted = true;
    try {
      this.ctx = this.createContext();
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  private isContextRunning(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  private ensureGraph(ctx: AudioContextLike): void {
    if (this.masterGain && this.sfxGain && this.musicGain) return;
    const now = Math.max(0, ctx.currentTime || 0);
    const master = ctx.createGain();
    const sfx = ctx.createGain();
    const music = ctx.createGain();

    setParam(master.gain, this.preferences.muted ? 0 : 1, now);
    setParam(sfx.gain, this.preferences.sfxVolume * SFX_HEADROOM, now);
    setParam(music.gain, this.preferences.musicVolume * MUSIC_HEADROOM, now);

    sfx.connect(master);
    music.connect(master);
    master.connect(ctx.destination);

    this.masterGain = master;
    this.sfxGain = sfx;
    this.musicGain = music;
  }

  private applyPreferences(settings: SoundSettings): void {
    if (this.destroyed) return;
    const now = Math.max(0, this.ctx?.currentTime || 0);
    if (this.masterGain) {
      setParam(this.masterGain.gain, settings.muted ? 0 : 1, now);
    }
    if (this.sfxGain) {
      setParam(this.sfxGain.gain, settings.sfxVolume * SFX_HEADROOM, now);
    }
    if (this.musicGain) {
      setParam(this.musicGain.gain, settings.musicVolume * MUSIC_HEADROOM, now);
    }

    if (settings.muted || settings.musicVolume <= 0) {
      this.stopMusicLoop();
    } else if (this.musicMode !== 'silent') {
      this.maybeStartMusicLoop();
    }
  }

  private clearGestureListeners(): void {
    for (const cleanup of [...this.sceneGestureCleanups]) {
      cleanup();
    }
    this.sceneGestureCleanups.clear();
  }

  private captureTime(ctx: AudioContextLike): TimestampSample {
    return {
      wallMs: Date.now(),
      ctxMs: Math.max(0, (ctx.currentTime || 0) * 1000),
      customMs: this.customNow ? this.customNow() : undefined
    };
  }

  private elapsedBetween(prev: TimestampSample, next: TimestampSample): number {
    if (prev.customMs !== undefined && next.customMs !== undefined) {
      return Math.max(0, next.customMs - prev.customMs);
    }
    const wallDelta = Math.max(0, next.wallMs - prev.wallMs);
    const ctxDelta = Math.max(0, next.ctxMs - prev.ctxMs);
    return Math.max(wallDelta, ctxDelta);
  }

  private computeXpFrequency(ctx: AudioContextLike): number {
    const sample = this.captureTime(ctx);
    const elapsed = this.lastXpSample
      ? this.elapsedBetween(this.lastXpSample, sample)
      : Number.POSITIVE_INFINITY;
    this.lastXpSample = sample;

    if (elapsed <= XP_COMBO_WINDOW_MS) {
      this.xpStreak = Math.min(this.xpStreak + 1, XP_SEMITONES.length - 1);
    } else {
      this.xpStreak = 0;
    }
    return semitoneFrequency(XP_BASE_HZ, XP_SEMITONES[this.xpStreak]);
  }

  private maybeStartMusicLoop(): void {
    if (this.destroyed || this.musicMode === 'silent' || this.isMuted() || this.musicTimer !== null) return;
    if (this.preferences.musicVolume <= 0) return;

    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;
    this.ensureGraph(ctx);
    if (!this.musicGain) return;

    const mode = this.musicMode;
    const pattern = MUSIC_PATTERNS[mode];
    const gain = ctx.createGain();
    const now = Math.max(0, ctx.currentTime || 0);
    const crossfading = this.fadingMusicTracks.size > 0;
    setParam(gain.gain, crossfading ? 0 : 1, now);
    if (crossfading) linearRamp(gain.gain, 1, now + MUSIC_CROSSFADE_SEC);
    gain.connect(this.musicGain);
    const track: MusicTrack = { gain, voices: new Set() };
    this.musicTrack = track;

    // Ensure starting or unmuting lands immediately on an audible beat rather than a rest.
    for (let i = 0; i < pattern.melody.length; i++) {
      const m = pattern.melody[this.musicStep % pattern.melody.length];
      const b = pattern.bass[this.musicStep % pattern.bass.length];
      if (m !== null || b !== null) break;
      this.musicStep++;
    }
    this.scheduleMusicStep(ctx, track, pattern, mode === 'boss');
    this.musicTimer = setInterval(() => {
      if (this.destroyed || this.isMuted() || this.musicMode === 'silent') {
        this.stopMusicLoop();
        return;
      }
      if (this.ctx !== ctx || ctx.state !== 'running' || this.musicTrack !== track) return;
      this.scheduleMusicStep(ctx, track, pattern, mode === 'boss');
    }, pattern.stepMs);
    const timerHandle = this.musicTimer as unknown as { unref?: () => void };
    if (typeof timerHandle.unref === 'function') {
      timerHandle.unref();
    }
  }

  private stopMusicLoop(crossfade = false): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    const track = this.musicTrack;
    this.musicTrack = null;
    const ctx = this.ctx;
    const canFade = crossfade && ctx?.state === 'running';
    if (track && canFade && track.voices.size) {
      const now = Math.max(0, ctx.currentTime || 0);
      const param = track.gain.gain;
      if (param.cancelAndHoldAtTime) {
        param.cancelAndHoldAtTime(now);
      } else {
        const value = param.value;
        param.cancelScheduledValues?.(now);
        setParam(param, value, now);
      }
      linearRamp(param, 0, now + MUSIC_CROSSFADE_SEC);
      this.fadingMusicTracks.add(track);
    } else if (track) {
      this.stopMusicTrack(track);
    }
    if (!canFade) {
      for (const fadingTrack of this.fadingMusicTracks) this.stopMusicTrack(fadingTrack);
      this.fadingMusicTracks.clear();
    }
  }

  private stopMusicTrack(track: MusicTrack): void {
    safeDisconnect(track.gain);
    for (const voice of track.voices) {
      safeStop(voice);
      safeDisconnect(voice);
    }
    track.voices.clear();
  }

  private scheduleMusicStep(ctx: AudioContextLike, track: MusicTrack, pattern: MusicPattern, battle: boolean): void {
    const idx = this.musicStep++;
    const dest = track.gain;
    const melodyHz = pattern.melody[idx % pattern.melody.length];
    const bassHz = pattern.bass[idx % pattern.bass.length];

    if (melodyHz !== null) {
      const voice = this.playTone(ctx, dest, {
        wave: battle ? 'triangle' : 'sine',
        freq: melodyHz,
        attackSec: battle ? 0.025 : 0.035,
        durationSec: pattern.noteDurationSec,
        gain: pattern.melodyGain,
        filterType: 'lowpass',
        filterFreq: pattern.cutoffHz
      });
      this.trackMusicVoice(track, voice);
    }

    if (bassHz !== null) {
      const voice = this.playTone(ctx, dest, {
        wave: 'triangle',
        freq: bassHz,
        attackSec: battle ? 0.009 : 0.05,
        durationSec: pattern.bassDurationSec,
        gain: pattern.bassGain,
        filterType: 'lowpass',
        filterFreq: pattern.bassCutoffHz
      });
      this.trackMusicVoice(track, voice);
    }
    if (battle) this.scheduleBattleLayers(ctx, track, idx);
  }

  private scheduleBattleLayers(ctx: AudioContextLike, track: MusicTrack, step: number): void {
    const stepInBar = step % 8;
    const bar = Math.floor(step / 8) % BOSS_CHORDS.length;
    const dest = track.gain;
    if (stepInBar === 0 || stepInBar === 3 || stepInBar === 6 || (bar === 3 && stepInBar === 7)) {
      const downbeat = stepInBar === 0;
      this.trackMusicVoice(track, this.playTone(ctx, dest, {
        wave: 'sine', freq: downbeat ? 128 : 160, freqEnd: downbeat ? 44 : 68,
        attackSec: 0.004, durationSec: downbeat ? 0.31 : 0.19, gain: downbeat ? 0.29 : 0.15
      }));
    }
    if (stepInBar === 0 || stepInBar === 2 || stepInBar === 4 || stepInBar === 7) {
      const accent = stepInBar === 0 || stepInBar === 4;
      this.trackMusicVoice(track, this.playNoiseBurst(ctx, dest, {
        attackSec: 0.004, durationSec: accent ? 0.18 : 0.075, gain: accent ? 0.10 : 0.045,
        filterType: 'bandpass', filterFreq: accent ? 1350 : 3000, filterQ: 0.8,
        fallbackFreq: 380, fallbackFreqEnd: 190
      }));
    }
    if (stepInBar === 0 || stepInBar === 4) {
      for (const [index, hz] of BOSS_CHORDS[bar].entries()) {
        this.trackMusicVoice(track, this.playTone(ctx, dest, {
          wave: 'sawtooth', freq: hz, attackSec: 0.055, durationSec: stepInBar === 0 ? 0.94 : 0.67,
          gain: stepInBar === 0 ? 0.095 : 0.065, filterFreq: 960, pan: (index - 1) * 0.34
        }));
      }
    }
  }

  private trackMusicVoice(track: MusicTrack, voice: ActiveVoice | null): void {
    if (!voice) return;
    track.voices.add(voice);
    const prev = voice.onended;
    voice.onended = (event?: unknown) => {
      track.voices.delete(voice);
      prev?.(event);
      if (track.voices.size === 0 && this.fadingMusicTracks.delete(track)) safeDisconnect(track.gain);
    };
  }

  private triggerSound(
    ctx: AudioContextLike,
    dest: GainNodeLike,
    sound: SoundId,
    volume: number,
    pitch: number,
    pan?: number
  ): boolean {
    const p = (hz: number) => hz * pitch;
    const v = (gain: number) => gain * volume;

    switch (sound) {
      case 'shot-spell':
        this.playTone(ctx, dest, { wave: 'sine', freq: p(880), freqEnd: p(1174.66), attackSec: 0.005, durationSec: 0.12, gain: v(0.11), pan });
        this.playTone(ctx, dest, { wave: 'triangle', freq: p(1318.51), delaySec: 0.015, attackSec: 0.004, durationSec: 0.1, gain: v(0.06), filterType: 'lowpass', filterFreq: 2400, pan });
        return true;

      case 'shot-crossbow':
        this.playTone(ctx, dest, { wave: 'triangle', freq: p(330), freqEnd: p(128), attackSec: 0.002, durationSec: 0.075, gain: v(0.18), filterType: 'lowpass', filterFreq: 1400, pan });
        this.playTone(ctx, dest, { wave: 'sine', freq: p(1120), freqEnd: p(640), attackSec: 0.002, durationSec: 0.035, gain: v(0.08), pan });
        return true;

      case 'shot-boomerang':
        this.playNoiseBurst(ctx, dest, { attackSec: 0.025, durationSec: 0.18, gain: v(0.12), filterType: 'bandpass', filterFreq: p(420), filterFreqEnd: p(960), filterQ: 2.2, fallbackFreq: p(310), fallbackFreqEnd: p(520), pan });
        this.playTone(ctx, dest, { wave: 'triangle', freq: p(215), freqEnd: p(275), attackSec: 0.015, durationSec: 0.15, gain: v(0.09), filterType: 'lowpass', filterFreq: 850, pan });
        return true;

      case 'shot-lantern':
        this.playTone(ctx, dest, { wave: 'sine', freq: p(410), freqEnd: p(165), attackSec: 0.003, durationSec: 0.085, gain: v(0.16), pan });
        this.playTone(ctx, dest, { wave: 'triangle', freq: p(980), freqEnd: p(1420), delaySec: 0.01, attackSec: 0.002, durationSec: 0.045, gain: v(0.07), filterType: 'highpass', filterFreq: 650, pan });
        return true;

      case 'xp': {
        const freq = p(this.computeXpFrequency(ctx));
        this.playTone(ctx, dest, { wave: 'sine', freq, attackSec: 0.004, durationSec: 0.14, gain: v(0.14), pan });
        this.playTone(ctx, dest, { wave: 'sine', freq: freq * 1.5, delaySec: 0.012, attackSec: 0.004, durationSec: 0.09, gain: v(0.045), pan });
        return true;
      }

      case 'level':
        this.playArpeggio(ctx, dest, [523.25, 659.25, 783.99, 987.77, 1174.66].map(p), 0.055, {
          wave: 'sine',
          durationSec: 0.36,
          gain: v(0.13),
          overtoneWave: 'triangle',
          overtoneGain: v(0.05),
          pan
        });
        return true;

      case 'awakening':
        this.playArpeggio(ctx, dest, [587.33, 739.99, 880, 1108.73, 1318.51, 1760].map(p), 0.058, {
          wave: 'sine',
          durationSec: 0.48,
          gain: v(0.14),
          overtoneWave: 'triangle',
          overtoneGain: v(0.065),
          pan
        });
        return true;

      case 'hit':
        this.playTone(ctx, dest, { wave: 'sine', freq: p(148), freqEnd: p(56), attackSec: 0.003, durationSec: 0.09, gain: v(0.22), pan });
        this.playNoiseBurst(ctx, dest, { attackSec: 0.002, durationSec: 0.04, gain: v(0.08), filterType: 'lowpass', filterFreq: 460, fallbackFreq: p(180), fallbackFreqEnd: p(95), pan });
        return true;

      case 'defeat':
        this.playTone(ctx, dest, { wave: 'sine', freq: p(260), freqEnd: p(510), attackSec: 0.004, durationSec: 0.07, gain: v(0.14), pan });
        this.playTone(ctx, dest, { wave: 'triangle', freq: p(660), freqEnd: p(780), delaySec: 0.018, attackSec: 0.003, durationSec: 0.07, gain: v(0.06), filterType: 'lowpass', filterFreq: 1800, pan });
        return true;

      case 'dash':
        this.playNoiseBurst(ctx, dest, { attackSec: 0.018, durationSec: 0.16, gain: v(0.14), filterType: 'bandpass', filterFreq: p(620), filterFreqEnd: p(1550), filterQ: 1.6, fallbackFreq: p(520), fallbackFreqEnd: p(340), pan });
        this.playTone(ctx, dest, { wave: 'sine', freq: p(510), freqEnd: p(350), attackSec: 0.01, durationSec: 0.11, gain: v(0.06), pan });
        return true;

      case 'chest':
        this.playTone(ctx, dest, { wave: 'triangle', freq: p(220), freqEnd: p(135), attackSec: 0.002, durationSec: 0.04, gain: v(0.12), filterType: 'lowpass', filterFreq: 900, pan });
        this.playArpeggio(ctx, dest, [783.99, 987.77, 1174.66, 1567.98].map(p), 0.05, {
          wave: 'sine',
          delayOffsetSec: 0.03,
          durationSec: 0.34,
          gain: v(0.13),
          overtoneWave: 'triangle',
          overtoneGain: v(0.045),
          pan
        });
        return true;

      case 'rock':
        this.playArpeggio(ctx, dest, [880, 1108.73, 1318.51, 1760].map(p), 0.045, {
          wave: 'sine',
          durationSec: 0.32,
          gain: v(0.12),
          overtoneWave: 'sine',
          overtoneRatio: 2,
          overtoneGain: v(0.035),
          pan
        });
        return true;

      case 'shrine':
        [293.66, 440, 659.25, 739.99].forEach((hz, idx) => {
          this.playTone(ctx, dest, {
            wave: idx === 0 ? 'triangle' : 'sine',
            freq: p(hz),
            delaySec: idx * 0.02,
            attackSec: 0.025,
            durationSec: 0.68,
            gain: v(idx === 0 ? 0.12 : 0.09),
            filterType: 'lowpass',
            filterFreq: 1800,
            pan
          });
        });
        return true;

      case 'boss-spawn':
        [110, 165, 220].forEach((hz, idx) => {
          this.playTone(ctx, dest, {
            wave: 'triangle',
            freq: p(hz),
            freqEnd: p(hz * 0.96),
            delaySec: idx * 0.035,
            attackSec: 0.07,
            durationSec: 0.62,
            gain: v(idx === 0 ? 0.18 : 0.11),
            filterType: 'lowpass',
            filterFreq: 680,
            pan
          });
        });
        this.playTone(ctx, dest, { wave: 'sine', freq: p(88), freqEnd: p(40), attackSec: 0.008, durationSec: 0.32, gain: v(0.24), pan });
        return true;

      case 'boss-warn':
        this.playTone(ctx, dest, { wave: 'triangle', freq: p(349.23), attackSec: 0.01, durationSec: 0.11, gain: v(0.14), filterType: 'lowpass', filterFreq: 1100, pan });
        this.playTone(ctx, dest, { wave: 'triangle', freq: p(466.16), delaySec: 0.11, attackSec: 0.01, durationSec: 0.15, gain: v(0.15), filterType: 'lowpass', filterFreq: 1200, pan });
        return true;

      case 'boss-impact':
        this.playTone(ctx, dest, { wave: 'sine', freq: p(112), freqEnd: p(36), attackSec: 0.004, durationSec: 0.24, gain: v(0.28), pan });
        this.playNoiseBurst(ctx, dest, { attackSec: 0.004, durationSec: 0.18, gain: v(0.14), filterType: 'lowpass', filterFreq: 480, filterFreqEnd: 130, fallbackFreq: p(140), fallbackFreqEnd: p(60), pan });
        return true;

      case 'boss-defeat':
        this.playTone(ctx, dest, { wave: 'sine', freq: p(128), freqEnd: p(50), attackSec: 0.004, durationSec: 0.34, gain: v(0.22), pan });
        this.playArpeggio(ctx, dest, [293.66, 440, 587.33, 739.99].map(p), 0.095, {
          wave: 'triangle', durationSec: 0.54, gain: v(0.16),
          overtoneWave: 'sine', overtoneRatio: 2, overtoneGain: v(0.045), pan
        });
        for (const hz of [146.83, 220, 369.99]) {
          this.playTone(ctx, dest, {
            wave: 'sawtooth', freq: p(hz), delaySec: 0.285, attackSec: 0.04,
            durationSec: 0.86, gain: v(0.075), filterFreq: 1150, pan
          });
        }
        return true;

      case 'companion-hit':
        this.playTone(ctx, dest, { wave: 'triangle', freq: p(540), freqEnd: p(285), attackSec: 0.003, durationSec: 0.065, gain: v(0.13), filterType: 'lowpass', filterFreq: 1600, pan });
        this.playTone(ctx, dest, { wave: 'sine', freq: p(980), delaySec: 0.008, attackSec: 0.002, durationSec: 0.04, gain: v(0.06), pan });
        return true;

      case 'ui-click':
        this.playTone(ctx, dest, { wave: 'sine', freq: p(640), freqEnd: p(410), attackSec: 0.002, durationSec: 0.036, gain: v(0.11), pan });
        return true;

      case 'upgrade-pick':
        this.playArpeggio(ctx, dest, [659.25, 987.77].map(p), 0.055, {
          wave: 'sine',
          durationSec: 0.22,
          gain: v(0.14),
          overtoneWave: 'triangle',
          overtoneGain: v(0.05),
          pan
        });
        return true;

      default:
        return false;
    }
  }

  private playArpeggio(
    ctx: AudioContextLike,
    dest: GainNodeLike,
    frequencies: number[],
    stepSec: number,
    opts: {
      wave: OscillatorType;
      delayOffsetSec?: number;
      durationSec: number;
      gain: number;
      overtoneWave?: OscillatorType;
      overtoneRatio?: number;
      overtoneGain?: number;
      pan?: number;
    }
  ): void {
    const offset = opts.delayOffsetSec ?? 0;
    frequencies.forEach((hz, i) => {
      const delaySec = offset + i * stepSec;
      this.playTone(ctx, dest, {
        wave: opts.wave,
        freq: hz,
        delaySec,
        attackSec: 0.008,
        durationSec: opts.durationSec,
        gain: opts.gain,
        pan: opts.pan
      });
      if (opts.overtoneWave && opts.overtoneGain) {
        this.playTone(ctx, dest, {
          wave: opts.overtoneWave,
          freq: hz * (opts.overtoneRatio ?? 1),
          delaySec,
          attackSec: 0.008,
          durationSec: opts.durationSec * 0.85,
          gain: opts.overtoneGain,
          filterType: 'lowpass',
          filterFreq: 2200,
          pan: opts.pan
        });
      }
    });
  }

  private playTone(
    ctx: AudioContextLike,
    dest: GainNodeLike,
    spec: ToneSpec
  ): OscillatorNodeLike | null {
    const osc = ctx.createOscillator();
    osc.type = spec.wave;
    const start = Math.max(0, ctx.currentTime || 0) + (spec.delaySec ?? 0);
    const stopAt = start + Math.max(0.02, spec.durationSec);
    setParam(osc.frequency, Math.max(20, spec.freq), start);
    if (spec.freqEnd !== undefined) {
      expRamp(osc.frequency, Math.max(20, spec.freqEnd), stopAt);
    }
    const scheduled = this.scheduleVoice(ctx, osc, dest, {
      delaySec: spec.delaySec,
      attackSec: spec.attackSec,
      durationSec: spec.durationSec,
      gain: spec.gain,
      filterType: spec.filterFreq !== undefined ? (spec.filterType ?? 'lowpass') : undefined,
      filterFreq: spec.filterFreq,
      filterQ: spec.filterQ,
      pan: spec.pan
    });
    return scheduled ? osc : null;
  }

  private playNoiseBurst(ctx: AudioContextLike, dest: GainNodeLike, spec: NoiseSpec): ActiveVoice | null {
    const buffer = this.ensureNoiseBuffer(ctx);
    if (!buffer || typeof ctx.createBufferSource !== 'function') {
      if (spec.fallbackFreq !== undefined) {
        return this.playTone(ctx, dest, {
          wave: 'triangle',
          freq: spec.fallbackFreq,
          freqEnd: spec.fallbackFreqEnd,
          delaySec: spec.delaySec,
          attackSec: spec.attackSec,
          durationSec: spec.durationSec,
          gain: spec.gain * 0.7,
          filterType: 'lowpass',
          filterFreq: spec.filterFreq,
          pan: spec.pan
        });
      }
      return null;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const scheduled = this.scheduleVoice(ctx, source, dest, {
      delaySec: spec.delaySec,
      attackSec: spec.attackSec,
      durationSec: spec.durationSec,
      gain: spec.gain,
      filterType: spec.filterType,
      filterFreq: spec.filterFreq,
      filterFreqEnd: spec.filterFreqEnd,
      filterQ: spec.filterQ,
      pan: spec.pan
    });
    return scheduled ? source : null;
  }

  private scheduleVoice(
    ctx: AudioContextLike,
    source: AudioNodeLike & {
      onended: ((event?: unknown) => void) | null;
      start(when?: number): void;
      stop(when?: number): void;
    },
    dest: GainNodeLike,
    spec: {
      delaySec?: number;
      attackSec?: number;
      durationSec: number;
      gain: number;
      filterType?: BiquadFilterType;
      filterFreq?: number;
      filterFreqEnd?: number;
      filterQ?: number;
      pan?: number;
    }
  ): boolean {
    const start = Math.max(0, ctx.currentTime || 0) + (spec.delaySec ?? 0);
    const attack = Math.min(spec.attackSec ?? 0.005, spec.durationSec * 0.45);
    const stopAt = start + Math.max(0.02, spec.durationSec);
    const env = ctx.createGain();
    const nodesToClean: AudioNodeLike[] = [source, env];

    const peak = Math.max(0.0001, spec.gain);
    setParam(env.gain, 0.0001, start);
    linearRamp(env.gain, peak, start + attack);
    expRamp(env.gain, 0.0001, stopAt);

    let output: AudioNodeLike = source;
    if (spec.filterFreq !== undefined && typeof ctx.createBiquadFilter === 'function') {
      const filter = ctx.createBiquadFilter();
      filter.type = spec.filterType ?? 'lowpass';
      setParam(filter.frequency, Math.max(40, spec.filterFreq), start);
      if (spec.filterFreqEnd !== undefined) {
        expRamp(filter.frequency, Math.max(40, spec.filterFreqEnd), stopAt);
      }
      if (filter.Q && spec.filterQ !== undefined) setParam(filter.Q, spec.filterQ, start);
      output.connect(filter);
      output = filter;
      nodesToClean.push(filter);
    }

    output.connect(env);
    let finalNode: AudioNodeLike = env;
    if (spec.pan !== undefined && spec.pan !== 0 && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      setParam(panner.pan, spec.pan, start);
      env.connect(panner);
      finalNode = panner;
      nodesToClean.push(panner);
    }

    finalNode.connect(dest);
    source.onended = () => {
      for (const node of nodesToClean) safeDisconnect(node);
    };

    try {
      source.start(start);
      source.stop(stopAt + 0.01);
      return true;
    } catch {
      for (const node of nodesToClean) safeDisconnect(node);
      return false;
    }
  }

  private ensureNoiseBuffer(ctx: AudioContextLike): unknown {
    if (this.noiseBuffer) return this.noiseBuffer;
    if (typeof ctx.createBuffer !== 'function') return null;
    try {
      const sampleRate = Math.max(8000, ctx.sampleRate ?? 44100);
      const length = Math.floor(sampleRate * 0.4);
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData?.(0);
      if (data) {
        for (let i = 0; i < length; i++) {
          data[i] = Math.random() * 2 - 1;
        }
      }
      this.noiseBuffer = buffer;
      return buffer;
    } catch {
      return null;
    }
  }
}

export const audioSystem = new AudioSystem();
