const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const { SQUIRREL_CHIEF } = require('../artifacts/ability-tests/game/config/squirrelChief.js');
const { SquirrelChiefEncounter } = require('../artifacts/ability-tests/game/core/SquirrelChiefEncounter.js');
const { SceneryNavigation } = require('../artifacts/ability-tests/game/core/SceneryNavigation.js');
const { BALANCE } = require('../artifacts/ability-tests/game/config/balance.js');

function createHarness() {
  const phaser = {
    Math: {
      Between: (min, max) => Math.floor((min + max) / 2),
      Clamp: (value, min, max) => Math.max(min, Math.min(max, value))
    }
  };
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} };
    cache.set(filename, mod);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText;

    const uiRoot = {
      children: [],
      append(el) { this.children.push(el); }
    };
    const fakeDoc = {
      getElementById(id) { return id === 'ui-root' ? uiRoot : null; },
      createElement(tag) {
        const caption = { textContent: '' };
        const fill = { style: { transform: '' } };
        const bar = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
        return {
          tag,
          className: '',
          hidden: false,
          innerHTML: '',
          textContent: '',
          removed: false,
          attrs: {},
          setAttribute(k, v) { this.attrs[k] = v; },
          querySelector(sel) {
            if (sel === 'i') return fill;
            if (sel === '.boss-caption') return caption;
            if (sel === '[role="progressbar"]') return bar;
            return null;
          },
          remove() { this.removed = true; }
        };
      }
    };

    vm.runInNewContext(
      code,
      {
        module: mod,
        exports: mod.exports,
        Math,
        document: fakeDoc,
        window: { matchMedia: () => ({ matches: false }) },
        performance: { now: () => 0 },
        require: id => {
          if (id === 'phaser') return phaser;
          if (id.endsWith('.png') || id.endsWith('.svg')) return id;
          return load(path.resolve(path.dirname(filename), `${id}.ts`));
        }
      },
      { filename }
    );
    return mod.exports;
  }

  const emitted = [];
  const graphicsOps = [];
  const scene = {
    events: {
      emit(event, ...args) {
        emitted.push([event, ...args]);
      }
    },
    add: {
      graphics() {
        return {
          depth: 0,
          destroyed: false,
          setDepth(d) { this.depth = d; return this; },
          clear() { graphicsOps.push('clear'); return this; },
          fillStyle(color, alpha) { graphicsOps.push(['fillStyle', color, alpha]); return this; },
          fillPoints(pts) { graphicsOps.push(['fillPoints', pts.length]); return this; },
          fillCircle() { return this; },
          fillTriangle() { return this; },
          lineStyle(w, color, alpha) { graphicsOps.push(['lineStyle', w, color, alpha]); return this; },
          lineBetween(x1, y1, x2, y2) { graphicsOps.push(['lineBetween', x1, y1, x2, y2]); return this; },
          strokeCircle() { return this; },
          destroy() { this.destroyed = true; }
        };
      },
      sprite(x, y, texture) {
        return {
          x,
          y,
          scene,
          texture: { key: texture },
          scaleX: 1,
          scaleY: 1,
          displayHeight: 36,
          originY: 0.5,
          anims: {
            isPaused: false,
            pause() { this.isPaused = true; },
            resume() { this.isPaused = false; },
            stop() { this.isPaused = true; }
          },
          data: {},
          setData(k, v) { this.data[k] = v; },
          getData(k) { return this.data[k]; },
          setTint(c) { this.tint = c; return this; },
          setOrigin() { return this; },
          setFlipX(f) { this.flipX = f; return this; },
          setRotation(r) { this.rotation = r; return this; },
          setAngle(a) { this.angle = a; return this; },
          setFrame(f) { this.frame = f; return this; },
          setDepth(d) { this.depth = d; return this; },
          setScale(sx, sy = sx) { this.scaleX = sx; this.scaleY = sy; return this; },
          setDisplaySize(w, h) { this.displayWidth = w; this.displayHeight = h; return this; },
          setTexture(k) { this.texture.key = k; return this; },
          setPosition(nx, ny) { this.x = nx; this.y = ny; return this; },
          play(k) { this.animation = k; return this; },
          destroy() { this.destroyed = true; }
        };
      }
    }
  };

  return { load, scene, emitted, graphicsOps };
}

