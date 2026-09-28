import Phaser from 'phaser';
import { BUZZARD, BUZZARD_LOOK } from '../config/buzzardBoss';
import { KING_FRANKIE_DIVE_KEY, KING_FRANKIE_FLAP_KEY, KING_FRANKIE_SPRITE_KEY } from '../config/frankieKeys';
import type { BuzzardEncounter } from '../core/BuzzardEncounter';
import type { SceneryNavigation } from '../core/SceneryNavigation';
import type { Vector2Like } from '../core/types';
import { EnemyController } from './EnemyController';
import { spriteHeading } from '../utils/math';

/**
 * King Frankie: a great crowned buzzard, seen from above as he soars. He turns to face where he
 * flies, his shadow falls well below him to show his height, and he flies over scenery rather than
 * around it. The encounter decides; the entity moves and draws.
 */
export class BuzzardBoss extends EnemyController {
  constructor(scene: Phaser.Scene, point: Vector2Like, navigation: SceneryNavigation, private readonly encounter: BuzzardEncounter, health: number = BUZZARD.health) {
    super(scene, point.x, point.y, 0, navigation, { texture: KING_FRANKIE_SPRITE_KEY, radius: BUZZARD.radius, scale: BUZZARD_LOOK.scale,
      animation: KING_FRANKIE_FLAP_KEY, shadow: { foot: BUZZARD_LOOK.shadowDrop, width: 130, height: 34, alpha: .45 },
      boss: { contactDamage: BUZZARD.contactDamage } });
    this.health = this.maxHealth = health;
    this.sprite.setDepth(26);
  }

  /** He cannot body-check you while he is up in the air. */
  override get contactDamage(): number { return this.encounter.airborne ? 0 : BUZZARD.contactDamage; }

  override update(deltaMs: number): void {
    if (this.isDead) return;
    const phase = this.encounter.phase;
    this.vulnerability = this.encounter.vulnerability;
    const before = this.position;
    if (phase === 'diving') {
      const step = this.encounter.diveStep;
      this.sprite.setPosition(before.x + step.x, before.y + step.y);
      this.face(step.x, step.y);
      this.sprite.play(KING_FRANKIE_DIVE_KEY, true);
      return;
    }
    if (phase === 'perched') {
      // Down low, wings spread, catching his breath.
      this.sprite.anims.stop(); this.sprite.setFrame(0);
      return;
    }
    const target = this.encounter.flyTarget;
    const dx = target.x - before.x, dy = target.y - before.y, distance = Math.hypot(dx, dy);
    const step = Math.min(distance, BUZZARD.flySpeed * this.effectiveSlow * deltaMs / 1000);
    if (distance > .01) this.sprite.setPosition(before.x + dx / distance * step, before.y + dy / distance * step);
    if (phase === 'diveWindup' && this.encounter.lane) this.face(this.encounter.lane.direction.x, this.encounter.lane.direction.y);
    else if (distance > 2) this.face(dx, dy);
    if (phase === 'diveWindup') { this.sprite.anims.stop(); this.sprite.setFrame(10); }
    else this.sprite.play(KING_FRANKIE_FLAP_KEY, true);
  }

  /** The sheet faces right and is seen from above: turn him to his heading. */
  private face(dx: number, dy: number): void {
    const pose = spriteHeading(dx, dy);
    this.sprite.setFlipX(pose.flipX).setRotation(pose.rotation);
  }
}
