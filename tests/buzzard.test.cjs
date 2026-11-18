const test = require('node:test');
const assert = require('node:assert/strict');
const { BuzzardEncounter, inCone } = require('../artifacts/ability-tests/game/core/BuzzardEncounter.js');
const { BUZZARD } = require('../artifacts/ability-tests/game/config/buzzardBoss.js');
const quiet = () => {};

/** An encounter past its arrival, circling and about to start its first attack. */
function circling(health = 1) {
  const fight = new BuzzardEncounter();
  const boss = { x: -300, y: 0 }, player = { x: 0, y: 0 };
  fight.update(BUZZARD.introductionMs, boss, player, 18, health, quiet);
  assert.equal(fight.phase, 'circling');
  return fight;
}

/** Drive a dive frame by frame, moving the bird by its own steps. */
function runDive(fight, from, player, health = 1, hit = quiet) {
  const pos = { ...from };
  for (let i = 0; i < 400 && fight.phase === 'diving'; i++) {
    fight.update(16, pos, player, 18, health, hit);
    pos.x += fight.diveStep.x; pos.y += fight.diveStep.y;
  }
  return pos;
}

test('a fresh King Frankie encounter advances through its full arrival', () => {
  const earlierFight = circling();
  earlierFight.defeat();

  const fight = new BuzzardEncounter();
  const boss = { x: -300, y: 0 }, player = { x: 0, y: 0 };
  fight.update(BUZZARD.introductionMs - 1, boss, player, 18, 1, quiet);
  assert.equal(fight.phase, 'arrival');
  fight.update(1, boss, player, 18, 1, quiet);
  assert.equal(fight.phase, 'circling');
  assert.equal(fight.nextAttack, 'dive');
});

test('while circling he orbits the player, takes half damage and cannot body-check', () => {
  const fight = circling();
  const player = { x: 0, y: 0 };
  fight.update(500, { x: -300, y: 0 }, player, 18, 1, quiet);
  const t = fight.flyTarget;
  assert.ok(Math.abs(Math.hypot(t.x / BUZZARD.circleRadius, t.y / (BUZZARD.circleRadius * BUZZARD.circleSquash)) - 1) < 1e-6, 'aims for a point on his orbit');
  assert.ok(fight.airborne); assert.equal(fight.vulnerability, BUZZARD.airborneVulnerability);
});

test('his attacks run in order: dive, feather volley, dive, gust', () => {
  assert.deepEqual([...BUZZARD.attackOrder], ['dive', 'volley', 'dive', 'gust']);
  const fight = circling();
  assert.equal(fight.nextAttack, 'dive');
});

test('King Frankie catches up in the open woods before locking a new dive', () => {
  const fight = circling();
  const player = { x: 6000, y: -8000 };
  fight.update(BUZZARD.circleMs, { x: 5200, y: -8000 }, player, 18, 1, quiet);
  assert.equal(fight.phase, 'circling');
  assert.equal(fight.pursuing, true);
  assert.deepEqual(fight.flyTarget, player);

  fight.update(16, { x: 5600, y: -8000 }, player, 18, 1, quiet);
  assert.equal(fight.phase, 'diveWindup');
  assert.equal(fight.pursuing, false);
  assert.equal(fight.lane.length, 400 + BUZZARD.diveOvershoot);
});

test('a dive locks a shadow lane through the player, hits once, then he lands and is exposed', () => {
  const fight = circling(), boss = { x: -8300, y: 6000 }, player = { x: -8000, y: 6000 };
  fight.update(BUZZARD.circleMs, boss, player, 18, 1, quiet);
  assert.equal(fight.phase, 'diveWindup');
  assert.ok(fight.lane.direction.x > .99);
  assert.equal(fight.lane.length, 300 + BUZZARD.diveOvershoot);
  assert.deepEqual(fight.flyTarget, boss, 'stays aligned with the locked lane during the windup');
  fight.update(BUZZARD.diveWindupMs - 1, boss, { x: player.x, y: player.y + 300 }, 18, 1, quiet);
  assert.ok(fight.lane.direction.x > .99, 'moving during the windup does not re-aim it');
  fight.update(1, boss, player, 18, 1, quiet);
  assert.equal(fight.phase, 'diving');
  const blows = [];
  const end = runDive(fight, boss, player, 1, (d, push, k) => blows.push({ d, push, k }));
  assert.equal(blows.length, 1); assert.equal(blows[0].d, BUZZARD.diveDamage); assert.equal(blows[0].k, BUZZARD.diveKnockback);
  assert.ok(Math.abs(end.x - (player.x + BUZZARD.diveOvershoot)) < 1e-6, 'dives past the player without a boundary');
  assert.deepEqual(fight.flyTarget, end, 'the final dive step also defines the landing');
  assert.equal(fight.phase, 'perched');
  assert.ok(!fight.airborne); assert.equal(fight.vulnerability, BUZZARD.perchVulnerability);
  fight.update(BUZZARD.perchMs, end, player, 18, 1, quiet);
  assert.equal(fight.phase, 'circling', 'then he takes off again');
});

