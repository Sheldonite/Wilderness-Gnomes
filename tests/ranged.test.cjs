const { test } = require('node:test');
const assert = require('node:assert/strict');
const { RangedSquirrelBehavior, rollRangedSpawn, rollSpawnVariant } = require('../artifacts/ability-tests/game/core/SquirrelBehavior.js');
const { BALANCE } = require('../artifacts/ability-tests/game/config/balance.js');

const player = { x: 1000, y: 1000 };
const R = BALANCE.rangedEnemy;

test('grey squirrels only appear from the unlock level, one in five spawns', () => {
  assert.equal(rollRangedSpawn(R.unlockLevel - 1, () => 0), false);
  assert.equal(rollRangedSpawn(R.unlockLevel, () => 0.19), true);
  assert.equal(rollRangedSpawn(R.unlockLevel, () => 0.21), false);
  let greys = 0;
  for (let i = 0; i < 10000; i++) if (rollRangedSpawn(R.unlockLevel + 2)) greys++;
  assert.ok(greys > 1700 && greys < 2300, `expected roughly 20% grey, got ${greys / 100}%`);
});

test('from the deer level only does and fawns spawn, with fawns in the minority', () => {
  const D = BALANCE.deer;
  assert.equal(rollSpawnVariant(D.unlockLevel - 1, () => 0.99), 'brown');
  const counts = { brown: 0, grey: 0, doe: 0, fawn: 0 };
  for (let i = 0; i < 10000; i++) counts[rollSpawnVariant(D.unlockLevel)]++;
  assert.equal(counts.brown + counts.grey, 0, 'no squirrels once deer arrive');
  assert.ok(counts.fawn > 3000 && counts.fawn < 4000, `expected ~35% fawns, got ${counts.fawn / 100}%`);
  assert.equal(counts.doe + counts.fawn, 10000);
});

test('a grey squirrel approaches, holds its range, and backs off when crowded', () => {
  const b = new RangedSquirrelBehavior(() => 0);
  const far = b.steer({ x: 1000, y: 1000 - R.preferredRange - 200 }, player);
  assert.ok(far.y > 0.99, 'far away it walks toward the player');
  const held = b.steer({ x: 1000, y: 1000 - (R.preferredRange + R.retreatRange) / 2 }, player);
  assert.deepEqual(held, { x: 0, y: 0 });
  const close = b.steer({ x: 1000, y: 1000 - R.retreatRange + 20 }, player);
  assert.ok(close.y < -0.99, 'too close it backs away');
});

test('acorns are thrown at the player on a cooldown and only within range', () => {
  const b = new RangedSquirrelBehavior(() => 0);
  const from = { x: 1000 + R.preferredRange, y: 1000 };
  assert.equal(b.tryThrow(from, player), undefined, 'not before the first cooldown elapses');
  b.tick(R.throwCooldownMs);
  const shot = b.tryThrow(from, player);
  assert.ok(shot);
  assert.ok(shot.x < 0 && Math.abs(shot.y) < 1e-9, 'flies toward the player');
  assert.ok(Math.abs(Math.hypot(shot.x, shot.y) - R.acornSpeed) < 1e-6);
  assert.equal(b.tryThrow(from, player), undefined, 'cooldown restarts after a throw');
  b.tick(R.throwCooldownMs);
  assert.equal(b.tryThrow({ x: 1000 + R.throwRange + 1, y: 1000 }, player), undefined, 'out of range');
  assert.ok(b.tryThrow({ x: 1000 + R.throwRange - 1, y: 1000 }, player), 'in range');
});
