import Phaser from 'phaser';
import { OvenBossSystem } from '../../systems/OvenBossSystem';
import { OVEN } from '../../config/ovenBoss';
import { StagBossSystem } from '../../systems/StagBossSystem';
import { STAG } from '../../config/stagBoss';
import { clampToArena } from '../../utils/math';
import { BALANCE } from '../../config/balance';
import { GAME_CONFIG } from '../../config/gameConfig';
import { getPlayerCharacter, type PlayerCharacterDefinition } from '../../config/playerCharacters';
import { getWeapon } from '../../config/weapons';
import type { WeaponId } from '../../core/types';
import { GameManager, xpThreshold } from '../../core/GameManager';
import { EnemyController } from '../../entities/EnemyController';
import { PlayerController } from '../../entities/PlayerController';
import { Projectile } from '../../entities/Projectile';
import { XPOrb } from '../../entities/XPOrb';
import { Acorn } from '../../entities/Acorn';
import { CameraController } from '../camera/CameraController';
import { CompanionSystem } from '../../systems/CompanionSystem';
import { ChestSystem } from '../../systems/ChestSystem';
import { BossPowerSystem } from '../../systems/BossPowerSystem';
import { BOSS_ARENA_RADIUS, insideBossArena, type BossId } from '../../core/BossGate';
import { BOSS_ABILITY_IDS } from '../../config/bossAbilities';
import type { Vector2Like } from '../../core/types';
import { CollisionSystem } from '../../systems/CollisionSystem';
import { EnemySpawner } from '../../systems/EnemySpawner';
import { ScenerySystem } from '../../systems/ScenerySystem';
import { UpgradeSystem } from '../../systems/UpgradeSystem';
import { WeaponSystem } from '../../systems/WeaponSystem';
import { DebugSpriteSheetMenu } from '../../ui/DebugSpriteSheetMenu';
import { UIManager } from '../../ui/UIManager';
import { PresentationSystem } from '../../systems/PresentationSystem';
import { AbilitySystem } from '../../systems/AbilitySystem';
import { CombatResolver, type CombatTarget } from '../../core/CombatResolver';
import { ABILITY_IDS } from '../../config/abilities';
import { MYSTERY_SPRITE_KEY } from '../../config/companionSprite';
import { MIDNIGHT_SPRITE_KEY } from '../../config/midnightSprite';
import type { AbilityId, AbilityRank, UpgradeDefinition } from '../../core/types';

export class GameScene extends Phaser.Scene {
  private gameManager!: GameManager;
  private player!: PlayerController;
  private cameraController!: CameraController;
  private enemySpawner!: EnemySpawner;
  private scenerySystem!: ScenerySystem;
  private companionSystem!: CompanionSystem;
  private chestSystem!: ChestSystem;
  private bossPowers!: BossPowerSystem;
  private bossArena?: { id: BossId; center: Vector2Like };
  private bossBoundary!: Phaser.GameObjects.Graphics;
  private bossArenaLabel!: Phaser.GameObjects.Text;
  private weaponSystem!: WeaponSystem;
  private upgradeSystem!: UpgradeSystem;
  private collisionSystem!: CollisionSystem;
  private uiManager!: UIManager;
  private debugSpriteSheetMenu?: DebugSpriteSheetMenu;
  private presentation!: PresentationSystem;
  private abilities!: AbilitySystem;
  private combat!: CombatResolver;
  private oven!: OvenBossSystem;
  private stag!: StagBossSystem;
  private visualsPaused = false;
  private reviewChoices?: UpgradeDefinition[];
  private keys!: Record<'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private enemies: EnemyController[] = [];
  private projectiles: Projectile[] = [];
  private xpOrbs: XPOrb[] = [];
  private acorns: Acorn[] = [];
  private levelUpDisplayed = false;
  private pausedDisplayed = false;
  private gameOverDisplayed = false;
  private readonly handleEscape = () => this.handleEscapePressed();
  private readonly finishReviewRun = () => this.gameManager.damagePlayer(this.gameManager.playerStats.health);
  private selectedCharacter!: PlayerCharacterDefinition;
  private selectedWeaponId: WeaponId = 'spell';
  private reviewControls?: HTMLElement;
  private reviewWalking = false;
  private reviewPathMs = 0;
  private reviewKeepCrowdPickups = false;
  private reviewNoEnemies = false;

  constructor() {
    super('GameScene');
  }

