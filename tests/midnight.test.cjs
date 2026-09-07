const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MidnightBehavior, catFacing } = require('../artifacts/ability-tests/game/core/MidnightBehavior.js');
const { GameManager } = require('../artifacts/ability-tests/game/core/GameManager.js');
const { UpgradeSystem } = require('../artifacts/ability-tests/game/systems/UpgradeSystem.js');
const { CombatResolver } = require('../artifacts/ability-tests/game/core/CombatResolver.js');
const player = { x: 1000, y: 1000 };
let nextId = 0;
function foe(x, y, health = 100) {
  return { id: ++nextId, position: { x, y }, radius: 15, health, isDead: false,
    takeDamage(amount) { this.health -= amount; this.isDead = this.health <= 0; return this.isDead; } };
}
const damage = (enemy, amount) => enemy.takeDamage(amount);

test('Midnight recruits once, independently of Mystery, and both flags reset on restart', () => {
  const stats = new GameManager().playerStats, upgrades = new UpgradeSystem();
  assert.equal(stats.hasMidnightCompanion, false); assert.equal(stats.hasMysteryCompanion, false);
  upgrades.applyUpgrade(upgrades.getAvailable(stats).find(u => u.id === 'gain-companion-midnight'), stats);
  assert.equal(stats.hasMidnightCompanion, true); assert.equal(stats.hasMysteryCompanion, false);
  assert.ok(!upgrades.getAvailable(stats).some(u => u.id === 'gain-companion-midnight'));
  assert.ok(!upgrades.getAvailable(stats).some(u => u.id === 'mystery-double-pounce'));
  upgrades.applyUpgrade(upgrades.getAvailable(stats).find(u => u.id === 'gain-companion-mystery'), stats);
  assert.equal(stats.hasMysteryCompanion, true); assert.equal(stats.hasMidnightCompanion, true);
  assert.equal(new GameManager().playerStats.hasMidnightCompanion, false);
});

test('Midnight walks to enemies at a bounded speed rather than lunging or teleporting', () => {
  const cat = new MidnightBehavior(player), start = { ...cat.position };
  const enemy = foe(1190, 1025);
  cat.update(500, player, [enemy], damage); assert.deepEqual(cat.position, start);
  cat.update(100, player, [enemy], damage);
  assert.equal(cat.state, 'approaching'); assert.equal(cat.moving, true);
  assert.ok(Math.hypot(cat.position.x - start.x, cat.position.y - start.y) <= 26.0001);
});

test('swat plants the feet and applies damage once at the extended-paw frame', () => {
  const cat = new MidnightBehavior(player), enemy = foe(cat.position.x + 34, cat.position.y);
  cat.update(600, player, [enemy], damage); assert.equal(cat.state, 'swatting');
  const planted = { ...cat.position }; assert.equal(enemy.health, 100);
  cat.update(239, player, [enemy], damage); assert.equal(enemy.health, 100);
  cat.update(1, player, [enemy], damage); assert.equal(enemy.health, 78);
  cat.update(239, player, [enemy], damage); assert.equal(enemy.health, 78); assert.deepEqual(cat.position, planted);
  cat.update(1, player, [enemy], damage); assert.equal(cat.state, 'returning');
});

test('swat hits the front arc and misses enemies behind or beyond its reach', () => {
  const cat = new MidnightBehavior(player), x = cat.position.x, y = cat.position.y;
  const front = foe(x + 34, y), nearby = foe(x + 50, y + 20), behind = foe(x - 60, y), far = foe(x + 100, y);
  const enemies = [front, nearby, behind, far];
  cat.update(600, player, enemies, damage); cat.update(240, player, enemies, damage);
  assert.equal(front.health, 78); assert.equal(nearby.health, 78);
  assert.equal(behind.health, 100); assert.equal(far.health, 100);
});

test('a target that moves out or dies during windup is not hit', () => {
  const cat = new MidnightBehavior(player), enemy = foe(cat.position.x + 34, cat.position.y);
  cat.update(600, player, [enemy], damage); enemy.position.x += 300;
  cat.update(240, player, [enemy], damage); assert.equal(enemy.health, 100);
  const otherCat = new MidnightBehavior(player), dead = foe(otherCat.position.x + 34, otherCat.position.y);
  otherCat.update(600, player, [dead], damage); dead.isDead = true;
  otherCat.update(240, player, [dead], damage); assert.equal(dead.health, 100);
});

test('Midnight stays close to the player and walks back when the leash is exceeded', () => {
  const cat = new MidnightBehavior(player), enemy = foe(1400, 1000);
  cat.update(1000, player, [enemy], damage); assert.equal(cat.state, 'following');
  const before = { ...cat.position }; cat.update(100, { x: 2000, y: 1000 }, [], damage);
  assert.equal(cat.state, 'returning'); assert.ok(cat.position.x > before.x);
  assert.ok(Math.hypot(cat.position.x - before.x, cat.position.y - before.y) <= 26.0001);
});

test('all four swat directions use the corresponding front hit arc', () => {
  for (const [dx, dy, facing] of [[34, 0, 'right'], [-34, 0, 'left'], [0, -34, 'up'], [0, 34, 'down']]) {
    const cat = new MidnightBehavior(player), enemy = foe(cat.position.x + dx, cat.position.y + dy);
    cat.update(600, player, [enemy], damage); assert.equal(cat.facing, facing);
    cat.update(240, player, [enemy], damage); assert.equal(enemy.health, 78);
    assert.equal(catFacing({ x: dx, y: dy }), facing);
  }
});

test('overlapping Midnight and spell damage share the single-defeat gate', () => {
  const cat = new MidnightBehavior(player), enemy = foe(cat.position.x + 34, cat.position.y, 22);
  let defeats = 0; const combat = new CombatResolver(() => defeats++);
  cat.update(600, player, [enemy], combat.damage); cat.update(240, player, [enemy], combat.damage);
  combat.damage(enemy, 18); assert.equal(defeats, 1);
});

test('cooldown prevents another swat before 1500ms and a new companion has no old state', () => {
  const cat = new MidnightBehavior(player), enemy = foe(cat.position.x + 34, cat.position.y, 10000);
  cat.update(600, player, [enemy], damage); assert.equal(cat.swatSerial, 1);
  for (let i = 0; i < 14; i++) cat.update(100, player, [enemy], damage);
  assert.equal(cat.swatSerial, 1);
  cat.update(100, player, [enemy], damage); assert.equal(cat.swatSerial, 2);
  const fresh = new MidnightBehavior(player); assert.equal(fresh.swatSerial, 0); assert.equal(fresh.state, 'following');
});
