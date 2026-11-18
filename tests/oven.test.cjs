const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const { OvenEncounter } = require('../artifacts/ability-tests/game/core/OvenEncounter.js');
const { OVEN, OVEN_LOOK } = require('../artifacts/ability-tests/game/config/ovenBoss.js');
const { GameManager } = require('../artifacts/ability-tests/game/core/GameManager.js');
const { CombatResolver } = require('../artifacts/ability-tests/game/core/CombatResolver.js');
const { SceneryNavigation } = require('../artifacts/ability-tests/game/core/SceneryNavigation.js');

const boss = { x: 1600, y: 1600 };
const player = { x: 1850, y: 1600 };

function ready(health = 1) {
  const fight = new OvenEncounter();
  fight.update(OVEN.introductionMs, boss, player, 18, health, () => {});
  fight.update(OVEN.arrivalWalkMs, boss, player, 18, health, () => {});
  return fight;
}

/** Step the fight in realistic slices until it enters windup for `attack`. */
function cycleTo(fight, attack, health = 1, where = player) {
  for (let i = 0; i < 600 && !(fight.phase === 'windup' && fight.attack === attack); i++) {
    fight.update(50, boss, where, 18, health, () => {});
  }
  assert.equal(fight.phase, 'windup');
  assert.equal(fight.attack, attack);
}

function loadOvenSystemsWithMock() {
  const emittedEvents = [];
  const noop = () => undefined;
  const makeGraphics = () => {
    const target = { destroy: noop, clear: noop };
    const g = new Proxy(target, {
      get(obj, prop) {
        if (prop in obj) return obj[prop];
        return () => g;
      }
    });
    return g;
  };
  const makeSprite = (x, y, texture) => ({
    x,
    y,
    texture: { key: texture },
    rotation: 0,
    alpha: 1,
    originX: 0.5,
    originY: 1,
    displayWidth: 100,
    displayHeight: OVEN_LOOK.height,
    flipX: false,
    visible: true,
    data: new Map(),
    tint: undefined,
    anims: { currentAnim: null, play: noop, setProgress: noop, stop: noop },
    setData(k, v) { this.data.set(k, v); return this; },
    getData(k) { return this.data.get(k); },
    setDepth() { return this; },
    setScale() { return this; },
    setOrigin(ox = 0.5, oy = ox) { this.originX = ox; this.originY = oy; return this; },
    setFrame() { return this; },
    setFlipX(f) { this.flipX = f; return this; },
    setRotation(r) { this.rotation = r; return this; },
    setAngle() { return this; },
    setPosition(nx, ny) { this.x = nx; this.y = ny; return this; },
    setTint(c) { this.tint = c; return this; },
    clearTint() { this.tint = undefined; return this; },
    setVisible(v) { this.visible = v; return this; },
    play(key) { this.anims.currentAnim = { key }; return this; },
    destroy: noop
  });

  const hudElements = [];
  const scene = {
    events: { emit(event, ...args) { emittedEvents.push({ event, args }); } },
    cameras: { main: { shake: noop } },
    textures: {
      exists: () => true,
      get: () => ({ getSourceImage: () => ({ width: 32, height: 32 }), setFilter: noop }),
      getFrame: () => ({ realHeight: 64 })
    },
    add: {
      graphics: () => makeGraphics(),
      image: (x, y, texture) => ({
        x, y, texture,
        setDepth() { return this; },
        setDisplaySize() { return this; },
        setVisible() { return this; },
        setRotation() { return this; },
        setPosition(nx, ny) { this.x = nx; this.y = ny; return this; },
        destroy: noop
      }),
      sprite: (x, y, texture) => {
        const s = makeSprite(x, y, texture);
        s.scene = scene;
        return s;
      }
    }
  };
  const phaser = {
    Math: {
      Clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
      Linear: (a, b, t) => a + (b - a) * t
    }
  };

  const cache = new Map();
  function load(relPath) {
    const filename = path.resolve(relPath);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} };
    cache.set(filename, mod);
    const source = fs.readFileSync(filename, 'utf8');
    const code = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText;
    vm.runInNewContext(code, {
      module: mod,
      exports: mod.exports,
      Math, Number, Set, Map, Array, Object, Infinity, performance, console,
      window: { matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }) },
      document: {
        createElement: () => {
          const captionEl = { textContent: '' };
          const barEl = { setAttribute: noop };
          const fillEl = { style: {} };
          const el = {
            className: '',
            hidden: false,
            textContent: '',
            innerHTML: '',
            style: {},
            setAttribute: noop,
            querySelector(sel) {
              if (sel === 'i') return fillEl;
              if (sel === '.boss-caption') return captionEl;
              return barEl;
            },
            remove: noop,
            captionEl
          };
          hudElements.push(el);
          return el;
        },
        getElementById: () => ({ append: noop })
      },
      require(specifier) {
        if (specifier === 'phaser') return phaser;
        if (/\.(png|jpe?g|webp|gif|svg)$/i.test(specifier)) return specifier;
        const base = path.resolve(path.dirname(filename), specifier);
        if (fs.existsSync(`${base}.ts`)) return load(`${base}.ts`);
        if (fs.existsSync(base) && fs.statSync(base).isFile()) return require(base);
        return require(specifier);
      }
    });
    return mod.exports;
  }

  return { scene, emittedEvents, hudElements, load };
}