  create(data: { characterId?: string; weaponId?: string; skipReview?: boolean }): void {
    this.levelUpDisplayed = false;
    this.pausedDisplayed = false;
    this.gameOverDisplayed = false;
    this.visualsPaused = false;
    this.bossArena = undefined;
    this.reviewChoices = undefined;
    this.reviewWalking = false;
    this.reviewPathMs = 0;
    this.reviewKeepCrowdPickups = false;
    this.reviewNoEnemies = false;
    this.anims.resumeAll();
    document.getElementById('game-root')?.classList.add('in-run');
    this.selectedCharacter = getPlayerCharacter(data.characterId);
    const reviewWeapon = import.meta.env.DEV && !data.skipReview
      ? new URLSearchParams(location.search).get('weapon')
      : null;
    this.selectedWeaponId = getWeapon(reviewWeapon ?? data.weaponId).id;
    this.gameManager = new GameManager(this.selectedWeaponId);
    this.scenerySystem = new ScenerySystem(this);
    this.enemySpawner = new EnemySpawner(this, this.scenerySystem.navigation);
    this.companionSystem = new CompanionSystem(this, this.gameManager.playerStats, this.scenerySystem.navigation);
    this.weaponSystem = new WeaponSystem(this);
    this.upgradeSystem = new UpgradeSystem();
    this.collisionSystem = new CollisionSystem();
    this.cameraController = new CameraController(this.cameras.main);
    this.uiManager = new UIManager(this.gameManager, () => this.togglePause(), this.selectedCharacter,
      this.textures.getBase64(this.selectedCharacter.textureKey, 0), this.textures.getBase64(MYSTERY_SPRITE_KEY, 0),
      this.textures.getBase64(MIDNIGHT_SPRITE_KEY, 'walk-down-0'));
    this.debugSpriteSheetMenu = import.meta.env.DEV ? new DebugSpriteSheetMenu(this) : undefined;
    this.presentation = new PresentationSystem(this);
    this.abilities = new AbilitySystem(this, this.gameManager.playerStats);
    this.combat = new CombatResolver(enemy => this.killEnemy(enemy));

    this.scenerySystem.create();
    this.chestSystem = new ChestSystem(this, this.scenerySystem.navigation);
    this.bossPowers = new BossPowerSystem(this);
    this.bossBoundary = this.add.graphics().setDepth(3);
    this.bossArenaLabel = this.add.text(0, 0, 'BOSS ARENA · DEFEAT THE BOSS TO LEAVE', {
      fontFamily: 'Georgia', fontSize: '13px', color: '#ffe2a2', stroke: '#263828', strokeThickness: 4
    }).setOrigin(.5).setDepth(24).setVisible(false);
    this.oven = new OvenBossSystem(this, this.gameManager, this.scenerySystem.navigation);
    this.stag = new StagBossSystem(this, this.gameManager, this.scenerySystem.navigation, (damage, push) => {
      this.gameManager.damagePlayer(damage);
      // thrown back along the blow, but never into scenery or off the arena
      const thrown = clampToArena({ x: this.player.position.x + push.x * STAG.chargeKnockback, y: this.player.position.y + push.y * STAG.chargeKnockback }, this.player.radius);
      const safe = this.scenerySystem.navigation.move(this.player.position, thrown, this.player.radius);
      this.player.sprite.setPosition(safe.x, safe.y);
    });

    this.player = new PlayerController(
      this,
      this.gameManager.playerStats,
      this.selectedCharacter,
      GAME_CONFIG.arena.width / 2,
      GAME_CONFIG.arena.height / 2,
      this.scenerySystem.navigation
    );

    this.keys = {
      w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyRunObjects());
    this.input.keyboard?.on('keydown-ESC', this.handleEscape);
    if (import.meta.env.DEV && new URLSearchParams(location.search).get('review') === 'gameover') this.input.keyboard?.on('keydown-F10', this.finishReviewRun);
    if (import.meta.env.DEV && !data.skipReview) this.setupReview();
    this.cameras.main.centerOn(this.player.position.x, this.player.position.y);
    this.presentation.update(0);
    this.abilities.sync(this.player.position, this.gameManager.wardStatus, this.gameManager.wardLeaves);
    this.scenerySystem.update(100, [this.player.position]);
  }

