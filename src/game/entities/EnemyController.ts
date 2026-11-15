import { createNavigationRoute, type SceneryNavigation } from '../core/SceneryNavigation';
import Phaser from 'phaser';
import type { ActorShadow } from '../systems/PresentationSystem';
import { BALANCE } from '../config/balance';
import {
  BUCK_SPRITE_KEY,
  BUCK_WALK_ANIMATION_BY_DIRECTION,
  DOE_SPRITE_KEY,
  DOE_WALK_ANIMATION_BY_DIRECTION,
  ENEMY_SPRITE_KEY,
  ENEMY_WALK_ANIMATION_BY_DIRECTION,
  FAWN_SPRITE_KEY,
  FAWN_WALK_ANIMATION_BY_DIRECTION,
  GREY_ENEMY_SPRITE_KEY,
  GREY_ENEMY_WALK_ANIMATION_BY_DIRECTION,
  ARMADILLO_SPRITE_KEY,
  ARMADILLO_ROLL_KEY,
  ARMADILLO_WALK_ANIMATION_BY_DIRECTION,
  ARMADILLO_ROLL_ANIMATION
} from '../config/enemySprite';
import type { Vector2Like } from '../core/types';
import { RangedSquirrelBehavior } from '../core/SquirrelBehavior';
import { ArmadilloBehavior } from '../core/ArmadilloBehavior';
import { BuzzardFlight } from '../core/BuzzardFlight';
import { FRANKIE_DIVE_KEY, FRANKIE_FLAP_KEY, FRANKIE_SPRITE_KEY } from '../config/frankieKeys';
import { clampToArena, distanceSq, normalize, spriteHeading } from '../utils/math';

let nextEnemyId = 1;

/**
 * Brown squirrels charge, scout squirrels dart in fast, grey squirrels throw acorns, hedgehogs
 * curl and roll, deer arrive from level 10, armadillos roll in from level 20, and buzzards swoop
 * down once King Frankie has fallen at level 25.
 */
export type EnemyVariant = 'brown' | 'grey' | 'scout' | 'hedgehog' | 'doe' | 'fawn' | 'buck' | 'armadillo' | 'buzzard';

const SCOUT_DEFAULTS = {
  health: 18,
  speed: 152,
  contactDamage: 10,
  radius: 13,
  scale: 0.82,
  tint: 0xf4b46c,
  xpValue: 10
};

const HEDGEHOG_DEFAULTS = {
  health: 48,
  walkSpeed: 88,
  rollSpeed: 370,
  rollDistance: 240,
  windupRange: 230,
  curlMs: 420,
  recoverMs: 500,
  cooldownMs: 1800,
  walkDamage: 10,
  rollDamage: 18,
  radius: 15,
  scale: 0.95,
  tint: 0xa87858,
  curlTint: 0xffd27d,
  xpValue: 16
};

function getScoutConfig() {
  return { ...SCOUT_DEFAULTS, ...((BALANCE as Record<string, unknown>).scout as Partial<typeof SCOUT_DEFAULTS> | undefined) };
}

function getHedgehogConfig() {
  return { ...HEDGEHOG_DEFAULTS, ...((BALANCE as Record<string, unknown>).hedgehog as Partial<typeof HEDGEHOG_DEFAULTS> | undefined) };
}

type RollerPhase = 'approaching' | 'curling' | 'rolling' | 'recovering';

/** Walks in, telegraphs a curl, then rolls in a straight locked line. */
class HedgehogRoller {
  phase: RollerPhase = 'approaching';
  facing: Vector2Like = { x: 1, y: 0 };
  private timer = 0;
  private cooldownMs = 0;
  private travelled = 0;
  private rollDir: Vector2Like = { x: 1, y: 0 };

  get rolling(): boolean { return this.phase === 'rolling'; }
  get curling(): boolean { return this.phase === 'curling'; }

