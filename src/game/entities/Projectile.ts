import Phaser from 'phaser';
import { LOOK } from '../config/presentation';
import { BALANCE } from '../config/balance';
import type { Vector2Like } from '../core/types';
import { ProjectileFlight } from '../core/ProjectileFlight';
import type { CombatTarget } from '../core/CombatResolver';

let nextProjectileId = 1;

export class Projectile {
  readonly id = nextProjectileId++;
  readonly radius = BALANCE.weapon.projectileRadius;
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly flight: ProjectileFlight;
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
    bounces = 0
  ) {
    this.flight = new ProjectileFlight(damage, bounces);
    this.sprite = scene.add.sprite(x, y, LOOK.texture.bolt).setDisplaySize(30, 30);
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
    if (this.trailMs >= 45) { this.trailMs = 0; this.sprite.scene.events.emit('presentation:trail', this.position); }

    if (this.ageMs >= this.lifetimeMs) {
      this.isDead = true;
    }
  }

  markHit(enemyId: number, enemies: CombatTarget[]): void {
    const direction = this.flight.hit(enemyId, this.position, enemies);
    if (!direction) { this.isDead = true; return; }
    const speed = Math.hypot(this.velocity.x, this.velocity.y);
    this.velocity.x = direction.x * speed; this.velocity.y = direction.y * speed;
    this.sprite.setRotation(Math.atan2(this.velocity.y, this.velocity.x));
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
