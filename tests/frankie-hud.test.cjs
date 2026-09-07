const test = require('node:test'), assert = require('node:assert/strict');
const { GameManager } = require('../artifacts/ability-tests/game/core/GameManager.js');
const { UIManager } = require('../artifacts/ability-tests/game/ui/UIManager.js');

test('Frankie bonus appears only when equipped and refreshes with an unchanged HUD snapshot', () => {
  const game = new GameManager();
  const strip = { hidden: true, innerHTML: '' };
  const ui = Object.create(UIManager.prototype);
  ui.gameManager = game;
  ui.root = { querySelector: () => strip };
  ui.buildFingerprint = '';
  const snapshot = game.getHudSnapshot();
  ui.lastSnapshot = JSON.stringify(snapshot);
  ui.update(snapshot);
  assert.equal(strip.hidden, true);
  assert.doesNotMatch(strip.innerHTML, /feather-bonus/);
  game.playerStats.hasFrankieCompanion = true;
  game.playerStats.frankieCount = 1;
  ui.update(snapshot);
  assert.equal(strip.hidden, false);
  assert.match(strip.innerHTML, /class="feather-bonus">\+0 feather damage/);
  for (const bonus of [2, 8, 40]) {
    game.playerStats.frankieFeatherBonus = bonus;
    ui.update(snapshot);
    assert.ok(strip.innerHTML.includes(`class="feather-bonus">+${bonus} feather damage`));
  }
});
