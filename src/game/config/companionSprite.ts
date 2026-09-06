import type Phaser from 'phaser';

export const MYSTERY_SPRITE_KEY = 'companion-mystery';
export const MYSTERY_POUNCE_SPRITE_KEY = 'companion-mystery-pounce';
export const MYSTERY_ANIMATION_PREFIX = 'mystery';
export const MYSTERY_FRAME_SIZE = 64;
export const MYSTERY_FRAMES_PER_ROW = 4;

export const MYSTERY_MOVEMENT_ANIMATION_ROWS = [
  ['idle', 0, 6],
  ['walk-down', 1, 8],
  ['walk-down-right', 2, 8],
  ['walk-right', 3, 8],
  ['walk-up-right', 4, 8],
  ['walk-up', 5, 8],
  ['walk-up-left', 6, 8],
  ['walk-left', 7, 8],
  ['walk-down-left', 8, 8]
] as const;

export const MYSTERY_POUNCE_ANIMATION_ROWS = [
  ['pounce-down', 0, 12],
  ['pounce-down-right', 1, 12],
  ['pounce-right', 2, 12],
  ['pounce-up-right', 3, 12],
  ['pounce-up', 4, 12],
  ['pounce-up-left', 5, 12],
  ['pounce-left', 6, 12],
  ['pounce-down-left', 7, 12]
] as const;

export const MYSTERY_WALK_ANIMATION_BY_DIRECTION: Record<string, string> = {
  '0,1': 'mystery-walk-down',
  '1,1': 'mystery-walk-down-right',
  '1,0': 'mystery-walk-right',
  '1,-1': 'mystery-walk-up-right',
  '0,-1': 'mystery-walk-up',
  '-1,-1': 'mystery-walk-up-left',
  '-1,0': 'mystery-walk-left',
  '-1,1': 'mystery-walk-down-left'
};

export const MYSTERY_POUNCE_ANIMATION_BY_DIRECTION: Record<string, string> = {
  '0,1': 'mystery-pounce-down',
  '1,1': 'mystery-pounce-down-right',
  '1,0': 'mystery-pounce-right',
  '1,-1': 'mystery-pounce-up-right',
  '0,-1': 'mystery-pounce-up',
  '-1,-1': 'mystery-pounce-up-left',
  '-1,0': 'mystery-pounce-left',
  '-1,1': 'mystery-pounce-down-left'
};

export interface SpriteFrameAdjustment {
  sourceX: number;
  sourceY: number;
  offsetX: number;
  offsetY: number;
}

export type SpriteAdjustmentMap = Record<string, SpriteFrameAdjustment>;

