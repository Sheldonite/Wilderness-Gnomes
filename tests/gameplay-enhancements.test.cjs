const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const { BALANCE } = require('../artifacts/ability-tests/game/config/balance.js');
const { ABILITIES } = require('../artifacts/ability-tests/game/config/abilities.js');
const { WEAPON_IDS, WEAPONS, getWeapon } = require('../artifacts/ability-tests/game/config/weapons.js');
const { PLAYER_CHARACTERS, getPlayerCharacter } = require('../artifacts/ability-tests/game/config/playerCharacters.js');
const { describeCompanionRank } = require('../artifacts/ability-tests/game/config/companions.js');
const { GameManager } = require('../artifacts/ability-tests/game/core/GameManager.js');
const { CombatResolver } = require('../artifacts/ability-tests/game/core/CombatResolver.js');
const { FrankieFlock } = require('../artifacts/ability-tests/game/core/FrankieFlock.js');
const { TobiasSwim } = require('../artifacts/ability-tests/game/core/TobiasSwim.js');
const { AbilitySimulation } = require('../artifacts/ability-tests/game/core/AbilitySimulation.js');
const { BossSchedule, BOSS_WAIT_MS } = require('../artifacts/ability-tests/game/core/BossSchedule.js');
const { RunEvents, WOODLAND_SHRINE_REWARD } = require('../artifacts/ability-tests/game/core/RunEvents.js');
const { SceneryNavigation } = require('../artifacts/ability-tests/game/core/SceneryNavigation.js');
const { UpgradeSystem } = require('../artifacts/ability-tests/game/systems/UpgradeSystem.js');

function loadWithPhaserMocks(extraGlobals = {}) {
  const createdTextures = new Map();
  const emittedEvents = [];

  const noop = () => undefined;
  const makeGraphics = () => {
    const g = {
      clear: () => g,
      setDepth: () => g,
      lineStyle: () => g,
      fillStyle: () => g,
      fillCircle: () => g,
      strokeCircle: () => g,
      fillPoints: () => g,
      fillTriangle: () => g,
      lineBetween: () => g,
      beginPath: () => g,
      arc: () => g,
      strokePath: () => g,
      destroy: noop
    };
    return g;
  };
  const makeContext = () => {
    const base = {
      getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      createRadialGradient: () => ({ addColorStop: noop }),
      createLinearGradient: () => ({ addColorStop: noop })
    };
    return new Proxy(base, {
      get(target, prop) {
        if (prop in target) return target[prop];
        return noop;
      }
    });
  };

  const scene = {
    events: {
      emit(event, ...args) {
        emittedEvents.push({ event, args });
      }
    },
    textures: {
      exists: key => createdTextures.has(key),
      get: key => createdTextures.get(key) ?? { getSourceImage: () => ({ width: 32, height: 32 }), setFilter: noop },
      createCanvas: (key, width, height) => {
        const entry = {
          key,
          width,
          height,
          context: makeContext(),
          add: noop,
          refresh: noop,
          setFilter: noop
        };
        createdTextures.set(key, entry);
        return entry;
      }
    },
    add: {
      graphics: () => makeGraphics(),
      image: (x, y, texture) => ({
        x, y, texture,
        setDepth() { return this; },
        setTint() { return this; },
        setDisplaySize() { return this; },
        setVisible() { return this; },
        setRotation() { return this; },
        setPosition(nx, ny) { this.x = nx; this.y = ny; return this; },
        destroy: noop
      }),
      ellipse: (x, y) => ({
        x, y,
        setDepth() { return this; },
        setPosition(nx, ny) { this.x = nx; this.y = ny; return this; },
        setScale() { return this; },
        destroy: noop
      }),
      sprite: (x, y, texture) => {
        const sprite = {
          x,
          y,
          scene,
          texture: { key: texture },
          rotation: 0,
          alpha: 1,
          tint: undefined,
          displayWidth: 30,
          displayHeight: 30,
          flipX: false,
          anims: { currentAnim: null, play: noop, setProgress: noop, stop: noop },
          setDisplaySize(w, h) { this.displayWidth = w; this.displayHeight = h; return this; },
          setDepth() { return this; },
          setScale() { return this; },
          setFlipX(f) { this.flipX = f; return this; },
          setRotation(r) { this.rotation = r; return this; },
          setPosition(nx, ny) { this.x = nx; this.y = ny; return this; },
          setAlpha(a) { this.alpha = a; return this; },
          setTint(c) { this.tint = c; return this; },
          play(key) { this.anims.currentAnim = { key }; return this; },
          destroy: noop
        };
        return sprite;
      }
    }
  };

  const phaser = {
    Math: {
      Clamp: (v, min, max) => Math.max(min, Math.min(max, v))
    },
    Textures: { FilterMode: { LINEAR: 1, NEAREST: 0 } }
  };

  const elements = [];
  const doc = {
    createElement: () => {
      const el = { className: '', hidden: false, textContent: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, remove: noop };
      elements.push(el);
      return el;
    },
    getElementById: () => ({ append: noop })
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
      Math,
      Number,
      Set,
      Map,
      Array,
      Object,
      window: { matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }) },
      document: doc,
      ...extraGlobals,
      require: id => {
        if (id === 'phaser') return phaser;
        if (id.includes('?') || /\.(png|jpg|jpeg|webp|svg|ogg|mp3|wav)$/i.test(id)) return id;
        const resolved = path.resolve(path.dirname(filename), id);
        if (fs.existsSync(`${resolved}.ts`)) return load(`${resolved}.ts`);
        return require(resolved);
      }
    }, { filename });
    return mod.exports;
  }

  return { load, scene, createdTextures, emittedEvents };
}