test('the Oven system only spawns on request and starts a fresh encounter after defeat', () => {
  const { scene, emittedEvents, load } = loadOvenSystemsWithMock();
  const { OvenBossSystem } = load('src/game/systems/OvenBossSystem.ts');
  const game = new GameManager();
  const navigation = new SceneryNavigation(false, false, true);
  const system = new OvenBossSystem(scene, game, navigation);
  const enemies = [];

  system.update(OVEN.introductionMs, player, 18);
  assert.equal(system.boss, undefined);
  assert.equal(enemies.length, 0);

  system.spawnEncounter(player, enemies);
  const firstBoss = system.boss;
  const firstFight = system.encounter;
  assert.deepEqual(enemies, [firstBoss]);
  assert.equal(firstFight.phase, 'arrival');
  system.update(OVEN.introductionMs, player, 18);
  assert.equal(firstFight.phase, 'walking');
  system.spawnEncounter(player, enemies, 1.5);
  assert.deepEqual(enemies, [firstBoss]);
  assert.equal(system.encounter, firstFight);
  assert.equal(firstFight.phase, 'walking');

  firstBoss.destroy();
  enemies.length = 0;
  system.defeated();
  system.update(3500, player, 18);
  assert.equal(enemies.length, 0);

  system.spawnEncounter(player, enemies, 1.5);
  assert.deepEqual(enemies, [system.boss]);
  assert.notEqual(system.boss, firstBoss);
  assert.notEqual(system.encounter, firstFight);
  assert.equal(system.encounter.phase, 'arrival');
  assert.equal(system.encounter.defeated, false);
  assert.equal(system.boss.maxHealth, Math.round(OVEN.health * 1.5));
  assert.equal(emittedEvents.filter(event => event.event === 'audio:play' && event.args[0] === 'boss-spawn').length, 2);
});

test('OVEN constants preserve fast tactical tuning and recovery windows', () => {
  assert.equal(OVEN.name, 'Oven');
  assert.equal(OVEN.health, 3800);
  assert.equal(OVEN.healthPerMinute, 80);
  assert.equal(OVEN.speed, 96);
  assert.equal(OVEN.hotSpeedMultiplier, 1.25);
  assert.equal(OVEN.standOff, 135);
  assert.equal(OVEN.contactDamage, 28);
  assert.equal(OVEN.cooldownMs, 1350);
  assert.equal(OVEN.hotCooldownMs, 850);
  assert.equal(OVEN.overheatMs, 1900);
  assert.equal(OVEN.hotOverheatMs, 1400);
  assert.equal(OVEN.overheatVulnerability, 1.6);
});

