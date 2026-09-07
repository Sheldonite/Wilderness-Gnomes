const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {CombatResolver}=require('../artifacts/ability-tests/game/core/CombatResolver.js');
const moduleStub={exports:{}};
const code=ts.transpileModule(fs.readFileSync('src/game/entities/EnemyController.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
vm.runInNewContext(code,{module:moduleStub,exports:moduleStub.exports,require:id=>id==='../config/balance'?require('../artifacts/ability-tests/game/config/balance.js'):({})});
const {EnemyController}=moduleStub.exports;

test('removing a living enemy invalidates retained targets before destroying its sprite',()=>{
  const enemy=Object.create(EnemyController.prototype);
  Object.assign(enemy,{id:71,health:100,isDead:false});
  enemy.sprite={scene:{events:{emit(){throw Error('removed enemy must not emit hits');}}},destroy(){
    assert.equal(enemy.isDead,true);this.scene=undefined;
  }};
  let defeats=0;const combat=new CombatResolver(()=>defeats++);
  enemy.destroy();
  assert.doesNotThrow(()=>combat.damage(enemy,200));
  assert.equal(enemy.takeDamage(200),false);
  assert.equal(enemy.health,100);
  assert.equal(defeats,0,'boss cleanup must not grant a combat kill');
});

test('a sprite removed directly cannot crash damage or award a phantom kill',()=>{
  const enemy=Object.create(EnemyController.prototype);
  Object.assign(enemy,{id:72,health:100,isDead:false,sprite:{scene:undefined}});
  let defeats=0;const combat=new CombatResolver(()=>defeats++);
  assert.doesNotThrow(()=>combat.damage(enemy,200));
  assert.equal(enemy.isDead,true);
  assert.equal(defeats,0);
});
