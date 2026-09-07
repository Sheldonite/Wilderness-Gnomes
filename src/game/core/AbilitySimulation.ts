import { ABILITIES, awakeningTier } from '../config/abilities';
import type { AbilityId, PlayerStats, Vector2Like } from './types';
import type { CombatTarget, DealDamage } from './CombatResolver';
import { distanceSq, normalize } from '../utils/math';

export interface AbilityEnemy extends CombatTarget {
  slowMultiplier: number;
  /** Ribbon Sweep throws foes back; anything that cannot be moved simply takes the damage. */
  displace?(dx: number, dy: number): void;
}
export interface MagnetPickup { position: Vector2Like; isCollected: boolean; attract(): void; }
export interface Patch extends Vector2Like { bornAt: number; expiresAt: number; radius: number; strength: number; }
export interface SporePatch extends Patch { trailAngle: number; }
export interface Acorn extends Vector2Like { landsAt: number; radius: number; damage: number; oak?: boolean; }
/** Oak Fall: the great acorn rolling on after impact. */
export interface Roller extends Vector2Like { dx: number; dy: number; endsAt: number; radius: number; damage: number; hit: Set<number>; }
export interface AbilityEvent { kind: 'magnet' | 'impact'; position: Vector2Like; radius: number; }
/** Ron: one swing of the ribbon staff, kept so the renderer can trail it behind him. */
export interface RibbonArc { position: Vector2Like; angle: number; arc: number; range: number; bornAt: number; expiresAt: number; echo: boolean; }
/** Ron: the ring of sound that opens an Inspiring Shout. */
export interface ShoutRing { position: Vector2Like; radius: number; bornAt: number; expiresAt: number; }

/** Pure gameplay simulation. Renderer capacity and reduced motion cannot change its results. */
export class AbilitySimulation {
  elapsedMs = 0;
  readonly fireflies: Vector2Like[] = [];
  brambles: Patch[] = [];
  spores: SporePatch[] = [];
  acorns: Acorn[] = [];
  rollers: Roller[] = [];
  readonly events: AbilityEvent[] = [];
  /** Gale Harvest: healing owed to the player from crystals gathered, drained by the scene. */
  pendingHeal = 0;
  private readonly due = new Map<AbilityId, number>();
  private readonly fireflyHits = new Map<number, number>();
  private readonly sporeExposure = new Map<number, number>();
  private readonly thornExposure = new Map<number, number>();
  private readonly harvestStacks: number[] = [];
  private lastSpore?: Vector2Like;
  private lastPosition: Vector2Like = { x: 0, y: 0 };
  /** Ron's three performance skills, readable by the renderer. */
  ribbons: RibbonArc[] = [];
  shoutRings: ShoutRing[] = [];
  spinEndsAt = 0;
  spinRadius = 0;
  shoutEndsAt = 0;
  private facing: Vector2Like = { x: 0, y: 1 };
  private pendingEchoes: { at: number; position: Vector2Like; angle: number; arc: number; range: number; damage: number; knockback: number }[] = [];
  private spinNextTickAt = 0;
  private shoutHealCarryMs = 0;
  private lastRonPosition?: Vector2Like;
  private vortexSlow = 0;

  constructor(private readonly stats: PlayerStats) {}

  private get ranks() { return this.stats.abilityRanks; }
  private tier(id: AbilityId): number { return awakeningTier(this.ranks[id]); }

  /** Harvest Wind: current projectile damage bonus from recently gathered crystals. */
  get harvestBonus(): number {
    const t = this.tier('woodland-magnet');
    if (t < 0) return 0;
    const h = ABILITIES.magnet.harvest[t];
    return Math.min(h.maxBonus, this.harvestStacks.length * h.bonusPerCrystal);
  }

  /** Called with the number of crystals the player gathered this frame. */
  noteCollected(count: number): void {
    const t = this.tier('woodland-magnet');
    if (t < 0) return;
    const h = ABILITIES.magnet.harvest[t];
    for (let i = 0; i < count; i++) this.harvestStacks.push(this.elapsedMs + h.durationMs);
    this.pendingHeal += count * h.healPerCrystal;
  }

