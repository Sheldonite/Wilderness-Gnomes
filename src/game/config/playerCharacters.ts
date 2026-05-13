import type { Vector2Like } from '../core/types';
import { PLAYER_SPRITE_KEY } from './playerSprite';

export type PlayerCharacterId = 'wizard' | 'hailey';

export interface PlayerAnimationChoice {
  key: string;
  flipX?: boolean;
}

export interface PlayerCharacterDefinition {
  id: PlayerCharacterId;
  name: string;
  textureKey: string;
  scale: number;
  idleAnimation: PlayerAnimationChoice;
  aura: boolean;
  animationForDirection: (direction: Vector2Like) => PlayerAnimationChoice;
}

export const HAILEY_SPRITE_KEY = 'player-hailey';
export const HAILEY_FRAME_WIDTH = 145;
export const HAILEY_FRAME_HEIGHT = 257;
export const HAILEY_ANIMATION_PREFIX = 'hailey';

function directionToKey(direction: Vector2Like): string {
  const horizontal = Math.abs(direction.x) < 0.33 ? 0 : Math.sign(direction.x);
  const vertical = Math.abs(direction.y) < 0.33 ? 0 : Math.sign(direction.y);
  return `${horizontal},${vertical}`;
}

const WIZARD_WALK_ANIMATION_BY_DIRECTION: Record<string, PlayerAnimationChoice> = {
  '0,1': { key: 'player-walk-down' },
  '1,1': { key: 'player-walk-down-right' },
  '1,0': { key: 'player-walk-right' },
  '1,-1': { key: 'player-walk-up-right' },
  '0,-1': { key: 'player-walk-up' },
  '-1,-1': { key: 'player-walk-up-left' },
  '-1,0': { key: 'player-walk-left' },
  '-1,1': { key: 'player-walk-down-left' }
};

const HAILEY_WALK_ANIMATION_BY_DIRECTION: Record<string, PlayerAnimationChoice> = {
  '0,1': { key: 'hailey-walk-down' },
  '1,1': { key: 'hailey-walk-down' },
  '1,0': { key: 'hailey-walk-right' },
  '1,-1': { key: 'hailey-walk-up' },
  '0,-1': { key: 'hailey-walk-up' },
  '-1,-1': { key: 'hailey-walk-up', flipX: true },
  '-1,0': { key: 'hailey-walk-right', flipX: true },
  '-1,1': { key: 'hailey-walk-down', flipX: true }
};

export const PLAYER_CHARACTERS: Record<PlayerCharacterId, PlayerCharacterDefinition> = {
  wizard: {
    id: 'wizard',
    name: 'Code Wizard',
    textureKey: PLAYER_SPRITE_KEY,
    scale: 0.75,
    idleAnimation: { key: 'player-idle-down' },
    aura: false,
    animationForDirection: (direction) =>
      WIZARD_WALK_ANIMATION_BY_DIRECTION[directionToKey(direction)] ?? { key: 'player-idle-down' }
  },
  hailey: {
    id: 'hailey',
    name: 'Hailey',
    textureKey: HAILEY_SPRITE_KEY,
    scale: 0.42,
    idleAnimation: { key: 'hailey-idle-down' },
    aura: true,
    animationForDirection: (direction) =>
      HAILEY_WALK_ANIMATION_BY_DIRECTION[directionToKey(direction)] ?? { key: 'hailey-idle-down' }
  }
};

export function getPlayerCharacter(id?: string): PlayerCharacterDefinition {
  if (id === 'hailey') {
    return PLAYER_CHARACTERS.hailey;
  }

  return PLAYER_CHARACTERS.wizard;
}
