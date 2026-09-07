const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GameManager } = require('../artifacts/ability-tests/game/core/GameManager.js');
const { AbilitySimulation } = require('../artifacts/ability-tests/game/core/AbilitySimulation.js');
const { ProjectileFlight } = require('../artifacts/ability-tests/game/core/ProjectileFlight.js');
const { nextPounceTarget, pounceChainLimit, pounceCooldownScale } = require('../artifacts/ability-tests/game/core/PounceChain.js');
const { UpgradeSystem } = require('../artifacts/ability-tests/game/systems/UpgradeSystem.js');
const { ABILITY_IDS, ABILITIES, AWAKENING_NAMES, ASCENSION_NAMES, MAX_ABILITY_RANK, ASCENSION_PLAYER_LEVEL } = require('../artifacts/ability-tests/game/config/abilities.js');

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
const ABILITY_OWNER = { 'mystery-double-pounce': 'wizard', 'midnight-mighty-swat': 'hailey',
  'ribbon-sweep': 'ron', 'inspiring-shout': 'ron', 'dizzying-flurry': 'ron' };
const asOwnerOf = (stats, id) => { stats.characterId = ABILITY_OWNER[id] ?? 'wizard'; return stats; };


test('abilities stop at rank 5 until player level 10, then climb to an ascension at rank 10', () => {
  const stats = new GameManager().playerStats, upgrades = new UpgradeSystem();
  stats.hasMysteryCompanion = true; stats.hasMidnightCompanion = true;
  assert.equal(MAX_ABILITY_RANK, 10); assert.equal(ASCENSION_PLAYER_LEVEL, 10);
  for (const id of ABILITY_IDS) {
    asOwnerOf(stats, id);
    for (let rank = 1; rank < 5; rank++) upgrades.applyUpgrade(upgrades.getAvailable(stats).find(c => c.id === id), stats);
    const offer = upgrades.getAvailable(stats).find(c => c.id === id);
    assert.equal(offer.rank, 5); assert.equal(offer.category, 'AWAKENING');
    assert.ok(offer.title.includes(AWAKENING_NAMES[id]), offer.title);
    upgrades.applyUpgrade(offer, stats);
    assert.equal(stats.abilityRanks[id], 5);
    assert.ok(!upgrades.getAvailable(stats).some(c => c.id === id), 'rank 6 is hidden before player level 10');
  }
  stats.level = ASCENSION_PLAYER_LEVEL - 1;
  assert.ok(!upgrades.getAvailable(stats).some(c => c.rank === 6), 'still hidden one level short');
  stats.level = ASCENSION_PLAYER_LEVEL;
  for (const id of ABILITY_IDS) {
    asOwnerOf(stats, id);
    for (let rank = 6; rank < 10; rank++) {
      const offer = upgrades.getAvailable(stats).find(c => c.id === id);
      assert.equal(offer.rank, rank); assert.equal(offer.category, `RANK ${rank} OF 10`);
      upgrades.applyUpgrade(offer, stats);
    }
    const offer = upgrades.getAvailable(stats).find(c => c.id === id);
    assert.equal(offer.rank, 10); assert.equal(offer.category, 'ASCENSION');
    assert.ok(offer.title.includes(ASCENSION_NAMES[id]), offer.title);
    assert.ok(offer.description.startsWith(ASCENSION_NAMES[id]), offer.description);
    upgrades.applyUpgrade(offer, stats);
    assert.equal(stats.abilityRanks[id], 10);
    assert.ok(!upgrades.getAvailable(stats).some(c => c.id === id), 'nothing past rank 10');
  }
});

