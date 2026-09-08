const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PLAYER_CHARACTERS } = require('../artifacts/ability-tests/game/config/playerCharacters.js');
const { RON_DIRECTIONS } = require('../artifacts/ability-tests/game/core/RonFrames.js');

test('Ron has a distinct unmirrored walk and matching stopped facing in every direction', () => {
  const ron = PLAYER_CHARACTERS.ron;
  const vectors = [[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[-1,1]];
  vectors.forEach(([x,y],i) => {
    const direction={x:x/Math.hypot(x,y),y:y/Math.hypot(x,y)};
    assert.deepEqual(ron.animationForDirection(direction),{key:`ron-walk-${RON_DIRECTIONS[i]}`});
    assert.deepEqual(ron.idleForDirection(direction),{key:`ron-idle-${RON_DIRECTIONS[i]}`});
  });
  assert.equal(ron.bakedAnimation,true,'the controller must not distort baked frames');
  assert.equal(ron.footOriginY,238/256);
});
