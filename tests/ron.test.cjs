const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GameManager } = require('../artifacts/ability-tests/game/core/GameManager.js');
const { UpgradeSystem } = require('../artifacts/ability-tests/game/systems/UpgradeSystem.js');
const { AbilitySimulation } = require('../artifacts/ability-tests/game/core/AbilitySimulation.js');
const { ABILITIES, CHARACTER_ONLY_ABILITIES, abilityAllowed, describeAbility } = require('../artifacts/ability-tests/game/config/abilities.js');
const { PLAYER_CHARACTERS } = require('../artifacts/ability-tests/game/config/playerCharacters.js');

const RON_ABILITIES = ['ribbon-sweep', 'inspiring-shout', 'dizzying-flurry'];
let nextId = 0;
function foe(x, y, health = 100000) {
  return { id: ++nextId, position: { x, y }, radius: 15, health, isDead: false, slowMultiplier: 1,
    takeDamage(amount) { this.health -= amount; this.isDead = this.health <= 0; return this.isDead; },
    displace(dx, dy) { this.position = { x: this.position.x + dx, y: this.position.y + dy }; } };
}
const damage = (enemy, amount) => enemy.takeDamage(amount);
const origin = { x: 0, y: 0 };

/** Run the simulation long enough for a cooldown to come due. */
function run(sim, ms, position, enemies, step = 16) {
  for (let elapsed = 0; elapsed < ms; elapsed += step) sim.update(step, position, enemies, [], damage);
}

test('Ron is a playable wanderer carrying Tobias', () => {
  assert.equal(PLAYER_CHARACTERS.ron.name, 'Ron');
  assert.equal(PLAYER_CHARACTERS.ron.companionId, 'tobias');
  assert.equal(new GameManager('spell', undefined, 'ron').playerStats.characterId, 'ron');
});

test('the three performance skills belong to Ron and to nobody else', () => {
  const upgrades = new UpgradeSystem();
  for (const id of RON_ABILITIES) {
    assert.equal(CHARACTER_ONLY_ABILITIES[id], 'ron');
    assert.equal(abilityAllowed(id, 'ron'), true);
    assert.equal(abilityAllowed(id, 'wizard'), false);
  }
  const ron = new GameManager('spell', undefined, 'ron').playerStats;
  for (const id of RON_ABILITIES) assert.ok(upgrades.getAvailable(ron).some(c => c.id === id), id);
  // Ron cannot learn the skills that command the other wanderers' companions.
  assert.ok(!upgrades.getAvailable(ron).some(c => c.id === 'mystery-double-pounce'));
  assert.ok(!upgrades.getAvailable(ron).some(c => c.id === 'midnight-mighty-swat'));
  for (const character of ['wizard', 'hailey', 'sheldon']) {
    const other = new GameManager('spell', undefined, character).playerStats;
    for (const id of RON_ABILITIES) assert.ok(!upgrades.getAvailable(other).some(c => c.id === id), `${character}/${id}`);
  }
});

test('every rank of every performance skill has a real description', () => {
  for (const id of RON_ABILITIES) {
    for (let rank = 1; rank <= 10; rank++) {
      const text = describeAbility(id, rank);
      assert.ok(typeof text === 'string' && text.length > 20, `${id} rank ${rank}: ${text}`);
      assert.ok(!text.includes('undefined'), `${id} rank ${rank}: ${text}`);
      assert.ok(!text.includes('NaN'), `${id} rank ${rank}: ${text}`);
    }
  }
});

test('Ribbon Sweep hits and throws back foes in its arc, and spares those behind Ron', () => {
  const stats = new GameManager('spell', undefined, 'ron').playerStats;
  stats.abilityRanks['ribbon-sweep'] = 1;
  const sim = new AbilitySimulation(stats);
  const ahead = foe(120, 0);
  const behind = foe(-190, 0);
  sim.sync(origin);
  run(sim, ABILITIES.ribbon.cooldownMs + 40, origin, [ahead, behind]);
  assert.ok(ahead.health < 100000, 'the nearest foe was swept');
  assert.ok(ahead.position.x > 120, 'and thrown outward');
  assert.equal(behind.health, 100000, 'a foe on the far side was missed');
  assert.ok(sim.ribbons.length > 0, 'the arc is exposed for the renderer');
});

