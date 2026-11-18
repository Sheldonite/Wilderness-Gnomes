import type Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { reducedMotion } from '../config/presentation';
import type { ChestCarrier } from '../core/ChestDrops';
import { RunEvents, WOODLAND_SHRINE_REWARD, ringPositions, stampedeLane, stampedeStarts, type RunEvent, type ShrineReward, type StampedeLane } from '../core/RunEvents';
import type { SceneryNavigation } from '../core/SceneryNavigation';
import { rollSpawnVariant } from '../core/SquirrelBehavior';
import type { Vector2Like } from '../core/types';
import { EnemyController, type EnemyVariant } from '../entities/EnemyController';
import { distanceSq } from '../utils/math';
import type { EnemySpawner } from './EnemySpawner';

interface PendingStampede { lane: StampedeLane; warnMs: number; count: number; variants: EnemyVariant[]; level: number }
export interface WoodlandShrine { position: Vector2Like; spawnedAtMs: number; collected: boolean }

const VARIANT_NAMES: Record<EnemyVariant, string> = {
  brown: 'squirrel', grey: 'acorn-thrower', scout: 'scout squirrel', hedgehog: 'hedgehog',
  doe: 'doe', fawn: 'fawn', buck: 'buck', armadillo: 'armadillo', buzzard: 'buzzard'
};
const HEDGEHOG_ARRIVAL_MS = 700;
const ELITE_LEAD_IN_MS = 4000;
const ELITE_QUIET_AFTER_MS = 8000;

/**
 * Set pieces between bosses: gilded elites that carry a chest, rings of creatures closing in, and
 * telegraphed stampedes. Wonky's herd uses the same stampedes during his fight.
 */
export class RunEventSystem {
  readonly schedule = new RunEvents();
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly banner: HTMLElement;
  private bannerMs = 0;
  private pending: PendingStampede[] = [];
  private shrines: WoodlandShrine[] = [];
  private pendingShrineRewards: ShrineReward[] = [];
  private shrineBursts: { position: Vector2Like; age: number }[] = [];
  private shrinePulseMs = 0;
  private pendingTimedElites = 0;
  private nextEliteRetryAtMs = 0;
  private lastOrdinaryEliteAtMs = -Infinity;
  private featuredSpacingUntilMs = 0;
  private featuredArrival?: { enemy: EnemyController; remainingMs: number };

  constructor(private readonly scene: Phaser.Scene, private readonly navigation: SceneryNavigation) {
    this.graphics = scene.add.graphics().setDepth(4);
    this.banner = document.createElement('div');
    this.banner.className = 'event-banner'; this.banner.hidden = true;
    this.banner.setAttribute('role', 'status');
    document.getElementById('ui-root')!.append(this.banner);
  }

  /**
   * `open` controls automatic set pieces. Announced stampedes still run in review scenes
   * that disable the automatic schedule.
   */
  update(deltaMs: number, open: boolean, level: number, minutes: number, player: Vector2Like,
    camera: Phaser.Cameras.Scene2D.Camera, enemies: EnemyController[], spawner: EnemySpawner,
    onShrineCollect?: (reward: ShrineReward, position: Vector2Like) => void): void {
    this.shrinePulseMs += Math.max(0, deltaMs);
    if (open) {
      const scheduled = this.schedule.update(deltaMs, minutes);
      if (scheduled.some(event => event.kind === 'elite')) this.pendingTimedElites++;
      if (this.pendingTimedElites && this.schedule.elapsedMs >= this.nextEliteRetryAtMs) {
        this.nextEliteRetryAtMs = this.schedule.elapsedMs + 500;
        if (this.spawnElite(level, minutes, player, camera, enemies, spawner)) this.pendingTimedElites--;
      }
      for (const event of scheduled) {
        if (event.kind !== 'elite') this.trigger(event, level, minutes, player, camera, enemies, spawner);
      }
      if (this.schedule.consumeShrineDue()) this.spawnShrine(player);
    }
    if (this.featuredArrival) {
      this.featuredArrival.remainingMs -= deltaMs;
      if (this.featuredArrival.enemy.isDead || this.featuredArrival.remainingMs <= 0) this.featuredArrival = undefined;
    }
    this.pending = this.pending.filter(p => {
      p.warnMs -= deltaMs;
      if (p.warnMs > 0) return true;
      this.spawnRunners(p, minutes, enemies);
      return false;
    });
    const collectSq = BALANCE.events.shrineCollectRange ** 2;
    for (const shrine of this.shrines) {
      if (shrine.collected || distanceSq(shrine.position, player) > collectSq) continue;
      shrine.collected = true;
      this.pendingShrineRewards.push(WOODLAND_SHRINE_REWARD);
      this.shrineBursts.push({ position: { ...shrine.position }, age: 0 });
      this.announce('Woodland Campfire! Warmth heals +25 HP, hastens strides, and grants +2 Gold!');
      this.scene.events.emit('shrine:collected', WOODLAND_SHRINE_REWARD, { ...shrine.position });
      this.scene.events.emit('audio:play', 'shrine');
      onShrineCollect?.(WOODLAND_SHRINE_REWARD, { ...shrine.position });
    }
    this.shrines = this.shrines.filter(s => !s.collected);
    this.shrineBursts = this.shrineBursts.filter(b => (b.age += deltaMs) < 700);
    this.bannerMs = Math.max(0, this.bannerMs - deltaMs);
    if (!this.bannerMs) this.banner.hidden = true;
    this.draw();
  }

