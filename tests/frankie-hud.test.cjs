const test = require('node:test'), assert = require('node:assert/strict');
const { GameManager } = require('../artifacts/ability-tests/game/core/GameManager.js');
const { UIManager } = require('../artifacts/ability-tests/game/ui/UIManager.js');

/** The HUD panel is now generic: it names whichever companion is bound to the wanderer. */
function mount(game) {
  const name = {}, rank = {}, detail = {}, pips = { innerHTML: '' }, badge = { title: '' };
  const elements = { '.companion-name': name, '.companion-rank': rank, '.companion-detail': detail, '.companion-pips': pips, '.companion-badge': badge };
  const ui = Object.create(UIManager.prototype);
  ui.gameManager = game;
  ui.root = { querySelector: selector => elements[selector] };
  ui.buildFingerprint = '';
  const snapshot = game.getHudSnapshot();
  ui.lastSnapshot = JSON.stringify(snapshot);
  return { ui, snapshot, name, rank, detail, pips, badge };
}

test('the companion badge names the bound companion, shows its rank as dots, and its next growth level', () => {
  const game = new GameManager('spell', undefined, 'sheldon');
  const { ui, snapshot, name, rank, detail, pips, badge } = mount(game);
  ui.update(snapshot);
  assert.equal(name.textContent, 'Frankie');
  assert.equal((pips.innerHTML.match(/<i/g) || []).length, 10);
  assert.equal((pips.innerHTML.match(/class="on"/g) || []).length, 0);
  assert.equal(rank.textContent, 'Rank 0 · grows at level 3');
  assert.match(detail.textContent, /1 of 5 buzzard/);

  game.level = 6; game.syncCompanionToLevel();
  ui.update(snapshot);
  assert.equal(rank.textContent, 'Rank 2 · grows at level 9');
  assert.match(detail.textContent, /2 of 5 buzzards/);
  assert.equal((pips.innerHTML.match(/class="on"/g) || []).length, 2);
  assert.match(badge.title, /Frankie · Rank 2/);
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
  assert.equal(second.name.textContent, 'Tobias');
  assert.match(second.detail.textContent, /damage per dart/);
});