function makeEnemy(id, x, y, hp = 500, radius = 16) {
  return {
    id,
    isDead: false,
    position: { x, y },
    radius,
    hp,
    hits: 0,
    slowMultiplier: 1,
    takeDamage(amount) {
      this.hits += 1;
      this.hp -= amount;
      return this.hp <= 0;
    },
    displace(dx, dy) {
      this.position.x += dx;
      this.position.y += dy;
    }
  };
}

test('new weapon configs boomerang & lantern and storybook textures load cleanly', () => {
  assert.deepEqual(WEAPON_IDS, ['spell', 'crossbow', 'boomerang', 'lantern']);
  assert.equal(getWeapon('boomerang').name, 'Timber Boomerang');
  assert.equal(getWeapon('boomerang').behavior, 'boomerang');
  assert.equal(getWeapon('boomerang').texture, 'boomerang-blade');
  assert.equal(getWeapon('lantern').name, "Will-o'-Wisp Lantern");
  assert.equal(getWeapon('lantern').behavior, 'lantern');
  assert.equal(getWeapon('lantern').texture, 'lantern-orb');
  assert.equal(getWeapon('unknown').id, 'spell');

  const { load, scene, createdTextures } = loadWithPhaserMocks();
  const { createStorybookTextures } = load('src/game/phaser/storybookTextures.ts');
  createStorybookTextures(scene);
  assert.ok(createdTextures.has('boomerang-blade'));
  assert.ok(createdTextures.has('lantern-orb'));
});

test('WeaponSystem supports manualAim override, auto-aim default, Nick power, and shrine frenzy', () => {
  const { load, scene } = loadWithPhaserMocks();
  const { WeaponSystem } = load('src/game/systems/WeaponSystem.ts');

  const gm = new GameManager('spell', undefined, 'wizard'); // Nick: 1.15x spellPowerMultiplier
  const ws = new WeaponSystem(scene);
  const enemies = [makeEnemy(1, 200, 0), makeEnemy(2, 0, 400)];
  const projectiles = [];

  // Default auto-aim targets nearest enemy at (200, 0) once cooldown elapses.
  ws.update(400, { x: 0, y: 0 }, gm.playerStats, enemies, projectiles);
  assert.equal(projectiles.length, 1);
  assert.equal(projectiles[0].source, 'weapon');
  assert.ok(Math.abs(projectiles[0].damage - 18 * 1.15) < 1e-6);
  assert.ok(Math.abs(ws.aimAngle - 0) < 1e-6);

  // Manual aim overrides nearest enemy even at south (0, 100) and fires with empty enemy list too.
  ws.update(900, { x: 0, y: 0 }, gm.playerStats, [], projectiles, { x: 0, y: 100 });
  assert.equal(projectiles.length, 2);
  assert.ok(Math.abs(ws.aimAngle - Math.PI / 2) < 1e-6);

  // Shrine attack speed bonus shrinks subsequent cooldown from 850ms to 850 / 1.25 = 680ms.
  gm.playerStats.shrineAttackSpeedBonus = 0.25;
  ws.update(850, { x: 0, y: 0 }, gm.playerStats, enemies, projectiles); // fires shot #3 & arms 680ms cooldown
  assert.equal(projectiles.length, 3);
  ws.update(700, { x: 0, y: 0 }, gm.playerStats, enemies, projectiles); // 700ms >= 680ms fires shot #4!
  assert.equal(projectiles.length, 4);
});

