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

test('level 30 unlocks exactly one King', () => {
  const fight = new KingEncounter();
  assert.equal(KING.level, 30);
  assert.equal(fight.shouldSpawn(29), false); assert.equal(fight.shouldSpawn(30), true); assert.equal(fight.shouldSpawn(35), false);
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

/** A King still making his entrance, so only the ripples we give him are moving. */
function waiting() { const fight = new KingEncounter(); fight.shouldSpawn(KING.level); return fight; }

test('a wall strike sends a ripple that hurts once as it passes, except in the lane he rolled in on', () => {
  const cases = [
    [{ x: 486, y: -250 }, 1, 'beside the wall, out of the lane'],
    [{ x: -100, y: 0 }, 1, 'behind where the leg began'],
    [{ x: 300, y: 0 }, 0, 'in the middle of his trail'],
    [{ x: 200, y: 30 }, 0, 'just off-centre in his trail']
  ];
  for (const [player, expected, where] of cases) {
    const fight = waiting();
    fight.ripples.push({ origin: { x: 486, y: 0 }, from: { x: 0, y: 0 }, radius: 0, landed: false });
    const blows = [];
    for (let t = 0; t < 1600; t += 16) fight.update(16, { x: -300, y: 300 }, player, 18, 1, arena, (d, push, k) => blows.push({ d, push, k }));
    assert.equal(blows.length, expected, where);
    if (expected) {
      assert.equal(blows[0].d, KING.rippleDamage); assert.equal(blows[0].k, KING.rippleKnockback);
      const away = Math.atan2(player.y, player.x - 486), pushed = Math.atan2(blows[0].push.y, blows[0].push.x);
      assert.ok(Math.abs(away - pushed) < 1e-6, 'thrown outward from the wall');
    }
  }
});

test('every wall and tree he strikes sends out a ripple, and ripples fade away', () => {
  const fight = curled({ x: 0, y: 0 }, { x: 300, y: 0 });
  fight.update(KING.curlMs, { x: 0, y: 0 }, { x: 300, y: 0 }, 18, 1, arena, quiet);
  const pos = { x: 0, y: 0 }; let contacts = 0;
  for (let i = 0; i < 2000 && fight.phase === 'rolling'; i++) {
    fight.update(16, pos, { x: 5000, y: 5000 }, 18, 1, arena, quiet);
    pos.x += fight.rollStep.x; pos.y += fight.rollStep.y;
    for (const b of fight.bounces) {
      contacts++;
      assert.ok(fight.ripples.some(r => r.origin.x === b.x && r.origin.y === b.y && r.radius === 0), 'a fresh ripple at each strike');
    }
  }
  assert.equal(contacts, KING.bounces + 1);
  const first = fight.ripples[fight.ripples.length - 1];
  assert.ok(Math.abs(first.from.x - 486) < 1e-6 || Math.abs(first.from.x + 486) < 1e-6, 'its safe lane starts at the previous strike');
  fight.update(KING.rippleReach / KING.rippleSpeed * 1000 + 16, pos, { x: 5000, y: 5000 }, 18, 1, arena, quiet);
  assert.equal(fight.ripples.length, 0);
  const tree = curled({ x: 0, y: 0 }, { x: 300, y: 0 });
  tree.update(KING.curlMs, { x: 0, y: 0 }, { x: 300, y: 0 }, 18, 1, arena, quiet);
  tree.blocked({ x: 40, y: 0 });
  assert.deepEqual(tree.ripples.map(r => [r.origin.x, r.from.x]), [[40, 0]]);
  tree.defeat(); assert.equal(tree.ripples.length, 0);
});
