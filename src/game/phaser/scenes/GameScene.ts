import Phaser from 'phaser';
import { CosmeticGlow } from '../../market/CosmeticGlow';
import { OvenBossSystem } from '../../systems/OvenBossSystem';
import { OVEN } from '../../config/ovenBoss';
import { StagBossSystem } from '../../systems/StagBossSystem';
import { STAG, STAG_LOOK } from '../../config/stagBoss';
import { KingBossSystem } from '../../systems/KingBossSystem';
import { BuzzardBossSystem } from '../../systems/BuzzardBossSystem';
import { BUZZARD, BUZZARD_LOOK } from '../../config/buzzardBoss';
import { LOOK } from '../../config/presentation';
import { KING } from '../../config/kingBoss';
import { RunEventSystem } from '../../systems/RunEventSystem';
import { ringCount, type RunEvent } from '../../core/RunEvents';
import { clampToArena } from '../../utils/math';
import { BALANCE } from '../../config/balance';
import { GAME_CONFIG } from '../../config/gameConfig';
import { getPlayerCharacter, type PlayerCharacterDefinition } from '../../config/playerCharacters';
import { getWeapon } from '../../config/weapons';
import type { WeaponId } from '../../core/types';
import { GameManager, xpThreshold } from '../../core/GameManager';
import { EnemyController, type EnemyVariant } from '../../entities/EnemyController';
import { PlayerController } from '../../entities/PlayerController';
import { Projectile } from '../../entities/Projectile';
import { XPOrb } from '../../entities/XPOrb';
import { Acorn } from '../../entities/Acorn';
import { CameraController } from '../camera/CameraController';
import { CompanionSystem } from '../../systems/CompanionSystem';
import { ChestSystem } from '../../systems/ChestSystem';
import { RareRockSystem } from '../../systems/RareRockSystem';
import { BossPowerSystem } from '../../systems/BossPowerSystem';
import { BOSS_ARENA_RADIUS, insideBossArena, type BossId } from '../../core/BossGate';
import { BOSS_ABILITY_IDS } from '../../config/bossAbilities';
import { TOBIAS_SPRITE_KEY } from '../../config/tobiasSprite';
import { COMPANION_NAMES, describeCompanionRank } from '../../config/companions';
import { MarketProgress, marketProgress, emptyMarketProfile } from '../../core/MarketProgress';
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
import { FRANKIE_PORTRAIT_KEY } from '../../config/frankieSprite';
import type { AbilityId, AbilityRank, UpgradeDefinition } from '../../core/types';

export class GameScene extends Phaser.Scene {
  private cosmetic!: CosmeticGlow;
  private gameManager!: GameManager;
  private player!: PlayerController;
  private cameraController!: CameraController;
  private enemySpawner!: EnemySpawner;
  private scenerySystem!: ScenerySystem;
  private companionSystem!: CompanionSystem;
  private chestSystem!: ChestSystem;
  private rareRocks!: RareRockSystem;
  private bossPowers!: BossPowerSystem;
  private bossArena?: { id: BossId; center: Vector2Like };
  private bossBoundary!: Phaser.GameObjects.Graphics;
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
  private buzzard!: BuzzardBossSystem;
  private king!: KingBossSystem;
  private runEvents!: RunEventSystem;
  /** Counts down after the final boss falls, then offers the victory screen. */
  private victoryInMs = 0;
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
  private practiceRun = false;

  constructor() {
    super('GameScene');
  }