test('boomerang arcs out, returns to moving playerAnchor, and strikes an enemy on both passes', () => {
  const { load, scene } = loadWithPhaserMocks();
  const { WeaponSystem } = load('src/game/systems/WeaponSystem.ts');
  const { CollisionSystem } = load('src/game/systems/CollisionSystem.ts');

  const gm = new GameManager('boomerang', undefined, 'sheldon');
  const ws = new WeaponSystem(scene);
  const hits = [];
  const resolver = new CombatResolver(() => undefined, (amount, source, target) => {
    hits.push({ id: target.id, amount, source });
    gm.recordDamage(source, amount);
  });
  const collisions = new CollisionSystem(scene);

  const player = { x: 0, y: 0 };
  const playerBody = { position: player, radius: 14 };
  const target = makeEnemy(1, 140, 0, 1000, 20);
  const projectiles = [];

  ws.update(400, player, gm.playerStats, [target], projectiles, { x: 200, y: 0 });
  assert.equal(projectiles.length, 1);

  let timeMs = 0;
  const checkHits = () => {
    collisions.update(timeMs, playerBody, gm, [target], projectiles, [], resolver.damage);
  };

  for (let step = 0; step < 50; step += 1) {
    timeMs += 40;
    // Move player slightly north mid-flight to verify live playerAnchor tracking.
    if (step === 15) player.y = -20;
    for (const p of projectiles) p.update(40);
    ws.update(0, player, gm.playerStats, [target], projectiles);
    checkHits();
    if (projectiles[0].isDead) break;
  }

  assert.equal(target.hits, 2, 'boomerang should hit once outbound and once returning');
  assert.equal(hits.length, 2);
  assert.ok(hits.every(h => h.source === 'weapon'));
  assert.equal(projectiles[0].isDead, true, 'boomerang should be caught upon returning to player');
});

test('lantern orbs deal AoE ember splash on impact and on expiry', () => {
  const { load, scene } = loadWithPhaserMocks();
  const { Projectile } = load('src/game/entities/Projectile.ts');
  const { CollisionSystem } = load('src/game/systems/CollisionSystem.ts');

  const gm = new GameManager('lantern', undefined, 'ron');
  const arm = WEAPONS.lantern;
  const collisions = new CollisionSystem(scene);
  const events = [];
  const resolver = new CombatResolver(() => undefined, (amount, source, target) => {
    events.push({ id: target.id, amount, source });
  });

  // Impact splash test: orb hits enemy 1 directly, burst splashes enemy 2 (within 84px), misses enemy 3 (200px away).
  const e1 = makeEnemy(1, 10, 0, 500, 15);
  const e2 = makeEnemy(2, 60, 0, 500, 15);
  const e3 = makeEnemy(3, 220, 0, 500, 15);
  const orb = new Projectile(scene, 0, 0, { x: 200, y: 0 }, 1000, arm.projectileDamage, 0, {
    behavior: 'lantern',
    radius: arm.projectileRadius,
    splashRadius: arm.splashRadius,
    splashDamageRatio: arm.splashDamageRatio,
    source: 'weapon'
  });
  const projectiles = [orb];
  const safePlayer = { position: { x: -500, y: 0 }, radius: 14 };
  collisions.update(100, safePlayer, gm, [e1, e2, e3], projectiles, [], resolver.damage);

  assert.equal(e1.hits, 1);
  assert.equal(e2.hits, 1);
  assert.equal(e3.hits, 0);
  assert.equal(events[0].amount, arm.projectileDamage);
  assert.equal(events[1].amount, Math.round(arm.projectileDamage * arm.splashDamageRatio));

  // Expiry splash test: orb expires without hitting first, bursts in-place and damages nearby enemy 4.
  const e4 = makeEnemy(4, 240, 0, 500, 16);
  const expiringOrb = new Projectile(scene, 0, 0, { x: 200, y: 0 }, 1000, 40, 0, {
    behavior: 'lantern',
    radius: 10,
    splashRadius: 80,
    splashDamageRatio: 0.75,
    source: 'weapon'
  });
  expiringOrb.update(1000); // moves to x=200 and transforms in-place to burst!
  assert.equal(expiringOrb.isDead, false);
  collisions.update(1100, safePlayer, gm, [e4], [expiringOrb], [], resolver.damage);
  assert.equal(e4.hits, 1);
  assert.equal(e4.hp, 500 - 30);
});

