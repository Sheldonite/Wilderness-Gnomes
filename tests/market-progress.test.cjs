const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MarketProgress, MARKET_STORAGE_KEY, MARKET_CORRUPT_BACKUP_KEY, goldForLevel, emptyMarketProfile,
  parseMarketProfile, marketBonuses
} = require('../artifacts/ability-tests/game/core/MarketProgress.js');
const { GameManager } = require('../artifacts/ability-tests/game/core/GameManager.js');
const {
  MARKET_ITEMS, MARKET_VENDORS, marketItemPrice, marketItemBenefit
} = require('../artifacts/ability-tests/game/config/marketItems.js');

function memoryStorage(profile) {
  const data = new Map(profile ? [[MARKET_STORAGE_KEY, JSON.stringify(profile)]] : []);
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    data
  };
}

function fundedProfile(gold = 100) { return { ...emptyMarketProfile(), gold }; }

test('run gold uses milestone totals and one gold for every level above 20', () => {
  for (const [level, expected] of [[1, 0], [9, 0], [10, 5], [19, 5], [20, 10], [21, 11], [30, 20]]) {
    assert.equal(goldForLevel(level), expected, `level ${level}`);
  }
  assert.equal(goldForLevel(20.9), 10);
  for (const invalid of [NaN, Infinity, -Infinity, -20]) assert.equal(goldForLevel(invalid), 0);
});

test('settlement persists one receipt per run, including zero-gold runs', () => {
  const storage = memoryStorage();
  const market = new MarketProgress(storage);
  assert.deepEqual(market.settleRun('first-run', 20), {
    status: 'awarded', goldEarned: 10, balance: 10, saved: true, storageStatus: 'ready'
  });
  assert.equal(market.settleRun('first-run', 99).status, 'already-settled');
  assert.equal(market.profile.gold, 10);
  assert.equal(market.settleRun('short-run', 3).goldEarned, 0);
  const reloaded = new MarketProgress(storage);
  assert.equal(reloaded.settleRun('short-run', 30).status, 'already-settled');
  assert.equal(reloaded.settleRun('first-run', 20).status, 'already-settled');
  assert.equal(reloaded.settleRun('next-run', 21).goldEarned, 11);
  assert.equal(reloaded.profile.gold, 21);
});

test('invalid run IDs and levels cannot create receipts or mint gold', () => {
  const market = new MarketProgress(memoryStorage());
  for (const [id, level] of [['', 20], [' ', 20], ['x'.repeat(161), 20], ['valid', NaN], ['valid', Infinity], ['valid', 0]]) {
    assert.equal(market.settleRun(id, level).status, 'invalid-run');
  }
  assert.deepEqual(market.profile, emptyMarketProfile());
});

test('a purchase charges the next rank price and persists the item and balance together', () => {
  const storage = memoryStorage(fundedProfile(15));
  const market = new MarketProgress(storage);
  assert.equal(market.purchase('embersteel-edge').cost, 5);
  assert.equal(market.purchase('embersteel-edge').cost, 10);
  const profile = new MarketProgress(storage).profile;
  assert.equal(profile.gold, 0);
  assert.equal(profile.ranks['embersteel-edge'], 2);
  const rejected = market.purchase('embersteel-edge');
  assert.equal(rejected.status, 'insufficient-gold');
  assert.equal(rejected.cost, 18);
  assert.deepEqual(market.profile, profile);
});

test('unknown items and capped ranks cannot spend gold, including the premium projectile', () => {
  const market = new MarketProgress(memoryStorage(fundedProfile()));
  assert.equal(market.purchase('boss-crownfire').status, 'unknown-item');
  assert.equal(market.purchase('__proto__').status, 'unknown-item');
  assert.equal(market.purchase('splitshot-charm').status, 'purchased');
  assert.equal(market.profile.gold, 80);
  assert.equal(market.purchase('splitshot-charm').status, 'max-rank');
  assert.equal(market.profile.gold, 80);
  for (let rank = 0; rank < 3; rank++) assert.equal(market.purchase('trail-boots').status, 'purchased');
  const balance = market.profile.gold;
  assert.equal(market.purchase('trail-boots').status, 'max-rank');
  assert.equal(market.profile.gold, balance);
});

