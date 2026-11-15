import Phaser from 'phaser';
import { reducedMotion } from '../config/presentation';

export interface DamageNumberPayload {
  x: number;
  y: number;
  amount: number;
  vulnerability?: number;
  isBoss?: boolean;
}

export interface DamageNumberStyle {
  label: string;
  color: string;
  fontSize: number;
  durationMs: number;
  tier: 'crit' | 'resisted' | 'normal';
}

interface DamageEntry {
  text: Phaser.GameObjects.Text;
  active: boolean;
  age: number;
  life: number;
  vx: number;
  vy: number;
  baseScale: number;
}

const POOL_SIZE = 64;
const DAMAGE_DEPTH = 32;

export function classifyDamageStyle(
  amount: number,
  vulnerability = 1,
  isBoss = false
): DamageNumberStyle {
  const value = Math.max(1, Math.round(amount));
  if (vulnerability > 1.001) {
    return {
      label: `${value}`,
      color: '#ffd86b',
      fontSize: 22,
      durationMs: 760,
      tier: 'crit'
    };
  }
  if (vulnerability < 0.999) {
    return {
      label: `${value}`,
      color: '#b4c2d0',
      fontSize: 15,
      durationMs: 600,
      tier: 'resisted'
    };
  }
  return {
    label: `${value}`,
    color: '#fff6dc',
    fontSize: isBoss || value >= 45 ? 19 : 17,
    durationMs: 660,
    tier: 'normal'
  };
}

export class DamageNumberSystem {
  private readonly pool: DamageEntry[] = [];
  private readonly handleDamage = (payload: DamageNumberPayload) => {
    this.spawn(payload.x, payload.y, payload.amount, payload.vulnerability, payload.isBoss);
  };

  constructor(private readonly scene: Phaser.Scene) {
    for (let i = 0; i < POOL_SIZE; i++) {
      const text = scene.add
        .text(0, 0, '', {
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: '17px',
          fontStyle: 'bold',
          color: '#fff6dc',
          stroke: '#231409',
          strokeThickness: 4
        })
        .setDepth(DAMAGE_DEPTH)
        .setOrigin(0.5, 0.5)
        .setVisible(false);
      this.pool.push({
        text,
        active: false,
        age: 0,
        life: 0,
        vx: 0,
        vy: 0,
        baseScale: 1
      });
    }
    scene.events.on('presentation:damage', this.handleDamage);
  }

  spawn(
    x: number,
    y: number,
    amount: number,
    vulnerability = 1,
    isBoss = false
  ): void {
    if (!Number.isFinite(amount) || amount <= 0) return;

    const slot = this.acquireSlot();
    const style = classifyDamageStyle(amount, vulnerability, isBoss);
    const calm = reducedMotion();
    const jitterX = calm ? 0 : (Math.random() - 0.5) * 16;
    const jitterY = calm ? 0 : (Math.random() - 0.5) * 6;

    slot.active = true;
    slot.age = 0;
    slot.life = style.durationMs;
    slot.vx = calm ? 0 : (Math.random() - 0.5) * 18;
    slot.vy = calm ? 0 : style.tier === 'crit' ? -56 : style.tier === 'resisted' ? -34 : -45;
    slot.baseScale = calm ? 1 : style.tier === 'crit' ? 1.18 : 1;

    slot.text
      .setText(style.label)
      .setColor(style.color)
      .setFontSize(style.fontSize)
      .setPosition(x + jitterX, y + jitterY)
      .setScale(slot.baseScale)
      .setAlpha(1)
      .setVisible(true);
  }

  update(deltaMs: number): void {
    const calm = reducedMotion();
    const dt = Math.max(0, deltaMs) / 1000;
    for (const entry of this.pool) {
      if (!entry.active) continue;
      entry.age += Math.max(0, deltaMs);
      if (entry.age >= entry.life) {
        entry.active = false;
        entry.text.setVisible(false);
        continue;
      }

      const progress = entry.age / entry.life;
      if (!calm) {
        const drag = Math.max(0.25, 1 - progress * 0.72);
        entry.text.x += entry.vx * dt * drag;
        entry.text.y += entry.vy * dt * drag;
        const pop =
          progress < 0.16
            ? entry.baseScale * (1 + (0.14 * (1 - progress / 0.16)))
            : entry.baseScale * (1 - Math.max(0, progress - 0.5) * 0.14);
        entry.text.setScale(pop);
      } else {
        entry.text.setScale(1);
      }

      const alpha = progress < 0.55 ? 1 : Math.max(0, 1 - (progress - 0.55) / 0.45);
      entry.text.setAlpha(alpha);
    }
  }

  destroy(): void {
    this.scene.events.off('presentation:damage', this.handleDamage);
    for (const entry of this.pool) {
      entry.active = false;
      entry.text.destroy();
    }
    this.pool.length = 0;
  }

  private acquireSlot(): DamageEntry {
    let oldest = this.pool[0];
    let highestProgress = -1;
    for (const entry of this.pool) {
      if (!entry.active) return entry;
      const progress = entry.life > 0 ? entry.age / entry.life : 1;
      if (progress > highestProgress) {
        highestProgress = progress;
        oldest = entry;
      }
    }
    return oldest;
  }
}