  update(deltaMs: number, position: Vector2Like, player: Vector2Like): Vector2Like {
    const h = getHedgehogConfig();
    this.cooldownMs = Math.max(0, this.cooldownMs - deltaMs);
    const toward = normalize(player.x - position.x, player.y - position.y);
    if (toward.x !== 0 || toward.y !== 0) this.facing = toward;

    if (this.phase === 'rolling') {
      const step = (h.rollSpeed * deltaMs) / 1000;
      this.travelled += step;
      if (this.travelled >= h.rollDistance) {
        this.phase = 'recovering';
        this.timer = h.recoverMs;
        this.cooldownMs = h.cooldownMs;
        return { x: 0, y: 0 };
      }
      return { x: this.rollDir.x * step, y: this.rollDir.y * step };
    }

    this.timer -= deltaMs;
    if (this.phase === 'curling') {
      if (this.timer <= 0) {
        this.phase = 'rolling';
        this.travelled = 0;
        this.rollDir = this.facing.x === 0 && this.facing.y === 0 ? { x: 1, y: 0 } : { ...this.facing };
      }
      return { x: 0, y: 0 };
    }
    if (this.phase === 'recovering') {
      if (this.timer <= 0) this.phase = 'approaching';
      return { x: 0, y: 0 };
    }

    const range = Math.sqrt(distanceSq(position, player));
    if (this.cooldownMs <= 0 && range <= h.windupRange && range >= 8) {
      this.phase = 'curling';
      this.timer = h.curlMs;
      return { x: 0, y: 0 };
    }
    const step = (h.walkSpeed * deltaMs) / 1000;
    return { x: this.facing.x * step, y: this.facing.y * step };
  }

  blocked(): void {
    if (this.phase !== 'rolling') return;
    const h = getHedgehogConfig();
    this.phase = 'recovering';
    this.timer = h.recoverMs;
    this.cooldownMs = h.cooldownMs;
  }
}

/** Buzzards flap whichever way they fly; the sheet faces right and is flipped for left. */
const BUZZARD_ANIMATIONS: Record<string, string> = Object.fromEntries(
  [-1, 0, 1].flatMap(x => [-1, 0, 1].map(y => [`${x},${y}`, FRANKIE_FLAP_KEY])));

export interface EnemyAppearance {
  texture: string;
  radius: number;
  scale: number;
  animation: string;
  shadow?: ActorShadow;
  /** Bosses: fixed contact damage, immune to shoves, pulls and roots, and only partly slowed. */
  boss?: { contactDamage: number };
}

/** How much faster a creature has become after this many minutes: steady at first, then capped. */
export function speedBonus(baseSpeed: number, minutes: number): number {
  return Math.min(baseSpeed * BALANCE.enemy.maxSpeedBonus, BALANCE.enemy.speedPerMinute * Math.max(0, minutes));
}

/** Contact damage multiplier for a creature that arrived after this many minutes. */
export function contactScale(minutes: number): number {
  return 1 + BALANCE.enemy.damagePerMinute * Math.max(0, minutes);
}

interface VariantProfile {
  textureKey: string;
  walkAnimations: Record<string, string>;
  scale: number;
  health: number;
  speed: number;
  contactDamage: number;
  radius: number;
  ranged: boolean;
}

const VARIANTS: Record<EnemyVariant, VariantProfile> = {
  brown: { textureKey: ENEMY_SPRITE_KEY, walkAnimations: ENEMY_WALK_ANIMATION_BY_DIRECTION, scale: 0.72,
    health: BALANCE.enemy.health, speed: BALANCE.enemy.speed, contactDamage: BALANCE.enemy.contactDamage, radius: BALANCE.enemy.radius, ranged: false },
  grey: { textureKey: GREY_ENEMY_SPRITE_KEY, walkAnimations: GREY_ENEMY_WALK_ANIMATION_BY_DIRECTION, scale: 0.72,
    health: BALANCE.rangedEnemy.health, speed: BALANCE.rangedEnemy.speed, contactDamage: BALANCE.enemy.contactDamage, radius: BALANCE.enemy.radius, ranged: true },
  scout: (() => {
    const s = getScoutConfig();
    return { textureKey: ENEMY_SPRITE_KEY, walkAnimations: ENEMY_WALK_ANIMATION_BY_DIRECTION, scale: s.scale,
      health: s.health, speed: s.speed, contactDamage: s.contactDamage, radius: s.radius, ranged: false };
  })(),
  hedgehog: (() => {
    const h = getHedgehogConfig();
    return { textureKey: ENEMY_SPRITE_KEY, walkAnimations: ENEMY_WALK_ANIMATION_BY_DIRECTION, scale: h.scale,
      health: h.health, speed: h.walkSpeed, contactDamage: h.walkDamage, radius: h.radius, ranged: false };
  })(),
  doe: { textureKey: DOE_SPRITE_KEY, walkAnimations: DOE_WALK_ANIMATION_BY_DIRECTION, scale: BALANCE.deer.doe.scale,
    health: BALANCE.deer.doe.health, speed: BALANCE.deer.doe.speed, contactDamage: BALANCE.deer.doe.contactDamage, radius: BALANCE.deer.doe.radius, ranged: false },
  fawn: { textureKey: FAWN_SPRITE_KEY, walkAnimations: FAWN_WALK_ANIMATION_BY_DIRECTION, scale: BALANCE.deer.fawn.scale,
    health: BALANCE.deer.fawn.health, speed: BALANCE.deer.fawn.speed, contactDamage: BALANCE.deer.fawn.contactDamage, radius: BALANCE.deer.fawn.radius, ranged: false },
  buck: { textureKey: BUCK_SPRITE_KEY, walkAnimations: BUCK_WALK_ANIMATION_BY_DIRECTION, scale: BALANCE.deer.buck.scale,
    health: BALANCE.deer.buck.health, speed: BALANCE.deer.buck.speed, contactDamage: BALANCE.deer.buck.contactDamage, radius: BALANCE.deer.buck.radius, ranged: false },
  armadillo: { textureKey: ARMADILLO_SPRITE_KEY, walkAnimations: ARMADILLO_WALK_ANIMATION_BY_DIRECTION, scale: BALANCE.armadillo.scale,
    health: BALANCE.armadillo.health, speed: BALANCE.armadillo.walkSpeed, contactDamage: BALANCE.armadillo.walkDamage, radius: BALANCE.armadillo.radius, ranged: false },
  buzzard: { textureKey: FRANKIE_SPRITE_KEY, walkAnimations: BUZZARD_ANIMATIONS, scale: BALANCE.buzzard.scale,
    health: BALANCE.buzzard.health, speed: BALANCE.buzzard.speed, contactDamage: BALANCE.buzzard.contactDamage, radius: BALANCE.buzzard.radius, ranged: false }
};

