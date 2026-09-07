const test = require('node:test');
const assert = require('node:assert/strict');
const { StagEncounter } = require('../artifacts/ability-tests/game/core/StagEncounter.js');
const { STAG } = require('../artifacts/ability-tests/game/config/stagBoss.js');
const boss = { x: 1600, y: 1600 }, player = { x: 1900, y: 1600 };
const quiet = () => {};

function ready(health = 1) {
  const fight = new StagEncounter(); fight.shouldSpawn(15);
  fight.update(STAG.introductionMs, boss, player, 18, health, quiet);
  fight.update(900, boss, player, 18, health, quiet);
  return fight;
}

/** Drive a charge frame by frame, moving the boss by the encounter's own steps. */
function runCharge(fight, from, target, radius, hit, frameMs = 16, health = 1) {
  const pos = { ...from };
  for (let i = 0; i < 400 && fight.phase === 'charging'; i++) {
    fight.update(frameMs, pos, target, radius, health, hit);
    pos.x += fight.chargeStep.x; pos.y += fight.chargeStep.y;
  }
  return pos;
}

test('level fifteen unlocks exactly one stag, including skipped levels and new runs', () => {
  const fight = new StagEncounter();
  for (let i = 1; i < 15; i++) assert.equal(fight.shouldSpawn(i), false);
  assert.equal(fight.shouldSpawn(15), true); assert.equal(fight.shouldSpawn(16), false);
  fight.defeat(); assert.equal(fight.shouldSpawn(20), false);
  assert.equal(new StagEncounter().shouldSpawn(17), true);
});

test('the stag locks its lane at windup and only charges after the windup ends', () => {
  const fight = ready();
  assert.equal(fight.phase, 'windup');
  assert.ok(fight.lane); assert.deepEqual(fight.lane.from, boss);
  assert.ok(fight.lane.direction.x > .99, 'aimed at the player');
  const locked = { ...fight.lane.direction };
  fight.update(STAG.windupMs - 1, boss, { x: 1600, y: 1900 }, 18, 1, quiet);
  assert.equal(fight.phase, 'windup'); assert.deepEqual(fight.lane.direction, locked, 'the player moving does not re-aim it');
  fight.update(1, boss, player, 18, 1, quiet);
  assert.equal(fight.phase, 'charging');
});

test('a charge hits a player standing in the lane once, and misses one who stepped out', () => {
  for (const [where, expected] of [[player, STAG.chargeDamage], [{ x: 1900, y: 1600 + STAG.radius + 18 + 30 }, 0]]) {
    const fight = ready(); fight.update(STAG.windupMs, boss, player, 18, 1, quiet);
    let taken = 0, pushes = [];
    const end = runCharge(fight, boss, where, 18, (d, push) => { taken += d; pushes.push(push); });
    assert.equal(fight.phase, 'recovering');
    assert.ok(Math.abs(end.x - boss.x - STAG.chargeDistance) < 1, 'ran the full lane');
    // the stomp at the far end is out of reach of both players here
    assert.equal(taken, expected);
    if (expected) assert.ok(pushes[0].x > .99, 'thrown along the lane');
  }
});

test('the stomp where the charge ends hurts anyone close, and a blocked charge stomps early', () => {
  const fight = ready(); fight.update(STAG.windupMs, boss, player, 18, 1, quiet);
  const landing = { x: boss.x + STAG.chargeDistance, y: boss.y };
  const bystander = { x: landing.x + STAG.stompRadius - 10, y: landing.y + 60 };
  let taken = 0;
  runCharge(fight, boss, bystander, 18, d => taken += d);
  assert.equal(taken, STAG.stompDamage);
  assert.equal(fight.impacts.length, 1);
  const wall = ready(); wall.update(STAG.windupMs, boss, player, 18, 1, quiet);
  wall.update(16, boss, player, 18, 1, quiet);
  let stomp = 0;
  wall.blocked({ x: boss.x + 40, y: boss.y }, { x: boss.x + 80, y: boss.y }, 18, d => stomp += d);
  assert.equal(wall.phase, 'recovering'); assert.equal(stomp, STAG.stompDamage);
});

test('below half health the stag winds up faster and charges twice before resting', () => {
  const fight = ready(.4);
  assert.ok(fight.enraged);
  fight.update(STAG.enragedWindupMs, boss, player, 18, .4, quiet);
  assert.equal(fight.phase, 'charging');
  const end = runCharge(fight, boss, { x: 0, y: 0 }, 18, quiet, 16, .4);
  assert.equal(fight.phase, 'recovering');
  fight.update(STAG.recoverMs, end, player, 18, .4, quiet);
  assert.equal(fight.phase, 'windup', 'a second charge follows immediately');
  fight.update(STAG.enragedWindupMs, end, player, 18, .4, quiet);
  const end2 = runCharge(fight, end, { x: 0, y: 0 }, 18, quiet, 16, .4);
  fight.update(STAG.recoverMs, end2, player, 18, .4, quiet);
  assert.equal(fight.phase, 'stalking', 'then it rests');
  const calm = ready(1); calm.update(STAG.windupMs, boss, player, 18, 1, quiet);
  const e = runCharge(calm, boss, { x: 0, y: 0 }, 18, quiet);
  calm.update(STAG.recoverMs, e, player, 18, 1, quiet);
  assert.equal(calm.phase, 'stalking', 'one charge per cycle while healthy');
});

test('defeat clears the lane and steps and stops the encounter', () => {
  const fight = ready(); fight.update(STAG.windupMs, boss, player, 18, 1, quiet);
  fight.update(16, boss, player, 18, 1, quiet);
  fight.defeat();
  assert.equal(fight.lane, undefined); assert.deepEqual(fight.chargeStep, { x: 0, y: 0 });
  let taken = 0;
  fight.update(5000, boss, player, 18, 1, d => taken += d);
  assert.equal(taken, 0); assert.equal(fight.phase, 'charging', 'frozen where it was');
});