test('stationary taco toss aims directly at player, locks warnings, and hits once on landing', () => {
  const fight = ready();
  assert.equal(fight.phase, 'windup');
  assert.equal(fight.attack, 'toss');
  assert.equal(fight.warnings.length, 3);
  assert.deepEqual(fight.warnings[1], player);

  const targets = fight.warnings.map(p => ({ ...p }));
  let damage = 0;
  fight.update(OVEN.windupMs, boss, { x: 2050, y: 1850 }, 18, 1, d => damage += d);
  assert.equal(fight.phase, 'throwing');
  assert.deepEqual(fight.tacos.map(t => t.target), targets);

  fight.update(OVEN.flightMs - 1, boss, player, 18, 1, d => damage += d);
  assert.equal(damage, 0);
  fight.update(1, boss, player, 18, 1, d => damage += d);
  assert.equal(damage, OVEN.damage);
  fight.update(100, boss, player, 18, 1, d => damage += d);
  assert.equal(damage, OVEN.damage);

  // Overlapping blasts in the same volley only hurt once.
  const overlapFight = ready();
  let overlapHit = 0;
  overlapFight.update(OVEN.windupMs, boss, player, 18, 1, () => {});
  overlapFight.update(OVEN.flightMs, boss, player, 220, 1, d => overlapHit += d);
  assert.equal(overlapHit, OVEN.damage);
});

test('predictive leading taco toss leads straight-line kiting and ignores huge teleports', () => {
  const fight = new OvenEncounter();
  const kiter = { x: 1850, y: 1460 };
  const speedY = 220; // px/s

  // Advance through introduction + arrival while steadily kiting south at 220 px/s.
  const preSteps = (OVEN.introductionMs + OVEN.arrivalWalkMs) / 50;
  for (let i = 0; i < preSteps; i++) {
    kiter.y += speedY * 0.05;
    fight.update(50, boss, kiter, 18, 1, () => {});
  }
  assert.equal(fight.phase, 'windup');
  assert.equal(fight.attack, 'toss');
  assert.ok(fight.playerVelocity.y > 200, 'tracked player velocity along kiting axis');
  const centerTarget = fight.warnings[1];
  assert.ok(centerTarget.y > kiter.y + 200, 'leading target is projected far ahead along travel path');

  // Continue straight-line kiting through windup and flight: player walks straight into the blast!
  let kiteDamage = 0;
  while (fight.phase === 'windup' || fight.phase === 'throwing') {
    const dt = 10;
    kiter.y += speedY * (dt / 1000);
    fight.update(dt, boss, kiter, 18, 1, d => kiteDamage += d);
  }
  assert.equal(kiteDamage, OVEN.damage, 'straight-line kiting walks straight into the leading taco');

  // Huge single-frame teleport should reset tracked velocity safely instead of leading miles away.
  const tpFight = new OvenEncounter();
  tpFight.update(OVEN.introductionMs, boss, { x: 1150, y: 1600 }, 18, 1, () => {});
  tpFight.update(OVEN.arrivalWalkMs, boss, { x: 2050, y: 1600 }, 18, 1, () => {});
  assert.equal(tpFight.phase, 'windup');
  assert.equal(tpFight.playerVelocity.x, 0);
  assert.deepEqual(tpFight.warnings[1], { x: 2050, y: 1600 });
});

test('center-trap double ring blasts stationary center in Wave 0 and outer ring in Wave 1 in both normal and hot phases', () => {
  for (const [health, innerCount, outerCount] of [[1, OVEN.innerRingTacos, OVEN.outerRingTacos], [0.4, OVEN.hotInnerRingTacos, OVEN.hotOuterRingTacos]]) {
    const fight = ready(health);
    cycleTo(fight, 'ring', health);
    fight.salsa = [];
    const expectedTotal = 1 + innerCount + outerCount;
    assert.equal(fight.warnings.length, expectedTotal);

    // Standing dead-center guarantees getting hit by Wave 0!
    let centerDmg = 0;
    fight.update(OVEN.windupMs, boss, player, 18, health, d => centerDmg += d);
    assert.equal(fight.phase, 'throwing');
    assert.equal(fight.tacos.length, expectedTotal);
    fight.update(OVEN.flightMs, boss, player, 18, health, d => centerDmg += d);
    assert.equal(centerDmg, OVEN.damage, 'stationary center is hit by Wave 0 dead-center taco');
    assert.equal(fight.salsa.length, 1 + innerCount);
    assert.equal(fight.tacos.length, outerCount, 'Wave 1 outer ring is still airborne');

    // Moving blindly outward onto the outer ring radius walks into Wave 1!
    const outerTarget = fight.tacos[0].target;
    fight.update(OVEN.secondRingDelayMs, boss, outerTarget, 18, health, d => centerDmg += d);
    assert.equal(centerDmg, OVEN.damage * 2, 'Wave 1 outer collapsing ring hits after secondRingDelayMs');
    assert.equal(fight.salsa.length, expectedTotal);
    assert.equal(fight.phase, 'walking');
  }
});

