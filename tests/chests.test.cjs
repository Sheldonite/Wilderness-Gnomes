const test = require('node:test');
const assert = require('node:assert/strict');
const { ChestDrops } = require('../artifacts/ability-tests/game/core/ChestDrops.js');
const { GameManager } = require('../artifacts/ability-tests/game/core/GameManager.js');
const { SceneryNavigation } = require('../artifacts/ability-tests/game/core/SceneryNavigation.js');
const { UpgradeSystem } = require('../artifacts/ability-tests/game/systems/UpgradeSystem.js');
const origin = { x: 1600, y: 1600 };
const ground = new SceneryNavigation(false);
function seeded(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

test('chests roll once per level, including skipped levels, with a 40 percent threshold', () => {
  const rolls = [0, .399, .4, .8, .99];
  let count = 0;
  const drops = new ChestDrops(ground, () => rolls[count++]);
  drops.advanceToLevel(1); drops.advanceToLevel(5);
  assert.equal(drops.pending, 2); assert.equal(count, 5);
  for (let i = 0; i < 100; i++) drops.advanceToLevel(5);
  drops.advanceToLevel(3);
  assert.equal(drops.pending, 2); assert.equal(count, 5);
});

test('random drops average two chests per five levels across many runs', () => {
  const random = seeded(7321);
  let total = 0;
  for (let run = 0; run < 10000; run++) {
    const drops = new ChestDrops(ground, random);
    drops.advanceToLevel(5); total += drops.pending;
  }
  assert.ok(total / 10000 > 1.95 && total / 10000 < 2.05, `Average: ${total / 10000}`);
});

test('placement stays nearby on reachable ground, inside arena edges, without overlapping chests', () => {
  const nav = new SceneryNavigation();
  for (const player of [origin, { x: 30, y: 30 }, { x: 2200, y: 2000 }]) {
    const drops = new ChestDrops(nav, seeded(145)); drops.pending = 2;
    for (let i = 0; i < 10 && drops.pending; i++) drops.spawnNear(player);
    assert.equal(drops.chests.length, 2);
    for (const chest of drops.chests) {
      const distance = Math.hypot(chest.position.x - player.x, chest.position.y - player.y);
      assert.ok(distance >= 120 && distance <= 260);
      assert.equal(nav.blocked(chest.position, 24), false);
      assert.equal(nav.clear(player, chest.position, 18), true);
    }
    const [a, b] = drops.chests;
    assert.ok(Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y) >= 70);
  }
});

test('failed placement preserves the reward and can retry when ground is available', () => {
  let blocked = true;
  const drops = new ChestDrops({ blocked: () => blocked, clear: () => !blocked }, seeded(23));
  drops.pending = 1;
  assert.equal(drops.spawnNear(origin), undefined); assert.equal(drops.pending, 1);
  blocked = false;
  assert.ok(drops.spawnNear(origin)); assert.equal(drops.pending, 0);
});

test('one chest gives one real upgrade, freezes the run, and leaves level and XP unchanged', () => {
  const drops = new ChestDrops(ground, seeded(56)), game = new GameManager(), upgrades = new UpgradeSystem(seeded(12));
  game.addXp(8); drops.pending = 1;
  const chest = drops.spawnNear(origin);
  assert.equal(drops.collectNearby(origin, game), undefined);
  assert.equal(drops.collectNearby(chest.position, game), chest);
  assert.equal(drops.collectNearby(chest.position, game), undefined);
  assert.equal(game.state, 'LevelUpPaused'); assert.equal(game.upgradeSource, 'chest');
  const health = game.playerStats.health;
  game.update(1000); game.damagePlayer(10); game.addXp(8);
  assert.equal(game.elapsedMs, 0); assert.equal(game.playerStats.health, health);
  const choices = upgrades.getChoices(game.playerStats);
  assert.equal(new Set(choices.map(choice => choice.id)).size, 3);
  upgrades.applyUpgrade(choices[0], game.playerStats);
  game.resumeAfterUpgrade();
  assert.equal(game.playerStats.upgradeCounts[choices[0].id], 1);
  assert.equal(game.state, 'Playing'); assert.equal(game.level, 1); assert.equal(game.playerStats.level, 1);
  assert.equal(game.xp, 8); assert.equal(game.xpToNextLevel, 24);
  assert.equal(drops.chests.length, 0);
});

test('paused, dead and leveling players cannot consume chests; walls prevent collection', () => {
  const drops = new ChestDrops(ground, seeded(56)), game = new GameManager();
  drops.pending = 1; const chest = drops.spawnNear(origin);
  for (const state of ['Paused', 'GameOver', 'LevelUpPaused']) {
    game.state = state;
    assert.equal(drops.collectNearby(chest.position, game), undefined);
    assert.equal(drops.chests.length, 1);
  }
  game.state = 'Playing';
  const walled = new ChestDrops({ blocked: () => false, clear: () => false });
  walled.chests.push(chest);
  assert.equal(walled.collectNearby(chest.position, game), undefined);
  assert.equal(game.state, 'Playing');
});

test('queued XP rewards finish before a waiting chest, without losing either kind of upgrade', () => {
  const game = new GameManager(), drops = new ChestDrops(ground, seeded(19));
  drops.pending = 1; const chest = drops.spawnNear(origin);
  game.addXp(60);
  assert.equal(game.level, 2);
  assert.equal(drops.collectNearby(chest.position, game), undefined);
  game.resumeAfterUpgrade();
  assert.equal(game.level, 3); assert.equal(game.state, 'LevelUpPaused');
  assert.equal(game.upgradeSource, 'level');
  assert.equal(drops.collectNearby(chest.position, game), undefined);
  game.resumeAfterUpgrade();
  const xp = game.xp;
  assert.ok(drops.collectNearby(chest.position, game));
  game.resumeAfterUpgrade();
  assert.equal(game.level, 3); assert.equal(game.xp, xp); assert.equal(game.state, 'Playing');
});

test('chest upgrades respect ability level gates and new runs have no old drops or rewards', () => {
  const game = new GameManager(), upgrades = new UpgradeSystem();
  game.playerStats.abilityRanks['firefly-orbit'] = 5;
  game.openChestUpgrade();
  assert.ok(!upgrades.getAvailable(game.playerStats).some(choice => choice.id === 'firefly-orbit'));
  const fresh = new GameManager(), drops = new ChestDrops(ground, () => .8);
  assert.equal(fresh.state, 'Playing'); assert.equal(fresh.upgradeSource, 'level');
  assert.equal(drops.pending, 0); assert.deepEqual(drops.chests, []);
  drops.advanceToLevel(5); assert.equal(drops.pending, 0);
});
