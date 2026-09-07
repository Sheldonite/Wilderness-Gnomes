import Phaser from 'phaser';
import { OvenBossSystem } from '../../systems/OvenBossSystem';
import { OVEN } from '../../config/ovenBoss';
import { BALANCE } from '../../config/balance';
import { GAME_CONFIG } from '../../config/gameConfig';
import { getPlayerCharacter, type PlayerCharacterDefinition } from '../../config/playerCharacters';
import { getWeapon } from '../../config/weapons';
import type { WeaponId } from '../../core/types';
import { GameManager } from '../../core/GameManager';
import { EnemyController } from '../../entities/EnemyController';
import { PlayerController } from '../../entities/PlayerController';
import { Projectile } from '../../entities/Projectile';
import { XPOrb } from '../../entities/XPOrb';
import { Acorn } from '../../entities/Acorn';
import { CameraController } from '../camera/CameraController';
import { CompanionSystem } from '../../systems/CompanionSystem';
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
  private weaponSystem!: WeaponSystem;
  private upgradeSystem!: UpgradeSystem;
  private collisionSystem!: CollisionSystem;
  private uiManager!: UIManager;
  private debugSpriteSheetMenu?: DebugSpriteSheetMenu;
  private presentation!: PresentationSystem;
  private abilities!: AbilitySystem;
  private combat!: CombatResolver;
  private oven!: OvenBossSystem;
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
    this.oven = new OvenBossSystem(this, this.gameManager, this.scenerySystem.navigation);

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
    this.abilities.sync(this.player.position, this.gameManager.wardStatus);
    this.scenerySystem.update(100, [this.player.position]);
  }

  private setupReview(): void {
    const review = new URLSearchParams(location.search).get('review');
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
      const rank = Math.min(3, Math.max(1, Number.isFinite(requestedRank) ? Math.floor(requestedRank) : 3)) as AbilityRank;
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
        for (const ability of chosen) this.gameManager.playerStats.abilityRanks[ability] = (displayRank - 1) as AbilityRank;
        this.reviewChoices = this.upgradeSystem.getAvailable(this.gameManager.playerStats).filter(u =>
          (id && ABILITY_IDS.includes(id)) ? u.id === id : ['ricochet-charm', 'firefly-orbit', 'mystery-double-pounce'].includes(u.id));
        // Always render three real offers, including a requested ability if supplied.
        for (const offer of this.upgradeSystem.getAvailable(this.gameManager.playerStats)) {
          if (this.reviewChoices.length >= 3) break;
          if (!this.reviewChoices.some(u => u.id === offer.id)) this.reviewChoices.push(offer);
        }
        this.gameManager.level = 2;
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
      this.gameManager.xpToNextLevel = Math.ceil(BALANCE.leveling.baseThreshold * Math.pow(BALANCE.leveling.thresholdGrowth, 5));
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
    this.cameraController.update(this.player.position);
    this.oven.update(deltaMs, this.player.position, this.player.radius, this.enemies);
    if (this.gameManager.state !== 'Playing') return;

    const difficulty = this.gameManager.getDifficultyMinutes();
    if (!this.reviewNoEnemies) this.enemySpawner.update(deltaMs, this.player.position, this.cameras.main, this.enemies, difficulty, this.gameManager.level);
    this.weaponSystem.update(
      deltaMs,
      this.player.position,
      this.gameManager.playerStats,
      this.enemies,
      this.projectiles
    );
    this.player.setAim(this.weaponSystem.aimAngle);

    this.abilities.update(deltaMs, this.player.position, this.enemies, this.xpOrbs, this.combat.damage);
    for (const enemy of this.enemies) {
      enemy.update(deltaMs, this.player.position, difficulty);
      const throwVelocity = enemy.tryThrow(this.player.position);
      if (throwVelocity) this.acorns.push(new Acorn(this, enemy.position.x, enemy.position.y - 10, throwVelocity));
    }
    for (const acorn of this.acorns) {
      acorn.update(deltaMs);
    }

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
    this.abilities.sync(this.player.position, this.gameManager.wardStatus);
    this.presentation.update(deltaMs);
    const subjects = [this.player.position, ...this.enemies.map(e => e.position), ...this.xpOrbs.map(o => o.position)];
    subjects.push(...this.companionSystem.positions);
    this.scenerySystem.update(deltaMs, subjects);

    this.cleanupDeadObjects();
    if (import.meta.env.DEV && this.reviewKeepCrowdPickups) {
      while (this.xpOrbs.length < BALANCE.xp.maxOrbs) {
        const i = this.xpOrbs.length;
        this.xpOrbs.push(new XPOrb(this, 1600 + Math.cos(i * 2.4) * (220 + i % 20 * 12), 1600 + Math.sin(i * 2.4) * (220 + i % 20 * 12), 8));
      }
    }
  }

  private killEnemy(enemy: CombatTarget): void {
    this.events.emit('presentation:defeat', enemy.position);
    this.gameManager.addKill();
    const isBoss = enemy === this.oven.boss;
    if (isBoss) this.oven.defeated();
    if (isBoss || this.xpOrbs.length < BALANCE.xp.maxOrbs) {
      this.xpOrbs.push(new XPOrb(this, enemy.position.x, enemy.position.y, isBoss ? OVEN.xp : BALANCE.enemy.xpValue));
    }

  }

  private showLevelUpOnce(): void {
    if (this.levelUpDisplayed) {
      return;
    }

    this.levelUpDisplayed = true;
    const choices = this.reviewChoices ?? this.upgradeSystem.getChoices(this.gameManager.playerStats);
    this.reviewChoices = undefined;
    this.uiManager.showLevelUp(choices, (choice) => {
      this.upgradeSystem.applyUpgrade(choice, this.gameManager.playerStats);
      this.abilities.sync(this.player.position, this.gameManager.wardStatus);
      this.levelUpDisplayed = false;
      this.gameManager.resumeAfterUpgrade();
      this.events.emit('presentation:level', this.player.position);
    });
  }

  private showPausedOnce(): void {
    if (this.pausedDisplayed) {
      return;
    }

    this.pausedDisplayed = true;
    this.uiManager.showPaused(() => this.resumeFromPause());
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
    this.abilities?.destroy();
    this.oven?.destroy();
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
