const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { BALANCE } = require('../artifacts/ability-tests/game/config/balance.js');
const { STAG } = require('../artifacts/ability-tests/game/config/stagBoss.js');
const { KING } = require('../artifacts/ability-tests/game/config/kingBoss.js');
const { SceneryNavigation } = require('../artifacts/ability-tests/game/core/SceneryNavigation.js');

function createHarness({ reducedMotion = false } = {}) {
  const cache = new Map();

  class EventBus {
    constructor() {
      this.listeners = new Map();
      this.emitted = [];
    }
    on(event, fn) {
      if (!this.listeners.has(event)) this.listeners.set(event, new Set());
      this.listeners.get(event).add(fn);
      return this;
    }
    off(event, fn) {
      this.listeners.get(event)?.delete(fn);
      return this;
    }
    once(event, fn) {
      const wrapped = (...args) => {
        this.off(event, wrapped);
        fn(...args);
      };
      return this.on(event, wrapped);
    }
    emit(event, ...args) {
      this.emitted.push({ event, args });
      for (const fn of this.listeners.get(event) ?? []) {
        fn(...args);
      }
      return true;
    }
  }

  class RandomDataGenerator {
    constructor(seeds) {
      let hash = 2166136261;
      for (const s of String(seeds?.[0] ?? 'seed')) {
        hash ^= s.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
      }
      this.state = (hash >>> 0) || 1;
    }
    next() {
      this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
      return this.state / 4294967296;
    }
    frac() { return this.next(); }
    between(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; }
    realInRange(min, max) { return min + this.next() * (max - min); }
    pick(list) { return list[this.between(0, list.length - 1)]; }
  }

  function makeGameObject(extra = {}) {
    return {
      x: 0,
      y: 0,
      width: 64,
      height: 64,
      displayWidth: 64,
      displayHeight: 64,
      originX: 0.5,
      originY: 0.5,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      depth: 0,
      rotation: 0,
      visible: true,
      scrollX: 1,
      scrollY: 1,
      tint: undefined,
      tintFill: undefined,
      flipX: false,
      data: {},
      cmds: [],
      anims: { isPaused: false, pause() {}, resume() {}, stop() {}, currentAnim: null },
      setPosition(x, y) { this.x = x; this.y = y; return this; },
      setOrigin(x = 0.5, y = x) { this.originX = x; this.originY = y; return this; },
      setDepth(d) { this.depth = d; return this; },
      setScale(x, y = x) { this.scaleX = x; this.scaleY = y; return this; },
      setDisplaySize(w, h) { this.displayWidth = w; this.displayHeight = h; return this; },
      setAlpha(a) { this.alpha = a; return this; },
      setVisible(v) { this.visible = v; return this; },
      setScrollFactor(x, y = x) { this.scrollX = x; this.scrollY = y; return this; },
      setRotation(r) { this.rotation = r; return this; },
      setFlipX(f) { this.flipX = f; return this; },
      setTint(c) { this.tint = c; return this; },
      setTintFill(c) { this.tintFill = c; return this; },
      clearTint() { this.tint = undefined; this.tintFill = undefined; return this; },
      setTexture(k) { this.texture = { key: k }; return this; },
      setFrame(f) { this.frame = f; return this; },
      setAngle(a) { this.angle = a; return this; },
      setData(k, v) { this.data[k] = v; return this; },
      getData(k) { return this.data[k]; },
      play(k) { this.animation = k; return this; },
      once() { return this; },
      destroy() { this.destroyed = true; },
      ...extra
    };
  }

  function createMockScene() {
    const events = new EventBus();
    const scaleEvents = new EventBus();
    const created = { images: [], texts: [], graphics: [], sprites: [], ellipses: [] };
    const texturesMap = new Set();
    const scene = {
      events,
      scale: {
        width: 1280,
        height: 720,
        on: (ev, fn) => scaleEvents.on(ev, fn),
        off: (ev, fn) => scaleEvents.off(ev, fn)
      },
      cameras: { main: { shakeCalls: [], shake(d, i) { this.shakeCalls.push({ d, i }); } } },
      textures: {
        exists: (k) => texturesMap.has(k),
        createCanvas: (k) => {
          texturesMap.add(k);
          const ctx = {
            lineCap: '', lineJoin: '', strokeStyle: '', fillStyle: '', lineWidth: 1, globalAlpha: 1,
            beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {},
            ellipse() {}, fillRect() {}, strokeRect() {}, save() {}, restore() {},
            translate() {}, rotate() {}, drawImage() {}, createPattern() { return '#5b8a78'; }
          };
          return { context: ctx, refresh() {} };
        },
        get: () => ({ getSourceImage: () => ({}) }),
        getFrame: () => ({ cutX: 0, cutY: 0, cutWidth: 64, cutHeight: 64, realHeight: 64 })
      },
      add: {
        sprite(x, y, texture) {
          const obj = makeGameObject({ x, y, scene, texture: { key: texture } });
          created.sprites.push(obj);
          return obj;
        },
        tileSprite(x, y, w, h, texture) {
          return makeGameObject({ x, y, width: w, height: h, texture: { key: texture } });
        },
        image(x, y, texture, frame) {
          const obj = makeGameObject({ x, y, texture: { key: texture }, frame });
          created.images.push(obj);
          return obj;
        },
        ellipse(x, y, w, h, color, alpha) {
          const obj = makeGameObject({ x, y, width: w, height: h, color, alpha, setStrokeStyle() { return this; } });
          created.ellipses.push(obj);
          return obj;
        },
        text(x, y, text, style) {
          const obj = makeGameObject({
            x, y, text, style: { ...style },
            setText(t) { this.text = t; return this; },
            setColor(c) { this.style.color = c; return this; },
            setFontSize(sz) { this.style.fontSize = sz; return this; }
          });
          created.texts.push(obj);
          return obj;
        },
        graphics() {
          const obj = makeGameObject({
            fillStyle(color, alpha) { this.lastFill = { color, alpha }; this.cmds.push(['fillStyle', color, alpha]); return this; },
            lineStyle(w, color, alpha) { this.lastLine = { w, color, alpha }; this.cmds.push(['lineStyle', w, color, alpha]); return this; },
            fillRect(x, y, w, h) { this.cmds.push(['fillRect', x, y, w, h]); return this; },
            fillCircle(x, y, r) { this.cmds.push(['fillCircle', x, y, r]); return this; },
            strokeCircle(x, y, r) { this.cmds.push(['strokeCircle', x, y, r]); return this; },
            fillTriangle(...pts) { this.cmds.push(['fillTriangle', ...pts]); return this; },
            beginPath() { this.cmds.push(['beginPath']); return this; },
            moveTo(x, y) { this.cmds.push(['moveTo', x, y]); return this; },
            lineTo(x, y) { this.cmds.push(['lineTo', x, y]); return this; },
            closePath() { this.cmds.push(['closePath']); return this; },
            fillPath() { this.cmds.push(['fillPath']); return this; },
            strokePath() { this.cmds.push(['strokePath']); return this; },
            clear() { this.cmds.length = 0; return this; }
          });
          created.graphics.push(obj);
          return obj;
        }
      }
    };
    return { scene, created, events };
  }

  const phaser = {
    Math: {
      Clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
      Between: (min, max) => Math.floor((min + max) / 2),
      Angle: { Between: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1) },
      RandomDataGenerator
    }
  };

  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} };
    cache.set(filename, mod);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText;
    vm.runInNewContext(code, {
      module: mod,
      exports: mod.exports,
      Math,
      Number,
      Set,
      Map,
      String,
      Array,
      Object,
      window: { matchMedia: () => ({ matches: reducedMotion }) },
      require: (id) => {
        if (id === 'phaser') return phaser;
        if (/\.(png|jpe?g|webp|svg|gif)$/i.test(id)) return id;
        return load(path.resolve(path.dirname(filename), `${id}.ts`));
      }
    }, { filename });
    return mod.exports;
  }

  return { load, createMockScene };
}