export interface TreeColliderLike {
  hitTree(from: Vector2Like, to: Vector2Like, radius: number): { point: Vector2Like; normal: Vector2Like } | undefined;
}

export class EnemyController {
  protected readonly route = createNavigationRoute();
  readonly id = nextEnemyId++;
  readonly radius: number;
  private readonly baseContact: number;
  private readonly contactMultiplier: number;
  readonly sprite: Phaser.GameObjects.Sprite;
  health: number;
  /** Health at full strength, for boss bars and elite scaling. */
  maxHealth: number;
  isDead = false;
  /** Elites are tougher, gilded, worth more crystals, and leave a chest behind. */
  elite = false;
  /** Damage taken is multiplied by this; bosses raise it while stunned or dizzy. */
  vulnerability = 1;
  readonly isBoss: boolean;
  private readonly bossContact?: number;
  private scale: number;
  private run?: { direction: Vector2Like; left: number; speed: number };
  slowMultiplier = 1;
  lastContactDamageAt = -Infinity;
  private rootMs = 0;
  private readonly ranged?: RangedSquirrelBehavior;
  private readonly armadillo?: ArmadilloBehavior;
  private readonly hedgehog?: HedgehogRoller;
  private readonly flight?: BuzzardFlight;
  private readonly profile: VariantProfile;
  private readonly walkAnimations: Record<string, string>;

  /**
   * `appearance` lets a subclass (the boss) bring its own texture and collision size;
   * ordinary spawns pick everything from their `variant`.
   */
  constructor(scene: Phaser.Scene, x: number, y: number, difficultyMinutes: number, protected readonly navigation?: SceneryNavigation,
    appearance?: EnemyAppearance, readonly variant: EnemyVariant = 'brown', playerLevel = 1) {
    const profile = VARIANTS[variant];
    this.profile = profile;
    this.radius = appearance?.radius ?? profile.radius;
    this.baseContact = profile.contactDamage;
    const damagePerLevel = (BALANCE.enemy as { damagePerLevel?: number }).damagePerLevel ?? 0.03;
    this.contactMultiplier = contactScale(difficultyMinutes) * (1 + Math.max(0, playerLevel - 1) * damagePerLevel);
    this.isBoss = Boolean(appearance?.boss);
    this.bossContact = appearance?.boss?.contactDamage;
    this.scale = appearance?.scale ?? profile.scale;
    const spawn = navigation?.nearest({ x, y }, this.radius) ?? { x, y };
    this.sprite = scene.add.sprite(spawn.x, spawn.y, appearance?.texture ?? profile.textureKey, 0);
    this.walkAnimations = profile.walkAnimations;
    this.sprite.setDepth(10);
    this.sprite.setScale(this.scale);
    this.sprite.play(appearance?.animation ?? this.walkAnimations['0,1']);
    scene.events.emit('presentation:actor', this.sprite, appearance?.shadow);
    this.health = this.maxHealth = Math.round(profile.health + difficultyMinutes * BALANCE.enemy.healthPerMinute);
    if (profile.ranged) this.ranged = new RangedSquirrelBehavior();
    if (variant === 'armadillo') this.armadillo = new ArmadilloBehavior();
    if (variant === 'scout' && !appearance) this.setBaseTint(getScoutConfig().tint);
    if (variant === 'hedgehog' && !appearance) {
      this.hedgehog = new HedgehogRoller();
      this.setBaseTint(getHedgehogConfig().tint);
    }
    if (variant === 'buzzard' && !appearance) {
      this.flight = new BuzzardFlight();
      // Fliers are drawn above their shadow and above the creatures on the ground.
      this.sprite.setDepth(22);
      this.setBaseTint(BALANCE.buzzard.tint);
    }
  }

