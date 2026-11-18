const test = require('node:test');
const assert = require('node:assert/strict');
const { BALANCE } = require('../artifacts/ability-tests/game/config/balance.js');
const { rollSpawnVariant } = require('../artifacts/ability-tests/game/core/SquirrelBehavior.js');
const { ChestDrops } = require('../artifacts/ability-tests/game/core/ChestDrops.js');
const { GameManager, xpThreshold } = require('../artifacts/ability-tests/game/core/GameManager.js');
const { SceneryNavigation } = require('../artifacts/ability-tests/game/core/SceneryNavigation.js');

const ground = new SceneryNavigation(false);

test('BALANCE reflects early enemy health, spawn pacing, and attack configs', () => {
  assert.equal(BALANCE.enemy.contactDamage, 11);
  assert.equal(BALANCE.enemy.health, 20);
  assert.equal(BALANCE.enemy.damagePerLevel, 0.03);
  assert.equal(BALANCE.spawner.initialSpawnIntervalMs, 700);
  assert.equal(BALANCE.spawner.initialMaxEnemies, 70);
  assert.equal(BALANCE.spawner.batchFromMinute, 0);
  assert.equal(BALANCE.spawner.batchEveryMinutes, 2);
  assert.equal(BALANCE.spawner.maxBatch, 4);
  assert.equal(BALANCE.spawner.openingPackCount, 7);
  assert.equal(BALANCE.rangedEnemy.unlockLevel, 2);
  assert.equal(BALANCE.rangedEnemy.health, 17);
  assert.deepEqual(BALANCE.scout, {
    unlockLevel: 1,
    spawnChance: 0.14,
    health: 14,
    speed: 152,
    contactDamage: 10,
    radius: 13,
    xpValue: 10
  });
  assert.deepEqual(BALANCE.hedgehog, {
    unlockLevel: 3,
    spawnChance: 0.16,
    health: 36,
    walkSpeed: 88,
    rollSpeed: 370,
    rollDistance: 240,
    windupRange: 230,
    curlMs: 420,
    recoverMs: 500,
    cooldownMs: 1800,
    walkDamage: 10,
    rollDamage: 18,
    radius: 15,
    xpValue: 16
  });
  assert.equal(BALANCE.enemyXp.scout, 10);
  assert.equal(BALANCE.enemyXp.hedgehog, 16);
  assert.equal(BALANCE.elite.firstMs, 45000);
  assert.equal(BALANCE.events.ringFirstMs, 75000);
  assert.equal(BALANCE.events.ringBase, 10);
  assert.equal(BALANCE.events.stampedeFirstMs, 120000);
  assert.equal(BALANCE.events.shrineFirstMs, 90000);
  assert.equal(BALANCE.companion.mysteryDamage, 40);
});

test('XP costs rise from the opening through endless levels', () => {
  assert.equal(xpThreshold(1), 116);
  assert.equal(xpThreshold(10), 695);
  assert.equal(xpThreshold(40), 6455);
  assert.equal(xpThreshold(41) - xpThreshold(40), 192);

  const game = new GameManager();
  assert.equal(game.addXp(14 * BALANCE.enemyXp.brown), false);
  assert.equal(game.level, 1);
  assert.equal(game.addXp(BALANCE.enemyXp.brown), true);
  assert.equal(game.level, 2);
  assert.equal(game.xp, 4);
});

test('rollSpawnVariant introduces scout at Lv 1, grey at Lv 2, and hedgehog at Lv 3', () => {
  // Lv 1: scout or brown only
  assert.equal(rollSpawnVariant(1, () => 0.13), 'scout');
  assert.equal(rollSpawnVariant(1, () => 0.15), 'brown');

  // Lv 2: grey unlocks, scout still rolls
  assert.equal(rollSpawnVariant(2, () => 0.19), 'grey');
  const lv2Rolls = [0.5, 0.13];
  assert.equal(rollSpawnVariant(2, () => lv2Rolls.shift()), 'scout');

  // Lv 3: hedgehog unlocks alongside grey and scout
  const lv3HedgehogRolls = [0.5, 0.15];
  assert.equal(rollSpawnVariant(3, () => lv3HedgehogRolls.shift()), 'hedgehog');
  const lv3ScoutRolls = [0.5, 0.5, 0.10];
  assert.equal(rollSpawnVariant(3, () => lv3ScoutRolls.shift()), 'scout');
  assert.equal(rollSpawnVariant(3, () => 0.99), 'brown');
});