test('rerolls, skipUpgradeForBonus, damage breakdown, and HudSnapshot work accurately', () => {
  const gm = new GameManager('crossbow', undefined, 'ron');
  assert.equal(gm.rerollsRemaining, 1);
  assert.equal(gm.consumeReroll(), true);
  assert.equal(gm.rerollsRemaining, 0);
  assert.equal(gm.consumeReroll(), false);

  gm.damagePlayer(40, 'direct');
  assert.equal(gm.playerStats.health, 60);
  gm.openChestUpgrade('chest');
  const skip = gm.skipUpgradeForBonus();
  assert.deepEqual(skip, { healed: 15, bonusGold: 1 });
  assert.equal(gm.playerStats.health, 75);
  assert.equal(gm.bonusGold, 1);
  assert.equal(gm.state, 'Playing');

  // Cannot overheal beyond maxHealth
  gm.playerStats.health = gm.playerStats.maxHealth - 4;
  const skipCap = gm.skipUpgradeForBonus();
  assert.equal(skipCap.healed, 4);
  assert.equal(gm.playerStats.health, gm.playerStats.maxHealth);
  assert.equal(gm.bonusGold, 2);

  gm.recordDamage('weapon', 120);
  gm.recordDamage('acorn-shower', 340);
  gm.recordDamage('companion', 200);
  gm.recordDamage('crownfire', 240);
  const breakdown = gm.getDamageBreakdown();
  assert.deepEqual(breakdown.map(b => b.id), ['acorn-shower', 'crownfire', 'companion', 'weapon']);
  assert.equal(breakdown[3].label, 'Heartwood Crossbow');
  assert.equal(breakdown[2].label, 'Tobias');

  const snap = gm.getHudSnapshot();
  assert.equal(snap.rerollsRemaining, 0);
  assert.equal(snap.bonusGold, 2);
  assert.equal(snap.wardStatus, 'locked');
  assert.equal(snap.nextBossRemainingMs, BOSS_WAIT_MS);
  assert.equal(snap.nextBossName, 'Squirrel Chief');
});

