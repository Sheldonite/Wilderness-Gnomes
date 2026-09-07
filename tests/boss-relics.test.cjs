const test = require('node:test');
const assert = require('node:assert/strict');
const { GameManager } = require('../artifacts/ability-tests/game/core/GameManager.js');
const { BossGate, BOSS_ARENA_RADIUS, insideBossArena } = require('../artifacts/ability-tests/game/core/BossGate.js');
const { BossPowerSimulation } = require('../artifacts/ability-tests/game/core/BossPowerSimulation.js');
const { ChestDrops } = require('../artifacts/ability-tests/game/core/ChestDrops.js');
const { UpgradeSystem } = require('../artifacts/ability-tests/game/systems/UpgradeSystem.js');
const { upgradePreview, ownedUpgrades } = require('../artifacts/ability-tests/game/core/UpgradeProgress.js');
const { CombatResolver } = require('../artifacts/ability-tests/game/core/CombatResolver.js');
const { BOSS_ABILITY_IDS, bossPower } = require('../artifacts/ability-tests/game/config/bossAbilities.js');
const player = { x: 1000, y: 1000 };
const ground = { blocked: () => false, clear: () => true };
let enemyId = 0;
function enemy(x = 1100, y = 1000, health = 10000) {
  return { id: ++enemyId, position: { x, y }, radius: 15, health, isDead: false,
    takeDamage(amount) { this.health -= amount; this.isDead = this.health <= 0; return this.isDead; } };
}
const damage = (target, amount) => target.takeDamage(amount);

test('boss gates stop XP overflow at each boss level and preserve earned XP', () => {
  const game = new GameManager();
  game.addXp(100000);
  while (game.state === 'LevelUpPaused') game.resumeAfterUpgrade();
  assert.equal(game.level, 10); assert.equal(game.bossGate.required(game.level), 'oven');
  const saved = game.xp;
  assert.equal(game.addXp(100), false); assert.equal(game.xp, saved + 100); assert.equal(game.level, 10);
  assert.equal(game.bossGate.defeat('oven'), true);
  game.addXp(0);
  while (game.state === 'LevelUpPaused') game.resumeAfterUpgrade();
  assert.equal(game.level, 15); assert.equal(game.bossGate.required(game.level), 'stag');
  assert.equal(game.bossGate.defeat('stag'), true);
  game.addXp(0); assert.equal(game.level, 16);
});

test('skipped levels still require both bosses in order, and each victory earns one chest', () => {
  const gate = new BossGate(), drops = new ChestDrops(ground);
  assert.equal(gate.required(9), undefined); assert.equal(gate.required(20), 'oven');
  for (let i = 0; i < 3; i++) if (gate.defeat('oven')) drops.addBoss(player);
  assert.equal(drops.chests.length, 1); assert.equal(gate.required(20), 'stag');
  for (let i = 0; i < 3; i++) if (gate.defeat('stag')) drops.addBoss(player);
  assert.equal(drops.chests.length, 2); assert.equal(gate.required(20), undefined);
  assert.equal(new BossGate().required(20), 'oven');
});

test('arena confines walking, knockback and boss charges while allowing movement inside', () => {
  for (const radius of [18, 22, 34]) {
    for (const point of [{ x: 9000, y: 1000 }, { x: -1000, y: -5000 }]) {
      const safe = insideBossArena(point, player, radius);
      assert.ok(Math.hypot(safe.x - player.x, safe.y - player.y) <= BOSS_ARENA_RADIUS - radius + 1e-6);
    }
    const inside = { x: 1100, y: 1200 };
    assert.equal(insideBossArena(inside, player, radius), inside);
  }
});

test('boss chest offers exactly the three exclusive powers; ordinary rewards cannot grant or upgrade them', () => {
  const game = new GameManager(), upgrades = new UpgradeSystem(), drops = new ChestDrops(ground);
  const offers = upgrades.getBossChoices(game.playerStats);
  assert.deepEqual(offers.map(offer => offer.id), BOSS_ABILITY_IDS);
  for (const source of ['level', 'chest']) {
    game.upgradeSource = source;
    for (const offer of offers) {
      upgrades.applyUpgrade(offer, game.playerStats);
      assert.equal(upgrades.applyBossUpgrade(offer, game), false);
    }
  }
  assert.ok(BOSS_ABILITY_IDS.every(id => game.playerStats.bossAbilityRanks[id] === 0));
  drops.addBoss(player); assert.ok(drops.collectNearby(player, game));
  assert.equal(game.upgradeSource, 'boss'); assert.equal(game.level, 1);
  assert.equal(upgrades.applyBossUpgrade(offers[0], game), true);
  assert.equal(upgrades.applyBossUpgrade(offers[1], game), false); // one reward per chest
  assert.equal(drops.collectNearby(player, game), undefined);
  game.resumeAfterUpgrade();
  const first = game.playerStats.bossAbilityRanks.crownfire;
  assert.equal(first, 1);
  for (let i = 0; i < 100; i++) {
    assert.ok(upgrades.getChoices(game.playerStats).every(offer => !BOSS_ABILITY_IDS.includes(offer.id)));
  }
  assert.ok(!upgrades.getAvailable(game.playerStats).some(offer => BOSS_ABILITY_IDS.includes(offer.id)));
  drops.addBoss(player); drops.collectNearby(player, game);
  const next = upgrades.getBossChoices(game.playerStats)[0];
  const preview = upgradePreview(next, game.playerStats);
  assert.equal(preview.current, 1); assert.equal(preview.next, 2); assert.equal(preview.maxRank, 3);
  assert.equal(game.playerStats.bossAbilityRanks.crownfire, 1); // preview must not mutate the run
  assert.equal(upgrades.applyBossUpgrade(offers[0], game), false); // stale rank
  assert.equal(upgrades.applyBossUpgrade(next, game), true);
  assert.equal(game.playerStats.bossAbilityRanks.crownfire, 2);
  assert.ok(ownedUpgrades(game.playerStats).includes('crownfire'));
});