test('the awakened ribbon whirls the whole way around and strikes a second time', () => {
  const stats = new GameManager('spell', undefined, 'ron').playerStats;
  stats.abilityRanks['ribbon-sweep'] = 5;
  const sim = new AbilitySimulation(stats);
  const behind = foe(-150, 0);
  // A rooted foe cannot be thrown clear, so it is still standing there when the echo lands.
  const rooted = foe(100, 0); delete rooted.displace;
  sim.sync(origin);
  run(sim, ABILITIES.ribbon.cooldownMs + 40, origin, [rooted, behind]);
  assert.ok(behind.health < 100000, 'a full circle catches foes behind him too');
  assert.ok(behind.position.x < -150, 'and still throws them outward');
  const afterFirst = rooted.health;
  assert.ok(afterFirst < 100000, 'the first pass landed');
  run(sim, ABILITIES.ribbon.cyclone[0].echoMs + 60, origin, [rooted, behind]);
  assert.ok(rooted.health < afterFirst, 'the echo strikes again shortly after');
  assert.ok(sim.ribbons.some(arc => arc.echo), 'the echo is drawn as its own arc');
});

test('Inspiring Shout quickens Ron for its duration, then wears off', () => {
  const stats = new GameManager('spell', undefined, 'ron').playerStats;
  stats.abilityRanks['inspiring-shout'] = 3;
  const sim = new AbilitySimulation(stats);
  sim.sync(origin);
  assert.equal(stats.shoutAttackSpeedBonus, 0);
  run(sim, ABILITIES.shout.cooldownMs + 40, origin, []);
  assert.equal(stats.shoutAttackSpeedBonus, ABILITIES.shout.attackSpeed[3]);
  assert.equal(stats.shoutMoveSpeedBonus, ABILITIES.shout.moveSpeed[3]);
  run(sim, ABILITIES.shout.durationMs + 100, origin, []);
  assert.equal(stats.shoutAttackSpeedBonus, 0, 'the rally ends');
  assert.equal(stats.shoutMoveSpeedBonus, 0);
});

test('the awakened shout blasts nearby foes and mends Ron while it lasts', () => {
  const stats = new GameManager('spell', undefined, 'ron').playerStats;
  stats.abilityRanks['inspiring-shout'] = 5;
  const sim = new AbilitySimulation(stats);
  const near = foe(100, 0);
  sim.sync(origin);
  run(sim, ABILITIES.shout.cooldownMs + 40, origin, [near]);
  assert.ok(near.health < 100000, 'the opening note damages foes');
  assert.equal(sim.shoutRings.length, 1);
  run(sim, 2000, origin, [near]);
  assert.ok(sim.pendingHeal > 0, 'the song heals over time');
});

test('Dizzying Flurry beats on everything close by for the length of the spin', () => {
  const stats = new GameManager('spell', undefined, 'ron').playerStats;
  stats.abilityRanks['dizzying-flurry'] = 2;
  const sim = new AbilitySimulation(stats);
  const close = foe(60, 0);
  const far = foe(900, 0);
  sim.sync(origin);
  run(sim, ABILITIES.flurry.cooldownMs + ABILITIES.flurry.durationMs, origin, [close, far]);
  const dealt = 100000 - close.health;
  assert.ok(dealt >= ABILITIES.flurry.damage[2] * 4, `several ticks landed (${dealt})`);
  assert.equal(far.health, 100000, 'a distant foe is untouched');
});

test('the awakened vortex drags foes inward and slows them', () => {
  const stats = new GameManager('spell', undefined, 'ron').playerStats;
  stats.abilityRanks['dizzying-flurry'] = 5;
  const sim = new AbilitySimulation(stats);
  const caught = foe(120, 0);
  sim.sync(origin);
  run(sim, ABILITIES.flurry.cooldownMs + 40, origin, [caught]);
  const before = caught.position.x;
  run(sim, 400, origin, [caught]);
  assert.ok(caught.position.x < before, `pulled inward (${caught.position.x} < ${before})`);
  assert.ok(caught.slowMultiplier < 1, 'and slowed while inside the spin');
});