test('character passives differentiate Nick, Hailey, Sheldon, and Ron cleanly', () => {
  for (const id of ['wizard', 'hailey', 'sheldon', 'ron']) {
    const def = getPlayerCharacter(id);
    assert.ok(def.passiveTrait.length > 0);
    assert.ok(def.blurb.length > 0);
    assert.equal(PLAYER_CHARACTERS[id].id, id);
  }

  // Sheldon: +25 maxHP, +1 starting reroll
  const sheldon = new GameManager('spell', undefined, 'sheldon');
  assert.equal(sheldon.playerStats.maxHealth, BALANCE.player.maxHealth + 25);
  assert.equal(sheldon.playerStats.health, BALANCE.player.maxHealth + 25);
  assert.equal(sheldon.rerollsRemaining, 2);

  // Hailey: +10% move speed & +35% XP magnet range
  const hailey = new GameManager('spell', undefined, 'hailey');
  assert.ok(Math.abs(hailey.playerStats.speed - BALANCE.player.speed * 1.1) < 1e-6);
  assert.equal(hailey.playerStats.xpMagnetRangeMultiplier, 1.35);
  const sim = new AbilitySimulation(hailey.playerStats);
  let nearAttracted = false;
  let farAttracted = false;
  const nearOrb = { position: { x: 195, y: 0 }, isCollected: false, attract() { nearAttracted = true; } };
  const farOrb = { position: { x: 225, y: 0 }, isCollected: false, attract() { farAttracted = true; } };
  sim.update(16, { x: 0, y: 0 }, [], [nearOrb, farOrb], () => undefined);
  assert.equal(nearAttracted, true, '195px is inside 150 * 1.35 = 202.5px');
  assert.equal(farAttracted, false, '225px is outside 202.5px');

  // Nick: +15% spellPowerMultiplier & +15% abilityPowerMultiplier wired in AbilitySystem
  const nick = new GameManager('spell', undefined, 'wizard');
  assert.equal(nick.playerStats.spellPowerMultiplier, 1.15);
  assert.equal(nick.playerStats.abilityPowerMultiplier, 1.15);
  nick.playerStats.abilityRanks['acorn-shower'] = 1;
  const { load, scene } = loadWithPhaserMocks();
  const { AbilitySystem } = load('src/game/systems/AbilitySystem.ts');
  const abSys = new AbilitySystem(scene, nick.playerStats);
  const foe = makeEnemy(1, 50, 0, 500, 16);
  const dealt = [];
  abSys.update(ABILITIES.acorn.cooldownMs + ABILITIES.acorn.warningMs + 50, { x: 0, y: 0 }, [foe], [], (t, amt, src) => {
    dealt.push({ amt, src });
  });
  abSys.update(ABILITIES.acorn.warningMs + 50, { x: 0, y: 0 }, [foe], [], (t, amt, src) => {
    dealt.push({ amt, src });
  });
  assert.ok(dealt.some(d => d.src === 'acorn-shower' && Math.abs(d.amt - ABILITIES.acorn.damage[1] * 1.15) < 0.05));
});

test('UpgradeSystem applies gentle build-affinity weighting without starving unlocks', () => {
  const gm = new GameManager('spell', undefined, 'wizard');
  gm.level = 15;
  gm.playerStats.level = 15;
  gm.playerStats.abilityRanks['acorn-shower'] = 4; // started ability rank 4
  let acornRank5Count = 0;
  let unlockOfferedCount = 0;
  const runs = 300;
  let seed = 1;
  const sys = new UpgradeSystem(() => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  });

  for (let i = 0; i < runs; i += 1) {
    const choices = sys.getChoices(gm.playerStats);
    assert.equal(choices.length, 3);
    if (choices.some(c => c.rank === 1)) unlockOfferedCount += 1;
    if (choices.some(c => c.id === 'acorn-shower' && c.rank === 5)) acornRank5Count += 1;
  }

  assert.equal(unlockOfferedCount, runs, 'at least one rank-1 unlock should always appear when unlocks remain');
  // Since acorn-shower is the only started ability (>1 rank), slot 2 guarantees it, plus it still gets offered fairly.
  assert.ok(acornRank5Count >= runs * 0.9);
});

