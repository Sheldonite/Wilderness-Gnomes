import Phaser from 'phaser';
import { OVEN, OVEN_LOOK } from '../config/ovenBoss';
import { OVEN_TEXTURE } from '../config/ovenSprite';
import { reducedMotion } from '../config/presentation';
import { OvenWalk } from '../core/OvenWalk';
import type { OvenEncounter } from '../core/OvenEncounter';
import type { SceneryNavigation } from '../core/SceneryNavigation';
import type { Vector2Like } from '../core/types';
import { EnemyController } from './EnemyController';

export class OvenBoss extends EnemyController {
  private readonly walk = new OvenWalk();
  private appliedTint?: number;

  constructor(
    scene: Phaser.Scene,
    point: Vector2Like,
    navigation: SceneryNavigation,
    private readonly encounter: OvenEncounter,
    health: number = OVEN.health
  ) {
    super(scene, point.x, point.y, 0, navigation, {
      texture: OVEN_TEXTURE,
      radius: OVEN.radius,
      scale: OVEN_LOOK.height / scene.textures.getFrame(OVEN_TEXTURE, 0).realHeight,
      animation: 'oven-walk',
      shadow: { foot: 0, width: OVEN_LOOK.shadowWidth, height: OVEN_LOOK.shadowHeight, alpha: 1, contactAlpha: 0.3 },
      boss: { contactDamage: OVEN.contactDamage }
    });
    this.health = this.maxHealth = health;
    this.sprite.anims.stop();
    this.sprite.setFrame(2).setOrigin(0.5, 1).setDepth(18);
  }

  /** Mid-air during Toaster Leap Slam, the Oven flies over the ground instead of body-checking. */
  override get contactDamage(): number {
    return this.encounter.phase === 'slamming' && this.encounter.slamArc > 0.2 ? 0 : OVEN.contactDamage;
  }

  override update(deltaMs: number, target: Vector2Like): void {
    if (this.isDead) return;
    const phase = this.encounter.phase;
    this.vulnerability = this.encounter.vulnerable ? OVEN.overheatVulnerability : 1;
    this.sprite.setAngle(0);

    // Update base tint only on state changes so PresentationSystem hit-flashes are never clobbered.
    const desiredTint = this.encounter.vulnerable
      ? OVEN_LOOK.overheatTint
      : this.encounter.hot
        ? OVEN_LOOK.hotTint
        : undefined;
    if (desiredTint !== this.appliedTint) {
      this.appliedTint = desiredTint;
      if (desiredTint !== undefined) {
        this.setBaseTint(desiredTint);
      } else {
        this.sprite.setData('tint', undefined);
        this.sprite.clearTint();
      }
    }

    if (phase === 'slamming') {
      const ground = this.encounter.slamPosition ?? this.position;
      this.sprite.setPosition(ground.x, ground.y);
      const arcPx = this.encounter.slamArc * OVEN_LOOK.slamJumpHeight;
      const displayHeight = Math.max(1, this.sprite.displayHeight || OVEN_LOOK.height);
      this.sprite.setOrigin(0.5, 1 + arcPx / displayHeight);
      this.sprite.anims.stop();
      this.sprite.setFrame(this.encounter.slamArc > 0.25 ? 5 : 4);
      const slamDirX = this.encounter.slam ? this.encounter.slam.target.x - this.encounter.slam.start.x : target.x - ground.x;
      if (Math.abs(slamDirX) > 0.01) this.sprite.setFlipX(slamDirX > 0);
      return;
    }

    this.sprite.setOrigin(0.5, 1);

    if (phase === 'overheated') {
      this.sprite.anims.stop();
      this.sprite.setFrame(5);
      if (!reducedMotion()) this.sprite.setAngle(Math.sin(performance.now() / 85) * 3);
      return;
    }

    if (phase !== 'walking') {
      this.sprite.anims.stop();
      this.sprite.setFrame(phase === 'windup' ? 4 : phase === 'throwing' || phase === 'blasting' ? 5 : 2);
      if (phase === 'windup' || phase === 'blasting') {
        const faceX = this.encounter.cone ? this.encounter.cone.direction.x : target.x - this.sprite.x;
        if (Math.abs(faceX) > 0.01) this.sprite.setFlipX(faceX > 0);
      }
      return;
    }

    const before = this.position;
    const remaining = Math.max(0, Math.hypot(target.x - before.x, target.y - before.y) - OVEN.standOff);
    const speed = OVEN.speed * (this.encounter.hot ? OVEN.hotSpeedMultiplier : 1) * this.effectiveSlow;
    const next = this.navigation!.toward(before, target, Math.min(remaining, speed * deltaMs / 1000), this.radius, this.route);
    this.sprite.setPosition(next.x, next.y);
    this.sprite.anims.stop();
    const dx = next.x - before.x;
    const dy = next.y - before.y;
    this.sprite.setFrame(this.walk.update(dx, dy));
    if (Math.hypot(dx, dy) >= 0.01) {
      this.sprite.setFlipX(this.walk.flipX);
    } else if (Math.abs(target.x - next.x) > 0.01) {
      this.sprite.setFlipX(target.x > next.x);
    }
  }
}
