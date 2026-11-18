const test = require('node:test');
const assert = require('node:assert/strict');
const { KingEncounter } = require('../artifacts/ability-tests/game/core/KingEncounter.js');
const { KING } = require('../artifacts/ability-tests/game/config/kingBoss.js');
const quiet = () => {};
const boss = { x: 3190, y: -3500 }, player = { x: 3490, y: -3500 };

function curled(health = 1) {
  const fight = new KingEncounter();
  fight.update(KING.introductionMs, boss, player, 18, health, quiet);
  fight.update(1000, boss, player, 18, health, quiet);
  assert.equal(fight.phase, 'curling');
  return fight;
}

function step(fight, ms, pos, target, health = 1, hit = quiet) {
  fight.update(ms, pos, target, 18, health, hit);
  pos.x += fight.rollStep.x;
  pos.y += fight.rollStep.y;
}

test('the King locks each lane and pauses to telegraph his first turn beyond the former world edge', () => {
  const fight = curled();
  const pos = { ...boss };
  assert.deepEqual(fight.lane.direction, { x: 1, y: 0 });
  assert.equal(fight.lane.length, 300 + KING.rollOvershoot);
  const above = { x: boss.x, y: boss.y - 300 };
  step(fight, KING.curlMs, pos, above);
  assert.equal(fight.phase, 'rolling');
  assert.deepEqual(fight.lane.direction, { x: 1, y: 0 });
  step(fight, 2000, pos, above);
  const firstTurn = { x: boss.x + 300 + KING.rollOvershoot, y: boss.y };
  assert.deepEqual(pos, firstTurn);
  assert.deepEqual(fight.impact, firstTurn);
  assert.equal(fight.phase, 'turning');
  assert.ok(fight.lane.direction.x < 0 && fight.lane.direction.y < 0);
  const turn = fight.lane;
  step(fight, KING.turnWindupMs - 1, pos, player);
  assert.equal(fight.phase, 'turning');
  assert.deepEqual(pos, firstTurn);
  assert.equal(fight.lane, turn);
  step(fight, 1, pos, player);
  assert.equal(fight.phase, 'rolling');
});

test('rolls hit once per leg and finish with the existing dizzy window and shards', () => {
  for (const health of [1, .3]) {
    const fight = curled(health);
    const enraged = health < KING.enrageFraction;
    const pos = { ...boss };
    step(fight, enraged ? KING.enragedCurlMs : KING.curlMs, pos, player, health);
    const impacts = [];
    let rollHits = 0;
    for (let frame = 0; frame < 800 && fight.phase !== 'dizzy'; frame++) {
      const incoming = fight.lane;
      step(fight, 16, pos, player, health, damage => {
        if (damage === KING.rollDamage) rollHits++;
      });
      if (fight.impact) {
        impacts.push(fight.impact);
        assert.ok(Math.hypot(pos.x - fight.impact.x, pos.y - fight.impact.y) < 1e-7);
        const ripple = fight.ripples.at(-1);
        assert.equal(ripple.radius, 0);
        assert.deepEqual(ripple.origin, fight.impact);
        assert.equal(ripple.from, incoming.from);
      }
    }
    const legs = enraged ? KING.enragedRollLegs : KING.rollLegs;
    assert.equal(impacts.length, legs);
    assert.equal(rollHits, legs);
    assert.equal(fight.phase, 'dizzy');
    assert.ok(fight.vulnerable);
    assert.equal(fight.shards.directions.length, enraged ? KING.enragedShardCount : KING.shardCount);
    step(fight, KING.dizzyMs, pos, player, health);
    assert.equal(fight.phase, 'stalking');
    assert.equal(fight.vulnerable, false);
    step(fight, KING.rippleReach / KING.rippleSpeed * 1000, pos, player, health);
    assert.equal(fight.ripples.length, 0);
  }
});

test('the king waits for an attackable distance and defeat clears the lane and ripples', () => {
  const fight = new KingEncounter();
  const far = { x: boss.x + 1100, y: boss.y };
  fight.update(KING.introductionMs, boss, far, 18, 1, quiet);
  fight.update(1600, boss, far, 18, 1, quiet);
  assert.equal(fight.phase, 'stalking');
  fight.update(16, boss, player, 18, 1, quiet);
  assert.equal(fight.phase, 'curling');
  const pos = { ...boss };
  step(fight, KING.curlMs, pos, player);
  step(fight, 2000, pos, player);
  fight.defeat();
  fight.update(1000, pos, player, 18, 1, () => assert.fail('post-defeat hit'));
  assert.equal(fight.lane, undefined);
  assert.deepEqual(fight.rollStep, { x: 0, y: 0 });
  assert.equal(fight.ripples.length, 0);
});

test('the royal guard arrives once per threshold', () => {
  const fight = curled();
  fight.update(16, boss, player, 18, .5, quiet);
  assert.equal(fight.pendingAdds, KING.addsPerWave);
  fight.update(16, boss, player, 18, .1, quiet);
  assert.equal(fight.pendingAdds, KING.addsPerWave * 2);
});

test('a ripple hits once as it passes, except in the lane he rolled in on', () => {
  const cases = [
    [{ x: 486, y: -250 }, 1, 'beside the impact, out of the lane'],
    [{ x: -100, y: 0 }, 1, 'behind where the leg began'],
    [{ x: 300, y: 0 }, 0, 'in the middle of his trail'],
    [{ x: 200, y: 30 }, 0, 'just off-centre in his trail']
  ];
  for (const [target, expected, where] of cases) {
    const fight = new KingEncounter();
    fight.ripples.push({ origin: { x: 486, y: 0 }, from: { x: 0, y: 0 }, radius: 0, landed: false });
    const blows = [];
    for (let t = 0; t < 1600; t += 16) {
      fight.update(16, boss, target, 18, 1, (damage, push, distance) => blows.push({ damage, push, distance }));
    }
    assert.equal(blows.length, expected, where);
    if (expected) {
      const [blow] = blows;
      assert.equal(blow.damage, KING.rippleDamage);
      assert.equal(blow.distance, KING.rippleKnockback);
      const away = Math.atan2(target.y, target.x - 486), pushed = Math.atan2(blow.push.y, blow.push.x);
      assert.ok(Math.abs(away - pushed) < 1e-6, 'thrown outward from the impact');
    }
  }
});
