import { ABILITIES, isAwakened } from '../config/abilities';
import type { AbilityId, PlayerStats, Vector2Like } from './types';
import type { CombatTarget, DealDamage } from './CombatResolver';
import { distanceSq, normalize } from '../utils/math';

export interface AbilityEnemy extends CombatTarget { slowMultiplier: number; }
export interface MagnetPickup { position: Vector2Like; isCollected: boolean; attract(): void; }
export interface Patch extends Vector2Like { bornAt: number; expiresAt: number; radius: number; strength: number; }
export interface SporePatch extends Patch { trailAngle: number; }
export interface Acorn extends Vector2Like { landsAt: number; radius: number; damage: number; oak?: boolean; }
/** Oak Fall: the great acorn rolling on after impact. */
export interface Roller extends Vector2Like { dx: number; dy: number; endsAt: number; radius: number; damage: number; hit: Set<number>; }
export interface AbilityEvent { kind: 'magnet' | 'impact'; position: Vector2Like; radius: number; }

/** Pure gameplay simulation. Renderer capacity and reduced motion cannot change its results. */
export class AbilitySimulation {
  elapsedMs = 0;
  readonly fireflies: Vector2Like[] = [];
  brambles: Patch[] = [];
  spores: SporePatch[] = [];
  acorns: Acorn[] = [];
  rollers: Roller[] = [];
  readonly events: AbilityEvent[] = [];
  private readonly due = new Map<AbilityId, number>();
  private readonly fireflyHits = new Map<number, number>();
  private readonly sporeExposure = new Map<number, number>();
  private readonly thornExposure = new Map<number, number>();
  private readonly harvestStacks: number[] = [];
  private lastSpore?: Vector2Like;
  private lastPosition: Vector2Like = { x: 0, y: 0 };

  constructor(private readonly stats: PlayerStats) {}

  private get ranks() { return this.stats.abilityRanks; }
  private awakened(id: AbilityId): boolean { return isAwakened(this.ranks[id]); }

  /** Harvest Wind: current projectile damage bonus from recently gathered crystals. */
  get harvestBonus(): number {
    if (!this.awakened('woodland-magnet')) return 0;
    return Math.min(ABILITIES.magnet.harvest.maxBonus, this.harvestStacks.length * ABILITIES.magnet.harvest.bonusPerCrystal);
  }

  /** Called with the number of crystals the player gathered this frame. */
  noteCollected(count: number): void {
    if (!this.awakened('woodland-magnet')) return;
    for (let i = 0; i < count; i++) this.harvestStacks.push(this.elapsedMs + ABILITIES.magnet.harvest.durationMs);
  }

  /** Fungal Bloom: a foe slain inside a patch sprouts a new one where it fell. */
  noteKill(position: Vector2Like): void {
    if (!this.awakened('spore-trail') || !this.spores.some(p => distanceSq(position, p) <= p.radius ** 2)) return;
    this.spores.push({ ...position, bornAt: this.elapsedMs, radius: ABILITIES.spore.radius, expiresAt: this.elapsedMs + this.sporeLife(),
      trailAngle: Math.random() * Math.PI * 2, strength: ABILITIES.spore.damagePerSecond[this.ranks['spore-trail']] });
  }

  /** Thornwall: whether a point lies inside an awakened bramble ring. */
  insideThornwall(point: Vector2Like): boolean {
    return this.awakened('bramble-snare') && this.brambles.some(p => distanceSq(point, p) <= p.radius ** 2);
  }

  sync(position: Vector2Like): void {
    const r = this.ranks;
    for (const [id, cooldown] of [
      ['bramble-snare', ABILITIES.bramble.cooldownMs], ['spore-trail', ABILITIES.spore.cooldownMs],
      ['acorn-shower', this.acornCooldown()], ['woodland-magnet', ABILITIES.magnet.cooldownMs[r['woodland-magnet']]]
    ] as const) {
      if (r[id] && !this.due.has(id)) {
        this.due.set(id, this.elapsedMs + cooldown);
        if (id === 'spore-trail') this.lastSpore = { ...position };
      }
    }
    this.lastPosition = { ...position };
    this.updateFireflyPositions(0, position, []);
  }

