const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const { GameManager } = require('../artifacts/ability-tests/game/core/GameManager.js');

// Run the real companion controller with a small sprite stand-in, without a browser renderer.
function loadController(relative) {
  const filename = path.resolve(__dirname, '../src/game', relative);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: id => {
    if (id === '../config/presentation') return { LOOK: { color: { gold: 0 } } };
    const source = path.resolve(path.dirname(filename), id + '.ts');
    const compiled = source.replace(path.resolve(__dirname, '../src'), path.resolve(__dirname, '../artifacts/ability-tests')).replace(/\.ts$/, '.js');
    return fs.existsSync(compiled) ? require(compiled) : loadController(path.relative(path.resolve(__dirname, '../src/game'), source));
  } }, { filename });
  return module.exports;
}
const { MysteryCompanion } = loadController('entities/MysteryCompanion.ts');
function scene() {
  return { events: { emit() {} }, add: { sprite(x, y) {
    return { x, y, animation: '', anims: { stop() {} },
      setDepth() { return this; }, setScale() { return this; }, setTexture() { return this; },
      setPosition(x, y) { this.x = x; this.y = y; return this; },
      play(key) { this.animation = key; return this; }, destroy() {} };
  } } };
}

test('Mystery attacks again while returning to a moving player, as soon as cooldown expires', () => {
  const stats = new GameManager().playerStats, player = { x: 1000, y: 1000 };
  const cat = new MysteryCompanion(scene(), stats, player);
  const first = { id: 1, position: { x: cat.position.x + 50, y: cat.position.y }, radius: 15, isDead: false };
  let hits = 0;
  const damage = target => { hits++; target.isDead = true; };
  cat.update(600, player, { x: 1, y: 0 }, [first], damage);
  cat.update(100, player, { x: 1, y: 0 }, [first], damage);
  assert.equal(hits, 1);
  const movingPlayer = { x: 1500, y: 1000 };
  const next = { id: 2, position: { x: 1480, y: 1025 }, radius: 15, isDead: false };
  cat.update(1000, movingPlayer, { x: 1, y: 0 }, [next], damage);
  assert.ok(cat.position.x < movingPlayer.x - 60, 'still returning, well short of the follow point');
  assert.match(cat.sprite.animation, /pounce/, 'starts attacking before arriving');
  for (let i = 0; i < 4; i++) cat.update(100, movingPlayer, { x: 1, y: 0 }, [next], damage);
  assert.equal(hits, 2);
  cat.update(100, movingPlayer, { x: 1, y: 0 }, [next], damage);
  assert.equal(hits, 2, 'does not hit a defeated target twice');
});


test('Mystery abandons a pounce when boss cleanup removes her target', () => {
  const stats=new GameManager().playerStats, player={x:1000,y:1000};
  const cat=new MysteryCompanion(scene(),stats,player);
  const target={id:90,position:{x:cat.position.x+50,y:cat.position.y},radius:15,isDead:false};
  let hits=0;
  cat.update(600,player,{x:0,y:0},[target],()=>hits++);
  assert.match(cat.sprite.animation,/pounce/);
  target.isDead=true;
  cat.update(100,player,{x:0,y:0},[],()=>hits++);
  assert.equal(hits,0);
  assert.notEqual(cat.state,'pouncing');
});
