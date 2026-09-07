const test = require('node:test');
const assert = require('node:assert/strict');
const { OvenEncounter } = require('../artifacts/ability-tests/game/core/OvenEncounter.js');
const { OVEN } = require('../artifacts/ability-tests/game/config/ovenBoss.js');
const { GameManager } = require('../artifacts/ability-tests/game/core/GameManager.js');
const { CombatResolver } = require('../artifacts/ability-tests/game/core/CombatResolver.js');
const boss={x:1600,y:1600}, player={x:1850,y:1600};
function ready() {
 const fight=new OvenEncounter();fight.shouldSpawn(10);
 fight.update(OVEN.introductionMs,boss,player,18,1,()=>{});
 fight.update(1000,boss,player,18,1,()=>{});return fight;
}
test('level ten unlocks exactly one boss, including skipped levels and new runs',()=>{
 const fight=new OvenEncounter();
 for(let i=1;i<10;i++)assert.equal(fight.shouldSpawn(i),false);
 assert.equal(fight.shouldSpawn(10),true);assert.equal(fight.shouldSpawn(11),false);
 fight.defeat();assert.equal(fight.shouldSpawn(12),false);
 assert.equal(new OvenEncounter().shouldSpawn(12),true);
});
test('the real level-ten upgrade pause precedes the boss encounter',()=>{
 const game=new GameManager();game.level=9;game.addXp(game.xpToNextLevel);
 assert.equal(game.level,10);assert.equal(game.state,'LevelUpPaused');
 game.resumeAfterUpgrade();assert.equal(game.state,'Playing');
 assert.equal(new OvenEncounter().shouldSpawn(game.level),true);
});
test('tacos have fixed warnings and cannot hurt before the flight completes',()=>{
 const fight=ready();assert.equal(fight.phase,'windup');assert.equal(fight.warnings.length,3);
 const targets=fight.warnings.map(p=>({...p}));let damage=0;
 fight.update(OVEN.windupMs,boss,{x:1900,y:1700},18,1,d=>damage+=d);
 assert.deepEqual(fight.tacos.map(t=>t.target),targets);
 fight.update(OVEN.flightMs-1,boss,player,18,1,d=>damage+=d);assert.equal(damage,0);
 fight.update(1,boss,player,18,1,d=>damage+=d);assert.equal(damage,OVEN.damage);
 fight.update(100,boss,player,18,1,d=>damage+=d);assert.equal(damage,OVEN.damage);
});
test('moving out dodges the tacos and overlapping blasts only hit once',()=>{
 for(const [where,radius,expected] of [[{x:1500,y:1900},18,0],[player,200,OVEN.damage]]) {
  const fight=ready();let hit=0;fight.update(OVEN.windupMs,boss,player,18,1,()=>{});
  fight.update(OVEN.flightMs,boss,where,radius,1,d=>hit+=d);assert.equal(hit,expected);
 }
});
test('half health shortens the break and projectile count remains bounded',()=>{
 const fight=ready();fight.update(OVEN.windupMs,boss,player,18,.5,()=>{});
 fight.update(OVEN.flightMs,boss,player,18,.5,()=>{});
 fight.update(OVEN.hotCooldownMs-1,boss,player,18,.5,()=>{});assert.equal(fight.phase,'walking');
 fight.update(1,boss,player,18,.5,()=>{});assert.equal(fight.phase,'windup');
 for(let i=0;i<2000;i++){fight.update(50,boss,player,18,.5,()=>{});assert.ok(fight.tacos.length<=OVEN.maxTacos);assert.ok(fight.salsa.length<=OVEN.maxTacos);}
});
test('defeat cancels every warning and taco and shared combat awards one boss death',()=>{
 const fight=ready();fight.update(OVEN.windupMs,boss,player,18,1,()=>{});
 let awards=0;const target={id:999,position:boss,radius:22,isDead:false,takeDamage:()=>true};
 const combat=new CombatResolver(()=>{awards++;fight.defeat();});combat.damage(target,1200);combat.damage(target,1200);
 assert.equal(awards,1);assert.equal(fight.tacos.length,0);assert.equal(fight.warnings.length,0);
 fight.update(10000,boss,player,18,0,()=>assert.fail('post-defeat damage'));
});

test('Oven alternates the taco toss with a telegraphed ring that leaves the center safe',()=>{
 assert.equal(OVEN.name,'Oven');
 const fight=ready();assert.equal(fight.attack,'toss');
 fight.update(OVEN.windupMs,boss,player,18,1,()=>{});
 fight.update(OVEN.flightMs,boss,player,18,1,()=>{});
 fight.update(OVEN.cooldownMs,boss,player,18,1,()=>{});
 assert.equal(fight.attack,'ring');assert.equal(fight.warnings.length,5);
 const targets=fight.warnings.map(p=>({...p}));
 for(const target of targets)assert.ok(Math.hypot(target.x-player.x,target.y-player.y)>OVEN.blastRadius+18);
 fight.update(OVEN.windupMs,boss,{x:2000,y:1800},18,1,()=>assert.fail('windup damage'));
 assert.deepEqual(fight.tacos.map(t=>t.target),targets);
 fight.update(OVEN.flightMs,boss,player,18,1,()=>assert.fail('ring center should be safe'));
 assert.equal(fight.salsa.length,5);
 fight.update(OVEN.cooldownMs,boss,player,18,1,()=>{});
 assert.equal(fight.attack,'toss');
});

test('burning salsa has a grace period, cannot stack overlapping damage, expires and clears on defeat',()=>{
 const fight=ready();let damage=0;const hit=d=>damage+=d;
 fight.update(OVEN.windupMs,boss,player,200,1,hit);
 fight.update(OVEN.flightMs,boss,player,200,1,hit);
 assert.equal(damage,OVEN.damage);assert.equal(fight.salsa.length,3);
 fight.update(OVEN.salsaTickMs-1,boss,player,200,1,hit);assert.equal(damage,OVEN.damage);
 fight.update(1,boss,player,200,1,hit);assert.equal(damage,OVEN.damage+OVEN.salsaDamage);
 fight.update(100,boss,{x:1000,y:1000},18,1,hit);
 fight.update(OVEN.salsaTickMs-1,boss,player,200,1,hit);assert.equal(damage,OVEN.damage+OVEN.salsaDamage);
 fight.update(OVEN.salsaLifeMs,boss,{x:1000,y:1000},18,1,hit);assert.equal(fight.salsa.length,0);
 fight.salsa.push({...player,age:0});fight.defeat();assert.equal(fight.salsa.length,0);
 fight.update(5000,boss,player,18,0,()=>assert.fail('post-defeat burn'));
});
