const test = require('node:test'), assert = require('node:assert/strict');
const { GameManager } = require('../artifacts/ability-tests/game/core/GameManager.js');
const { UpgradeSystem } = require('../artifacts/ability-tests/game/systems/UpgradeSystem.js');
const { weaponUpgrades } = require('../artifacts/ability-tests/game/core/WeaponUpgrades.js');
const { ProjectileFlight } = require('../artifacts/ability-tests/game/core/ProjectileFlight.js');
const { ABILITY_IDS } = require('../artifacts/ability-tests/game/config/abilities.js');
const { upgradeChanges, upgradePreview } = require('../artifacts/ability-tests/game/core/UpgradeProgress.js');
const foe = (id, x, y) => ({ id, position: { x, y }, radius: 10, isDead: false });
function flight(weapon, rank) {
  const stats = new GameManager(weapon).playerStats; stats.abilityRanks['ricochet-charm'] = rank;
  const u = weaponUpgrades(stats);
  return new ProjectileFlight(100, u.extraTargets, u.mode, u.retention, u.chainTier, u.pierces, u.pierceRetention);
}

test('ricochet turns both weapons toward an off-axis enemy and preserves crossbow piercing', () => {
  const first = foe(1, 0, 0), side = foe(2, 0, 100), last = foe(3, 0, 300);
  for (const weapon of ['spell', 'crossbow']) {
    const shot = flight(weapon, 1);
    assert.deepEqual(shot.hit(first.id, first.position, [first, side, last], { x: 1, y: 0 }), { x: 0, y: 1 });
    assert.equal(shot.damage, 70);
    const continuation = shot.hit(side.id, side.position, [first, side, last], { x: 0, y: 1 });
    if (weapon === 'crossbow') {
      assert.deepEqual(continuation, { x: 0, y: 1 }); assert.equal(shot.damage, 56);
      assert.equal(shot.hit(last.id, last.position, [first, side, last], continuation), undefined);
    } else assert.equal(continuation, undefined);
  }
});

test('unupgraded crossbow still pierces, and upgraded crossbow can pierce before a target becomes available', () => {
  const first = foe(1, 0, 0), next = foe(2, 100, 0), side = foe(3, 100, 100);
  const plain = flight('crossbow', 0);
  assert.deepEqual(plain.hit(first.id, first.position, [first, side], { x: 1, y: 0 }), { x: 1, y: 0 });
  assert.equal(plain.damage, 80);
  const upgraded = flight('crossbow', 1);
  upgraded.hit(first.id, first.position, [first], { x: 1, y: 0 });
  assert.deepEqual(upgraded.hit(next.id, next.position, [first, next, side], { x: 1, y: 0 }), { x: 0, y: 1 });
  assert.equal(upgraded.damage, 56);
});

test('awakened and ascended ricochet split at full damage on both weapons', () => {
  for (const weapon of ['spell', 'crossbow']) for (const rank of [5, 10]) {
    const shot = flight(weapon, rank);
    const enemies = Array.from({ length: rank + 3 }, (_, id) => foe(id + 1, id * 30, id % 2 * 20));
    const hits = rank + 1 + Number(weapon === 'crossbow');
    for (let i = 0; i < hits; i++) shot.hit(enemies[i].id, enemies[i].position, enemies, { x: 1, y: 0 });
    assert.equal(shot.damage, 100);
    assert.equal(shot.pendingSplit.directions.length, rank === 5 ? 4 : 6);
    assert.equal(shot.pendingSplit.bounces, rank === 5 ? 0 : 1);
    assert.equal(shot.pendingSplit.damage, rank === 5 ? 75 : 100);
  }
});

test('both weapons offer and apply every ability rank, companion, stat, and boss upgrade', () => {
  const upgrades = new UpgradeSystem();
  for (const weapon of ['spell', 'crossbow']) {
    const stats = new GameManager(weapon).playerStats; stats.level = 10;
    for (const id of ['projectile-damage', 'fire-rate', 'projectile-count', 'move-speed', 'max-health']) {
      const choice = upgrades.getAvailable(stats).find(c => c.id === id); assert.ok(choice, `${weapon}: ${id}`);
      upgrades.applyUpgrade(choice, stats); assert.equal(stats.upgradeCounts[id], 1);
    }
    const owner = { 'mystery-double-pounce': 'wizard', 'midnight-mighty-swat': 'hailey',
      'ribbon-sweep': 'ron', 'inspiring-shout': 'ron', 'dizzying-flurry': 'ron' };
    for (const id of ABILITY_IDS) for (let rank = 1; rank <= 10; rank++) {
      stats.characterId = owner[id] ?? 'wizard';
      stats.hasMysteryCompanion = true; stats.hasMidnightCompanion = true;
      const choice = upgrades.getAvailable(stats).find(c => c.id === id); assert.equal(choice.rank, rank);
      const snapshot = JSON.stringify(stats); assert.ok(upgradePreview(choice, stats).after); upgradeChanges(choice, stats);
      assert.equal(JSON.stringify(stats), snapshot);
      upgrades.applyUpgrade(choice, stats); assert.equal(stats.abilityRanks[id], rank);
    }
    for (const choice of upgrades.getBossChoices(stats)) {
      choice.apply(stats); assert.equal(stats.bossAbilityRanks[choice.id], 1);
    }
  }
});