  private setupReview(): void {
    const review = new URLSearchParams(location.search).get('review');
    if (review === 'boss-rewards') {
      this.gameManager.level = this.gameManager.playerStats.level = 9;
      this.gameManager.xpToNextLevel = xpThreshold(9);
      this.gameManager.playerStats.health = this.gameManager.playerStats.maxHealth = 10000;
      this.gameManager.playerStats.projectileDamage = 0;
      for (let i = 0; i < 6; i++) this.enemies.push(new EnemyController(this, 1800 + i * 25, 1600, 0, this.scenerySystem.navigation));
      this.reviewControls = document.createElement('div'); this.reviewControls.className = 'ability-review-controls';
      this.reviewControls.innerHTML = '<span data-boss-review></span><button>Next boss level</button><button>Defeat boss</button><button>Collect relic</button><button>Try leaving arena</button><button>Bank XP</button>';
      const buttons = this.reviewControls.querySelectorAll('button');
      buttons[0].onclick = () => {
        if (this.gameManager.state !== 'Playing' || this.gameManager.bossGate.required(this.gameManager.level)) return;
        const level = this.oven.encounter.defeated ? 14 : 9;
        this.gameManager.level = this.gameManager.playerStats.level = level;
        this.gameManager.xp = 0; this.gameManager.xpToNextLevel = xpThreshold(level);
        this.gameManager.addXp(this.gameManager.xpToNextLevel);
      };
      buttons[1].onclick = () => {
        const boss = this.bossArena?.id === 'oven' ? this.oven.boss : this.stag.boss;
        if (this.gameManager.state === 'Playing' && boss) this.combat.damage(boss, boss.health);
      };
      buttons[2].onclick = () => {
        const chest = this.chestSystem.drops.chests.find(chest => chest.kind === 'boss');
        if (this.gameManager.state === 'Playing' && chest) this.player.sprite.setPosition(chest.position.x, chest.position.y);
      };
      buttons[3].onclick = () => {
        if (this.bossArena && this.gameManager.state === 'Playing') this.player.sprite.setPosition(this.bossArena.center.x + 1000, this.bossArena.center.y);
      };
      buttons[4].onclick = () => this.gameManager.addXp(1000);
      document.body.append(this.reviewControls); return;
    }
    if (review === 'boss-powers') {
      this.reviewNoEnemies = true;
      this.gameManager.playerStats.health = 5000; this.gameManager.playerStats.maxHealth = 10000;
      this.gameManager.playerStats.projectileDamage = 0;
      for (const id of BOSS_ABILITY_IDS) this.gameManager.playerStats.bossAbilityRanks[id] = 1;
      for (let i = 0; i < 10; i++) {
        const angle = i * Math.PI / 5;
        const enemy = new EnemyController(this, 1600 + Math.cos(angle) * 130, 1600 + Math.sin(angle) * 130, 0, this.scenerySystem.navigation);
        enemy.health = 100000; this.enemies.push(enemy);
      }
      return;
    }
    if (review === 'chests') {
      this.reviewNoEnemies = true;
      // Keep the real placement, pickup and reward flow; guarantee one preview chest.
      this.chestSystem.drops.advanceToLevel(1);
      this.chestSystem.drops.pending = 1;
      this.reviewControls = document.createElement('div'); this.reviewControls.className = 'ability-review-controls';
      this.reviewControls.innerHTML = '<span>CHEST REVIEW</span><button>Collect chest</button><button>Level up</button>';
      const buttons = this.reviewControls.querySelectorAll('button');
      buttons[0].onclick = () => {
        if (this.gameManager.state !== 'Playing') return;
        const chest = this.chestSystem.positions[0];
        if (chest) this.player.sprite.setPosition(chest.x, chest.y);
      };
      buttons[1].onclick = () => this.gameManager.addXp(this.gameManager.xpToNextLevel - this.gameManager.xp);
      document.body.append(this.reviewControls);
      return;
    }
    if (review === 'progression') {
      for (const id of ['spore-trail', 'acorn-shower', 'acorn-shower', 'projectile-damage', 'projectile-damage', 'gain-companion-midnight']) {
        const choice = this.upgradeSystem.getAvailable(this.gameManager.playerStats).find(u => u.id === id)!;
        this.upgradeSystem.applyUpgrade(choice, this.gameManager.playerStats);
      }
      this.gameManager.level = 7;
      this.reviewChoices = this.upgradeSystem.getAvailable(this.gameManager.playerStats).filter(u => ['spore-trail', 'acorn-shower', 'projectile-damage'].includes(u.id));
      this.gameManager.state = 'LevelUpPaused';
      return;
    }
    if (review === 'scenery-crowd') {
      this.player.sprite.setPosition(2200, 1800);
      this.gameManager.playerStats.health = this.gameManager.playerStats.maxHealth = 100000;
      this.gameManager.playerStats.projectileDamage = 0;
      this.gameManager.xpToNextLevel = 100000;
      this.reviewNoEnemies = true; this.reviewWalking = true;
      for (let i = 0; i < 180; i++) {
        const angle = i * 2.39996, radius = 80 + i % 12 * 24;
        const enemy = new EnemyController(this, 2200 + Math.cos(angle) * radius, 1800 + Math.sin(angle) * radius, 0, this.scenerySystem.navigation);
        enemy.health = 100000; this.enemies.push(enemy);
      }
      return;
    }
    if (review === 'oven') {
      this.reviewNoEnemies = true;
      this.gameManager.level = 9;
      this.gameManager.playerStats.health = this.gameManager.playerStats.maxHealth = 10000;
      this.gameManager.playerStats.projectileDamage = 35;
      this.gameManager.playerStats.hasMysteryCompanion = true;
      this.gameManager.playerStats.hasMidnightCompanion = true;
      this.reviewControls = document.createElement('div'); this.reviewControls.className = 'ability-review-controls';
      this.reviewControls.innerHTML = '<span>OVEN REVIEW</span><button>Reach level 10</button><button>Walk trail</button><button>Defeat boss</button><button>End run</button>';
      const buttons = this.reviewControls.querySelectorAll('button');
      buttons[0].onclick = () => this.gameManager.addXp(this.gameManager.xpToNextLevel - this.gameManager.xp);
      buttons[1].onclick = () => { this.reviewWalking = !this.reviewWalking; buttons[1].textContent = this.reviewWalking ? 'Stop walking' : 'Walk trail'; };
      buttons[2].onclick = () => { if (this.gameManager.state === 'Playing' && this.oven.boss) this.combat.damage(this.oven.boss, OVEN.health); };
      buttons[3].onclick = () => this.finishReviewRun();
      if (new URLSearchParams(location.search).get('look') === '1') {
        this.gameManager.level = 10;
        this.gameManager.playerStats.projectileDamage = 0;
        this.gameManager.playerStats.hasMysteryCompanion = false;
        this.gameManager.playerStats.hasMidnightCompanion = false;
        this.oven.update(0, this.player.position, this.player.radius, this.enemies);
        this.oven.boss!.sprite.setPosition(1780, 1660);
      }
      document.body.append(this.reviewControls); return;
    }
    if (review === 'stag') {
      this.reviewNoEnemies = true;
      this.gameManager.level = 14;
      this.gameManager.playerStats.level = 14;
      this.gameManager.playerStats.health = this.gameManager.playerStats.maxHealth = 10000;
      this.gameManager.playerStats.projectileDamage = 60;
      this.oven.encounter.spawned = true;   // the level 10 boss has been and gone
      this.gameManager.bossGate.defeat('oven');
      this.reviewControls = document.createElement('div'); this.reviewControls.className = 'ability-review-controls';
      this.reviewControls.innerHTML = '<span>STAG REVIEW</span><button>Reach level 15</button><button>Walk trail</button><button>Defeat boss</button><button>End run</button>';
      const buttons = this.reviewControls.querySelectorAll('button');
      buttons[0].onclick = () => this.gameManager.addXp(this.gameManager.xpToNextLevel - this.gameManager.xp);
      buttons[1].onclick = () => { this.reviewWalking = !this.reviewWalking; buttons[1].textContent = this.reviewWalking ? 'Stop walking' : 'Walk trail'; };
      buttons[2].onclick = () => { if (this.gameManager.state === 'Playing' && this.stag.boss) this.combat.damage(this.stag.boss, STAG.health); };
      buttons[3].onclick = () => this.finishReviewRun();
      if (new URLSearchParams(location.search).get('look') === '1') {
        this.gameManager.level = 15; this.gameManager.playerStats.level = 15;
        this.gameManager.playerStats.projectileDamage = 0;
        this.stag.update(0, this.player.position, this.player.radius, this.enemies);
        this.stag.boss!.sprite.setPosition(1420, 1660);
      }
      document.body.append(this.reviewControls); return;
    }
    if (review === 'midnight' || review === 'companions' || review === 'midnight-upgrade' || review === 'cats-rest') {
      this.reviewNoEnemies = review === 'cats-rest';
      this.gameManager.playerStats.hasMidnightCompanion = review !== 'midnight-upgrade';
      this.gameManager.playerStats.hasMysteryCompanion = review === 'companions' || review === 'cats-rest';
      this.gameManager.playerStats.health = this.gameManager.playerStats.maxHealth = 100000;
      this.gameManager.xpToNextLevel = 100000;
      for (let i = 0; i < (this.reviewNoEnemies ? 0 : 10); i++) {
        const angle = i * 2.39996;
        const enemy = new EnemyController(this, 1600 + Math.cos(angle) * 130, 1600 + Math.sin(angle) * 130, 0, this.scenerySystem.navigation);
        enemy.health = 500; this.enemies.push(enemy);
      }
      if (review === 'midnight-upgrade') {
        this.reviewChoices = this.upgradeSystem.getAvailable(this.gameManager.playerStats).filter(u => ['gain-companion-midnight', 'gain-companion-mystery', 'max-health'].includes(u.id));
        this.gameManager.level = 2; this.gameManager.state = 'LevelUpPaused';
      }
      this.reviewControls = document.createElement('div'); this.reviewControls.className = 'ability-review-controls';
      this.reviewControls.innerHTML = '<span>COMPANION REVIEW</span><button type="button">Walk trail</button><button type="button">End run</button>';
      const buttons = this.reviewControls.querySelectorAll('button');
      buttons[0].onclick = () => { this.reviewWalking = !this.reviewWalking; buttons[0].textContent = this.reviewWalking ? 'Stop walking' : 'Walk trail'; };
      buttons[1].onclick = () => this.gameManager.damagePlayer(this.gameManager.playerStats.health);
      document.body.append(this.reviewControls);
      return;
    }
    if (review === 'abilities' || review === 'ability-crowd' || review === 'ability-baseline' || review === 'ability-cards') {
      const params = new URLSearchParams(location.search);
      const id = params.get('ability') as AbilityId | null;
      const requestedRank = Number(params.get('rank') ?? 3);
      const rank = Math.min(10, Math.max(1, Number.isFinite(requestedRank) ? Math.floor(requestedRank) : 3)) as AbilityRank;
      const chosen = id && ABILITY_IDS.includes(id) ? [id] : ABILITY_IDS;
      if (review !== 'ability-baseline') {
        for (const ability of chosen) this.gameManager.playerStats.abilityRanks[ability] = rank;
        if (chosen.includes('mystery-double-pounce')) this.gameManager.playerStats.hasMysteryCompanion = true;
      }
      const crowded = review === 'ability-crowd' || review === 'ability-baseline';
      this.reviewKeepCrowdPickups = review === 'ability-crowd';
      this.gameManager.playerStats.health = this.gameManager.playerStats.maxHealth = 100000;
      this.gameManager.xpToNextLevel = 100000;
      for (let i = 0; i < (crowded ? 180 : 12); i++) {
        const angle = i * 2.39996, radius = crowded ? 240 + (i % 10) * 24 : 100 + (i % 4) * 70;
        const enemy = new EnemyController(this, 1600 + Math.cos(angle) * radius, 1600 + Math.sin(angle) * radius, 0, this.scenerySystem.navigation);
        enemy.health = crowded ? 100000 : 100;
        this.enemies.push(enemy);
      }
      for (let i = 0; i < 220; i++) this.xpOrbs.push(new XPOrb(this, 1600 + Math.cos(i * 2.4) * (220 + i % 20 * 12), 1600 + Math.sin(i * 2.4) * (220 + i % 20 * 12), 8));
      this.reviewControls = document.createElement('div'); this.reviewControls.className = 'ability-review-controls';
      this.reviewControls.innerHTML = '<span>ABILITY REVIEW</span><button type="button">Walk trail</button><button type="button">Level up</button><button type="button">End run</button>';
      const buttons = this.reviewControls.querySelectorAll('button');
      buttons[0].onclick = () => { this.reviewWalking = !this.reviewWalking; buttons[0].textContent = this.reviewWalking ? 'Stop walking' : 'Walk trail'; };
      buttons[1].onclick = () => { this.gameManager.addXp(Math.max(0, this.gameManager.xpToNextLevel - this.gameManager.xp)); };
      buttons[2].onclick = () => { this.gameManager.damagePlayer(this.gameManager.playerStats.health); };
      document.body.append(this.reviewControls);
      if (review === 'ability-cards') {
        const displayRank = rank;
        this.gameManager.level = rank > 5 ? 10 : 2;
        this.gameManager.playerStats.level = this.gameManager.level;
        for (const ability of chosen) this.gameManager.playerStats.abilityRanks[ability] = (displayRank - 1) as AbilityRank;
        this.reviewChoices = this.upgradeSystem.getAvailable(this.gameManager.playerStats).filter(u =>
          (id && ABILITY_IDS.includes(id)) ? u.id === id : ['ricochet-charm', 'firefly-orbit', 'mystery-double-pounce'].includes(u.id));
        // Always render three real offers, including a requested ability if supplied.
        for (const offer of this.upgradeSystem.getAvailable(this.gameManager.playerStats)) {
          if (this.reviewChoices.length >= 3) break;
          if (!this.reviewChoices.some(u => u.id === offer.id)) this.reviewChoices.push(offer);
        }
        this.gameManager.state = 'LevelUpPaused';
      }
      return;
    }
    if (review === 'crowd') {
      this.gameManager.playerStats.health = 100000;
      this.gameManager.playerStats.maxHealth = 100000;
      this.gameManager.xpToNextLevel = 100000;
      for (let i = 0; i < 180; i++) {
        const angle = i * 2.39996;
        const radius = 240 + (i % 10) * 24;
        this.enemies.push(new EnemyController(this, 1600 + Math.cos(angle) * radius, 1600 + Math.sin(angle) * radius, 0, this.scenerySystem.navigation));
      }
      for (let i = 0; i < 220; i++) this.xpOrbs.push(new XPOrb(this, 1600 + Math.cos(i * 2.4) * (220 + i % 20 * 12), 1600 + Math.sin(i * 2.4) * (220 + i % 20 * 12), 8));
    } else if (review === 'upgrades') {
      this.gameManager.level = 2;
      this.gameManager.xpToNextLevel = 33;
      this.gameManager.state = 'LevelUpPaused';
      this.reviewChoices = this.upgradeSystem.getReviewChoices();
    } else if (review === 'gameover') {
      this.gameManager.elapsedMs = 187000; this.gameManager.kills = 42; this.gameManager.level = 6;
      this.gameManager.xpToNextLevel = xpThreshold(6);
      this.gameManager.playerStats.health = 0; this.gameManager.state = 'GameOver';
    } else if (review === 'deer') {
      this.gameManager.level = 10; this.gameManager.xpToNextLevel = 100000;
      this.gameManager.playerStats.health = this.gameManager.playerStats.maxHealth = 100000;
      for (let i = 0; i < 8; i++) {
        const angle = i * 0.785;
        this.enemies.push(new EnemyController(this, 1600 + Math.cos(angle) * 260, 1600 + Math.sin(angle) * 260, 0, this.scenerySystem.navigation, undefined, i % 4 === 3 ? 'buck' : i % 3 === 2 ? 'fawn' : 'doe'));
      }
    } else if (review === 'ranged') {
      this.gameManager.level = 5; this.gameManager.xpToNextLevel = 100000;
      this.gameManager.playerStats.health = this.gameManager.playerStats.maxHealth = 100000;
      for (let i = 0; i < 6; i++) {
        const angle = i * 1.05;
        this.enemies.push(new EnemyController(this, 1600 + Math.cos(angle) * 300, 1600 + Math.sin(angle) * 300, 0, this.scenerySystem.navigation, undefined, i % 2 ? 'grey' : 'brown'));
      }
    } else if (review === 'companion') {
      this.gameManager.level = 2; this.gameManager.xpToNextLevel = 33;
      this.gameManager.playerStats.hasMysteryCompanion = true;
      this.enemies.push(new EnemyController(this, 1870, 1600, 0, this.scenerySystem.navigation));
    } else if (review === 'river') {
      this.player.sprite.setPosition(2350, 1280);
    } else if (review === 'pond') {
      this.player.sprite.setPosition(720, 2460);
    } else if (review === 'edge') {
      this.player.sprite.setPosition(40, 40);
    }
  }