test('a player who steps out of the lane is missed', () => {
  const fight = circling(), boss = { x: -300, y: 0 };
  fight.update(BUZZARD.circleMs, boss, { x: 0, y: 0 }, 18, 1, quiet);
  fight.update(BUZZARD.diveWindupMs, boss, { x: 0, y: 0 }, 18, 1, quiet);
  let taken = 0;
  runDive(fight, boss, { x: 0, y: 120 }, 1, d => taken += d);
  assert.equal(taken, 0);
});

test('enraged, he dives twice before landing', () => {
  const fight = circling(.3), boss = { x: -300, y: 0 }, player = { x: 0, y: 0 };
  fight.update(BUZZARD.enragedCircleMs, boss, player, 18, .3, quiet);
  fight.update(BUZZARD.enragedDiveWindupMs, boss, player, 18, .3, quiet);
  let pos = runDive(fight, boss, player, .3);
  assert.equal(fight.phase, 'rising');
  fight.update(BUZZARD.diveGapMs, pos, player, 18, .3, quiet);
  assert.equal(fight.phase, 'diveWindup');
  fight.update(BUZZARD.enragedDiveWindupMs, pos, player, 18, .3, quiet);
  pos = runDive(fight, pos, player, .3);
  assert.equal(fight.phase, 'perched');
});

test('the feather volley fans out along its locked aim; enraged it is wider', () => {
  for (const [health, count] of [[1, BUZZARD.volleyFeathers], [.3, BUZZARD.enragedVolleyFeathers]]) {
    const fight = circling(health), boss = { x: -300, y: 0 }, player = { x: 0, y: 0 };
    const circle = health <= BUZZARD.enrageFraction ? BUZZARD.enragedCircleMs : BUZZARD.circleMs;
    fight.update(circle, boss, player, 18, health, quiet);
    fight.update(health <= BUZZARD.enrageFraction ? BUZZARD.enragedDiveWindupMs : BUZZARD.diveWindupMs, boss, player, 18, health, quiet);
    let pos = runDive(fight, boss, player, health);
    while (fight.phase !== 'perched') { fight.update(BUZZARD.diveGapMs, pos, player, 18, health, quiet); fight.update(BUZZARD.enragedDiveWindupMs, pos, player, 18, health, quiet); pos = runDive(fight, pos, player, health); }
    fight.update(health <= BUZZARD.enrageFraction ? BUZZARD.enragedPerchMs : BUZZARD.perchMs, pos, player, 18, health, quiet);
    fight.update(circle, pos, player, 18, health, quiet);
    assert.equal(fight.phase, 'volleyWindup');
    fight.update(BUZZARD.volleyWindupMs, pos, { x: 999, y: 999 }, 18, health, quiet);
    assert.equal(fight.volley.directions.length, count);
  }
});

test('the gust hurls a player caught in its cone, and misses one behind him', () => {
  assert.ok(inCone({ origin: { x: 0, y: 0 }, direction: { x: 1, y: 0 }, range: 400, halfAngle: .7 }, { x: 300, y: 0 }, 18));
  assert.ok(!inCone({ origin: { x: 0, y: 0 }, direction: { x: 1, y: 0 }, range: 400, halfAngle: .7 }, { x: -100, y: 0 }, 18));
  const fight = circling();
  // skip ahead to the gust: dive, volley and dive come first
  for (let i = 0; i < 3; i++) fight['attackIndex']++;
  const boss = { x: -300, y: 0 }, player = { x: 0, y: 0 };
  fight.update(BUZZARD.circleMs, boss, player, 18, 1, quiet);
  assert.equal(fight.phase, 'gustWindup');
  const blows = [];
  fight.update(BUZZARD.gustWindupMs, boss, player, 18, 1, (d, push, k) => blows.push({ d, push, k }));
  assert.equal(blows.length, 1); assert.equal(blows[0].k, BUZZARD.gustKnockback); assert.ok(blows[0].push.x > .99);
  assert.ok(fight.blown); assert.equal(fight.phase, 'circling');
});

test('defeat stops everything', () => {
  const fight = circling();
  fight.defeat();
  fight.update(10000, { x: 0, y: 0 }, { x: 0, y: 0 }, 18, 1, () => assert.fail('post-defeat hit'));
  assert.equal(fight.volley, undefined);
});