export const MYSTERY_WALK_DEFAULT_ADJUSTMENTS: SpriteAdjustmentMap = {
  'idle-1': {
    sourceX: 0,
    sourceY: 0,
    offsetX: -22,
    offsetY: 0
  },
  'idle-2': {
    sourceX: 64,
    sourceY: 0,
    offsetX: -7,
    offsetY: 0
  },
  'idle-4': {
    sourceX: 192,
    sourceY: 0,
    offsetX: 22,
    offsetY: 0
  },
  'walk-down-1': {
    sourceX: 4,
    sourceY: 76,
    offsetX: 0,
    offsetY: 0
  },
  'walk-down-2': {
    sourceX: 65,
    sourceY: 75,
    offsetX: 0,
    offsetY: 0
  },
  'walk-down-3': {
    sourceX: 123,
    sourceY: 76,
    offsetX: 0,
    offsetY: 0
  },
  'walk-down-4': {
    sourceX: 183,
    sourceY: 76,
    offsetX: 0,
    offsetY: 0
  },
  'walk-down-right-1': {
    sourceX: 4,
    sourceY: 149,
    offsetX: 0,
    offsetY: 0
  },
  'walk-down-right-2': {
    sourceX: 64,
    sourceY: 149,
    offsetX: 0,
    offsetY: 0
  },
  'walk-down-right-3': {
    sourceX: 128,
    sourceY: 149,
    offsetX: 0,
    offsetY: 0
  },
  'walk-down-right-4': {
    sourceX: 192,
    sourceY: 141,
    offsetX: 10,
    offsetY: 0
  },
  'walk-right-1': {
    sourceX: 6,
    sourceY: 215,
    offsetX: -7,
    offsetY: 0
  },
  'walk-up-right-1': {
    sourceX: 7,
    sourceY: 281,
    offsetX: 0,
    offsetY: 0
  },
  'walk-up-right-2': {
    sourceX: 69,
    sourceY: 282,
    offsetX: 0,
    offsetY: 0
  },
  'walk-up-right-3': {
    sourceX: 130,
    sourceY: 282,
    offsetX: 0,
    offsetY: 0
  },
  'walk-up-right-4': {
    sourceX: 192,
    sourceY: 281,
    offsetX: 0,
    offsetY: 0
  },
  'walk-up-1': {
    sourceX: 0,
    sourceY: 344,
    offsetX: -10,
    offsetY: 0
  },
  'walk-up-2': {
    sourceX: 65,
    sourceY: 345,
    offsetX: 0,
    offsetY: 0
  },
  'walk-up-3': {
    sourceX: 125,
    sourceY: 345,
    offsetX: 0,
    offsetY: 0
  },
  'walk-up-4': {
    sourceX: 183,
    sourceY: 345,
    offsetX: 0,
    offsetY: 0
  },
  'walk-up-left-1': {
    sourceX: 1,
    sourceY: 408,
    offsetX: 0,
    offsetY: 0
  },
  'walk-up-left-2': {
    sourceX: 64,
    sourceY: 408,
    offsetX: 0,
    offsetY: 0
  },
  'walk-up-left-3': {
    sourceX: 124,
    sourceY: 409,
    offsetX: 0,
    offsetY: 0
  },
  'walk-up-left-4': {
    sourceX: 185,
    sourceY: 409,
    offsetX: 0,
    offsetY: 0
  },
  'walk-left-1': {
    sourceX: 8,
    sourceY: 465,
    offsetX: 0,
    offsetY: 0
  },
  'walk-left-2': {
    sourceX: 67,
    sourceY: 465,
    offsetX: 0,
    offsetY: 0
  },
  'walk-left-3': {
    sourceX: 128,
    sourceY: 465,
    offsetX: 0,
    offsetY: 0
  },
  'walk-left-4': {
    sourceX: 187,
    sourceY: 465,
    offsetX: 0,
    offsetY: 0
  },
  'walk-down-left-1': {
    sourceX: 10,
    sourceY: 512,
    offsetX: -4,
    offsetY: -11
  },
  'walk-down-left-2': {
    sourceX: 67,
    sourceY: 512,
    offsetX: 0,
    offsetY: 0
  },
  'walk-down-left-4': {
    sourceX: 187,
    sourceY: 512,
    offsetX: 0,
    offsetY: 0
  }
};

export function getMysteryDefaultFrameAdjustment(
  frameKey: string,
  defaultSourceX: number,
  defaultSourceY: number
): SpriteFrameAdjustment {
  return (
    MYSTERY_WALK_DEFAULT_ADJUSTMENTS[frameKey] ?? {
      sourceX: defaultSourceX,
      sourceY: defaultSourceY,
      offsetX: 0,
      offsetY: 0
    }
  );
}

/** The original illustrations have unequal row spacing; only frame metadata changes. */
export function alignMysteryFrames(scene: Phaser.Scene): void {
  const sheets = [
    { key: MYSTERY_SPRITE_KEY, rows: MYSTERY_MOVEMENT_ANIMATION_ROWS, bands: [[13, 64], [73, 140], [150, 207], [220, 272], [292, 334], [350, 402], [419, 462], [477, 521], [529, 570]] },
    { key: MYSTERY_POUNCE_SPRITE_KEY, rows: MYSTERY_POUNCE_ANIMATION_ROWS, bands: [[13, 68], [81, 131], [153, 192], [217, 259], [272, 320], [340, 385], [405, 442], [453, 504]] }
  ];
  for (const sheet of sheets) {
    const texture = scene.textures.get(sheet.key);
    const source = texture.getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, source.width, source.height).data;
    sheet.rows.forEach(([name, row]) => {
      const [y0, y1] = sheet.bands[row];
      for (let col = 0; col < 4; col++) {
        let left = (col + 1) * 64, right = col * 64, top = y1, bottom = y0;
        for (let y = y0; y <= y1; y++) for (let x = col * 64; x < (col + 1) * 64; x++) {
          if (pixels[(y * source.width + x) * 4 + 3] > 16) {
            left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
          }
        }
        const width = right - left + 1, height = bottom - top + 1;
        const frame = texture.get(row * 4 + col);
        frame.setSize(width, height, left, top);
        frame.setTrim(64, 80, Math.round((64 - width) / 2), 72 - height, width, height);
        MYSTERY_WALK_DEFAULT_ADJUSTMENTS[`${name}-${col + 1}`] = { sourceX: left, sourceY: top, offsetX: frame.x, offsetY: frame.y };
      }
    });
  }
}