  get contactDamage(): number {
    if (this.bossContact !== undefined) return this.bossContact;
    const base = this.armadillo?.rolling ? BALANCE.armadillo.rollDamage
      : this.hedgehog?.rolling ? getHedgehogConfig().rollDamage
      : this.flight?.swooping ? BALANCE.buzzard.swoopDamage : this.baseContact;
    return Math.round(base * this.contactMultiplier * (this.elite ? BALANCE.elite.damageMultiplier : 1));
  }

  /** Crystals this creature is worth when it falls. */
  get xpValue(): number {
    const xpMap = BALANCE.enemyXp as Record<string, number>;
    const baseXp = xpMap[this.variant] ?? (this.variant === 'hedgehog' ? getHedgehogConfig().xpValue : getScoutConfig().xpValue);
    return baseXp * (this.elite ? BALANCE.elite.xpMultiplier : 1);
  }

  /** Slow actually applied: bosses never drop below the floor. */
  get effectiveSlow(): number {
    return this.isBoss ? Math.max(BALANCE.boss.slowFloor, this.slowMultiplier) : this.slowMultiplier;
  }

  /** Promote a fresh spawn to an elite: five times the health, harder hits, a golden coat. */
  makeElite(): void {
    if (this.elite || this.isBoss) return;
    this.elite = true;
    this.health = this.maxHealth = Math.round(this.maxHealth * BALANCE.elite.healthMultiplier);
    this.scale *= BALANCE.elite.scale;
    this.sprite.setScale(this.scale);
    this.setBaseTint(BALANCE.elite.tint);
  }

  /** A colour that survives hit flashes (elites, chili squirrels). */
  setBaseTint(color: number): void {
    this.sprite.setData('tint', color);
    this.sprite.setTint(color);
  }

  /** Stampede: gallop straight along a lane for a while, then hunt the player as usual. */
  stampede(direction: Vector2Like, distance: number, speed: number): void {
    this.run = { direction: normalize(direction.x, direction.y), left: distance, speed };
  }

  get stampeding(): boolean { return Boolean(this.run); }

  get isRanged(): boolean {
    return this.profile.ranged;
  }

  /** Hold this enemy in place for a while (Living Bark). */
  root(ms: number): void { if (!this.isBoss) this.rootMs = Math.max(this.rootMs, ms); }

  update(deltaMs: number, target: Vector2Like, difficultyMinutes: number): void {
    if (this.isDead) return;
    if (this.run) { this.updateRun(deltaMs); return; }
    if (this.rootMs > 0) { this.rootMs -= deltaMs; this.sprite.anims.pause(); return; }
    if (this.armadillo) { this.updateArmadillo(deltaMs, target); return; }
    if (this.hedgehog) { this.updateHedgehog(deltaMs, target); return; }
    if (this.flight) { this.updateFlight(deltaMs, target, difficultyMinutes); return; }
    const speed = (this.profile.speed + speedBonus(this.profile.speed, difficultyMinutes)) * this.slowMultiplier;
    const direction = this.ranged
      ? this.ranged.steer(this.position, target)
      : normalize(target.x - this.sprite.x, target.y - this.sprite.y);
    this.ranged?.tick(deltaMs);
    const dt = deltaMs / 1000;

    if (direction.x === 0 && direction.y === 0) {
      // holding position: face the player and freeze the walk
      this.updateAnimation(normalize(target.x - this.sprite.x, target.y - this.sprite.y));
      this.sprite.anims.pause();
      return;
    }

    const next = clampToArena(
      {
        x: this.sprite.x + direction.x * speed * dt,
        y: this.sprite.y + direction.y * speed * dt
      },
      this.radius
    );
    // Ranged squirrels steer away from the player at times, so route toward their chosen point rather than the player.
    const goal = this.ranged ? next : target;
    const safe = this.navigation?.toward(this.position, goal, speed * dt, this.radius, this.route) ?? next;
    const actual = normalize(safe.x - this.sprite.x, safe.y - this.sprite.y);
    this.sprite.setPosition(safe.x, safe.y);
    this.updateAnimation(actual.x === 0 && actual.y === 0 ? direction : actual);
  }

