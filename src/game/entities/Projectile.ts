import Phaser from 'phaser';
import { LOOK } from '../config/presentation';
import { BALANCE } from '../config/balance';
import type { ExtraTargetMode, WeaponBehavior } from '../config/weapons';
import type { DamageSourceId, Vector2Like } from '../core/types';
import { ProjectileFlight } from '../core/ProjectileFlight';
import type { CombatTarget } from '../core/CombatResolver';
import { distanceSq, normalize } from '../utils/math';

let nextProjectileId = 1;

export type ProjectileBehavior = WeaponBehavior | 'burst';

export interface ProjectileOptions {
  extraTargets?: number;
  /** Chain Lightning tier: -1 none, 0 awakened, 1 ascended. */
  chainTier?: number;
  mode?: ExtraTargetMode;
  retention?: number;
  pierces?: number;
  pierceRetention?: number;
  radius?: number;
  texture?: string;
  displaySize?: number;
  trailColor?: number;
  behavior?: ProjectileBehavior;
  boomerangRange?: number;
  playerAnchor?: Vector2Like;
  splashRadius?: number;
  splashDamageRatio?: number;
  source?: DamageSourceId;
}

export class Projectile {
  readonly id = nextProjectileId++;
  radius: number;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly source: DamageSourceId;
  private readonly flight: ProjectileFlight;
  private readonly trailColor: number;
  private readonly options: ProjectileOptions;
  private readonly lifetime: number;
  private readonly spawnOrigin: Vector2Like;
  private readonly playerAnchor: Vector2Like;
  private readonly baseSpeed: number;
  private behavior: ProjectileBehavior;
  private boomerangPhase: 'outbound' | 'returning' = 'outbound';
  private pendingBurst?: { x: number; y: number; excludeId: number };
  private lifetimeLimitMs: number;
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
    this.lifetimeLimitMs = lifetimeMs;
    this.source = options.source ?? 'weapon';
    this.behavior = options.behavior ?? 'direct';
    this.spawnOrigin = { x, y };
    this.playerAnchor = options.playerAnchor ?? { x, y };
    this.baseSpeed = Math.hypot(velocity.x, velocity.y);
    this.flight = new ProjectileFlight(
      damage,
      extraTargets,
      options.mode ?? 'bounce',
      options.retention,
      options.chainTier ?? -1,
      options.pierces ?? 0,
      options.pierceRetention
    );
    const size = options.displaySize ?? 30;
    this.sprite = scene.add.sprite(x, y, options.texture ?? LOOK.texture.bolt).setDisplaySize(size, size);
    this.sprite.setDepth(15);
    this.sprite.setRotation(Math.atan2(velocity.y, velocity.x));
    if (this.behavior === 'burst') {
      this.sprite.setAlpha(0.55);
      this.sprite.setTint(0xffaa44);
    }
  }

  update(deltaMs: number): void {
    if (this.isDead) {
      return;
    }

    const dt = deltaMs / 1000;
    this.ageMs += deltaMs;

    if (this.behavior === 'boomerang') {
      this.updateBoomerang(dt);
    } else if (this.behavior === 'burst') {
      const fade = Math.max(0, 1 - this.ageMs / this.lifetimeLimitMs);
      this.sprite.setAlpha(0.55 * fade);
      if (this.ageMs >= this.lifetimeLimitMs) {
        this.isDead = true;
      }
      return;
    } else {
      this.sprite.setPosition(this.sprite.x + this.velocity.x * dt, this.sprite.y + this.velocity.y * dt);
    }

    this.trailMs += deltaMs;
    if (this.trailMs >= 45) { this.trailMs = 0; this.sprite.scene.events.emit('presentation:trail', this.position, this.trailColor); }

    if (this.ageMs >= this.lifetimeLimitMs) {
      if (this.behavior === 'lantern') {
        this.transformIntoBurst();
      } else {
        this.isDead = true;
      }
    }
  }

  private updateBoomerang(dt: number): void {
    const speed = this.baseSpeed || Math.hypot(this.velocity.x, this.velocity.y) || 480;
    const maxRange = this.options.boomerangRange ?? 270;

    if (this.boomerangPhase === 'outbound') {
      const distOut = Math.hypot(this.sprite.x - this.spawnOrigin.x, this.sprite.y - this.spawnOrigin.y);
      const progress = Math.min(1, distOut / maxRange);
      // Curve progressively near the apex before turning back so initial aim stays accurate.
      const turnRate = progress > 0.55 ? 2.4 * ((progress - 0.55) / 0.45) : 0.22;
      const curAngle = Math.atan2(this.velocity.y, this.velocity.x) + turnRate * dt;
      this.velocity.x = Math.cos(curAngle) * speed;
      this.velocity.y = Math.sin(curAngle) * speed;
      this.sprite.setPosition(this.sprite.x + this.velocity.x * dt, this.sprite.y + this.velocity.y * dt);

      if (distOut >= maxRange) {
        this.boomerangPhase = 'returning';
        // Reset hit list at turnaround so enemies can be struck on both passes.
        this.flight.hitEnemyIds.clear();
      }
    } else {
      const toPlayer = normalize(this.playerAnchor.x - this.sprite.x, this.playerAnchor.y - this.sprite.y);
      const distHome = Math.hypot(this.playerAnchor.x - this.sprite.x, this.playerAnchor.y - this.sprite.y);
      // Blend slight lateral sweep while far out, homing sharply as it approaches the player.
      const perp = { x: -toPlayer.y, y: toPlayer.x };
      const arcWeight = distHome > 90 ? 0.35 : 0;
      const desired = normalize(toPlayer.x + perp.x * arcWeight, toPlayer.y + perp.y * arcWeight);
      const returnSpeed = speed * 1.1;
      this.velocity.x = desired.x * returnSpeed;
      this.velocity.y = desired.y * returnSpeed;
      this.sprite.setPosition(this.sprite.x + this.velocity.x * dt, this.sprite.y + this.velocity.y * dt);

      const catchRadius = Math.max(24, this.radius + 14);
      if (this.ageMs > 180 && distanceSq(this.position, this.playerAnchor) <= catchRadius * catchRadius) {
        this.isDead = true;
      }
    }

    this.sprite.setRotation(this.sprite.rotation + dt * 16);
  }

  private transformIntoBurst(): void {
    const splashRadius = this.options.splashRadius ?? 84;
    const splashRatio = this.options.splashDamageRatio ?? 0.75;
    this.behavior = 'burst';
    this.radius = splashRadius;
    this.flight.damage = Math.max(1, Math.round(this.flight.damage * splashRatio));
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.ageMs = 0;
    this.lifetimeLimitMs = 120;
    this.sprite.setDisplaySize(splashRadius * 2, splashRadius * 2);
    this.sprite.setAlpha(0.55);
    this.sprite.setTint(0xffaa44);
    this.sprite.scene.events.emit('presentation:trail', this.position, 0xff9e3d);
  }

  markHit(enemyId: number, enemies: CombatTarget[]): void {
    if (this.behavior === 'boomerang') {
      this.flight.hitEnemyIds.add(enemyId);
      return;
    }
    if (this.behavior === 'burst') {
      this.flight.hitEnemyIds.add(enemyId);
      return;
    }
    if (this.behavior === 'lantern') {
      this.flight.hitEnemyIds.add(enemyId);
      this.pendingBurst = { x: this.sprite.x, y: this.sprite.y, excludeId: enemyId };
      const direction = this.flight.hit(enemyId, this.position, enemies, this.velocity);
      if (!direction) {
        this.isDead = true;
        return;
      }
      const speed = Math.hypot(this.velocity.x, this.velocity.y);
      this.velocity.x = direction.x * speed;
      this.velocity.y = direction.y * speed;
      this.sprite.setRotation(Math.atan2(this.velocity.y, this.velocity.x));
      return;
    }

    const direction = this.flight.hit(enemyId, this.position, enemies, this.velocity);
    if (!direction) { this.isDead = true; return; }
    const speed = Math.hypot(this.velocity.x, this.velocity.y);
    this.velocity.x = direction.x * speed; this.velocity.y = direction.y * speed;
    this.sprite.setRotation(Math.atan2(this.velocity.y, this.velocity.x));
  }

  /** Chain Lightning & Lantern ember splash: spawn any secondary projectiles owed. */
  spawnSplits(projectiles: Projectile[]): void {
    if (this.pendingBurst) {
      const burstInfo = this.pendingBurst;
      this.pendingBurst = undefined;
      const splashRadius = this.options.splashRadius ?? 84;
      const splashRatio = this.options.splashDamageRatio ?? 0.75;
      const splashDamage = Math.max(1, Math.round(this.flight.damage * splashRatio));
      const burst = new Projectile(
        this.sprite.scene,
        burstInfo.x,
        burstInfo.y,
        { x: 0, y: 0 },
        120,
        splashDamage,
        0,
        {
          behavior: 'burst',
          radius: splashRadius,
          texture: this.options.texture,
          displaySize: splashRadius * 2,
          trailColor: this.trailColor,
          source: this.source
        }
      );
      burst.hitEnemyIds.add(burstInfo.excludeId);
      this.sprite.scene.events.emit('presentation:trail', { x: burstInfo.x, y: burstInfo.y }, 0xff9e3d);
      projectiles.push(burst);
    }

    const split = this.flight.pendingSplit;
    if (!split) return;
    this.flight.pendingSplit = undefined;
    const speed = Math.hypot(this.velocity.x, this.velocity.y);
    for (const direction of split.directions) {
      const child = new Projectile(this.sprite.scene, this.sprite.x, this.sprite.y,
        { x: direction.x * speed, y: direction.y * speed }, this.lifetime, split.damage, split.bounces, { ...this.options, chainTier: -1, retention: 1, mode: 'bounce', pierces: 0, behavior: 'direct' });
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
