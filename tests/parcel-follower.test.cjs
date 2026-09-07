const test=require('node:test'),assert=require('node:assert/strict');
const {ParcelFollower}=require('../artifacts/ability-tests/game/core/ParcelFollower.js');

test('parcel follows footsteps around a corner and settles behind the player',()=>{
  const buddy=new ParcelFollower();
  buddy.update(16,{x:0,y:0},true);
  for(let x=4;x<=80;x+=4)buddy.update(16,{x,y:0},true);
  for(let y=4;y<=80;y+=4){
    buddy.update(16,{x:80,y},true);
    assert.ok(buddy.position.y===0 || Math.abs(buddy.position.x-80)<.001,'must turn at the corner');
  }
  for(let i=0;i<100;i++)buddy.update(16,{x:80,y:80},true);
  assert.ok(Math.abs(buddy.position.x-80)<.001);
  assert.ok(Math.abs(buddy.position.y-32)<.001);
  assert.equal(buddy.moving,false);
  const stride=buddy.stride;
  buddy.update(100,{x:80,y:80},true);
  assert.equal(buddy.stride,stride);
});

test('parcel resets after unequipping or teleporting and does not walk with zero elapsed time',()=>{
  const buddy=new ParcelFollower();
  buddy.update(16,{x:0,y:0},true);
  buddy.update(0,{x:100,y:0},true);
  assert.deepEqual(buddy.position,{x:0,y:0});
  buddy.update(16,{x:2000,y:900},true);
  assert.deepEqual(buddy.position,{x:2000,y:900});
  buddy.update(16,{x:2000,y:900},false);
  buddy.update(16,{x:4000,y:1900},true);
  assert.deepEqual(buddy.position,{x:4000,y:1900});
  assert.equal(buddy.moving,false);
});
