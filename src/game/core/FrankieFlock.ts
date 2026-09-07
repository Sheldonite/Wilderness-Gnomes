import { BALANCE } from '../config/balance';
import type { CombatTarget, DealDamage } from './CombatResolver';
import type { PlayerStats, Vector2Like } from './types';
import { distanceSq, normalize } from '../utils/math';

export type FrankieState = 'orbiting' | 'diving' | 'returning';

export interface FrankieBird {
  position: Vector2Like;
  facing: Vector2Like;
  state: FrankieState;
  cooldownMs: number;
  diveAgeMs: number;
  featherDueMs: number;
  targetId?: number;
}

export interface FrankieFeather {
  position: Vector2Like;
  bornAt: number;
  expiresAt: number;
  isCollected: boolean;
}

/** Circling buzzards that stoop on nearby foes and moult damage feathers. */
export class FrankieFlock {
  readonly birds: FrankieBird[] = [];
  feathers: FrankieFeather[] = [];
  elapsedMs = 0;
  private lastPlayer: Vector2Like = { x: 0, y: 0 };
  private primed = false;

  constructor(private readonly stats: PlayerStats) {}

  get damage(): number {
    const b = BALANCE.companion;
    return b.frankieDamage + Math.min(b.frankieFeatherCap, this.stats.frankieFeatherBonus);
  }

  get count(): number {
    if (!this.stats.hasFrankieCompanion) return 0;
    return Math.max(1, Math.min(BALANCE.companion.frankieMaxBirds, this.stats.frankieCount));
  }

  update(deltaMs: number, player: Vector2Like, enemies: CombatTarget[], damage: DealDamage): void {
    const wanted = this.count;
    if (!wanted) {
      this.birds.length = 0;
      this.feathers = [];
      this.lastPlayer = { ...player };
      return;
    }

    if (!this.primed) {
      this.primed = true;
      this.lastPlayer = { ...player };
    }
    this.elapsedMs += deltaMs;
    const carried = { x: player.x - this.lastPlayer.x, y: player.y - this.lastPlayer.y };
    this.lastPlayer = { ...player };

    while (this.birds.length < wanted) {
      const i = this.birds.length;
      this.birds.push({
        position: this.slot(player, i, wanted),
        facing: { x: 1, y: 0 },
        state: 'orbiting',
        cooldownMs: 280 * i,
        diveAgeMs: 0,
        featherDueMs: this.elapsedMs + BALANCE.companion.frankieFeatherMs * (i + 1) / wanted
      });
    }
    if (this.birds.length > wanted) this.birds.length = wanted;

    const b = BALANCE.companion;
    const claimed = new Set(this.birds.filter(bird => bird.state === 'diving' && bird.targetId !== undefined).map(bird => bird.targetId!));

    for (let i = 0; i < this.birds.length; i++) {
      const bird = this.birds[i];
      bird.position.x += carried.x;
      bird.position.y += carried.y;
      bird.cooldownMs = Math.max(0, bird.cooldownMs - deltaMs);
      const perch = this.slot(player, i, wanted);

      if (bird.state === 'diving') {
        bird.diveAgeMs += deltaMs;
        const target = enemies.find(enemy => enemy.id === bird.targetId && !enemy.isDead);
        if (!target || bird.diveAgeMs > b.frankieDiveTimeoutMs) {
          bird.state = 'returning';
          bird.targetId = undefined;
        } else {
          this.fly(bird, target.position, b.frankieDiveSpeed, deltaMs);
          if (distanceSq(bird.position, target.position) <= (b.frankieHitRadius + target.radius) ** 2) {
            damage(target, this.damage);
            bird.state = 'returning';
            bird.cooldownMs = b.frankieCooldownMs;
            bird.targetId = undefined;
          }
        }
        continue;
      }

      if (bird.state === 'returning') {
        this.fly(bird, perch, b.frankieReturnSpeed, deltaMs);
        if (distanceSq(bird.position, perch) <= 16 ** 2) bird.state = 'orbiting';
        continue;
      }

      const before = { ...bird.position };
      bird.position = perch;
      bird.facing = normalize(bird.position.x - before.x, bird.position.y - before.y);
      if (bird.facing.x === 0 && bird.facing.y === 0) bird.facing = { x: 1, y: 0 };
      if (bird.cooldownMs > 0) continue;
      const prey = this.closest(player, enemies, b.frankieHuntRange, claimed);
      if (!prey) continue;
      claimed.add(prey.id);
      bird.state = 'diving';
      bird.targetId = prey.id;
      bird.diveAgeMs = 0;
    }

    for (const bird of this.birds) {
      if (this.elapsedMs < bird.featherDueMs) continue;
      this.feathers.push({
        position: { ...bird.position },
        bornAt: this.elapsedMs,
        expiresAt: this.elapsedMs + b.frankieFeatherLifeMs,
        isCollected: false
      });
      bird.featherDueMs = this.elapsedMs + b.frankieFeatherMs;
    }

    for (const feather of this.feathers) {
      if (feather.isCollected || this.elapsedMs >= feather.expiresAt) continue;
      if (distanceSq(feather.position, player) > b.frankieCollectRange ** 2) continue;
      feather.isCollected = true;
      this.stats.frankieFeatherBonus = Math.min(b.frankieFeatherCap, this.stats.frankieFeatherBonus + b.frankieFeatherBonus);
    }
    this.feathers = this.feathers.filter(feather => !feather.isCollected && this.elapsedMs < feather.expiresAt);
  }

  private slot(player: Vector2Like, index: number, count: number): Vector2Like {
    const angle = this.elapsedMs / BALANCE.companion.frankieOrbitMs * Math.PI * 2 + index / count * Math.PI * 2;
    const radius = BALANCE.companion.frankieOrbitRadius;
    return { x: player.x + Math.cos(angle) * radius, y: player.y + Math.sin(angle) * radius };
  }

  private fly(bird: FrankieBird, goal: Vector2Like, speed: number, deltaMs: number): void {
    const step = speed * deltaMs / 1000;
    const heading = normalize(goal.x - bird.position.x, goal.y - bird.position.y);
    if (heading.x === 0 && heading.y === 0) return;
    bird.facing = heading;
    const dist = Math.hypot(goal.x - bird.position.x, goal.y - bird.position.y);
    if (dist <= step) {
      bird.position = { ...goal };
      return;
    }
    bird.position = { x: bird.position.x + heading.x * step, y: bird.position.y + heading.y * step };
  }

  private closest(origin: Vector2Like, enemies: CombatTarget[], range: number, claimed: Set<number>): CombatTarget | undefined {
    let closest: CombatTarget | undefined;
    let nearest = range ** 2;
    for (const enemy of enemies) {
      if (enemy.isDead || claimed.has(enemy.id)) continue;
      const d = distanceSq(origin, enemy.position);
      if (d <= nearest) { closest = enemy; nearest = d; }
    }
    return closest;
  }
}