  create(data: { characterId?: string; weaponId?: string; skipReview?: boolean }): void {
    this.levelUpDisplayed = false;
    this.pausedDisplayed = false;
    this.gameOverDisplayed = false;
    this.visualsPaused = false;
    this.bossArena = undefined;
    this.victoryInMs = 0;
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
    this.practiceRun = import.meta.env.DEV && !data.skipReview && new URLSearchParams(location.search).has('review');
    this.cosmetic = new CosmeticGlow(this);
    this.gameManager = new GameManager(this.selectedWeaponId, this.practiceRun ? emptyMarketProfile() : marketProgress.refresh(), this.selectedCharacter.id);
    this.scenerySystem = new ScenerySystem(this);
    this.enemySpawner = new EnemySpawner(this, this.scenerySystem.navigation);
    this.companionSystem = new CompanionSystem(this, this.gameManager.playerStats, this.scenerySystem.navigation);
    this.weaponSystem = new WeaponSystem(this);
    this.upgradeSystem = new UpgradeSystem();
    this.collisionSystem = new CollisionSystem();
    this.cameraController = new CameraController(this.cameras.main);
    const companionPortrait = {
      mystery: () => this.textures.getBase64(MYSTERY_SPRITE_KEY, 0),
      midnight: () => this.textures.getBase64(MIDNIGHT_SPRITE_KEY, 'walk-down-0'),
      frankie: () => this.textures.getBase64(FRANKIE_PORTRAIT_KEY),
      tobias: () => this.textures.getBase64(TOBIAS_SPRITE_KEY, 0)
    }[this.selectedCharacter.companionId]();
    this.uiManager = new UIManager(this.gameManager, () => this.togglePause(), this.selectedCharacter,
      this.textures.getBase64(this.selectedCharacter.textureKey, 0), companionPortrait);
    this.debugSpriteSheetMenu = import.meta.env.DEV ? new DebugSpriteSheetMenu(this) : undefined;
    this.presentation = new PresentationSystem(this);
    this.abilities = new AbilitySystem(this, this.gameManager.playerStats);
    this.combat = new CombatResolver(enemy => this.killEnemy(enemy));

    this.scenerySystem.create();
    this.chestSystem = new ChestSystem(this, this.scenerySystem.navigation);
    this.rareRocks = new RareRockSystem(this, this.scenerySystem.navigation, this.practiceRun ? new MarketProgress(null) : marketProgress, this.practiceRun);
    this.bossPowers = new BossPowerSystem(this);
    this.bossBoundary = this.add.graphics().setDepth(3);
    const summon = (variant: EnemyVariant, count: number, tint?: number) => this.summonAdds(variant, count, tint);
    this.runEvents = new RunEventSystem(this, this.scenerySystem.navigation);
    this.oven = new OvenBossSystem(this, this.gameManager, this.scenerySystem.navigation, summon);
    this.stag = new StagBossSystem(this, this.gameManager, this.scenerySystem.navigation,
      (damage, push, knockback) => this.knockPlayer(damage, push, knockback ?? STAG.chargeKnockback),
      (lanes, count) => this.runEvents.launchStampede(this.bossArena?.center ?? this.player.position, lanes, count, this.gameManager.level),
      (origin, directions) => {
        for (const d of directions) this.acorns.push(new Acorn(this, origin.x, origin.y - 40, { x: d.x * STAG.volleySpeed, y: d.y * STAG.volleySpeed }, STAG.volleyDamage, STAG_LOOK.velvet));
      });
    const arenaCircle = () => this.bossArena ? { center: this.bossArena.center, radius: BOSS_ARENA_RADIUS } : undefined;
    this.buzzard = new BuzzardBossSystem(this, this.gameManager, this.scenerySystem.navigation, arenaCircle,
      (damage, push, knockback) => this.knockPlayer(damage, push, knockback),
      (origin, directions) => {
        for (const d of directions) this.acorns.push(new Acorn(this, origin.x, origin.y - 50, { x: d.x * BUZZARD.featherSpeed, y: d.y * BUZZARD.featherSpeed },
          BUZZARD.featherDamage, BUZZARD_LOOK.feather, { texture: LOOK.texture.feather, size: 26 }));
      });
    this.king = new KingBossSystem(this, this.gameManager, this.scenerySystem.navigation,
      () => this.bossArena ? { center: this.bossArena.center, radius: BOSS_ARENA_RADIUS } : undefined,
      (damage, push, knockback) => this.knockPlayer(damage, push, knockback ?? KING.rollKnockback),
      (origin, directions) => {
        for (const d of directions) this.acorns.push(new Acorn(this, origin.x, origin.y - 10, { x: d.x * KING.shardSpeed, y: d.y * KING.shardSpeed }, KING.shardDamage, 0xe8c070));
      }, summon);

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
    if (review === 'rocks') {
      this.reviewNoEnemies = true;
      this.rareRocks.spawnForReview(this.player.position);
      this.reviewControls = document.createElement('div'); this.reviewControls.className = 'ability-review-controls';
      this.reviewControls.innerHTML = '<span>ROCK PREVIEW · NOT SAVED</span><button>Find rock</button><button>Collect rock</button>';
      const buttons = this.reviewControls.querySelectorAll('button');
      buttons[0].onclick = () => this.rareRocks.spawnForReview(this.player.position);
      buttons[1].onclick = () => { const rock = this.rareRocks.positions[0]; if (rock) this.player.sprite.setPosition(rock.x, rock.y); };
      document.body.append(this.reviewControls); return;
    }
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
        const boss = this.bossArena ? this.bossFor(this.bossArena.id) : undefined;
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
      for (const id of ['spore-trail', 'acorn-shower', 'acorn-shower', 'projectile-damage', 'projectile-damage', 'move-speed']) {
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
      buttons[2].onclick = () => { if (this.gameManager.state === 'Playing' && this.oven.boss) this.combat.damage(this.oven.boss, this.oven.boss.health); };
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
      buttons[2].onclick = () => { if (this.gameManager.state === 'Playing' && this.stag.boss) this.combat.damage(this.stag.boss, this.stag.boss.health); };
      buttons[3].onclick = () => this.finishReviewRun();
      if (new URLSearchParams(location.search).get('look') === '1') {
        this.gameManager.level = 15; this.gameManager.playerStats.level = 15;
        this.gameManager.playerStats.projectileDamage = 0;
        this.stag.update(0, this.player.position, this.player.radius, this.enemies);
        this.stag.boss!.sprite.setPosition(1420, 1660);
      }
      document.body.append(this.reviewControls); return;
    }
    if (review === 'buzzard') {
      this.reviewNoEnemies = true;
      this.gameManager.level = BUZZARD.level - 1; this.gameManager.playerStats.level = BUZZARD.level - 1;
      this.gameManager.playerStats.health = this.gameManager.playerStats.maxHealth = 10000;
      this.gameManager.playerStats.projectileDamage = 90;
      this.oven.encounter.spawned = this.stag.encounter.spawned = true;   // the earlier bosses have been and gone
      this.gameManager.bossGate.defeat('oven'); this.gameManager.bossGate.defeat('stag');
      this.reviewControls = document.createElement('div'); this.reviewControls.className = 'ability-review-controls';
      this.reviewControls.innerHTML = `<span>BUZZARD REVIEW</span><button>Reach level ${BUZZARD.level}</button><button>Walk trail</button><button>Defeat boss</button><button>End run</button><button>Send buzzards</button>`;
      const buttons = this.reviewControls.querySelectorAll('button');
      buttons[0].onclick = () => this.gameManager.addXp(this.gameManager.xpToNextLevel - this.gameManager.xp);
      buttons[1].onclick = () => { this.reviewWalking = !this.reviewWalking; buttons[1].textContent = this.reviewWalking ? 'Stop walking' : 'Walk trail'; };
      buttons[2].onclick = () => {
        if (this.gameManager.state !== 'Playing' || !this.buzzard.boss) return;
        this.combat.damage(this.buzzard.boss, this.buzzard.boss.health / this.buzzard.boss.vulnerability);
        this.reviewNoEnemies = false;   // the woods reopen, and the buzzards come
        this.gameManager.playerStats.projectileDamage = BALANCE.weapon.projectileDamage;   // ordinary shots, so they live long enough to see
      };
      buttons[3].onclick = () => this.finishReviewRun();
      buttons[4].onclick = () => {
        for (let i = 0; i < 5; i++) {
          const bird = this.enemySpawner.spawnEnemy(this.player.position, this.cameras.main, this.gameManager.getDifficultyMinutes(), 'buzzard');
          if (bird) this.enemies.push(bird);
        }
      };
      document.body.append(this.reviewControls); return;
    }
    if (review === 'king') {
      this.reviewNoEnemies = true;
      this.gameManager.level = KING.level - 1; this.gameManager.playerStats.level = KING.level - 1;
      this.gameManager.playerStats.health = this.gameManager.playerStats.maxHealth = 10000;
      this.gameManager.playerStats.projectileDamage = 90;
      this.oven.encounter.spawned = this.stag.encounter.spawned = this.buzzard.encounter.spawned = true;   // the earlier bosses have been and gone
      this.gameManager.bossGate.defeat('oven'); this.gameManager.bossGate.defeat('stag'); this.gameManager.bossGate.defeat('buzzard');
      this.reviewControls = document.createElement('div'); this.reviewControls.className = 'ability-review-controls';
      this.reviewControls.innerHTML = '<span>KING REVIEW</span><button>Reach level 30</button><button>Walk trail</button><button>Defeat boss</button><button>End run</button>';
      const buttons = this.reviewControls.querySelectorAll('button');
      buttons[0].onclick = () => this.gameManager.addXp(this.gameManager.xpToNextLevel - this.gameManager.xp);
      buttons[1].onclick = () => { this.reviewWalking = !this.reviewWalking; buttons[1].textContent = this.reviewWalking ? 'Stop walking' : 'Walk trail'; };
      buttons[2].onclick = () => { if (this.gameManager.state === 'Playing' && this.king.boss) this.combat.damage(this.king.boss, this.king.boss.health); };
      buttons[3].onclick = () => this.finishReviewRun();
      document.body.append(this.reviewControls); return;
    }
    if (review === 'events') {
      // Set pieces on demand; the regular spawner stays on so the crowd feels real.
      this.gameManager.level = 12; this.gameManager.playerStats.level = 12;
      this.gameManager.bossGate.defeat('oven');
      this.gameManager.playerStats.health = this.gameManager.playerStats.maxHealth = 10000;
      this.gameManager.xpToNextLevel = 100000;
      this.reviewControls = document.createElement('div'); this.reviewControls.className = 'ability-review-controls';
      this.reviewControls.innerHTML = '<span>EVENTS REVIEW</span><button>Elite</button><button>Ring</button><button>Stampede</button><button>Two stampedes</button>';
      const buttons = this.reviewControls.querySelectorAll('button');
      const fire = (event: RunEvent) => this.runEvents.trigger(event, this.gameManager.level, this.gameManager.getDifficultyMinutes(),
        this.player.position, this.cameras.main, this.enemies, this.enemySpawner);
      buttons[0].onclick = () => fire({ kind: 'elite' });
      buttons[1].onclick = () => fire({ kind: 'ring', count: ringCount(this.gameManager.getDifficultyMinutes()) });
      buttons[2].onclick = () => fire({ kind: 'stampede', lanes: 1 });
      buttons[3].onclick = () => fire({ kind: 'stampede', lanes: 2 });
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
          (id && ABILITY_IDS.includes(id)) ? u.id === id : ['ricochet-charm', 'firefly-orbit', 'bramble-snare'].includes(u.id));
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
    } else if (review === 'armadillo') {
      this.gameManager.level = 20; this.gameManager.xpToNextLevel = 100000;
      // Level skips would otherwise summon the boss arena and clear the reviewed creatures.
      this.gameManager.bossGate.defeat('oven'); this.gameManager.bossGate.defeat('stag');
      this.gameManager.playerStats.health = this.gameManager.playerStats.maxHealth = 100000;
      for (let i = 0; i < 6; i++) {
        const angle = i * 1.05;
        this.enemies.push(new EnemyController(this, 1600 + Math.cos(angle) * 240, 1600 + Math.sin(angle) * 240, 0, this.scenerySystem.navigation, undefined, 'armadillo'));
      }
    } else if (review === 'deer') {
      this.gameManager.level = 10; this.gameManager.xpToNextLevel = 100000;
      // Level skips would otherwise summon the boss arena and clear the reviewed creatures.
      this.gameManager.bossGate.defeat('oven'); this.gameManager.bossGate.defeat('stag');
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
    } else if (review === 'ron') {
      // Ron with all three performance skills running, so the ribbons, shout and spin are visible.
      const rank = Math.min(10, Math.max(1, Number(new URLSearchParams(location.search).get('rank') ?? 5)));
      for (const id of ['ribbon-sweep', 'inspiring-shout', 'dizzying-flurry'] as AbilityId[]) {
        this.gameManager.playerStats.abilityRanks[id] = rank as AbilityRank;
      }
      this.gameManager.level = 12; this.gameManager.syncCompanionToLevel();
      // Level 12 would otherwise summon the boss arena, which clears the reviewed crowd.
      this.gameManager.bossGate.defeat('oven'); this.gameManager.bossGate.defeat('stag');
      this.gameManager.playerStats.health = this.gameManager.playerStats.maxHealth = 100000;
      this.gameManager.xpToNextLevel = 100000;
      for (let i = 0; i < 10; i++) {
        const angle = i * 0.628;
        const enemy = new EnemyController(this, 1600 + Math.cos(angle) * 190, 1600 + Math.sin(angle) * 190, 0, this.scenerySystem.navigation);
        enemy.health = 4000; this.enemies.push(enemy);
      }
      this.reviewControls = document.createElement('div'); this.reviewControls.className = 'ability-review-controls';
      this.reviewControls.innerHTML = '<span data-ron-review>RON REVIEW</span><button type="button">Walk trail</button><button type="button">More foes</button>';
      const buttons = this.reviewControls.querySelectorAll('button');
      buttons[0].onclick = () => { this.reviewWalking = !this.reviewWalking; buttons[0].textContent = this.reviewWalking ? 'Stop walking' : 'Walk trail'; };
      buttons[1].onclick = () => {
        for (let i = 0; i < 6; i++) {
          const angle = Math.random() * Math.PI * 2;
          const enemy = new EnemyController(this, this.player.position.x + Math.cos(angle) * 200, this.player.position.y + Math.sin(angle) * 200, 0, this.scenerySystem.navigation);
          enemy.health = 4000; this.enemies.push(enemy);
        }
      };
      document.body.append(this.reviewControls);
    } else if (review === 'frankie') {
      this.gameManager.playerStats.hasFrankieCompanion = true;
      this.gameManager.playerStats.frankieCount = 5;
      this.gameManager.playerStats.health = this.gameManager.playerStats.maxHealth = 100000;
      this.gameManager.xpToNextLevel = 100000;
      for (let i = 0; i < 10; i++) {
        const angle = i * 0.628;
        this.enemies.push(new EnemyController(this, 1600 + Math.cos(angle) * 200, 1600 + Math.sin(angle) * 200, 0, this.scenerySystem.navigation));
      }
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
      if (bossReadout) bossReadout.textContent = `Level ${this.gameManager.level} · Foes ${this.enemies.filter(e => !e.isDead && !e.isBoss).length} · ${this.bossArena ? `LOCKED ${Math.round(Math.hypot(this.player.position.x - this.bossArena.center.x, this.player.position.y - this.bossArena.center.y))}px` : 'OPEN'} · Relics ${this.chestSystem.drops.chests.filter(c => c.kind === 'boss').length}`;
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
    this.cosmetic.update(deltaMs, this.player.position, this.practiceRun ? null : marketProgress.equippedCosmetic);
    const requiredBoss = this.gameManager.bossGate.required(this.gameManager.level);
    if (requiredBoss && !this.bossArena) this.beginBossArena(requiredBoss);
    this.confineToBossArena();
    this.cameraController.update(this.player.position);
    this.rareRocks.update(deltaMs, this.player.position, !requiredBoss);
    if (this.chestSystem.update(deltaMs, this.player.position, this.gameManager)) {
      this.setPresentationPaused(true);
      this.showLevelUpOnce();
      return;
    }
    this.oven.update(deltaMs, this.player.position, this.player.radius, this.enemies);
    this.stag.update(deltaMs, this.player.position, this.player.radius, this.enemies);
    this.buzzard.update(deltaMs, this.player.position, this.player.radius, this.enemies);
    this.king.update(deltaMs, this.player.position, this.player.radius, this.enemies);
    if (this.gameManager.state !== 'Playing') return;
    if (this.victoryInMs > 0) {
      this.victoryInMs -= deltaMs;
      if (this.victoryInMs <= 0) { this.showVictory(); return; }
    }

    const difficulty = this.gameManager.getDifficultyMinutes();
    const open = !this.reviewNoEnemies && !this.gameManager.bossGate.required(this.gameManager.level);
    if (open) this.enemySpawner.update(deltaMs, this.player.position, this.cameras.main, this.enemies, difficulty, this.gameManager.level);
    this.runEvents.update(deltaMs, open, this.gameManager.level, difficulty, this.player.position, this.cameras.main, this.enemies, this.enemySpawner);
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
    subjects.push(...this.rareRocks.positions);
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
    const bossId: BossId | undefined = enemy === this.oven.boss ? 'oven' : enemy === this.stag.boss ? 'stag'
      : enemy === this.buzzard.boss ? 'buzzard' : enemy === this.king.boss ? 'king' : undefined;
    if (bossId === 'oven') this.oven.defeated();
    if (bossId === 'stag') this.stag.defeated();
    if (bossId === 'buzzard') this.buzzard.defeated();
    if (bossId === 'king') this.king.defeated();
    if (bossId && this.gameManager.bossGate.defeat(bossId)) {
      this.chestSystem.dropBoss(enemy.position);
      this.bossArena = undefined;
      this.bossBoundary.clear();
      if (this.gameManager.bossGate.allDefeated && !this.gameManager.victorious) {
        this.gameManager.victorious = true;
        this.victoryInMs = 4000;   // let the celebration and relic chest land first
      }
    }
    const creature = enemy instanceof EnemyController ? enemy : undefined;
    if (creature?.elite) this.chestSystem.dropChest(enemy.position);
    if (bossId || creature?.elite || this.xpOrbs.length < BALANCE.xp.maxOrbs) {
      const xp = bossId === 'oven' ? OVEN.xp : bossId === 'stag' ? STAG.xp : bossId === 'buzzard' ? BUZZARD.xp : bossId === 'king' ? KING.xp : creature?.xpValue ?? BALANCE.enemy.xpValue;
      this.xpOrbs.push(new XPOrb(this, enemy.position.x, enemy.position.y, xp));
    }
  }