test('hitTreeTrunk and resolveTreeTrunkBlock accurately detect and push out of tree trunks', () => {
  const { load } = createHarness();
  const { hitTreeTrunk, resolveTreeTrunkBlock } = load('src/game/systems/ScenerySystem.ts');
  const trunks = [{ x: 300, y: 200, radius: 24 }, { x: 800, y: 800, radius: 24 }];

  const miss = hitTreeTrunk(trunks, { x: 100, y: 100 }, { x: 500, y: 100 }, 20);
  assert.equal(miss, undefined);

  const hit = hitTreeTrunk(trunks, { x: 100, y: 200 }, { x: 320, y: 200 }, 26);
  assert.ok(hit, 'direct horizontal path through trunk should register hit');
  assert.ok(Math.abs(hit.point.x - 250) < 0.01, `expected contact near x=250, got ${hit.point.x}`);
  assert.ok(Math.abs(hit.point.y - 200) < 0.01);
  assert.ok(hit.normal.x < -0.99 && Math.abs(hit.normal.y) < 0.01);

  const resolved = resolveTreeTrunkBlock(trunks, { x: 240, y: 200 }, { x: 270, y: 200 }, 26);
  assert.ok(Math.hypot(resolved.x - 300, resolved.y - 200) >= 49.9);
});

