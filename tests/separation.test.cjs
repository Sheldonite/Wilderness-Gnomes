const test=require('node:test'),assert=require('node:assert/strict');
const {EnemySeparation}=require('../artifacts/ability-tests/game/core/EnemySeparation.js');
const {SceneryNavigation}=require('../artifacts/ability-tests/game/core/SceneryNavigation.js');
test('spatial separation matches pairwise forces, including across cell boundaries',()=>{
 const points=Array.from({length:180},(_,i)=>({x:1000+Math.cos(i*2.4)*(i%20)*3,y:1000+Math.sin(i*2.4)*(i%20)*3}));
 const result=new EnemySeparation().solve(points,34), reference=new Float64Array(360);
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
 const dx=points[i].x-points[j].x,dy=points[i].y-points[j].y,d=Math.hypot(dx,dy);if(!d||d>34)continue;
 reference[i*2]+=dx/d*.45;reference[i*2+1]+=dy/d*.45;reference[j*2]-=dx/d*.45;reference[j*2+1]-=dy/d*.45;
 }
 for(let i=0;i<reference.length;i++)assert.ok(Math.abs(reference[i]-result[i])<1e-8);
});
test('combined crowd pressure remains collision checked and buffers reset between frames',()=>{
 const nav=new SceneryNavigation(false);nav.addCircle(500,500,40);
 const points=[{x:550,y:500},{x:555,y:500},{x:560,y:500}], solver=new EnemySeparation();
 const offsets=solver.solve(points,34);
 points.forEach((p,i)=>assert.ok(!nav.blocked(nav.move(p,{x:p.x+offsets[i*2],y:p.y+offsets[i*2+1]},10),10)));
 assert.equal(solver.solve([{x:10,y:10}],34)[0],0);
});