test('a stale rank 6 card cannot apply below player level 10, and the level travels with the run', () => {
  const manager = new GameManager(), upgrades = new UpgradeSystem();
  const stats = manager.playerStats; stats.level = 10;
  stats.abilityRanks['acorn-shower'] = 5;
  const card = upgrades.getAvailable(stats).find(c => c.id === 'acorn-shower');
  assert.equal(card.rank, 6);
  stats.level = 4; upgrades.applyUpgrade(card, stats);
  assert.equal(stats.abilityRanks['acorn-shower'], 5, 'gated');
  stats.level = 10; upgrades.applyUpgrade(card, stats);
  assert.equal(stats.abilityRanks['acorn-shower'], 6);
  const fresh = new GameManager();
  assert.equal(fresh.playerStats.level, 1);
  for (let i = 0; i < 40; i++) { fresh.addXp(100000); fresh.resumeAfterUpgrade(); }
  assert.equal(fresh.playerStats.level, fresh.level);
});

test('Chain Lightning keeps full damage per bounce and splits into seeking bolts; Storm Front splits harder and bounces again', () => {
  const a = enemy(50), b = enemy(150), c = enemy(260), d = enemy(370), e = enemy(480), f = enemy(590), g = enemy(700);
  const all = [a, b, c, d, e, f, g];
  const flight = new ProjectileFlight(20, 1, 'bounce', undefined, 0);
  flight.hit(a.id, a.position, all);
  assert.equal(flight.damage, 20, 'no damage lost on the bounce');
  assert.equal(flight.pendingSplit, undefined);
  flight.hit(b.id, b.position, all);
  assert.ok(flight.pendingSplit, 'the spent bolt owes a split');
  assert.equal(flight.pendingSplit.directions.length, ABILITIES.ricochet.chain[0].splitCount);
  assert.equal(flight.pendingSplit.damage, 20 * ABILITIES.ricochet.chain[0].splitDamage);
  assert.equal(flight.pendingSplit.bounces, 0);
  const storm = new ProjectileFlight(20, 0, 'bounce', undefined, 1);
  storm.hit(a.id, a.position, all);
  assert.equal(storm.pendingSplit.directions.length, ABILITIES.ricochet.chain[1].splitCount);
  assert.equal(storm.pendingSplit.damage, 20, 'ascended split bolts carry full damage');
  assert.equal(storm.pendingSplit.bounces, ABILITIES.ricochet.chain[1].splitBounces);
  const plain = new ProjectileFlight(20, 1, 'bounce');
  plain.hit(a.id, a.position, [a, b]); plain.hit(b.id, b.position, [a, b]);
  assert.equal(plain.pendingSplit, undefined, 'unawakened bolts never split');
});

test('Firefly Swarm sends fireflies at nearby foes and returns them to orbit; Inferno bites harder from farther', () => {
  for (const [rank, tier] of [[5, 0], [10, 1]]) {
    const { sim } = simulation('firefly-orbit', rank);
    const swarm = ABILITIES.firefly.swarm[tier];
    const prey = enemy(swarm.huntRange - 40, 0, 100000);
    for (let i = 0; i < 40; i++) sim.update(50, origin, [prey], [], damage);
    assert.ok(sim.fireflies.some(f => Math.hypot(f.x - prey.position.x, f.y) < 12), `rank ${rank}: a firefly reached the foe`);
    assert.ok(prey.health < 100000 - swarm.damage * 2, `rank ${rank}: bites for ${swarm.damage}`);
    assert.equal(sim.fireflies.length, ABILITIES.firefly.count[rank]);
    for (let i = 0; i < 40; i++) sim.update(50, origin, [], [], damage);
    assert.ok(sim.fireflies.every(f => Math.abs(Math.hypot(f.x, f.y) - ABILITIES.firefly.radius) < 2), 'with nothing to hunt they orbit again');
  }
});