  update(_timeMs: number, deltaMs: number): void {
    if (import.meta.env.DEV) {
      const readout = document.getElementById('performance-readout');
      if (readout) { readout.dataset.enemies = String(this.enemies.length); readout.dataset.pickups = String(this.xpOrbs.length); }
      const bossReadout = this.reviewControls?.querySelector('[data-boss-review]');
      if (bossReadout) bossReadout.textContent = `Level ${this.gameManager.level} · Foes ${this.enemies.filter(e => !e.isDead && e !== this.oven.boss && e !== this.stag.boss).length} · ${this.bossArena ? `LOCKED ${Math.round(Math.hypot(this.player.position.x - this.bossArena.center.x, this.player.position.y - this.bossArena.center.y))}px` : 'OPEN'} · Relics ${this.chestSystem.drops.chests.filter(c => c.kind === 'boss').length}`;
    }
    this.uiManager.update(this.gameManager.getHudSnapshot());
    this.uiManager.setPauseButtonState(this.gameManager.state === 'Paused');

    this.setPresentationPaused(this.gameManager.state !== 'Playing' || Boolean(this.debugSpriteSheetMenu?.isOpen));
    if (this.debugSpriteSheetMenu?.isOpen) {
      return;
    }

    if (this.gameManager.state === 'GameOver') {
      this.showGameOverOnce();
      return;
    }

    if (this.gameManager.state === 'Paused') {
      this.showPausedOnce();
      return;
    }

    if (this.gameManager.state === 'LevelUpPaused') {
      this.showLevelUpOnce();
      return;
    }

    this.levelUpDisplayed = false;
    this.pausedDisplayed = false;
    this.gameManager.update(deltaMs);
    if (import.meta.env.DEV && this.reviewWalking) {
      this.reviewPathMs += deltaMs;
      const direction = Math.floor(this.reviewPathMs / 850) % 4;
      for (const [i, key] of [this.keys.d, this.keys.s, this.keys.a, this.keys.w].entries()) key.isDown = i === direction;
    } else if (import.meta.env.DEV && this.reviewPathMs) {
      for (const key of Object.values(this.keys)) key.isDown = false;
      this.reviewPathMs = 0;
    }
    this.player.update(deltaMs, this.keys);
    const requiredBoss = this.gameManager.bossGate.required(this.gameManager.level);
    if (requiredBoss && !this.bossArena) this.beginBossArena(requiredBoss);
    this.confineToBossArena();
    this.cameraController.update(this.player.position);
    if (this.chestSystem.update(deltaMs, this.player.position, this.gameManager)) {
      this.setPresentationPaused(true);
      this.showLevelUpOnce();
      return;
    }
    this.oven.update(deltaMs, this.player.position, this.player.radius, this.enemies);
    this.stag.update(deltaMs, this.player.position, this.player.radius, this.enemies);
    if (this.gameManager.state !== 'Playing') return;

    const difficulty = this.gameManager.getDifficultyMinutes();
    if (!this.reviewNoEnemies && !this.gameManager.bossGate.required(this.gameManager.level)) this.enemySpawner.update(deltaMs, this.player.position, this.cameras.main, this.enemies, difficulty, this.gameManager.level);
    this.weaponSystem.update(
      deltaMs,
      this.player.position,
      this.gameManager.playerStats,
      this.enemies,
      this.projectiles
    );
    this.player.setAim(this.weaponSystem.aimAngle);
    if (this.weaponSystem.consumeShot()) this.player.kickArm();
    this.player.presentArm(deltaMs);

    this.abilities.update(deltaMs, this.player.position, this.enemies, this.xpOrbs, this.combat.damage);
    this.bossPowers.update(deltaMs, this.gameManager, this.player.position, this.enemies, this.combat.damage);
    for (const enemy of this.enemies) {
      enemy.update(deltaMs, this.player.position, difficulty);
      const throwVelocity = enemy.tryThrow(this.player.position);
      if (throwVelocity) this.acorns.push(new Acorn(this, enemy.position.x, enemy.position.y - 10, throwVelocity));
    }
    for (const acorn of this.acorns) {
      acorn.update(deltaMs);
      if (this.abilities.simulation.insideThornwall(acorn.position)) acorn.isDead = true;   // Thornwall stops thrown acorns
    }
    this.confineToBossArena();
    this.gameManager.playerStats.harvestBonus = this.abilities.simulation.harvestBonus;

    this.companionSystem.update(
      deltaMs,
      this.player.position,
      this.player.currentMovementDirection,
      this.enemies,
      this.combat.damage
    );

    for (const projectile of this.projectiles) {
      projectile.update(deltaMs);
    }

    for (const orb of this.xpOrbs) {
      orb.update(deltaMs, this.player.position);
    }

    const healthBefore = this.gameManager.playerStats.health;
    this.collisionSystem.update(
      this.gameManager.elapsedMs,
      this.player,
      this.gameManager,
      this.enemies,
      this.projectiles,
      this.xpOrbs,
      this.combat.damage,
      this.acorns
    );
    if (this.gameManager.playerStats.health < healthBefore) this.events.emit('presentation:hit', this.player.sprite);
    this.abilities.simulation.noteCollected(this.xpOrbs.filter(orb => orb.isCollected).length);
    if (this.abilities.simulation.pendingHeal > 0) {
      const stats = this.gameManager.playerStats;
      stats.health = Math.min(stats.maxHealth, stats.health + this.abilities.simulation.pendingHeal);
      this.abilities.simulation.pendingHeal = 0;
    }
    if (this.gameManager.consumeBarkBurst()) this.livingBarkBurst();
    this.abilities.sync(this.player.position, this.gameManager.wardStatus, this.gameManager.wardLeaves);
    this.presentation.update(deltaMs);
    const subjects = [this.player.position, ...this.enemies.map(e => e.position), ...this.xpOrbs.map(o => o.position)];
    subjects.push(...this.companionSystem.positions);
    subjects.push(...this.chestSystem.positions);
    this.scenerySystem.update(deltaMs, subjects);

    this.cleanupDeadObjects();
    if (import.meta.env.DEV && this.reviewKeepCrowdPickups) {
      while (this.xpOrbs.length < BALANCE.xp.maxOrbs) {
        const i = this.xpOrbs.length;
        this.xpOrbs.push(new XPOrb(this, 1600 + Math.cos(i * 2.4) * (220 + i % 20 * 12), 1600 + Math.sin(i * 2.4) * (220 + i % 20 * 12), 8));
      }
    }
  }