test('two market instances refresh storage before buying or settling', () => {
  const storage = memoryStorage(fundedProfile(5));
  const first = new MarketProgress(storage);
  const stale = new MarketProgress(storage);
  assert.equal(first.purchase('peach-heart').status, 'purchased');
  assert.equal(stale.purchase('trail-boots').status, 'insufficient-gold');
  assert.equal(stale.profile.ranks['peach-heart'], 1);
  assert.equal(first.settleRun('shared-run', 20).goldEarned, 10);
  assert.equal(stale.settleRun('shared-run', 20).status, 'already-settled');
  assert.equal(stale.profile.gold, 10);
});

test('profile copies cannot mutate the wallet, purchase ranks, or settlement receipts', () => {
  const market = new MarketProgress(memoryStorage(fundedProfile(5)));
  const copy = market.profile;
  copy.gold = 500;
  copy.ranks['splitshot-charm'] = 1;
  copy.settledRuns.push('invented-run');
  assert.equal(market.profile.gold, 5);
  assert.deepEqual(market.profile.ranks, { 'unlock-hailey': 1, 'unlock-sheldon': 1, 'unlock-ron': 1 });
  assert.deepEqual(market.profile.settledRuns, []);
});

test('malformed, unsupported, unsafe, and over-cap saves fail validation explicitly', () => {
  const invalid = [
    '{broken', 'null', '[]',
    JSON.stringify({ ...emptyMarketProfile(), version: 2 }),
    JSON.stringify({ ...emptyMarketProfile(), gold: -1 }),
    JSON.stringify({ ...emptyMarketProfile(), gold: 1.5 }),
    JSON.stringify({ ...emptyMarketProfile(), gold: Number.MAX_SAFE_INTEGER + 1 }),
    JSON.stringify({ ...emptyMarketProfile(), ranks: { 'splitshot-charm': 2 } }),
    JSON.stringify({ ...emptyMarketProfile(), ranks: { 'peach-heart': -1 } }),
    JSON.stringify({ ...emptyMarketProfile(), ranks: { 'boss-crownfire': 1 } }),
    JSON.stringify({ ...emptyMarketProfile(), settledRuns: ['a', 'a'] })
  ];
  for (const serialized of invalid) {
    assert.equal(parseMarketProfile(serialized), null);
    const storage = memoryStorage();
    storage.setItem(MARKET_STORAGE_KEY, serialized);
    const market = new MarketProgress(storage);
    assert.equal(market.storageStatus, 'corrupt');
    assert.equal(market.profile.gold, 0);
    assert.equal(market.purchase('peach-heart').status, 'insufficient-gold');
    assert.equal(storage.getItem(MARKET_STORAGE_KEY), serialized, 'read/rejected purchase preserves the old save');
  }
});

test('unavailable storage retains usable session gold and explicit unsaved results', () => {
  for (const storage of [null, { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }]) {
    const market = new MarketProgress(storage);
    assert.equal(market.storageStatus, 'unavailable');
    const award = market.settleRun('offline', 20);
    assert.equal(award.saved, false);
    assert.equal(award.storageStatus, 'unavailable');
    assert.equal(market.purchase('peach-heart').status, 'purchased');
    assert.equal(market.profile.gold, 5);
    assert.equal(market.profile.ranks['peach-heart'], 1);
    assert.equal(market.settleRun('offline', 20).status, 'already-settled');
    assert.equal(market.profile.gold, 5);
  }
});

test('settling even a zero-gold run preserves a corrupt or future-version save before replacement', () => {
  for (const raw of ['{broken but recoverable', JSON.stringify({ ...fundedProfile(81), version: 2 })]) {
    const storage = memoryStorage();
    storage.setItem(MARKET_STORAGE_KEY, raw);
    const writes = [];
    const originalSet = storage.setItem;
    storage.setItem = (key, value) => { writes.push(key); originalSet(key, value); };
    const market = new MarketProgress(storage);
    const result = market.settleRun('new-short-run', 1);
    assert.equal(result.goldEarned, 0);
    assert.equal(result.saved, true);
    assert.equal(storage.getItem(MARKET_CORRUPT_BACKUP_KEY), raw);
    assert.deepEqual(writes, [MARKET_CORRUPT_BACKUP_KEY, MARKET_STORAGE_KEY]);
    assert.equal(new MarketProgress(storage).settleRun('new-short-run', 20).status, 'already-settled');
  }
});

