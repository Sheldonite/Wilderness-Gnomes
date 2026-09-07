const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GameManager } = require('../artifacts/ability-tests/game/core/GameManager.js');
const { AbilitySimulation } = require('../artifacts/ability-tests/game/core/AbilitySimulation.js');
const { CombatResolver } = require('../artifacts/ability-tests/game/core/CombatResolver.js');
const { ProjectileFlight } = require('../artifacts/ability-tests/game/core/ProjectileFlight.js');
const { secondPounceTarget } = require('../artifacts/ability-tests/game/core/PounceChain.js');
const { UpgradeSystem } = require('../artifacts/ability-tests/game/systems/UpgradeSystem.js');
const { ABILITY_IDS, ABILITIES } = require('../artifacts/ability-tests/game/config/abilities.js');

let enemyId = 0;
function enemy(x = 0, y = 0, health = 100, radius = 15) {
  return { id: ++enemyId, position: { x, y }, radius, health, isDead: false, slowMultiplier: 1,
    takeDamage(amount) { if (this.isDead) return false; this.health -= amount; this.isDead = this.health <= 0; return this.isDead; } };
}
function simulation(id, rank = 1) {
  const manager = new GameManager(); manager.playerStats.abilityRanks[id] = rank;
  const sim = new AbilitySimulation(manager.playerStats); sim.sync({ x: 0, y: 0 });
  return { sim, manager, stats: manager.playerStats };
}
const damage = (target, amount) => { target.takeDamage(amount); };
const origin = { x: 0, y: 0 };

test('three distinct choices reserve an unlock and a rank increase through many runs', () => {
  const upgrades = new UpgradeSystem();
  for (let run = 0; run < 100; run++) {
    const stats = new GameManager().playerStats;
    for (let level = 0; level < 35; level++) {
      const available = upgrades.getAvailable(stats), choices = upgrades.getChoices(stats);
      assert.equal(choices.length, 3); assert.equal(new Set(choices.map(c => c.id)).size, 3);
      if (available.some(c => c.rank === 1 || c.id.startsWith('gain-companion-'))) assert.ok(choices.some(c => c.rank === 1 || c.id.startsWith('gain-companion-')));
      if (available.some(c => c.rank > 1)) assert.ok(choices.some(c => c.rank > 1));
      upgrades.applyUpgrade(choices[level % 3], stats);
      assert.ok(Object.values(stats.abilityRanks).every(rank => rank <= 5));
    }
  }
});

test('Mystery gates Double Pounce, and recruitment disappears after selection', () => {
  const stats = new GameManager().playerStats, upgrades = new UpgradeSystem();
  assert.ok(!upgrades.getAvailable(stats).some(c => c.id === 'mystery-double-pounce'));
  upgrades.applyUpgrade(upgrades.getAvailable(stats).find(c => c.id === 'gain-companion-mystery'), stats);
  assert.ok(upgrades.getAvailable(stats).some(c => c.id === 'mystery-double-pounce'));
  assert.ok(!upgrades.getAvailable(stats).some(c => c.id === 'gain-companion-mystery'));
});

test('all ability ranks have real next-benefit descriptions; stale cards cannot apply twice', () => {
  const stats = new GameManager().playerStats, upgrades = new UpgradeSystem(); stats.hasMysteryCompanion = true;
  for (const id of ABILITY_IDS) {
    for (let rank = 1; rank <= 5; rank++) {
      const offer = upgrades.getAvailable(stats).find(c => c.id === id);
      assert.equal(offer.rank, rank); assert.ok(offer.description.length > 40);
      assert.equal(offer.category, rank === 1 ? 'NEW ABILITY' : rank === 5 ? 'AWAKENING' : `RANK ${rank} OF 5`);
      upgrades.applyUpgrade(offer, stats); upgrades.applyUpgrade(offer, stats);
      assert.equal(stats.abilityRanks[id], rank);
    }
    assert.ok(!upgrades.getAvailable(stats).some(c => c.id === id));
  }
  assert.equal(upgrades.getChoices(stats).length, 3);
  stats.weaponCooldownMs = 160;
  assert.ok(!upgrades.getAvailable(stats).some(c => c.id === 'fire-rate'));
});