test('Toaster Leap Slam telegraphs, deals slamRadius damage, scatters embers, spawns single-hit shockwave, and overheats (>50% HP)', () => {
  const fight = ready();
  cycleTo(fight, 'slam', 1);
  fight.salsa = [];
  assert.ok(fight.slam, 'slam target is locked on windup');
  assert.equal(fight.slam.radius, OVEN.slamRadius);
  const slamTarget = { ...fight.slam.target };

  let damage = 0;
  fight.update(OVEN.slamWindupMs, boss, slamTarget, 18, 1, d => damage += d);
  assert.equal(fight.phase, 'slamming');
  assert.equal(damage, 0);

  // Mid-flight: boss arcs vertically above ground.
  fight.update(OVEN.slamFlightMs / 2, boss, slamTarget, 18, 1, d => damage += d);
  assert.equal(fight.phase, 'slamming');
  assert.ok(fight.slamArc > 0.9, 'peak of vertical leap arc near mid-flight');
  assert.ok(fight.slamPosition);
  assert.equal(damage, 0);

  // Landing: slam impact damage + 4 salsa embers + magma shockwave + enters overheated!
  fight.update(OVEN.slamFlightMs / 2, boss, slamTarget, 18, 1, d => damage += d);
  assert.equal(damage, OVEN.slamDamage);
  assert.ok(fight.slamLanded);
  assert.equal(fight.salsa.length, OVEN.slamEmberCount);
  assert.equal(fight.shockwaves.length, 1);
  assert.equal(fight.phase, 'overheated');
  assert.equal(fight.vulnerable, true);
  assert.equal(fight.slamArc, 0);

  // Shockwave test: player standing outside slamRadius gets swept by expanding ring once only.
  const waveFight = ready();
  cycleTo(waveFight, 'slam', 1);
  waveFight.salsa = [];
  const target = { ...waveFight.slam.target };
  let waveDmg = 0;
  waveFight.update(OVEN.slamWindupMs, boss, target, 18, 1, d => waveDmg += d);
  const runner = { x: target.x + 220, y: target.y };
  waveFight.update(OVEN.slamFlightMs, boss, runner, 18, 1, d => waveDmg += d);
  assert.equal(waveDmg, 0, 'runner outside slamRadius avoids slam impact');
  assert.equal(waveFight.shockwaves.length, 1);

  for (let i = 0; i < 30; i++) {
    waveFight.update(50, boss, runner, 18, 1, d => waveDmg += d);
  }
  assert.equal(waveDmg, OVEN.shockwaveDamage, 'expanding magma shockwave hits at most once');
  assert.equal(waveFight.shockwaves.length, 0, 'shockwave expires after reaching shockwaveMaxRadius');
});

test('Sweeping Flame Cone rotates through the player, burns repeatedly on coneHitCooldownMs, misses behind, then overheats', () => {
  const behind = ready();
  cycleTo(behind, 'cone', 1);
  assert.ok(behind.cone);
  assert.equal(behind.cone.progress, 0);
  let behindDmg = 0;
  behind.update(OVEN.coneWindupMs, boss, { x: 1400, y: 1600 }, 18, 1, d => behindDmg += d);
  assert.equal(behind.phase, 'blasting');
  assert.equal(behind.coneFired, true);
  assert.equal(behindDmg, 0);

  for (let i = 0; i < 15; i++) {
    behind.update(50, boss, { x: 1400, y: 1600 }, 18, 1, d => behindDmg += d);
  }
  assert.equal(behindDmg, 0, 'stepping behind the Oven avoids the entire sweep');
  assert.equal(behind.phase, 'overheated');
  assert.equal(behind.vulnerable, true);
  assert.equal(behind.cone, undefined);

  // Staying inside the sweep directly in front burns twice on 320ms intervals!
  const front = ready();
  cycleTo(front, 'cone', 1);
  front.salsa = [];
  let frontDmg = 0;
  const stationaryTarget = { x: 1600 + 250, y: 1600 };
  front.update(OVEN.coneWindupMs, boss, stationaryTarget, 18, 1, d => frontDmg += d);
  const startDir = { ...front.cone.direction };
  let sawRotation = false;
  for (let i = 0; i < 15; i++) {
    front.update(50, boss, stationaryTarget, 18, 1, d => frontDmg += d);
    if (front.cone && (Math.abs(front.cone.direction.x - startDir.x) > 0.05 || Math.abs(front.cone.direction.y - startDir.y) > 0.05)) {
      sawRotation = true;
    }
  }
  assert.equal(sawRotation, true, 'cone direction smoothly rotates during blasting');
  assert.equal(frontDmg, OVEN.coneDamage * 2, 'standing inside the 117deg sweep earns two burns at 320ms interval');
  assert.equal(front.phase, 'overheated');
  assert.equal(front.vulnerable, true);

  // Overheated window lasts OVEN.overheatMs then returns to walking.
  front.update(OVEN.overheatMs - 1, boss, stationaryTarget, 18, 1, () => {});
  assert.equal(front.phase, 'overheated');
  assert.equal(front.vulnerable, true);
  front.update(1, boss, stationaryTarget, 18, 1, () => {});
  assert.equal(front.phase, 'walking');
  assert.equal(front.vulnerable, false);
});

