const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GameManager } = require('../artifacts/ability-tests/game/core/GameManager.js');
const { UpgradeSystem } = require('../artifacts/ability-tests/game/systems/UpgradeSystem.js');
const { TobiasSwim } = require('../artifacts/ability-tests/game/core/TobiasSwim.js');
const { COMPANION_BY_CHARACTER, COMPANION_LEVELS_PER_RANK, MAX_COMPANION_RANK, companionPower,
  companionRankForLevel, frankieBirdsForRank, levelForCompanionRank } = require('../artifacts/ability-tests/game/config/companions.js');
const { BALANCE } = require('../artifacts/ability-tests/game/config/balance.js');

let nextId = 0;
function foe(x, y, health = 1000) {
  return { id: ++nextId, position: { x, y }, radius: 15, health, isDead: false,
    takeDamage(amount) { this.health -= amount; this.isDead = this.health <= 0; return this.isDead; } };
}
const damage = (enemy, amount) => enemy.takeDamage(amount);
const CHARACTERS = ['wizard', 'hailey', 'sheldon', 'ron'];

test('every wanderer is bound to one companion from the first step of the run', () => {
  assert.deepEqual(COMPANION_BY_CHARACTER, { wizard: 'mystery', hailey: 'midnight', sheldon: 'frankie', ron: 'tobias' });
  for (const character of CHARACTERS) {
    const stats = new GameManager('spell', undefined, character).playerStats;
    assert.equal(stats.characterId, character);
    assert.equal(stats.companionId, COMPANION_BY_CHARACTER[character]);
    assert.equal(stats.companionRank, 0, `${character} starts at rank 0`);
  }
  // An unknown id must still produce a playable run rather than a companionless one.
  assert.equal(new GameManager('spell', undefined, 'nobody').playerStats.companionId, 'mystery');
});

test('companions are never offered as upgrade cards on any wanderer', () => {
  const upgrades = new UpgradeSystem();
  for (const character of CHARACTERS) {
    const stats = new GameManager('spell', undefined, character).playerStats;
    for (let level = 1; level <= 30; level++) {
      stats.level = level;
      for (const choice of upgrades.getAvailable(stats)) {
        assert.ok(!choice.id.startsWith('gain-companion'), `${character} was offered ${choice.id}`);
        assert.notEqual(choice.id, 'frankie-flock');
      }
    }
  }
});

test('a companion gains a rank every three levels and stops at ten', () => {
  assert.equal(COMPANION_LEVELS_PER_RANK, 3);
  assert.equal(companionRankForLevel(1), 0);
  assert.equal(companionRankForLevel(2), 0);
  assert.equal(companionRankForLevel(3), 1);
  assert.equal(companionRankForLevel(5), 1);
  assert.equal(companionRankForLevel(6), 2);
  assert.equal(companionRankForLevel(30), MAX_COMPANION_RANK);
  assert.equal(companionRankForLevel(99), MAX_COMPANION_RANK);
  assert.equal(levelForCompanionRank(4), 12);
  assert.ok(companionPower(10) > companionPower(0));
});

test('levelling the run raises the companion rank and announces each growth once', () => {
  const game = new GameManager('spell', undefined, 'wizard');
  const stats = game.playerStats;
  // The level 10 boss gate would otherwise hold the run at level 10.
  game.bossGate.defeat('oven'); game.bossGate.defeat('stag');
  const reached = [];
  for (let level = 2; level <= 13; level++) {
    game.addXp(game.xpToNextLevel - game.xp);
    assert.equal(game.level, level);
    assert.equal(stats.companionRank, companionRankForLevel(level), `level ${level}`);
    const grew = game.consumeCompanionGrowth();
    if (grew) reached.push([level, grew]);
    // The announcement is drained, so the same growth is never reported twice.
    assert.equal(game.consumeCompanionGrowth(), 0);
    game.resumeAfterUpgrade();
  }
  assert.deepEqual(reached, [[3, 1], [6, 2], [9, 3], [12, 4]]);
});

test('Mystery grows stronger and quicker with rank, without any upgrade being picked', () => {
  const game = new GameManager('spell', undefined, 'wizard'), stats = game.playerStats;
  const baseDamage = stats.mysteryDamage, baseCooldown = stats.mysteryCooldownMs;
  game.level = 30; game.syncCompanionToLevel();
  assert.equal(stats.companionRank, MAX_COMPANION_RANK);
  assert.ok(stats.mysteryDamage > baseDamage * 2, `${stats.mysteryDamage} vs ${baseDamage}`);
  assert.ok(stats.mysteryCooldownMs < baseCooldown);
  assert.equal(Object.keys(stats.upgradeCounts).length, 0);
});

test('Frankie flies alone at rank 0 and reaches the full flock by rank 8', () => {
  assert.equal(frankieBirdsForRank(0), 1);
  assert.equal(frankieBirdsForRank(1), 1);
  assert.equal(frankieBirdsForRank(2), 2);
  assert.equal(frankieBirdsForRank(8), BALANCE.companion.frankieMaxBirds);
  assert.equal(frankieBirdsForRank(10), BALANCE.companion.frankieMaxBirds);
});

test('Tobias cruises beside Ron, torpedoes a nearby foe, then drifts back', () => {
  const stats = new GameManager('spell', undefined, 'ron').playerStats;
  const tuna = new TobiasSwim(stats);
  const player = { x: 0, y: 0 };
  tuna.update(16, player, [], damage);
  assert.equal(tuna.state, 'cruising');
  // He holds station near the bard rather than wandering off.
  for (let i = 0; i < 200; i++) tuna.update(16, player, [], damage);
  assert.ok(Math.hypot(tuna.position.x, tuna.position.y) < BALANCE.companion.tobiasSwimRadius * 2);

  const prey = foe(200, 0);
  let guard = 0;
  while (tuna.state !== 'darting' && guard++ < 400) tuna.update(16, player, [prey], damage);
  assert.equal(tuna.state, 'darting');
  guard = 0;
  while (prey.health === 1000 && guard++ < 400) tuna.update(16, player, [prey], damage);
  assert.ok(prey.health < 1000, 'the dart connected');
  assert.equal(tuna.state, 'returning');
  guard = 0;
  while (tuna.state !== 'cruising' && guard++ < 400) tuna.update(16, player, [prey], damage);
  assert.equal(tuna.state, 'cruising');
});

test('Tobias hits harder at higher companion rank and leaves a trail of stirred air', () => {
  const game = new GameManager('spell', undefined, 'ron'), stats = game.playerStats;
  const base = new TobiasSwim(stats).damage;
  game.level = 30; game.syncCompanionToLevel();
  const grown = new TobiasSwim(stats).damage;
  assert.ok(grown > base * 2, `${grown} vs ${base}`);

  const tuna = new TobiasSwim(stats);
  const player = { x: 0, y: 0 };
  for (let i = 0; i < 60; i++) tuna.update(16, player, [], damage);
  assert.ok(tuna.wakes.length > 0, 'air wakes are produced');
  // Wakes expire rather than piling up forever.
  for (let i = 0; i < 600; i++) tuna.update(16, player, [], damage);
  assert.ok(tuna.wakes.length < 20, `wake count stayed bounded (${tuna.wakes.length})`);
});