test('Frankie Rank 5 Gale Stoop and Rank 10 Skypack Frenzy awakenings work and update copy', () => {
  assert.ok(describeCompanionRank('frankie', 5).includes('Gale Stoop'));
  assert.ok(describeCompanionRank('frankie', 10).includes('Skypack Frenzy'));

  // Rank 5: 50% splash in 70px gust
  const gm5 = new GameManager('spell', undefined, 'sheldon');
  gm5.level = 15;
  gm5.syncCompanionToLevel();
  assert.equal(gm5.playerStats.companionRank, 5);

  const flock5 = new FrankieFlock(gm5.playerStats);
  const hits5 = [];
  const main5 = makeEnemy(1, 140, 0, 500, 12);
  const near5 = makeEnemy(2, 190, 0, 500, 12); // 50px away from main5 (within 70 + 12)
  const far5 = makeEnemy(3, 250, 0, 500, 12);  // 110px away from main5 (outside 70 + 12)
  flock5.update(0, { x: 0, y: 0 }, [main5, near5, far5], (t, amt, src) => hits5.push({ id: t.id, amt, src }));
  for (let i = 0; i < 60; i += 1) {
    flock5.update(50, { x: 0, y: 0 }, [main5, near5, far5], (t, amt, src) => hits5.push({ id: t.id, amt, src }));
    if (hits5.length) break;
  }
  assert.ok(hits5.some(h => h.id === 1 && h.amt === flock5.damage && h.src === 'companion'));
  assert.ok(hits5.some(h => h.id === 2 && h.amt === Math.round(flock5.damage * 0.5) && h.src === 'companion'));
  assert.equal(hits5.some(h => h.id === 3), false);
  assert.ok(flock5.gustBursts.length >= 1);

  // Rank 10: 25% faster dive cooldown + feather cap raised to 60
  const gm10 = new GameManager('spell', undefined, 'sheldon');
  gm10.level = 30;
  gm10.syncCompanionToLevel();
  const flock10 = new FrankieFlock(gm10.playerStats);
  assert.equal(flock10.featherCap, 60);
  gm10.playerStats.frankieFeatherBonus = 58;
  const fEnemy = makeEnemy(1, 120, 0, 1000, 12);
  flock10.update(0, { x: 0, y: 0 }, [fEnemy], () => undefined);
  flock10.birds[0].featherDueMs = 10;
  flock10.feathers.push({ position: { x: 0, y: 0 }, bornAt: 0, expiresAt: 10000, isCollected: false });
  flock10.update(20, { x: 0, y: 0 }, [fEnemy], () => undefined);
  assert.equal(gm10.playerStats.frankieFeatherBonus, 60);
  assert.equal(flock10.damage, BALANCE.companion.frankieDamage + 60);

  // Check faster cooldown after diving strike at rank 10
  for (let i = 0; i < 50; i += 1) {
    flock10.update(40, { x: 0, y: 0 }, [fEnemy], () => undefined);
    if (flock10.birds[0].state === 'returning') break;
  }
  assert.equal(flock10.birds[0].state, 'returning');
  assert.ok(flock10.birds[0].cooldownMs <= Math.round(BALANCE.companion.frankieCooldownMs * 0.75));
});

test('Tobias Rank 5 Tidal Wake and Rank 10 Leviathan Surge awakenings work and update copy', () => {
  assert.ok(describeCompanionRank('tobias', 5).includes('Tidal Wake'));
  assert.ok(describeCompanionRank('tobias', 10).includes('Leviathan Surge'));

  // Rank 5: 60% splash AoE within 75px
  const gm5 = new GameManager('spell', undefined, 'ron');
  gm5.level = 15;
  gm5.syncCompanionToLevel();
  const swim5 = new TobiasSwim(gm5.playerStats);
  const t1 = makeEnemy(1, 150, 0, 500, 12);
  const t2 = makeEnemy(2, 200, 0, 500, 12); // 50px from t1 (within 75 + 12)
  const hits5 = [];
  swim5.update(0, { x: 0, y: 0 }, [t1, t2], (t, amt, src) => hits5.push({ id: t.id, amt, src }));
  for (let i = 0; i < 40; i += 1) {
    swim5.update(40, { x: 0, y: 0 }, [t1, t2], (t, amt, src) => hits5.push({ id: t.id, amt, src }));
    if (hits5.length) break;
  }
  assert.ok(hits5.some(h => h.id === 1 && h.amt === swim5.damage && h.src === 'companion'));
  assert.ok(hits5.some(h => h.id === 2 && h.amt === Math.round(swim5.damage * 0.6) && h.src === 'companion'));
  assert.equal(swim5.state, 'returning');
  assert.ok(swim5.splashRings.length >= 1);

  // Rank 10: Leviathan Surge chains up to 2 extra nearby targets before returning
  const gm10 = new GameManager('spell', undefined, 'ron');
  gm10.level = 30;
  gm10.syncCompanionToLevel();
  const swim10 = new TobiasSwim(gm10.playerStats);
  const c1 = makeEnemy(1, 120, 0, 1000, 12);
  const c2 = makeEnemy(2, 220, 0, 1000, 12); // 100px away (> 75px splash, < 190px chain)
  const c3 = makeEnemy(3, 320, 0, 1000, 12); // 100px from c2
  const directHits10 = [];
  const deal10 = (t, amt, src) => {
    directHits10.push({ id: t.id, amt, src });
    t.takeDamage(amt);
  };
  swim10.update(0, { x: 0, y: 0 }, [c1, c2, c3], deal10);
  for (let i = 0; i < 80; i += 1) {
    swim10.update(40, { x: 0, y: 0 }, [c1, c2, c3], deal10);
    if (swim10.state === 'returning') break;
  }
  assert.equal(c1.hits, 1);
  assert.equal(c2.hits, 1);
  assert.equal(c3.hits, 1);
  assert.equal(directHits10.length, 3);
  assert.ok(directHits10.every(h => h.src === 'companion'));
  assert.equal(swim10.state, 'returning');
});

