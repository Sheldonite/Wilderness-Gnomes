const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ArmadilloBehavior } = require('../artifacts/ability-tests/game/core/ArmadilloBehavior.js');
const { rollSpawnVariant } = require('../artifacts/ability-tests/game/core/SquirrelBehavior.js');
const { BALANCE } = require('../artifacts/ability-tests/game/config/balance.js');

const A = BALANCE.armadillo;
const player = { x: 0, y: 0 };

test('armadillos only join the woods from level 20', () => {
  assert.notEqual(rollSpawnVariant(A.unlockLevel - 1, () => 0), 'armadillo');
  assert.equal(rollSpawnVariant(A.unlockLevel, () => 0.24), 'armadillo');
  assert.notEqual(rollSpawnVariant(A.unlockLevel, () => 0.26), 'armadillo');
  let n = 0;
  for (let i = 0; i < 10000; i++) if (rollSpawnVariant(A.unlockLevel) === 'armadillo') n++;
  assert.ok(n > 2200 && n < 2800, `expected ~25% armadillos, got ${n / 100}%`);
});

test('an armadillo walks in, curls, then rolls a locked line at the player', () => {
  const dillo = new ArmadilloBehavior();
  const start = { x: 0, y: -400 };
  const first = dillo.update(100, start, player);
  assert.ok(first.y > 0, 'it walks toward the player');
  assert.equal(dillo.phase, 'approaching');
  const close = { x: 0, y: -A.windupRange + 10 };
  dillo.update(16, close, player);
  assert.equal(dillo.phase, 'curling');
  const duringCurl = dillo.update(A.curlMs, close, player);
  assert.deepEqual(duringCurl, { x: 0, y: 0 });
  assert.equal(dillo.phase, 'rolling');
  const roll = dillo.update(50, close, player);
  assert.ok(roll.y > 0, 'the roll continues the locked heading');
  assert.equal(dillo.rolling, true);
});

test('a finished or blocked roll recovers, then the armadillo can curl again', () => {
  const dillo = new ArmadilloBehavior();
  const close = { x: 0, y: -40 };
  dillo.update(16, close, player);
  dillo.update(A.curlMs, close, player);
  assert.equal(dillo.phase, 'rolling');
  dillo.update(A.rollDistance / A.rollSpeed * 1000 + 20, close, player);
  assert.equal(dillo.phase, 'recovering');
  dillo.update(A.recoverMs, close, player);
  assert.equal(dillo.phase, 'approaching');
  const blocked = new ArmadilloBehavior();
  blocked.update(16, close, player);
  blocked.update(A.curlMs, close, player);
  blocked.blocked();
  assert.equal(blocked.phase, 'recovering');
  assert.equal(blocked.rolling, false);
});
