import Phaser from 'phaser';
import { ParcelFollower } from '../core/ParcelFollower';
import type { Vector2Like } from '../core/types';
import { reducedMotion } from '../config/presentation';

/** Decorative only: never registered with combat, targeting, or collisions. */
export class ParcelCompanion {
  private readonly follower = new ParcelFollower();
  private readonly body: Phaser.GameObjects.Image;
  private readonly legs: Phaser.GameObjects.Graphics;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  constructor(scene: Phaser.Scene) {
    const key='cosmetic-ups-parcel';
    if(!scene.textures.exists(key)) {
      const texture=scene.textures.createCanvas(key,192,192)!;
      const c=texture.context;c.scale(3,3);c.lineJoin='round';c.lineCap='round';
      const shape=(path:string,fill:string)=>{const p=new Path2D(path);c.fillStyle=fill;c.fill(p);c.strokeStyle='#68432c';c.lineWidth=1.4;c.stroke(p);};
      shape('M9 19 L42 14 L56 23 L55 49 L24 56 L9 45 Z','#bd8651');
      shape('M9 19 L24 28 L56 23 L42 14 Z','#e9ba7c');
      shape('M24 28 L56 23 L55 49 L24 56 Z','#dca36a');
      shape('M22 17 L35 26 L41 25 L28 16 Z','#fff0ba');
      c.fillStyle='#f9df9f';c.fillRect(35,27,5,8);
      // Bright eyes, blush and a small smile above its delivery badge.
      for(const x of [31,48]) {c.fillStyle='#402c22';c.beginPath();c.ellipse(x,37,2.7,3.3,0,0,Math.PI*2);c.fill();c.fillStyle='#fffaf0';c.beginPath();c.arc(x-.8,36,.9,0,Math.PI*2);c.fill();}
      c.strokeStyle='#674130';c.lineWidth=1.3;c.beginPath();c.moveTo(36,41);c.quadraticCurveTo(40,45,44,40);c.stroke();
      c.fillStyle='#e98c82';for(const x of [28,51]){c.beginPath();c.ellipse(x,41,2.5,1.4,0,0,Math.PI*2);c.fill();}
      shape('M34 46 Q40 43 47 44 L46 50 Q41 54 35 51 Z','#503424');
      c.fillStyle='#f6d17b';c.font='bold 6px Arial';c.textAlign='center';c.fillText('ups',40.5,50);
      c.fillStyle='#fff4d7';c.save();c.translate(15,30);c.rotate(-.15);c.fillRect(-2,0,7,9);c.fillStyle='#79553b';for(let i=0;i<4;i++)c.fillRect(-1+i*1.3,2,.6,5);c.restore();
      texture.refresh().setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    this.shadow=scene.add.ellipse(0,0,29,9,0x322b26,.22).setDepth(2).setVisible(false);
    this.legs=scene.add.graphics().setVisible(false);
    this.body=scene.add.image(0,0,key).setDisplaySize(45,45).setOrigin(.5,1).setVisible(false);
  }
  update(dt:number,player:Vector2Like,active:boolean):void {
    this.follower.update(dt,player,active);
    this.body.setVisible(active);this.legs.setVisible(active);this.shadow.setVisible(active);
    if(!active)return;
    const {position,stride,moving}=this.follower;
    const step=moving&&!reducedMotion()?Math.sin(stride*.24):0;
    this.shadow.setPosition(position.x,position.y);
    this.legs.clear().setPosition(position.x,position.y).setDepth(position.y);
    for(const side of [-1,1]) {
      const x=side*7,lift=Math.max(0,step*side)*3;
      this.legs.lineStyle(3,0x765134).lineBetween(x,-12,x+step*side*3,-3-lift);
      this.legs.fillStyle(0x563b29).fillEllipse(x+step*side*3+1,-2-lift,10,5);
    }
    this.body.setPosition(position.x,position.y-3-Math.abs(step)*1.5).setRotation(step*.035).setDepth(position.y+.1);
  }
}
