const test = require('node:test');
const assert = require('node:assert/strict');
const { KingEncounter, distanceToEdge } = require('../artifacts/ability-tests/game/core/KingEncounter.js');
const { KING } = require('../artifacts/ability-tests/game/config/kingBoss.js');
const arena = { center: { x: 0, y: 0 }, radius: 520 };
const limit = arena.radius - KING.radius;
const quiet = () => {};

/** A King curled up at `boss`, aimed at `player`, about to roll. */
function curled(boss, player, health = 1) {
  const fight = new KingEncounter(); fight.shouldSpawn(KING.level);
  fight.update(KING.introductionMs, boss, player, 18, health, arena, quiet);
  fight.update(1000, boss, player, 18, health, arena, quiet);
  assert.equal(fight.phase, 'curling');
  return fight;
}

/** Drive the roll frame by frame, moving the King by his own steps. */
function roll(fight, from, player, health = 1, hit = quiet) {
  const pos = { ...from }; let contacts = 0;
  for (let i = 0; i < 2000 && fight.phase !== 'dizzy'; i++) {
    fight.update(16, pos, player, 18, health, arena, hit);
    pos.x += fight.rollStep.x; pos.y += fight.rollStep.y;
    contacts += fight.bounces.length;
    assert.ok(Math.hypot(pos.x, pos.y) <= limit + 1e-6, 'never leaves the arena');
    if (fight.shards) return { pos, contacts, shards: fight.shards };
  }
  return { pos, contacts };
}

test('distance to the arena edge along a heading', () => {
  assert.equal(distanceToEdge({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }, 100), 100);
  assert.equal(distanceToEdge({ x: 100, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }, 100), 0, 'already leaving');
  assert.ok(Math.abs(distanceToEdge({ x: 100, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 0 }, 100) - 200) < 1e-9, 'heading back in');
});

test('level 25 unlocks exactly one King', () => {
  const fight = new KingEncounter();
  assert.equal(fight.shouldSpawn(24), false); assert.equal(fight.shouldSpawn(25), true); assert.equal(fight.shouldSpawn(30), false);
});

test('the King curls toward the player, then rolls and ricochets off the arena wall until his bounces run out', () => {
  const fight = curled({ x: 0, y: 0 }, { x: 300, y: 0 });
  assert.ok(fight.direction.x > .99, 'aimed at the player, locked while curling');
  fight.update(KING.curlMs - 1, { x: 0, y: 0 }, { x: 0, y: 300 }, 18, 1, arena, quiet);
  assert.ok(fight.direction.x > .99);
  fight.update(1, { x: 0, y: 0 }, { x: 0, y: 300 }, 18, 1, arena, quiet);
  assert.equal(fight.phase, 'rolling');
  let hits = 0;
  const result = roll(fight, { x: 0, y: 0 }, { x: 300, y: 0 }, 1, d => { assert.equal(d, KING.rollDamage); hits++; });
  assert.equal(result.contacts, KING.bounces + 1, 'the last wall contact ends the roll');
  assert.equal(hits, KING.bounces + 1, 'a player on every leg is hit once per leg');
  assert.equal(fight.phase, 'dizzy'); assert.ok(fight.vulnerable);
  assert.equal(result.shards.directions.length, KING.shardCount);
  fight.update(KING.dizzyMs, result.pos, { x: 300, y: 0 }, 18, 1, arena, quiet);
  assert.equal(fight.phase, 'stalking'); assert.ok(!fight.vulnerable);
});

test('enraged, he bounces more and sprays more shards', () => {
  const fight = curled({ x: 0, y: 0 }, { x: 0, y: 300 }, .3);
  fight.update(KING.enragedCurlMs, { x: 0, y: 0 }, { x: 0, y: 300 }, 18, .3, arena, quiet);
  const result = roll(fight, { x: 0, y: 0 }, { x: 5000, y: 5000 }, .3);
  assert.equal(result.contacts, KING.enragedBounces + 1);
  assert.equal(result.shards.directions.length, KING.enragedShardCount);
});

test('a tree sends him straight back and counts as a bounce; defeat stops everything', () => {
  const fight = curled({ x: 0, y: 0 }, { x: 300, y: 0 });
  fight.update(KING.curlMs, { x: 0, y: 0 }, { x: 300, y: 0 }, 18, 1, arena, quiet);
  fight.update(16, { x: 0, y: 0 }, { x: 300, y: 0 }, 18, 1, arena, quiet);
  fight.blocked({ x: 10, y: 0 });
  assert.ok(fight.direction.x < -.99);
  fight.defeat();
  fight.update(1000, { x: 0, y: 0 }, { x: 0, y: 0 }, 18, 1, arena, () => assert.fail('post-defeat hit'));
  assert.deepEqual(fight.rollStep, { x: 0, y: 0 });
});

test('the royal guard arrives once per threshold', () => {
  const fight = curled({ x: 0, y: 0 }, { x: 300, y: 0 });
  fight.update(16, { x: 0, y: 0 }, { x: 300, y: 0 }, 18, .5, arena, quiet);
  assert.equal(fight.pendingAdds, KING.addsPerWave);
  fight.update(16, { x: 0, y: 0 }, { x: 300, y: 0 }, 18, .1, arena, quiet);
  assert.equal(fight.pendingAdds, KING.addsPerWave * 2);
});