test('ChestDrops guarantees a chest on reaching Level 3 once per run', () => {
  const drops = new ChestDrops(ground, () => 0.99); // never rolls random chests
  drops.advanceToLevel(2);
  assert.equal(drops.pending, 0);
  drops.advanceToLevel(3);
  assert.equal(drops.pending, 1, 'reaching level 3 guarantees a chest');
  drops.advanceToLevel(3);
  drops.advanceToLevel(5);
  assert.equal(drops.pending, 1, 'guaranteed chest only grants once per run');
});

test('Woods are waking 90s challenge grants +1 reroll and +8 bonusGold at 28 kills within 90s', () => {
  const game = new GameManager();
  const initialRerolls = game.rerollsRemaining;
  assert.equal(game.wakingWindowMs, 90000);
  assert.equal(game.wakingGoal, 28);
  assert.equal(game.wakingKills, 0);
  assert.equal(game.wakingCompleted, false);

  game.update(45000);
  for (let i = 0; i < 27; i++) game.recordKill();
  assert.equal(game.wakingKills, 27);
  assert.equal(game.wakingCompleted, false);
  assert.equal(game.consumeWakingReward(), false);

  game.recordKill();
  assert.equal(game.wakingKills, 28);
  assert.equal(game.wakingCompleted, true);
  assert.equal(game.rerollsRemaining, initialRerolls + 1);
  assert.equal(game.bonusGold, 8);
  assert.equal(game.consumeWakingReward(), true);
  assert.equal(game.consumeWakingReward(), false, 'reward notification is consumed once');

  // Kills after 90s on a run that missed the window do not complete it
  const lateGame = new GameManager();
  lateGame.update(90001);
  for (let i = 0; i < 30; i++) lateGame.recordKill();
  assert.equal(lateGame.wakingKills, 0);
  assert.equal(lateGame.wakingCompleted, false);
  assert.equal(lateGame.bonusGold, 0);
});

test('Kill-streak combo scales damage and XP up to 1.35x, decays over 2200ms, and populates HudSnapshot', () => {
  const game = new GameManager();
  assert.equal(game.getComboDamageMultiplier(), 1);
  assert.equal(game.getComboXpMultiplier(), 1);

  for (let i = 0; i < 10; i++) game.recordKill();
  assert.equal(game.comboCount, 10);
  assert.equal(game.comboTimerMs, 2200);
  assert.ok(Math.abs(game.getComboDamageMultiplier() - 1.1) < 1e-9);

  // XP bonus from 1.1x combo
  game.addXp(10);
  assert.equal(game.xp, 11);

  const snap = game.getHudSnapshot();
  assert.equal(snap.wakingKills, 10);
  assert.equal(snap.wakingGoal, 28);
  assert.equal(snap.wakingRemainingMs, 90000);
  assert.ok(Math.abs(snap.wakingProgress - 10 / 28) < 1e-9);
  assert.equal(snap.wakingCompleted, false);
  assert.equal(snap.comboCount, 10);
  assert.ok(Math.abs(snap.comboMultiplier - 1.1) < 1e-9);
  assert.equal(snap.comboTimerRatio, 1);

  // Cap at 1.35x (35+ kills)
  for (let i = 0; i < 30; i++) game.recordKill();
  assert.equal(game.comboCount, 40);
  assert.ok(Math.abs(game.getComboDamageMultiplier() - 1.35) < 1e-9);

  // Decay & reset after 2200ms
  game.update(1100);
  assert.equal(game.comboTimerMs, 1100);
  assert.equal(game.getHudSnapshot().comboTimerRatio, 0.5);
  game.update(1100);
  assert.equal(game.comboTimerMs, 0);
  assert.equal(game.comboCount, 0);
  assert.equal(game.getComboDamageMultiplier(), 1);
  assert.equal(game.getHudSnapshot().comboTimerRatio, 0);
});