test('burning salsa ticks every 420ms without stacking, scales in Phase 2, expires, and clears on defeat', () => {
  const fight = ready();
  let damage = 0;
  const hit = d => damage += d;
  fight.update(OVEN.windupMs, boss, player, 200, 1, hit);
  fight.update(OVEN.flightMs, boss, player, 200, 1, hit);
  assert.equal(damage, OVEN.damage);
  assert.equal(fight.salsa.length, 3);

  fight.update(OVEN.salsaTickMs - 1, boss, player, 200, 1, hit);
  assert.equal(damage, OVEN.damage);
  fight.update(1, boss, player, 200, 1, hit);
  assert.equal(damage, OVEN.damage + OVEN.salsaDamage);

  // Leaving resets exposure grace period.
  fight.update(100, boss, { x: 1000, y: 1000 }, 18, 1, hit);
  fight.update(OVEN.salsaTickMs - 1, boss, player, 200, 1, hit);
  assert.equal(damage, OVEN.damage + OVEN.salsaDamage);
  fight.update(OVEN.salsaLifeMs, boss, { x: 1000, y: 1000 }, 18, 1, hit);
  assert.equal(fight.salsa.length, 0);

  // Hot salsa burns harder (13 per 420ms) and lasts 5200ms.
  const hotFight = ready(0.4);
  let hotDmg = 0;
  hotFight.update(OVEN.windupMs, boss, player, 200, 0.4, d => hotDmg += d);
  hotFight.update(OVEN.flightMs, boss, player, 200, 0.4, d => hotDmg += d);
  assert.equal(hotFight.salsa.length, OVEN.hotTossTacos);
  assert.ok(hotFight.salsa.every(p => p.life === OVEN.hotSalsaLifeMs));
  hotFight.update(OVEN.salsaTickMs, boss, player, 200, 0.4, d => hotDmg += d);
  assert.equal(hotDmg, OVEN.damage + OVEN.hotSalsaDamage);

  hotFight.defeat();
  assert.equal(hotFight.salsa.length, 0);
  hotFight.update(5000, boss, player, 18, 0, () => assert.fail('post-defeat burn'));
});

