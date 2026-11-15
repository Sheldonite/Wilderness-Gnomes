const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const ts = require('typescript');

const prefsModule = require('../artifacts/ability-tests/game/core/SoundPreferences.js');
const {
  SOUND_STORAGE_KEY,
  DEFAULT_SOUND_PREFERENCES,
  SoundPreferences,
  loadSoundPreferences,
  saveSoundPreferences,
  toggleMuted
} = prefsModule;

function loadAudioSystemModule() {
  const sourcePath = path.join(__dirname, '..', 'src', 'game', 'systems', 'AudioSystem.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    },
    fileName: sourcePath
  });
  const mod = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier === '../core/SoundPreferences') return prefsModule;
    return require(specifier);
  };
  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', transpiled.outputText);
  fn(mod.exports, localRequire, mod, sourcePath, path.dirname(sourcePath));
  return mod.exports;
}

const { AudioSystem, SOUND_IDS } = loadAudioSystemModule();

function memoryStorage(initial) {
  const data = new Map(initial ? [[SOUND_STORAGE_KEY, JSON.stringify(initial)]] : []);
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    data
  };
}

function createFakeAudioParam(initial = 0) {
  const calls = [];
  return {
    value: initial,
    calls,
    setValueAtTime(value, startTime) {
      this.value = value;
      calls.push({ op: 'set', value, startTime });
    },
    linearRampToValueAtTime(value, endTime) {
      calls.push({ op: 'linear', value, endTime });
    },
    exponentialRampToValueAtTime(value, endTime) {
      calls.push({ op: 'exp', value, endTime });
    }
  };
}

function createFakeAudioContext(options = {}) {
  const oscillators = [];
  const gains = [];
  const filters = [];
  const bufferSources = [];
  const panners = [];
  const connections = [];
  let closed = false;
  let resumed = 0;

  const ctx = {
    state: options.state ?? 'running',
    currentTime: options.currentTime ?? 0,
    sampleRate: 44100,
    destination: { kind: 'destination' },
    oscillators,
    gains,
    filters,
    bufferSources,
    panners,
    connections,
    get closed() { return closed; },
    get resumeCalls() { return resumed; },
    resume() {
      resumed++;
      if (options.rejectResume) return Promise.reject(new Error('blocked'));
      if (options.asyncResume) {
        return Promise.resolve().then(() => {
          ctx.state = 'running';
        });
      }
      ctx.state = 'running';
      return Promise.resolve();
    },
    close() {
      closed = true;
      ctx.state = 'closed';
      return Promise.resolve();
    },
    createGain() {
      const node = {
        kind: 'gain',
        gain: createFakeAudioParam(1),
        disconnected: false,
        connect(dest) { connections.push([node, dest]); return dest; },
        disconnect() { node.disconnected = true; }
      };
      gains.push(node);
      return node;
    },
    createOscillator() {
      const node = {
        kind: 'oscillator',
        type: 'sine',
        frequency: createFakeAudioParam(440),
        onended: null,
        startedAt: null,
        stoppedAt: null,
        stoppedCount: 0,
        disconnected: false,
        connect(dest) { connections.push([node, dest]); return dest; },
        disconnect() { node.disconnected = true; },
        start(when = 0) { node.startedAt = when; },
        stop(when = 0) { node.stoppedAt = when; node.stoppedCount++; }
      };
      oscillators.push(node);
      return node;
    }
  };

  if (options.withFilter !== false) {
    ctx.createBiquadFilter = () => {
      const node = {
        kind: 'filter',
        type: 'lowpass',
        frequency: createFakeAudioParam(1000),
        Q: createFakeAudioParam(1),
        disconnected: false,
        connect(dest) { connections.push([node, dest]); return dest; },
        disconnect() { node.disconnected = true; }
      };
      filters.push(node);
      return node;
    };
  }

  if (options.withBuffers !== false) {
    ctx.createBuffer = (channels, length, sampleRate) => {
      const channelData = new Float32Array(length);
      return { channels, length, sampleRate, getChannelData: () => channelData };
    };
    ctx.createBufferSource = () => {
      const node = {
        kind: 'buffer-source',
        buffer: null,
        loop: false,
        onended: null,
        startedAt: null,
        stoppedAt: null,
        disconnected: false,
        connect(dest) { connections.push([node, dest]); return dest; },
        disconnect() { node.disconnected = true; },
        start(when = 0) { node.startedAt = when; },
        stop(when = 0) { node.stoppedAt = when; }
      };
      bufferSources.push(node);
      return node;
    };
  }

  if (options.withPanner !== false) {
    ctx.createStereoPanner = () => {
      const node = {
        kind: 'panner',
        pan: createFakeAudioParam(0),
        disconnected: false,
        connect(dest) { connections.push([node, dest]); return dest; },
        disconnect() { node.disconnected = true; }
      };
      panners.push(node);
      return node;
    };
  }

  return ctx;
}

