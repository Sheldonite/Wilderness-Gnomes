const test = require('node:test'), assert = require('node:assert/strict');
const { MarketProgress, MARKET_STORAGE_KEY, parseMarketProfile } = require('../artifacts/ability-tests/game/core/MarketProgress.js');
const { RareRockDrops, RARE_ROCKS } = require('../artifacts/ability-tests/game/core/RareRockDrops.js');
const player = { x: 1000, y: 1000 };
const clearGround = { blocked: () => false, clear: () => true };
function storage() { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) }; }

test('existing gold saves gain an empty rock wallet without losing purchases or receipts', () => {
  const old = { version: 1, gold: 20, ranks: { 'trail-boots': 1 }, settledRuns: ['old-run'] };
  const parsed = parseMarketProfile(JSON.stringify(old));
  assert.equal(parsed.rocks, 0); assert.deepEqual(parsed.collectedRocks, []);
  assert.equal(parsed.gold, 20); assert.deepEqual(parsed.ranks, old.ranks); assert.deepEqual(parsed.settledRuns, old.settledRuns);
  for (const rocks of [-1, 1.5, '10']) assert.equal(parseMarketProfile(JSON.stringify({ ...old, rocks })), null);
});

test('rocks save at pickup, survive reloads and gold transactions, and cannot pay twice', () => {
  const saved = storage(), wallet = new MarketProgress(saved);
  assert.deepEqual(wallet.collectRock('run:rock:1'), { balance: 1, saved: true, awarded: true });
  const reloaded = new MarketProgress(saved);
  assert.equal(reloaded.profile.rocks, 1);
  assert.equal(reloaded.collectRock('run:rock:1').awarded, false);
  reloaded.settleRun('run', 20); reloaded.purchase('trail-boots');
  assert.equal(new MarketProgress(saved).profile.rocks, 1);
  assert.equal(new MarketProgress(saved).collectRock('next-run:rock:1').balance, 2);
  const snapshot = reloaded.profile; snapshot.collectedRocks.push('fake');
  assert.ok(!reloaded.profile.collectedRocks.includes('fake'));
});

test('save failures retain rocks in session, report failure, and retry without duplication', () => {
  const saved = storage(); let failing = true;
  const wallet = new MarketProgress({ getItem: saved.getItem, setItem: (k, v) => { if (failing) throw Error('blocked'); saved.setItem(k, v); } });
  assert.equal(wallet.collectRock('rock').saved, false); assert.equal(wallet.profile.rocks, 1);
  failing = false;
  assert.deepEqual(wallet.collectRock('rock'), { balance: 1, saved: true, awarded: false });
  assert.equal(new MarketProgress(saved).profile.rocks, 1);
  assert.equal(new MarketProgress(null).collectRock('preview').saved, false);
});

test('rare spawn rolls wait for active play and can fail; blocked land never receives rocks', () => {
  let rolls = 0;
  const drops = new RareRockDrops(clearGround, () => { rolls++; return 0; });
  drops.update(90000, player, false); assert.equal(rolls, 0);
  drops.update(RARE_ROCKS.rollMs - 1, player, true); assert.equal(rolls, 0);
  assert.ok(drops.update(1, player, true)); assert.equal(drops.rocks.length, 1);
  assert.equal(new RareRockDrops(clearGround, () => .9).update(45000, player, true), undefined);
  const blocked = new RareRockDrops({ ...clearGround, blocked: () => true }, () => 0);
  assert.equal(blocked.spawnNear(player), undefined);
  const unreachable = new RareRockDrops({ ...clearGround, clear: () => false }, () => 0);
  assert.equal(unreachable.spawnNear(player), undefined);
});

test('rocks require proximity, collect once, stay on the ground, and cap active spawns', () => {
  let sequence = 0;
  const drops = new RareRockDrops(clearGround, () => ((sequence++ * .37) % 1));
  for (let i = 0; i < 10; i++) drops.spawnNear(player);
  assert.equal(drops.rocks.length, 3);
  assert.equal(drops.collectNearby(player), undefined);
  const rock = drops.rocks[0];
  drops.update(999999, player, false); assert.equal(drops.rocks.length, 3);
  assert.equal(drops.collectNearby(rock.position).id, rock.id);
  assert.equal(drops.collectNearby(rock.position), undefined);
  assert.equal(new RareRockDrops(clearGround).rocks.length, 0);
});
