import Phaser from 'phaser';
import { CosmeticGlow } from '../../market/CosmeticGlow';
import { OvenBossSystem } from '../../systems/OvenBossSystem';
import { OVEN } from '../../config/ovenBoss';
import { SquirrelChiefSystem } from '../../systems/SquirrelChiefSystem';
import { SQUIRREL_CHIEF } from '../../config/squirrelChief';
import { StagBossSystem } from '../../systems/StagBossSystem';
import { STAG, STAG_LOOK } from '../../config/stagBoss';
import { KingBossSystem } from '../../systems/KingBossSystem';
import { BuzzardBossSystem } from '../../systems/BuzzardBossSystem';
import { BUZZARD, BUZZARD_LOOK } from '../../config/buzzardBoss';
import { LOOK, reducedMotion } from '../../config/presentation';
import { KING } from '../../config/kingBoss';
import { RunEventSystem } from '../../systems/RunEventSystem';
import { ringCount, type RunEvent } from '../../core/RunEvents';
import { distanceSq } from '../../utils/math';
import { BALANCE } from '../../config/balance';
import { getPlayerCharacter, type PlayerCharacterDefinition } from '../../config/playerCharacters';
import { getWeapon } from '../../config/weapons';
import type { WeaponId } from '../../core/types';
import { GameManager, xpThreshold } from '../../core/GameManager';
import { WOODLAND_START } from '../../core/WoodlandTerrain';
import { EnemyController, type EnemyVariant } from '../../entities/EnemyController';
import { PlayerController, type PlayerMoveInput } from '../../entities/PlayerController';
import { Projectile } from '../../entities/Projectile';
import { XPOrb } from '../../entities/XPOrb';
import { Acorn } from '../../entities/Acorn';
import { CameraController } from '../camera/CameraController';
import { CompanionSystem } from '../../systems/CompanionSystem';
import { ChestSystem } from '../../systems/ChestSystem';
import { RareRockSystem } from '../../systems/RareRockSystem';
import { BossPowerSystem } from '../../systems/BossPowerSystem';
import { BossSchedule, type BossId } from '../../core/BossSchedule';
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
import { DamageNumberSystem } from '../../systems/DamageNumberSystem';
import { CompassSystem, type CompassTarget } from '../../systems/CompassSystem';
import { AbilitySystem } from '../../systems/AbilitySystem';
import { audioSystem } from '../../systems/AudioSystem';
import { CombatResolver, type CombatTarget } from '../../core/CombatResolver';
import { ABILITY_IDS } from '../../config/abilities';
import { MYSTERY_SPRITE_KEY } from '../../config/companionSprite';
import { MIDNIGHT_SPRITE_KEY } from '../../config/midnightSprite';
import { FRANKIE_PORTRAIT_KEY } from '../../config/frankieSprite';
import type { AbilityId, AbilityRank, DamageSourceId, UpgradeDefinition } from '../../core/types';

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
  private weaponSystem!: WeaponSystem;
  private upgradeSystem!: UpgradeSystem;
  private collisionSystem!: CollisionSystem;
  private uiManager!: UIManager;
  private debugSpriteSheetMenu?: DebugSpriteSheetMenu;
  private presentation!: PresentationSystem;
  private damageNumbers!: DamageNumberSystem;
  private compass!: CompassSystem;
  private aimReticle!: Phaser.GameObjects.Graphics;
  private aimNotice?: Phaser.GameObjects.Text;
  private aimNoticeMs = 0;
  private floatingNotices: { text: Phaser.GameObjects.Text; ageMs: number; lifeMs: number; startY: number }[] = [];
  private abilities!: AbilitySystem;
  private combat!: CombatResolver;
  private squirrelChief!: SquirrelChiefSystem;
  private oven!: OvenBossSystem;
  private stag!: StagBossSystem;
  private buzzard!: BuzzardBossSystem;
  private king!: KingBossSystem;
  private runEvents!: RunEventSystem;
  /** Counts down after the final boss falls, then offers the victory screen. */
  private victoryInMs = 0;
  private visualsPaused = false;
  private reviewChoices?: UpgradeDefinition[];
  private keys!: Record<'w' | 'a' | 's' | 'd' | 'up' | 'down' | 'left' | 'right' | 'space' | 'shift', Phaser.Input.Keyboard.Key>;
  private manualAimEnabled = false;
  private manualAimAngle = 0;
  private manualAimWorldPoint?: Vector2Like;
  private gamepadDashHeld = false;
  private finishingReviewRun = false;
  private enemies: EnemyController[] = [];
  private projectiles: Projectile[] = [];
  private xpOrbs: XPOrb[] = [];
  private acorns: Acorn[] = [];
  private levelUpDisplayed = false;
  private pausedDisplayed = false;
  private gameOverDisplayed = false;
  private readonly handleEscape = () => this.handleEscapePressed();
  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer) => {
    if (pointer.rightButtonDown() && this.gameManager.state === 'Playing' && !this.debugSpriteSheetMenu?.isOpen) {
      this.toggleManualAim();
    }
  };
  private readonly finishReviewRun = () => {
    this.finishingReviewRun = true;
    try {
      this.gameManager.damagePlayer(this.gameManager.playerStats.health);
    } finally {
      this.finishingReviewRun = false;
    }
  };
  private selectedCharacter!: PlayerCharacterDefinition;
  private selectedWeaponId: WeaponId = 'spell';
  private reviewControls?: HTMLElement;
  private reviewWalking = false;
  private reviewPathMs = 0;
  private reviewKeepCrowdPickups = false;
  private reviewNoEnemies = false;
  private practiceRun = false;
  private simulateBossSchedule = true;

  constructor() {
    super('GameScene');
  }

  create(data: { characterId?: string; weaponId?: string; skipReview?: boolean }): void {
    this.levelUpDisplayed = false;
    this.pausedDisplayed = false;
    this.gameOverDisplayed = false;
    this.visualsPaused = false;
    this.victoryInMs = 0;
    this.reviewChoices = undefined;
    this.reviewWalking = false;
    this.reviewPathMs = 0;
    this.reviewKeepCrowdPickups = false;
    this.reviewNoEnemies = false;
    this.manualAimEnabled = false;
    this.manualAimAngle = 0;
    this.manualAimWorldPoint = undefined;
    this.aimNoticeMs = 0;
    this.floatingNotices = [];
    this.gamepadDashHeld = false;
    this.finishingReviewRun = false;
    this.anims.resumeAll();
    audioSystem.attachScene(this);
    audioSystem.setMusicMode('woods');
    if (this.sound) this.sound.mute = audioSystem.isMuted();
    document.getElementById('game-root')?.classList.add('in-run');
    this.selectedCharacter = getPlayerCharacter(data.characterId);
    const reviewParams = import.meta.env.DEV && !data.skipReview ? new URLSearchParams(location.search) : undefined;
    const reviewWeapon = reviewParams?.get('weapon');
    const review = reviewParams?.get('review') ?? null;
    this.practiceRun = review !== null;
    this.simulateBossSchedule = !this.practiceRun || review === 'boss-rewards';
    const firstBoss = review === 'boss-rewards' ? 'oven'
      : review === 'oven' || review === 'stag' || review === 'buzzard' || review === 'king' ? review : undefined;
    const activeProfile = this.practiceRun ? emptyMarketProfile() : marketProgress.refresh();
    this.selectedWeaponId = getWeapon(reviewWeapon ?? data.weaponId ?? activeProfile.equippedWeapon).id;
    this.cosmetic = new CosmeticGlow(this);
    this.gameManager = new GameManager(this.selectedWeaponId, activeProfile, this.selectedCharacter.id, new BossSchedule(firstBoss));
    const rawDamagePlayer = this.gameManager.damagePlayer.bind(this.gameManager);
    this.gameManager.damagePlayer = (amount: number, source: 'contact' | 'direct' = 'direct') => {
      if (!this.finishingReviewRun) {
        if (this.player?.isDashing) return;
        if (source === 'contact' && this.player?.isHitInvulnerable) return;
      }
      rawDamagePlayer(amount, source);
    };
    this.scenerySystem = new ScenerySystem(this, this.practiceRun ? undefined : this.gameManager.runId);
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
    this.uiManager = new UIManager(
      this.gameManager,
      () => this.togglePause(),
      this.selectedCharacter,
      this.textures.getBase64(this.selectedCharacter.textureKey, 0),
      companionPortrait,
      {
        initialMuted: audioSystem.isMuted(),
        initialManualAim: this.isManualAim,
        onToggleMute: () => {
          const muted = audioSystem.toggleMute();
          if (this.sound) this.sound.mute = muted;
          if (!muted) audioSystem.play('ui-click');
          return muted;
        },
        onToggleAimMode: () => this.toggleManualAim(),
        onDash: () => this.triggerDash()
      }
    );
    this.debugSpriteSheetMenu = import.meta.env.DEV ? new DebugSpriteSheetMenu(this) : undefined;
    this.presentation = new PresentationSystem(this);
    this.damageNumbers = new DamageNumberSystem(this);
    this.compass = new CompassSystem(this);
    this.aimReticle = this.createAimReticle();
    this.aimNotice = this.add
      .text(this.scale.width * 0.5, 92, '', {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#fff3d1',
        stroke: '#231409',
        strokeThickness: 4
      })
      .setScrollFactor(0)
      .setDepth(35)
      .setOrigin(0.5, 0.5)
      .setVisible(false);
    this.abilities = new AbilitySystem(this, this.gameManager.playerStats);
    this.combat = new CombatResolver(
      enemy => this.killEnemy(enemy),
      (amount, source) => this.gameManager.recordDamage(source, amount)
    );

    this.scenerySystem.create();
    this.chestSystem = new ChestSystem(this, this.scenerySystem.navigation);
    this.rareRocks = new RareRockSystem(this, this.scenerySystem.navigation, this.practiceRun ? new MarketProgress(null) : marketProgress, this.practiceRun);
    this.bossPowers = new BossPowerSystem(this);
    const summon = (variant: EnemyVariant, count: number, tint?: number) => this.summonAdds(variant, count, tint);
    this.runEvents = new RunEventSystem(this, this.scenerySystem.navigation);
    this.chestSystem.spawnCarrier = kind => this.runEvents.spawnElite(this.gameManager.level, this.gameManager.getDifficultyMinutes(),
      this.player.position, this.cameras.main, this.enemies, this.enemySpawner, kind);
    this.squirrelChief = new SquirrelChiefSystem(
      this,
      this.gameManager,
      this.scenerySystem.navigation,
      (damage, push) => this.knockPlayer(damage, push, 96),
      (origin, directions, speed) => {
        for (const d of directions) {
          this.acorns.push(
            new Acorn(
              this,
              origin.x,
              origin.y - 16,
              { x: d.x * speed, y: d.y * speed },
              SQUIRREL_CHIEF.contactDamage,
              SQUIRREL_CHIEF.tint
            )
          );
        }
      }
    );
    this.oven = new OvenBossSystem(this, this.gameManager, this.scenerySystem.navigation, summon);
    this.stag = new StagBossSystem(this, this.gameManager, this.scenerySystem.navigation,
      (damage, push, knockback) => this.knockPlayer(damage, push, knockback ?? STAG.chargeKnockback),
      (lanes, count) => this.runEvents.launchStampede(this.player.position, lanes, count, this.gameManager.level),
      (origin, directions) => {
        for (const d of directions) this.acorns.push(new Acorn(this, origin.x, origin.y - 40, { x: d.x * STAG.volleySpeed, y: d.y * STAG.volleySpeed }, STAG.volleyDamage, STAG_LOOK.velvet));
      });
    this.buzzard = new BuzzardBossSystem(this, this.gameManager, this.scenerySystem.navigation,
      (damage, push, knockback) => this.knockPlayer(damage, push, knockback),
      (origin, directions) => {
        for (const d of directions) this.acorns.push(new Acorn(this, origin.x, origin.y - 50, { x: d.x * BUZZARD.featherSpeed, y: d.y * BUZZARD.featherSpeed },
          BUZZARD.featherDamage, BUZZARD_LOOK.feather, { texture: LOOK.texture.feather, size: 26 }));
      });
    this.king = new KingBossSystem(this, this.gameManager, this.scenerySystem.navigation,
      (damage, push, knockback) => this.knockPlayer(damage, push, knockback ?? KING.rollKnockback),
      (origin, directions) => {
        for (const d of directions) this.acorns.push(new Acorn(this, origin.x, origin.y - 10, { x: d.x * KING.shardSpeed, y: d.y * KING.shardSpeed }, KING.shardDamage, 0xe8c070));
      }, summon);

    const hudRoot = document.getElementById('ui-root')!;
    const encounterHud = document.createElement('div');
    encounterHud.className = 'encounter-hud';
    encounterHud.append(...hudRoot.querySelectorAll('.boss-hud, .event-banner'));
    hudRoot.append(encounterHud);

    this.player = new PlayerController(
      this,
      this.gameManager.playerStats,
      this.selectedCharacter,
      WOODLAND_START.x,
      WOODLAND_START.y,
      this.scenerySystem.navigation
    );

    this.keys = {
      w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      space: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      shift: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT)
    };

    this.input.mouse?.disableContextMenu();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.destroyRunObjects();
      encounterHud.remove();
    });
    this.input.keyboard?.on('keydown-ESC', this.handleEscape);
    this.input.on('pointerdown', this.handlePointerDown);
    if (import.meta.env.DEV && new URLSearchParams(location.search).get('review') === 'gameover') this.input.keyboard?.on('keydown-F10', this.finishReviewRun);
    if (review !== null) this.setupReview(review);
    this.cameras.main.centerOn(this.player.position.x, this.player.position.y);
    (this.cameras.main as unknown as { preRender?: () => void }).preRender?.();
    if (!this.reviewNoEnemies) {
      this.enemySpawner.spawnOpeningPack(
        this.player.position,
        this.cameras.main,
        this.gameManager.getDifficultyMinutes(),
        this.enemies,
        BALANCE.spawner.openingPackCount
      );
    }
    this.presentation.update(0);
    this.abilities.sync(this.player.position, this.gameManager.wardStatus, this.gameManager.wardLeaves);
    this.scenerySystem.update(100, [this.player.position]);
  }

  private setupReview(review: string): void {
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
      this.gameManager.playerStats.hasMysteryCompanion = false;
      for (let i = 0; i < 6; i++) this.enemies.push(new EnemyController(this, 1800 + i * 25, 1600, 0, this.scenerySystem.navigation));
      this.reviewControls = document.createElement('div'); this.reviewControls.className = 'ability-review-controls';
      this.reviewControls.innerHTML = '<span data-boss-review></span><button>Spawn next boss</button><button>Defeat boss</button><button>Collect relic</button><button>Move east 1,000 px</button><button>Grant a level</button>';
      const buttons = this.reviewControls.querySelectorAll('button');
      buttons[0].onclick = () => this.spawnDueBoss(true);
      buttons[1].onclick = () => {
        const boss = this.enemies.find(enemy => enemy.isBoss && !enemy.isDead);
        if (this.gameManager.state === 'Playing' && boss) this.combat.damage(boss, boss.health / boss.vulnerability);
      };
      buttons[2].onclick = () => {
        const chest = this.chestSystem.drops.chests.find(chest => chest.kind === 'boss');
        if (this.gameManager.state === 'Playing' && chest) this.player.sprite.setPosition(chest.position.x, chest.position.y);
      };
      buttons[3].onclick = () => {
        if (this.gameManager.state !== 'Playing') return;
        const { x, y } = this.player.position;
        this.player.sprite.setPosition(x + 1000, y);
        this.cameras.main.centerOn(x + 1000, y);
      };
      buttons[4].onclick = () => this.gameManager.addXp(this.gameManager.xpToNextLevel - this.gameManager.xp);
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
      this.chestSystem.spawnCarrier = undefined;
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
      this.gameManager.level = 10;
      this.gameManager.playerStats.health = this.gameManager.playerStats.maxHealth = 10000;
      this.gameManager.playerStats.projectileDamage = 35;
      this.gameManager.playerStats.hasMysteryCompanion = true;
      this.gameManager.playerStats.hasMidnightCompanion = true;
      this.reviewControls = document.createElement('div'); this.reviewControls.className = 'ability-review-controls';
      this.reviewControls.innerHTML = '<span>OVEN REVIEW</span><button>Spawn Oven</button><button>Walk trail</button><button>Defeat boss</button><button>End run</button>';
      const buttons = this.reviewControls.querySelectorAll('button');
      buttons[0].onclick = () => { if (!this.oven.boss) this.spawnDueBoss(true); };
      buttons[1].onclick = () => { this.reviewWalking = !this.reviewWalking; buttons[1].textContent = this.reviewWalking ? 'Stop walking' : 'Walk trail'; };
      buttons[2].onclick = () => { if (this.gameManager.state === 'Playing' && this.oven.boss) this.combat.damage(this.oven.boss, this.oven.boss.health); };
      buttons[3].onclick = () => this.finishReviewRun();
      if (new URLSearchParams(location.search).get('look') === '1') {
        this.gameManager.level = 10;
        this.gameManager.playerStats.projectileDamage = 0;
        this.gameManager.playerStats.hasMysteryCompanion = false;
        this.gameManager.playerStats.hasMidnightCompanion = false;
        this.spawnDueBoss(true);
        this.oven.boss!.sprite.setPosition(1780, 1660);
      }
      document.body.append(this.reviewControls); return;
    }
    if (review === 'stag') {
      this.reviewNoEnemies = true;
      this.gameManager.level = this.gameManager.playerStats.level = 15;
      this.gameManager.playerStats.health = this.gameManager.playerStats.maxHealth = 10000;
      this.gameManager.playerStats.projectileDamage = 60;
      this.reviewControls = document.createElement('div'); this.reviewControls.className = 'ability-review-controls';
      this.reviewControls.innerHTML = '<span>STAG REVIEW</span><button>Spawn Wonky</button><button>Walk trail</button><button>Defeat boss</button><button>End run</button>';
      const buttons = this.reviewControls.querySelectorAll('button');
      buttons[0].onclick = () => { if (!this.stag.boss) this.spawnDueBoss(true); };
      buttons[1].onclick = () => { this.reviewWalking = !this.reviewWalking; buttons[1].textContent = this.reviewWalking ? 'Stop walking' : 'Walk trail'; };
      buttons[2].onclick = () => { if (this.gameManager.state === 'Playing' && this.stag.boss) this.combat.damage(this.stag.boss, this.stag.boss.health); };
      buttons[3].onclick = () => this.finishReviewRun();
      if (new URLSearchParams(location.search).get('look') === '1') {
        this.gameManager.level = 15; this.gameManager.playerStats.level = 15;
        this.gameManager.playerStats.projectileDamage = 0;
        this.spawnDueBoss(true);
        this.stag.boss!.sprite.setPosition(1420, 1660);
      }
      document.body.append(this.reviewControls); return;
    }
    if (review === 'buzzard') {
      this.reviewNoEnemies = true;
      this.gameManager.level = this.gameManager.playerStats.level = 25;
      this.gameManager.playerStats.health = this.gameManager.playerStats.maxHealth = 10000;
      this.gameManager.playerStats.projectileDamage = 90;
      this.reviewControls = document.createElement('div'); this.reviewControls.className = 'ability-review-controls';
      this.reviewControls.innerHTML = '<span>BUZZARD REVIEW</span><button>Spawn King Frankie</button><button>Walk trail</button><button>Defeat boss</button><button>End run</button><button>Send buzzards</button>';
      const buttons = this.reviewControls.querySelectorAll('button');
      buttons[0].onclick = () => { if (!this.buzzard.boss) this.spawnDueBoss(true); };
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
      this.gameManager.level = this.gameManager.playerStats.level = 30;
      this.gameManager.playerStats.health = this.gameManager.playerStats.maxHealth = 10000;
      this.gameManager.playerStats.projectileDamage = 90;
      this.reviewControls = document.createElement('div'); this.reviewControls.className = 'ability-review-controls';
      this.reviewControls.innerHTML = '<span>KING REVIEW</span><button>Spawn King Rumbles</button><button>Walk trail</button><button>Defeat boss</button><button>End run</button>';
      const buttons = this.reviewControls.querySelectorAll('button');
      buttons[0].onclick = () => { if (!this.king.boss) this.spawnDueBoss(true); };
      buttons[1].onclick = () => { this.reviewWalking = !this.reviewWalking; buttons[1].textContent = this.reviewWalking ? 'Stop walking' : 'Walk trail'; };
      buttons[2].onclick = () => { if (this.gameManager.state === 'Playing' && this.king.boss) this.combat.damage(this.king.boss, this.king.boss.health); };
      buttons[3].onclick = () => this.finishReviewRun();
      document.body.append(this.reviewControls); return;
    }
    if (review === 'events') {
      // Set pieces on demand; the regular spawner stays on so the crowd feels real.
      this.gameManager.level = 12; this.gameManager.playerStats.level = 12;
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
      this.gameManager.xpToNextLevel = xpThreshold(this.gameManager.level);
      this.gameManager.state = 'LevelUpPaused';
      this.reviewChoices = this.upgradeSystem.getReviewChoices(this.gameManager.playerStats);
    } else if (review === 'gameover') {
      this.gameManager.elapsedMs = 187000; this.gameManager.kills = 42; this.gameManager.level = 6;
      this.gameManager.xpToNextLevel = xpThreshold(6);
      this.gameManager.playerStats.health = 0; this.gameManager.state = 'GameOver';
    } else if (review === 'armadillo') {
      this.gameManager.level = 20; this.gameManager.xpToNextLevel = 100000;
      this.gameManager.playerStats.health = this.gameManager.playerStats.maxHealth = 100000;
      for (let i = 0; i < 6; i++) {
        const angle = i * 1.05;
        this.enemies.push(new EnemyController(this, 1600 + Math.cos(angle) * 240, 1600 + Math.sin(angle) * 240, 0, this.scenerySystem.navigation, undefined, 'armadillo'));
      }
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
      this.gameManager.level = 2;
      this.gameManager.xpToNextLevel = xpThreshold(this.gameManager.level);
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
      if (bossReadout) {
        const { x, y } = this.player.position;
        const foes = this.enemies.filter(e => !e.isDead && !e.isBoss).length;
        const relics = this.chestSystem.drops.chests.filter(c => c.kind === 'boss').length;
        bossReadout.textContent = `Level ${this.gameManager.level} · Foes ${foes} · ${this.bossEncounterActive ? 'Boss active' : 'Woods open'} · Position ${Math.round(x)}, ${Math.round(y)} · Relics ${relics}`;
      }
    }
    const snapshot = this.gameManager.getHudSnapshot();
    if (!this.simulateBossSchedule) {
      snapshot.nextBossRemainingMs = undefined;
      snapshot.nextBossName = undefined;
    }
    this.uiManager.update({ ...snapshot, dashCooldownRatio: this.dashCooldownRatio });
    this.uiManager.setPauseButtonState(this.gameManager.state === 'Paused');

    this.setPresentationPaused(this.gameManager.state !== 'Playing' || Boolean(this.debugSpriteSheetMenu?.isOpen));
    if (this.debugSpriteSheetMenu?.isOpen) {
      return;
    }

    if (this.gameManager.state === 'GameOver') {
      this.presentation.fadeHurtVignette(deltaMs);
      this.aimReticle.setVisible(false);
      this.showGameOverOnce();
      return;
    }

    if (this.gameManager.state === 'Paused') {
      this.presentation.fadeHurtVignette(deltaMs);
      this.aimReticle.setVisible(false);
      this.showPausedOnce();
      return;
    }

    if (this.gameManager.state === 'LevelUpPaused') {
      this.presentation.fadeHurtVignette(deltaMs);
      this.aimReticle.setVisible(false);
      this.showLevelUpOnce();
      return;
    }

    this.levelUpDisplayed = false;
    this.pausedDisplayed = false;
    this.gameManager.update(deltaMs);
    if (this.gameManager.consumeWakingReward()) {
      this.spawnFloatingNotice('Woods Awakened! +1 Reroll · +8 Gold', this.player.position);
      audioSystem.play('shrine');
      this.events.emit('presentation:level', this.player.position);
    }
    this.updateAimNotice(deltaMs);
    this.updateFloatingNotices(deltaMs);
    if (import.meta.env.DEV && this.reviewWalking) {
      this.reviewPathMs += deltaMs;
      const direction = Math.floor(this.reviewPathMs / 850) % 4;
      for (const [i, key] of [this.keys.d, this.keys.s, this.keys.a, this.keys.w].entries()) key.isDown = i === direction;
    } else if (import.meta.env.DEV && this.reviewPathMs) {
      for (const key of Object.values(this.keys)) key.isDown = false;
      this.reviewPathMs = 0;
    }
    this.player.update(deltaMs, this.readPlayerMoveInput());
    this.cosmetic.update(deltaMs, this.player.position, this.practiceRun ? null : marketProgress.equippedCosmetics);
    if (this.simulateBossSchedule) this.spawnDueBoss();
    const activeBoss = this.gameManager.bossSchedule.activeBoss;
    const mainBossActive = activeBoss !== undefined && activeBoss !== 'chief';
    this.cameraController.update(this.player.position);
    this.rareRocks.update(deltaMs, this.player.position, !mainBossActive);
    if (this.chestSystem.update(deltaMs, this.player.position, this.gameManager)) {
      this.setPresentationPaused(true);
      this.showLevelUpOnce();
      return;
    }
    const healthBefore = this.gameManager.playerStats.health;
    this.squirrelChief.update(deltaMs, this.player.position, this.player.radius);
    this.oven.update(deltaMs, this.player.position, this.player.radius);
    this.stag.update(deltaMs, this.player.position, this.player.radius);
    this.buzzard.update(deltaMs, this.player.position, this.player.radius);
    this.king.update(deltaMs, this.player.position, this.player.radius);
    this.syncBattleMusic();
    if (this.gameManager.playerStats.health < healthBefore) this.notifyPlayerHit();
    if (this.gameManager.state !== 'Playing') return;
    if (this.victoryInMs > 0) {
      this.victoryInMs -= deltaMs;
      if (this.victoryInMs <= 0) { this.showVictory(); return; }
    }

    const difficulty = this.gameManager.getDifficultyMinutes();
    if (!this.reviewNoEnemies) {
      this.enemySpawner.update(deltaMs, this.player.position, this.cameras.main, this.enemies, difficulty, this.gameManager.level);
    }
    // Keep normal waves going, and give the main boss attacks room between timed set pieces.
    const allowTimedEvents = !this.reviewNoEnemies && !mainBossActive;
    this.runEvents.update(deltaMs, allowTimedEvents, this.gameManager.level, difficulty, this.player.position, this.cameras.main, this.enemies, this.enemySpawner);
    for (const reward of this.runEvents.consumeShrineRewards()) {
      const hpBefore = this.gameManager.playerStats.health;
      this.gameManager.grantShrineReward(reward);
      const healed = Math.max(0, Math.round(this.gameManager.playerStats.health - hpBefore));
      const parts: string[] = [];
      if (healed > 0) parts.push(`+${healed} HP`);
      parts.push('Frenzy!');
      if (reward.bonusGold > 0) parts.push(`+${reward.bonusGold} Gold`);
      this.spawnFloatingNotice(parts.join(' · '), this.player.position);
    }
    if (this.gameManager.state !== 'Playing') return;
    this.updateManualAim();
    this.weaponSystem.update(
      deltaMs,
      this.player.position,
      this.gameManager.playerStats,
      this.enemies,
      this.projectiles,
      this.isManualAim ? this.getManualAimWorldPoint() : undefined
    );
    this.player.setAim(this.manualAimEnabled ? this.manualAimAngle : this.weaponSystem.aimAngle);
    if (this.weaponSystem.consumeShot()) this.player.kickArm();
    this.player.presentArm(deltaMs);

    const comboDamageMultiplier = this.gameManager.getComboDamageMultiplier();
    const dealPlayerDamage = (target: CombatTarget, amount: number, source?: DamageSourceId) =>
      this.combat.damage(target, amount * comboDamageMultiplier, source);
    this.abilities.update(deltaMs, this.player.position, this.enemies, this.xpOrbs, dealPlayerDamage);
    this.bossPowers.update(deltaMs, this.gameManager, this.player.position, this.enemies, dealPlayerDamage);
    for (const enemy of this.enemies) {
      enemy.update(deltaMs, this.player.position, difficulty);
      const throwVelocity = enemy.tryThrow(this.player.position);
      if (throwVelocity) this.acorns.push(new Acorn(this, enemy.position.x, enemy.position.y - 10, throwVelocity));
    }
    for (const acorn of this.acorns) {
      acorn.update(deltaMs);
      if (this.abilities.simulation.insideThornwall(acorn.position)) acorn.isDead = true;   // Thornwall stops thrown acorns
    }
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

    const magnetMultiplier = this.gameManager.playerStats.xpMagnetRangeMultiplier ?? 1;
    for (const orb of this.xpOrbs) {
      orb.update(deltaMs, this.player.position, magnetMultiplier);
    }

    const healthBeforeCollision = this.gameManager.playerStats.health;
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
    if (this.gameManager.playerStats.health < healthBeforeCollision) this.notifyPlayerHit();
    this.abilities.simulation.noteCollected(this.xpOrbs.filter(orb => orb.isCollected).length);
    if (this.abilities.simulation.pendingHeal > 0) {
      const stats = this.gameManager.playerStats;
      stats.health = Math.min(stats.maxHealth, stats.health + this.abilities.simulation.pendingHeal);
      this.abilities.simulation.pendingHeal = 0;
    }
    if (this.gameManager.consumeBarkBurst()) this.livingBarkBurst();
    this.abilities.sync(this.player.position, this.gameManager.wardStatus, this.gameManager.wardLeaves);
    this.presentation.update(deltaMs);
    this.damageNumbers.update(deltaMs);
    this.compass.update(deltaMs, this.cameras.main, this.collectCompassTargets());
    const subjects = [this.player.position, ...this.enemies.map(e => e.position), ...this.xpOrbs.map(o => o.position)];
    subjects.push(...this.companionSystem.positions);
    subjects.push(...this.chestSystem.positions);
    subjects.push(...this.rareRocks.positions);
    this.scenerySystem.update(deltaMs, subjects);

    this.cleanupCombatObjects();
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
      this.combat.damage(enemy, burstDamage, 'barkskin-ward');
    }
    this.events.emit('presentation:level', origin);
  }

  private killEnemy(enemy: CombatTarget): void {
    this.events.emit('presentation:defeat', enemy.position);
    this.abilities.simulation.noteKill(enemy.position);
    this.gameManager.recordKill();
    const bossId: BossId | undefined = enemy === this.squirrelChief.boss ? 'chief'
      : enemy === this.oven.boss ? 'oven' : enemy === this.stag.boss ? 'stag'
      : enemy === this.buzzard.boss ? 'buzzard' : enemy === this.king.boss ? 'king' : undefined;
    if (bossId) {
      this.bossSystem(bossId).defeated();
      const schedule = this.gameManager.bossSchedule;
      if (schedule.defeat(bossId, this.gameManager.elapsedMs)) {
        if (bossId === 'chief') {
          this.chestSystem.dropChest(enemy.position);
          this.gameManager.bonusGold += 3;
        } else if (this.upgradeSystem.getBossChoices(this.gameManager.playerStats).length > 0) {
          this.chestSystem.dropBoss(enemy.position);
        } else {
          this.chestSystem.dropChest(enemy.position);
        }
        if (schedule.storyFinished && !this.gameManager.victorious) {
          this.gameManager.victorious = true;
          this.victoryInMs = 4000;   // let the celebration and relic chest land first
        }
      }
      this.syncBattleMusic();
      audioSystem.play('boss-defeat');
    }
    const creature = enemy instanceof EnemyController ? enemy : undefined;
    if (creature?.elite) this.chestSystem.dropChest(enemy.position);
    if (bossId || creature?.elite || this.xpOrbs.length < BALANCE.xp.maxOrbs) {
      const xp = bossId === 'oven' ? OVEN.xp : bossId === 'stag' ? STAG.xp : bossId === 'buzzard' ? BUZZARD.xp : bossId === 'king' ? KING.xp : bossId === 'chief' ? SQUIRREL_CHIEF.xp : creature?.xpValue ?? BALANCE.enemy.xpValue;
      this.xpOrbs.push(new XPOrb(this, enemy.position.x, enemy.position.y, xp));
    }
  }

  private bossSystem(id: BossId) {
    switch (id) {
      case 'chief': return this.squirrelChief;
      case 'oven': return this.oven;
      case 'stag': return this.stag;
      case 'buzzard': return this.buzzard;
      case 'king': return this.king;
    }
  }

  private spawnDueBoss(skipCountdown = false): void {
    if (this.gameManager.state !== 'Playing') return;
    const { bossSchedule, elapsedMs } = this.gameManager;
    const elapsedForSpawn = skipCountdown ? elapsedMs + (bossSchedule.upcoming(elapsedMs)?.remainingMs ?? 0) : elapsedMs;
    const next = bossSchedule.startDue(elapsedForSpawn);
    if (!next) return;
    this.bossSystem(next.id).spawnEncounter(this.player.position, this.enemies, next.healthMultiplier);
    this.syncBattleMusic();
  }

  private get bossEncounterActive(): boolean {
    return this.enemies.some(enemy => enemy.isBoss && !enemy.isDead);
  }

  private syncBattleMusic(): void {
    audioSystem.setMusicMode(this.bossEncounterActive ? 'boss' : 'woods');
  }

  /** Apply a boss hit and knockback in world space. */
  private knockPlayer(damage: number, push: Vector2Like, distance: number): void {
    if (this.player.isDashing) return;
    this.gameManager.damagePlayer(damage);
    const { x, y } = this.player.position;
    this.player.sprite.setPosition(x + push.x * distance, y + push.y * distance);
  }

  /** Spread boss reinforcements around the player. */
  private summonAdds(variant: EnemyVariant, count: number, tint?: number): void {
    const center = this.player.position;
    const radius = 460;
    const offset = Math.random() * Math.PI * 2, minutes = this.gameManager.getDifficultyMinutes();
    for (let i = 0; i < count; i++) {
      const a = offset + i * Math.PI * 2 / count;
      const x = center.x + Math.cos(a) * radius, y = center.y + Math.sin(a) * radius;
      const add = new EnemyController(this, x, y, minutes, this.scenerySystem.navigation, undefined, variant, this.gameManager.level);
      if (tint !== undefined) add.setBaseTint(tint);
      this.enemies.push(add);
    }
  }

  private showVictory(): void {
    this.gameManager.pause();
    this.pausedDisplayed = true;   // this overlay stands in for the pause menu
    this.uiManager.showVictory(
      () => this.resumeFromPause(),
      () => {
        audioSystem.play('ui-click');
        this.uiManager.hideOverlay();
        this.gameManager.finishRun();
      }
    );
  }

  private showLevelUpOnce(): void {
    if (this.levelUpDisplayed) {
      return;
    }

    this.levelUpDisplayed = true;
    const bossReward = this.gameManager.upgradeSource === 'boss';
    const bossChoices = bossReward ? this.upgradeSystem.getBossChoices(this.gameManager.playerStats) : [];
    const useBossChoices = bossReward && bossChoices.length > 0;
    const source = useBossChoices ? 'boss' : (bossReward ? 'chest' : this.gameManager.upgradeSource);
    const choices = useBossChoices
      ? bossChoices
      : (this.reviewChoices ?? this.upgradeSystem.getChoices(this.gameManager.playerStats));
    this.reviewChoices = undefined;
    if (choices.length === 0) {
      this.levelUpDisplayed = false;
      this.gameManager.resumeAfterUpgrade();
      return;
    }
    const grewTo = this.gameManager.consumeCompanionGrowth();
    const stats = this.gameManager.playerStats;
    const note = grewTo
      ? `${COMPANION_NAMES[stats.companionId]} grew to rank ${grewTo} — ${describeCompanionRank(stats.companionId, grewTo, stats)}.`
      : undefined;
    this.uiManager.showLevelUp(
      choices,
      (choice) => {
        audioSystem.play('upgrade-pick');
        if (useBossChoices) this.upgradeSystem.applyBossUpgrade(choice, this.gameManager);
        else this.upgradeSystem.applyUpgrade(choice, this.gameManager.playerStats);
        this.abilities.sync(this.player.position, this.gameManager.wardStatus, this.gameManager.wardLeaves);
        this.levelUpDisplayed = false;
        this.gameManager.resumeAfterUpgrade();
        this.events.emit('presentation:level', this.player.position);
      },
      source,
      note,
      {
        rerollsRemaining: useBossChoices ? 0 : this.gameManager.rerollsRemaining,
        onReroll: useBossChoices
          ? undefined
          : () => {
              if (!this.gameManager.consumeReroll()) return undefined;
              audioSystem.play('ui-click');
              return this.upgradeSystem.getChoices(this.gameManager.playerStats);
            },
        onSkip: () => {
          audioSystem.play('ui-click');
          this.gameManager.skipUpgradeForBonus();
          this.abilities.sync(this.player.position, this.gameManager.wardStatus, this.gameManager.wardLeaves);
          this.levelUpDisplayed = false;
        }
      }
    );
  }

  private showPausedOnce(): void {
    if (this.pausedDisplayed) {
      return;
    }

    this.pausedDisplayed = true;
    this.uiManager.showPaused(() => this.resumeFromPause(), () => {
      if (this.gameManager.state !== 'Paused') return;
      audioSystem.play('ui-click');
      if (!this.practiceRun) marketProgress.settleRun(this.gameManager.runId, this.gameManager.level, this.gameManager.bonusGold);
      this.scene.start('StartScene', { skipReview: true });
    });
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
    audioSystem.play('ui-click');
  }

  private resumeFromPause(): void {
    audioSystem.play('ui-click');
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
    audioSystem.setMusicMode('woods');
    const settlement = this.practiceRun
      ? undefined
      : marketProgress.settleRun(this.gameManager.runId, this.gameManager.level, this.gameManager.bonusGold);
    this.uiManager.showGameOver(
      () => {
        audioSystem.play('ui-click');
        this.scene.restart({ characterId: this.selectedCharacter.id, weaponId: this.selectedWeaponId, skipReview: true });
      },
      () => {
        audioSystem.play('ui-click');
        this.scene.start('StartScene', { skipReview: true });
      },
      settlement ? {
        earned: settlement.goldEarned,
        balance: settlement.balance,
        saved: settlement.saved,
        onVisit: () => {
          audioSystem.play('ui-click');
          this.scene.start('MarketScene', { characterId: this.selectedCharacter.id, weaponId: this.selectedWeaponId });
        }
      } : undefined,
      this.gameManager.getDamageBreakdown()
    );
  }

  private setPresentationPaused(paused: boolean): void {
    if (paused === this.visualsPaused) return;
    this.visualsPaused = paused;
    if (paused) this.anims.pauseAll(); else this.anims.resumeAll();
  }

  private cleanupCombatObjects(): void {
    const player = this.player.position;
    const camera = this.cameras.main;
    // Keep several screens of combat around the player so a long walk frees up spawn and XP slots.
    const keepDistanceSq = Math.max(2800, Math.hypot(camera.width, camera.height) / (2 * camera.zoom) + 1200) ** 2;
    this.enemies = this.enemies.filter(enemy => {
      if (!enemy.isDead && (enemy.isBoss || distanceSq(player, enemy.position) <= keepDistanceSq * (enemy.elite ? 4 : 1))) return true;
      enemy.destroy();
      this.combat.release(enemy.id);
      return false;
    });
    for (const projectile of this.projectiles) {
      if (projectile.isDead) {
        projectile.destroy();
      }
    }
    this.projectiles = this.projectiles.filter((projectile) => !projectile.isDead);
    for (const acorn of this.acorns) if (acorn.isDead) acorn.destroy();
    this.acorns = this.acorns.filter(acorn => !acorn.isDead);

    this.xpOrbs = this.xpOrbs.filter(orb => {
      if (!orb.isCollected && distanceSq(player, orb.position) <= keepDistanceSq) return true;
      orb.destroy();
      return false;
    });
  }

  get dashCooldownRatio(): number {
    return this.player?.dashCooldownRatio ?? 0;
  }

  get isDashing(): boolean {
    return this.player?.isDashing ?? false;
  }

  get isManualAim(): boolean {
    return this.manualAimEnabled;
  }

  getManualAimWorldPoint(): Vector2Like | undefined {
    return this.manualAimEnabled && this.manualAimWorldPoint
      ? { ...this.manualAimWorldPoint }
      : undefined;
  }

  getManualAimAngle(): number | undefined {
    return this.manualAimEnabled ? this.manualAimAngle : undefined;
  }

  triggerDash(): boolean {
    if (this.gameManager.state !== 'Playing' || this.debugSpriteSheetMenu?.isOpen) return false;
    const move = this.readDirectionVector();
    return this.player.tryDash(move.x !== 0 || move.y !== 0 ? move : undefined);
  }

  toggleManualAim(): boolean {
    this.manualAimEnabled = !this.manualAimEnabled;
    this.updateManualAim();
    this.uiManager?.setAimMode(this.manualAimEnabled);
    audioSystem.play('ui-click');
    this.aimNoticeMs = 1300;
    this.aimNotice
      ?.setText(this.manualAimEnabled ? 'Manual Aim: ON' : 'Auto Aim')
      .setPosition(this.scale.width * 0.5, 92)
      .setAlpha(1)
      .setVisible(true);
    return this.manualAimEnabled;
  }

  private readDirectionVector(): Vector2Like {
    const pad = this.readGamepadInput();
    const touch = this.uiManager?.getTouchMoveVector() ?? { x: 0, y: 0 };
    const kx = Number(this.keys.d.isDown || this.keys.right.isDown)
      - Number(this.keys.a.isDown || this.keys.left.isDown);
    const ky = Number(this.keys.s.isDown || this.keys.down.isDown)
      - Number(this.keys.w.isDown || this.keys.up.isDown);
    const kMag = Math.hypot(kx, ky);
    const keyX = kMag > 0 ? kx / kMag : 0;
    const keyY = kMag > 0 ? ky / kMag : 0;
    const x = keyX + pad.x + touch.x;
    const y = keyY + pad.y + touch.y;
    const total = Math.hypot(x, y);
    return total > 1 ? { x: x / total, y: y / total } : { x, y };
  }

  private readPlayerMoveInput(): PlayerMoveInput {
    const pad = this.readGamepadInput();
    const padDashJustPressed = pad.dashDown && !this.gamepadDashHeld;
    this.gamepadDashHeld = pad.dashDown;
    const keyDashJustPressed =
      Phaser.Input.Keyboard.JustDown(this.keys.space) ||
      Phaser.Input.Keyboard.JustDown(this.keys.shift);
    const dir = this.readDirectionVector();
    return {
      x: dir.x,
      y: dir.y,
      dash: keyDashJustPressed || padDashJustPressed
    };
  }

  private readGamepadInput(): { x: number; y: number; dashDown: boolean } {
    let rawX = 0;
    let rawY = 0;
    let dashDown = false;

    const phaserPads = this.input.gamepad?.gamepads ?? [];
    for (const pad of phaserPads) {
      if (!pad || !pad.connected) continue;
      rawX += pad.leftStick.x + Number(pad.right) - Number(pad.left);
      rawY += pad.leftStick.y + Number(pad.down) - Number(pad.up);
      if (pad.A || pad.B || pad.isButtonDown(0) || pad.isButtonDown(1)) dashDown = true;
    }

    if (
      rawX === 0 &&
      rawY === 0 &&
      !dashDown &&
      typeof navigator !== 'undefined' &&
      typeof navigator.getGamepads === 'function'
    ) {
      const browserPads = navigator.getGamepads();
      for (const pad of browserPads) {
        if (!pad || !pad.connected) continue;
        const ax = pad.axes[0] ?? 0;
        const ay = pad.axes[1] ?? 0;
        const dpadX = Number(Boolean(pad.buttons[15]?.pressed)) - Number(Boolean(pad.buttons[14]?.pressed));
        const dpadY = Number(Boolean(pad.buttons[13]?.pressed)) - Number(Boolean(pad.buttons[12]?.pressed));
        rawX += ax + dpadX;
        rawY += ay + dpadY;
        if (pad.buttons[0]?.pressed || pad.buttons[1]?.pressed) dashDown = true;
      }
    }

    const mag = Math.hypot(rawX, rawY);
    if (mag < 0.2) return { x: 0, y: 0, dashDown };
    const scaled = Math.min(1, (mag - 0.2) / 0.8);
    return { x: (rawX / mag) * scaled, y: (rawY / mag) * scaled, dashDown };
  }

  private updateManualAim(): void {
    if (!this.manualAimEnabled) {
      this.aimReticle.setVisible(false);
      this.manualAimWorldPoint = undefined;
      return;
    }

    const pointer = this.input.activePointer;
    const camera = this.cameras.main;
    const sx = pointer ? pointer.x : camera.width * 0.5;
    const sy = pointer ? pointer.y : camera.height * 0.5;
    const world = camera.getWorldPoint(sx, sy);
    this.manualAimWorldPoint = { x: world.x, y: world.y };
    const dx = world.x - this.player.position.x;
    const dy = world.y - this.player.position.y;
    if (dx !== 0 || dy !== 0) {
      this.manualAimAngle = Math.atan2(dy, dx);
    }
    this.aimReticle
      .setPosition(world.x, world.y)
      .setRotation(reducedMotion() ? 0 : this.gameManager.elapsedMs * 0.0008)
      .setVisible(this.gameManager.state === 'Playing');
  }

  private updateAimNotice(deltaMs: number): void {
    if (!this.aimNotice || this.aimNoticeMs <= 0) return;
    this.aimNoticeMs = Math.max(0, this.aimNoticeMs - deltaMs);
    if (this.aimNoticeMs <= 0) {
      this.aimNotice.setVisible(false);
      return;
    }
    this.aimNotice
      .setPosition(this.scale.width * 0.5, 92)
      .setAlpha(this.aimNoticeMs < 350 ? this.aimNoticeMs / 350 : 1)
      .setVisible(true);
  }

  private notifyPlayerHit(): void {
    this.events.emit('presentation:hit', this.player.sprite);
    this.events.emit('presentation:player-hit');
    this.player.triggerHitBlink(BALANCE.player.contactInvulnerabilityMs);
  }

  private spawnFloatingNotice(label: string, position: Vector2Like, color = '#ffe59c'): void {
    const startY = position.y - 36;
    const text = this.add
      .text(position.x, startY, label, {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color,
        stroke: '#231409',
        strokeThickness: 4
      })
      .setDepth(34)
      .setOrigin(0.5, 0.5);
    this.floatingNotices.push({ text, ageMs: 0, lifeMs: 1400, startY });
  }

  private updateFloatingNotices(deltaMs: number): void {
    if (this.floatingNotices.length === 0) return;
    const calm = reducedMotion();
    this.floatingNotices = this.floatingNotices.filter((entry) => {
      entry.ageMs += deltaMs;
      if (entry.ageMs >= entry.lifeMs) {
        entry.text.destroy();
        return false;
      }
      const progress = entry.ageMs / entry.lifeMs;
      if (!calm) {
        entry.text.setY(entry.startY - progress * 28);
      }
      entry.text.setAlpha(progress > 0.65 ? Math.max(0, 1 - (progress - 0.65) / 0.35) : 1);
      return true;
    });
  }

  private collectCompassTargets(): CompassTarget[] {
    const targets: CompassTarget[] = [];
    for (const chest of this.chestSystem.drops.chests) {
      targets.push({
        x: chest.position.x,
        y: chest.position.y,
        kind: chest.kind === 'boss' ? 'relic' : 'chest'
      });
    }
    for (const shrine of this.runEvents.activeShrines) {
      targets.push({ x: shrine.position.x, y: shrine.position.y, kind: 'shrine' });
    }
    for (const rock of this.rareRocks.positions) {
      targets.push({ x: rock.x, y: rock.y, kind: 'rock' });
    }
    for (const enemy of this.enemies) {
      if (enemy.isDead || (!enemy.elite && !enemy.isBoss)) continue;
      targets.push({ ...enemy.position, kind: enemy.isBoss ? 'boss' : 'elite' });
    }
    return targets;
  }

  private createAimReticle(): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setDepth(33).setVisible(false);
    g.lineStyle(3.5, 0x231409, 0.85).strokeCircle(0, 0, 12);
    g.lineStyle(1.75, 0xf6e6b8, 0.95).strokeCircle(0, 0, 12);
    for (const [x1, y1, x2, y2] of [
      [-17, 0, -9, 0],
      [9, 0, 17, 0],
      [0, -17, 0, -9],
      [0, 9, 0, 17]
    ]) {
      g.lineStyle(3.5, 0x231409, 0.85).lineBetween(x1, y1, x2, y2);
      g.lineStyle(1.75, 0xf6e6b8, 0.95).lineBetween(x1, y1, x2, y2);
    }
    g.fillStyle(0xf6e6b8, 0.95).fillCircle(0, 0, 2.2);
    return g;
  }

  private destroyRunObjects(): void {
    this.reviewControls?.remove(); this.reviewControls = undefined;
    this.anims.resumeAll();
    this.input.keyboard?.off('keydown-ESC', this.handleEscape);
    this.input.keyboard?.off('keydown-F10', this.finishReviewRun);
    this.input.off('pointerdown', this.handlePointerDown);
    for (const notice of this.floatingNotices) {
      notice.text.destroy();
    }
    this.floatingNotices = [];
    this.debugSpriteSheetMenu?.destroy();
    this.uiManager?.destroy();
    this.companionSystem?.destroy();
    this.chestSystem?.destroy();
    this.rareRocks?.destroy();
    this.bossPowers?.destroy();
    this.abilities?.destroy();
    this.squirrelChief?.destroy();
    this.oven?.destroy();
    this.stag?.destroy();
    this.buzzard?.destroy();
    this.king?.destroy();
    this.runEvents?.destroy();
    this.player?.destroy();
    this.aimReticle?.destroy();
    this.aimNotice?.destroy();
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
    this.damageNumbers?.destroy();
    this.compass?.destroy();
    this.presentation?.destroy();
  }
}
