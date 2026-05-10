import Phaser from 'phaser';
import { BALANCE } from '../../config/balance';
import { GAME_CONFIG } from '../../config/gameConfig';
import { GameManager } from '../../core/GameManager';
import { EnemyController } from '../../entities/EnemyController';
import { PlayerController } from '../../entities/PlayerController';
import { Projectile } from '../../entities/Projectile';
import { XPOrb } from '../../entities/XPOrb';
import { CameraController } from '../camera/CameraController';
import { CollisionSystem } from '../../systems/CollisionSystem';
import { EnemySpawner } from '../../systems/EnemySpawner';
import { UpgradeSystem } from '../../systems/UpgradeSystem';
import { WeaponSystem } from '../../systems/WeaponSystem';
import { UIManager } from '../../ui/UIManager';

export class GameScene extends Phaser.Scene {
  private gameManager!: GameManager;
  private player!: PlayerController;
  private cameraController!: CameraController;
  private enemySpawner!: EnemySpawner;
  private weaponSystem!: WeaponSystem;
  private upgradeSystem!: UpgradeSystem;
  private collisionSystem!: CollisionSystem;
  private uiManager!: UIManager;
  private keys!: Record<'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private enemies: EnemyController[] = [];
  private projectiles: Projectile[] = [];
  private xpOrbs: XPOrb[] = [];
  private levelUpDisplayed = false;
  private gameOverDisplayed = false;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.gameManager = new GameManager();
    this.enemySpawner = new EnemySpawner(this);
    this.weaponSystem = new WeaponSystem(this);
    this.upgradeSystem = new UpgradeSystem();
    this.collisionSystem = new CollisionSystem();
    this.cameraController = new CameraController(this.cameras.main);
    this.uiManager = new UIManager(this.gameManager);

    this.createArenaBackdrop();

    this.player = new PlayerController(
      this,
      this.gameManager.playerStats,
      GAME_CONFIG.arena.width / 2,
      GAME_CONFIG.arena.height / 2
    );

    this.keys = {
      w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyRunObjects());
  }

  update(timeMs: number, deltaMs: number): void {
    this.uiManager.update(this.gameManager.getHudSnapshot());

    if (this.gameManager.state === 'GameOver') {
      this.showGameOverOnce();
      return;
    }

    if (this.gameManager.state === 'LevelUpPaused') {
      this.showLevelUpOnce();
      return;
    }

    this.levelUpDisplayed = false;
    this.gameManager.update(deltaMs);
    this.player.update(deltaMs, this.keys);
    this.cameraController.update(this.player.position);

    const difficulty = this.gameManager.getDifficultyMinutes();
    this.enemySpawner.update(deltaMs, this.player.position, this.cameras.main, this.enemies, difficulty);
    this.weaponSystem.update(
      deltaMs,
      this.player.position,
      this.gameManager.playerStats,
      this.enemies,
      this.projectiles
    );

    for (const enemy of this.enemies) {
      enemy.update(deltaMs, this.player.position, difficulty);
    }

    for (const projectile of this.projectiles) {
      projectile.update(deltaMs);
    }

    for (const orb of this.xpOrbs) {
      orb.update(deltaMs, this.player.position);
    }

    this.collisionSystem.update(
      timeMs,
      this.player,
      this.gameManager,
      this.enemies,
      this.projectiles,
      this.xpOrbs,
      (enemy) => this.killEnemy(enemy)
    );

    this.cleanupDeadObjects();
  }

  private createArenaBackdrop(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x171a13, 1);
    graphics.fillRect(0, 0, GAME_CONFIG.arena.width, GAME_CONFIG.arena.height);

    graphics.lineStyle(1, 0x24291e, 0.8);
    for (let x = 0; x <= GAME_CONFIG.arena.width; x += 160) {
      graphics.lineBetween(x, 0, x, GAME_CONFIG.arena.height);
    }
    for (let y = 0; y <= GAME_CONFIG.arena.height; y += 160) {
      graphics.lineBetween(0, y, GAME_CONFIG.arena.width, y);
    }

    graphics.lineStyle(8, 0x554936, 1);
    graphics.strokeRect(0, 0, GAME_CONFIG.arena.width, GAME_CONFIG.arena.height);
    graphics.setDepth(-20);
  }

  private killEnemy(enemy: EnemyController): void {
    if (!this.enemies.includes(enemy)) {
      return;
    }

    enemy.isDead = true;
    this.gameManager.addKill();
    if (this.xpOrbs.length < BALANCE.xp.maxOrbs) {
      this.xpOrbs.push(new XPOrb(this, enemy.sprite.x, enemy.sprite.y, BALANCE.enemy.xpValue));
    }

    enemy.destroy();
    this.enemies = this.enemies.filter((candidate) => candidate !== enemy);
  }

  private showLevelUpOnce(): void {
    if (this.levelUpDisplayed) {
      return;
    }

    this.levelUpDisplayed = true;
    const choices = this.upgradeSystem.getChoices();
    this.uiManager.showLevelUp(choices, (choice) => {
      this.upgradeSystem.applyUpgrade(choice, this.gameManager.playerStats);
      this.gameManager.resumeAfterUpgrade();
    });
  }

  private showGameOverOnce(): void {
    if (this.gameOverDisplayed) {
      return;
    }

    this.gameOverDisplayed = true;
    this.uiManager.showGameOver(() => this.scene.restart());
  }

  private cleanupDeadObjects(): void {
    for (const projectile of this.projectiles) {
      if (projectile.isDead) {
        projectile.destroy();
      }
    }
    this.projectiles = this.projectiles.filter((projectile) => !projectile.isDead);

    for (const orb of this.xpOrbs) {
      if (orb.isCollected) {
        orb.destroy();
      }
    }
    this.xpOrbs = this.xpOrbs.filter((orb) => !orb.isCollected);
  }

  private destroyRunObjects(): void {
    this.uiManager?.destroy();
    for (const enemy of this.enemies) {
      enemy.destroy();
    }
    for (const projectile of this.projectiles) {
      projectile.destroy();
    }
    for (const orb of this.xpOrbs) {
      orb.destroy();
    }
    this.enemies = [];
    this.projectiles = [];
    this.xpOrbs = [];
  }
}
