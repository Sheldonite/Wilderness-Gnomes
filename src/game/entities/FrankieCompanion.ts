import Phaser from 'phaser';
import { LOOK } from '../config/presentation';
import { FRANKIE_DIVE_KEY, FRANKIE_FLAP_KEY, FRANKIE_SPRITE_KEY } from '../config/frankieSprite';
import { FrankieFlock } from '../core/FrankieFlock';
import type { DealDamage } from '../core/CombatResolver';
import type { PlayerStats, Vector2Like } from '../core/types';
import type { EnemyController } from './EnemyController';

/** Renders Frankie's circling flock and their moulted feathers. */
export class FrankieCompanion {
  readonly flock: FrankieFlock;
  private readonly birds: Phaser.GameObjects.Sprite[] = [];
  private readonly featherSprites = new Map<FrankieFlock['feathers'][number], Phaser.GameObjects.Image>();

  constructor(
    private readonly scene: Phaser.Scene,
    stats: PlayerStats,
    playerPosition: Vector2Like
  ) {
    this.flock = new FrankieFlock(stats);
    this.flock.update(0, playerPosition, [], () => undefined);
  }

  update(
    deltaMs: number,
    playerPosition: Vector2Like,
    enemies: EnemyController[],
    damage: DealDamage
  ): void {
    this.flock.update(deltaMs, playerPosition, enemies, damage);
    this.syncBirds();
    this.syncFeathers();
  }

  destroy(): void {
    for (const sprite of this.birds) sprite.destroy();
    this.birds.length = 0;
    for (const sprite of this.featherSprites.values()) sprite.destroy();
    this.featherSprites.clear();
  }

  get positions(): Vector2Like[] {
    return this.flock.birds.map(bird => bird.position);
  }

  private syncBirds(): void {
    while (this.birds.length < this.flock.birds.length) {
      const sprite = this.scene.add.sprite(0, 0, FRANKIE_SPRITE_KEY, 2);
      sprite.setDisplaySize(54, 54).setDepth(LOOK.depth.companion + 3);
      sprite.play(FRANKIE_FLAP_KEY);
      sprite.anims.setProgress((this.birds.length * 0.17) % 1);
      this.birds.push(sprite);
    }
    while (this.birds.length > this.flock.birds.length) this.birds.pop()?.destroy();
    for (let i = 0; i < this.flock.birds.length; i++) {
      const bird = this.flock.birds[i];
      const sprite = this.birds[i];
      sprite.setPosition(bird.position.x, bird.position.y);
      sprite.setFlipX(bird.facing.x < 0);
      sprite.setRotation(Math.atan2(bird.facing.y, Math.abs(bird.facing.x) || 1) * 0.4);
      sprite.setDepth(bird.facing.y >= 0 ? 22 : 18);
      const diving = bird.state === 'diving';
      sprite.setDisplaySize(diving ? 60 : 54, diving ? 60 : 54);
      const anim = diving ? FRANKIE_DIVE_KEY : FRANKIE_FLAP_KEY;
      if (sprite.anims.currentAnim?.key !== anim) sprite.play(anim, true);
    }
  }

  private syncFeathers(): void {
    const live = new Set(this.flock.feathers);
    for (const [feather, sprite] of this.featherSprites) {
      if (live.has(feather)) continue;
      sprite.destroy();
      this.featherSprites.delete(feather);
    }
    for (const feather of this.flock.feathers) {
      let sprite = this.featherSprites.get(feather);
      if (!sprite) {
        sprite = this.scene.add.image(feather.position.x, feather.position.y, LOOK.texture.feather);
        sprite.setDisplaySize(48, 52).setRotation(-0.35 + Math.random() * 0.7).setDepth(LOOK.depth.pickup);
        this.featherSprites.set(feather, sprite);
      }
      sprite.setPosition(feather.position.x, feather.position.y);
    }
  }
}