function createMockScene() {
  const events = new EventEmitter();
  const input = new EventEmitter();
  input.keyboard = new EventEmitter();
  return { events, input };
}

test('SoundPreferences safely defaults when localStorage is unavailable or throws', () => {
  assert.deepEqual(loadSoundPreferences(null), DEFAULT_SOUND_PREFERENCES);
  assert.deepEqual(loadSoundPreferences(), DEFAULT_SOUND_PREFERENCES);

  const throwingStorage = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('QuotaExceededError'); }
  };
  assert.deepEqual(loadSoundPreferences(throwingStorage), DEFAULT_SOUND_PREFERENCES);
  assert.deepEqual(
    saveSoundPreferences({ muted: true, sfxVolume: 0.4 }, throwingStorage),
    { muted: true, sfxVolume: 0.4, musicVolume: DEFAULT_SOUND_PREFERENCES.musicVolume }
  );

  const store = new SoundPreferences(throwingStorage);
  assert.equal(store.muted, false);
  store.toggleMuted();
  assert.equal(store.muted, true);
  store.setVolumes(0.9, 0.2);
  assert.equal(store.sfxVolume, 0.9);
  assert.equal(store.musicVolume, 0.2);
});

test('SoundPreferences persists under wilderness-gnomes-sound-v1, validates corrupt data, and clamps volumes', () => {
  const storage = memoryStorage();
  const saved = saveSoundPreferences({ muted: true, sfxVolume: 1.5, musicVolume: -0.4 }, storage);
  assert.deepEqual(saved, { muted: true, sfxVolume: 1, musicVolume: 0 });
  assert.equal(storage.getItem(SOUND_STORAGE_KEY), JSON.stringify({ muted: true, sfxVolume: 1, musicVolume: 0 }));
  assert.deepEqual(loadSoundPreferences(storage), { muted: true, sfxVolume: 1, musicVolume: 0 });

  const flipped = toggleMuted(storage);
  assert.deepEqual(flipped, { muted: false, sfxVolume: 1, musicVolume: 0 });
  assert.equal(loadSoundPreferences(storage).muted, false);

  storage.setItem(SOUND_STORAGE_KEY, '{broken-json');
  assert.deepEqual(loadSoundPreferences(storage), DEFAULT_SOUND_PREFERENCES);

  storage.setItem(SOUND_STORAGE_KEY, JSON.stringify({ muted: 'yes', sfxVolume: Number.NaN, musicVolume: 0.3 }));
  assert.deepEqual(loadSoundPreferences(storage), {
    muted: false,
    sfxVolume: DEFAULT_SOUND_PREFERENCES.sfxVolume,
    musicVolume: 0.3
  });
});

test('SoundPreferences store notifies subscribers, supports both setVolumes forms, and protects copies', () => {
  const storage = memoryStorage();
  const store = new SoundPreferences(storage);
  const events = [];
  const unsubscribe = store.subscribe(settings => events.push(settings));

  store.setVolumes(0.8, 0.25);
  store.setVolumes({ musicVolume: 0.5 });
  store.toggleMuted();
  unsubscribe();
  store.setMuted(false);

  assert.equal(events.length, 3);
  assert.deepEqual(events[0], { muted: false, sfxVolume: 0.8, musicVolume: 0.25 });
  assert.deepEqual(events[1], { muted: false, sfxVolume: 0.8, musicVolume: 0.5 });
  assert.deepEqual(events[2], { muted: true, sfxVolume: 0.8, musicVolume: 0.5 });

  const copy = store.current;
  copy.muted = true;
  copy.sfxVolume = 0;
  assert.equal(store.muted, false);
  assert.equal(store.sfxVolume, 0.8);

  const reloaded = new SoundPreferences(storage);
  assert.deepEqual(reloaded.current, store.current);
});

