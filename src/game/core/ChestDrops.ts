import { BALANCE } from '../config/balance';
import type { GameManager } from './GameManager';
import type { SceneryNavigation } from './SceneryNavigation';
import type { Vector2Like } from './types';
import { distanceSq } from '../utils/math';

export interface ChestDrop { id: number; position: Vector2Like; kind: 'chest' | 'boss' }

/** One independent roll per level, including the starting level. Unplaced drops wait for clear ground. */
export class ChestDrops {
  readonly chests: ChestDrop[] = [];
  pending = 0;
  private lastLevel = 0;
  private nextId = 0;

  constructor(private readonly navigation: Pick<SceneryNavigation, 'blocked' | 'clear'>,
    private readonly random: () => number = Math.random) {}

  advanceToLevel(level: number): void {
    while (this.lastLevel < level) {
      this.lastLevel++;
      if (this.random() < BALANCE.chest.chancePerLevel) this.pending++;
    }
  }

  spawnNear(player: Vector2Like): ChestDrop | undefined {
    if (!this.pending) return;
    const b = BALANCE.chest;
    for (let i = 0; i < b.placementAttempts; i++) {
      const angle = this.random() * Math.PI * 2;
      const radius = b.minSpawnDistance + this.random() * (b.maxSpawnDistance - b.minSpawnDistance);
      const position = { x: player.x + Math.cos(angle) * radius, y: player.y + Math.sin(angle) * radius };
      if (this.navigation.blocked(position, 24) || !this.navigation.clear(player, position, BALANCE.player.radius) ||
        this.chests.some(chest => distanceSq(chest.position, position) < b.spacing ** 2)) continue;
      const chest: ChestDrop = { id: ++this.nextId, position, kind: 'chest' };
      this.chests.push(chest);
      this.pending--;
      return chest;
    }
  }

  collectNearby(player: Vector2Like, game: GameManager): ChestDrop | undefined {
    if (game.state !== 'Playing') return;
    const index = this.chests.findIndex(chest => distanceSq(chest.position, player) <= BALANCE.chest.collectRange ** 2 &&
      this.navigation.clear(player, chest.position, BALANCE.player.radius));
    if (index < 0 || !game.openChestUpgrade(this.chests[index].kind)) return;
    return this.chests.splice(index, 1)[0];
  }

  addBoss(position: Vector2Like): ChestDrop {
    const chest: ChestDrop = { id: ++this.nextId, position: { ...position }, kind: 'boss' };
    this.chests.push(chest); return chest;
  }
}
