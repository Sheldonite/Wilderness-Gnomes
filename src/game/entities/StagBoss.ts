import Phaser from 'phaser';
import { STAG, STAG_LOOK } from '../config/stagBoss';
import { STAG_FRAMES, STAG_LEFT_OFFSET, STAG_TEXTURE } from '../config/stagSprite';
import type { StagEncounter } from '../core/StagEncounter';
import { bossPursuitStep } from '../core/BossPursuit';
import type { SceneryNavigation } from '../core/SceneryNavigation';
import type { Vector2Like } from '../core/types';
import { EnemyController } from './EnemyController';

export class StagBoss extends EnemyController {
  private facingRight = true;
  constructor(scene: Phaser.Scene, point: Vector2Like, navigation: SceneryNavigation, private readonly encounter: StagEncounter, health: number = STAG.health) {
    super(scene, point.x, point.y, 0, navigation, { texture: STAG_TEXTURE, radius: STAG.radius,
      scale: STAG_LOOK.height / scene.textures.getFrame(STAG_TEXTURE, 0).realHeight, animation: 'stag-walk',
      shadow: { foot: 0, width: STAG_LOOK.shadowWidth, height: STAG_LOOK.shadowHeight, alpha: 1, contactAlpha: .3 },
      boss: { contactDamage: STAG.contactDamage } });
    this.health = this.maxHealth = health;
    this.sprite.anims.stop();
    this.sprite.setFrame(STAG_FRAMES.walk[0]).setOrigin(.5, 1).setDepth(18);
  }

  /** The system drives the encounter; the entity only moves the body and picks frames. */
  override update(deltaMs: number, target: Vector2Like): void {
    if (this.isDead) return;
    const phase = this.encounter.phase;
    this.vulnerability = this.encounter.vulnerable ? STAG.recoveryVulnerability : 1;
    this.sprite.setAngle(0);   // poses below that lean or shake set their own angle
    const step = this.encounter.chargeStep;
    this.sprite.setPosition(this.sprite.x + step.x, this.sprite.y + step.y);
    if (phase === 'charging') {
      this.face(step.x);
      this.play('stag-charge');
      return;
    }
    if (phase === 'windup') { this.face(this.encounter.lane!.direction.x); this.still(STAG_FRAMES.windup); return; }
    if (phase === 'sweepWindup') { this.face(this.encounter.sweep!.direction.x); this.still(STAG_FRAMES.windup); return; }
    if (phase === 'volleyWindup') {
      // Head down, shaking the velvet loose.
      this.face(this.encounter.volleyAim!.x); this.still(STAG_FRAMES.windup);
      this.sprite.setAngle(Math.sin(performance.now() / 45) * 5);
      return;
    }
    if (phase === 'bellowWindup') {
      // Rearing back to roar.
      this.face(target.x - this.position.x); this.still(STAG_FRAMES.rest);
      this.sprite.setAngle(this.facingRight ? -9 : 9);
      return;
    }
    if (phase === 'recovering' || phase === 'arrival') { this.still(STAG_FRAMES.rest); return; }
    // stalking: close to the standoff distance and hold there
    const before = this.position;
    const speed = STAG.speed * (this.encounter.rut ? STAG.rutStalkSpeed : 1);
    const walk = bossPursuitStep(before, target, STAG.standOff, speed, this.effectiveSlow, deltaMs);
    this.sprite.setPosition(before.x + walk.x, before.y + walk.y);
    if (Math.hypot(walk.x, walk.y) > .05) { this.face(walk.x); this.play('stag-walk'); }
    else { this.face(target.x - before.x); this.still(STAG_FRAMES.walk[0]); }
  }

  private face(dx: number): void {
    if (Math.abs(dx) > .01) this.facingRight = dx > 0;
  }

  private play(key: string): void {
    this.sprite.play(this.facingRight ? key : `${key}-left`, true);
  }

  private still(frame: number): void {
    this.sprite.anims.stop();
    this.sprite.setFrame(frame + (this.facingRight ? 0 : STAG_LEFT_OFFSET));
  }
}
