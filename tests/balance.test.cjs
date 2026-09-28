const test = require('node:test');
const assert = require('node:assert/strict');
const { BALANCE } = require('../artifacts/ability-tests/game/config/balance.js');
const { RunEvents, ringCount, ringPositions, stampedeLane, stampedeStarts } = require('../artifacts/ability-tests/game/core/RunEvents.js');
const { BossGate, scaledBossHealth } = require('../artifacts/ability-tests/game/core/BossGate.js');
const { GameManager } = require('../artifacts/ability-tests/game/core/GameManager.js');
const { UpgradeSystem } = require('../artifacts/ability-tests/game/systems/UpgradeSystem.js');

test('set pieces arrive on schedule, and a long gap never stacks a backlog', () => {
  const events = new RunEvents(), E = BALANCE.events;
  assert.deepEqual(events.update(BALANCE.elite.firstMs - 1, 2), []);
  assert.deepEqual(events.update(1, 2), [{ kind: 'elite' }]);
  assert.deepEqual(events.update(E.ringFirstMs - BALANCE.elite.firstMs, 3), [{ kind: 'ring', count: ringCount(3) }]);
  assert.deepEqual(events.update(E.stampedeFirstMs - E.ringFirstMs, 4).find(e => e.kind === 'stampede'), { kind: 'stampede', lanes: 1 });
  const late = new RunEvents().update(60 * 60000, 12);
  assert.equal(late.length, 3, 'one of each at most');
  assert.deepEqual(late.find(e => e.kind === 'stampede'), { kind: 'stampede', lanes: 2 });
});

test('rings grow with the clock up to a cap, and surround their center evenly', () => {
  assert.equal(ringCount(0), BALANCE.events.ringBase);
  assert.ok(ringCount(5) > ringCount(0));
  assert.equal(ringCount(1000), BALANCE.events.ringMax);
  const points = ringPositions({ x: 100, y: 100 }, 8, 50);
  assert.equal(points.length, 8);
  for (const p of points) assert.ok(Math.abs(Math.hypot(p.x - 100, p.y - 100) - 50) < 1e-9);
});

test('a stampede lane is centred on its target and the herd queues behind its start', () => {
  const lane = stampedeLane({ x: 1000, y: 1000 }, 0, 1500);
  assert.deepEqual(lane.from, { x: 250, y: 1000 });
  const starts = stampedeStarts(lane, 3, 60);
  assert.deepEqual(starts, [{ x: 250, y: 1000 }, { x: 190, y: 1000 }, { x: 130, y: 1000 }]);
});

test('boss health scales with the run clock', () => {
  assert.equal(scaledBossHealth(1000, 100, 0), 1000);
  assert.equal(scaledBossHealth(1000, 100, 7.5), 1750);
  assert.equal(scaledBossHealth(1000, 100, -3), 1000);
});

test('four bosses gate the run in order, and the last one wins it', () => {
  const gate = new BossGate();
  assert.equal(gate.required(30), 'oven'); gate.defeat('oven');
  assert.equal(gate.required(30), 'stag'); gate.defeat('stag');
  assert.equal(gate.required(24), undefined);
  assert.equal(gate.required(25), 'buzzard'); gate.defeat('buzzard');
  assert.equal(gate.required(29), undefined);
  assert.equal(gate.required(30), 'king'); assert.ok(!gate.allDefeated);
  gate.defeat('king'); assert.ok(gate.allDefeated); assert.equal(gate.required(40), undefined);
});

test('Split Charm stops being offered after its pick limit', () => {
  const game = new GameManager(), upgrades = new UpgradeSystem();
  const split = () => upgrades.getAvailable(game.playerStats).find(u => u.id === 'projectile-count');
  const start = game.playerStats.projectileCount;
  for (let i = 0; i < BALANCE.leveling.maxSplitPicks; i++) upgrades.applyUpgrade(split(), game.playerStats);
  assert.equal(game.playerStats.projectileCount, start + BALANCE.leveling.maxSplitPicks);
  assert.equal(split(), undefined);
  for (let i = 0; i < 200; i++) assert.ok(!upgrades.getChoices(game.playerStats).some(u => u.id === 'projectile-count'));
});

test('a slow hinders movement for its duration, and the strongest slow wins', () => {
  const game = new GameManager();
  game.slowPlayer(1000, .5);
  assert.equal(game.playerStats.moveSlow, .5); assert.ok(game.playerSlowed);
  game.slowPlayer(200, .8);
  game.update(999); assert.equal(game.playerStats.moveSlow, .5);
  game.update(1); assert.equal(game.playerStats.moveSlow, 1); assert.ok(!game.playerSlowed);
});

test('a won run can be finished from the victory screen', () => {
  const game = new GameManager();
  game.victorious = true; game.pause(); game.finishRun();
  assert.equal(game.state, 'GameOver');
});