test('ScenerySystem plants inner trees accessible around start and ensures boss arena trees', () => {
  const { load, createMockScene } = createHarness();
  const { ScenerySystem } = load('src/game/systems/ScenerySystem.ts');
  const { scene } = createMockScene();
  const scenery = new ScenerySystem(scene);
  scenery.create();

  assert.ok(scenery.treeTrunks.length > 50, 'forest props populate treeTrunks');
  assert.ok(scenery.navigation.treeCollider, 'navigation exposes attached treeCollider without breaking walkability');

  // Verify normal crowd pathing across trees remains unblocked while treeCollider reports trunk hits.
  const firstTrunk = scenery.treeTrunks[0];
  assert.equal(scenery.navigation.blocked(firstTrunk, 18), false, 'navigation stays smooth for regular crowds');
  const blockedPos = scenery.resolveTreeBlock({ x: firstTrunk.x - 60, y: firstTrunk.y }, firstTrunk, 18);
  assert.ok(Math.hypot(blockedPos.x - firstTrunk.x, blockedPos.y - firstTrunk.y) >= firstTrunk.radius + 17.9, 'treeCollider resolves trunk collision');

  const centerRingCount = scenery.treeTrunks.filter((t) => {
    const d = Math.hypot(t.x - 1600, t.y - 1600);
    return d >= 180 && d <= 500;
  }).length;
  assert.ok(centerRingCount >= 4, `expected >= 4 inner trees inside 500px of start, got ${centerRingCount}`);

  // Ensure an isolated empty corner receives guaranteed boss arena trees away from player spawn.
  const isolatedCenter = { x: 700, y: 700 };
  const added = scenery.ensureArenaTrees(isolatedCenter, 520, 3, [isolatedCenter]);
  const arenaTrunks = scenery.treeTrunks.filter((t) => {
    const d = Math.hypot(t.x - isolatedCenter.x, t.y - isolatedCenter.y);
    return d >= 120 && d <= 450;
  });
  assert.ok(added >= 0 && arenaTrunks.length >= 3, 'ensureArenaTrees guarantees >= 3 trees inside boss arena');
});

