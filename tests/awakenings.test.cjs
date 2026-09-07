const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GameManager } = require('../artifacts/ability-tests/game/core/GameManager.js');
const { AbilitySimulation } = require('../artifacts/ability-tests/game/core/AbilitySimulation.js');
const { ProjectileFlight } = require('../artifacts/ability-tests/game/core/ProjectileFlight.js');
const { nextPounceTarget, pounceChainLimit, pounceCooldownScale } = require('../artifacts/ability-tests/game/core/PounceChain.js');
const { UpgradeSystem } = require('../artifacts/ability-tests/game/systems/UpgradeSystem.js');
const { ABILITY_IDS, ABILITIES, AWAKENING_NAMES, MAX_ABILITY_RANK } = require('../artifacts/ability-tests/game/config/abilities.js');

let enemyId = 0;
function enemy(x = 0, y = 0, health = 100, radius = 15) {
  return { id: ++enemyId, position: { x, y }, radius, health, isDead: false, slowMultiplier: 1,
    takeDamage(amount) { if (this.isDead) return false; this.health -= amount; this.isDead = this.health <= 0; return this.isDead; } };
}
function simulation(id, rank = 5) {
  const manager = new GameManager(); manager.playerStats.abilityRanks[id] = rank;
  const sim = new AbilitySimulation(manager.playerStats); sim.sync({ x: 0, y: 0 });
  return { sim, manager, stats: manager.playerStats };
}
const damage = (target, amount) => { target.takeDamage(amount); };
const origin = { x: 0, y: 0 };

test('abilities climb to rank 5, and the fifth offer is labelled as an awakening with its own name', () => {
  const stats = new GameManager().playerStats, upgrades = new UpgradeSystem(); stats.hasMysteryCompanion = true;
  assert.equal(MAX_ABILITY_RANK, 5);
  for (const id of ABILITY_IDS) {
    for (let rank = 1; rank < 5; rank++) upgrades.applyUpgrade(upgrades.getAvailable(stats).find(c => c.id === id), stats);
    const offer = upgrades.getAvailable(stats).find(c => c.id === id);
    assert.equal(offer.rank, 5); assert.equal(offer.category, 'AWAKENING');
    assert.ok(offer.title.includes(AWAKENING_NAMES[id]), offer.title);
    assert.ok(offer.description.startsWith(AWAKENING_NAMES[id]), offer.description);
    upgrades.applyUpgrade(offer, stats);
    assert.equal(stats.abilityRanks[id], 5);
    assert.ok(!upgrades.getAvailable(stats).some(c => c.id === id), 'nothing past rank 5');
  }
});

test('Chain Lightning keeps full damage per bounce and splits into seeking bolts after the last one', () => {
  const a = enemy(50), b = enemy(150), c = enemy(260), d = enemy(370), e = enemy(480);
  const flight = new ProjectileFlight(20, 1, 'bounce', undefined, true);
  flight.hit(a.id, a.position, [a, b, c, d, e]);
  assert.equal(flight.damage, 20, 'no damage lost on the bounce');
  assert.equal(flight.pendingSplit, undefined);
  flight.hit(b.id, b.position, [a, b, c, d, e]);
  assert.ok(flight.pendingSplit, 'the spent bolt owes a split');
  assert.equal(flight.pendingSplit.directions.length, ABILITIES.ricochet.chain.splitCount);
  assert.equal(flight.pendingSplit.damage, 20 * ABILITIES.ricochet.chain.splitDamage);
  assert.ok(flight.pendingSplit.directions.every(dir => dir.x > 0.99), 'the bolts seek the fresh foes ahead');
  const plain = new ProjectileFlight(20, 1, 'bounce');
  plain.hit(a.id, a.position, [a, b]); plain.hit(b.id, b.position, [a, b]);
  assert.equal(plain.pendingSplit, undefined, 'unawakened bolts never split');
});

