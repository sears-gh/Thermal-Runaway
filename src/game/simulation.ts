import type { CardInstance, MetaState, SimState, TickResult } from './types';
import { CARD_DEFS } from './cards';
import {
  BASE_C0,
  BASE_K,
  BASE_N,
  BASE_V,
  AIR_CAP_BASE,
  AIR_CAP_BOOST,
  BELOW_DANGER_SECS,
  FLASHOVER_THRESHOLD,
  REIGN_MULT_FACTOR,
} from './constants';

// ---------------------------------------------------------------------------
// State factory
// ---------------------------------------------------------------------------

export function computeChallengeFlags(
  deck: CardInstance[],
  meta: MetaState,
): Set<string> {
  const flags = new Set<string>();
  if (meta.airCapBoost) flags.add('airCapBoost');
  for (const card of deck) {
    if (card.defId === 'famine') flags.add('famine');
    if (card.defId === 'shackle') flags.add('shackle');
  }
  return flags;
}

export function createSimState(deck: CardInstance[], meta: MetaState): SimState {
  return {
    deck,
    head: 0,
    PH: 0,
    passiveOutput: 0,
    v: BASE_V + meta.bonusV0,
    mult: 1,
    t: 0,
    k_eff: BASE_K,
    n_eff: BASE_N + meta.bonusN,
    C0_eff: BASE_C0,
    frozenTotal: 0,
    belowTimer: 0,
    reignCount: 0,
    reignMult: 1,
    peakPH: 0,
    furnaceBoostCharges: 0,
    challengeFlags: computeChallengeFlags(deck, meta),
    skipBonus: 0,
    airCap: meta.airCapBoost ? AIR_CAP_BOOST : AIR_CAP_BASE,
  };
}

// ---------------------------------------------------------------------------
// Core formulas
// ---------------------------------------------------------------------------

export function coolValue(state: SimState): number {
  if (state.t < state.n_eff) return 0;
  const active = state.t - state.n_eff - state.frozenTotal;
  if (active <= 0) return 0;
  return state.C0_eff * Math.exp(state.k_eff * active);
}

// ---------------------------------------------------------------------------
// Card firing
// ---------------------------------------------------------------------------

export function fireCard(state: SimState, card: CardInstance): void {
  const def = CARD_DEFS[card.defId];
  if (!def) return;
  def.fire({ state, card, fireCard: c => fireCard(state, c) });
}

// ---------------------------------------------------------------------------
// Tick — one simulation step
// ---------------------------------------------------------------------------

export function tick(state: SimState): TickResult {
  // Reset mult at the start of each full deck loop so bellows-before-kindling
  // pattern is meaningful.
  if (state.head === 0) {
    state.mult = 1;
  }

  const dt = 1 / state.v;
  state.t += dt;

  // Passive drip (unaffected by mult — it's background infrastructure)
  state.PH += state.passiveOutput;

  // Fire current card
  if (state.deck.length > 0) {
    const card = state.deck[state.head % state.deck.length];
    fireCard(state, card);
  }

  // Advance playhead
  state.head =
    state.deck.length > 0 ? (state.head + 1) % state.deck.length : 0;

  // Track peak
  if (state.PH > state.peakPH) state.peakPH = state.PH;

  // Win condition
  if (state.PH >= FLASHOVER_THRESHOLD) return 'FLASH';

  // Cooling checks
  const cool = coolValue(state);
  if (state.t >= state.n_eff) {
    if (cool >= FLASHOVER_THRESHOLD && state.PH < FLASHOVER_THRESHOLD) {
      return 'REIGN';
    }
    if (state.PH < cool) {
      state.belowTimer += dt;
      if (state.belowTimer >= BELOW_DANGER_SECS) return 'REIGN';
    } else {
      state.belowTimer = 0;
    }
  }

  return 'OK';
}

// ---------------------------------------------------------------------------
// Reignition — reset per-race fields, preserve deck + reignMult
// ---------------------------------------------------------------------------

export function reignite(state: SimState, meta: MetaState): void {
  state.reignCount++;
  state.reignMult *= REIGN_MULT_FACTOR;

  const savedBonus = state.skipBonus;
  state.PH = savedBonus;
  state.passiveOutput = 0;
  state.v = BASE_V + meta.bonusV0;
  state.mult = 1;
  state.t = 0;
  state.k_eff = BASE_K;
  state.n_eff = BASE_N + meta.bonusN;
  state.C0_eff = BASE_C0;
  state.frozenTotal = 0;
  state.belowTimer = 0;
  state.head = 0;
  state.furnaceBoostCharges = 0;
  state.skipBonus = 0;
  state.airCap = meta.airCapBoost ? AIR_CAP_BOOST : AIR_CAP_BASE;

  // Rebuild flags (deck may have gained cards via draft)
  state.challengeFlags = computeChallengeFlags(state.deck, meta);

  for (const card of state.deck) {
    CARD_DEFS[card.defId]?.onReignReset?.(card);
    // furnaceCost intentionally NOT reset — persists across reigns
  }
}

// ---------------------------------------------------------------------------
// Ash reward calculation
// ---------------------------------------------------------------------------

export function calcAshReward(
  peakPH: number,
  hasShackle: boolean,
  ashBonus: number,
): number {
  const base = Math.floor(
    10 * Math.log10(Math.max(peakPH, FLASHOVER_THRESHOLD) / FLASHOVER_THRESHOLD) + 5,
  );
  return (hasShackle ? base * 2 : base) + ashBonus;
}