test('queued XP levels are preserved and resume one selection at a time', () => {
  const { BALANCE } = require('../artifacts/ability-tests/game/config/balance.js');
  const threshold = level => Math.ceil(BALANCE.leveling.baseThreshold * Math.pow(BALANCE.leveling.thresholdGrowth, level - 1));
  // enough XP for exactly two level-ups, with some left over
  const grant = threshold(1) + threshold(2) + Math.floor(threshold(3) / 2);
  const manager = new GameManager();
  manager.addXp(grant); assert.equal(manager.level, 2);
  manager.resumeAfterUpgrade(); assert.equal(manager.level, 3); assert.equal(manager.state, 'LevelUpPaused');
  manager.resumeAfterUpgrade(); assert.equal(manager.state, 'Playing'); assert.equal(manager.xp, grant - threshold(1) - threshold(2));
});

test('Barkskin blocks contact, protects for 500ms, then recharges on the gameplay clock', () => {
  const manager = new GameManager(); manager.playerStats.abilityRanks['barkskin-ward'] = 1;
  assert.equal(manager.wardStatus, 'ready'); manager.damagePlayer(8, 'contact');
  assert.equal(manager.playerStats.health, 100); assert.equal(manager.wardStatus, 'protecting');
  manager.update(499); manager.damagePlayer(8, 'contact'); assert.equal(manager.playerStats.health, 100);
  manager.update(1); manager.damagePlayer(8, 'contact'); assert.equal(manager.playerStats.health, 92);
  manager.pause(); manager.update(30000); assert.equal(manager.wardStatus, 'recharging');
  manager.resume(); manager.update(17500); assert.equal(manager.wardStatus, 'ready');
  manager.damagePlayer(8, 'contact'); assert.equal(manager.playerStats.health, 92);
});

test('ward rank changes keep the current recharge, then use the new duration', () => {
  const manager = new GameManager(); manager.playerStats.abilityRanks['barkskin-ward'] = 1;
  manager.damagePlayer(8, 'contact'); manager.update(1000); manager.playerStats.abilityRanks['barkskin-ward'] = 3;
  manager.update(9000); assert.equal(manager.wardStatus, 'recharging');
  manager.update(8000); manager.damagePlayer(8, 'contact'); manager.update(10000); assert.equal(manager.wardStatus, 'ready');
});

test('ricochet uses distinct living targets, nearest range, and multiplicative damage', () => {
  const a = enemy(0), b = enemy(100), c = enemy(180), far = enemy(500);
  const flight = new ProjectileFlight(26, 2);
  assert.deepEqual(flight.hit(a.id, a.position, [a, b, c, far]), { x: 1, y: 0 });
  assert.ok(Math.abs(flight.damage - 18.2) < .001);
  assert.deepEqual(flight.hit(b.id, b.position, [a, b, c, far]), { x: 1, y: 0 });
  assert.ok(Math.abs(flight.damage - 12.74) < .001);
  assert.equal(flight.hit(c.id, c.position, [a, b, c, far]), undefined);
  assert.deepEqual([...flight.hitEnemyIds], [a.id, b.id, c.id]);
});

test('each split bolt has its own hit history; ricochet ends without an eligible target', () => {
  const a = enemy(0), b = enemy(20); b.isDead = true;
  const first = new ProjectileFlight(18, 3), second = new ProjectileFlight(18, 3);
  assert.equal(first.hit(a.id, origin, [a, b, enemy(221)]), undefined);
  assert.ok(first.hitEnemyIds.has(a.id)); assert.ok(!second.hitEnemyIds.has(a.id));
  assert.equal(new ProjectileFlight(18, 0).hit(a.id, origin, [a, enemy(50)]), undefined);
});

test('simultaneous damage sources award one death and skip already dead targets', () => {
  const target = enemy(0, 0, 8); let awards = 0;
  const combat = new CombatResolver(() => { awards++; });
  for (let source = 0; source < 8; source++) combat.damage(target, 8);
  assert.equal(awards, 1); assert.equal(target.health, 0);
  combat.release(target.id); combat.damage(target, 8); assert.equal(awards, 1);
});

