const test = require('node:test');
const assert = require('node:assert/strict');
const { SceneryNavigation, createNavigationRoute, riverX, pathY } = require('../artifacts/ability-tests/game/core/SceneryNavigation.js');
const { MidnightBehavior } = require('../artifacts/ability-tests/game/core/MidnightBehavior.js');

function follow(nav, start, target, radius = 12, limit = 3000) {
  let p = start;
  const route = createNavigationRoute();
  for (let i = 0; i < limit && Math.hypot(p.x - target.x, p.y - target.y) > 2; i++) {
    const next = nav.toward(p, target, 6, radius, route);
    assert.ok(!nav.blocked(next, radius), `blocked at ${JSON.stringify(next)}`);
    assert.ok(nav.clear(p, next, radius), 'route must not cut through an obstacle');
    assert.ok(Math.hypot(next.x - p.x, next.y - p.y) <= 6.001);
    p = next;
  }
  assert.ok(Math.hypot(p.x - target.x, p.y - target.y) <= 2, `route stuck at ${JSON.stringify(p)}`);
}

test('swept movement cannot tunnel through a rock, slides along it, and respects arena edges', () => {
  const nav = new SceneryNavigation(false); nav.addCircle(500, 500, 50);
  const p = nav.move({x:300,y:500}, {x:700,y:500}, 12);
  assert.ok(p.x <= 438 && p.x >= 433);
  const slide = nav.move(p, {x:p.x+30,y:540}, 12);
  assert.equal(p.y,500, 'collision resolution must not mutate the previous position');
  assert.ok(slide.y > p.y && !nav.blocked(slide,12));
  assert.ok(nav.move({x:20,y:20},{x:-100,y:-100},12).x >= 12);
});

test('cached routes still collide and replan when a target moves behind an obstacle', () => {
  const nav = new SceneryNavigation(false), route = createNavigationRoute();
  nav.addCircle(500,500,50); nav.prepare(12);
  let p = {x:350,y:440};
  p = nav.toward(p,{x:680,y:440},4,12,route);
  for(let i=0;i<300;i++) {
    const next=nav.toward(p,{x:680,y:500},4,12,route);
    assert.ok(nav.clear(p,next,12));p=next;
  }
  assert.ok(Math.hypot(p.x-680,p.y-500)<2);
  nav.addCircle(650,500,30);
  const next=nav.toward(p,{x:550,y:500},4,12,route);
  assert.ok(!nav.blocked(next,12));
});

test('river bank collisions stay exact across the entire river, including bends', () => {
  const nav=new SceneryNavigation();
  for(let y=100;y<3100;y+=31) {
    if(Math.abs(y-pathY(riverX(y)))<100)continue;
    for(const side of [-1,1])assert.ok(nav.blocked({x:riverX(y)+side*65,y},12));
  }
});

test('reusing a route avoids full route checks on every movement frame', () => {
  const nav=new SceneryNavigation(false), route=createNavigationRoute();
  let checks=0;const clear=nav.clear.bind(nav);nav.clear=(...args)=>{checks++;return clear(...args);};
  let p={x:300,y:300};
  for(let i=0;i<120;i++)p=nav.toward(p,{x:1200,y:300},1.5,12,route);
  assert.ok(checks<10,`${checks} full-route checks`);
  assert.equal(p.x,480);
});

test('autonomous movement routes around single and overlapping footprints', () => {
  const nav = new SceneryNavigation(false);
  nav.addCircle(500,500,65); nav.addCircle(550,540,55);
  follow(nav,{x:350,y:500},{x:720,y:500});
  follow(nav,{x:720,y:500},{x:350,y:500},20);
});

test('water is solid and the bridge provides a route between banks', () => {
  const nav = new SceneryNavigation();
  assert.ok(nav.blocked({x:riverX(600),y:600},12));
  assert.ok(nav.blocked({x:720,y:2460},12));
  let x=2410;for(let i=0;i<8;i++)x=riverX(pathY(x));
  assert.ok(!nav.blocked({x,y:pathY(x)},20));
  follow(nav,{x:2100,y:850},{x:2800,y:850},12);
  follow(nav,{x:2100,y:850},{x:2800,y:850},20);
});

test('blocked spawn and follow points resolve onto land and fresh arenas clear obstacles', () => {
  const nav = new SceneryNavigation(false);nav.addCircle(500,500,60);
  const point=nav.nearest({x:500,y:500},12);
  assert.ok(!nav.blocked(point,12));
  assert.ok(!new SceneryNavigation(false).blocked({x:500,y:500},12));
});

test('Midnight settles without walking in place after following around scenery', () => {
  const nav=new SceneryNavigation(false);nav.addCircle(550,525,40);
  const cat=new MidnightBehavior({x:400,y:500},nav);
  for(let i=0;i<400;i++)cat.update(16,{x:700,y:500},[],()=>{});
  assert.equal(cat.moving,false);
  const settled={...cat.position};cat.update(1000,{x:700,y:500},[],()=>{});
  assert.deepEqual(cat.position,settled);
  assert.ok(!nav.blocked(cat.position,12));
});
