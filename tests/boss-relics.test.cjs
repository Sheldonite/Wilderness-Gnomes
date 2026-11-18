const test = require('node:test');
const assert = require('node:assert/strict');
const { GameManager, xpThreshold } = require('../artifacts/ability-tests/game/core/GameManager.js');
const { BossSchedule, BOSS_WAIT_MS } = require('../artifacts/ability-tests/game/core/BossSchedule.js');
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

test('XP and queued level-ups advance while the Oven is alive', () => {
  const schedule = new BossSchedule('oven');
  const game = new GameManager('spell', undefined, 'wizard', schedule);
  game.level = 10;
  game.xpToNextLevel = xpThreshold(10);
  game.update(BOSS_WAIT_MS);
  assert.equal(schedule.startDue(game.elapsedMs)?.id, 'oven');

  assert.equal(game.addXp(xpThreshold(10) + xpThreshold(11) + 8), true);
  assert.equal(game.level, 11);
  game.resumeAfterUpgrade();
  assert.equal(game.level, 12);
  game.resumeAfterUpgrade();
  assert.equal(game.state, 'Playing');
  assert.equal(game.xp, 8);
  assert.equal(schedule.activeBoss, 'oven');
});

test('boss timing uses active gameplay and measures each gap from defeat', () => {
  const game = new GameManager();
  const schedule = game.bossSchedule;
  game.update(BOSS_WAIT_MS - 1);
  game.pause();
  game.update(BOSS_WAIT_MS);
  assert.equal(schedule.startDue(game.elapsedMs), undefined);
  game.resume();
  game.openChestUpgrade();
  game.update(BOSS_WAIT_MS);
  assert.equal(game.getHudSnapshot().nextBossRemainingMs, 1);
  game.resumeAfterUpgrade();
  game.update(1);
  assert.equal(schedule.startDue(game.elapsedMs)?.id, 'chief');

  game.update(BOSS_WAIT_MS * 2);
  assert.equal(schedule.startDue(game.elapsedMs), undefined);
  assert.equal(game.getHudSnapshot().nextBossRemainingMs, undefined);
  assert.equal(schedule.defeat('oven', game.elapsedMs), false);
  assert.equal(schedule.defeat('chief', game.elapsedMs), true);
  game.update(BOSS_WAIT_MS - 1);
  assert.equal(schedule.defeat('chief', game.elapsedMs), false);
  assert.equal(schedule.startDue(game.elapsedMs), undefined);
  game.update(1);
  assert.equal(schedule.startDue(game.elapsedMs)?.id, 'oven');
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