test('fireflies orbit at the specified radius and share a 500ms hit interval per foe', () => {
  const { sim, stats } = simulation('firefly-orbit'); const target = enemy(0, 0, 100, 100);
  sim.update(0, origin, [target], [], damage); assert.equal(target.health, 92); assert.equal(sim.fireflies.length, 2);
  sim.update(499, origin, [target], [], damage); assert.equal(target.health, 92);
  sim.update(1, origin, [target], [], damage); assert.equal(target.health, 84);
  stats.abilityRanks['firefly-orbit'] = 3; sim.sync(origin); assert.equal(sim.fireflies.length, 4);
  assert.ok(sim.fireflies.every(f => Math.abs(Math.hypot(f.x, f.y) - 72) < .001));
});

test('brambles wait a full cooldown, slow only inside, and expire', () => {
  const { sim } = simulation('bramble-snare'); const target = enemy(100);
  sim.update(4999, origin, [target], [], damage); assert.equal(sim.brambles.length, 0);
  sim.update(1, origin, [target], [], damage); assert.equal(sim.brambles.length, 1); assert.equal(target.slowMultiplier, .65);
  target.position.x = 300; sim.update(1, origin, [target], [], damage); assert.equal(target.slowMultiplier, 1);
  target.position.x = 100; sim.update(1999, origin, [target], [], damage); assert.equal(sim.brambles.length, 0); assert.equal(target.slowMultiplier, 1);
});

test('targeted abilities stay ready when no living enemy is in range', () => {
  const { sim } = simulation('bramble-snare');
  sim.update(9000, origin, [enemy(421)], [], damage); assert.equal(sim.brambles.length, 0);
  const target = enemy(400); sim.update(1, origin, [target], [], damage); assert.equal(sim.brambles.length, 1);
});

test('spores require movement and spacing, and are bounded to four patches', () => {
  const { sim } = simulation('spore-trail');
  sim.update(1000, origin, [], [], damage); assert.equal(sim.spores.length, 0);
  sim.update(1, { x: 23, y: 0 }, [], [], damage); assert.equal(sim.spores.length, 0);
  sim.update(1, { x: 24, y: 0 }, [], [], damage); assert.equal(sim.spores.length, 1);
  for (let i = 2; i <= 20; i++) { sim.update(750, { x: i * 24, y: 0 }, [], [], damage); assert.ok(sim.spores.length <= 4); }
});

test('overlapping spores deal one half-second tick, not multiplied damage', () => {
  const { sim } = simulation('spore-trail'); const target = enemy(0);
  sim.spores = [{ x: 0, y: 0, radius: 44, strength: 6, bornAt: 0, expiresAt: 3000 }, { x: 0, y: 0, radius: 44, strength: 12, bornAt: 0, expiresAt: 3000 }];
  sim.update(0, origin, [target], [], damage); sim.update(499, origin, [target], [], damage); assert.equal(target.health, 100);
  sim.update(1, origin, [target], [], damage); assert.equal(target.health, 94);
  sim.update(500, origin, [target], [], damage); assert.equal(target.health, 88);
  target.position.x = 100; sim.update(500, origin, [target], [], damage); assert.equal(target.health, 88);
});

test('acorns warn for 450ms and hit their original location, even when the target moves', () => {
  const { sim } = simulation('acorn-shower'); const target = enemy(100), bystander = enemy(110);
  sim.update(4000, origin, [target, bystander], [], damage); assert.equal(sim.acorns.length, 1);
  target.position.x = 300; sim.update(449, origin, [target, bystander], [], damage); assert.equal(bystander.health, 100);
  sim.update(1, origin, [target, bystander], [], damage); assert.equal(bystander.health, 76); assert.equal(target.health, 100); assert.equal(sim.acorns.length, 0);
});

test('spore damage includes the final lifetime tick at different frame rates', () => {
  for (const frameMs of [1000 / 60, 1000 / 30, 17, 50]) {
    const { sim } = simulation('spore-trail'); const target = enemy(0);
    sim.spores.push({ x: 0, y: 0, radius: 44, strength: 6, bornAt: 0, expiresAt: 3000 });
    for (let elapsed = 0; elapsed < 3050; elapsed += frameMs) sim.update(frameMs, origin, [target], [], damage);
    assert.equal(target.health, 82, `frame interval ${frameMs}`);
  }
});

