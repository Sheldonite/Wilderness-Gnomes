const test = require('node:test');
const assert = require('node:assert/strict');
const { OvenWalk } = require('../artifacts/ability-tests/game/core/OvenWalk.js');

test('oven alternates boots, plants them at rest, and faces its travel direction', () => {
  const walk = new OvenWalk();
  assert.equal(walk.update(0,0),2);
  assert.equal(walk.update(-6,0),0); assert.equal(walk.flipX,false);
  assert.equal(walk.update(-6,0),2);
  assert.equal(walk.update(-12,0),3);
  assert.equal(walk.update(-12,0),2);
  assert.equal(walk.update(12,0),0); assert.equal(walk.flipX,true);
  assert.equal(walk.update(0,0),2);
});

test('oven stride depends on actual travel, so slow, paused and blocked movement do not skate', () => {
  const coarse = new OvenWalk(), fine = new OvenWalk();
  let a,b;
  for(let i=0;i<5;i++)a=coarse.update(6,0);
  for(let i=0;i<30;i++)b=fine.update(1,0);
  assert.equal(a,b);
  for(let i=0;i<60;i++)assert.equal(fine.update(0,0),2);
  assert.equal(coarse.update(1,0),fine.update(1,0));
});