test('Scout Squirrel and Hedgehog Roller variants behave as specified in EnemyController', () => {
  const { load, scene } = createHarness();
  const { EnemyController } = load('src/game/entities/EnemyController.ts');

  const scout = new EnemyController(scene, 200, 200, 0, undefined, undefined, 'scout', 1);
  assert.equal(scout.variant, 'scout');
  assert.equal(scout.health, BALANCE.scout.health);
  assert.equal(scout.contactDamage, 10);
  assert.equal(scout.sprite.scaleX, 0.82);
  assert.ok(scout.sprite.tint, 'scout squirrel has distinct highlight tint');

  const scaledScout = new EnemyController(scene, 200, 200, 0, undefined, undefined, 'scout', 10);
  assert.ok(scaledScout.contactDamage >= scout.contactDamage, 'gentle contact scaling with playerLevel');

  scout.update(500, { x: 500, y: 200 }, 0);
  assert.ok(scout.position.x > 270, 'scout darts quickly toward player');

  const hedgehog = new EnemyController(scene, 200, 200, 0, undefined, undefined, 'hedgehog', 1);
  assert.equal(hedgehog.variant, 'hedgehog');
  assert.equal(hedgehog.sprite.scaleX, 0.95);
  assert.equal(hedgehog.contactDamage, 10);

  // Within windup range -> enters 420ms curl telegraph with squash
  const player = { x: 350, y: 200 };
  hedgehog.update(16, player, 0);
  assert.ok(hedgehog.sprite.scaleY < hedgehog.sprite.scaleX, 'curling squashes hedgehog sprite');

  // Finish 420ms curl -> rolls in locked straight line at 370 speed with 18 rollDamage
  hedgehog.update(420, player, 0);
  assert.equal(hedgehog.contactDamage, 18);
  const beforeRollX = hedgehog.position.x;
  hedgehog.update(100, { x: 200, y: 800 }, 0); // player moves sideways, hedgehog keeps locked line
  assert.ok(hedgehog.position.x > beforeRollX + 30);
  assert.equal(hedgehog.position.y, 200);
});

test('SquirrelChiefEncounter rotates Acorn Barrage and Chief Charge with 900ms 1.3x catch-breath window', () => {
  const encounter = new SquirrelChiefEncounter();

  const boss = { x: 400, y: 400 };
  const player = { x: 600, y: 400 };
  const hits = [];
  const onHit = (dmg, dir) => hits.push({ dmg, dir });

  // Finish arrival -> stalking
  encounter.update(SQUIRREL_CHIEF.introductionMs, boss, player, 18, onHit);
  assert.equal(encounter.phase, 'stalking');
  assert.equal(encounter.nextAttack, 'barrage');

  // Finish stalking -> barrageWindup
  encounter.update(SQUIRREL_CHIEF.stalkMs, boss, player, 18, onHit);
  assert.equal(encounter.phase, 'barrageWindup');
  assert.ok(encounter.barrageAim);

  // Finish barrageWindup -> fires 5-acorn spread fan
  encounter.update(SQUIRREL_CHIEF.barrageWindupMs, boss, player, 18, onHit);
  assert.ok(encounter.barrage);
  assert.equal(encounter.barrage.directions.length, 5);
  assert.equal(encounter.phase, 'stalking');
  assert.equal(encounter.nextAttack, 'charge');

  // Advance to chargeWindup (650ms locked lane 380px)
  encounter.update(SQUIRREL_CHIEF.stalkMs + SQUIRREL_CHIEF.barrageRestMs, boss, player, 18, onHit);
  assert.equal(encounter.phase, 'chargeWindup');
  assert.equal(encounter.lane.length, 380);

  // Finish 650ms windup -> charging
  encounter.update(650, boss, player, 18, onHit);
  assert.equal(encounter.phase, 'charging');
  assert.equal(encounter.vulnerable, false);

  // Step through the 380px charge at 560 px/s; hits player once and enters catchBreath
  while (encounter.phase === 'charging') {
    encounter.update(50, boss, player, 18, onHit);
    boss.x += encounter.chargeStep.x;
    boss.y += encounter.chargeStep.y;
  }
  assert.equal(hits.length, 1);
  assert.equal(hits[0].dmg, SQUIRREL_CHIEF.chargeDamage);
  assert.equal(encounter.phase, 'catchBreath');
  assert.equal(encounter.vulnerable, true);

  // After 900ms catch-breath, vulnerability ends
  encounter.update(900, boss, player, 18, onHit);
  assert.equal(encounter.phase, 'stalking');
  assert.equal(encounter.vulnerable, false);
});