  private bossFor(id: BossId): EnemyController | undefined {
    return id === 'oven' ? this.oven.boss : id === 'stag' ? this.stag.boss : id === 'buzzard' ? this.buzzard.boss : this.king.boss;
  }

  /** A boss blow: damage, then thrown back along it, but never into scenery or out of the world. */
  private knockPlayer(damage: number, push: Vector2Like, distance: number): void {
    this.gameManager.damagePlayer(damage);
    const thrown = clampToArena({ x: this.player.position.x + push.x * distance, y: this.player.position.y + push.y * distance }, this.player.radius);
    const safe = this.scenerySystem.navigation.move(this.player.position, thrown, this.player.radius);
    this.player.sprite.setPosition(safe.x, safe.y);
  }

  /** Boss reinforcements, spread evenly just inside the arena's edge (or around the player). */
  private summonAdds(variant: EnemyVariant, count: number, tint?: number): void {
    const center = this.bossArena?.center ?? this.player.position;
    const radius = this.bossArena ? BOSS_ARENA_RADIUS - 60 : 420;
    const offset = Math.random() * Math.PI * 2, minutes = this.gameManager.getDifficultyMinutes();
    for (let i = 0; i < count; i++) {
      const a = offset + i * Math.PI * 2 / count;
      const spot = this.scenerySystem.navigation.nearest(clampToArena({ x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius }, 30), 24);
      if (this.scenerySystem.navigation.blocked(spot, 20)) continue;
      const add = new EnemyController(this, spot.x, spot.y, minutes, this.scenerySystem.navigation, undefined, variant);
      if (tint !== undefined) add.setBaseTint(tint);
      this.enemies.push(add);
    }
  }

