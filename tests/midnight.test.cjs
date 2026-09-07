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

test('Mighty Swat belongs to Hailey, ranks up once per pick, and resets each run', () => {
  const stats = new GameManager('spell', undefined, 'hailey').playerStats, upgrades = new UpgradeSystem();
  const offer = () => upgrades.getAvailable(stats).find(u => u.id === 'midnight-mighty-swat');
  assert.equal(upgrades.getAvailable(new GameManager().playerStats).find(u => u.id === 'midnight-mighty-swat'), undefined);
  const first = offer(); assert.equal(first.rank, 1);
  upgrades.applyUpgrade(first, stats); upgrades.applyUpgrade(first, stats);
  assert.equal(stats.abilityRanks['midnight-mighty-swat'], 1);
  assert.equal(offer().rank, 2);
  assert.equal(new GameManager().playerStats.abilityRanks['midnight-mighty-swat'], 0);
});

test('swat rank upgrades reach and damage on the existing companion, without duplicate hits', () => {
  const stats = new GameManager().playerStats;
  const cat = new MidnightBehavior(player, undefined, stats);
  stats.abilityRanks['midnight-mighty-swat'] = 3;
  const near = foe(cat.position.x + 34, cat.position.y, 1000);
  const extended = foe(cat.position.x + 82, cat.position.y, 1000);
  cat.update(600, player, [near, extended], damage);
  cat.update(240, player, [near, extended], damage);
  assert.equal(near.health, 864); assert.equal(extended.health, 864);
  cat.update(240, player, [near, extended], damage);
  assert.equal(near.health, 864);
});

test('rank five sweeps beside Midnight, and rank ten also hits behind her', () => {
  for (const rank of [0, 5, 10]) {
    const stats = new GameManager().playerStats; stats.abilityRanks['midnight-mighty-swat'] = rank;
    const cat = new MidnightBehavior(player, undefined, stats);
    const front = foe(cat.position.x + 30, cat.position.y, 1000);
    const side = foe(cat.position.x, cat.position.y + 50, 1000);
    const back = foe(cat.position.x - 50, cat.position.y, 1000);
    cat.update(600, player, [front, side, back], damage);
    cat.update(240, player, [front, side, back], damage);
    assert.equal(side.health < 1000, rank >= 5);
    assert.equal(back.health < 1000, rank === 10);
  }
});

test('higher swat ranks shorten the interval without moving the impact frame', () => {
  const strikes = rank => {
    const stats = new GameManager().playerStats; stats.abilityRanks['midnight-mighty-swat'] = rank;
    const cat = new MidnightBehavior(player, undefined, stats), target = foe(cat.position.x + 30, cat.position.y, 10000);
    let hits = 0;
    cat.update(600, player, [target], () => hits++);
    for (let elapsed = 0; elapsed < 4000; elapsed += 10) cat.update(10, player, [target], () => hits++);
    return hits;
  };
  assert.ok(strikes(10) > strikes(0));
});

test('each wanderer brings exactly one companion, and never the others', () => {
  const upgrades = new UpgradeSystem();
  const expected = { wizard: 'mystery', hailey: 'midnight', sheldon: 'frankie', ron: 'tobias' };
  for (const [character, companion] of Object.entries(expected)) {
    const stats = new GameManager('spell', undefined, character).playerStats;
    assert.equal(stats.companionId, companion, character);
    assert.equal(stats.hasMysteryCompanion, companion === 'mystery', character);
    assert.equal(stats.hasMidnightCompanion, companion === 'midnight', character);
    assert.equal(stats.hasFrankieCompanion, companion === 'frankie', character);
    assert.equal(stats.hasTobiasCompanion, companion === 'tobias', character);
    assert.equal(upgrades.getAvailable(stats).some(u => u.id === 'midnight-mighty-swat'), character === 'hailey', character);
  }
});

test('Midnight walks to enemies at a bounded speed rather than lunging or teleporting', () => {
  const cat = new MidnightBehavior(player), start = { ...cat.position };
  const enemy = foe(1190, 1025);
  cat.update(500, player, [enemy], damage); assert.deepEqual(cat.position, start);
  cat.update(100, player, [enemy], damage);
  assert.equal(cat.state, 'approaching'); assert.equal(cat.moving, true);
  assert.ok(Math.hypot(cat.position.x - start.x, cat.position.y - start.y) <= 26.0001);
});

