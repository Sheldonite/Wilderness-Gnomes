import { OVEN_LOOK } from '../config/ovenBoss';

/** Alternate planted boots; cycle advances by ground travel rather than elapsed time. */
export class OvenWalk {
  private travel = 0;
  flipX = false;
  update(dx: number, dy: number): number {
    const distance = Math.hypot(dx, dy);
    if (distance < .01) return 2;
    if (Math.abs(dx) > .01) this.flipX = dx > 0;
    this.travel = (this.travel + distance) % OVEN_LOOK.stridePixels;
    return [0, 2, 3, 2][Math.floor(this.travel / OVEN_LOOK.stridePixels * 4)];
  }
}
