import type { CompanionId, PlayerCharacterId, Vector2Like } from '../core/types';
import { PLAYER_SPRITE_KEY } from './playerSprite';
import { RON_SPRITE_KEY } from './ronSprite';
import { COMPANION_BY_CHARACTER } from './companions';
import { sheldonAnimation } from '../core/SheldonFrames';
import { ronAnimation } from '../core/RonFrames';

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
  /** Short passive identity tag surfaced in character selection and tooltips. */
  passiveTrait: string;
  /** One line for the home screen card. */
  blurb: string;
  animationForDirection: (direction: Vector2Like) => PlayerAnimationChoice;
}

export interface CharacterPassiveModifiers {
  extraHealth: number;
  extraRerolls: number;
  speedMultiplier: number;
  xpMagnetRangeMultiplier: number;
  spellPowerMultiplier: number;
  abilityPowerMultiplier: number;
}

export const CHARACTER_PASSIVES: Record<PlayerCharacterId, CharacterPassiveModifiers> = {
  wizard: {
    extraHealth: 0,
    extraRerolls: 0,
    speedMultiplier: 1,
    xpMagnetRangeMultiplier: 1,
    spellPowerMultiplier: 1.15,
    abilityPowerMultiplier: 1.15
  },
  hailey: {
    extraHealth: 0,
    extraRerolls: 0,
    speedMultiplier: 1.1,
    xpMagnetRangeMultiplier: 1.35,
    spellPowerMultiplier: 1,
    abilityPowerMultiplier: 1
  },
  sheldon: {
    extraHealth: 25,
    extraRerolls: 1,
    speedMultiplier: 1,
    xpMagnetRangeMultiplier: 1,
    spellPowerMultiplier: 1,
    abilityPowerMultiplier: 1
  },
  ron: {
    extraHealth: 0,
    extraRerolls: 0,
    speedMultiplier: 1,
    xpMagnetRangeMultiplier: 1,
    spellPowerMultiplier: 1,
    abilityPowerMultiplier: 1
  }
};

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
    companionId: COMPANION_BY_CHARACTER.sheldon,
    passiveTrait: '+25 Max HP · +1 Reroll',
    blurb: 'Always up for the next trail. +25 Max HP & +1 starting reroll.',
    animationForDirection: direction => sheldonAnimation(direction),
    idleForDirection: direction => sheldonAnimation(direction, true)
  },
  ron: {
    id: 'ron',
    name: 'Ron',
    textureKey: RON_SPRITE_KEY,
    scale: 0.35,
    bakedAnimation: true,
    footOriginY: 238 / 256,
    idleAnimation: { key: 'ron-idle-south' },
    aura: false,
    companionId: COMPANION_BY_CHARACTER.ron,
    passiveTrait: '3 Exclusive Performance Abilities',
    blurb: 'A festive bard. Every heart a willing audience — with 3 exclusive performance abilities.',
    animationForDirection: direction => ronAnimation(direction),
    idleForDirection: direction => ronAnimation(direction, true)
  },
  wizard: {
    id: 'wizard',
    name: 'Nick',
    textureKey: PLAYER_SPRITE_KEY,
    scale: 0.4,
    idleAnimation: { key: 'player-idle-down' },
    aura: false,
    companionId: COMPANION_BY_CHARACTER.wizard,
    passiveTrait: '+15% Spell & Ability Power',
    blurb: 'A spark of woodland magic. +15% projectile & ability spell power.',
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
    passiveTrait: '+10% Move Speed · +35% XP Magnet',
    blurb: 'An adventurous heart. +10% move speed & +35% XP magnet range.',
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
