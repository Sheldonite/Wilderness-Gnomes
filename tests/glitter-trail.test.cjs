const test=require('node:test'), assert=require('node:assert/strict');
const {GlitterTrail}=require('../artifacts/ability-tests/game/core/GlitterTrail.js');

test('glitter is spaced by travel, remains behind, and fades while stationary',()=>{
  const trail=new GlitterTrail();
  trail.update(16,{x:0,y:0},true);
  trail.update(100,{x:24,y:0},true);
  assert.equal(trail.sparks.length,8);
  assert.ok(trail.sparks.every(s=>s.x>=6&&s.x<=24));
  const positions=trail.sparks.map(({x,y})=>({x,y}));
  trail.update(100,{x:24,y:0},true);
  assert.deepEqual(trail.sparks.map(({x,y})=>({x,y})),positions);
  trail.update(900,{x:24,y:0},true);
  assert.equal(trail.sparks.length,0);
});

test('glitter has a bounded count and clears on teleport or unequip',()=>{
  const trail=new GlitterTrail();
  for(let i=0;i<100;i++)trail.update(1,{x:i*20,y:0},true);
  assert.ok(trail.sparks.length>0&&trail.sparks.length<=80);
  trail.update(16,{x:5000,y:0},true);
  assert.equal(trail.sparks.length,0);
  trail.update(16,{x:5012,y:0},true);
  assert.ok(trail.sparks.length>0);
  trail.update(16,{x:5012,y:0},false);
  assert.equal(trail.sparks.length,0);
  trail.update(16,{x:8000,y:0},true);
  assert.equal(trail.sparks.length,0);
});
