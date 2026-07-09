import type { Vector2Like } from '../core/types';

interface HasPosition {
  position: Vector2Like;
}

export class Quadtree<T extends HasPosition> {
  private readonly MAX_OBJECTS = 10;
  private readonly MAX_LEVELS = 5;

  private level: number;
  private bounds: { x: number; y: number; width: number; height: number };
  private objects: T[] = [];
  private nodes: Quadtree<T>[] = [];

  constructor(
    level: number,
    bounds: { x: number; y: number; width: number; height: number }
  ) {
    this.level = level;
    this.bounds = bounds;
  }

  clear(): void {
    this.objects = [];
    for (const node of this.nodes) {
      node.clear();
    }
    this.nodes = [];
  }

  split(): void {
    const subWidth = this.bounds.width / 2;
    const subHeight = this.bounds.height / 2;
    const x = this.bounds.x;
    const y = this.bounds.y;

    this.nodes[0] = new Quadtree(this.level + 1, {
      x: x + subWidth,
      y: y,
      width: subWidth,
      height: subHeight,
    });

    this.nodes[1] = new Quadtree(this.level + 1, {
      x: x,
      y: y,
      width: subWidth,
      height: subHeight,
    });

    this.nodes[2] = new Quadtree(this.level + 1, {
      x: x,
      y: y + subHeight,
      width: subWidth,
      height: subHeight,
    });

    this.nodes[3] = new Quadtree(this.level + 1, {
      x: x + subWidth,
      y: y + subHeight,
      width: subWidth,
      height: subHeight,
    });
  }

  getIndex(obj: T): number {
    let index = -1;
    const verticalMidpoint = this.bounds.x + this.bounds.width / 2;
    const horizontalMidpoint = this.bounds.y + this.bounds.height / 2;

    const topQuadrant = obj.position.y < horizontalMidpoint && obj.position.y + (obj as any).radius < horizontalMidpoint;
    const bottomQuadrant = obj.position.y > horizontalMidpoint;

    if (
      obj.position.x < verticalMidpoint &&
      obj.position.x + (obj as any).radius < verticalMidpoint
    ) {
      if (topQuadrant) {
        index = 1;
      } else if (bottomQuadrant) {
        index = 2;
      }
    } else if (obj.position.x > verticalMidpoint) {
      if (topQuadrant) {
        index = 0;
      } else if (bottomQuadrant) {
        index = 3;
      }
    }

    return index;
  }

  insert(obj: T): void {
    if (this.nodes.length > 0) {
      const index = this.getIndex(obj);
      if (index !== -1) {
        this.nodes[index].insert(obj);
        return;
      }
    }

    this.objects.push(obj);

    if (this.objects.length > this.MAX_OBJECTS && this.level < this.MAX_LEVELS) {
      if (this.nodes.length === 0) {
        this.split();
      }
      let i = 0;
      while (i < this.objects.length) {
        const index = this.getIndex(this.objects[i]);
        if (index !== -1) {
          this.nodes[index].insert(this.objects.splice(i, 1)[0]);
        } else {
          i++;
        }
      }
    }
  }

  retrieve(obj: T): T[] {
    const returnObjects = this.objects.slice();

    if (this.nodes.length > 0) {
      const index = this.getIndex(obj);
      if (index !== -1) {
        returnObjects.push(...this.nodes[index].retrieve(obj));
      } else {
        for (const node of this.nodes) {
          returnObjects.push(...node.retrieve(obj));
        }
      }
    }

    return returnObjects;
  }

  retrieveInRadius(position: Vector2Like, radius: number): T[] {
    const returnObjects: T[] = [];
    this._retrieveInRadius(position, radius, returnObjects);
    return returnObjects;
  }

  private _retrieveInRadius(position: Vector2Like, radius: number, result: T[]): void {
    for (const obj of this.objects) {
      const dx = obj.position.x - position.x;
      const dy = obj.position.y - position.y;
      const combinedRadius = radius + (obj as any).radius;
      if (dx * dx + dy * dy <= combinedRadius * combinedRadius) {
        result.push(obj);
      }
    }

    if (this.nodes.length > 0) {
      const verticalMidpoint = this.bounds.x + this.bounds.width / 2;
      const horizontalMidpoint = this.bounds.y + this.bounds.height / 2;

      if (position.x - radius < verticalMidpoint) {
        if (position.y - radius < horizontalMidpoint) {
          this.nodes[1]?._retrieveInRadius(position, radius, result);
        }
        if (position.y + radius > horizontalMidpoint) {
          this.nodes[2]?._retrieveInRadius(position, radius, result);
        }
      }

      if (position.x + radius > verticalMidpoint) {
        if (position.y - radius < horizontalMidpoint) {
          this.nodes[0]?._retrieveInRadius(position, radius, result);
        }
        if (position.y + radius > horizontalMidpoint) {
          this.nodes[3]?._retrieveInRadius(position, radius, result);
        }
      }
    }
  }
}
