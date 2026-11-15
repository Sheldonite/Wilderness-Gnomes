const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const { BALANCE } = require('../artifacts/ability-tests/game/config/balance.js');
const { GameManager } = require('../artifacts/ability-tests/game/core/GameManager.js');
const { CombatResolver } = require('../artifacts/ability-tests/game/core/CombatResolver.js');
const { ChestDrops } = require('../artifacts/ability-tests/game/core/ChestDrops.js');
const { MidnightBehavior } = require('../artifacts/ability-tests/game/core/MidnightBehavior.js');
const { FrankieFlock } = require('../artifacts/ability-tests/game/core/FrankieFlock.js');
const { TobiasSwim } = require('../artifacts/ability-tests/game/core/TobiasSwim.js');
const { SceneryNavigation } = require('../artifacts/ability-tests/game/core/SceneryNavigation.js');
const { BossGate } = require('../artifacts/ability-tests/game/core/BossGate.js');
const { WOODLAND_SHRINE_REWARD } = require('../artifacts/ability-tests/game/core/RunEvents.js');
const { MarketProgress, emptyMarketProfile, goldForLevel } = require('../artifacts/ability-tests/game/core/MarketProgress.js');

function loadTsWithPhaserMock() {
  const emittedEvents = [];
  const noop = () => undefined;
  const makeGraphics = () => {
    const target = { destroy: noop };
    const g = new Proxy(target, {
      get(obj, prop) {
        if (prop in obj) return obj[prop];
        return () => g;
      }
    });
    return g;
  };
  const makeSprite = (x, y, texture) => {
    const sprite = {
      x,
      y,
      texture: { key: texture },
      rotation: 0,
      alpha: 1,
      displayWidth: 30,
      displayHeight: 30,
      originY: 0.5,
      flipX: false,
      visible: true,
      data: {},
      anims: { isPaused: false, currentAnim: null, play: noop, setProgress: noop, stop() { this.isPaused = true; }, pause() { this.isPaused = true; }, resume() { this.isPaused = false; } },
      setData(k, v) { this.data[k] = v; return this; },
      getData(k) { return this.data[k]; },
      setDisplaySize(w, h) { this.displayWidth = w; this.displayHeight = h; return this; },
      setDepth() { return this; },
      setScale() { return this; },
      setOrigin() { return this; },
      setFlipX(f) { this.flipX = f; return this; },
      setRotation(r) { this.rotation = r; return this; },
      setPosition(nx, ny) { this.x = nx; this.y = ny; return this; },
      setAlpha(a) { this.alpha = a; return this; },
      setTint() { return this; },
      setVisible(v) { this.visible = v; return this; },
      play(key) { this.anims.currentAnim = { key }; return this; },
      destroy: noop
    };
    return sprite;
  };

  const scene = {
    events: { emit(event, ...args) { emittedEvents.push({ event, args }); } },
    textures: {
      exists: () => true,
      get: () => ({ getSourceImage: () => ({ width: 32, height: 32 }), setFilter: noop }),
      getFrame: () => ({ realHeight: 64 })
    },
    add: {
      graphics: () => makeGraphics(),
      container: (x, y, children = []) => ({
        x, y,
        list: children,
        getAt(i) { return this.list[i]; },
        setDepth() { return this; },
        setPosition(nx, ny) { this.x = nx; this.y = ny; return this; },
        destroy: noop
      }),
      image: (x, y, texture) => ({
        x, y, texture, width: 32, height: 32,
        setDepth() { return this; },
        setOrigin() { return this; },
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
    },
    Textures: { FilterMode: { LINEAR: 1, NEAREST: 0 } }
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
      Infinity,
      performance,
      console,
      window: {
        matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop })
      },
      document: {
        createElement: () => {
          const el = {
            className: '',
            hidden: false,
            textContent: '',
            innerHTML: '',
            style: {},
            setAttribute: noop,
            querySelector: () => el,
            remove: noop
          };
          return el;
        },
        querySelector: () => ({ append: noop }),
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

  return { scene, emittedEvents, load };
}

test('Stage 2 market bonuses scale magnet radius, extra chest drops, and all four companion charms', () => {
  const profile = {
    ...emptyMarketProfile(),
    ranks: {
      'wayfinder-stone': 2,
      'mooncat-bell': 2,
      'midnight-collar': 2,
      'frankie-whistle': 2,
      'tobias-lure': 2
    }
  };

  // Wayfinder Stone rank 2: +40% magnetMultiplier (1.4x) and +10% extraChestChance (0.10)
  const hailey = new GameManager('spell', profile, 'hailey');
  assert.ok(Math.abs(hailey.playerStats.xpMagnetRangeMultiplier - 1.35 * 1.4) < 1e-6);
  assert.ok(Math.abs(hailey.marketBonuses.extraChestChance - 0.10) < 1e-6);

  // ChestDrops applies bonusChance on top of base 40%
  const nav = new SceneryNavigation(false);
  const baseDrops = new ChestDrops(nav, () => 0.45);
  baseDrops.advanceToLevel(2);
  assert.equal(baseDrops.pending, 0);
  const luckyDrops = new ChestDrops(nav, () => 0.45);
  luckyDrops.advanceToLevel(2, hailey.marketBonuses.extraChestChance);
  assert.equal(luckyDrops.pending, 2);

  // XPOrb uses magnetMultiplier when pulling orbs beyond base magnetRange
  const { scene, load } = loadTsWithPhaserMock();
  const { XPOrb } = load('src/game/entities/XPOrb.ts');
  const distBeyondBase = BALANCE.xp.magnetRange + 35; // 185px: outside 150px base, inside 150 * 1.4 = 210px
  const orb = new XPOrb(scene, distBeyondBase, 0, 5);
  orb.update(100, { x: 0, y: 0 }, 1);
  assert.equal(orb.position.x, distBeyondBase, 'orb stays put without magnetMultiplier');
  orb.update(100, { x: 0, y: 0 }, 1.4);
  assert.ok(orb.position.x < distBeyondBase, 'orb pulls toward player when magnetMultiplier expands range');

  // Companion damage multipliers for Mystery, Midnight, Frankie, Tobias
  const wizBase = new GameManager('spell', undefined, 'wizard');
  const wizCharmed = new GameManager('spell', profile, 'wizard');
  assert.ok(Math.abs(wizCharmed.playerStats.mysteryDamage - wizBase.playerStats.mysteryDamage * 1.3) < 1e-6);

  const midBase = new MidnightBehavior({ x: 0, y: 0 }, undefined, new GameManager('spell', undefined, 'hailey').playerStats);
  const midCharmed = new MidnightBehavior({ x: 0, y: 0 }, undefined, hailey.playerStats);
  assert.equal(midCharmed.swatPower.damage, Math.round(midBase.swatPower.damage * 1.3));

  const frankBase = new FrankieFlock(new GameManager('spell', undefined, 'sheldon').playerStats);
  const frankCharmed = new FrankieFlock(new GameManager('spell', profile, 'sheldon').playerStats);
  assert.equal(frankCharmed.damage, Math.round(frankBase.damage * 1.3));

  const tobBase = new TobiasSwim(new GameManager('spell', undefined, 'ron').playerStats);
  const tobCharmed = new TobiasSwim(new GameManager('spell', profile, 'ron').playerStats);
  assert.equal(tobCharmed.damage, Math.round(tobBase.damage * 1.3));
});

test('Stage 2 CollisionSystem + CombatResolver attribute projectile & boss damage into breakdown', () => {
  const { load } = loadTsWithPhaserMock();
  const { CollisionSystem } = load('src/game/systems/CollisionSystem.ts');

  const game = new GameManager('crossbow', undefined, 'wizard');
  const combat = new CombatResolver(
    () => {},
    (amount, source) => game.recordDamage(source, amount)
  );
  const collisions = new CollisionSystem();

  const bossEnemy = {
    id: 101,
    isBoss: true,
    isDead: false,
    position: { x: 200, y: 200 },
    radius: 30,
    health: 500,
    takeDamage(amount) {
      this.health -= amount;
      this.isDead = this.health <= 0;
      return this.isDead;
    },
    separate: () => undefined
  };

  let hitMarked = 0;
  const projectile = {
    isDead: false,
    position: { x: 205, y: 200 },
    radius: 10,
    damage: 42,
    source: 'weapon',
    hitEnemyIds: new Set(),
    markHit: () => { hitMarked++; },
    spawnSplits: () => undefined
  };

  collisions.update(
    1000,
    { isDashing: false, isHitInvulnerable: false, position: { x: 0, y: 0 }, radius: 14 },
    game,
    [bossEnemy],
    [projectile],
    [],
    combat.damage,
    []
  );

  // Also test ability source attribution alongside weapon damage
  combat.damage(bossEnemy, 18, 'firefly-orbit');

  assert.equal(hitMarked, 1);
  assert.equal(bossEnemy.health, 440);
  const breakdown = game.getDamageBreakdown();
  assert.deepEqual(breakdown.map(entry => [entry.id, entry.damage]), [
    ['weapon', 42],
    ['firefly-orbit', 18]
  ]);
});

test('Stage 2 Woodland Shrine reward syncs HP, frenzy speed, bonusGold, XP, and shrine compass style', () => {
  const { scene, load } = loadTsWithPhaserMock();
  const { PlayerController } = load('src/game/entities/PlayerController.ts');
  const { getPlayerCharacter } = load('src/game/config/playerCharacters.ts');
  const { COMPASS_STYLES } = load('src/game/systems/CompassSystem.ts');

  assert.ok(COMPASS_STYLES.shrine, 'CompassSystem defines style for shrine targets');

  const baseGame = new GameManager('spell', undefined, 'wizard');
  const boostedGame = new GameManager('spell', undefined, 'wizard');
  boostedGame.playerStats.health = 50;
  boostedGame.grantShrineReward(WOODLAND_SHRINE_REWARD);

  assert.equal(boostedGame.playerStats.health, 50 + WOODLAND_SHRINE_REWARD.heal);
  assert.equal(boostedGame.bonusGold, WOODLAND_SHRINE_REWARD.bonusGold);
  assert.ok(boostedGame.playerStats.shrineMoveSpeedBonus > 0);
  assert.ok(boostedGame.xp >= WOODLAND_SHRINE_REWARD.xpBurst);

  const wizard = getPlayerCharacter('wizard');
  const normalPlayer = new PlayerController(scene, baseGame.playerStats, wizard, 1600, 1600);
  const shrinePlayer = new PlayerController(scene, boostedGame.playerStats, wizard, 1600, 1600);
  normalPlayer.update(200, { x: 1, y: 0 });
  shrinePlayer.update(200, { x: 1, y: 0 });
  assert.ok(shrinePlayer.position.x > normalPlayer.position.x, 'shrineMoveSpeedBonus increases movement distance');

  // MarketProgress settleRun banks bonusGold alongside level gold
  const storageMap = new Map();
  const mockStorage = {
    getItem: k => storageMap.has(k) ? storageMap.get(k) : null,
    setItem: (k, v) => storageMap.set(k, String(v))
  };
  const market = new MarketProgress(mockStorage);
  const settled = market.settleRun(boostedGame.runId, 10, boostedGame.bonusGold);
  assert.equal(settled.status, 'awarded');
  assert.equal(settled.goldEarned, goldForLevel(10) + WOODLAND_SHRINE_REWARD.bonusGold);
});

test('Stage 2 BossGate Encore cycles past level 30 and scales Encore health', () => {
  const gate = new BossGate();
  assert.equal(gate.encoreAvailable(40), undefined);

  gate.defeat('oven');
  gate.defeat('stag');
  gate.defeat('buzzard');
  gate.defeat('king');
  assert.equal(gate.allDefeated, true);

  assert.equal(gate.encoreAvailable(39), undefined);
  assert.equal(gate.encoreAvailable(40), 'oven');
  assert.equal(gate.encoreHealthMultiplier(), 1);
  assert.equal(gate.nextBossMilestone(40).name, 'Oven (Encore 1)');

  gate.defeatEncore('oven');
  assert.equal(gate.encoreAvailable(40), undefined);
  assert.equal(gate.encoreAvailable(50), 'stag');
  assert.ok(Math.abs(gate.encoreHealthMultiplier() - 1.45) < 1e-6);
  assert.equal(gate.nextBossMilestone(50).level, 50);
});

test('Stage 2 weapon shots, chests, and rare rocks emit audio:play SFX events', () => {
  const { scene, emittedEvents, load } = loadTsWithPhaserMock();
  const { WeaponSystem } = load('src/game/systems/WeaponSystem.ts');
  const { ChestSystem } = load('src/game/systems/ChestSystem.ts');
  const { RareRockSystem } = load('src/game/systems/RareRockSystem.ts');

  const nav = new SceneryNavigation(false);
  const targetEnemy = { id: 1, isDead: false, position: { x: 180, y: 0 }, radius: 12 };

  for (const weaponId of ['spell', 'crossbow', 'boomerang', 'lantern']) {
    emittedEvents.length = 0;
    const gm = new GameManager(weaponId, undefined, 'wizard');
    const ws = new WeaponSystem(scene);
    ws.update(500, { x: 0, y: 0 }, gm.playerStats, [targetEnemy], []);
    assert.ok(
      emittedEvents.some(e => e.event === 'audio:play' && e.args[0] === `shot-${weaponId}`),
      `expected shot-${weaponId} audio:play event`
    );
  }

  // ChestSystem emits 'chest' on pickup
  emittedEvents.length = 0;
  const chestSystem = new ChestSystem(scene, nav);
  const gmChest = new GameManager('spell', undefined, 'wizard');
  chestSystem.dropChest({ x: 500, y: 500 });
  assert.equal(chestSystem.update(16, { x: 500, y: 500 }, gmChest), true);
  assert.ok(emittedEvents.some(e => e.event === 'audio:play' && e.args[0] === 'chest'));

  // RareRockSystem emits 'rock' on pickup
  emittedEvents.length = 0;
  const wallet = new MarketProgress(null);
  const rocks = new RareRockSystem(scene, nav, wallet, true);
  const dropped = rocks.drops.spawnNear({ x: 800, y: 800 });
  assert.ok(dropped);
  rocks.update(16, dropped.position, true);
  assert.ok(emittedEvents.some(e => e.event === 'audio:play' && e.args[0] === 'rock'));
});

test('earned chests are never free: each roll sends a golden elite carrier instead, retrying until one spawns', () => {
  const { scene, load } = loadTsWithPhaserMock();
  const { ChestSystem } = load('src/game/systems/ChestSystem.ts');
  const chestSystem = new ChestSystem(scene, new SceneryNavigation(false));
  const gm = new GameManager('spell', undefined, 'wizard');
  let carriers = 0, canSpawn = false;
  chestSystem.spawnCarrier = () => { if (!canSpawn) return false; carriers++; return true; };
  chestSystem.drops.advanceToLevel(gm.level);   // settle this level's own roll first
  chestSystem.drops.pending = 2;

  chestSystem.update(16, { x: 500, y: 500 }, gm);
  assert.equal(carriers, 0); assert.equal(chestSystem.drops.pending, 2, 'a failed spawn keeps the chest owed');
  assert.equal(chestSystem.drops.chests.length, 0, 'no free chest is placed');

  canSpawn = true;
  chestSystem.update(500, { x: 500, y: 500 }, gm);
  assert.equal(carriers, 1); assert.equal(chestSystem.drops.pending, 1);
  chestSystem.update(500, { x: 500, y: 500 }, gm);
  assert.equal(carriers, 2); assert.equal(chestSystem.drops.pending, 0);
  assert.equal(chestSystem.drops.chests.length, 0, 'chests only appear when the elite falls');
});

test('Stage 2 opening ambush pack spawns 7 brown squirrels off-screen on opposite flanks', () => {
  const { scene, load } = loadTsWithPhaserMock();
  const { EnemySpawner } = load('src/game/systems/EnemySpawner.ts');
  const nav = new SceneryNavigation(false);
  const spawner = new EnemySpawner(scene, nav);
  const camera = { worldView: { left: 960, right: 2240, top: 1240, bottom: 1960 } };
  const player = { x: 1600, y: 1600 };
  const enemies = [];

  const spawned = spawner.spawnOpeningPack(player, camera, 0, enemies, BALANCE.spawner.openingPackCount);
  assert.equal(spawned.length, 7);
  assert.equal(enemies.length, 7);
  const leftFlank = enemies.filter(e => e.position.x < camera.worldView.left);
  const rightFlank = enemies.filter(e => e.position.x > camera.worldView.right);
  assert.ok(leftFlank.length >= 3, 'at least 3 squirrels on left flank');
  assert.ok(rightFlank.length >= 3, 'at least 3 squirrels on right flank');
  for (const squirrel of enemies) {
    assert.equal(squirrel.variant, 'brown');
    const distBefore = Math.hypot(squirrel.position.x - player.x, squirrel.position.y - player.y);
    squirrel.update(100, player, 0);
    const distAfter = Math.hypot(squirrel.position.x - player.x, squirrel.position.y - player.y);
    assert.ok(distAfter < distBefore, 'opening ambush squirrels immediately close in on the player');
  }
});

test('Stage 2 Lv 5 SquirrelChiefSystem lifecycle, barrage/charge vulnerability, and defeat chest + gold + XP drop', () => {
  const { scene, emittedEvents, load } = loadTsWithPhaserMock();
  const { SquirrelChiefSystem } = load('src/game/systems/SquirrelChiefSystem.ts');
  const { SQUIRREL_CHIEF } = load('src/game/config/squirrelChief.ts');
  const { ChestSystem } = load('src/game/systems/ChestSystem.ts');
  const { XPOrb } = load('src/game/entities/XPOrb.ts');

  const nav = new SceneryNavigation(false);
  const gm = new GameManager('spell', undefined, 'wizard');
  const chestSystem = new ChestSystem(scene, nav);
  const enemies = [];
  const xpOrbs = [];
  const firedAcorns = [];

  const squirrelChief = new SquirrelChiefSystem(
    scene,
    gm,
    nav,
    (damage) => gm.damagePlayer(damage),
    (origin, directions, speed) => {
      for (const d of directions) firedAcorns.push({ origin, direction: d, speed });
    }
  );

  // Below level 5: does not spawn
  gm.level = 4;
  squirrelChief.update(16, { x: 1600, y: 1600 }, 18, enemies);
  assert.equal(squirrelChief.boss, undefined);

  // Level 5: spawns Squirrel Chief
  gm.level = 5;
  squirrelChief.update(16, { x: 1600, y: 1600 }, 18, enemies);
  assert.ok(squirrelChief.boss, 'Squirrel Chief spawns at level 5');
  assert.equal(enemies.length, 1);
  assert.equal(squirrelChief.boss.health, SQUIRREL_CHIEF.health);
  assert.ok(emittedEvents.some(e => e.event === 'audio:play' && e.args[0] === 'boss-spawn'));

  // Advance through arrival -> stalking -> barrageWindup -> fires 5 acorns
  squirrelChief.update(SQUIRREL_CHIEF.introductionMs + 10, { x: 1600, y: 1600 }, 18, enemies);
  squirrelChief.update(SQUIRREL_CHIEF.stalkMs + 10, { x: 1600, y: 1600 }, 18, enemies);
  assert.equal(squirrelChief.encounter.phase, 'barrageWindup');
  squirrelChief.update(SQUIRREL_CHIEF.barrageWindupMs + 10, { x: 1600, y: 1600 }, 18, enemies);
  assert.equal(firedAcorns.length, SQUIRREL_CHIEF.barrageCount);

  // Advance through stalking -> chargeWindup -> charging -> catchBreath (1.3x vulnerability)
  squirrelChief.update(SQUIRREL_CHIEF.stalkMs + SQUIRREL_CHIEF.barrageRestMs + 10, { x: 1600, y: 1600 }, 18, enemies);
  assert.equal(squirrelChief.encounter.phase, 'chargeWindup');
  squirrelChief.update(SQUIRREL_CHIEF.chargeWindupMs + 10, { x: 1600, y: 1600 }, 18, enemies);
  assert.equal(squirrelChief.encounter.phase, 'charging');
  squirrelChief.update(1000, { x: 1600, y: 1600 }, 18, enemies);
  assert.equal(squirrelChief.encounter.phase, 'catchBreath');
  squirrelChief.boss.update(16, { x: 1600, y: 1600 });
  assert.equal(squirrelChief.boss.vulnerability, SQUIRREL_CHIEF.vulnerableMultiplier);

  // Defeat via CombatResolver (mirroring GameScene.killEnemy wiring)
  const combat = new CombatResolver(enemy => {
    gm.recordKill();
    if (enemy === squirrelChief.boss) {
      squirrelChief.defeated();
      chestSystem.dropChest(enemy.position);
      gm.bonusGold += 3;
      xpOrbs.push(new XPOrb(scene, enemy.position.x, enemy.position.y, SQUIRREL_CHIEF.xp));
    }
  });
  combat.damage(squirrelChief.boss, squirrelChief.boss.health);
  assert.equal(squirrelChief.encounter.defeated, true);
  assert.equal(chestSystem.drops.chests.length, 1, 'defeating Squirrel Chief drops a guaranteed chest');
  assert.equal(gm.bonusGold, 3);
  assert.equal(xpOrbs.length, 1);
  assert.equal(xpOrbs[0].value, SQUIRREL_CHIEF.xp);
  squirrelChief.destroy();
});

test('Stage 2 recordKill() drives combo damage in CollisionSystem, combo XP in GameManager, and consumeWakingReward()', () => {
  const { load } = loadTsWithPhaserMock();
  const { CollisionSystem } = load('src/game/systems/CollisionSystem.ts');

  const gm = new GameManager('spell', undefined, 'wizard');
  const initialRerolls = gm.rerollsRemaining;
  const collisions = new CollisionSystem();
  const combat = new CombatResolver(
    () => gm.recordKill(),
    (amount, source) => gm.recordDamage(source, amount)
  );

  // Build a 10-kill streak -> 1.10x damage and XP multiplier
  for (let i = 0; i < 10; i++) gm.recordKill();
  assert.equal(gm.comboCount, 10);
  assert.ok(Math.abs(gm.getComboDamageMultiplier() - 1.1) < 1e-9);

  const enemy = {
    id: 501,
    isDead: false,
    position: { x: 100, y: 100 },
    radius: 15,
    health: 200,
    takeDamage(amount) {
      this.health -= amount;
      this.isDead = this.health <= 0;
      return this.isDead;
    }
  };
  const projectile = {
    isDead: false,
    position: { x: 100, y: 100 },
    radius: 8,
    damage: 20,
    source: 'weapon',
    hitEnemyIds: new Set(),
    markHit() { this.isDead = true; },
    spawnSplits() {}
  };

  collisions.update(
    500,
    { isDashing: false, isHitInvulnerable: false, position: { x: 0, y: 0 }, radius: 18 },
    gm,
    [enemy],
    [projectile],
    [],
    combat.damage,
    []
  );
  // 20 base damage * 1.10 combo multiplier = 22 dealt
  assert.ok(Math.abs(enemy.health - 178) < 1e-6, 'CollisionSystem scales projectile damage by combo multiplier');

  // Complete remaining 18 kills within 90s to trigger Woods are waking reward (28 total)
  for (let i = 0; i < 18; i++) gm.recordKill();
  assert.equal(gm.wakingCompleted, true);
  assert.equal(gm.consumeWakingReward(), true);
  assert.equal(gm.consumeWakingReward(), false);
  assert.equal(gm.rerollsRemaining, initialRerolls + 1);
  assert.equal(gm.bonusGold, 8);
});

test('Stage 2 Level 3 guaranteed chest roll queues an elite carrier via ChestSystem', () => {
  const { scene, load } = loadTsWithPhaserMock();
  const { ChestSystem } = load('src/game/systems/ChestSystem.ts');

  const nav = new SceneryNavigation(false);
  const chestSystem = new ChestSystem(scene, nav);
  // Force RNG to 0.99 so random 40% chest rolls never hit, isolating the Lv 3 guarantee
  chestSystem.drops = new ChestDrops(nav, () => 0.99);
  let carriersSpawned = 0;
  chestSystem.spawnCarrier = () => {
    carriersSpawned += 1;
    return true;
  };

  const gm = new GameManager('spell', undefined, 'wizard');
  gm.level = 2;
  chestSystem.update(500, { x: 1600, y: 1600 }, gm);
  assert.equal(carriersSpawned, 0, 'no guaranteed carrier at level 2');

  gm.level = 3;
  chestSystem.update(500, { x: 1600, y: 1600 }, gm);
  assert.equal(carriersSpawned, 1, 'reaching level 3 dispatches a guaranteed chest carrier');
  assert.equal(chestSystem.drops.pending, 0);
});

test('Stage 2 EnemySpawner and RunEventSystem forward playerLevel contact-damage scaling and handle frame-0 camera.worldView', () => {
  const { scene, load } = loadTsWithPhaserMock();
  scene.add.sprite = (x, y, texture) => ({
    x,
    y,
    scene,
    texture: { key: texture },
    displayHeight: 36,
    originY: 0.5,
    anims: { isPaused: false, pause() { this.isPaused = true; }, resume() { this.isPaused = false; }, stop() { this.isPaused = true; } },
    data: {},
    setData(k, v) { this.data[k] = v; return this; },
    getData(k) { return this.data[k]; },
    setTint(c) { this.tint = c; return this; },
    setDepth() { return this; },
    setScale() { return this; },
    setPosition(nx, ny) { this.x = nx; this.y = ny; return this; },
    play() { return this; },
    destroy: () => undefined
  });
  const phaserMod = load('src/game/systems/EnemySpawner.ts');
  const { EnemySpawner } = phaserMod;
  const { RunEventSystem } = load('src/game/systems/RunEventSystem.ts');

  const nav = new SceneryNavigation(false);
  const spawner = new EnemySpawner(scene, nav);
  const player = { x: 1600, y: 1600 };

  // Frame-0 camera with zeroed worldView spawns opening pack flanking both sides around x=1600
  const zeroViewCamera = { width: 1280, height: 720, worldView: { left: 0, right: 0, top: 0, bottom: 0 } };
  const opening = [];
  spawner.spawnOpeningPack(player, zeroViewCamera, 0, opening, 7);
  assert.equal(opening.length, 7);
  assert.ok(opening.filter(e => e.position.x < player.x - 600).length >= 3);
  assert.ok(opening.filter(e => e.position.x > player.x + 600).length >= 3);

  // RunEventSystem.trigger('ring') forwards level so ring enemies scale contactDamage with playerLevel
  const runEvents = new RunEventSystem(scene, nav);
  const lv1Ring = [];
  const lv10Ring = [];
  runEvents.trigger({ kind: 'ring', count: 4 }, 1, 0, player, zeroViewCamera, lv1Ring, spawner);
  runEvents.trigger({ kind: 'ring', count: 4 }, 10, 0, player, zeroViewCamera, lv10Ring, spawner);
  assert.equal(lv1Ring[0].contactDamage, BALANCE.enemy.contactDamage);
  // At level 10, ring spawns 'fawn' (base 6) scaled by 1 + 9 * 0.03 = 1.27 -> Math.round(6 * 1.27) = 8 > 6
  assert.equal(lv10Ring[0].contactDamage, Math.round(BALANCE.deer.fawn.contactDamage * (1 + 9 * BALANCE.enemy.damagePerLevel)));
  runEvents.destroy();
});
