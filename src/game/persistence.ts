import type { CardInstance, GamePhase, MetaState, SimState } from './types';
import { INITIAL_META } from './meta';

// Bump this when the save format changes to invalidate old saves.
const SAVE_VERSION = 2;
const SAVE_KEY = 'thermal-runaway-v2';

// ---------------------------------------------------------------------------
// RunSave — serialisable snapshot of an in-progress run
// ---------------------------------------------------------------------------

export type SavePhase = Extract<GamePhase, 'running' | 'paused' | 'draft' | 'refine'>;

export interface RunSave {
  phase: SavePhase;
  deck: CardInstance[];
  head: number;
  PH: number;
  passiveOutput: number;
  v: number;
  mult: number;
  t: number;
  k_eff: number;
  n_eff: number;
  C0_eff: number;
  frozenTotal: number;
  belowTimer: number;
  reignCount: number;
  reignMult: number;
  peakPH: number;
  furnaceBoostCharges: number;
  challengeFlags: string[];
  skipBonus: number;
  airCap: number;
  draftChoices: string[];
  graphPH: number[];
  graphCool: number[];
  savedAt: number;
}

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

interface FullSave {
  version: number;
  meta: SerializedMeta;
  run: RunSave | null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildRunSave(
  phase: SavePhase,
  state: SimState,
  draftChoices: string[],
  graphPH: number[],
  graphCool: number[],
): RunSave {
  return {
    phase,
    deck: state.deck.map(c => ({ ...c })),
    head: state.head,
    PH: state.PH,
    passiveOutput: state.passiveOutput,
    v: state.v,
    mult: state.mult,
    t: state.t,
    k_eff: state.k_eff,
    n_eff: state.n_eff,
    C0_eff: state.C0_eff,
    frozenTotal: state.frozenTotal,
    belowTimer: state.belowTimer,
    reignCount: state.reignCount,
    reignMult: state.reignMult,
    peakPH: state.peakPH,
    furnaceBoostCharges: state.furnaceBoostCharges,
    challengeFlags: [...state.challengeFlags],
    skipBonus: state.skipBonus,
    airCap: state.airCap,
    draftChoices: [...draftChoices],
    graphPH: [...graphPH],
    graphCool: [...graphCool],
    savedAt: Date.now(),
  };
}

export function saveAll(meta: MetaState, run: RunSave | null): void {
  try {
    const data: FullSave = {
      version: SAVE_VERSION,
      meta: { ...meta, purchasedUpgrades: [...meta.purchasedUpgrades] },
      run,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable
  }
}

export function loadAll(): { meta: MetaState; run: RunSave | null } | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as FullSave;
    if (data.version !== SAVE_VERSION) return null;

    const meta: MetaState = {
      ...INITIAL_META,
      ...data.meta,
      purchasedUpgrades: new Set(data.meta.purchasedUpgrades ?? []),
    };
    return { meta, run: data.run ?? null };
  } catch {
    return null;
  }
}

export function wipeSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
