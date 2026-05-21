import type { MetaState } from './types';

const POOL_BASE = [
  'kindling',
  'furnace',
  'bellows',
  'draft',
  'insulation',
  'branching',
  'spread',
  'frost',
];
const POOL_RARE = ['copy', 'rekindle', 'ashLevel', 'portExpand'];

export function getDraftPool(meta: MetaState): string[] {
  return meta.flashoverCount >= 1 ? [...POOL_BASE, ...POOL_RARE] : [...POOL_BASE];
}

export function getRandomDraftChoices(meta: MetaState): string[] {
  const pool = getDraftPool(meta);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, meta.draftCount);
}