  /** Living Bark: the last leaf falling throws every nearby foe back and roots them. */
  private livingBarkBurst(): void {
    const bark = this.gameManager.bark;
    if (!bark) return;
    const { burstRange, knockback, rootMs, burstDamage } = bark;
    const origin = this.player.position;
    for (const enemy of this.enemies) {
      if (enemy.isDead) continue;
      const dx = enemy.position.x - origin.x, dy = enemy.position.y - origin.y;
      const d = Math.hypot(dx, dy);
      if (d > burstRange) continue;
      const push = d > 0 ? { x: dx / d, y: dy / d } : { x: 1, y: 0 };
      enemy.displace(push.x * knockback, push.y * knockback);
      enemy.root(rootMs);
      this.combat.damage(enemy, burstDamage);
    }
    this.events.emit('presentation:level', origin);
  }

  private killEnemy(enemy: CombatTarget): void {
    this.events.emit('presentation:defeat', enemy.position);
    this.abilities.simulation.noteKill(enemy.position);
    this.gameManager.addKill();
    const isOven = enemy === this.oven.boss, isStag = enemy === this.stag.boss;
    const isBoss = isOven || isStag;
    if (isOven) this.oven.defeated();
    if (isStag) this.stag.defeated();
    if (isBoss && this.gameManager.bossGate.defeat(isOven ? 'oven' : 'stag')) {
      this.chestSystem.dropBoss(enemy.position);
      this.bossArena = undefined;
      this.bossBoundary.clear(); this.bossArenaLabel.setVisible(false);
    }
    if (isBoss || this.xpOrbs.length < BALANCE.xp.maxOrbs) {
      this.xpOrbs.push(new XPOrb(this, enemy.position.x, enemy.position.y, isOven ? OVEN.xp : isStag ? STAG.xp : BALANCE.enemy.xpValue));
    }

  }