test('SquirrelChiefBoss and SquirrelChiefSystem wire 1.3x vulnerability, acorns, SFX, and boss HUD', () => {
  const { load, scene, emitted } = createHarness();
  const { SquirrelChiefSystem } = load('src/game/systems/SquirrelChiefSystem.ts');

  const acornsFired = [];
  const game = { level: 5, getDifficultyMinutes: () => 0 };
  const nav = new SceneryNavigation(false, false, true);
  const sys = new SquirrelChiefSystem(
    scene,
    game,
    nav,
    () => {},
    (origin, dirs, speed) => acornsFired.push({ origin, dirs, speed })
  );

  const enemies = [];
  const player = { x: -3500, y: 4050 };
  sys.update(10000, player, 18);
  assert.equal(enemies.length, 0, 'updates alone cannot spawn the chief');
  sys.spawnEncounter(player, enemies);
  const firstEncounter = sys.encounter;
  sys.spawnEncounter(player, enemies);
  assert.equal(sys.encounter, firstEncounter, 'a duplicate spawn preserves the active fight');
  sys.update(16, player, 18);
  assert.equal(enemies.length, 1);
  const chief = sys.boss;
  assert.ok(chief.isBoss);
  assert.equal(chief.health, 1100);
  assert.equal(chief.sprite.scaleX, 1.7);
  assert.equal(chief.sprite.tint, 0xffb36b);
  assert.equal(chief.position.x, player.x - SQUIRREL_CHIEF.spawnDistance);
  assert.equal(chief.position.y, player.y);
  assert.ok(emitted.some(e => e[0] === 'audio:play' && e[1] === 'boss-spawn'));

  // Advance to barrage fire
  sys.update(SQUIRREL_CHIEF.introductionMs, player, 18);
  sys.update(SQUIRREL_CHIEF.stalkMs, player, 18);
  assert.ok(emitted.some(e => e[0] === 'audio:play' && e[1] === 'boss-warn'));
  sys.update(SQUIRREL_CHIEF.barrageWindupMs, player, 18);
  assert.equal(acornsFired.length, 1);
  assert.equal(acornsFired[0].dirs.length, 5);

  // Advance through charge into catchBreath -> boss.vulnerability becomes 1.3
  sys.update(SQUIRREL_CHIEF.stalkMs + SQUIRREL_CHIEF.barrageRestMs, player, 18);
  sys.update(SQUIRREL_CHIEF.chargeWindupMs, player, 18);
  const { from, direction, length } = sys.encounter.lane;
  while (sys.encounter.phase === 'charging') {
    sys.update(50, player, 18);
    chief.update(50, player);
  }
  assert.ok(Math.abs(chief.position.x - from.x - direction.x * length) < 0.0001);
  assert.ok(Math.abs(chief.position.y - from.y - direction.y * length) < 0.0001);
  chief.update(16, player);
  assert.equal(chief.vulnerability, 1.3);
  assert.ok(emitted.some(e => e[0] === 'audio:play' && e[1] === 'boss-impact'));

  chief.isDead = true;
  sys.defeated();
  assert.equal(sys.encounter.defeated, true);
  enemies.length = 0;
  sys.spawnEncounter(player, enemies, 1.5);
  assert.equal(enemies.length, 1);
  assert.notEqual(sys.encounter, firstEncounter);
  assert.equal(sys.encounter.phase, 'arrival');
  assert.equal(sys.boss.maxHealth, 1650);
  sys.destroy();
});

test('opening squirrels arrive in two flanks, with the reinforcements using active gameplay time', () => {
  const { load, scene } = createHarness();
  const { EnemySpawner } = load('src/game/systems/EnemySpawner.ts');
  const spawner = new EnemySpawner(scene, new SceneryNavigation(false, false));
  const camera = { worldView: { left: 960, right: 2240, top: 1240, bottom: 1960 } };
  const player = { x: 1600, y: 1600 };
  const enemies = [];

  spawner.spawnEnemy = () => undefined; // Isolate the opening from concurrent ambient spawns.
  const lead = spawner.spawnOpeningPack(player, camera, 0, enemies);
  assert.equal(lead.length, 3);
  assert.equal(enemies.length, 3);
  for (const squirrel of lead) {
    assert.equal(squirrel.variant, 'brown');
    assert.ok(squirrel.position.x < player.x);
    const distance = Math.hypot(squirrel.position.x - player.x, squirrel.position.y - player.y);
    assert.ok(distance >= 220 && distance <= 260);
  }

  // There is no wall-clock timer. Paused/review updates do not reach EnemySpawner.update.
  spawner.update(BALANCE.spawner.openingReinforcementDelayMs - 1, player, camera, enemies, 0, 1);
  assert.equal(enemies.length, 3);
  const movedPlayer = { x: player.x + 100, y: player.y + 100 };
  spawner.update(1, movedPlayer, camera, enemies, 0, 1);
  assert.equal(enemies.length, 7);
  for (const squirrel of enemies.slice(3)) {
    assert.equal(squirrel.variant, 'brown');
    assert.ok(squirrel.position.x > movedPlayer.x);
    assert.ok(Math.abs(Math.hypot(squirrel.position.x - movedPlayer.x, squirrel.position.y - movedPlayer.y) -
      BALANCE.spawner.openingReinforcementDistance) < 0.001);
  }
  spawner.update(BALANCE.spawner.openingReinforcementDelayMs, movedPlayer, camera, enemies, 0, 1);
  assert.equal(enemies.length, 7, 'reinforcements arrive once');
});