test('Thornwall roots, slows, hurts and blocks; Thornheart raises two rings per cast', () => {
  const { sim } = simulation('bramble-snare', 5);
  const foe = enemy(100, 0, 100000);
  sim.update(5000, origin, [foe], [], damage);
  assert.equal(sim.brambles.length, 1);
  sim.update(100, origin, [foe], [], damage);
  assert.equal(foe.slowMultiplier, 0, 'rooted in place at first');
  assert.ok(sim.insideThornwall({ x: 100, y: 10 }));
  const healthAtRoot = foe.health;
  sim.update(ABILITIES.bramble.thornwall[0].rootMs, origin, [foe], [], damage);
  assert.equal(foe.slowMultiplier, 1 - ABILITIES.bramble.slow[5], 'then slowed');
  assert.ok(foe.health < healthAtRoot, 'thorns hurt while inside');
  const heart = simulation('bramble-snare', 10).sim;
  const pair = [enemy(100, 0, 100000), enemy(-120, 0, 100000)];
  heart.update(5000, origin, pair, [], damage);
  assert.equal(heart.brambles.length, ABILITIES.bramble.thornwall[1].rings, 'two rings, one per foe');
  assert.equal(heart.brambles[0].expiresAt - heart.brambles[0].bornAt, ABILITIES.bramble.lifeMs[10]);
});

test('Fungal Bloom keeps more, longer patches and sprouts on kills; Mycelium Tide sprouts from kills nearby', () => {
  const { sim } = simulation('spore-trail', 5);
  for (let i = 1; i <= 30; i++) sim.update(760, { x: i * 30, y: 0 }, [], [], damage);
  assert.ok(sim.spores.length > ABILITIES.spore.maxPatches);
  assert.ok(sim.spores.length <= ABILITIES.spore.bloom[0].maxPatches);
  sim.spores.length = 3;
  sim.noteKill({ x: sim.spores[0].x, y: 5 }); assert.equal(sim.spores.length, 4, 'a kill inside sprouts');
  sim.noteKill({ x: sim.spores[0].x, y: 100 }); assert.equal(sim.spores.length, 4, 'a kill just outside does not');
  const tide = simulation('spore-trail', 10).sim;
  tide.update(760, { x: 30, y: 0 }, [], [], damage);
  assert.equal(tide.spores.length, 1);
  tide.noteKill({ x: 30, y: ABILITIES.spore.radius + ABILITIES.spore.bloom[1].sproutReach - 5 });
  assert.equal(tide.spores.length, 2, 'ascended reach sprouts from a nearby kill');
  assert.equal(tide.spores[0].strength, ABILITIES.spore.damagePerSecond[10]);
});

test('Oak Fall rolls and shatters; Worldtree Fall rolls longer, wider and shatters into more', () => {
  for (const [rank, tier] of [[5, 0], [10, 1]]) {
    const { sim } = simulation('acorn-shower', rank);
    const oak = ABILITIES.acorn.oak[tier];
    const target = enemy(200, 0, 100000), downstream = enemy(200 + oak.rollSpeed, 0, 100000);
    sim.update(oak.cooldownMs, origin, [target, downstream], [], damage);
    assert.equal(sim.acorns.length, 1); assert.equal(sim.acorns[0].damage, ABILITIES.acorn.damage[rank]); assert.ok(sim.acorns[0].oak);
    sim.update(ABILITIES.acorn.warningMs, origin, [target, downstream], [], damage);
    assert.equal(target.health, 100000 - ABILITIES.acorn.damage[rank]);
    assert.equal(sim.rollers.length, 1); assert.equal(sim.rollers[0].radius, oak.rollRadius);
    for (let i = 0; i < 10; i++) sim.update(100, origin, [target, downstream], [], damage);
    assert.ok(downstream.health < 100000, 'it crushed the foe down the line');
    sim.update(oak.rollMs, origin, [target, downstream], [], damage);
    assert.equal(sim.rollers.length, 0);
    assert.equal(sim.acorns.length, oak.shardCount, 'shattered into ordinary acorns');
    assert.ok(sim.acorns.every(a => !a.oak && a.damage === ABILITIES.acorn.damage[4]));
  }
});