  private updateRun(deltaMs: number): void {
    const run = this.run!;
    const step = Math.min(run.left, run.speed * Math.max(.3, this.slowMultiplier) * deltaMs / 1000);
    const before = this.position;
    const wanted = { x: before.x + run.direction.x * step, y: before.y + run.direction.y * step };
    const safeNav = this.navigation?.move(before, wanted, this.radius) ?? clampToArena(wanted, this.radius);
    const treeHit = this.hitTree(before, safeNav, this.radius);
    const safe = treeHit ? treeHit.point : safeNav;
    this.sprite.setPosition(safe.x, safe.y);
    this.updateAnimation(run.direction);
    run.left -= step;
    // A tree or the arena edge ends the gallop early.
    if (run.left <= 0 || treeHit || (step > 0 && Math.hypot(safe.x - before.x, safe.y - before.y) < step * .3)) {
      if (treeHit) this.sprite.scene?.events.emit('presentation:trail', safe, 0xd8c39a);
      this.run = undefined;
    }
  }

  protected hitTree(from: Vector2Like, to: Vector2Like, radius: number): { point: Vector2Like; normal: Vector2Like } | undefined {
    const collider = (this.navigation as { treeCollider?: TreeColliderLike } | undefined)?.treeCollider;
    return collider?.hitTree(from, to, radius);
  }

  /** Returns a launch velocity when this squirrel is ready to throw at the target, else undefined. */
  tryThrow(target: Vector2Like): Vector2Like | undefined {
    if (!this.ranged || this.isDead) return undefined;
    return this.ranged.tryThrow(this.position, target);
  }

  /** Buzzards fly straight over scenery; only the edge of the world stops them. */
  private updateFlight(deltaMs: number, target: Vector2Like, difficultyMinutes: number): void {
    const flight = this.flight!;
    const speed = (this.profile.speed + speedBonus(this.profile.speed, difficultyMinutes)) * this.slowMultiplier;
    const before = this.position;
    const step = flight.update(deltaMs, before, target, speed);
    const wanted = { x: before.x + step.x, y: before.y + step.y };
    const safe = clampToArena(wanted, this.radius);
    if (flight.swooping && (safe.x !== wanted.x || safe.y !== wanted.y)) flight.blocked();
    this.sprite.setPosition(safe.x, safe.y);
    const heading = step.x || step.y ? step : flight.facing;
    const pose = spriteHeading(heading.x, heading.y);
    this.sprite.setFlipX(pose.flipX).setRotation(pose.rotation);
    if (flight.winding) {
      // The tell: wings raised, hanging in the air.
      this.sprite.anims.stop(); this.sprite.setFrame(10);
    } else this.sprite.play(flight.swooping ? FRANKIE_DIVE_KEY : FRANKIE_FLAP_KEY, true);
  }

  private updateArmadillo(deltaMs: number, target: Vector2Like): void {
    const before = this.position;
    const step = this.armadillo!.update(deltaMs, before, target);
    const next = { x: before.x + step.x, y: before.y + step.y };
    const rolling = this.armadillo!.rolling;
    const moving = step.x !== 0 || step.y !== 0;
    const safe = !moving ? before : rolling
      ? (this.navigation?.move(before, next, this.radius) ?? clampToArena(next, this.radius))
      : (this.navigation?.toward(before, target, Math.hypot(step.x, step.y), this.radius, this.route) ?? clampToArena(next, this.radius));
    if (rolling && (step.x !== 0 || step.y !== 0) && (safe.x - before.x) ** 2 + (safe.y - before.y) ** 2 < 0.2) {
      this.armadillo!.blocked();
    }
    this.sprite.setPosition(safe.x, safe.y);
    if (!moving && !rolling && !this.armadillo!.curling) {
      if (this.sprite.texture.key !== ARMADILLO_SPRITE_KEY) this.sprite.setTexture(ARMADILLO_SPRITE_KEY, 0);
      this.updateAnimation(this.armadillo!.facing);
      this.sprite.anims.pause();
      return;
    }
    if (rolling || this.armadillo!.curling) {
      if (this.sprite.texture.key !== ARMADILLO_ROLL_KEY) this.sprite.setTexture(ARMADILLO_ROLL_KEY);
      this.sprite.setScale(this.scale);
      this.sprite.play(ARMADILLO_ROLL_ANIMATION, true);
      return;
    }
    if (this.sprite.texture.key !== ARMADILLO_SPRITE_KEY) this.sprite.setTexture(ARMADILLO_SPRITE_KEY, 0);
    this.sprite.setScale(this.scale);
    const moved = normalize(safe.x - before.x, safe.y - before.y);
    this.updateAnimation(moved.x === 0 && moved.y === 0 ? this.armadillo!.facing : moved);
  }