test('Firefly Swarm sends fireflies at nearby foes for double damage and returns them to orbit', () => {
  const { sim } = simulation('firefly-orbit');
  const prey = enemy(120, 0, 1000);
  for (let i = 0; i < 40; i++) sim.update(50, origin, [prey], [], damage);
  assert.ok(sim.fireflies.some(f => Math.hypot(f.x - 120, f.y) < 12), 'a firefly reached the foe');
  assert.ok(prey.health < 1000 - ABILITIES.firefly.swarm.damage * 2, `swarm bites hard, health ${prey.health}`);
  const orbitBefore = sim.fireflies.map(f => ({ ...f }));
  for (let i = 0; i < 40; i++) sim.update(50, origin, [], [], damage);
  assert.ok(sim.fireflies.every(f => Math.abs(Math.hypot(f.x, f.y) - ABILITIES.firefly.radius) < 2), 'with nothing to hunt they orbit again');
  assert.notDeepEqual(sim.fireflies, orbitBefore);
});

test('Thornwall roots foes at first, keeps slowing them, hurts them, and marks its interior', () => {
  const { sim } = simulation('bramble-snare');
  const foe = enemy(100, 0, 1000);
  sim.update(5000, origin, [foe], [], damage);
  assert.equal(sim.brambles.length, 1);
  sim.update(100, origin, [foe], [], damage);
  assert.equal(foe.slowMultiplier, 0, 'rooted in place at first');
  assert.ok(sim.insideThornwall({ x: 100, y: 10 }));
  assert.ok(!sim.insideThornwall({ x: 100, y: 400 }));
  const healthAtRoot = foe.health;
  sim.update(ABILITIES.bramble.thornwall.rootMs, origin, [foe], [], damage);
  assert.equal(foe.slowMultiplier, 1 - ABILITIES.bramble.slow[5], 'then slowed');
  assert.ok(foe.health < healthAtRoot, 'thorns hurt while inside');
  assert.ok(sim.brambles[0].expiresAt - sim.brambles[0].bornAt === ABILITIES.bramble.lifeMs[5]);
});

test('Fungal Bloom keeps patches longer, allows more of them, and sprouts a patch from a kill inside one', () => {
  const { sim } = simulation('spore-trail');
  for (let i = 1; i <= 20; i++) sim.update(760, { x: i * 30, y: 0 }, [], [], damage);
  assert.ok(sim.spores.length > ABILITIES.spore.maxPatches, `bloom holds ${sim.spores.length} patches`);
  assert.ok(sim.spores.length <= ABILITIES.spore.bloom.maxPatches);
  const count = sim.spores.length;
  sim.noteKill({ x: 600, y: 5 });
  assert.equal(sim.spores.length, Math.min(count + 1, ABILITIES.spore.bloom.maxPatches));
  sim.noteKill({ x: 600, y: 900 });
  assert.equal(sim.spores.length, Math.min(count + 1, ABILITIES.spore.bloom.maxPatches), 'a kill outside any patch sprouts nothing');
});

test('Oak Fall drops a huge acorn that rolls on, crushes what it meets, then shatters into ordinary acorns', () => {
  const { sim } = simulation('acorn-shower');
  const target = enemy(200, 0, 100000), downstream = enemy(200 + ABILITIES.acorn.oak.rollSpeed, 0, 100000);
  sim.update(ABILITIES.acorn.oak.cooldownMs, origin, [target, downstream], [], damage);
  assert.equal(sim.acorns.length, 1); assert.equal(sim.acorns[0].damage, ABILITIES.acorn.damage[5]); assert.ok(sim.acorns[0].oak);
  sim.update(ABILITIES.acorn.warningMs, origin, [target, downstream], [], damage);
  assert.equal(target.health, 100000 - ABILITIES.acorn.damage[5]);
  assert.equal(sim.rollers.length, 1, 'the oak acorn keeps rolling');
  for (let i = 0; i < 10; i++) sim.update(100, origin, [target, downstream], [], damage);
  assert.ok(downstream.health < 100000, 'it crushed the foe down the line');
  sim.update(ABILITIES.acorn.oak.rollMs, origin, [target, downstream], [], damage);
  assert.equal(sim.rollers.length, 0);
  assert.equal(sim.acorns.length, ABILITIES.acorn.oak.shardCount, 'shattered into ordinary acorns');
  assert.ok(sim.acorns.every(a => !a.oak && a.damage === ABILITIES.acorn.damage[4]));
});

