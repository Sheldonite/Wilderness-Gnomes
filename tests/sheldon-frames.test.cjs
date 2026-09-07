const test = require('node:test');
const assert = require('node:assert/strict');
const { SHELDON_DIRECTIONS, SHELDON_FRAMES, sheldonDirection, sheldonAnimation } = require('../artifacts/ability-tests/game/core/SheldonFrames.js');

test('Sheldon has separate idle and walking sequences for all eight movement directions', () => {
 const vectors=[[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[-1,1]];
 assert.equal(new Set(vectors.map(v=>sheldonAnimation({x:v[0],y:v[1]}).key)).size,8);
 for(let i=0;i<8;i++) {
  const v={x:vectors[i][0],y:vectors[i][1]}, d=SHELDON_DIRECTIONS[i];
  assert.equal(sheldonDirection(v),d);
  assert.equal(sheldonAnimation(v,true).key,`sheldon-idle-${d}`);
  assert.equal(sheldonAnimation(v).key,`sheldon-walk-${d}`);
 }
});

test('Sheldon atlas addresses all 96 frames without overlap or gaps', () => {
 assert.equal(SHELDON_FRAMES.length,96);
 assert.equal(new Set(SHELDON_FRAMES.map(f=>f.id)).size,96);
 assert.deepEqual(SHELDON_FRAMES.map(f=>f.index),Array.from({length:96},(_,i)=>i));
 for(const d of SHELDON_DIRECTIONS) {
  const frames=SHELDON_FRAMES.filter(f=>f.direction===d);
  assert.deepEqual(frames.filter(f=>f.kind==='idle').map(f=>f.animationFrame),[0,1,2,3]);
  assert.deepEqual(frames.filter(f=>f.kind==='walk').map(f=>f.animationFrame),[0,1,2,3,4,5,6,7]);
 }
});

test('direction sectors remain stable with normalized movement and a south-facing default', () => {
 assert.equal(sheldonDirection({x:0,y:0}),'south');
 assert.equal(sheldonDirection({x:.707,y:-.707}),'northeast');
 assert.equal(sheldonDirection({x:-.707,y:.707}),'southwest');
 assert.equal(sheldonDirection({x:.02,y:-1}),'north');
 assert.equal(sheldonDirection({x:-1,y:.01}),'west');
});
