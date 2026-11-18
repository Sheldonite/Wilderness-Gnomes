import Phaser from 'phaser';
import { KING, KING_LOOK } from '../config/kingBoss';
import { ARMADILLO_ROLL_ANIMATION, ARMADILLO_ROLL_KEY, ARMADILLO_SPRITE_KEY, ARMADILLO_WALK_ANIMATION_BY_DIRECTION } from '../config/enemySprite';
import type { KingEncounter } from '../core/KingEncounter';
import { bossPursuitStep } from '../core/BossPursuit';
import type { SceneryNavigation } from '../core/SceneryNavigation';
import type { Vector2Like } from '../core/types';
import { normalize } from '../utils/math';
import { EnemyController } from './EnemyController';

/** A giant gilded armadillo with a little crown. The encounter decides; the entity moves and draws. */
export class KingBoss extends EnemyController {
  private readonly crown: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene, point: Vector2Like, navigation: SceneryNavigation, private readonly encounter: KingEncounter, health: number = KING.health) {
    super(scene, point.x, point.y, 0, navigation, { texture: ARMADILLO_SPRITE_KEY, radius: KING.radius, scale: KING_LOOK.scale,
      animation: ARMADILLO_WALK_ANIMATION_BY_DIRECTION['0,1'], boss: { contactDamage: KING.contactDamage } }, 'armadillo');
    this.health = this.maxHealth = health;
    this.sprite.setDepth(18);
    this.setBaseTint(KING_LOOK.tint);
    this.crown = scene.add.graphics().setDepth(19);
    this.crown.fillStyle(0x5a3a10).fillRect(-17, -2, 34, 9);
    this.crown.fillStyle(KING_LOOK.crown).fillRect(-15, 0, 30, 6)
      .fillTriangle(-15, 1, -15, -12, -7, 1).fillTriangle(-6, 1, 0, -16, 6, 1).fillTriangle(7, 1, 15, -12, 15, 1);
    this.crown.fillStyle(0xd23f4c).fillCircle(0, 3, 2.5);
    this.crown.fillStyle(0x6fc3ff).fillCircle(-9, 3, 2).fillCircle(9, 3, 2);
  }

  override update(deltaMs: number, target: Vector2Like): void {
    if (this.isDead) return;
    const phase = this.encounter.phase;
    this.vulnerability = this.encounter.vulnerable ? KING.dizzyVulnerability : 1;
    this.sprite.setAngle(0);
    const step = this.encounter.rollStep;
    this.sprite.setPosition(this.sprite.x + step.x, this.sprite.y + step.y);
    const curledUp = phase === 'rolling' || phase === 'curling' || phase === 'turning';
    if (curledUp) {
      this.curled(phase === 'rolling');
    } else {
      if (this.sprite.texture.key !== ARMADILLO_SPRITE_KEY) this.sprite.setTexture(ARMADILLO_SPRITE_KEY, 0);
      if (phase === 'dizzy' || phase === 'arrival') {
        this.updateAnimation(normalize(target.x - this.sprite.x, target.y - this.sprite.y));
        this.sprite.anims.pause();
        if (phase === 'dizzy') this.sprite.setAngle(Math.sin(performance.now() / 110) * 6);
      } else {
        // stalking: close to the standoff distance and hold there
        const before = this.position;
        const walk = bossPursuitStep(before, target, KING.standOff, KING.speed, this.effectiveSlow, deltaMs);
        this.sprite.setPosition(before.x + walk.x, before.y + walk.y);
        const moved = normalize(walk.x, walk.y);
        this.updateAnimation(moved.x || moved.y ? moved : normalize(target.x - before.x, target.y - before.y));
        if (!moved.x && !moved.y) this.sprite.anims.pause();
      }
    }
    this.crown.setVisible(!curledUp).setPosition(this.sprite.x, this.sprite.y - this.sprite.displayHeight * .3).setAngle(this.sprite.angle);
  }

  private curled(rolling: boolean): void {
    if (this.sprite.texture.key !== ARMADILLO_ROLL_KEY) this.sprite.setTexture(ARMADILLO_ROLL_KEY);
    if (rolling) this.sprite.play(ARMADILLO_ROLL_ANIMATION, true);
    else this.sprite.anims.stop();
  }

  override destroy(): void { this.crown.destroy(); super.destroy(); }
}
