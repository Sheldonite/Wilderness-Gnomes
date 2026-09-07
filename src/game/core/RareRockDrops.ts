import { BALANCE } from '../config/balance';
import type { SceneryNavigation } from './SceneryNavigation';
import type { Vector2Like } from './types';
import { distanceSq } from '../utils/math';

export const RARE_ROCKS = { rollMs: 45000, chance: .2, maxActive: 3, collectRange: 28 } as const;
export interface RareRock { id: number; position: Vector2Like }

/** About one find per 3.75 minutes; only active play advances the clock. */
export class RareRockDrops {
  readonly rocks: RareRock[] = [];
  private elapsed = 0;
  private nextId = 0;
  constructor(private readonly navigation: Pick<SceneryNavigation, 'blocked' | 'clear'>,
    private readonly random: () => number = Math.random) {}

  update(deltaMs: number, player: Vector2Like, playing: boolean): RareRock | undefined {
    if (!playing || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
    this.elapsed += deltaMs;
    if (this.elapsed < RARE_ROCKS.rollMs) return;
    this.elapsed %= RARE_ROCKS.rollMs;
    if (this.rocks.length >= RARE_ROCKS.maxActive || this.random() >= RARE_ROCKS.chance) return;
    return this.spawnNear(player);
  }

  spawnNear(player: Vector2Like): RareRock | undefined {
    if (this.rocks.length >= RARE_ROCKS.maxActive) return;
    for (let attempt = 0; attempt < 24; attempt++) {
      const angle = this.random() * Math.PI * 2, radius = 120 + this.random() * 160;
      const position = { x: player.x + Math.cos(angle) * radius, y: player.y + Math.sin(angle) * radius };
      if (this.navigation.blocked(position, 24) || !this.navigation.clear(player, position, BALANCE.player.radius) ||
        this.rocks.some(rock => distanceSq(position, rock.position) < 70 ** 2)) continue;
      const rock = { id: ++this.nextId, position };
      this.rocks.push(rock);
      return rock;
    }
  }

  collectNearby(player: Vector2Like): RareRock | undefined {
    const index = this.rocks.findIndex(rock => distanceSq(player, rock.position) <= RARE_ROCKS.collectRange ** 2 &&
      this.navigation.clear(player, rock.position, BALANCE.player.radius));
    return index < 0 ? undefined : this.rocks.splice(index, 1)[0];
  }
}