test('StagBoss charging into a tree stuns Wonky, enables stun vulnerability, and shakes camera', () => {
  const { load, createMockScene } = createHarness();
  const { StagBoss } = load('src/game/entities/StagBoss.ts');
  const { StagEncounter } = load('src/game/core/StagEncounter.ts');
  const { hitTreeTrunk } = load('src/game/systems/ScenerySystem.ts');
  const { scene, events } = createMockScene();

  const nav = new SceneryNavigation(false, false);
  const trunks = [];
  nav.treeCollider = { hitTree: (from, to, r) => hitTreeTrunk(trunks, from, to, r) };

  const quiet = () => {};
  const encounter = new StagEncounter();
  encounter.shouldSpawn(STAG.level);
  const player = { x: 1320, y: 1000 };
  const stag = new StagBoss(scene, { x: 1000, y: 1000 }, nav, encounter);

  encounter.update(STAG.introductionMs, { x: stag.position.x, y: stag.position.y }, player, 18, 1, quiet);
  encounter.update(900, { x: stag.position.x, y: stag.position.y }, player, 18, 1, quiet);
  assert.equal(encounter.phase, 'windup');
  encounter.update(STAG.windupMs, { x: stag.position.x, y: stag.position.y }, player, 18, 1, quiet);
  assert.equal(encounter.phase, 'charging');

  // Place a sturdy oak directly in Wonky's locked charge path
  trunks.push({
    x: stag.position.x + encounter.lane.direction.x * 160,
    y: stag.position.y + encounter.lane.direction.y * 160,
    radius: 24
  });

  // Step frames until Wonky crashes into the tree trunk
  for (let i = 0; i < 30 && encounter.phase === 'charging'; i++) {
    encounter.update(25, { x: stag.position.x, y: stag.position.y }, player, 18, 1, quiet);
    stag.update(25, player, 0);
  }

  assert.equal(encounter.phase, 'stunned', 'hitting a tree must stun Wonky');
  assert.equal(encounter.vulnerable, true);
  assert.equal(stag.vulnerability, STAG.stunVulnerability);
  assert.ok(scene.cameras.main.shakeCalls.length > 0, 'tree impact triggers camera shake');
  assert.ok(events.emitted.some((e) => e.event === 'presentation:level'), 'tree impact emits burst');

  const emittedDamage = [];
  events.on('presentation:damage', (p) => emittedDamage.push(p));
  const healthBefore = stag.health;
  const killed = stag.takeDamage(100);
  assert.equal(killed, false);
  assert.equal(healthBefore - stag.health, 100 * STAG.stunVulnerability);
  assert.equal(emittedDamage.length, 1);
  assert.equal(emittedDamage[0].amount, 100 * STAG.stunVulnerability);
  assert.equal(emittedDamage[0].vulnerability, STAG.stunVulnerability);
  assert.equal(emittedDamage[0].isBoss, true);
});