  update(deltaMs: number, position: Vector2Like, enemies: AbilityEnemy[], pickups: MagnetPickup[], damage: DealDamage): void {
    this.sync(position);
    const previousMs = this.elapsedMs;
    this.elapsedMs += deltaMs;
    this.events.length = 0;
    this.brambles = this.brambles.filter(p => p.expiresAt > this.elapsedMs);
    this.spores = this.spores.filter(p => p.expiresAt > previousMs);
    while (this.harvestStacks.length && this.harvestStacks[0] <= this.elapsedMs) this.harvestStacks.shift();
    const ranks = this.ranks;
    if (this.ready('bramble-snare')) {
      const target = this.closest(position, enemies, ABILITIES.bramble.targetRange);
      if (target) {
        this.brambles.push({ ...target.position, bornAt: this.elapsedMs, radius: ABILITIES.bramble.radius,
          expiresAt: this.elapsedMs + ABILITIES.bramble.lifeMs[ranks['bramble-snare']], strength: ABILITIES.bramble.slow[ranks['bramble-snare']] });
        this.due.set('bramble-snare', this.elapsedMs + ABILITIES.bramble.cooldownMs);
      }
    }
    if (this.ready('spore-trail') && this.lastSpore && distanceSq(position, this.lastSpore) >= ABILITIES.spore.spacing ** 2) {
      this.spores.push({ ...position, bornAt: this.elapsedMs, radius: ABILITIES.spore.radius, expiresAt: this.elapsedMs + this.sporeLife(),
        trailAngle: Math.atan2(position.y - this.lastSpore.y, position.x - this.lastSpore.x),
        strength: ABILITIES.spore.damagePerSecond[ranks['spore-trail']] });
      this.lastSpore = { ...position };
      this.due.set('spore-trail', this.elapsedMs + ABILITIES.spore.cooldownMs);
    }
    if (this.ready('acorn-shower')) {
      const target = this.closest(position, enemies, ABILITIES.acorn.targetRange);
      if (target) {
        this.acorns.push({ ...target.position, landsAt: this.elapsedMs + ABILITIES.acorn.warningMs, oak: this.awakened('acorn-shower'),
          radius: ABILITIES.acorn.radius[ranks['acorn-shower']], damage: ABILITIES.acorn.damage[ranks['acorn-shower']] });
        this.due.set('acorn-shower', this.elapsedMs + this.acornCooldown());
      }
    }
    if (this.awakened('woodland-magnet')) {
      // Harvest Wind never rests: everything in range is drawn in continuously.
      const radius = ABILITIES.magnet.range[ranks['woodland-magnet']];
      for (const pickup of pickups) if (!pickup.isCollected && distanceSq(position, pickup.position) <= radius ** 2) pickup.attract();
    } else if (this.ready('woodland-magnet')) {
      const radius = ABILITIES.magnet.range[ranks['woodland-magnet']];
      for (const pickup of pickups) if (!pickup.isCollected && distanceSq(position, pickup.position) <= radius ** 2) pickup.attract();
      this.events.push({ kind: 'magnet', position: { ...position }, radius });
      this.due.set('woodland-magnet', this.elapsedMs + ABILITIES.magnet.cooldownMs[ranks['woodland-magnet']]);
    }
    this.updateFireflyPositions(deltaMs, position, enemies);
    const fireflyDamage = this.awakened('firefly-orbit') ? ABILITIES.firefly.swarm.damage : ABILITIES.firefly.damage;
    const thornwall = this.awakened('bramble-snare');
    const living = new Set<number>();
    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      living.add(enemy.id);
      enemy.slowMultiplier = 1;
      let inThorns = false;
      for (const patch of this.brambles) {
        if (distanceSq(enemy.position, patch) > patch.radius ** 2) continue;
        inThorns = true;
        const rooted = thornwall && this.elapsedMs < patch.bornAt + ABILITIES.bramble.thornwall.rootMs;
        enemy.slowMultiplier = rooted ? 0 : Math.min(enemy.slowMultiplier, 1 - patch.strength);
      }
      if (thornwall && inThorns) {
        const ticks = this.accumulate(this.thornExposure, enemy.id, deltaMs, ABILITIES.bramble.thornwall.tickMs);
        if (ticks) damage(enemy, ticks * ABILITIES.bramble.thornwall.damagePerSecond * ABILITIES.bramble.thornwall.tickMs / 1000);
      } else this.thornExposure.delete(enemy.id);
      if (this.elapsedMs >= (this.fireflyHits.get(enemy.id) ?? 0) && this.fireflies.some(f => distanceSq(f, enemy.position) <= (enemy.radius + ABILITIES.firefly.hitRadius) ** 2)) {
        damage(enemy, fireflyDamage);
        this.fireflyHits.set(enemy.id, this.elapsedMs + ABILITIES.firefly.hitCooldownMs);
      }
      const patches = this.spores.filter(p => distanceSq(enemy.position, p) <= p.radius ** 2);
      if (patches.length && !enemy.isDead) {
        // Include the last fraction of an expiring patch so its full lifetime deals the listed DPS.
        const coveredMs = Math.max(0, Math.min(this.elapsedMs, Math.max(...patches.map(p => p.expiresAt))) -
          Math.max(previousMs, Math.min(...patches.map(p => p.bornAt))));
        const ticks = this.accumulate(this.sporeExposure, enemy.id, coveredMs, ABILITIES.spore.tickMs);
        if (ticks) damage(enemy, ticks * Math.max(...patches.map(p => p.strength)) * ABILITIES.spore.tickMs / 1000);
      } else this.sporeExposure.delete(enemy.id);
    }
    for (const acorn of this.acorns) {
      if (acorn.landsAt > this.elapsedMs) continue;
      for (const enemy of enemies) if (!enemy.isDead && distanceSq(enemy.position, acorn) <= (acorn.radius + enemy.radius) ** 2) damage(enemy, acorn.damage);
      this.events.push({ kind: 'impact', position: acorn, radius: acorn.radius });
      if (acorn.oak) {
        // Oak Fall: keep rolling away from the player, crushing whatever is in the way.
        const dir = normalize(acorn.x - position.x, acorn.y - position.y);
        const heading = dir.x === 0 && dir.y === 0 ? { x: 1, y: 0 } : dir;
        this.rollers.push({ x: acorn.x, y: acorn.y, dx: heading.x, dy: heading.y, endsAt: this.elapsedMs + ABILITIES.acorn.oak.rollMs,
          radius: ABILITIES.acorn.oak.rollRadius, damage: acorn.damage, hit: new Set() });
      }
    }
    this.acorns = this.acorns.filter(a => a.landsAt > this.elapsedMs);
    for (const roller of this.rollers) {
      const step = ABILITIES.acorn.oak.rollSpeed * deltaMs / 1000;
      roller.x += roller.dx * step; roller.y += roller.dy * step;
      for (const enemy of enemies) {
        if (enemy.isDead || roller.hit.has(enemy.id) || distanceSq(enemy.position, roller) > (roller.radius + enemy.radius) ** 2) continue;
        roller.hit.add(enemy.id); damage(enemy, roller.damage);
      }
      if (roller.endsAt <= this.elapsedMs) {
        // shatter into ordinary acorns around the resting point
        const shards = ABILITIES.acorn.oak.shardCount, rank = Math.min(4, ranks['acorn-shower']);
        for (let i = 0; i < shards; i++) {
          const a = i / shards * Math.PI * 2;
          this.acorns.push({ x: roller.x + Math.cos(a) * ABILITIES.acorn.oak.shardSpread, y: roller.y + Math.sin(a) * ABILITIES.acorn.oak.shardSpread,
            landsAt: this.elapsedMs + ABILITIES.acorn.warningMs, radius: ABILITIES.acorn.radius[rank], damage: ABILITIES.acorn.damage[rank] });
        }
        this.events.push({ kind: 'impact', position: { x: roller.x, y: roller.y }, radius: roller.radius });
      }
    }
    this.rollers = this.rollers.filter(r => r.endsAt > this.elapsedMs);
    this.spores = this.spores.filter(p => p.expiresAt > this.elapsedMs);
    const maxPatches = this.awakened('spore-trail') ? ABILITIES.spore.bloom.maxPatches : ABILITIES.spore.maxPatches;
    if (this.spores.length > maxPatches) this.spores = this.spores.slice(-maxPatches);
    for (const map of [this.fireflyHits, this.sporeExposure, this.thornExposure]) for (const id of map.keys()) if (!living.has(id)) map.delete(id);
    this.lastPosition = { ...position };
  }

  private accumulate(map: Map<number, number>, id: number, coveredMs: number, tickMs: number): number {
    const exposure = (map.get(id) ?? 0) + coveredMs;
    const ticks = Math.floor((exposure + 1e-6) / tickMs);
    map.set(id, Math.max(0, exposure - ticks * tickMs));
    return ticks;
  }

  private sporeLife(): number { return this.awakened('spore-trail') ? ABILITIES.spore.bloom.lifeMs : ABILITIES.spore.lifeMs; }
  private acornCooldown(): number { return this.awakened('acorn-shower') ? ABILITIES.acorn.oak.cooldownMs : ABILITIES.acorn.cooldownMs; }

  private ready(id: AbilityId): boolean { return this.due.has(id) && this.elapsedMs >= this.due.get(id)!; }

  private closest(position: Vector2Like, enemies: AbilityEnemy[], range: number, exclude?: Set<number>): AbilityEnemy | undefined {
    let closest: AbilityEnemy | undefined;
    let nearest = range ** 2;
    for (const enemy of enemies) {
      if (enemy.isDead || exclude?.has(enemy.id)) continue;
      const d = distanceSq(position, enemy.position);
      if (d <= nearest) { closest = enemy; nearest = d; }
    }
    return closest;
  }

  private orbitSlot(position: Vector2Like, i: number, count: number): Vector2Like {
    const angle = this.elapsedMs / ABILITIES.firefly.orbitMs * Math.PI * 2 + i / count * Math.PI * 2;
    return { x: position.x + Math.cos(angle) * ABILITIES.firefly.radius, y: position.y + Math.sin(angle) * ABILITIES.firefly.radius };
  }

  private updateFireflyPositions(deltaMs: number, position: Vector2Like, enemies: AbilityEnemy[]): void {
    const count = ABILITIES.firefly.count[this.ranks['firefly-orbit']];
    const swarm = this.awakened('firefly-orbit');
    if (this.fireflies.length > count) this.fireflies.length = count;
    for (let i = this.fireflies.length; i < count; i++) this.fireflies.push(this.orbitSlot(position, i, count));
    if (!swarm) {
      for (let i = 0; i < count; i++) this.fireflies[i] = this.orbitSlot(position, i, count);
      return;
    }
    // Firefly Swarm: each firefly picks its own nearest unclaimed foe near the player and flies at it.
    const claimed = new Set<number>();
    const carried = { x: position.x - this.lastPosition.x, y: position.y - this.lastPosition.y };
    for (let i = 0; i < count; i++) {
      const firefly = this.fireflies[i];
      firefly.x += carried.x; firefly.y += carried.y;
      const prey = this.closest(position, enemies, ABILITIES.firefly.swarm.huntRange, claimed);
      if (prey) claimed.add(prey.id);
      const goal = prey ? prey.position : this.orbitSlot(position, i, count);
      const step = ABILITIES.firefly.swarm.speed * deltaMs / 1000;
      const dist = Math.hypot(goal.x - firefly.x, goal.y - firefly.y);
      if (dist <= step) { firefly.x = goal.x; firefly.y = goal.y; continue; }
      firefly.x += (goal.x - firefly.x) / dist * step; firefly.y += (goal.y - firefly.y) / dist * step;
    }
  }
}