test('Living Bark and Heartwood hold their leaves, regrow one at a time, and burst when the last falls', () => {
  for (const [rank, tier] of [[5, 0], [10, 1]]) {
    const manager = new GameManager(); manager.playerStats.abilityRanks['barkskin-ward'] = rank;
    const bark = ABILITIES.ward.bark[tier];
    manager.update(1);
    assert.equal(manager.wardLeaves, bark.leaves); assert.equal(manager.wardStatus, 'ready');
    for (let i = 1; i <= bark.leaves; i++) {
      manager.damagePlayer(10, 'contact');
      assert.equal(manager.playerStats.health, 100, `leaf ${i} blocks`);
      assert.equal(manager.wardLeaves, bark.leaves - i);
      manager.update(ABILITIES.ward.protectionMs + 1);
      assert.equal(manager.consumeBarkBurst(), i === bark.leaves, 'only the last leaf bursts');
    }
    assert.equal(manager.wardStatus, 'recharging');
    manager.damagePlayer(10, 'contact');
    assert.equal(manager.playerStats.health, 90, 'bare bark no longer blocks');
    manager.update(ABILITIES.ward.rechargeMs[rank]);
    assert.ok(manager.wardLeaves >= 1, 'a leaf regrew');
    assert.equal(manager.bark.burstDamage, bark.burstDamage);
  }
});

test('Harvest Wind pulls every frame and stacks a capped, expiring bonus; Gale Harvest also heals', () => {
  const { sim, stats } = simulation('woodland-magnet', 5);
  const pickup = { position: { x: 300, y: 0 }, isCollected: false, count: 0, attract() { this.count++; } };
  sim.update(16, origin, [], [pickup], damage); sim.update(16, origin, [], [pickup], damage);
  assert.equal(pickup.count, 2, 'no cooldown between pulls');
  const h = ABILITIES.magnet.harvest[0];
  sim.noteCollected(10); assert.ok(Math.abs(sim.harvestBonus - 10 * h.bonusPerCrystal) < 1e-9);
  sim.noteCollected(100); assert.equal(sim.harvestBonus, h.maxBonus, 'capped');
  assert.equal(sim.pendingHeal, 0, 'no healing before the ascension');
  sim.update(h.durationMs + 1, origin, [], [], damage);
  assert.equal(sim.harvestBonus, 0, 'stacks expire');
  stats.abilityRanks['woodland-magnet'] = 10;
  const g = ABILITIES.magnet.harvest[1];
  sim.noteCollected(4);
  assert.ok(Math.abs(sim.harvestBonus - 4 * g.bonusPerCrystal) < 1e-9);
  assert.equal(sim.pendingHeal, 4 * g.healPerCrystal, 'ascended crystals heal');
  stats.abilityRanks['woodland-magnet'] = 4;
  assert.equal(sim.harvestBonus, 0, 'no bonus below the awakening');
});

test('Feral Frenzy chains pounces and hastens above half health; Bloodlust chains further and always hastens', () => {
  assert.equal(pounceChainLimit(1), 1);
  assert.equal(pounceChainLimit(5), ABILITIES.pounce.frenzy[0].maxChain);
  assert.equal(pounceChainLimit(10), ABILITIES.pounce.frenzy[1].maxChain);
  assert.equal(pounceCooldownScale(5, 80, 100), ABILITIES.pounce.frenzy[0].cooldownScale);
  assert.equal(pounceCooldownScale(5, 40, 100), 1);
  assert.equal(pounceCooldownScale(10, 5, 100), ABILITIES.pounce.frenzy[1].cooldownScale, 'bloodlust ignores health');
  assert.equal(pounceCooldownScale(3, 100, 100), 1);
  const pack = [enemy(100), enemy(180), enemy(260), enemy(340)];
  const hit = new Set([pack[0].id]);
  assert.equal(nextPounceTarget(1, hit, 1, pack[0].position, origin, 420, pack), undefined, 'double pounce stops after one chain');
  assert.equal(nextPounceTarget(5, hit, 1, pack[0].position, origin, 420, pack), pack[1], 'frenzy keeps going');
  assert.equal(nextPounceTarget(5, hit, ABILITIES.pounce.frenzy[0].maxChain, pack[0].position, origin, 420, pack), undefined, 'but has a limit');
  assert.ok(ABILITIES.pounce.damageScale[10] > ABILITIES.pounce.damageScale[5], 'ascended chained pounces hit harder');
});