test('KingBoss rolls straight through tree trunks without bouncing', () => {
  const { load, createMockScene } = createHarness();
  const { KingBoss } = load('src/game/entities/KingBoss.ts');
  const { KingEncounter } = load('src/game/core/KingEncounter.ts');
  const { hitTreeTrunk } = load('src/game/systems/ScenerySystem.ts');
  const { scene, events } = createMockScene();

  const nav = new SceneryNavigation(false, false);
  const trunks = [];
  nav.treeCollider = { hitTree: (from, to, r) => hitTreeTrunk(trunks, from, to, r) };

  const quiet = () => {};
  const arena = { center: { x: 1000, y: 1000 }, radius: 520 };
  const encounter = new KingEncounter();
  encounter.shouldSpawn(KING.level);
  const player = { x: 1320, y: 1000 };
  const king = new KingBoss(scene, { x: 1000, y: 1000 }, nav, encounter);

  encounter.update(KING.introductionMs, { x: king.position.x, y: king.position.y }, player, 18, 1, arena, quiet);
  encounter.update(1000, { x: king.position.x, y: king.position.y }, player, 18, 1, arena, quiet);
  assert.equal(encounter.phase, 'curling');
  encounter.update(KING.curlMs, { x: king.position.x, y: king.position.y }, player, 18, 1, arena, quiet);
  assert.equal(encounter.phase, 'rolling');
  const initialDir = { ...encounter.direction };

  // Place a sturdy oak directly ahead on King Rumbles's roll trajectory
  trunks.push({
    x: king.position.x + initialDir.x * 130,
    y: king.position.y + initialDir.y * 130,
    radius: 24
  });

  const start = { ...king.position };
  for (let i = 0; i < 12; i++) {
    encounter.update(25, { x: king.position.x, y: king.position.y }, player, 18, 1, arena, quiet);
    king.update(25, player, 0);
    const dot = encounter.direction.x * initialDir.x + encounter.direction.y * initialDir.y;
    assert.ok(dot > 0.99, 'King Rumbles keeps rolling in the same direction through the tree');
    assert.equal(encounter.ripples.length, 0, 'no tree ripple');
  }
  const travelled = (king.position.x - start.x) * initialDir.x + (king.position.y - start.y) * initialDir.y;
  assert.ok(travelled > 154, `rolled past the trunk (travelled ${travelled})`);
  assert.equal(scene.cameras.main.shakeCalls.length, 0);
  assert.ok(!events.emitted.some((e) => e.event === 'presentation:level'));
});

test('stampeding deer break against tree trunks and halt their stampede', () => {
  const { load, createMockScene } = createHarness();
  const { EnemyController } = load('src/game/entities/EnemyController.ts');
  const { hitTreeTrunk } = load('src/game/systems/ScenerySystem.ts');
  const { scene, events } = createMockScene();

  const nav = new SceneryNavigation(false, false);
  const trunks = [{ x: 1110, y: 1000, radius: 24 }];
  nav.treeCollider = { hitTree: (from, to, r) => hitTreeTrunk(trunks, from, to, r) };

  const buck = new EnemyController(scene, 1000, 1000, 0, nav, undefined, 'buck');
  buck.stampede({ x: 1, y: 0 }, 420, 900);

  for (let i = 0; i < 12; i++) {
    buck.update(30, { x: 1500, y: 1000 }, 0);
  }
  const stoppedX = buck.position.x;
  assert.ok(stoppedX < 1110, `stampeding buck (${stoppedX}) should break before trunk center 1110`);
  assert.equal(buck.stampeding, false, 'buck stampede run ends immediately on tree hit');
  assert.ok(events.emitted.some((e) => e.event === 'presentation:trail'), 'tree break emits impact dust/trail');

  // On subsequent frame, since run ended on tree impact, buck moves only at normal speed (<= normal speed * dt).
  const beforeNormal = buck.position.x;
  buck.update(50, { x: 1500, y: 1000 }, 0);
  assert.ok(buck.position.x - beforeNormal < (420 * 0.05) - 1, 'buck should no longer be moving at stampede run speed');
});