  private showVictory(): void {
    this.gameManager.pause();
    this.pausedDisplayed = true;   // this overlay stands in for the pause menu
    this.uiManager.showVictory(() => this.resumeFromPause(), () => {
      this.uiManager.hideOverlay();
      this.gameManager.finishRun();
    });
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
    const grewTo = this.gameManager.consumeCompanionGrowth();
    const stats = this.gameManager.playerStats;
    const note = grewTo
      ? `${COMPANION_NAMES[stats.companionId]} grew to rank ${grewTo} — ${describeCompanionRank(stats.companionId, grewTo, stats)}.`
      : undefined;
    this.uiManager.showLevelUp(choices, (choice) => {
      if (bossReward) this.upgradeSystem.applyBossUpgrade(choice, this.gameManager);
      else this.upgradeSystem.applyUpgrade(choice, this.gameManager.playerStats);
      this.abilities.sync(this.player.position, this.gameManager.wardStatus, this.gameManager.wardLeaves);
      this.levelUpDisplayed = false;
      this.gameManager.resumeAfterUpgrade();
      this.events.emit('presentation:level', this.player.position);
    }, this.gameManager.upgradeSource, note);
  }

  private showPausedOnce(): void {
    if (this.pausedDisplayed) {
      return;
    }

    this.pausedDisplayed = true;
    this.uiManager.showPaused(() => this.resumeFromPause(), () => {
      if (this.gameManager.state !== 'Paused') return;
      if (!this.practiceRun) marketProgress.settleRun(this.gameManager.runId, this.gameManager.level);
      this.scene.start('StartScene', { skipReview: true });
    });
  }