test('Living Bark holds three leaves, regrows them one at a time, and bursts when the last falls', () => {
  const manager = new GameManager(); manager.playerStats.abilityRanks['barkskin-ward'] = 5;
  manager.update(1);
  assert.equal(manager.wardLeaves, 3); assert.equal(manager.wardStatus, 'ready');
  for (let i = 1; i <= 3; i++) {
    manager.damagePlayer(10, 'contact');
    assert.equal(manager.playerStats.health, 100, `leaf ${i} blocks`);
    assert.equal(manager.wardLeaves, 3 - i);
    manager.update(ABILITIES.ward.protectionMs + 1);
    assert.equal(manager.consumeBarkBurst(), i === 3, 'only the last leaf bursts');
  }
  assert.equal(manager.wardStatus, 'recharging');
  manager.damagePlayer(10, 'contact');
  assert.equal(manager.playerStats.health, 90, 'bare bark no longer blocks');
  manager.update(ABILITIES.ward.rechargeMs[5]);
  assert.ok(manager.wardLeaves >= 1, 'a leaf regrew');
  assert.equal(manager.consumeBarkBurst(), false);
});

test('Harvest Wind pulls crystals every frame and stacks a capped, expiring damage bonus', () => {
  const { sim, stats } = simulation('woodland-magnet');
  const pickup = { position: { x: 300, y: 0 }, isCollected: false, count: 0, attract() { this.count++; } };
  sim.update(16, origin, [], [pickup], damage); sim.update(16, origin, [], [pickup], damage);
  assert.equal(pickup.count, 2, 'no cooldown between pulls');
  assert.equal(sim.harvestBonus, 0);
  sim.noteCollected(10); assert.ok(Math.abs(sim.harvestBonus - 0.1) < 1e-9);
  sim.noteCollected(40); assert.equal(sim.harvestBonus, ABILITIES.magnet.harvest.maxBonus, 'capped');
  sim.update(ABILITIES.magnet.harvest.durationMs + 1, origin, [], [], damage);
  assert.equal(sim.harvestBonus, 0, 'stacks expire');
  stats.abilityRanks['woodland-magnet'] = 4;
  sim.noteCollected(5); assert.equal(sim.harvestBonus, 0, 'no bonus below the awakening');
});

test('Feral Frenzy chains pounces through a pack at full damage and hastens the cooldown above half health', () => {
  assert.equal(pounceChainLimit(1), 1); assert.equal(pounceChainLimit(5), ABILITIES.pounce.frenzy.maxChain);
  assert.equal(pounceCooldownScale(5, 80, 100), ABILITIES.pounce.frenzy.cooldownScale);
  assert.equal(pounceCooldownScale(5, 40, 100), 1); assert.equal(pounceCooldownScale(3, 100, 100), 1);
  const pack = [enemy(100), enemy(180), enemy(260), enemy(340)];
  const hit = new Set([pack[0].id]);
  assert.equal(nextPounceTarget(1, hit, 1, pack[0].position, origin, 420, pack), undefined, 'double pounce stops after one chain');
  assert.equal(nextPounceTarget(5, hit, 1, pack[0].position, origin, 420, pack), pack[1], 'frenzy keeps going');
  assert.equal(nextPounceTarget(5, hit, ABILITIES.pounce.frenzy.maxChain, pack[0].position, origin, 420, pack), undefined, 'but has a limit');
  assert.equal(ABILITIES.pounce.damageScale[5], 1, 'chained pounces hit at full strength');
});