test('PlayerController supports Arrow keys, Woodland Dash burst/cooldown/i-frames, and hit blink', () => {
  const { load, createMockScene } = createHarness({ reducedMotion: false });
  const { PlayerController, WOODLAND_DASH } = load('src/game/entities/PlayerController.ts');
  const { scene, events } = createMockScene();
  const nav = new SceneryNavigation(false, false);

  const stats = {
    weaponId: 'spell',
    speed: BALANCE.player.speed,
    shoutMoveSpeedBonus: 0,
    moveSlow: 1,
    characterId: 'sheldon'
  };
  const character = {
    id: 'sheldon',
    textureKey: 'player',
    scale: 1,
    radius: BALANCE.player.radius,
    idleAnimation: { key: 'idle', flipX: false },
    animationForDirection: (dir) => ({ key: 'walk', flipX: dir.x < 0 })
  };

  const player = new PlayerController(scene, stats, character, 1600, 1600, nav);
  const makeKey = (down = false) => ({ isDown: down });

  // Arrow-right moves east without requiring WASD
  const arrowKeys = {
    w: makeKey(false), a: makeKey(false), s: makeKey(false), d: makeKey(false),
    right: makeKey(true), up: makeKey(false), left: makeKey(false), down: makeKey(false)
  };
  player.update(100, arrowKeys);
  assert.ok(player.position.x > 1620, 'arrow right key should move player right');

  // Woodland Dash starts on dash input: 2.9x speed for 175ms, 2400ms cooldown, i-frames & trail
  assert.equal(player.dashCooldownRatio, 0);
  const preDashX = player.position.x;
  player.update(100, { x: 1, y: 0, dash: true });
  assert.equal(player.isDashing, true);
  assert.ok(player.dashCooldownRatio > 0.9, 'dash cooldown starts full');
  assert.ok(events.emitted.some((e) => e.event === 'presentation:dash'));
  assert.ok(events.emitted.some((e) => e.event === 'audio:play' && e.args[0] === 'dash'));
  assert.ok(events.emitted.some((e) => e.event === 'presentation:trail'));

  const dashDelta = player.position.x - preDashX;
  const expectedDashDelta = BALANCE.player.speed * WOODLAND_DASH.speedMultiplier * 0.1;
  assert.ok(Math.abs(dashDelta - expectedDashDelta) < 1, `expected ${expectedDashDelta}, got ${dashDelta}`);

  // Dash ends after remaining 75ms, rejects re-dash until 2400ms cooldown finishes
  player.update(80, { x: 1, y: 0 });
  assert.equal(player.isDashing, false);
  assert.equal(player.tryDash({ x: 1, y: 0 }), false);
  player.update(2320, { x: 0, y: 0 });
  assert.equal(player.dashCooldownRatio, 0);
  assert.equal(player.tryDash({ x: 0, y: 1 }), true);

  // Hit blink activates hit invulnerability and fades sprite alpha safely back to 1
  player.triggerHitBlink(420);
  assert.equal(player.isHitInvulnerable, true);
  player.update(50, { x: 0, y: 0 });
  assert.ok(player.sprite.alpha < 1, 'sprite alpha blinks down when newly hit');
  player.update(400, { x: 0, y: 0 });
  assert.equal(player.isHitInvulnerable, false);
  assert.equal(player.sprite.alpha, 1, 'sprite alpha restores cleanly when invulnerability ends');
});

test('DamageNumberSystem pools depth-32 damage numbers, styles crits/resists, and honors reduced motion', () => {
  const normalHarness = createHarness({ reducedMotion: false });
  const { DamageNumberSystem, classifyDamageStyle } = normalHarness.load('src/game/systems/DamageNumberSystem.ts');
  assert.equal(classifyDamageStyle(40, 1.25).color, '#ffd86b');
  assert.equal(classifyDamageStyle(40, 1.25).fontSize, 22);
  assert.equal(classifyDamageStyle(12, 0.35).color, '#b4c2d0');
  assert.equal(classifyDamageStyle(18, 1).color, '#fff6dc');

  const normalMock = normalHarness.createMockScene();
  const dmg = new DamageNumberSystem(normalMock.scene);
  assert.equal(normalMock.created.texts.length, 64);
  assert.equal(normalMock.created.texts[0].depth, 32);

  normalMock.events.emit('presentation:damage', { x: 500, y: 600, amount: 75, vulnerability: 1.25, isBoss: true });
  const activeCrit = normalMock.created.texts.find((t) => t.visible);
  assert.equal(activeCrit.text, '75');
  assert.equal(activeCrit.style.color, '#ffd86b');
  assert.equal(activeCrit.style.fontSize, 22);
  const startY = activeCrit.y;
  dmg.update(120);
  assert.ok(activeCrit.y < startY, 'damage number floats upward under normal motion');

  // Reduced motion disables jitter and upward drift
  const calmHarness = createHarness({ reducedMotion: true });
  const CalmSystem = calmHarness.load('src/game/systems/DamageNumberSystem.ts').DamageNumberSystem;
  const calmMock = calmHarness.createMockScene();
  const calmDmg = new CalmSystem(calmMock.scene);
  calmMock.events.emit('presentation:damage', { x: 320, y: 440, amount: 20, vulnerability: 0.35 });
  const calmSlot = calmMock.created.texts.find((t) => t.visible);
  assert.equal(calmSlot.x, 320);
  assert.equal(calmSlot.y, 440);
  assert.equal(calmSlot.style.color, '#b4c2d0');
  calmDmg.update(200);
  assert.equal(calmSlot.x, 320);
  assert.equal(calmSlot.y, 440);
  calmDmg.update(500);
  assert.equal(calmSlot.visible, false);
});

