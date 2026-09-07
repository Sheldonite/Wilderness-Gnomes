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
      anims: { isPaused: false, pause() { this.isPaused = true; }, resume() { this.isPaused = false; } },
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
  return { enemies, camera, player, update: (ms = BALANCE.spawner.initialSpawnIntervalMs, currentLevel = level) =>
    spawner.update(ms, player, camera, enemies, 0, currentLevel) };
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
