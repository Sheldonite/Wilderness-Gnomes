const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { BALANCE } = require('../artifacts/ability-tests/game/config/balance.js');
const { SceneryNavigation } = require('../artifacts/ability-tests/game/core/SceneryNavigation.js');

// Run the real spawner and controller, replacing only Phaser's rendering and RNG.
function harness({ level = 20, side = 0, roll = 0, view, navigation } = {}) {
  const rng = Object.create(Math);
  rng.random = () => roll;
  const phaser = { Math: {
    Between: (min, max) => min === 0 && max === 3 ? side : Math.floor((min + max) / 2),
    Clamp: (value, min, max) => Math.max(min, Math.min(max, value))
  } };
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, Math: rng,
      require: id => id === 'phaser' ? phaser : load(path.resolve(path.dirname(filename), `${id}.ts`))
    }, { filename });
    return module.exports;
  }
  const scene = { events: { emit() {} }, add: { sprite(x, y, texture) {
    return { x, y, scene, texture: { key: texture },
      anims: { isPaused: false, pause() { this.isPaused = true; }, resume() { this.isPaused = false; }, stop() { this.isPaused = true; } },
      data: {}, setData(key, value) { this.data[key] = value; }, getData(key) { return this.data[key]; },
      setTint(color) { this.tint = color; }, setOrigin() {}, setFlipX(flip) { this.flipX = flip; return this; }, setRotation(r) { this.rotation = r; return this; }, setFrame(frame) { this.frame = frame; },
      setDepth() {}, setScale() {},
      setTexture(key) { this.texture.key = key; },
      setPosition(x, y) { this.x = x; this.y = y; },
      play(key) { this.animation = key; }
    };
  } } };
  const { EnemySpawner } = load('src/game/systems/EnemySpawner.ts');
  const camera = { worldView: view ?? { left: 960, right: 2240, top: 1240, bottom: 1960 } };
  const player = { x: (camera.worldView.left + camera.worldView.right) / 2,
    y: (camera.worldView.top + camera.worldView.bottom) / 2 };
  const spawner = new EnemySpawner(scene, navigation ?? new SceneryNavigation(false, false));
  const enemies = [];
  const controller = load('src/game/entities/EnemyController.ts');
  return { enemies, camera, player, scene, controller, spawnBatch: load('src/game/systems/EnemySpawner.ts').spawnBatch,
    update: (ms = BALANCE.spawner.initialSpawnIntervalMs, currentLevel = level, minutes = 0) =>
      spawner.update(ms, player, camera, enemies, minutes, currentLevel) };
}

function assertOutside(enemy, view) {
  const { x, y } = enemy.position;
  assert.ok(x >= enemy.radius && x <= 3200 - enemy.radius && y >= enemy.radius && y <= 3200 - enemy.radius);
  assert.ok(x + enemy.radius < view.left || x - enemy.radius > view.right ||
    y + enemy.radius < view.top || y - enemy.radius > view.bottom,
  `spawn (${x}, ${y}) must be outside ${JSON.stringify(view)}`);
}

test('the normal spawn pipeline unlocks armadillos at level 20 and initializes walking and rolling', () => {
  const run = harness();
  run.update(BALANCE.spawner.initialSpawnIntervalMs - 1, 19);
  assert.equal(run.enemies.length, 0);
  run.update(1, 19);
  assert.notEqual(run.enemies[0].variant, 'armadillo');
  run.update();
  const enemy = run.enemies[1];
  assert.equal(enemy.variant, 'armadillo');
  assert.equal(enemy.sprite.texture.key, 'enemy-armadillo');
  assert.equal(enemy.health, BALANCE.armadillo.health);
  assert.equal(enemy.radius, BALANCE.armadillo.radius);
  assert.equal(enemy.contactDamage, BALANCE.armadillo.walkDamage);
  assertOutside(enemy, run.camera.worldView);
  const start = enemy.position;
  enemy.update(100, run.player, 0);
  assert.ok(enemy.position.y > start.y, 'a normal spawn walks toward the player');
  enemy.sprite.setPosition(run.player.x, run.player.y - 100);
  enemy.update(16, run.player, 0);
  assert.equal(enemy.sprite.texture.key, 'enemy-armadillo-roll');
  enemy.update(BALANCE.armadillo.curlMs, run.player, 0);
  assert.equal(enemy.contactDamage, BALANCE.armadillo.rollDamage);
  const rollStart = enemy.position.y;
  enemy.update(50, run.player, 0);
  assert.ok(enemy.position.y > rollStart);
});

