import type { MetaState } from './types';
import { INITIAL_META } from './meta';

const KEY = 'thermal-runaway-meta-v1';

interface SerializedMeta {
  ash: number;
  flashoverCount: number;
  bonusN: number;
  bonusV0: number;
  airCapBoost: boolean;
  startExtra: string[];
  ashBonus: number;
  draftCount: number;
  purchasedUpgrades: string[];
}

export function saveMeta(meta: MetaState): void {
  try {
    const data: SerializedMeta = {
      ...meta,
      purchasedUpgrades: [...meta.purchasedUpgrades],
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage full or disabled — ignore
  }
}

export function loadMeta(): MetaState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data: SerializedMeta = JSON.parse(raw) as SerializedMeta;
    return {
      ...INITIAL_META,
      ...data,
      purchasedUpgrades: new Set(data.purchasedUpgrades ?? []),
    };
  } catch {
    return null;
  }
}

export function resetMeta(): void {
  localStorage.removeItem(KEY);
}
