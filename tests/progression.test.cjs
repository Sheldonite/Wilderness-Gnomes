const test=require('node:test'), assert=require('node:assert/strict');
const {GameManager}=require('../artifacts/ability-tests/game/core/GameManager.js');
const {UpgradeSystem}=require('../artifacts/ability-tests/game/systems/UpgradeSystem.js');
const {upgradePreview,ownedUpgrades,upgradeRank}=require('../artifacts/ability-tests/game/core/UpgradeProgress.js');
test('repeated stats are counted and preview uses current actual values without applying the upgrade',()=>{
 const stats=new GameManager().playerStats, upgrades=new UpgradeSystem();
 for(let i=0;i<2;i++)upgrades.applyUpgrade(upgrades.getAvailable(stats).find(u=>u.id==='projectile-damage'),stats);
 const health=stats.projectileDamage, p=upgradePreview(upgrades.getAvailable(stats).find(u=>u.id==='projectile-damage'),stats);
 assert.equal(p.current,2);assert.equal(p.next,3);assert.equal(stats.projectileDamage,health);
 assert.equal(p.after,`${health+8} damage per shot`);assert.equal(upgradeRank('projectile-damage',stats),2);
 assert.ok(ownedUpgrades(stats).includes('projectile-damage'));
 assert.deepEqual(new GameManager().playerStats.upgradeCounts,{});
});
test('rank increases and final ranks preview the changed benefit and reject stale selections',()=>{
 const stats=new GameManager().playerStats, upgrades=new UpgradeSystem();
 const first=upgrades.getAvailable(stats).find(u=>u.id==='spore-trail');upgrades.applyUpgrade(first,stats);upgrades.applyUpgrade(first,stats);
 assert.equal(stats.upgradeCounts['spore-trail'],1);
 let next=upgrades.getAvailable(stats).find(u=>u.id==='spore-trail');
 assert.equal(upgradePreview(next,stats).before,'6 damage / second');assert.equal(upgradePreview(next,stats).after,'9 damage / second');
 upgrades.applyUpgrade(next,stats);next=upgrades.getAvailable(stats).find(u=>u.id==='spore-trail');
 assert.equal(upgradePreview(next,stats).next,3);assert.equal(upgradePreview(next,stats).after,'12 damage / second');
});
test('crossbow previews respect its starting damage and piercing rules',()=>{
 const stats=new GameManager('crossbow').playerStats, upgrades=new UpgradeSystem();
 const damage=upgrades.getAvailable(stats).find(u=>u.id==='projectile-damage');
 assert.equal(upgradePreview(damage,stats).before,`${stats.projectileDamage} damage per shot`);
 const ricochet=upgrades.getAvailable(stats).find(u=>u.id==='ricochet-charm');
 assert.equal(upgradePreview(ricochet,stats).after,'2 extra pierces');
});