  private showLevelUpOnce(): void {
    if (this.levelUpDisplayed) {
      return;
    }

    this.levelUpDisplayed = true;
    const bossReward = this.gameManager.upgradeSource === 'boss';
    const choices = bossReward ? this.upgradeSystem.getBossChoices(this.gameManager.playerStats)
      : this.reviewChoices ?? this.upgradeSystem.getChoices(this.gameManager.playerStats);
    this.reviewChoices = undefined;
    this.uiManager.showLevelUp(choices, (choice) => {
      if (bossReward) this.upgradeSystem.applyBossUpgrade(choice, this.gameManager);
      else this.upgradeSystem.applyUpgrade(choice, this.gameManager.playerStats);
      this.abilities.sync(this.player.position, this.gameManager.wardStatus, this.gameManager.wardLeaves);
      this.levelUpDisplayed = false;
      this.gameManager.resumeAfterUpgrade();
      this.events.emit('presentation:level', this.player.position);
    }, this.gameManager.upgradeSource);
  }

  private showPausedOnce(): void {
    if (this.pausedDisplayed) {
      return;
    }

    this.pausedDisplayed = true;
    this.uiManager.showPaused(() => this.resumeFromPause());
  }

  private beginBossArena(id: BossId): void {
    const center = { ...this.player.position };
    this.bossArena = { id, center };
    // Clear the crowd without awarding kills or XP: this encounter is a duel.
    const bosses: (EnemyController | undefined)[] = [this.oven.boss, this.stag.boss];
    for (const enemy of this.enemies) if (!bosses.includes(enemy)) { enemy.destroy(); this.combat.release(enemy.id); }
    this.enemies = this.enemies.filter(enemy => bosses.includes(enemy));
    for (const acorn of this.acorns) acorn.destroy();
    this.acorns = [];
    this.bossBoundary.lineStyle(9, 0x6d3c91, .25).strokeCircle(center.x, center.y, BOSS_ARENA_RADIUS);
    this.bossBoundary.lineStyle(3, 0xf4cd84, .9).strokeCircle(center.x, center.y, BOSS_ARENA_RADIUS);
    this.bossArenaLabel.setPosition(center.x, center.y - 110).setVisible(true);
  }