  get activeShrines(): readonly WoodlandShrine[] {
    return this.shrines;
  }

  consumeShrineRewards(): ShrineReward[] {
    if (!this.pendingShrineRewards.length) return [];
    const out = this.pendingShrineRewards.slice();
    this.pendingShrineRewards.length = 0;
    return out;
  }

  /** Spawns a cozy Woodland Campfire shrine in open woods near `player`. */
  spawnShrine(player: Vector2Like): WoodlandShrine {
    let chosen: Vector2Like | undefined;
    const baseAngle = Math.random() * Math.PI * 2;
    for (let i = 0; i < 16; i++) {
      const a = baseAngle + (i / 16) * Math.PI * 2;
      const dist = 220 + (i % 3) * 45;
      const candidate = this.navigation.constrain({ x: player.x + Math.cos(a) * dist, y: player.y + Math.sin(a) * dist }, 48);
      const spot = this.navigation.nearest(candidate, 28);
      if (!this.navigation.blocked(spot, 24) && (!this.navigation.unbounded || this.navigation.isDry(spot, 24))) {
        chosen = spot;
        break;
      }
    }
    const fallback = this.navigation.constrain({ x: player.x + 220, y: player.y }, 48);
    const position = chosen ?? (this.navigation.unbounded ? this.navigation.nearestDry(fallback, 28) : this.navigation.nearest(fallback, 28));
    const shrine: WoodlandShrine = { position, spawnedAtMs: this.shrinePulseMs, collected: false };
    this.shrines.push(shrine);
    this.announce('A cozy Woodland Campfire glows nearby!');
    this.scene.events.emit('shrine:spawned', { ...position });
    return shrine;
  }

  /** Dispatch a chest carrier; a false result leaves the caller's reward pending. */
  spawnElite(level: number, minutes: number, player: Vector2Like,
    camera: Phaser.Cameras.Scene2D.Camera, enemies: EnemyController[], spawner: EnemySpawner,
    kind: ChestCarrier = 'elite'): boolean {
    const now = this.schedule.elapsedMs;
    if (kind === 'featured-hedgehog') {
      if (now - this.lastOrdinaryEliteAtMs < ELITE_LEAD_IN_MS) return false;
      const spot = this.featuredSpot(player, camera, enemies);
      if (!spot) return false;
      const enemy = new EnemyController(this.scene, spot.x, spot.y, minutes, this.navigation, undefined, 'hedgehog', level);
      enemy.makeElite();
      enemy.root(HEDGEHOG_ARRIVAL_MS);
      enemies.push(enemy);
      this.featuredArrival = { enemy, remainingMs: HEDGEHOG_ARRIVAL_MS };
      this.featuredSpacingUntilMs = now + ELITE_QUIET_AFTER_MS;
      this.announce('Golden hedgehog! Sidestep its roll to earn a chest.');
      return true;
    }
    if (now < this.featuredSpacingUntilMs) return false;
    const enemy = spawner.spawnEnemy(player, camera, minutes, rollSpawnVariant(level), level, enemies);
    if (!enemy) return false;
    enemy.makeElite(); enemies.push(enemy);
    this.lastOrdinaryEliteAtMs = now;
    this.announce(`A golden ${VARIANT_NAMES[enemy.variant]} prowls the woods. It carries a chest!`);
    return true;
  }