test('a failed corrupt-save backup leaves the original untouched and can safely recover session progress', () => {
  const storage = memoryStorage();
  const raw = JSON.stringify({ ...fundedProfile(81), version: 2 });
  storage.setItem(MARKET_STORAGE_KEY, raw);
  const originalSet = storage.setItem;
  let blockBackup = true;
  storage.setItem = (key, value) => {
    if (blockBackup && key.startsWith(MARKET_CORRUPT_BACKUP_KEY)) throw new Error('backup quota');
    originalSet(key, value);
  };
  const market = new MarketProgress(storage);
  const award = market.settleRun('recovery-run', 20);
  assert.equal(award.saved, false);
  assert.equal(award.storageStatus, 'unavailable');
  assert.equal(market.purchase('peach-heart').status, 'purchased');
  assert.equal(market.profile.gold, 5);
  assert.equal(storage.getItem(MARKET_STORAGE_KEY), raw, 'failed backup must never replace the original');
  assert.equal(storage.getItem(MARKET_CORRUPT_BACKUP_KEY), null);
  blockBackup = false;
  assert.equal(market.settleRun('recovery-run', 20).saved, true);
  assert.equal(storage.getItem(MARKET_CORRUPT_BACKUP_KEY), raw);
  assert.deepEqual(new MarketProgress(storage).profile, market.profile);
  assert.equal(market.profile.gold, 5, 'retry does not award the run twice');
});

test('successive different corrupt saves preserve earlier backups', () => {
  const storage = memoryStorage();
  storage.setItem(MARKET_STORAGE_KEY, '{first broken save');
  new MarketProgress(storage).settleRun('one', 10);
  storage.setItem(MARKET_STORAGE_KEY, '{second broken save');
  new MarketProgress(storage).settleRun('two', 20);
  const backups = [...storage.data.entries()].filter(([key]) => key.startsWith(MARKET_CORRUPT_BACKUP_KEY));
  assert.equal(backups.length, 2);
  assert.equal(storage.getItem(MARKET_CORRUPT_BACKUP_KEY), '{first broken save');
  assert.deepEqual(new Set(backups.map(([, raw]) => raw)), new Set(['{first broken save', '{second broken save']));
});

test('temporary save failure can recover without losing session purchases or duplicating reward', () => {
  const storage = memoryStorage();
  let blocked = true;
  const originalSet = storage.setItem;
  storage.setItem = (key, value) => { if (blocked) throw new Error('quota'); originalSet(key, value); };
  const market = new MarketProgress(storage);
  assert.equal(market.settleRun('recovery', 20).saved, false);
  assert.equal(market.purchase('peach-heart').saved, false);
  blocked = false;
  const retry = market.settleRun('recovery', 20);
  assert.equal(retry.status, 'already-settled');
  assert.equal(retry.saved, true);
  assert.equal(retry.balance, 5);
  assert.deepEqual(new MarketProgress(storage).profile, market.profile);
});

test('market has four distinct trades with priced and described inventory', () => {
  assert.equal(MARKET_VENDORS.length, 4);
  assert.equal(new Set(MARKET_VENDORS.map(vendor => vendor.id)).size, 4);
  assert.equal(MARKET_ITEMS.length, 17);
  assert.equal(new Set(MARKET_ITEMS.map(item => item.id)).size, 17);
  for (const vendor of MARKET_VENDORS) assert.ok(MARKET_ITEMS.some(item => item.vendorId === vendor.id));
  for (const item of MARKET_ITEMS) {
    assert.ok(item.name && item.description && item.effect && item.icon);
    assert.equal(item.prices.length, item.maxRank);
    assert.ok(item.maxRank >= 1 && item.maxRank <= 3);
    for (let rank = 0; rank < item.maxRank; rank++) {
      assert.ok(Number.isSafeInteger(item.prices[rank]) && item.prices[rank] >= 5);
      assert.equal(marketItemPrice(item.id, rank), item.prices[rank]);
      // Wanderers are always owned, so their listing has no "after this purchase" state to differ.
      if (item.kind !== 'character') assert.notEqual(marketItemBenefit(item.id, rank), marketItemBenefit(item.id, rank + 1));
    }
    assert.equal(marketItemPrice(item.id, item.maxRank), null);
  }
});

