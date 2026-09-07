import type { CompanionId, PlayerCharacterId, Vector2Like } from '../core/types';
import { PLAYER_SPRITE_KEY } from './playerSprite';
import { RON_ANIMATION_PREFIX, RON_SPRITE_KEY } from './ronSprite';
import { COMPANION_BY_CHARACTER } from './companions';
import { sheldonAnimation } from '../core/SheldonFrames';

export type { PlayerCharacterId };

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
  idleForDirection?: (direction: Vector2Like) => PlayerAnimationChoice;
  bakedAnimation?: boolean;
  footOriginY?: number;
  aura: boolean;
  /** The one companion who travels with this wanderer, for every run. */
  companionId: CompanionId;
  /** One line for the home screen card. */
  blurb: string;
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
  '1,-1': { key: 'player-walk-up-left', flipX: true },
  '0,-1': { key: 'player-walk-up' },
  '-1,-1': { key: 'player-walk-up-left' },
  '-1,0': { key: 'player-walk-left' },
  '-1,1': { key: 'player-walk-down-left' }
};

const RON_WALK_ANIMATION_BY_DIRECTION: Record<string, PlayerAnimationChoice> = {
  '0,1': { key: `${RON_ANIMATION_PREFIX}-walk-down` },
  '1,1': { key: `${RON_ANIMATION_PREFIX}-walk-down-right` },
  '1,0': { key: `${RON_ANIMATION_PREFIX}-walk-right` },
  '1,-1': { key: `${RON_ANIMATION_PREFIX}-walk-up-left`, flipX: true },
  '0,-1': { key: `${RON_ANIMATION_PREFIX}-walk-up` },
  '-1,-1': { key: `${RON_ANIMATION_PREFIX}-walk-up-left` },
  '-1,0': { key: `${RON_ANIMATION_PREFIX}-walk-left` },
  '-1,1': { key: `${RON_ANIMATION_PREFIX}-walk-down-left` }
};

const HAILEY_WALK_ANIMATION_BY_DIRECTION: Record<string, PlayerAnimationChoice> = {
  '0,1': { key: 'hailey-walk-down' },
  '1,1': { key: 'hailey-walk-down', flipX: true },
  '1,0': { key: 'hailey-walk-right', flipX: true },
  '1,-1': { key: 'hailey-walk-up', flipX: true },
  '0,-1': { key: 'hailey-walk-up' },
  '-1,-1': { key: 'hailey-walk-up' },
  '-1,0': { key: 'hailey-walk-right' },
  '-1,1': { key: 'hailey-walk-down' }
};

export const PLAYER_CHARACTERS: Record<PlayerCharacterId, PlayerCharacterDefinition> = {
  sheldon: {
    id: 'sheldon', name: 'Sheldon', textureKey: 'player-sheldon', scale: .35,
    idleAnimation: { key: 'sheldon-idle-south' }, aura: false, bakedAnimation: true, footOriginY: 238 / 256,
    companionId: COMPANION_BY_CHARACTER.sheldon, blurb: 'Always up for the next trail.',
    animationForDirection: direction => sheldonAnimation(direction),
    idleForDirection: direction => sheldonAnimation(direction, true)
  },
  ron: {
    id: 'ron',
    name: 'Ron',
    textureKey: RON_SPRITE_KEY,
    scale: 0.4,
    idleAnimation: { key: `${RON_ANIMATION_PREFIX}-idle-down` },
    aura: false,
    companionId: COMPANION_BY_CHARACTER.ron,
    blurb: 'A festive bard. Every heart a willing audience.',
    animationForDirection: (direction) =>
      RON_WALK_ANIMATION_BY_DIRECTION[directionToKey(direction)] ?? { key: `${RON_ANIMATION_PREFIX}-idle-down` }
  },
  wizard: {
    id: 'wizard',
    name: 'Nick',
    textureKey: PLAYER_SPRITE_KEY,
    scale: 0.4,
    idleAnimation: { key: 'player-idle-down' },
    aura: false,
    companionId: COMPANION_BY_CHARACTER.wizard,
    blurb: 'A spark of woodland magic.',
    animationForDirection: (direction) =>
      WIZARD_WALK_ANIMATION_BY_DIRECTION[directionToKey(direction)] ?? { key: 'player-idle-down' }
  },
  hailey: {
    id: 'hailey',
    name: 'Hailey',
    textureKey: HAILEY_SPRITE_KEY,
    scale: 0.315,
    idleAnimation: { key: 'hailey-idle-down' },
    aura: true,
    companionId: COMPANION_BY_CHARACTER.hailey,
    blurb: 'An adventurous heart.',
    animationForDirection: (direction) =>
      HAILEY_WALK_ANIMATION_BY_DIRECTION[directionToKey(direction)] ?? { key: 'hailey-idle-down' }
  }
};

export function getPlayerCharacter(id?: string): PlayerCharacterDefinition {
  if (id === 'sheldon') return PLAYER_CHARACTERS.sheldon;
  if (id === 'ron') return PLAYER_CHARACTERS.ron;
  if (id === 'hailey') {
    return PLAYER_CHARACTERS.hailey;
  }

  return PLAYER_CHARACTERS.wizard;
}
