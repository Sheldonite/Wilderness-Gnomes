const test = require('node:test'), assert = require('node:assert/strict');
const { GameManager } = require('../artifacts/ability-tests/game/core/GameManager.js');
const { UIManager } = require('../artifacts/ability-tests/game/ui/UIManager.js');

/** The HUD panel is now generic: it names whichever companion is bound to the wanderer. */
function mount(game) {
  const strip = { hidden: true, innerHTML: '' };
  const name = {}, rank = {}, detail = {};
  const elements = { '.build-strip': strip, '.companion-name': name, '.companion-rank': rank, '.companion-detail': detail };
  const ui = Object.create(UIManager.prototype);
  ui.gameManager = game;
  ui.root = { querySelector: selector => elements[selector] };
  ui.buildFingerprint = '';
  const snapshot = game.getHudSnapshot();
  ui.lastSnapshot = JSON.stringify(snapshot);
  return { ui, snapshot, strip, name, rank, detail };
}

test('the companion panel names the bound companion and its next growth level', () => {
  const game = new GameManager('spell', undefined, 'sheldon');
  const { ui, snapshot, name, rank, detail } = mount(game);
  ui.update(snapshot);
  assert.equal(name.textContent, 'FRANKIE');
  assert.equal(rank.textContent, 'Rank 0 · grows at level 3');
  assert.match(detail.textContent, /1 of 5 buzzard/);

  game.level = 6; game.syncCompanionToLevel();
  ui.update(snapshot);
  assert.equal(rank.textContent, 'Rank 2 · grows at level 9');
  assert.match(detail.textContent, /2 of 5 buzzards/);
});

test('Frankie feather damage still shows, and other wanderers show their own companion', () => {
  const game = new GameManager('spell', undefined, 'sheldon');
  const { ui, snapshot, detail } = mount(game);
  for (const bonus of [2, 8, 40]) {
    game.playerStats.frankieFeatherBonus = bonus;
    ui.update(snapshot);
    assert.match(detail.textContent, new RegExp(`\\+${bonus} feather damage$`));
  }
  const ron = new GameManager('spell', undefined, 'ron');
  const second = mount(ron);
  second.ui.update(second.snapshot);
  assert.equal(second.name.textContent, 'TOBIAS');
  assert.match(second.detail.textContent, /damage per dart/);
});