test('Phase 2 (<= 50% HP) cuts cooldowns, throws 5-taco volleys, and chains Toaster Slam into Flame Sweep before overheating', () => {
  const fight = ready(0.5);
  assert.equal(fight.hot, true);
  assert.equal(fight.attack, 'toss');
  assert.equal(fight.warnings.length, OVEN.hotTossTacos);

  fight.update(OVEN.windupMs, boss, player, 18, 0.5, () => {});
  fight.update(OVEN.flightMs, boss, player, 18, 0.5, () => {});
  fight.update(OVEN.hotCooldownMs - 1, boss, player, 18, 0.5, () => {});
  assert.equal(fight.phase, 'walking');
  fight.update(1, boss, player, 18, 0.5, () => {});
  assert.equal(fight.phase, 'windup');
  assert.equal(fight.attack, 'ring');

  // Cycle to Slam while hot: uses faster hotSlamWindupMs (520ms), chains via 350ms stutter straight into Cone!
  cycleTo(fight, 'slam', 0.45);
  fight.update(OVEN.hotSlamWindupMs - 1, boss, player, 18, 0.45, () => {});
  assert.equal(fight.phase, 'windup');
  fight.update(1, boss, player, 18, 0.45, () => {});
  assert.equal(fight.phase, 'slamming');

  const sidestep = { x: 1500, y: 1800 };
  fight.update(OVEN.slamFlightMs, boss, sidestep, 18, 0.45, () => {});
  assert.equal(fight.phase, 'walking', 'Phase 2 slam skips overheated and enters 350ms stutter transition');
  assert.equal(fight.vulnerable, false);
  assert.equal(fight.chainingCone, true);

  fight.update(OVEN.hotChainDelayMs - 1, boss, sidestep, 18, 0.45, () => {});
  assert.equal(fight.phase, 'walking');
  fight.update(1, boss, sidestep, 18, 0.45, () => {});
  assert.equal(fight.phase, 'windup');
  assert.equal(fight.attack, 'cone', 'chained directly into Flame Sweep');
  assert.equal(fight.chainingCone, false);

  fight.update(OVEN.coneWindupMs, boss, { x: 1000, y: 1000 }, 18, 0.45, () => {});
  assert.equal(fight.phase, 'blasting');
  fight.update(OVEN.coneMs, boss, { x: 1000, y: 1000 }, 18, 0.45, () => {});
  assert.equal(fight.phase, 'overheated');
  assert.equal(fight.vulnerable, true);

  // Hot overheat lasts 1400ms.
  fight.update(OVEN.hotOverheatMs - 1, boss, { x: 1000, y: 1000 }, 18, 0.45, () => {});
  assert.equal(fight.phase, 'overheated');
  fight.update(1, boss, { x: 1000, y: 1000 }, 18, 0.45, () => {});
  assert.equal(fight.phase, 'walking');

  // Projectile and salsa counts stay bounded over long runs.
  for (let i = 0; i < 2000; i++) {
    fight.update(50, boss, player, 18, 0.45, () => {});
    assert.ok(fight.tacos.length <= OVEN.maxTacos);
    assert.ok(fight.salsa.length <= OVEN.maxSalsa);
  }
});

test('line cooks are summoned once as the Oven passes each threshold, even if both pass at once', () => {
  const fight = ready();
  fight.update(16, boss, player, 18, 0.7, () => {});
  assert.equal(fight.pendingAdds, 0);
  fight.update(16, boss, player, 18, 0.6, () => {});
  assert.equal(fight.pendingAdds, OVEN.addsPerWave);
  fight.pendingAdds = 0;
  fight.update(16, boss, player, 18, 0.6, () => {});
  assert.equal(fight.pendingAdds, 0);

  const burst = ready();
  burst.update(16, boss, player, 18, 0.1, () => {});
  assert.equal(burst.pendingAdds, OVEN.addsPerWave * OVEN.addThresholds.length);
  burst.defeat();
  assert.equal(burst.pendingAdds, 0);
});

test('defeat cancels every warning, taco, slam, shockwave, cone, and salsa and stops the encounter', () => {
  const fight = ready();
  cycleTo(fight, 'slam', 1);
  fight.update(OVEN.slamWindupMs, boss, player, 18, 1, () => {});
  fight.update(OVEN.slamFlightMs, boss, player, 18, 1, () => {});
  assert.ok(fight.shockwaves.length > 0);
  assert.ok(fight.salsa.length > 0);

  let awards = 0;
  const target = { id: 999, position: boss, radius: 22, isDead: false, takeDamage: () => true };
  const combat = new CombatResolver(() => { awards++; fight.defeat(); });
  combat.damage(target, 1200);
  combat.damage(target, 1200);

  assert.equal(awards, 1);
  assert.equal(fight.tacos.length, 0);
  assert.equal(fight.warnings.length, 0);
  assert.equal(fight.slam, undefined);
  assert.equal(fight.shockwaves.length, 0);
  assert.equal(fight.cone, undefined);
  assert.equal(fight.salsa.length, 0);
  assert.equal(fight.pendingAdds, 0);
  fight.update(10000, boss, player, 18, 0, () => assert.fail('post-defeat damage'));
});

