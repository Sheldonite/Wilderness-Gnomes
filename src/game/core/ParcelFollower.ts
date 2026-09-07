import type { Vector2Like } from './types';

/** Follow the wearer's recorded footsteps, preserving turns around obstacles. */
export class ParcelFollower {
  position: Vector2Like = {x:0,y:0};
  stride = 0;
  moving = false;
  private last?: Vector2Like;
  private route: Vector2Like[] = [];
  update(deltaMs: number, player: Vector2Like, active: boolean): void {
    this.moving=false;
    if(!active) { this.last=undefined; this.route=[]; this.stride=0; return; }
    if(!this.last || Math.hypot(player.x-this.last.x,player.y-this.last.y)>160) {
      this.position={...player};this.last={...player};this.route=[];return;
    }
    if(Math.hypot(player.x-this.last.x,player.y-this.last.y)>.1) {
      this.route.push({...player}); this.last={...player};
    }
    let length=0,previous=this.position;
    for(const point of this.route) { length+=Math.hypot(point.x-previous.x,point.y-previous.y);previous=point; }
    let travel=Math.min(Math.max(0,length-48),Math.max(0,Math.min(deltaMs,100))/1000*(230+length));
    while(travel>0&&this.route.length) {
      const target=this.route[0],dx=target.x-this.position.x,dy=target.y-this.position.y,distance=Math.hypot(dx,dy);
      if(distance<.01) {this.route.shift();continue;}
      const step=Math.min(distance,travel);
      this.position.x+=dx/distance*step;this.position.y+=dy/distance*step;
      this.stride+=step;this.moving=true;travel-=step;
      if(step>=distance)this.route.shift();
    }
    // Very long interrupted updates must not leave an unbounded breadcrumb queue.
    if(this.route.length>1000) {this.position={...player};this.route=[];}
  }
}