test('magnet unlock and rank changes preserve the running cooldown and tag only nearby XP', () => {
  const { sim, stats, manager } = simulation('woodland-magnet');
  const pickup = { position: { x: 500, y: 0 }, isCollected: false, count: 0, attract() { this.count++; } };
  sim.update(9999, origin, [], [pickup], damage); assert.equal(pickup.count, 0);
  stats.abilityRanks['woodland-magnet'] = 2;
  sim.update(1, origin, [], [pickup], damage); assert.equal(pickup.count, 1); assert.equal(manager.xp, 0);
  sim.update(7999, origin, [], [pickup], damage); assert.equal(pickup.count, 1);
  sim.update(1, origin, [], [pickup], damage); assert.equal(pickup.count, 2);
});

test('each rank uses its promised roots, spores, acorn and magnet values', () => {
  for (let rank = 1; rank <= 3; rank++) {
    const { sim, stats } = simulation('bramble-snare', rank);
    for (const id of ['spore-trail', 'acorn-shower', 'woodland-magnet']) stats.abilityRanks[id] = rank;
    sim.sync(origin); const target = enemy(100); sim.update(5000, { x: 30, y: 0 }, [target], [], damage);
    assert.equal(sim.brambles[0].strength, ABILITIES.bramble.slow[rank]);
    assert.equal(sim.spores[0].strength, ABILITIES.spore.damagePerSecond[rank]);
    assert.equal(sim.acorns[0].damage, ABILITIES.acorn.damage[rank]);
    assert.equal(sim.acorns[0].radius, ABILITIES.acorn.radius[rank]);
  }
});

test('Mystery chains only to another living foe in both required ranges', () => {
  const first = enemy(100), next = enemy(200), outside = enemy(430), dead = enemy(110); dead.isDead = true;
  assert.equal(secondPounceTarget(0, first.id, first.position, origin, 420, [next]), undefined);
  assert.equal(secondPounceTarget(1, first.id, first.position, origin, 420, [first, next, dead]), next);
  assert.equal(secondPounceTarget(3, first.id, { x: 400, y: 0 }, origin, 420, [outside]), undefined);
  assert.equal(secondPounceTarget(1, first.id, origin, origin, 420, [next]), undefined);
});

test('crossbow starts with heartwood stats and flavored primary upgrades', () => {
  const spell = new GameManager().playerStats;
  const bow = new GameManager('crossbow').playerStats;
  const upgrades = new UpgradeSystem();
  assert.equal(spell.weaponId, 'spell'); assert.equal(spell.projectileDamage, 18); assert.equal(spell.weaponCooldownMs, 850);
  assert.equal(bow.weaponId, 'crossbow'); assert.equal(bow.projectileDamage, 28); assert.equal(bow.weaponCooldownMs, 1150);
  const sharper = upgrades.getAvailable(bow).find(c => c.id === 'projectile-damage');
  assert.equal(sharper.title, 'Honed Quarrels');
  const ricochet = upgrades.getAvailable(bow).find(c => c.id === 'ricochet-charm');
  assert.match(ricochet.description, /Quarrels punch through 2 additional enemies/);
  assert.ok(!upgrades.getAvailable(spell).some(c => c.title === 'Honed Quarrels'));
});

test('piercing quarrels continue forward, retain damage, then stop', () => {
  const a = enemy(0), b = enemy(80), c = enemy(160);
  const flight = new ProjectileFlight(30, 1, 'pierce', 0.8);
  const ahead = { x: 1, y: 0 };
  assert.deepEqual(flight.hit(a.id, a.position, [a, b, c], ahead), ahead);
  assert.ok(Math.abs(flight.damage - 24) < .001);
  assert.equal(flight.hit(b.id, b.position, [a, b, c], ahead), undefined);
  assert.deepEqual([...flight.hitEnemyIds], [a.id, b.id]);
});

test('a new run has no ranks, ward charge, patches, timers or hit history from the last run', () => {
  const previous = simulation('spore-trail', 3); previous.sim.update(800, { x: 30, y: 0 }, [], [], damage);
  const manager = new GameManager(), sim = new AbilitySimulation(manager.playerStats);
  assert.ok(Object.values(manager.playerStats.abilityRanks).every(rank => rank === 0));
  assert.equal(manager.wardStatus, 'locked'); assert.equal(sim.spores.length, 0); assert.equal(sim.elapsedMs, 0);
  sim.update(30000, origin, [], [], damage); assert.equal(sim.spores.length, 0); assert.equal(sim.acorns.length, 0);
});