test('new runs apply every purchased bonus without granting boss abilities or companions', () => {
  const profile = emptyMarketProfile();
  for (const item of MARKET_ITEMS) profile.ranks[item.id] = item.maxRank;
  for (const weapon of ['spell', 'crossbow']) {
    const base = new GameManager(weapon);
    const upgraded = new GameManager(weapon, profile);
    const stats = upgraded.playerStats;
    assert.equal(stats.maxHealth, base.playerStats.maxHealth + 45);
    assert.equal(stats.health, stats.maxHealth);
    assert.equal(stats.speed, base.playerStats.speed * 1.15);
    assert.equal(stats.projectileDamage, base.playerStats.projectileDamage * 1.3);
    assert.equal(stats.weaponCooldownMs, base.playerStats.weaponCooldownMs * 0.85);
    assert.equal(stats.projectileCount, base.playerStats.projectileCount + 1);
    assert.equal(stats.mysteryDamage, base.playerStats.mysteryDamage * 1.45);
    // Nick always travels with Mystery; no purchase can add anyone else's companion.
    assert.equal(stats.hasMysteryCompanion, true);
    assert.equal(stats.hasMidnightCompanion, false);
    assert.equal(stats.hasFrankieCompanion, false);
    assert.equal(stats.hasTobiasCompanion, false);
    assert.deepEqual(stats.bossAbilityRanks, { crownfire: 0, stormcall: 0, 'phoenix-heart': 0 });
    assert.ok(Object.values(stats.abilityRanks).every(rank => rank === 0));
    assert.notEqual(base.runId, upgraded.runId);
  }
});

test('market purchases affect the next run only and pure bonuses defensively cap input', () => {
  const market = new MarketProgress(memoryStorage(fundedProfile(25)));
  const old = new GameManager('spell', market.profile);
  market.purchase('peach-heart');
  market.purchase('splitshot-charm');
  const next = new GameManager('spell', market.profile);
  assert.equal(old.playerStats.maxHealth, 100);
  assert.equal(next.playerStats.maxHealth, 115);
  assert.equal(next.playerStats.projectileCount, old.playerStats.projectileCount + 1);
  const bonuses = marketBonuses({ ranks: { 'splitshot-charm': 999, 'quilted-cloak': 999, 'peach-heart': -1 } });
  assert.equal(bonuses.extraProjectiles, 1);
  assert.equal(bonuses.damageTakenMultiplier, 0.85);
  assert.equal(bonuses.extraHealth, 0);
});

test('purchased cloak reduces actual damage and tonic heals only while playing, capped at maximum', () => {
  const profile = { ...emptyMarketProfile(), ranks: { 'quilted-cloak': 3, 'springwater-flask': 2 } };
  const game = new GameManager('spell', profile);
  game.damagePlayer(20);
  assert.equal(game.playerStats.health, 83);
  game.update(5000);
  assert.equal(game.playerStats.health, 85);
  game.pause();
  game.update(5000);
  assert.equal(game.playerStats.health, 85);
  game.resume();
  game.playerStats.health = 99;
  game.update(5000);
  assert.equal(game.playerStats.health, 100);
  game.damagePlayer(1000);
  assert.equal(game.state, 'GameOver');
  game.update(5000);
  assert.equal(game.playerStats.health, 0);
});