test('armadillos spawn outside the camera at every arena corner regardless of initial side', () => {
  for (const left of [0, 1920]) for (const top of [0, 2480]) for (let side = 0; side < 4; side++) {
    const run = harness({ side, view: { left, right: left + 1280, top, bottom: top + 720 } });
    run.update();
    assert.equal(run.enemies.length, 1);
    assertOutside(run.enemies[0], run.camera.worldView);
  }
});

test('a navigation correction into the camera is rejected before constructing a spawn', () => {
  const navigation = new SceneryNavigation(false, false);
  const nearest = navigation.nearest.bind(navigation);
  navigation.nearest = (p, radius) => p.y < 1240 ? { x: 1600, y: 1300 } : nearest(p, radius);
  const run = harness({ navigation });
  run.update();
  assert.equal(run.enemies.length, 1);
  assertOutside(run.enemies[0], run.camera.worldView);
});

test('no off-screen space skips a spawn without crashing or adding a phantom enemy', () => {
  const run = harness({ view: { left: 0, right: 3200, top: 0, bottom: 3200 } });
  run.update();
  assert.equal(run.enemies.length, 0);
  run.camera.worldView = { left: 960, right: 2240, top: 1240, bottom: 1960 };
  run.update();
  assert.equal(run.enemies.length, 1, 'spawning resumes when space is available');
});

test('level 20 retains the deer mix and respects the enemy cap', () => {
  const deer = harness({ roll: BALANCE.armadillo.spawnChance });
  deer.update();
  assert.notEqual(deer.enemies[0].variant, 'armadillo');
  const run = harness();
  for (let i = 0; i < BALANCE.spawner.initialMaxEnemies + 2; i++) run.update();
  assert.equal(run.enemies.length, BALANCE.spawner.initialMaxEnemies);
});

test('late spawn ticks bring small groups, still within the cap', () => {
  const run = harness({ level: 3 });
  assert.equal(run.spawnBatch(0), 1); assert.equal(run.spawnBatch(BALANCE.spawner.batchFromMinute), 2);
  assert.equal(run.spawnBatch(1000), BALANCE.spawner.maxBatch);
  run.update(BALANCE.spawner.initialSpawnIntervalMs, 3, BALANCE.spawner.batchFromMinute);
  assert.equal(run.enemies.length, 2);
  for (let i = 0; i < 500; i++) run.update(BALANCE.spawner.initialSpawnIntervalMs, 3, 1000);
  assert.equal(run.enemies.length, BALANCE.spawner.maxEnemiesCap);
});

test('creatures grow tougher with time: more health and bite, but speed levels off', () => {
  const { controller, scene } = harness();
  const { EnemyController, speedBonus, contactScale } = controller;
  assert.equal(speedBonus(100, 1), BALANCE.enemy.speedPerMinute);
  assert.equal(speedBonus(100, 1000), 100 * BALANCE.enemy.maxSpeedBonus, 'capped');
  const fresh = new EnemyController(scene, 100, 100, 0), late = new EnemyController(scene, 100, 100, 10);
  assert.equal(late.health, fresh.health + 10 * BALANCE.enemy.healthPerMinute);
  assert.equal(late.contactDamage, Math.round(BALANCE.enemy.contactDamage * contactScale(10)));
  const target = { x: 100, y: 10000 };
  late.update(1000, target, 1000);
  assert.ok(late.position.y - 100 <= BALANCE.enemy.speed * (1 + BALANCE.enemy.maxSpeedBonus) + 1e-6, 'never faster than the cap');
});