test('BossPowerSystem and AbilitySimulation attribute exact source ids', () => {
  const { load, scene } = loadWithPhaserMocks();
  const { BossPowerSystem } = load('src/game/systems/BossPowerSystem.ts');

  const gm = new GameManager('spell', undefined, 'wizard');
  gm.playerStats.bossAbilityRanks.crownfire = 2; // 240 dmg
  gm.playerStats.bossAbilityRanks.stormcall = 3; // 240 dmg (colliding numerical value!)
  const bps = new BossPowerSystem(scene);
  const recorded = [];
  const resolver = new CombatResolver(() => undefined, (amount, source) => {
    recorded.push(source);
    gm.recordDamage(source, amount);
  });

  // One enemy inside crownfire range (<= 240 + 15) and another further in stormcall range (~320px)
  const near = makeEnemy(1, 100, 0, 2000, 15);
  const far = makeEnemy(2, 320, 0, 2000, 15);
  bps.update(100, gm, { x: 0, y: 0 }, [near, far], resolver.damage);
  assert.ok(recorded.includes('crownfire'));
  assert.ok(recorded.includes('stormcall'));
  const breakdown = gm.getDamageBreakdown();
  assert.equal(breakdown.find(b => b.id === 'crownfire')?.damage, 240);
  assert.equal(breakdown.find(b => b.id === 'stormcall')?.damage, 480);

  // AbilitySimulation direct attribute check across multiple abilities
  const sim = new AbilitySimulation(gm.playerStats);
  gm.playerStats.abilityRanks['firefly-orbit'] = 1;
  gm.playerStats.abilityRanks['bramble-snare'] = 5;
  const abilitySources = new Set();
  const foe = makeEnemy(9, ABILITIES.firefly.radius, 0, 1000, 20);
  for (let i = 0; i < 60; i += 1) {
    sim.update(50, { x: 0, y: 0 }, [foe], [], (_t, _amt, src) => {
      if (src) abilitySources.add(src);
    });
    if (abilitySources.has('firefly-orbit')) break;
  }
  assert.ok(abilitySources.has('firefly-orbit'));
});

test('Woodland Shrines spawn every ~2.5 min and RunEventSystem delivers choice-free cozy reward', () => {
  const schedule = new RunEvents();
  const before = schedule.update(BALANCE.events.shrineFirstMs - 1, 1.5);
  assert.equal(before.length, 2);
  assert.equal(schedule.consumeShrineDue(), false);
  schedule.update(1, 1.5);
  assert.equal(schedule.consumeShrineDue(), true);
  assert.equal(schedule.consumeShrineDue(), false);

  const gm = new GameManager('spell', undefined, 'ron');
  gm.damagePlayer(50, 'direct');
  const { load, scene, emittedEvents } = loadWithPhaserMocks();
  const { RunEventSystem } = load('src/game/systems/RunEventSystem.ts');
  const sys = new RunEventSystem(scene, new SceneryNavigation(false, false));

  const shrine = sys.spawnShrine({ x: 500, y: 500 });
  assert.equal(sys.activeShrines.length, 1);

  // Walk onto the spawned shrine
  sys.update(16, true, 1, 2.5, shrine.position, {}, [], {}, reward => gm.grantShrineReward(reward));
  assert.equal(sys.activeShrines.length, 0);
  assert.equal(gm.playerStats.health, 75);
  assert.equal(gm.bonusGold, WOODLAND_SHRINE_REWARD.bonusGold);
  assert.equal(gm.playerStats.shrineAttackSpeedBonus, WOODLAND_SHRINE_REWARD.attackSpeedBonus);
  assert.equal(gm.xp, WOODLAND_SHRINE_REWARD.xpBurst);
  assert.ok(emittedEvents.some(e => e.event === 'audio:play' && e.args[0] === 'shrine'));

  // Shrine frenzy expires after 6000ms
  gm.update(6000);
  assert.equal(gm.playerStats.shrineAttackSpeedBonus, 0);
  assert.equal(gm.playerStats.shrineMoveSpeedBonus, 0);
});

