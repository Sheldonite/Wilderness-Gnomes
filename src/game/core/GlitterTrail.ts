import type { Vector2Like } from './types';

export interface GlitterSpark extends Vector2Like { age: number; size: number; color: number; phase: number }

/** Distance-spaced glitter stays where it was dropped instead of following its wearer. */
export class GlitterTrail {
  readonly sparks: GlitterSpark[] = [];
  private previous?: Vector2Like;
  private distance = 0;
  private serial = 0;
  update(deltaMs: number, position: Vector2Like, active: boolean): void {
    if (!active) { this.sparks.length=0; this.previous=undefined; this.distance=0; return; }
    const dt=Math.max(0,deltaMs);
    for(let i=this.sparks.length-1;i>=0;i--) {
      this.sparks[i].age+=dt;
      if(this.sparks[i].age>=900) this.sparks.splice(i,1);
    }
    const previous=this.previous;
    this.previous={...position};
    if(!previous) return;
    const dx=position.x-previous.x,dy=position.y-previous.y,length=Math.hypot(dx,dy);
    // Teleports must not paint a streak across the map.
    if(length>100) { this.sparks.length=0; this.distance=0; return; }
    if(length<.01) return;
    let step=6-this.distance;
    for(;step<=length;step+=6) {
      for(let i=0;i<2;i++) {
        const n=this.serial++, offset=Math.sin(n*2.4)*10;
        this.sparks.push({x:previous.x+dx*step/length-dy/length*offset,
          y:previous.y+dy*step/length+dx/length*offset,
          age:0,size:1.5+n%3*.65,color:[0xffe6a0,0xf6b9ee,0xd4beff,0xffffff][n%4],phase:n*1.7});
      }
    }
    this.distance=(this.distance+length)%6;
    if(this.sparks.length>80) this.sparks.splice(0,this.sparks.length-80);
  }
}