  private beginBossArena(id: BossId): void {
    const center = { ...this.player.position };
    this.bossArena = { id, center };
    // Clear the crowd without awarding kills or XP: this encounter is a duel.
    const bosses: (EnemyController | undefined)[] = [this.oven.boss, this.stag.boss, this.buzzard.boss, this.king.boss];
    this.runEvents.clear();
    for (const enemy of this.enemies) if (!bosses.includes(enemy)) { enemy.destroy(); this.combat.release(enemy.id); }
    this.enemies = this.enemies.filter(enemy => bosses.includes(enemy));
    for (const acorn of this.acorns) acorn.destroy();
    this.acorns = [];
    this.bossBoundary.lineStyle(9, 0x6d3c91, .25).strokeCircle(center.x, center.y, BOSS_ARENA_RADIUS);
    this.bossBoundary.lineStyle(3, 0xf4cd84, .9).strokeCircle(center.x, center.y, BOSS_ARENA_RADIUS);
  }

  private confineToBossArena(): void {
    if (!this.bossArena) return;
    const center = this.bossArena.center;
    const player = insideBossArena(this.player.position, center, this.player.radius);
    this.player.sprite.setPosition(player.x, player.y);
    const boss = this.bossFor(this.bossArena.id);
    if (boss && !boss.isDead) {
      const before = boss.position;
      const safe = insideBossArena(before, center, boss.radius);
      if (this.bossArena.id === 'stag' && this.stag.encounter.phase === 'charging' &&
        Math.hypot(safe.x - before.x, safe.y - before.y) > .01) {
        // The arena's edge ends a charge; only trees stun him.
        this.stag.encounter.blocked(safe, player, this.player.radius, this.stag.boss!.blockedHit, false);
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
    const settlement = this.practiceRun ? undefined : marketProgress.settleRun(this.gameManager.runId, this.gameManager.level);
    this.uiManager.showGameOver(() => this.scene.restart({ characterId: this.selectedCharacter.id, weaponId: this.selectedWeaponId, skipReview: true }), () => this.scene.start('StartScene', { skipReview: true }), settlement ? {
      earned: settlement.goldEarned, balance: settlement.balance, saved: settlement.saved,
      onVisit: () => this.scene.start('MarketScene', { characterId: this.selectedCharacter.id, weaponId: this.selectedWeaponId })
    } : undefined);
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
    this.rareRocks?.destroy();
    this.bossPowers?.destroy();
    this.bossBoundary?.destroy(); this.bossArena = undefined;
    this.abilities?.destroy();
    this.oven?.destroy();
    this.stag?.destroy();
    this.buzzard?.destroy();
    this.king?.destroy();
    this.runEvents?.destroy();
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