test('every wanderer is free from the start, while the crossbow is still bought once', () => {
  const storage = memoryStorage(fundedProfile(75)), market = new MarketProgress(storage);
  for (const id of ['wizard', 'hailey', 'sheldon', 'ron']) assert.equal(market.characterUnlocked(id), true, id);
  assert.equal(market.characterUnlocked('stranger'), false);
  assert.equal(market.weaponUnlocked('spell'), true);
  assert.equal(market.weaponUnlocked('crossbow'), false);
  // Nobody can be sold twice, so the roster costs nothing and the wallet is untouched.
  for (const id of ['unlock-hailey', 'unlock-sheldon', 'unlock-ron']) assert.equal(market.purchase(id).status, 'max-rank', id);
  assert.equal(market.profile.gold, 75);
  assert.equal(market.purchase('unlock-crossbow').status, 'purchased');
  const reloaded = new MarketProgress(storage);
  assert.equal(reloaded.weaponUnlocked('crossbow'), true);
  assert.equal(reloaded.characterUnlocked('ron'), true);
  assert.equal(reloaded.profile.gold, 60);
});

test('old saves retain their free roster, weapons, rocks, purchases and receipts', () => {
  const old = { version:1, gold:8, rocks:3, collectedRocks:['rock'], ranks:{'trail-boots':2}, settledRuns:['run'] };
  const market = new MarketProgress(memoryStorage(old));
  assert.equal(market.characterUnlocked('hailey'), true);
  assert.equal(market.weaponUnlocked('crossbow'), true);
  assert.equal(market.profile.ranks['trail-boots'], 2);
  assert.equal(market.profile.rocks, 3);
  assert.equal(market.profile.gold, 8);
  market.purchase('honey-glow');
  assert.equal(market.profile.shopVersion, 2);
  assert.deepEqual(market.profile.settledRuns, ['run']);
});

test('cosmetics require ownership, equip one at a time, persist, and never change combat stats', () => {
  const storage = memoryStorage(fundedProfile(20)), market = new MarketProgress(storage);
  const base = marketBonuses(market.profile);
  assert.equal(market.equipCosmetic('honey-glow'), false);
  assert.equal(market.equipCosmetic('trail-boots'), false);
  market.purchase('honey-glow'); market.purchase('violet-glow');
  assert.equal(market.equipCosmetic('honey-glow'), true);
  assert.equal(new MarketProgress(storage).profile.equippedCosmetic, 'honey-glow');
  market.equipCosmetic('violet-glow');
  assert.equal(new MarketProgress(storage).profile.equippedCosmetic, 'violet-glow');
  assert.deepEqual(marketBonuses(market.profile), base);
  market.equipCosmetic(null);
  assert.equal(new MarketProgress(storage).profile.equippedCosmetic, null);
  assert.equal(market.profile.gold, 10);
  assert.equal(parseMarketProfile(JSON.stringify({...emptyMarketProfile(), equippedCosmetic:'violet-glow'})), null);
});

test('booth categories match their actual goods and moving goods preserves old bonuses', () => {
  assert.deepEqual(MARKET_VENDORS.map(v=>v.name), ['Weapons','Cosmetics','Upgrades','Staffing Company']);
  assert.ok(MARKET_ITEMS.filter(i=>i.vendorId==='outfitter').every(i=>i.kind==='cosmetic'));
  assert.ok(MARKET_ITEMS.filter(i=>i.vendorId==='curios').every(i=>i.kind==='character'));
  assert.ok(MARKET_ITEMS.filter(i=>i.vendorId==='apothecary').every(i=>!i.kind));
  assert.equal(marketBonuses({ranks:{'trail-boots':2}}).speedMultiplier, 1.1);
});


test('weapon equipment requires ownership, survives reload, and can switch back for free', () => {
  const storage=memoryStorage(fundedProfile(20)), market=new MarketProgress(storage);
  assert.equal(market.equippedWeapon, 'spell');
  assert.equal(market.equipWeapon('crossbow'), false);
  assert.equal(market.equipWeapon('unknown'), false);
  market.purchase('unlock-crossbow');
  assert.equal(market.equipWeapon('crossbow'), true);
  assert.equal(new MarketProgress(storage).equippedWeapon, 'crossbow');
  assert.equal(market.profile.gold, 5);
  assert.equal(market.equipWeapon('spell'), true);
  assert.equal(new MarketProgress(storage).equippedWeapon, 'spell');
  assert.equal(market.profile.gold, 5);
  const prior=market.profile; delete prior.equippedWeapon;
  assert.equal(parseMarketProfile(JSON.stringify(prior)).equippedWeapon, 'spell');
  assert.equal(parseMarketProfile(JSON.stringify({...emptyMarketProfile(),equippedWeapon:'crossbow'})), null);
});