test('the opening uses available ground at an arena corner in a portrait viewport', () => {
  const { load, scene } = createHarness();
  const { EnemySpawner } = load('src/game/systems/EnemySpawner.ts');
  const navigation = new SceneryNavigation(false, false);
  const spawner = new EnemySpawner(scene, navigation);
  const camera = { width: 390, height: 750, worldView: { left: 0, right: 0, top: 0, bottom: 0 } };
  const player = { x: 40, y: 40 };
  const enemies = [];
  spawner.spawnEnemy = () => undefined;

  assert.equal(spawner.spawnOpeningPack(player, camera, 0, enemies).length, 3);
  spawner.update(BALANCE.spawner.openingReinforcementDelayMs, player, camera, enemies, 0, 1);
  assert.equal(enemies.length, 7);
  for (const squirrel of enemies) assert.equal(navigation.blocked(squirrel.position, squirrel.radius), false);
});

test('XP crystals stay put outside pickup range and still respond to nearby or explicit attraction', () => {
  const { load, scene } = createHarness();
  const { XPOrb } = load('src/game/entities/XPOrb.ts');
  const orb = new XPOrb(scene, 100, 100, 8);
  orb.update(1000, { x: 600, y: 100 }, 1);
  orb.update(10_000, { x: 600, y: 100 }, 1);
  assert.equal(orb.position.x, 100);

  orb.update(1000, { x: 150, y: 100 }, 1);
  assert.equal(orb.position.x, 150);
  orb.update(1000, { x: 600, y: 100 }, 1);
  assert.equal(orb.position.x, 150);

  orb.attract();
  orb.update(100, { x: 600, y: 100 }, 1);
  assert.ok(orb.position.x > 150 && orb.position.x < 600);
  assert.equal(orb.position.y, 100);
});

test('Mystery scales with mysteryRank and pre-Lv10 stampedes use fawns', () => {
  const { load, scene } = createHarness();
  const { MysteryCompanion } = load('src/game/entities/MysteryCompanion.ts');
  const { EnemyController } = load('src/game/entities/EnemyController.ts');
  const { RunEventSystem } = load('src/game/systems/RunEventSystem.ts');

  // MysteryCompanion rank-scaled damage
  const target = new EnemyController(scene, 120, 100, 0);
  let dealtRank1 = 0;
  let dealtRank4 = 0;
  const baseStats = {
    companionRank: 0,
    mysteryRank: 1,
    mysteryDamage: 40,
    mysteryCooldownMs: 1000,
    mysteryPounceRange: 400,
    mysteryReturnSpeed: 260,
    health: 100,
    maxHealth: 100
  };
  const m1 = new MysteryCompanion(scene, { ...baseStats, mysteryRank: 1 }, { x: 100, y: 100 });
  m1.update(700, { x: 100, y: 100 }, { x: 1, y: 0 }, [target], (_t, amt) => { dealtRank1 = amt; });
  m1.update(100, { x: 100, y: 100 }, { x: 1, y: 0 }, [target], (_t, amt) => { dealtRank1 = amt; });

  const m4 = new MysteryCompanion(scene, { ...baseStats, mysteryRank: 4 }, { x: 100, y: 100 });
  m4.update(700, { x: 100, y: 100 }, { x: 1, y: 0 }, [target], (_t, amt) => { dealtRank4 = amt; });
  m4.update(100, { x: 100, y: 100 }, { x: 1, y: 0 }, [target], (_t, amt) => { dealtRank4 = amt; });
  assert.ok(dealtRank4 > dealtRank1 * 1.4, `expected rank 4 damage (${dealtRank4}) > rank 1 (${dealtRank1})`);

  // Pre-Lv10 stampedes spawn fawns
  const events = new RunEventSystem(scene, new SceneryNavigation(false, false));
  const stampedeEnemies = [];
  events.launchStampede({ x: 1600, y: 1600 }, 1, 5, 4);
  events.update(2000, false, 4, 1, { x: 1600, y: 1600 }, { worldView: { left: 0, right: 1280, top: 0, bottom: 720 } }, stampedeEnemies, {});
  assert.ok(stampedeEnemies.length > 0, 'pre-Lv10 stampede spawns runners');
  for (const runner of stampedeEnemies) {
    assert.equal(runner.variant, 'fawn');
  }
  events.destroy();
});