  private updateHedgehog(deltaMs: number, target: Vector2Like): void {
    const h = getHedgehogConfig();
    const before = this.position;
    const step = this.hedgehog!.update(deltaMs, before, target);
    const next = { x: before.x + step.x, y: before.y + step.y };
    const rolling = this.hedgehog!.rolling;
    const curling = this.hedgehog!.curling;
    const moving = step.x !== 0 || step.y !== 0;
    const safe = !moving ? before : rolling
      ? (this.navigation?.move(before, next, this.radius) ?? clampToArena(next, this.radius))
      : (this.navigation?.toward(before, target, Math.hypot(step.x, step.y), this.radius, this.route) ?? clampToArena(next, this.radius));
    if (rolling && moving && (safe.x - before.x) ** 2 + (safe.y - before.y) ** 2 < 0.2) {
      this.hedgehog!.blocked();
    }
    this.sprite.setPosition(safe.x, safe.y);
    if (curling) {
      this.sprite.setScale(this.scale * 1.1, this.scale * 0.84);
      this.sprite.setTint(h.curlTint);
      this.sprite.anims.pause();
      return;
    }
    this.sprite.setScale(this.scale);
    if (!this.elite) this.sprite.setTint(h.tint);
    if (!moving && !rolling) {
      this.updateAnimation(this.hedgehog!.facing);
      this.sprite.anims.pause();
      return;
    }
    const moved = normalize(safe.x - before.x, safe.y - before.y);
    this.updateAnimation(moved.x === 0 && moved.y === 0 ? this.hedgehog!.facing : moved);
  }

  protected updateAnimation(direction: Vector2Like): void {
    const horizontal = Math.sign(Math.round(direction.x));
    const vertical = Math.sign(Math.round(direction.y));
    const animationKey = this.walkAnimations[`${horizontal},${vertical}`];

    if (animationKey) {
      if (this.sprite.anims.isPaused) this.sprite.anims.resume();
      this.sprite.play(animationKey, true);
    }
  }

  takeDamage(amount: number): boolean {
    if (this.isDead) {
      return false;
    }

    if (!this.sprite.scene) {
      this.isDead = true;
      return false;
    }

    const dealt = amount * this.vulnerability;
    this.health -= dealt;
    this.sprite.scene.events.emit('presentation:hit', this.sprite);
    if (dealt > 0) {
      const displayHeight = Number.isFinite(this.sprite.displayHeight) && this.sprite.displayHeight > 0 ? this.sprite.displayHeight : 36;
      const originY = Number.isFinite(this.sprite.originY) ? this.sprite.originY : 0.5;
      this.sprite.scene.events.emit('presentation:damage', {
        x: this.sprite.x,
        y: this.sprite.y - displayHeight * (originY * 0.75),
        amount: dealt,
        vulnerability: this.vulnerability,
        isBoss: this.isBoss
      });
    }
    this.isDead = this.health <= 0;
    return this.isDead;
  }

  displace(x: number, y: number): void {
    if (this.isBoss) return;   // knockback, pulls and crowd shoving never move a boss
    const target = { x: this.sprite.x + x, y: this.sprite.y + y };
    const safe = this.navigation?.move(this.position, target, this.radius) ?? clampToArena(target, this.radius);
    this.sprite.setPosition(safe.x, safe.y);
  }

  destroy(): void {
    // Boss arenas also remove living enemies. Invalidate retained companion targets
    // before Phaser clears the sprite's scene reference.
    this.isDead = true;
    this.sprite.destroy();
  }

  get position(): Vector2Like {
    return { x: this.sprite.x, y: this.sprite.y };
  }
}
