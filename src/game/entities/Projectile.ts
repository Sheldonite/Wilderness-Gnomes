import Phaser from 'phaser';
import { LOOK } from '../config/presentation';
import { BALANCE } from '../config/balance';
import type { ExtraTargetMode } from '../config/weapons';
import type { Vector2Like } from '../core/types';
import { ProjectileFlight } from '../core/ProjectileFlight';
import type { CombatTarget } from '../core/CombatResolver';

let nextProjectileId = 1;

export interface ProjectileOptions {
  extraTargets?: number;
  /** Chain Lightning tier: -1 none, 0 awakened, 1 ascended. */
  chainTier?: number;
  mode?: ExtraTargetMode;
  retention?: number;
  radius?: number;
  texture?: string;
  displaySize?: number;
  trailColor?: number;
}

export class Projectile {
  readonly id = nextProjectileId++;
  readonly radius: number;
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly flight: ProjectileFlight;
  private readonly trailColor: number;
  private readonly options: ProjectileOptions;
  private readonly lifetime: number;
  ageMs = 0;
  isDead = false;
  private trailMs = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly velocity: Vector2Like,
    private readonly lifetimeMs: number,
    damage: number,
    extraTargets = 0,
    options: ProjectileOptions = {}
  ) {
    this.radius = options.radius ?? BALANCE.weapon.projectileRadius;
    this.trailColor = options.trailColor ?? LOOK.color.spell;
    this.options = options;
    this.lifetime = lifetimeMs;
    this.flight = new ProjectileFlight(
      damage,
      extraTargets,
      options.mode ?? 'bounce',
      options.retention,
      options.chainTier ?? -1
    );
    const size = options.displaySize ?? 30;
    this.sprite = scene.add.sprite(x, y, options.texture ?? LOOK.texture.bolt).setDisplaySize(size, size);
    this.sprite.setDepth(15);
    this.sprite.setRotation(Math.atan2(velocity.y, velocity.x));
  }

  update(deltaMs: number): void {
    if (this.isDead) {
      return;
    }

    const dt = deltaMs / 1000;
    this.sprite.setPosition(this.sprite.x + this.velocity.x * dt, this.sprite.y + this.velocity.y * dt);
    this.ageMs += deltaMs;
    this.trailMs += deltaMs;
    if (this.trailMs >= 45) { this.trailMs = 0; this.sprite.scene.events.emit('presentation:trail', this.position, this.trailColor); }

    if (this.ageMs >= this.lifetimeMs) {
      this.isDead = true;
    }
  }

  markHit(enemyId: number, enemies: CombatTarget[]): void {
    const direction = this.flight.hit(enemyId, this.position, enemies, this.velocity);
    if (!direction) { this.isDead = true; return; }
    const speed = Math.hypot(this.velocity.x, this.velocity.y);
    this.velocity.x = direction.x * speed; this.velocity.y = direction.y * speed;
    this.sprite.setRotation(Math.atan2(this.velocity.y, this.velocity.x));
  }

  /** Chain Lightning: spawn the seeking bolts this projectile owes, if any. */
  spawnSplits(projectiles: Projectile[]): void {
    const split = this.flight.pendingSplit;
    if (!split) return;
    this.flight.pendingSplit = undefined;
    const speed = Math.hypot(this.velocity.x, this.velocity.y);
    for (const direction of split.directions) {
      const child = new Projectile(this.sprite.scene, this.sprite.x, this.sprite.y,
        { x: direction.x * speed, y: direction.y * speed }, this.lifetime, split.damage, split.bounces, { ...this.options, chainTier: -1, retention: 1 });
      for (const id of this.flight.hitEnemyIds) child.hitEnemyIds.add(id);
      child.sprite.setDisplaySize(this.sprite.displayWidth * .7, this.sprite.displayHeight * .7);
      projectiles.push(child);
    }
  }

  get hitEnemyIds(): Set<number> { return this.flight.hitEnemyIds; }
  get damage(): number { return this.flight.damage; }

  destroy(): void {
    this.sprite.destroy();
  }

  get position(): Vector2Like {
    return { x: this.sprite.x, y: this.sprite.y };
  }
}