  private confineToBossArena(): void {
    if (!this.bossArena) return;
    const center = this.bossArena.center;
    const player = insideBossArena(this.player.position, center, this.player.radius);
    this.player.sprite.setPosition(player.x, player.y);
    const boss = this.bossArena.id === 'oven' ? this.oven.boss : this.stag.boss;
    if (boss && !boss.isDead) {
      const before = boss.position;
      const safe = insideBossArena(before, center, boss.radius);
      if (this.bossArena.id === 'stag' && this.stag.encounter.phase === 'charging' &&
        Math.hypot(safe.x - before.x, safe.y - before.y) > .01) {
        this.stag.encounter.blocked(safe, player, this.player.radius, this.stag.boss!.blockedHit);
      }
      boss.sprite.setPosition(safe.x, safe.y);
    }
  }

  private togglePause(): void {
    if (this.debugSpriteSheetMenu?.isOpen) {
      return;
    }

    if (this.gameManager.state === 'GameOver' || this.gameManager.state === 'LevelUpPaused') {
      return;
    }

    if (this.gameManager.state === 'Paused') {
      this.resumeFromPause();
      return;
    }

    this.gameManager.pause();
  }

  private resumeFromPause(): void {
    this.gameManager.resume();
    this.pausedDisplayed = false;
    this.uiManager.hideOverlay();
  }