  private featuredSpot(player: Vector2Like, camera: Phaser.Cameras.Scene2D.Camera, enemies: EnemyController[]): Vector2Like | undefined {
    const { radius } = BALANCE.hedgehog;
    const view = this.navigation.unbounded ? undefined : camera.worldView;
    const hasView = view && view.right > view.left && view.bottom > view.top;
    const angle = Math.random() * Math.PI * 2;
    let reachable: Vector2Like | undefined;
    for (const distance of [250, 210, 165]) {
      for (const spot of ringPositions(player, 12, distance, angle)) {
        if (this.navigation.blocked(spot, radius + 8) || !this.navigation.clear(player, spot, BALANCE.player.radius)) continue;
        if (enemies.some(enemy => !enemy.isDead && distanceSq(spot, enemy.position) <
          (enemy.elite ? 180 : radius + enemy.radius + 16) ** 2)) continue;
        if (!hasView || (spot.x >= view.left + 35 && spot.x <= view.right - 35 &&
          spot.y >= view.top + 45 && spot.y <= view.bottom - 35)) return spot;
        reachable ??= spot;
      }
    }
    return reachable;
  }

  /** Run one set piece now (the schedule, or a review page). */
  trigger(event: RunEvent, level: number, minutes: number, player: Vector2Like,
    camera: Phaser.Cameras.Scene2D.Camera, enemies: EnemyController[], spawner: EnemySpawner): void {
    if (event.kind === 'elite') {
      this.spawnElite(level, minutes, player, camera, enemies, spawner);
    } else if (event.kind === 'ring') {
      this.spawnRing(event.count, level >= BALANCE.deer.unlockLevel ? 'fawn' : 'brown', minutes, player, enemies, level);
      this.announce('Surrounded! Break through the ring!');
    } else {
      this.launchStampede(player, event.lanes, BALANCE.events.stampedeCount, level);
      this.announce(event.lanes > 1 ? 'Two stampedes! Get out of the lanes!' : 'Stampede! Get out of the lane!');
    }
  }

  /** Telegraph `lanes` stampedes crossing near `center`, then release `count` deer down each. */
  launchStampede(center: Vector2Like, lanes: number, count: number, level: number): void {
    const e = BALANCE.events;
    const first = Math.random() * Math.PI * 2;
    for (let i = 0; i < lanes; i++) {
      // Later lanes cross the first at a wide angle so there is always somewhere safe to stand.
      const angle = first + i * (Math.PI / 2 + (Math.random() - .5) * .6);
      const through = { x: center.x + (Math.random() - .5) * 160, y: center.y + (Math.random() - .5) * 160 };
      const variants = Array.from({ length: count }, (): EnemyVariant =>
        level >= BALANCE.deer.unlockLevel && Math.random() >= .4 ? 'doe' : 'fawn');
      this.pending.push({ lane: stampedeLane(through, angle, e.stampedeLength), warnMs: e.stampedeWarnMs + i * 250, count, variants, level });
    }
  }

  private spawnRunners(p: PendingStampede, minutes: number, enemies: EnemyController[]): void {
    const e = BALANCE.events;
    stampedeStarts(p.lane, p.count, e.stampedeSpacing).forEach((start, i) => {
      if (enemies.length >= BALANCE.spawner.maxEnemiesCap + e.capAllowance) return;
      const spot = this.navigation.nearest(this.navigation.constrain(start, 30), 30);
      if (this.navigation.blocked(spot, 22)) return;
      const deer = new EnemyController(this.scene, spot.x, spot.y, minutes, this.navigation, undefined, p.variants[i], p.level);
      deer.stampede(p.lane.direction, p.lane.length + i * e.stampedeSpacing, e.stampedeSpeed);
      enemies.push(deer);
    });
  }

  private spawnRing(count: number, variant: EnemyVariant, minutes: number, player: Vector2Like, enemies: EnemyController[], level = 1): void {
    const cap = BALANCE.spawner.maxEnemiesCap + BALANCE.events.capAllowance;
    for (const point of ringPositions(player, count, BALANCE.events.ringRadius, Math.random() * Math.PI)) {
      if (enemies.length >= cap) break;
      const edge = Math.max(BALANCE.enemy.radius, 30);
      const inside = this.navigation.constrain(point, edge);
      const spot = this.navigation.nearest(inside, edge);
      if (this.navigation.blocked(spot, edge)) continue;
      enemies.push(new EnemyController(this.scene, spot.x, spot.y, minutes, this.navigation, undefined, variant, level));
    }
  }

