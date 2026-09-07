// Isolate the old pair-by-pair collision work from the new combined crowd push.
const {performance}=require('node:perf_hooks');
const {EnemySeparation}=require('../artifacts/ability-tests/game/core/EnemySeparation.js');
const {SceneryNavigation}=require('../artifacts/ability-tests/game/core/SceneryNavigation.js');
for(const mode of ['before','after']) {
 const nav=new SceneryNavigation();nav.addCircle(2180,1800,42);
 const solver=new EnemySeparation(), samples=[];let moves=0;
 for(let frame=0;frame<240;frame++) {
  let points=Array.from({length:180},(_,i)=>nav.nearest({x:2230+Math.cos(i*2.4)*(8+i%15*2),y:1800+Math.sin(i*2.4)*(8+i%15*2)},15));
  const start=performance.now();
  if(mode==='before') {
   for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++) {
    const a=points[i],b=points[j],dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy);
    if(!d||d>34)continue;
    points[i]=nav.move(a,{x:a.x+dx/d*.45,y:a.y+dy/d*.45},15);
    points[j]=nav.move(b,{x:b.x-dx/d*.45,y:b.y-dy/d*.45},15);moves+=2;
   }
  } else {
   const offsets=solver.solve(points,34);
   points=points.map((p,i)=>{moves++;return nav.move(p,{x:p.x+offsets[i*2],y:p.y+offsets[i*2+1]},15);});
  }
  samples.push(performance.now()-start);
 }
 const sorted=[...samples].sort((a,b)=>a-b);
 console.log(JSON.stringify({mode,meanMs:samples.reduce((a,b)=>a+b)/samples.length,p95Ms:sorted[228],collisionMovesPerFrame:moves/240}));
}