  private handleEscapePressed(): void {
    if (this.debugSpriteSheetMenu?.isOpen) {
      this.debugSpriteSheetMenu.close();
      return;
    }

    this.togglePause();
  }

  private showGameOverOnce(): void {
    if (this.gameOverDisplayed) {
      return;
    }

    this.gameOverDisplayed = true;
    this.uiManager.showGameOver(() => this.scene.restart({ characterId: this.selectedCharacter.id, weaponId: this.selectedWeaponId, skipReview: true }), () => this.scene.start('StartScene', { skipReview: true }));
  }

  private setPresentationPaused(paused: boolean): void {
    if (paused === this.visualsPaused) return;
    this.visualsPaused = paused;
    if (paused) this.anims.pauseAll(); else this.anims.resumeAll();
  }

  private cleanupDeadObjects(): void {
    for (const enemy of this.enemies) if (enemy.isDead) { enemy.destroy(); this.combat.release(enemy.id); }
    this.enemies = this.enemies.filter(enemy => !enemy.isDead);
    for (const projectile of this.projectiles) {
      if (projectile.isDead) {
        projectile.destroy();
      }
    }
    this.projectiles = this.projectiles.filter((projectile) => !projectile.isDead);
    for (const acorn of this.acorns) if (acorn.isDead) acorn.destroy();
    this.acorns = this.acorns.filter(acorn => !acorn.isDead);

    for (const orb of this.xpOrbs) {
      if (orb.isCollected) {
        orb.destroy();
      }
    }
    this.xpOrbs = this.xpOrbs.filter((orb) => !orb.isCollected);
  }

  private destroyRunObjects(): void {
    this.reviewControls?.remove(); this.reviewControls = undefined;
    this.anims.resumeAll();
    this.input.keyboard?.off('keydown-ESC', this.handleEscape);
    this.input.keyboard?.off('keydown-F10', this.finishReviewRun);
    this.debugSpriteSheetMenu?.destroy();
    this.uiManager?.destroy();
    this.companionSystem?.destroy();
    this.chestSystem?.destroy();
    this.bossPowers?.destroy();
    this.bossBoundary?.destroy(); this.bossArenaLabel?.destroy(); this.bossArena = undefined;
    this.abilities?.destroy();
    this.oven?.destroy();
    this.stag?.destroy();
    this.player?.destroy();
    for (const enemy of this.enemies) {
      enemy.destroy();
    }
    for (const projectile of this.projectiles) {
      projectile.destroy();
    }
    for (const orb of this.xpOrbs) {
      orb.destroy();
    }
    for (const acorn of this.acorns) {
      acorn.destroy();
    }
    this.enemies = [];
    this.projectiles = [];
    this.xpOrbs = [];
    this.acorns = [];
    this.presentation?.destroy();
  }
}
