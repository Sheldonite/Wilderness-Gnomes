import Phaser from 'phaser';
import { ChestDrops } from '../core/ChestDrops';
import { LOOK, reducedMotion } from '../config/presentation';
import type { GameManager } from '../core/GameManager';
import { SceneryNavigation } from '../core/SceneryNavigation';
import type { Vector2Like } from '../core/types';

/** Small gold-banded woodland chests, drawn with the game's existing vector effects. */
export class ChestSystem {
  readonly drops: ChestDrops;
  private readonly views = new Map<number, { body: Phaser.GameObjects.Graphics; glow: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }>();
  private retryMs = 0;
  private readonly ground = new SceneryNavigation();

  constructor(private readonly scene: Phaser.Scene, navigation: SceneryNavigation) {
    // Water is walkable scenery in the current game, but treasure should still sit on dry land.
    this.drops = new ChestDrops({
      blocked: (position, radius) => this.ground.blocked(position, radius) || navigation.blocked(position, radius),
      clear: (from, to, radius) => navigation.clear(from, to, radius)
    });
  }

  update(deltaMs: number, player: Vector2Like, game: GameManager): boolean {
    if (game.state !== 'Playing') return false;
    if (game.bossGate.required(game.level)) return false;
    this.drops.advanceToLevel(game.level);
    this.retryMs -= deltaMs;
    if (this.retryMs <= 0 && this.drops.pending) {
      this.retryMs = 500;
      const chest = this.drops.spawnNear(player);
      if (chest) this.createView(chest.id, chest.position);
    }
    for (const [id, view] of this.views) {
      const pulse = reducedMotion() ? .5 : (Math.sin(game.elapsedMs / 420 + id) + 1) / 2;
      view.glow.setAlpha(.45 + pulse * .35).setScale(1 + pulse * .08);
    }
    const collected = this.drops.collectNearby(player, game);
    if (!collected) return false;
    this.removeView(collected.id);
    this.scene.events.emit('presentation:level', collected.position);
    return true;
  }

  get positions(): Vector2Like[] { return this.drops.chests.map(chest => chest.position); }

  dropBoss(position: Vector2Like): void {
    const chest = this.drops.addBoss(this.ground.nearest(position, 24));
    this.createView(chest.id, chest.position, true);
  }

  private createView(id: number, position: Vector2Like, boss = false): void {
    const { x, y } = position;
    const glow = this.scene.add.graphics().setPosition(x, y).setDepth(LOOK.depth.pickup - 1);
    glow.fillStyle(0xffd56a, .12).fillEllipse(0, 0, 82, 44);
    glow.lineStyle(boss ? 4 : 2, boss ? 0xdba4ff : 0xffe9a4, .8).strokeEllipse(0, 0, boss ? 78 : 56, boss ? 36 : 25);
    glow.fillStyle(0xffe9a4, .65).fillRect(-28, -31, 3, 9).fillRect(-31, -28, 9, 3);
    glow.fillRect(25, -42, 3, 9).fillRect(22, -39, 9, 3);
    const body = this.scene.add.graphics().setPosition(x, y).setDepth(LOOK.depth.pickup);
    body.fillStyle(0x172a21, .3).fillEllipse(0, 5, 44, 16);
    body.fillStyle(0x382719).fillRoundedRect(-21, -29, 42, 36, 4);
    body.fillStyle(boss ? 0x633799 : 0x996036).fillRoundedRect(-18, -26, 36, 30, 3);
    body.fillStyle(boss ? 0xb27de2 : 0xc28a49).fillRoundedRect(-18, -26, 36, 14, 3);
    body.lineStyle(2, 0x57391f).lineBetween(-18, -11, 18, -11);
    body.fillStyle(0xf3cd6d).fillRect(-14, -26, 4, 30).fillRect(10, -26, 4, 30);
    body.fillStyle(0xffe6a0).fillRoundedRect(-5, -16, 10, 12, 2);
    body.fillStyle(0x57391f).fillCircle(0, -11, 2).fillRect(-1, -11, 2, 4);
    if (boss) {
      body.fillStyle(0xffdf83).fillTriangle(-10, -32, -12, -43, 0, -37).fillTriangle(0, -37, 12, -43, 10, -32).fillRect(-10, -34, 20, 4);
      body.setScale(1.3);
    }
    const label = this.scene.add.text(x, y + 20, boss ? 'BOSS RELIC' : 'FREE UPGRADE', {
      fontFamily: 'Georgia', fontSize: '10px', color: '#fff0b2',
      stroke: '#283b24', strokeThickness: 3
    }).setOrigin(.5).setDepth(LOOK.depth.pickup + 1);
    this.views.set(id, { body, glow, label });
  }

  private removeView(id: number): void {
    const view = this.views.get(id);
    if (view) { view.body.destroy(); view.glow.destroy(); view.label.destroy(); }
    this.views.delete(id);
  }

  destroy(): void { for (const id of this.views.keys()) this.removeView(id); }
}