test('boss powers cap at rank three, with stronger descriptions and no repeat offers at the cap', () => {
  const game = new GameManager(), upgrades = new UpgradeSystem();
  for (const id of BOSS_ABILITY_IDS) {
    for (let rank = 1; rank <= 3; rank++) {
      game.openChestUpgrade('boss');
      const offer = upgrades.getBossChoices(game.playerStats).find(offer => offer.id === id);
      assert.equal(offer.rank, rank); assert.match(offer.description, /Only boss chests/);
      assert.equal(upgrades.applyBossUpgrade(offer, game), true); game.resumeAfterUpgrade();
    }
    assert.ok(!upgrades.getBossChoices(game.playerStats).some(offer => offer.id === id));
  }
  assert.deepEqual(new GameManager().playerStats.bossAbilityRanks, { crownfire: 0, stormcall: 0, 'phoenix-heart': 0 });
});

test('Crownfire hits only nearby living foes once per cooldown and scales with boss ranks', () => {
  for (const rank of [1, 2, 3]) {
    const game = new GameManager(), sim = new BossPowerSimulation(); game.playerStats.bossAbilityRanks.crownfire = rank;
    const near = enemy(), far = enemy(1600), dead = enemy(); dead.isDead = true;
    sim.update(1, game, player, [near, far, dead], damage);
    const power = bossPower('crownfire', rank);
    assert.equal(near.health, 10000 - power.damage); assert.equal(far.health, 10000); assert.equal(dead.health, 10000);
    sim.update(3999, game, player, [near], damage); assert.equal(near.health, 10000 - power.damage);
    sim.update(1, game, player, [near], damage); assert.equal(near.health, 10000 - power.damage * 2);
  }
});

test('Stormcall chains to distinct foes within reach, increasing damage and targets with rank', () => {
  for (const rank of [1, 2, 3]) {
    const game = new GameManager(), sim = new BossPowerSimulation(); game.playerStats.bossAbilityRanks.stormcall = rank;
    const foes = Array.from({ length: 8 }, (_, i) => enemy(1100 + i * 100));
    const distant = enemy(5000);
    sim.update(1, game, player, [...foes, distant], damage);
    const power = bossPower('stormcall', rank);
    assert.equal(foes.filter(foe => foe.health === 10000 - power.damage).length, power.targets);
    assert.equal(distant.health, 10000); assert.equal(sim.events[0].path.length, power.targets + 1);
  }
});

test('Phoenix Heart heals without exceeding max health and pulses area damage on its own cooldown', () => {
  const game = new GameManager(), sim = new BossPowerSimulation(); game.playerStats.bossAbilityRanks['phoenix-heart'] = 2;
  game.playerStats.health = 50; const foe = enemy();
  sim.update(1, game, player, [foe], damage);
  assert.equal(game.playerStats.health, 66); assert.equal(foe.health, 9880);
  sim.update(9999, game, player, [foe], damage); assert.equal(game.playerStats.health, 66);
  game.playerStats.health = 95; sim.update(1, game, player, [], damage);
  assert.equal(game.playerStats.health, 100);
});

test('boss power timers freeze in pause and defeat states, and all damage shares the defeat gate', () => {
  const game = new GameManager(), sim = new BossPowerSimulation();
  game.playerStats.bossAbilityRanks.crownfire = 1;
  game.playerStats.bossAbilityRanks.stormcall = 1;
  const foe = enemy(1100, 1000, 100); let kills = 0;
  const combat = new CombatResolver(() => kills++);
  sim.update(1, game, player, [foe], combat.damage); assert.equal(kills, 1);
  const next = enemy();
  for (const state of ['Paused', 'LevelUpPaused', 'GameOver']) {
    game.state = state; sim.update(100000, game, player, [next], damage);
    assert.equal(next.health, 10000); assert.equal(sim.events.length, 0);
  }
  game.state = 'Playing'; game.playerStats.bossAbilityRanks.stormcall = 0;
  sim.update(1, game, player, [next], damage); assert.equal(next.health, 10000);
  sim.update(3999, game, player, [next], damage); assert.equal(next.health, 9880);
});