test('wilds shrines, enemy rings and stampede lanes remain near the player beyond the old map', () => {
  const player = { x: -2400, y: 6300 };
  const nav = new SceneryNavigation(false, false, true, position => position.x >= player.x);
  const { load, scene } = loadWithPhaserMocks();
  const { RunEventSystem } = load('src/game/systems/RunEventSystem.ts');
  const events = new RunEventSystem(scene, nav);
  const enemies = [];
  const outsideOldMap = point => point.x < 0 && point.y > 3200;

  const shrine = events.spawnShrine(player);
  assert.ok(outsideOldMap(shrine.position) && nav.isDry(shrine.position, 24));
  assert.ok(Math.hypot(shrine.position.x - player.x, shrine.position.y - player.y) <= 310.001);
  events.trigger({ kind: 'ring', count: 4 }, 11, 0, player, {}, enemies, {});
  assert.equal(enemies.length, 4);
  assert.ok(enemies.every(enemy => outsideOldMap(enemy.position)));
  events.launchStampede(player, 1, 4, 11);
  events.update(BALANCE.events.stampedeWarnMs + 1, false, 11, 0, player, {}, enemies, {});
  assert.equal(enemies.length, 8);
  assert.ok(enemies.slice(4).every(enemy => enemy.stampeding && outsideOldMap(enemy.position)));
  events.destroy();
});

test('a living timed boss leaves ordinary chest carriers and chest upgrades available', () => {
  const { load, scene } = loadWithPhaserMocks();
  const { ChestSystem } = load('src/game/systems/ChestSystem.ts');
  const chests = new ChestSystem(scene, new SceneryNavigation(false, false, true));
  const gm = new GameManager();
  gm.update(60_000);
  gm.bossSchedule.startDue(gm.elapsedMs);
  assert.equal(gm.bossSchedule.activeBoss, 'chief');
  gm.level = 10;

  const player = { x: -2400, y: 6300 };
  const dispatched = [];
  chests.spawnCarrier = kind => { dispatched.push(kind); return true; };
  chests.drops.addChest(player);

  assert.equal(chests.update(16, player, gm), true);
  assert.deepEqual(dispatched, ['featured-hedgehog']);
  assert.equal(chests.drops.chests.length, 0);
  assert.equal(gm.upgradeSource, 'chest');
  assert.equal(gm.bossSchedule.activeBoss, 'chief');
});

test('timed Encore bosses keep a full countdown after each defeat and increase in strength', () => {
  const schedule = new BossSchedule();
  let elapsedMs = 0;
  for (const id of ['chief', 'oven', 'stag', 'buzzard', 'king']) {
    elapsedMs += BOSS_WAIT_MS;
    assert.equal(schedule.startDue(elapsedMs)?.id, id);
    elapsedMs += 35_000;
    assert.equal(schedule.defeat(id, elapsedMs), true);
  }
  assert.equal(schedule.storyFinished, true);
  assert.equal(schedule.startDue(elapsedMs + BOSS_WAIT_MS - 1), undefined);
  elapsedMs += BOSS_WAIT_MS;
  const first = schedule.startDue(elapsedMs);
  assert.equal(first.id, 'oven');
  assert.match(first.name, /Encore 1/);
  assert.equal(first.healthMultiplier, 1);

  elapsedMs += 90_000;
  assert.equal(schedule.startDue(elapsedMs), undefined);
  assert.equal(schedule.defeat('oven', elapsedMs), true);
  assert.equal(schedule.upcoming(elapsedMs).remainingMs, BOSS_WAIT_MS);
  assert.equal(schedule.startDue(elapsedMs + BOSS_WAIT_MS - 1), undefined);
  const second = schedule.startDue(elapsedMs + BOSS_WAIT_MS);
  assert.equal(second.id, 'stag');
  assert.match(second.name, /Encore 2/);
  assert.ok(second.healthMultiplier > first.healthMultiplier);
});
