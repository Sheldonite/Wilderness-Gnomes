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
      flipX: false,
      visible: true,
      anims: { currentAnim: null, play: noop, setProgress: noop, stop: noop },
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
