const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GameManager } = require('../artifacts/ability-tests/game/core/GameManager.js');
const { FrankieFlock } = require('../artifacts/ability-tests/game/core/FrankieFlock.js');
const { UpgradeSystem } = require('../artifacts/ability-tests/game/systems/UpgradeSystem.js');
const { BALANCE } = require('../artifacts/ability-tests/game/config/balance.js');

let nextId = 0;
function foe(x, y, health = 100) {
  return { id: ++nextId, position: { x, y }, radius: 15, health, isDead: false,
    takeDamage(amount) { this.health -= amount; this.isDead = this.health <= 0; return this.isDead; } };
}
const origin = { x: 0, y: 0 };
const damage = (enemy, amount) => enemy.takeDamage(amount);

test('Frankie recruits once, then flock upgrades add birds up to five', () => {
  const stats = new GameManager().playerStats, upgrades = new UpgradeSystem();
  assert.equal(stats.hasFrankieCompanion, false);
  assert.ok(upgrades.getAvailable(stats).some(u => u.id === 'gain-companion-frankie'));
  assert.ok(!upgrades.getAvailable(stats).some(u => u.id === 'frankie-flock'));
  upgrades.applyUpgrade(upgrades.getAvailable(stats).find(u => u.id === 'gain-companion-frankie'), stats);
  assert.equal(stats.hasFrankieCompanion, true); assert.equal(stats.frankieCount, 1);
  assert.ok(!upgrades.getAvailable(stats).some(u => u.id === 'gain-companion-frankie'));
  for (let n = 2; n <= 5; n++) {
    const flock = upgrades.getAvailable(stats).find(u => u.id === 'frankie-flock');
    assert.ok(flock, `flock available at ${n - 1}`);
    upgrades.applyUpgrade(flock, stats);
    assert.equal(stats.frankieCount, n);
  }
  assert.ok(!upgrades.getAvailable(stats).some(u => u.id === 'frankie-flock'));
  assert.equal(new GameManager().playerStats.hasFrankieCompanion, false);
  assert.equal(new GameManager().playerStats.frankieCount, 0);
});

test('Frankie orbits at the listed radius, and more upgrades mean more birds', () => {
  const stats = new GameManager().playerStats;
  stats.hasFrankieCompanion = true; stats.frankieCount = 1;
  const flock = new FrankieFlock(stats);
  flock.update(0, origin, [], damage);
  assert.equal(flock.birds.length, 1);
  const radius = Math.hypot(flock.birds[0].position.x, flock.birds[0].position.y);
  assert.ok(Math.abs(radius - BALANCE.companion.frankieOrbitRadius) < 0.001);
  stats.frankieCount = 5;
  flock.update(16, origin, [], damage);
  assert.equal(flock.birds.length, 5);
  const angles = flock.birds.map(bird => Math.atan2(bird.position.y, bird.position.x)).sort((a, b) => a - b);
  for (let i = 1; i < angles.length; i++) assert.ok(Math.abs(angles[i] - angles[i - 1] - Math.PI * 2 / 5) < 0.05);
});

test('a buzzard stoops when a foe is in range, deals damage, then returns to the circle', () => {
  const stats = new GameManager().playerStats;
  stats.hasFrankieCompanion = true; stats.frankieCount = 1;
  const flock = new FrankieFlock(stats);
  flock.update(0, origin, [], damage);
  const enemy = foe(120, 0, 100);
  for (let t = 0; t < 2000; t += 50) flock.update(50, origin, [enemy], damage);
  assert.ok(enemy.health < 100, 'the stoop landed');
  assert.equal(flock.damage, BALANCE.companion.frankieDamage);
});

test('the flock moults feathers, and collecting them raises every bird’s damage up to the cap', () => {
  const stats = new GameManager().playerStats;
  stats.hasFrankieCompanion = true; stats.frankieCount = 1;
  const flock = new FrankieFlock(stats);
  flock.update(0, origin, [], damage);
  flock.update(BALANCE.companion.frankieFeatherMs, origin, [], damage);
  assert.equal(flock.feathers.length, 1);
  const feather = flock.feathers[0];
  flock.update(16, feather.position, [], damage);
  assert.equal(feather.isCollected, true);
  assert.equal(stats.frankieFeatherBonus, BALANCE.companion.frankieFeatherBonus);
  assert.equal(flock.damage, BALANCE.companion.frankieDamage + BALANCE.companion.frankieFeatherBonus);
  stats.frankieFeatherBonus = BALANCE.companion.frankieFeatherCap;
  stats.frankieCount = 5;
  const before = stats.frankieFeatherBonus;
  flock.update(BALANCE.companion.frankieFeatherMs, origin, [], damage);
  const extra = flock.feathers[0];
  if (extra) flock.update(16, extra.position, [], damage);
  assert.equal(stats.frankieFeatherBonus, before);
});

test('more buzzards moult feathers faster', () => {
  const one = new GameManager().playerStats;
  one.hasFrankieCompanion = true; one.frankieCount = 1;
  const five = new GameManager().playerStats;
  five.hasFrankieCompanion = true; five.frankieCount = 5;
  const lone = new FrankieFlock(one), pack = new FrankieFlock(five);
  lone.update(0, origin, [], damage); pack.update(0, origin, [], damage);
  const soon = BALANCE.companion.frankieFeatherMs / 5 + 16;
  lone.update(soon, origin, [], damage);
  pack.update(soon, origin, [], damage);
  assert.equal(lone.feathers.length, 0);
  assert.ok(pack.feathers.length >= 1);
});
