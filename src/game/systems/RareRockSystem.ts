import Phaser from 'phaser';
import { LOOK, reducedMotion } from '../config/presentation';
import { RareRockDrops, type RareRock } from '../core/RareRockDrops';
import { SceneryNavigation } from '../core/SceneryNavigation';
import { createRunId, type MarketProgress } from '../core/MarketProgress';
import type { Vector2Like } from '../core/types';
import { icon } from '../ui/icons';

export class RareRockSystem {
  private readonly drops: RareRockDrops;
  private readonly views = new Map<number, Phaser.GameObjects.Container>();
  private readonly runId = createRunId();
  private readonly hud: HTMLElement;
  private age = 0;
  private noticeUntil = 0;
  constructor(private readonly scene: Phaser.Scene, navigation: SceneryNavigation,
    private readonly wallet: MarketProgress, private readonly preview = false) {
    const ground = new SceneryNavigation();
    this.drops = new RareRockDrops({ blocked: (p, r) => ground.blocked(p, r) || navigation.blocked(p, r),
      clear: (a, b, r) => navigation.clear(a, b, r) });
    this.hud = document.createElement('div');
    this.hud.className = 'rare-rock-hud';
    this.hud.innerHTML = `${icon('rock')}<span><strong></strong><small></small></span>`;
    this.hud.setAttribute('role', 'status');
    document.querySelector('.game-ui')!.append(this.hud);
    this.refreshHud();
  }

  update(deltaMs: number, player: Vector2Like, allowSpawn: boolean): void {
    this.age += deltaMs;
    const rock = this.drops.update(deltaMs, player, allowSpawn);
    if (rock) this.createView(rock);
    for (const [id, view] of this.views) {
      const glow = view.getAt(0) as Phaser.GameObjects.Graphics;
      const pulse = reducedMotion() ? .5 : (Math.sin(this.age / 650 + id) + 1) / 2;
      glow.setAlpha(.75 + pulse * .25).setScale(1 + pulse * .08);
    }
    const picked = this.drops.collectNearby(player);
    if (picked) {
      const result = this.wallet.collectRock(`${this.runId}:rock:${picked.id}`);
      this.views.get(picked.id)?.destroy(); this.views.delete(picked.id);
      this.noticeUntil = this.age + 3000;
      this.refreshHud(result.saved ? '+1 rock saved!' : '+1 rock · save unavailable');
    } else if (this.noticeUntil && this.age >= this.noticeUntil) {
      this.noticeUntil = 0; this.refreshHud();
    }
  }

  private refreshHud(notice?: string): void {
    const balance = this.wallet.profile.rocks;
    this.hud.querySelector('strong')!.textContent = `${balance.toLocaleString()} rare ${balance === 1 ? 'rock' : 'rocks'}`;
    this.hud.querySelector('small')!.textContent = this.preview ? 'Practice collection' : notice ??
      (this.wallet.storageStatus === 'ready' ? 'Kept between runs' : 'Saving unavailable · session only');
  }

  private createView(rock: RareRock): void {
    const glow = this.scene.add.graphics();
    // Layer translucent light for a soft purple halo around the whole rock.
    glow.setBlendMode(Phaser.BlendModes.ADD);
    for (let radius = 48; radius >= 16; radius -= 4) {
      glow.fillStyle(0x9d35ff, .045).fillEllipse(0, -6, radius * 2, radius * 1.5);
    }
    glow.fillStyle(0xc17aff, .22).fillEllipse(0, 4, 44, 24);
    const body = this.scene.add.graphics();
    body.fillStyle(0x453657).fillPoints([{ x: -17, y: 5 }, { x: -13, y: -13 }, { x: 1, y: -22 }, { x: 16, y: -12 }, { x: 20, y: 4 }, { x: 6, y: 11 }, { x: -10, y: 10 }], true);
    body.fillStyle(0x9d82c4).fillTriangle(-13, -13, 1, -22, 4, -3);
    body.fillStyle(0x6e568d).fillTriangle(1, -22, 16, -12, 4, -3);
    body.lineStyle(2, 0xe1caff).lineBetween(-9, 1, 4, -3).lineBetween(4, -3, 9, 6);
    body.lineStyle(2, 0xf4eaff).lineBetween(22, -28, 22, -18).lineBetween(17, -23, 27, -23);
    this.views.set(rock.id, this.scene.add.container(rock.position.x, rock.position.y, [glow, body]).setDepth(LOOK.depth.pickup + 1));
  }

  spawnForReview(player: Vector2Like): void { const rock = this.drops.spawnNear(player); if (rock) this.createView(rock); }
  get positions(): Vector2Like[] { return this.drops.rocks.map(rock => rock.position); }
  destroy(): void { for (const view of this.views.values()) view.destroy(); this.views.clear(); this.hud.remove(); }
}
