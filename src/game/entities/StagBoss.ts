import Phaser from 'phaser';
import { STAG, STAG_LOOK } from '../config/stagBoss';
import { STAG_FRAMES, STAG_LEFT_OFFSET, STAG_TEXTURE } from '../config/stagSprite';
import type { StagEncounter, StagHit } from '../core/StagEncounter';
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
    this.vulnerability = this.encounter.vulnerable ? STAG.stunVulnerability : 1;
    this.sprite.setAngle(0);   // poses below that lean or shake set their own angle
    if (phase === 'charging') {
      const step = this.encounter.chargeStep;
      const before = this.position;
      const wanted = { x: before.x + step.x, y: before.y + step.y };
      const safe = this.navigation?.move(before, wanted, this.radius) ?? wanted;
      this.sprite.setPosition(safe.x, safe.y);
      if (Math.hypot(safe.x - before.x, safe.y - before.y) < Math.hypot(step.x, step.y) * .5 && (step.x || step.y)) {
        // Rammed a tree: he is stunned.
        this.encounter.blocked(safe, target, this.blockedPlayerRadius, this.blockedHit);
      }
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
    if (phase === 'stunned') {
      // Dazed: rest frame with a woozy sway.
      this.still(STAG_FRAMES.rest);
      this.sprite.setAngle(Math.sin(performance.now() / 120) * 4);
      return;
    }
    if (phase === 'recovering' || phase === 'arrival') { this.still(STAG_FRAMES.rest); return; }
    // stalking: close to the standoff distance and hold there
    const before = this.position;
    const remaining = Math.max(0, Math.hypot(target.x - before.x, target.y - before.y) - STAG.standOff);
    const next = this.navigation!.toward(before, target, Math.min(remaining, STAG.speed * (this.encounter.rut ? STAG.rutStalkSpeed : 1) * this.effectiveSlow * deltaMs / 1000), this.radius, this.route);
    this.sprite.setPosition(next.x, next.y);
    const dx = next.x - before.x, dy = next.y - before.y;
    if (Math.hypot(dx, dy) > .05) { this.face(dx); this.play('stag-walk'); }
    else { this.face(target.x - before.x); this.still(STAG_FRAMES.walk[0]); }
  }

  /** Set by the system each frame so a blocked charge can still stomp. */
  blockedPlayerRadius = 18;
  blockedHit: StagHit = () => {};

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