test('OvenBoss and OvenBossSystem wire 1.6x overheat vulnerability, mid-air contact immunity, kitchen crew, and boss audio events', () => {
  const { scene, emittedEvents, hudElements, load } = loadOvenSystemsWithMock();
  const { OvenBossSystem } = load('src/game/systems/OvenBossSystem.ts');

  const game = new GameManager();
  const nav = new SceneryNavigation(false, false, true);
  const summoned = [];
  const enemies = [];
  const system = new OvenBossSystem(scene, game, nav, (variant, count, tint) => summoned.push({ variant, count, tint }));
  const wanderer = { x: -8000, y: 6000 };

  system.spawnEncounter(wanderer, enemies);
  assert.ok(system.boss);
  assert.deepEqual({ ...system.boss.position }, { x: wanderer.x + OVEN.spawnDistance, y: wanderer.y });
  assert.equal(system.boss.maxHealth, OVEN.health);
  assert.ok(emittedEvents.some(e => e.event === 'audio:play' && e.args[0] === 'boss-spawn'));

  // Advance until slam -> shockwave -> overheated (normal HP > 50% -> slam enters overheated directly).
  emittedEvents.length = 0;
  for (let i = 0; i < 200 && system.encounter.phase !== 'overheated'; i++) {
    system.update(50, wanderer, 18);
    system.boss.update(50, wanderer);
    if (system.encounter.phase === 'slamming' && system.encounter.slamArc > 0.25) {
      assert.equal(system.boss.contactDamage, 0, 'mid-air leaping Oven has zero body-contact damage');
      assert.ok(system.boss.sprite.originY > 1, 'leaping Oven elevates sprite via originY while shadow stays grounded');
    }
  }
  assert.equal(system.encounter.phase, 'overheated');
  assert.deepEqual({ ...system.boss.position }, wanderer, 'the final step reaches the landing point');
  for (const ember of system.encounter.salsa) {
    assert.ok(ember.x < 0 && ember.y > 3200, 'the ember lands in the same area as the fight');
  }
  assert.equal(system.boss.vulnerability, OVEN.overheatVulnerability);
  assert.equal(system.boss.contactDamage, OVEN.contactDamage);
  assert.equal(system.boss.sprite.originY, 1);
  assert.ok(hudElements[0].captionEl.textContent.includes('Overheated'));
  assert.ok(emittedEvents.some(e => e.event === 'audio:play' && e.args[0] === 'boss-warn'));
  assert.ok(emittedEvents.some(e => e.event === 'audio:play' && e.args[0] === 'boss-impact'));

  // Vulnerability multiplies actual damage taken and triggers golden crit payload.
  emittedEvents.length = 0;
  const beforeHp = system.boss.health;
  system.boss.takeDamage(100);
  assert.equal(beforeHp - system.boss.health, 160);
  const dmgEvt = emittedEvents.find(e => e.event === 'presentation:damage');
  assert.ok(dmgEvt);
  assert.equal(dmgEvt.args[0].vulnerability, OVEN.overheatVulnerability);

  // Threshold cross summons doe + grey kitchen crew tinted OVEN.addTint.
  system.boss.health = system.boss.maxHealth * 0.65;
  system.update(16, wanderer, 18);
  assert.deepEqual(summoned, [
    { variant: 'doe', count: 4, tint: OVEN.addTint },
    { variant: 'grey', count: 3, tint: OVEN.addTint }
  ]);
});

test('the Oven closes a large gap before locking taco warnings in the open woods', () => {
  const fight = new OvenEncounter();
  const distantBoss = { x: -8600, y: 6100 };
  const wanderer = { x: -8000, y: 6100 };
  fight.update(OVEN.introductionMs, distantBoss, wanderer, 18, 1, () => {});
  fight.update(OVEN.arrivalWalkMs, distantBoss, wanderer, 18, 1, () => {});
  assert.equal(fight.phase, 'walking');
  assert.equal(fight.warnings.length, 0);

  const nearBoss = { x: -8300, y: 6100 };
  fight.update(1, nearBoss, wanderer, 18, 1, () => {});
  assert.equal(fight.phase, 'windup');
  assert.deepEqual(fight.warnings[1], wanderer);
  assert.ok(fight.warnings.every(warning => warning.x < 0 && warning.y > 3200));
});
