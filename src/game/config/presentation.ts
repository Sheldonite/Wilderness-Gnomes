import title from '../../assets/storybook/woodland-title.png';
import ground from '../../assets/storybook/moss-ground.png';
import props from '../../assets/storybook/woodland-props-source.png';
import water from '../../assets/storybook/stream-water.png';
import bridge from '../../assets/storybook/timber-bridge-source.png';
import crossbow from '../../assets/storybook/heartwood-crossbow.png';
import crossbowTop from '../../assets/storybook/heartwood-crossbow-top.png';

export const ART = { title, ground, props, water, bridge, crossbow, crossbowTop } as const;
export const LOOK = {
  worldPadding: 160,
  color: { ink: 0x203a2e, moss: 0x6c814e, gold: 0xe8c57b, cream: 0xfff0cb, spell: 0x83e4f5, quarrel: 0xd5a35c, xp: 0x9af0bd },
  depth: { ground: -50, terrain: -40, flowers: -20, shadow: 0, pickup: 5, enemy: 10, spell: 15, companion: 19, player: 20, canopy: 25, atmosphere: 35 },
  limit: { particles: 140, pollen: 24, canopies: 76, abilityBursts: 6 },
  ability: { roots: 0x8baf67, spores: 0xcbabd9, acorn: 0xd5a35c, ward: 0xb2ce84 },
  texture: { ground: 'storybook-ground', props: 'storybook-props', bolt: 'spell-bolt', acorn: 'acorn', quarrel: 'crossbow-bolt', crossbow: 'heartwood-crossbow', crossbowTop: 'heartwood-crossbow-top', crystal: 'xp-crystal', spark: 'spell-spark', shadow: 'contact-shadow' }
} as const;

const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
export function reducedMotion(): boolean { return motionPreference.matches; }