test('glitter trail can be bought, equipped and reloaded without changing combat bonuses', () => {
  const storage=memoryStorage(fundedProfile(10)), market=new MarketProgress(storage);
  const bonuses=marketBonuses(market.profile);
  assert.equal(market.equipCosmetic('glitter-trail'),false);
  assert.equal(market.purchase('glitter-trail').status,'purchased');
  assert.equal(market.equipCosmetic('glitter-trail'),true);
  assert.equal(new MarketProgress(storage).equippedCosmetic,'glitter-trail');
  assert.deepEqual(marketBonuses(market.profile),bonuses);
  assert.equal(market.profile.gold,5);
});


test('UPS Buddy is a saved cosmetic and grants no combat bonuses or fighting companions', () => {
  const storage=memoryStorage(fundedProfile(10)), market=new MarketProgress(storage);
  const base=marketBonuses(market.profile);
  assert.equal(market.equipCosmetic('ups-buddy'),false);
  assert.equal(market.purchase('ups-buddy').status,'purchased');
  assert.equal(market.equipCosmetic('ups-buddy'),true);
  const loaded=new MarketProgress(storage);
  assert.equal(loaded.equippedCosmetic,'ups-buddy');
  assert.equal(loaded.profile.gold,5);
  assert.deepEqual(marketBonuses(loaded.profile),base);
  const game=new GameManager('spell',loaded.profile);
  assert.equal(game.playerStats.hasMysteryCompanion,true);
  assert.equal(game.playerStats.hasMidnightCompanion,false);
  assert.equal(game.playerStats.hasFrankieCompanion,false);
});


test('the Staffing Company shows the whole roster as already hired and charges nothing', () => {
  const storage=memoryStorage(fundedProfile(55)), market=new MarketProgress(storage);
  for (const id of ['hailey','sheldon','ron']) {
    const listing=MARKET_ITEMS.find(item=>item.id===`unlock-${id}`);
    assert.equal(listing.vendorId,'curios');
    assert.equal(listing.kind,'character');
    assert.equal(market.characterUnlocked(id),true,id);
    assert.equal(market.purchase(listing.id).status,'max-rank',id);
  }
  assert.equal(market.profile.gold,55,'the roster costs nothing');
  const reloaded=new MarketProgress(storage);
  assert.equal(reloaded.characterUnlocked('sheldon'),true);
  assert.equal(reloaded.profile.gold,55);
  // A save that never paid for anyone still gets the full roster.
  const old={version:1,gold:20,ranks:{},settledRuns:[]};
  const migrated=new MarketProgress(memoryStorage(old));
  for (const id of ['wizard','hailey','sheldon','ron']) assert.equal(migrated.characterUnlocked(id),true,id);
  assert.equal(migrated.profile.gold,20);
});


test('Jawa Buddy is a permanent cosmetic purchase that does not change combat', () => {
  const storage=memoryStorage(fundedProfile(10)), market=new MarketProgress(storage);
  const before=marketBonuses(market.profile);
  assert.equal(market.equipCosmetic('jawa-buddy'),false);
  assert.equal(market.purchase('jawa-buddy').status,'purchased');
  assert.equal(market.equipCosmetic('jawa-buddy'),true);
  const loaded=new MarketProgress(storage);
  assert.equal(loaded.equippedCosmetic,'jawa-buddy');
  assert.equal(loaded.profile.gold,5);
  assert.deepEqual(marketBonuses(loaded.profile),before);
  assert.equal(loaded.purchase('jawa-buddy').status,'max-rank');
  loaded.equipCosmetic(null);
  assert.equal(new MarketProgress(storage).equippedCosmetic,null);
});