test('sturdier creatures and elites are worth more crystals; elites are tougher too', () => {
  const { controller, scene } = harness();
  const { EnemyController } = controller;
  for (const variant of ['brown', 'grey', 'doe', 'fawn', 'buck', 'armadillo']) {
    assert.equal(new EnemyController(scene, 0, 0, 0, undefined, undefined, variant).xpValue, BALANCE.enemyXp[variant]);
  }
  const elite = new EnemyController(scene, 0, 0, 0, undefined, undefined, 'doe');
  const base = { health: elite.health, contact: elite.contactDamage };
  elite.makeElite(); elite.makeElite();
  assert.ok(elite.elite);
  assert.equal(elite.health, base.health * BALANCE.elite.healthMultiplier, 'promoting twice changes nothing');
  assert.equal(elite.xpValue, BALANCE.enemyXp.doe * BALANCE.elite.xpMultiplier);
  assert.equal(elite.contactDamage, Math.round(base.contact * BALANCE.elite.damageMultiplier));
});

test('bosses ignore shoves, pulls and roots, resist slows, and hit with their own weight', () => {
  const { controller, scene } = harness();
  const { EnemyController } = controller;
  const boss = new EnemyController(scene, 500, 500, 0, undefined, { texture: 'x', radius: 30, scale: 1, animation: 'a', boss: { contactDamage: 24 } });
  assert.ok(boss.isBoss); assert.equal(boss.contactDamage, 24);
  boss.displace(200, 0); assert.equal(boss.position.x, 500); assert.equal(boss.position.y, 500);
  boss.slowMultiplier = 0; assert.equal(boss.effectiveSlow, BALANCE.boss.slowFloor);
  boss.health = 1000; boss.vulnerability = 1.25; boss.takeDamage(100);
  assert.equal(boss.health, 875, 'a stunned boss takes extra damage');
  const squirrel = new EnemyController(scene, 500, 500, 0);
  squirrel.displace(20, 0); assert.equal(squirrel.position.x, 520);
  squirrel.slowMultiplier = 0; assert.equal(squirrel.effectiveSlow, 0);
});

test('after King Frankie, the spawner sends buzzards that fly, swoop harder, and are worth more', () => {
  const run = harness({ level: BALANCE.buzzard.unlockLevel, roll: 0 });
  run.update();
  const bird = run.enemies[0];
  assert.equal(bird.variant, 'buzzard');
  assert.equal(bird.sprite.texture.key, 'companion-frankie');
  assert.equal(bird.health, BALANCE.buzzard.health);
  assert.equal(bird.xpValue, BALANCE.enemyXp.buzzard);
  assert.equal(bird.contactDamage, BALANCE.buzzard.contactDamage);
  assert.equal(bird.sprite.tint, BALANCE.buzzard.tint);
  // bring it close, let its first swoop come ready, and watch it wind up then dive
  bird.sprite.setPosition(run.player.x - 200, run.player.y);
  for (let i = 0; i < 400 && bird.contactDamage === BALANCE.buzzard.contactDamage; i++) bird.update(16, run.player, 0);
  assert.equal(bird.contactDamage, BALANCE.buzzard.swoopDamage, 'a swoop hits harder');
});

test('a stampeding deer gallops its lane, then hunts like any other', () => {
  const { controller, scene } = harness();
  const deer = new controller.EnemyController(scene, 1000, 1000, 0, undefined, undefined, 'doe');
  deer.stampede({ x: 1, y: 0 }, 200, 400);
  assert.ok(deer.stampeding);
  deer.update(250, { x: 1000, y: 3000 }, 0);   // ignores the player while running
  assert.equal(deer.position.x, 1100); assert.equal(deer.position.y, 1000);
  deer.update(250, { x: 1000, y: 3000 }, 0);
  assert.equal(deer.position.x, 1200); assert.ok(!deer.stampeding);
  deer.update(100, { x: 1200, y: 3000 }, 0);
  assert.ok(deer.position.y > 1000, 'back to chasing');
});
