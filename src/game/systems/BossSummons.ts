import type { EnemyVariant } from '../entities/EnemyController';

/** Boss systems ask the scene for reinforcements; the scene places them around the arena. */
export type SummonAdds = (variant: EnemyVariant, count: number, tint?: number) => void;
