export const TERRAIN_GROUND_KEY = 'terrain-ground-forest';
export const TERRAIN_PROPS_KEY = 'terrain-forest-props';
export const TERRAIN_WATER_KEY = 'terrain-water-bridge';

export const TERRAIN_TILE_SIZE = 256;
export const TERRAIN_FEATURE_FRAME_SIZE = 128;

export const TERRAIN_PROP_FRAMES = {
  trees: [0, 1, 2, 3, 4, 5, 6, 7],
  rocks: [8, 9, 10, 11, 12, 13, 14, 15]
} as const;

export const TERRAIN_WATER_FRAMES = {
  ponds: [0, 1, 2, 3],
  rivers: [4, 5, 6, 7],
  bridges: [8, 9, 10, 11],
  paths: [12, 13, 14, 15]
} as const;