test('AudioSystem gracefully no-ops when AudioContext is missing, throws, or is suspended', () => {
  const missing = new AudioSystem({
    preferences: new SoundPreferences(null),
    createContext: () => null
  });
  assert.equal(missing.play('shot-spell'), false);
  missing.setMusicMode('woods');
  assert.equal(missing.toggleMute(), true);
  missing.setVolumes(0.5, 0.5);
  missing.destroy();

  const throwing = new AudioSystem({
    preferences: new SoundPreferences(null),
    createContext: () => { throw new Error('AudioContext disabled'); }
  });
  assert.equal(throwing.play('xp'), false);
  throwing.destroy();

  const suspendedCtx = createFakeAudioContext({ state: 'suspended' });
  const suspended = new AudioSystem({
    preferences: new SoundPreferences(null),
    createContext: () => suspendedCtx
  });
  assert.equal(suspended.play('level'), false);
  suspended.setMusicMode('title');
  assert.equal(suspendedCtx.oscillators.length, 0);
  assert.equal(suspendedCtx.gains.length, 0);
  suspended.destroy();
});

test('AudioSystem synthesizes all 19 SFX cleanly with and without optional Web Audio nodes', () => {
  const ctx = createFakeAudioContext();
  const audio = new AudioSystem({
    preferences: new SoundPreferences(null),
    createContext: () => ctx
  });

  for (const sound of SOUND_IDS) {
    const before = ctx.oscillators.length;
    assert.equal(audio.play(sound, { force: true }), true, `${sound} should play`);
    assert.ok(ctx.oscillators.length > before, `${sound} should schedule at least one oscillator`);
  }
  assert.ok(ctx.bufferSources.length >= 4, 'noise bursts should be used for whooshes/impacts');

  // Minimal AudioContext without filters, buffers, or stereo panners still plays every SFX safely.
  const minimalCtx = createFakeAudioContext({ withFilter: false, withBuffers: false, withPanner: false });
  const minimalAudio = new AudioSystem({
    preferences: new SoundPreferences(null),
    createContext: () => minimalCtx
  });
  for (const sound of SOUND_IDS) {
    assert.equal(minimalAudio.play(sound, { pan: 0.5, force: true }), true, `minimal ${sound} should play`);
  }
  assert.ok(minimalCtx.oscillators.length >= SOUND_IDS.length);

  audio.destroy();
  minimalAudio.destroy();
});

test('XP chime pitch climbs subtly on rapid pickups within 350ms and resets after a pause', () => {
  let clockMs = 1000;
  const ctx = createFakeAudioContext();
  const audio = new AudioSystem({
    preferences: new SoundPreferences(null),
    createContext: () => ctx,
    now: () => clockMs
  });

  const primaryFreqs = [];
  for (let i = 0; i < 5; i++) {
    const before = ctx.oscillators.length;
    assert.equal(audio.play('xp'), true);
    primaryFreqs.push(ctx.oscillators[before].frequency.value);
    clockMs += 120;
  }

  for (let i = 1; i < primaryFreqs.length; i++) {
    assert.ok(primaryFreqs[i] > primaryFreqs[i - 1], `step ${i} (${primaryFreqs[i]}) > step ${i - 1} (${primaryFreqs[i - 1]})`);
  }

  // Pause longer than ~350ms resets the combo pitch back to the base note.
  clockMs += 400;
  const resetIdx = ctx.oscillators.length;
  assert.equal(audio.play('xp'), true);
  assert.equal(ctx.oscillators[resetIdx].frequency.value, primaryFreqs[0]);

  audio.destroy();
});

test('AudioSystem rate-limits rapid hit stacking unless forced and honors pitch/volume options', () => {
  let clockMs = 100;
  const ctx = createFakeAudioContext();
  const audio = new AudioSystem({
    preferences: new SoundPreferences(null),
    createContext: () => ctx,
    now: () => clockMs
  });

  assert.equal(audio.play('hit'), true);
  assert.equal(audio.play('hit'), false, 'simultaneous hit in same frame is throttled');
  clockMs += 40;
  assert.equal(audio.play('hit'), true, 'hit after cooldown plays');

  const idx = ctx.oscillators.length;
  assert.equal(audio.play('ui-click', { pitch: 1.5, volume: 0 }), false);
  assert.equal(audio.play('ui-click', { pitch: 1.5, volume: 0.5 }), true);
  assert.equal(ctx.oscillators[idx].frequency.value, 640 * 1.5);

  audio.destroy();
});