test('stationary swat applies damage once at the extended-paw frame', () => {
  const cat = new MidnightBehavior(player), enemy = foe(cat.position.x + 34, cat.position.y);
  cat.update(600, player, [enemy], damage); assert.equal(cat.state, 'swatting');
  const planted = { ...cat.position }; assert.equal(enemy.health, 100);
  cat.update(239, player, [enemy], damage); assert.equal(enemy.health, 100);
  cat.update(1, player, [enemy], damage); assert.equal(enemy.health, 12);
  cat.update(239, player, [enemy], damage); assert.equal(enemy.health, 12); assert.deepEqual(cat.position, planted);
  cat.update(1, player, [enemy], damage); assert.equal(cat.state, 'returning');
});

test('Midnight keeps walking during a swat and strikes from her updated position', () => {
  const cat = new MidnightBehavior(player), start = { ...cat.position };
  const enemy = foe(start.x + 34, start.y, 1000);
  cat.update(600, player, [enemy], damage);
  const walkingPlayer = { x: player.x + 30, y: player.y };
  cat.update(240, walkingPlayer, [enemy], damage);
  assert.equal(cat.state, 'swatting'); assert.equal(cat.moving, true);
  assert.ok(cat.position.x > start.x && cat.position.x <= start.x + 30);
  assert.equal(enemy.health, 912);
  cat.update(240, walkingPlayer, [enemy], damage);
  assert.equal(enemy.health, 912, 'moving does not apply the same swat twice');
});

test('walking does not rotate the locked swat cone or ignore scenery', () => {
  const cat = new MidnightBehavior(player), start = { ...cat.position };
  const enemy = foe(start.x + 34, start.y, 1000);
  cat.update(600, player, [enemy], damage);
  cat.update(240, { x: player.x, y: player.y - 30 }, [enemy], damage);
  assert.equal(cat.facing, 'up'); assert.equal(cat.swatFacing, 'right');
  assert.equal(enemy.health, 912);
  const wall = { nearest: p => p, toward: from => from, clear: () => true };
  const blocked = new MidnightBehavior(player, wall), position = { ...blocked.position };
  const target = foe(position.x + 34, position.y, 1000);
  blocked.update(600, player, [target], damage);
  blocked.update(240, { x: player.x + 100, y: player.y }, [target], damage);
  assert.deepEqual(blocked.position, position);
});

test('swat hits the front arc and misses enemies behind or beyond its reach', () => {
  const cat = new MidnightBehavior(player), x = cat.position.x, y = cat.position.y;
  const front = foe(x + 34, y), nearby = foe(x + 50, y + 20), behind = foe(x - 60, y), far = foe(x + 100, y);
  const enemies = [front, nearby, behind, far];
  cat.update(600, player, enemies, damage); cat.update(240, player, enemies, damage);
  assert.equal(front.health, 12); assert.equal(nearby.health, 12);
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
    cat.update(240, player, [enemy], damage); assert.equal(enemy.health, 12);
    assert.equal(catFacing({ x: dx, y: dy }), facing);
  }
});

test('overlapping Midnight and spell damage share the single-defeat gate', () => {
  const cat = new MidnightBehavior(player), enemy = foe(cat.position.x + 34, cat.position.y, 22);
  let defeats = 0; const combat = new CombatResolver(() => defeats++);
  cat.update(600, player, [enemy], combat.damage); cat.update(240, player, [enemy], combat.damage);
  combat.damage(enemy, 18); assert.equal(defeats, 1);
});

test('cooldown prevents another swat before 850ms and a new companion has no old state', () => {
  const cat = new MidnightBehavior(player), enemy = foe(cat.position.x + 34, cat.position.y, 10000);
  cat.update(600, player, [enemy], damage); assert.equal(cat.swatSerial, 1);
  for (let i = 0; i < 8; i++) cat.update(100, player, [enemy], damage);
  assert.equal(cat.swatSerial, 1);
  cat.update(49, player, [enemy], damage); assert.equal(cat.swatSerial, 1);
  cat.update(1, player, [enemy], damage); assert.equal(cat.swatSerial, 2);
  const fresh = new MidnightBehavior(player); assert.equal(fresh.swatSerial, 0); assert.equal(fresh.state, 'following');
});
