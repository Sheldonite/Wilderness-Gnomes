const test = require('node:test');
const assert = require('node:assert/strict');
const { BALANCE } = require('../artifacts/ability-tests/game/config/balance.js');
const { BuzzardFlight } = require('../artifacts/ability-tests/game/core/BuzzardFlight.js');
const { rollSpawnVariant } = require('../artifacts/ability-tests/game/core/SquirrelBehavior.js');
const B = BALANCE.buzzard;

test('buzzards join the spawns from King Frankie\'s level, about one in five', () => {
  for (let level = 1; level < B.unlockLevel; level++) {
    for (let i = 0; i < 50; i++) assert.notEqual(rollSpawnVariant(level, () => i / 50), 'buzzard', `level ${level}`);
  }
  assert.equal(rollSpawnVariant(B.unlockLevel, () => B.spawnChance - .01), 'buzzard');
  let buzzards = 0;
  for (let i = 0; i < 10000; i++) if (rollSpawnVariant(B.unlockLevel + 3) === 'buzzard') buzzards++;
  assert.ok(Math.abs(buzzards / 10000 - B.spawnChance) < .02, `expected ~${B.spawnChance * 100}%, got ${buzzards / 100}%`);
});

/** A buzzard whose first swoop is ready now. */
const ready = () => new BuzzardFlight(() => 0);

test('buzzards fly straight at the player and do not swoop from far away', () => {
  const flight = ready();
  flight.update(B.swoopCooldownMs, { x: 0, y: 0 }, { x: 1000, y: 0 }, 0);   // let the cooldown lapse
  const step = flight.update(1000, { x: 0, y: 0 }, { x: 1000, y: 0 }, 150);
  assert.equal(flight.phase, 'approaching');
  assert.deepEqual(step, { x: 150, y: 0 });
});

test('in range they hover (the tell), then swoop along the locked line and climb away', () => {
  const flight = ready();
  flight.update(B.swoopCooldownMs, { x: 0, y: 0 }, { x: 1000, y: 0 }, 0);
  const still = flight.update(16, { x: 0, y: 0 }, { x: 200, y: 0 }, 150);
  assert.equal(flight.phase, 'windup'); assert.deepEqual(still, { x: 0, y: 0 });
  flight.update(B.swoopWindupMs - 1, { x: 0, y: 0 }, { x: 0, y: 200 }, 150);
  assert.equal(flight.phase, 'windup');
  flight.update(1, { x: 0, y: 0 }, { x: 0, y: 200 }, 150);
  assert.equal(flight.phase, 'swooping'); assert.ok(flight.swooping);
  let travelled = 0, y = 0;
  for (let i = 0; i < 200 && flight.swooping; i++) {
    const step = flight.update(16, { x: travelled, y: 0 }, { x: 0, y: 200 }, 150);
    travelled += step.x; y += step.y;
  }
  assert.ok(Math.abs(travelled - B.swoopDistance) < 1e-6, 'the full swoop, along the line it locked');
  assert.equal(y, 0, 'moving during the tell does not re-aim it');
  assert.equal(flight.phase, 'recovering');
  flight.update(B.recoverMs, { x: travelled, y: 0 }, { x: 0, y: 0 }, 150);
  assert.equal(flight.phase, 'approaching');
  flight.update(16, { x: travelled, y: 0 }, { x: travelled + 100, y: 0 }, 150);
  assert.equal(flight.phase, 'approaching', 'and waits out its cooldown before the next swoop');
});

test('a swoop cut short by the edge of the world recovers early', () => {
  const flight = ready();
  flight.update(B.swoopCooldownMs, { x: 0, y: 0 }, { x: 1000, y: 0 }, 0);
  flight.update(16, { x: 0, y: 0 }, { x: 200, y: 0 }, 150);
  flight.update(B.swoopWindupMs, { x: 0, y: 0 }, { x: 200, y: 0 }, 150);
  flight.blocked();
  assert.equal(flight.phase, 'recovering');
});