  announce(text: string): void {
    this.banner.textContent = text; this.banner.hidden = false; this.bannerMs = 3200;
  }

  private draw(): void {
    const g = this.graphics.clear();
    const e = BALANCE.events;
    if (this.featuredArrival) {
      const { x, y } = this.featuredArrival.enemy.position;
      const progress = reducedMotion() ? .5 : 1 - this.featuredArrival.remainingMs / HEDGEHOG_ARRIVAL_MS;
      g.fillStyle(0xfbc25e, .18).fillCircle(x, y, 44);
      g.lineStyle(4, 0xffe5a0, .95).strokeCircle(x, y, 31 + progress * 13);
      g.lineStyle(2, 0x71451e, .85).strokeCircle(x, y, 48);
    }
    for (const p of this.pending) {
      const { from, direction, length } = p.lane;
      const nx = -direction.y, ny = direction.x, half = e.stampedeLaneWidth / 2;
      const end = { x: from.x + direction.x * length, y: from.y + direction.y * length };
      const pulse = reducedMotion() ? .5 : (Math.sin(p.warnMs / 90) + 1) / 2;
      g.fillStyle(0xc9873f, .12 + pulse * .1).fillPoints([
        { x: from.x + nx * half, y: from.y + ny * half }, { x: end.x + nx * half, y: end.y + ny * half },
        { x: end.x - nx * half, y: end.y - ny * half }, { x: from.x - nx * half, y: from.y - ny * half }], true);
      g.lineStyle(3, 0x5a3417, .8).lineBetween(from.x + nx * half, from.y + ny * half, end.x + nx * half, end.y + ny * half)
        .lineBetween(from.x - nx * half, from.y - ny * half, end.x - nx * half, end.y - ny * half);
      // Chevrons point the way the herd will run.
      for (let d = 120; d < length; d += 160) {
        const c = { x: from.x + direction.x * d, y: from.y + direction.y * d };
        g.lineStyle(4, 0xffe2a2, .55 + pulse * .3)
          .lineBetween(c.x - direction.x * 18 + nx * 16, c.y - direction.y * 18 + ny * 16, c.x, c.y)
          .lineBetween(c.x - direction.x * 18 - nx * 16, c.y - direction.y * 18 - ny * 16, c.x, c.y);
      }
    }
    for (const shrine of this.shrines) {
      const { x, y } = shrine.position;
      const pulse = reducedMotion() ? 0.5 : (Math.sin(this.shrinePulseMs / 240) + 1) / 2;
      g.fillStyle(0xffb347, 0.14 + pulse * 0.08).fillCircle(x, y, 42 + pulse * 6);
      g.lineStyle(2.5, 0xffe29a, 0.5 + pulse * 0.35).strokeCircle(x, y, 36 + pulse * 8);
      g.fillStyle(0x6b5b52, 0.95);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.fillCircle(x + Math.cos(a) * 14, y + Math.sin(a) * 10 + 4, 4.5);
      }
      g.lineStyle(4, 0x6f4324, 1).lineBetween(x - 10, y + 6, x + 10, y - 1).lineBetween(x - 10, y - 1, x + 10, y + 6);
      g.fillStyle(0xf27d24, 0.95).fillTriangle(x - 8, y + 3, x, y - 15 - pulse * 3, x + 8, y + 3);
      g.fillStyle(0xffdc6b, 0.98).fillTriangle(x - 4, y + 2, x, y - 10 - pulse * 2, x + 4, y + 2);
    }
    for (const burst of this.shrineBursts) {
      const life = Math.min(1, burst.age / 700);
      g.lineStyle(3, 0xffe59c, (1 - life) * 0.7).strokeCircle(burst.position.x, burst.position.y, 24 + life * 56);
    }
  }

  destroy(): void {
    this.pending = [];
    this.shrines = [];
    this.pendingShrineRewards = [];
    this.shrineBursts = [];
    this.graphics.destroy();
    this.banner.remove();
  }
}
