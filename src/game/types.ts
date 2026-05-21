export type CardRarity = 'common' | 'uncommon' | 'rare' | 'challenge';
export type TickResult = 'OK' | 'FLASH' | 'REIGN';
export type GamePhase = 'idle' | 'running' | 'paused' | 'draft' | 'refine' | 'flashover';

export interface CardInstance {
  defId: string;
  instanceId: string;
  isWeakCopy: boolean;
  sourceInstanceId?: string;
  // Per-race mutable fields (reset by onReignReset where applicable)
  charges?: number;
  // Per-run persistent fields
  furnaceCost?: number;
  frostDur?: number;
}

export interface FireCtx {
  state: SimState;
  card: CardInstance;
  /** Recursively fire another card (used by spread) */
  fireCard: (card: CardInstance) => void;
}

export interface CardDef {
  id: string;
  name: string;
  desc: string;
  rarity: CardRarity;
  initCharges?: number;
  fire(ctx: FireCtx): void;
  onReignReset?(card: CardInstance): void;
}

export interface SimState {
  deck: CardInstance[];
  head: number;
  PH: number;
  passiveOutput: number;
  /** Current tick speed (ticks/sec) */
  v: number;
  /** Current multiplier, reset to 1 at start of each deck loop */
  mult: number;
  /** Elapsed real-time this race (seconds) */
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
  challengeFlags: Set<string>;
  skipBonus: number;
  airCap: number;
}

export interface MetaState {
  ash: number;
  flashoverCount: number;
  bonusN: number;
  bonusV0: number;
  airCapBoost: boolean;
  startExtra: string[];
  ashBonus: number;
  draftCount: number;
  purchasedUpgrades: Set<string>;
}

export interface HearthUpgrade {
  id: string;
  name: string;
  desc: string;
  cost: number;
  effect(meta: MetaState): void;
}

export interface LogEntry {
  id: number;
  time: string;
  msg: string;
  kind: 'normal' | 'important' | 'flash';
}

export interface Snapshot {
  PH: number;
  cool: number;
  passiveOutput: number;
  v: number;
  t: number;
  mult: number;
  k_eff: number;
  n_eff: number;
  belowTimer: number;
  head: number;
  deck: CardInstance[];
  reignCount: number;
  reignMult: number;
  graphPH: number[];
  graphCool: number[];
}