  /** Fungal Bloom: a foe slain in (or, ascended, near) a patch sprouts a new one where it fell. */
  noteKill(position: Vector2Like): void {
    const t = this.tier('spore-trail');
    if (t < 0) return;
    const reach = ABILITIES.spore.bloom[t].sproutReach;
    if (!this.spores.some(p => distanceSq(position, p) <= (p.radius + reach) ** 2)) return;
    this.spores.push({ ...position, bornAt: this.elapsedMs, radius: ABILITIES.spore.radius, expiresAt: this.elapsedMs + this.sporeLife(),
      trailAngle: Math.random() * Math.PI * 2, strength: ABILITIES.spore.damagePerSecond[this.ranks['spore-trail']] });
  }

  /** Thornwall: whether a point lies inside an awakened bramble ring. */
  insideThornwall(point: Vector2Like): boolean {
    return this.tier('bramble-snare') >= 0 && this.brambles.some(p => distanceSq(point, p) <= p.radius ** 2);
  }

  sync(position: Vector2Like): void {
    const r = this.ranks;
    for (const [id, cooldown] of [
      ['bramble-snare', ABILITIES.bramble.cooldownMs], ['spore-trail', ABILITIES.spore.cooldownMs],
      ['acorn-shower', this.acornCooldown()], ['woodland-magnet', ABILITIES.magnet.cooldownMs[r['woodland-magnet']]],
      ['ribbon-sweep', ABILITIES.ribbon.cooldownMs], ['inspiring-shout', ABILITIES.shout.cooldownMs],
      ['dizzying-flurry', ABILITIES.flurry.cooldownMs]
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
    const thornTier = this.tier('bramble-snare');
    if (this.ready('bramble-snare')) {
      const rings = thornTier >= 0 ? ABILITIES.bramble.thornwall[thornTier].rings : 1;
      const taken = new Set<number>();
      let cast = false;
      for (let i = 0; i < rings; i++) {
        const target = this.closest(position, enemies, ABILITIES.bramble.targetRange, taken);
        if (!target) break;
        taken.add(target.id); cast = true;
        this.brambles.push({ ...target.position, bornAt: this.elapsedMs, radius: ABILITIES.bramble.radius,
          expiresAt: this.elapsedMs + ABILITIES.bramble.lifeMs[ranks['bramble-snare']], strength: ABILITIES.bramble.slow[ranks['bramble-snare']] });
      }
      if (cast) this.due.set('bramble-snare', this.elapsedMs + ABILITIES.bramble.cooldownMs);
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
        this.acorns.push({ ...target.position, landsAt: this.elapsedMs + ABILITIES.acorn.warningMs, oak: this.tier('acorn-shower') >= 0,
          radius: ABILITIES.acorn.radius[ranks['acorn-shower']], damage: ABILITIES.acorn.damage[ranks['acorn-shower']] });
        this.due.set('acorn-shower', this.elapsedMs + this.acornCooldown());
      }
    }
    if (this.tier('woodland-magnet') >= 0) {
      // Harvest Wind never rests: everything in range is drawn in continuously.
      const radius = ABILITIES.magnet.range[ranks['woodland-magnet']];
      for (const pickup of pickups) if (!pickup.isCollected && distanceSq(position, pickup.position) <= radius ** 2) pickup.attract();
    } else if (this.ready('woodland-magnet')) {
      const radius = ABILITIES.magnet.range[ranks['woodland-magnet']];
      for (const pickup of pickups) if (!pickup.isCollected && distanceSq(position, pickup.position) <= radius ** 2) pickup.attract();
      this.events.push({ kind: 'magnet', position: { ...position }, radius });
      this.due.set('woodland-magnet', this.elapsedMs + ABILITIES.magnet.cooldownMs[ranks['woodland-magnet']]);
    }
    this.updateRonPerformance(deltaMs, position, enemies, damage);
    this.updateFireflyPositions(deltaMs, position, enemies);
    const swarmTier = this.tier('firefly-orbit');
    const fireflyDamage = swarmTier >= 0 ? ABILITIES.firefly.swarm[swarmTier].damage : ABILITIES.firefly.damage;
    const thornwall = thornTier >= 0 ? ABILITIES.bramble.thornwall[thornTier] : undefined;
    const living = new Set<number>();
    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      living.add(enemy.id);
      enemy.slowMultiplier = 1;
      let inThorns = false;
      for (const patch of this.brambles) {
        if (distanceSq(enemy.position, patch) > patch.radius ** 2) continue;
        inThorns = true;
        const rooted = thornwall && this.elapsedMs < patch.bornAt + thornwall.rootMs;
        enemy.slowMultiplier = rooted ? 0 : Math.min(enemy.slowMultiplier, 1 - patch.strength);
      }
      if (this.vortexSlow > 0 && this.elapsedMs < this.spinEndsAt && distanceSq(enemy.position, position) <= this.spinRadius ** 2) {
        enemy.slowMultiplier = Math.min(enemy.slowMultiplier, 1 - this.vortexSlow);
      }
      if (thornwall && inThorns) {
        const ticks = this.accumulate(this.thornExposure, enemy.id, deltaMs, thornwall.tickMs);
        if (ticks) damage(enemy, ticks * thornwall.damagePerSecond * thornwall.tickMs / 1000);
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
    const oakTier = this.tier('acorn-shower');
    const oak = oakTier >= 0 ? ABILITIES.acorn.oak[oakTier] : undefined;
    for (const acorn of this.acorns) {
      if (acorn.landsAt > this.elapsedMs) continue;
      for (const enemy of enemies) if (!enemy.isDead && distanceSq(enemy.position, acorn) <= (acorn.radius + enemy.radius) ** 2) damage(enemy, acorn.damage);
      this.events.push({ kind: 'impact', position: acorn, radius: acorn.radius });
      if (acorn.oak && oak) {
        // Oak Fall: keep rolling away from the player, crushing whatever is in the way.
        const dir = normalize(acorn.x - position.x, acorn.y - position.y);
        const heading = dir.x === 0 && dir.y === 0 ? { x: 1, y: 0 } : dir;
        this.rollers.push({ x: acorn.x, y: acorn.y, dx: heading.x, dy: heading.y, endsAt: this.elapsedMs + oak.rollMs,
          radius: oak.rollRadius, damage: acorn.damage, hit: new Set() });
      }
    }
    this.acorns = this.acorns.filter(a => a.landsAt > this.elapsedMs);
    for (const roller of this.rollers) {
      const o = oak ?? ABILITIES.acorn.oak[0];
      const step = o.rollSpeed * deltaMs / 1000;
      roller.x += roller.dx * step; roller.y += roller.dy * step;
      for (const enemy of enemies) {
        if (enemy.isDead || roller.hit.has(enemy.id) || distanceSq(enemy.position, roller) > (roller.radius + enemy.radius) ** 2) continue;
        roller.hit.add(enemy.id); damage(enemy, roller.damage);
      }
      if (roller.endsAt <= this.elapsedMs) {
        // shatter into ordinary acorns around the resting point (the strongest pre-awakening acorn)
        const shardRank = 4;
        for (let i = 0; i < o.shardCount; i++) {
          const a = i / o.shardCount * Math.PI * 2;
          this.acorns.push({ x: roller.x + Math.cos(a) * o.shardSpread, y: roller.y + Math.sin(a) * o.shardSpread,
            landsAt: this.elapsedMs + ABILITIES.acorn.warningMs, radius: ABILITIES.acorn.radius[shardRank], damage: ABILITIES.acorn.damage[shardRank] });
        }
        this.events.push({ kind: 'impact', position: { x: roller.x, y: roller.y }, radius: roller.radius });
      }
    }
    this.rollers = this.rollers.filter(r => r.endsAt > this.elapsedMs);
    this.spores = this.spores.filter(p => p.expiresAt > this.elapsedMs);
    const bloomTier = this.tier('spore-trail');
    const maxPatches = bloomTier >= 0 ? ABILITIES.spore.bloom[bloomTier].maxPatches : ABILITIES.spore.maxPatches;
    if (this.spores.length > maxPatches) this.spores = this.spores.slice(-maxPatches);
    for (const map of [this.fireflyHits, this.sporeExposure, this.thornExposure]) for (const id of map.keys()) if (!living.has(id)) map.delete(id);
    this.lastPosition = { ...position };
  }

  /**
   * Ron's performance. The ribbon sweeps toward whatever is nearest, falling back to the way he
   * is walking; the shout rallies him for a few seconds; the flurry beats on everything close by.
   * Awakened ranks add a trailing echo, healing, and a pull toward the spin.
   */
  private updateRonPerformance(deltaMs: number, position: Vector2Like, enemies: AbilityEnemy[], damage: DealDamage): void {
    const ranks = this.ranks;
    const previous = this.lastRonPosition ?? position;
    this.lastRonPosition = { ...position };
    const moved = { x: position.x - previous.x, y: position.y - previous.y };
    if (moved.x !== 0 || moved.y !== 0) this.facing = normalize(moved.x, moved.y);

    if (ranks['ribbon-sweep'] && this.ready('ribbon-sweep')) {
      const rank = ranks['ribbon-sweep'], tier = this.tier('ribbon-sweep');
      const cyclone = tier >= 0 ? ABILITIES.ribbon.cyclone[tier] : undefined;
      const arc = (cyclone?.arcDegrees ?? ABILITIES.ribbon.arcDegrees) * Math.PI / 180;
      const range = cyclone?.range ?? ABILITIES.ribbon.range;
      const hurt = ABILITIES.ribbon.damage[rank], push = ABILITIES.ribbon.knockback[rank];
      const target = this.closest(position, enemies, range);
      const angle = target
        ? Math.atan2(target.position.y - position.y, target.position.x - position.x)
        : Math.atan2(this.facing.y, this.facing.x);
      this.sweepRibbon(position, angle, arc, range, hurt, push, enemies, damage, false);
      if (cyclone) this.pendingEchoes.push({ at: this.elapsedMs + cyclone.echoMs, position: { ...position }, angle,
        arc, range, damage: hurt * cyclone.echoDamage, knockback: push * .5 });
      this.due.set('ribbon-sweep', this.elapsedMs + ABILITIES.ribbon.cooldownMs);
    }
    for (const echo of this.pendingEchoes) {
      if (this.elapsedMs < echo.at) continue;
      this.sweepRibbon(echo.position, echo.angle, echo.arc, echo.range, echo.damage, echo.knockback, enemies, damage, true);
    }
    this.pendingEchoes = this.pendingEchoes.filter(echo => this.elapsedMs < echo.at);
    this.ribbons = this.ribbons.filter(arc => this.elapsedMs < arc.expiresAt);

    if (ranks['inspiring-shout'] && this.ready('inspiring-shout')) {
      const tier = this.tier('inspiring-shout');
      this.shoutEndsAt = this.elapsedMs + ABILITIES.shout.durationMs;
      this.shoutHealCarryMs = 0;
      const anthem = tier >= 0 ? ABILITIES.shout.anthem[tier] : undefined;
      const radius = anthem ? anthem.waveRadius : 180;
      this.shoutRings.push({ position: { ...position }, radius, bornAt: this.elapsedMs, expiresAt: this.elapsedMs + 700 });
      if (anthem) {
        for (const enemy of enemies) {
          if (enemy.isDead || distanceSq(enemy.position, position) > (radius + enemy.radius) ** 2) continue;
          damage(enemy, anthem.waveDamage);
        }
      }
      this.due.set('inspiring-shout', this.elapsedMs + ABILITIES.shout.cooldownMs);
    }
    this.shoutRings = this.shoutRings.filter(ring => this.elapsedMs < ring.expiresAt);
    const shouting = ranks['inspiring-shout'] > 0 && this.elapsedMs < this.shoutEndsAt;
    this.stats.shoutAttackSpeedBonus = shouting ? ABILITIES.shout.attackSpeed[ranks['inspiring-shout']] : 0;
    this.stats.shoutMoveSpeedBonus = shouting ? ABILITIES.shout.moveSpeed[ranks['inspiring-shout']] : 0;
    const anthemTier = this.tier('inspiring-shout');
    if (shouting && anthemTier >= 0) {
      this.shoutHealCarryMs += deltaMs;
      const seconds = Math.floor(this.shoutHealCarryMs / 1000);
      if (seconds > 0) {
        this.shoutHealCarryMs -= seconds * 1000;
        this.pendingHeal += seconds * ABILITIES.shout.anthem[anthemTier].healPerSecond;
      }
    }

    if (ranks['dizzying-flurry'] && this.ready('dizzying-flurry')) {
      const tier = this.tier('dizzying-flurry');
      const duration = tier >= 0 ? ABILITIES.flurry.vortex[tier].durationMs : ABILITIES.flurry.durationMs;
      this.spinEndsAt = this.elapsedMs + duration;
      this.spinNextTickAt = this.elapsedMs;
      this.due.set('dizzying-flurry', this.elapsedMs + ABILITIES.flurry.cooldownMs + duration);
    }
    const spinTier = this.tier('dizzying-flurry');
    const vortex = spinTier >= 0 ? ABILITIES.flurry.vortex[spinTier] : undefined;
    this.spinRadius = ABILITIES.flurry.radius[ranks['dizzying-flurry']];
    this.vortexSlow = this.elapsedMs < this.spinEndsAt && vortex ? vortex.slow : 0;
    if (ranks['dizzying-flurry'] && this.elapsedMs < this.spinEndsAt) {
      if (this.elapsedMs >= this.spinNextTickAt) {
        this.spinNextTickAt = this.elapsedMs + ABILITIES.flurry.tickMs;
        for (const enemy of enemies) {
          if (enemy.isDead || distanceSq(enemy.position, position) > (this.spinRadius + enemy.radius) ** 2) continue;
          damage(enemy, ABILITIES.flurry.damage[ranks['dizzying-flurry']]);
        }
        this.events.push({ kind: 'impact', position: { ...position }, radius: this.spinRadius });
      }
      const pull = vortex ? vortex.pull * deltaMs / 1000 : 0;
      if (pull > 0) {
        for (const enemy of enemies) {
          if (enemy.isDead || !enemy.displace) continue;
          const dx = position.x - enemy.position.x, dy = position.y - enemy.position.y;
          const distance = Math.hypot(dx, dy);
          if (distance <= enemy.radius + 8 || distance > this.spinRadius) continue;
          const step = Math.min(pull, distance - enemy.radius);
          enemy.displace(dx / distance * step, dy / distance * step);
        }
      }
    }
  }

  private sweepRibbon(origin: Vector2Like, angle: number, arc: number, range: number, hurt: number,
    knockback: number, enemies: AbilityEnemy[], damage: DealDamage, echo: boolean): void {
    this.ribbons.push({ position: { ...origin }, angle, arc, range, bornAt: this.elapsedMs, expiresAt: this.elapsedMs + 260, echo });
    const half = arc / 2;
    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const dx = enemy.position.x - origin.x, dy = enemy.position.y - origin.y;
      const distance = Math.hypot(dx, dy);
      if (distance > range + enemy.radius) continue;
      // A full circle needs no angle test, and a foe standing on Ron is always caught.
      if (arc < Math.PI * 2 - 1e-6 && distance > 1) {
        let delta = Math.atan2(dy, dx) - angle;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        if (Math.abs(delta) > half) continue;
      }
      damage(enemy, hurt);
      if (knockback > 0 && enemy.displace) {
        const push = distance > 0 ? { x: dx / distance, y: dy / distance } : { x: Math.cos(angle), y: Math.sin(angle) };
        enemy.displace(push.x * knockback, push.y * knockback);
      }
    }
  }

  private accumulate(map: Map<number, number>, id: number, coveredMs: number, tickMs: number): number {
    const exposure = (map.get(id) ?? 0) + coveredMs;
    const ticks = Math.floor((exposure + 1e-6) / tickMs);
    map.set(id, Math.max(0, exposure - ticks * tickMs));
    return ticks;
  }

  private sporeLife(): number { const t = this.tier('spore-trail'); return t >= 0 ? ABILITIES.spore.bloom[t].lifeMs : ABILITIES.spore.lifeMs; }
  private acornCooldown(): number { const t = this.tier('acorn-shower'); return t >= 0 ? ABILITIES.acorn.oak[t].cooldownMs : ABILITIES.acorn.cooldownMs; }

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
    const t = this.tier('firefly-orbit');
    if (this.fireflies.length > count) this.fireflies.length = count;
    for (let i = this.fireflies.length; i < count; i++) this.fireflies.push(this.orbitSlot(position, i, count));
    if (t < 0) {
      for (let i = 0; i < count; i++) this.fireflies[i] = this.orbitSlot(position, i, count);
      return;
    }
    // Firefly Swarm: each firefly picks its own nearest unclaimed foe near the player and flies at it.
    const swarm = ABILITIES.firefly.swarm[t];
    const claimed = new Set<number>();
    const carried = { x: position.x - this.lastPosition.x, y: position.y - this.lastPosition.y };
    for (let i = 0; i < count; i++) {
      const firefly = this.fireflies[i];
      firefly.x += carried.x; firefly.y += carried.y;
      const prey = this.closest(position, enemies, swarm.huntRange, claimed);
      if (prey) claimed.add(prey.id);
      const goal = prey ? prey.position : this.orbitSlot(position, i, count);
      const step = swarm.speed * deltaMs / 1000;
      const dist = Math.hypot(goal.x - firefly.x, goal.y - firefly.y);
      if (dist <= step) { firefly.x = goal.x; firefly.y = goal.y; continue; }
      firefly.x += (goal.x - firefly.x) / dist * step; firefly.y += (goal.y - firefly.y) / dist * step;
    }
  }
}
