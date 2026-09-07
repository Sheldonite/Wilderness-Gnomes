const test=require('node:test'),assert=require('node:assert/strict');
const {GameManager}=require('../artifacts/ability-tests/game/core/GameManager.js');
const {UpgradeSystem}=require('../artifacts/ability-tests/game/systems/UpgradeSystem.js');
const {upgradeChanges}=require('../artifacts/ability-tests/game/core/UpgradeProgress.js');
const {emptyMarketProfile}=require('../artifacts/ability-tests/game/core/MarketProgress.js');
function pick(game){const upgrades=new UpgradeSystem();upgrades.applyUpgrade(upgrades.getAvailable(game.playerStats).find(u=>u.id==='max-health'),game.playerStats);}

test('Hardier Heart heals one HP every five active seconds and stacks per pick on either weapon',()=>{
  for(const weapon of ['spell','crossbow']){
    const game=new GameManager(weapon);game.update(9000);pick(game);game.playerStats.health=50;
    game.update(4999);assert.equal(game.playerStats.health,50);
    game.update(1);assert.equal(game.playerStats.health,51);
    pick(game);game.playerStats.health=50;
    game.update(5000);assert.equal(game.playerStats.health,52);
    game.update(10000);assert.equal(game.playerStats.health,56);
    const choice=new UpgradeSystem().getAvailable(game.playerStats).find(u=>u.id==='max-health');
    assert.match(upgradeChanges(choice,game.playerStats),/Regen \(HP\/5s\): 2 → 3/);
  }
});

test('heart regen pauses for menus, caps at max HP, stacks with market tonic, and resets each run',()=>{
  const profile=emptyMarketProfile();profile.ranks['springwater-flask']=1;
  const game=new GameManager('spell',profile);pick(game);game.playerStats.health=50;
  game.update(5000);assert.equal(game.playerStats.health,52);
  for(const state of ['Paused','LevelUp','GameOver']){game.state=state;game.update(20000);assert.equal(game.playerStats.health,52);}
  game.state='Playing';game.playerStats.health=game.playerStats.maxHealth-.5;
  game.update(5000);assert.equal(game.playerStats.health,game.playerStats.maxHealth);
  const fresh=new GameManager();assert.equal(fresh.playerStats.heartRegen,0);
  fresh.playerStats.health=50;fresh.update(10000);assert.equal(fresh.playerStats.health,50);
});
