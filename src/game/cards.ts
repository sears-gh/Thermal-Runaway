import type { CardDef, CardInstance } from './types';
import {
  AIR_CAP_BASE,
  AIR_CAP_BOOST,
  FROST_BASE_DUR,
  FROST_DECAY,
  MAX_BRANCHING_COPIES,
} from './constants';

let _nextId = 0;
function newInstanceId(): string {
  return `c${++_nextId}_${Math.random().toString(36).slice(2, 6)}`;
}

export function makeCardInstance(defId: string): CardInstance {
  const def = CARD_DEFS[defId];
  if (!def) throw new Error(`Unknown card: ${defId}`);
  return {
    defId,
    instanceId: newInstanceId(),
    isWeakCopy: false,
    charges: def.initCharges,
    furnaceCost: defId === 'furnace' ? 50 : undefined,
    frostDur: defId === 'frost' ? FROST_BASE_DUR : undefined,
  };
}

const defs: Record<string, CardDef> = {
  kindling: {
    id: 'kindling',
    name: '種火',
    desc: 'PH +12 (×mult)',
    rarity: 'common',
    fire({ state }) {
      if (state.challengeFlags.has('famine')) return;
      state.PH += 12 * state.mult;
    },
  },

  furnace: {
    id: 'furnace',
    name: '築炉',
    desc: 'PH≥cost → passive +4. cost ×1.5',
    rarity: 'common',
    fire({ state, card }) {
      if (card.furnaceCost === undefined) card.furnaceCost = 50;
      let bonus = 4;
      if (state.furnaceBoostCharges > 0) {
        bonus *= 1.5;
        state.furnaceBoostCharges--;
      }
      if (state.PH >= card.furnaceCost) {
        state.PH -= card.furnaceCost;
        state.passiveOutput += bonus;
        card.furnaceCost *= 1.5;
      }
    },
  },

  bellows: {
    id: 'bellows',
    name: '送風',
    desc: 'mult ×2 (1ループ持続)',
    rarity: 'common',
    fire({ state }) {
      const factor = state.challengeFlags.has('famine') ? 2.5 : 2;
      state.mult *= factor;
    },
  },

  draft: {
    id: 'draft',
    name: '通風',
    desc: 'v ×1.08 (上限 air_cap)',
    rarity: 'common',
    fire({ state }) {
      if (state.challengeFlags.has('noWind')) return;
      state.v = Math.min(state.v * 1.08, state.airCap);
    },
  },

  insulation: {
    id: 'insulation',
    name: '断熱',
    desc: 'k_eff -0.0015 (下限 0.075)',
    rarity: 'uncommon',
    fire({ state }) {
      state.k_eff = Math.max(0.075, state.k_eff - 0.0015);
    },
  },

  branching: {
    id: 'branching',
    name: '分火',
    desc: '弱体コピーを後ろに挿入 (上限6枚)',
    rarity: 'uncommon',
    fire({ state, card }) {
      const copies = state.deck.filter(
        c => c.isWeakCopy && c.sourceInstanceId === card.instanceId,
      ).length;
      if (copies >= MAX_BRANCHING_COPIES) return;
      const copy: CardInstance = {
        defId: 'kindling_weak',
        instanceId: newInstanceId(),
        isWeakCopy: true,
        sourceInstanceId: card.instanceId,
      };
      const idx = state.deck.indexOf(card);
      state.deck.splice(idx + 1, 0, copy);
    },
  },

  spread: {
    id: 'spread',
    name: '延焼',
    desc: '次のカードを即発火',
    rarity: 'uncommon',
    fire({ state, card, fireCard }) {
      const idx = state.deck.indexOf(card);
      const next = state.deck[(idx + 1) % state.deck.length];
      if (next && next !== card) fireCard(next);
    },
  },

  copy: {
    id: 'copy',
    name: '複写',
    desc: '右隣を右に複製 (残2, 再点火リセット)',
    rarity: 'rare',
    initCharges: 2,
    fire({ state, card }) {
      if (!card.charges || card.charges <= 0) return;
      card.charges--;
      const idx = state.deck.indexOf(card);
      const next = state.deck[(idx + 1) % state.deck.length];
      if (!next || next === card) return;
      const clone: CardInstance = {
        ...next,
        instanceId: newInstanceId(),
        charges: next.charges,
      };
      state.deck.splice(idx + 2, 0, clone);
    },
    onReignReset(card) { card.charges = 2; },
  },

  rekindle: {
    id: 'rekindle',
    name: '熾し直し',
    desc: 'n_eff +4 (残3, 上限24)',
    rarity: 'rare',
    initCharges: 3,
    fire({ state, card }) {
      if (!card.charges || card.charges <= 0) return;
      card.charges--;
      state.n_eff = Math.min(24, state.n_eff + 4);
    },
    onReignReset(card) { card.charges = 3; },
  },

  ashLevel: {
    id: 'ashLevel',
    name: '灰均し',
    desc: 'C0_eff ×0.5 (残2, 下限12.5)',
    rarity: 'rare',
    initCharges: 2,
    fire({ state, card }) {
      if (!card.charges || card.charges <= 0) return;
      card.charges--;
      state.C0_eff = Math.max(12.5, state.C0_eff * 0.5);
    },
    onReignReset(card) { card.charges = 2; },
  },

  portExpand: {
    id: 'portExpand',
    name: '焚き口拡張',
    desc: '築炉出力 ×1.5 (残3)',
    rarity: 'rare',
    initCharges: 3,
    fire({ state, card }) {
      if (!card.charges || card.charges <= 0) return;
      card.charges--;
      state.furnaceBoostCharges++;
    },
    onReignReset(card) { card.charges = 3; },
  },

  frost: {
    id: 'frost',
    name: '霜結',
    desc: '冷却停止 N秒 (基礎4s, ×0.7毎回, 再点火でリセット)',
    rarity: 'uncommon',
    fire({ state, card }) {
      if (card.frostDur === undefined) card.frostDur = FROST_BASE_DUR;
      state.frozenTotal += card.frostDur;
      card.frostDur *= FROST_DECAY;
    },
    onReignReset(card) { card.frostDur = FROST_BASE_DUR; },
  },

  shackle: {
    id: 'shackle',
    name: '枷',
    desc: 'v 半減。Flashover時 Ash ×2',
    rarity: 'challenge',
    fire({ state }) {
      state.v = Math.max(0.5, state.v * 0.5);
    },
  },

  famine: {
    id: 'famine',
    name: '飢餓',
    desc: '種火を無効化。送風倍率 ×1.25',
    rarity: 'challenge',
    fire() { /* passive: flagged in challengeFlags */ },
  },

  // Internal card created by branching — not in draft pool
  kindling_weak: {
    id: 'kindling_weak',
    name: '分火片',
    desc: 'PH +6 (×mult)',
    rarity: 'common',
    fire({ state }) {
      if (state.challengeFlags.has('famine')) return;
      state.PH += 6 * state.mult;
    },
  },
};

export const CARD_DEFS: Readonly<Record<string, CardDef>> = defs;
