import Phaser from 'phaser';
import { ParcelCompanion } from './ParcelCompanion';
import { GlitterTrail } from '../core/GlitterTrail';
import type { CosmeticId } from '../config/marketItems';
import type { Vector2Like } from '../core/types';
import { reducedMotion } from '../config/presentation';

/** A purely visual accessory shared by the square and adventures. */
export class CosmeticGlow {
  private readonly art: Phaser.GameObjects.Graphics;
  private readonly parcel: ParcelCompanion;
  private clock = 0;
  private readonly trail = new GlitterTrail();
  constructor(scene: Phaser.Scene) { this.art = scene.add.graphics().setDepth(3); this.parcel=new ParcelCompanion(scene); }
  update(deltaMs: number, position: Vector2Like, cosmetic: CosmeticId | null): void {
    this.art.clear();
    this.trail.update(deltaMs,position,cosmetic==='glitter-trail');
    this.parcel.update(deltaMs,position,cosmetic==='ups-buddy');
    if (!cosmetic || cosmetic==='ups-buddy') return;
    if(cosmetic==='glitter-trail') {
      this.art.setPosition(0,0);
      const calm=reducedMotion();
      for(const spark of this.trail.sparks) {
        const fade=1-spark.age/900;
        const twinkle=calm?1:.7+.3*Math.sin(spark.age*.018+spark.phase);
        const y=spark.y-(calm?0:spark.age*.012), size=spark.size*(.6+fade*.4);
        this.art.fillStyle(spark.color,fade*.1).fillCircle(spark.x,y,size*2.5);
        this.art.lineStyle(1.3,spark.color,fade*twinkle).lineBetween(spark.x-size,y,spark.x+size,y).lineBetween(spark.x,y-size,spark.x,y+size);
        this.art.fillStyle(0xffffff,fade*.9).fillCircle(spark.x,y,.7);
      }
      return;
    }
    this.clock += deltaMs / 1000;
    const t = reducedMotion() ? 0 : this.clock;
    const color = cosmetic === 'honey-glow' ? 0xffd46b : 0xc69bff;
    this.art.setPosition(position.x, position.y);
    this.art.fillStyle(color,.08).fillEllipse(0,0,66,26);
    this.art.lineStyle(2,color,.42).strokeEllipse(0,0,45,16);
    for (let i=0;i<5;i++) {
      const angle=t*.7+i*Math.PI*2/5, x=Math.cos(angle)*27,y=Math.sin(angle)*9-5;
      const size=2+Math.sin(t*2+i)*.5;
      this.art.lineStyle(1.2,color,.7).lineBetween(x-size,y,x+size,y).lineBetween(x,y-size,x,y+size);
    }
  }
}
