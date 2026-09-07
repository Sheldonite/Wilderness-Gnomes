const test = require('node:test'), assert = require('node:assert/strict');
const { GameManager } = require('../artifacts/ability-tests/game/core/GameManager.js');
const { UIManager } = require('../artifacts/ability-tests/game/ui/UIManager.js');

test('Frankie bonus appears only when equipped and refreshes with an unchanged HUD snapshot', () => {
  const game = new GameManager();
  const strip = { hidden: true, innerHTML: '' };
  const panel = { hidden: true }, bonusText = {}, totalText = {};
  const elements = { '.build-strip': strip, '.frankie-hud': panel, '.frankie-bonus': bonusText, '.frankie-total': totalText };
  const ui = Object.create(UIManager.prototype);
  ui.gameManager = game;
  ui.root = { querySelector: selector => elements[selector] };
  ui.buildFingerprint = '';
  const snapshot = game.getHudSnapshot();
  ui.lastSnapshot = JSON.stringify(snapshot);
  ui.update(snapshot);
  assert.equal(strip.hidden, true);
  assert.equal(panel.hidden, true);
  game.playerStats.hasFrankieCompanion = true;
  game.playerStats.frankieCount = 1;
  ui.update(snapshot);
  assert.equal(strip.hidden, false);
  assert.equal(panel.hidden, false);
  assert.equal(bonusText.textContent, '+0 feather damage');
  for (const bonus of [2, 8, 40]) {
    game.playerStats.frankieFeatherBonus = bonus;
    ui.update(snapshot);
    assert.equal(bonusText.textContent, `+${bonus} feather damage`);
    assert.equal(totalText.textContent, `${14 + bonus} damage / hit per bird`);
  }
  game.playerStats.hasFrankieCompanion = false;
  ui.update(snapshot);
  assert.equal(panel.hidden, true);
});
