// Run node tests/run.cjs first. Optional argument: a saved older compiled navigation module.
const { performance } = require('node:perf_hooks');
const path = require('node:path');
const current = require('../artifacts/ability-tests/game/core/SceneryNavigation.js');
function measure(label, module) {
  const runs=[];
  for(let trial=0;trial<5;trial++) {
    const nav=new module.SceneryNavigation();
    for(let i=0;i<100;i++)nav.addCircle(150+(i%10)*290,150+Math.floor(i/10)*290,28);
    const points=Array.from({length:180},(_,i)=>nav.nearest({x:400+(i%18)*150,y:400+Math.floor(i/18)*240},15));
    const routes=points.map(()=>module.createNavigationRoute?.());
    const setup=performance.now();nav.prepare?.(15);const setupMs=performance.now()-setup;
    const samples=[];
    for(let frame=0;frame<240;frame++) {
      const start=performance.now();
      const goal={x:1600+Math.sin(frame/80)*260,y:1600+Math.cos(frame/90)*140};
      for(let i=0;i<points.length;i++)points[i]=nav.toward(points[i],goal,1.5,15,routes[i]);
      samples.push(performance.now()-start);
    }
    const sorted=[...samples].sort((a,b)=>a-b);
    runs.push({setupMs,meanMs:samples.reduce((a,b)=>a+b)/samples.length,p95Ms:sorted[228],maxMs:sorted.at(-1)});
  }
  const median=key=>runs.map(r=>r[key]).sort((a,b)=>a-b)[2];
  console.log(JSON.stringify({label,enemies:180,frames:240,trials:5,setupMs:median('setupMs'),meanMs:median('meanMs'),p95Ms:median('p95Ms'),maxMs:median('maxMs')}));
}
if(process.argv[2])measure('before',require(path.resolve(process.argv[2])));
measure('after',current);