test('AudioSystem mute, volume changes, and ambient music modes start/stop cleanly', () => {
  const storage = memoryStorage();
  const prefs = new SoundPreferences(storage);
  const ctx = createFakeAudioContext();
  const audio = new AudioSystem({ preferences: prefs, createContext: () => ctx });

  // Starting music emits filtered sine/triangle voices at subtle low volume.
  audio.setMusicMode('woods');
  assert.equal(audio.getMusicMode(), 'woods');
  assert.ok(ctx.oscillators.length >= 2, 'opening music step schedules soft melody + bass');
  assert.ok(ctx.filters.every(f => f.type === 'lowpass'), 'ambient music filters triangle/sine voices');

  const firstMusicOsc = ctx.oscillators[0];
  assert.equal(firstMusicOsc.stoppedCount, 1); // scheduled stop(stopAt)

  // Muting immediately silences master gain, blocks SFX, and stops active music voices.
  assert.equal(audio.toggleMute(), true);
  assert.equal(audio.isMuted(), true);
  assert.equal(ctx.gains[0].gain.value, 0);
  assert.ok(firstMusicOsc.stoppedCount >= 2 && firstMusicOsc.disconnected);
  assert.equal(audio.play('chest'), false);
  assert.equal(loadSoundPreferences(storage).muted, true);

  // Unmuting restores master gain and resumes the active music mode.
  const oscBeforeUnmute = ctx.oscillators.length;
  assert.equal(audio.toggleMute(), false);
  assert.equal(ctx.gains[0].gain.value, 1);
  assert.ok(ctx.oscillators.length > oscBeforeUnmute);

  // Updating volumes updates gain bus and persists.
  audio.setVolumes(0.2, 0.1);
  assert.deepEqual(audio.getVolumes(), { sfxVolume: 0.2, musicVolume: 0.1 });
  assert.deepEqual(loadSoundPreferences(storage), { muted: false, sfxVolume: 0.2, musicVolume: 0.1 });
  assert.ok(Math.abs(ctx.gains[1].gain.value - 0.2 * 0.72) < 1e-6);
  assert.ok(Math.abs(ctx.gains[2].gain.value - 0.1 * 0.28) < 1e-6);

  // Switching through all music modes and stopping on silent works cleanly.
  for (const mode of ['title', 'market', 'boss', 'silent']) {
    audio.setMusicMode(mode);
    assert.equal(audio.getMusicMode(), mode);
  }

  audio.destroy();
  assert.equal(ctx.closed, true);
  assert.equal(audio.play('ui-click'), false);
});

test('attachScene wires presentation and audio:play events, unlocks on gesture, and cleans up on shutdown', async () => {
  const ctx = createFakeAudioContext({ state: 'suspended' });
  let clockMs = 500;
  const audio = new AudioSystem({
    preferences: new SoundPreferences(null),
    createContext: () => ctx,
    now: () => clockMs
  });
  const scene = createMockScene();

  audio.setMusicMode('market');
  audio.attachScene(scene);

  // While suspended, presentation events no-op gracefully.
  scene.events.emit('presentation:collect', { x: 10, y: 20 });
  assert.equal(ctx.oscillators.length, 0);

  // First pointerdown gesture unlocks AudioContext and starts pending music.
  scene.input.emit('pointerdown');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ctx.state, 'running');
  assert.equal(ctx.resumeCalls, 1);
  const afterUnlockCount = ctx.oscillators.length;
  assert.ok(afterUnlockCount > 0, 'pending market music starts upon unlock');

  scene.events.emit('presentation:hit', { x: 0, y: 0 });
  clockMs += 50;
  scene.events.emit('presentation:defeat', { x: 0, y: 0 });
  scene.events.emit('presentation:collect', { x: 0, y: 0 });
  scene.events.emit('presentation:level', { x: 0, y: 0 });
  scene.events.emit('audio:play', 'boss-spawn');
  scene.events.emit('audio:play', { sound: 'shrine', volume: 0.8 });

  assert.ok(ctx.oscillators.length > afterUnlockCount);

  // Shutdown detaches all scene listeners cleanly.
  scene.events.emit('shutdown');
  const countAfterShutdown = ctx.oscillators.length;
  scene.events.emit('presentation:collect', { x: 0, y: 0 });
  scene.events.emit('audio:play', 'awakening');
  assert.equal(ctx.oscillators.length, countAfterShutdown);

  audio.destroy();
});