test('CompassSystem hides onscreen items and pins offscreen Chests, Relics, Rocks, and Elites to viewport border', () => {
  const { load, createMockScene } = createHarness();
  const { CompassSystem, projectCompassTarget, COMPASS_STYLES } = load('src/game/systems/CompassSystem.ts');
  const { scene, created } = createMockScene();

  const view = { left: 1000, top: 1000, width: 1280, height: 720 };
  assert.equal(projectCompassTarget({ x: 1640, y: 1360 }, view), undefined, 'onscreen target should have no arrow');

  const east = projectCompassTarget({ x: 3000, y: 1360 }, view);
  assert.ok(east);
  assert.equal(east.screenX, 1280 - 30);
  assert.ok(Math.abs(east.screenY - 360) < 0.01);
  assert.ok(Math.abs(east.angle) < 0.01);

  const compass = new CompassSystem(scene);
  const camera = { scrollX: 1000, scrollY: 1000, width: 1280, height: 720, worldView: { x: 1000, y: 1000, width: 1280, height: 720 } };
  compass.update(16, camera, [
    { x: 1400, y: 1200, kind: 'chest' },
    { x: 2500, y: 1360, kind: 'chest' },
    { x: 400, y: 1360, kind: 'relic' },
    { x: 1640, y: 300, kind: 'rock' },
    { x: 1640, y: 2400, kind: 'elite' }
  ]);

  const visibleMarkers = created.graphics.filter((g) => g.visible);
  assert.equal(visibleMarkers.length, 4, 'only the 4 offscreen targets should display compass markers');
  assert.equal(visibleMarkers[0].depth, 34);
  assert.equal(visibleMarkers[0].scrollX, 0);
  // Highest priority marker is the violet boss relic pointing west (-X -> PI rad)
  assert.ok(Math.abs(Math.abs(visibleMarkers[0].rotation) - Math.PI) < 0.01);
  assert.ok(visibleMarkers[0].cmds.some((c) => c[0] === 'fillStyle' && c[1] === COMPASS_STYLES.relic.fill));
});

test('PresentationSystem pulses crimson hurt vignette on player-hit and bursts dash particles', () => {
  const { load, createMockScene } = createHarness({ reducedMotion: false });
  const { PresentationSystem } = load('src/game/systems/PresentationSystem.ts');
  const { scene, created, events } = createMockScene();

  const pres = new PresentationSystem(scene);
  const vignette = created.graphics[0];
  assert.equal(vignette.visible, false);
  assert.equal(vignette.scrollX, 0);

  events.emit('presentation:player-hit');
  assert.equal(vignette.visible, true);
  assert.ok(vignette.alpha > 0.7);
  pres.update(200);
  assert.ok(vignette.alpha > 0 && vignette.alpha < 0.5);
  pres.update(250);
  assert.equal(vignette.visible, false);

  events.emit('presentation:dash', { x: 1600, y: 1600 });
  const activeParticles = created.images.filter((img) => img.visible);
  assert.ok(activeParticles.length >= 9, 'dash emits leaf and cream burst motes');
});
