import type { HearthUpgrade, MetaState } from './types';
import { AIR_CAP_BOOST } from './constants';

export const HEARTH_UPGRADES: HearthUpgrade[] = [
  {
    id: 'extraN',
    name: '初期遅延+3',
    desc: '開始 n を +3 秒',
    cost: 3,
    effect(m) { m.bonusN += 3; },
  },
  {
    id: 'fasterBase',
    name: '基礎速度+',
    desc: '基礎 Tick 速度 +0.2/s',
    cost: 4,
    effect(m) { m.bonusV0 += 0.2; },
  },
  {
    id: 'airCapBoost',
    name: `通風上限 ${AIR_CAP_BOOST}`,
    desc: `air_cap を 12 → ${AIR_CAP_BOOST}`,
    cost: 5,
    effect(m) { m.airCapBoost = true; },
  },
  {
    id: 'startKindling',
    name: '種火+1',
    desc: '開始デッキに種火を追加',
    cost: 3,
    effect(m) { m.startExtra.push('kindling'); },
  },
  {
    id: 'startInsulation',
    name: '断熱+1',
    desc: '開始デッキに断熱を追加',
    cost: 6,
    effect(m) { m.startExtra.push('insulation'); },
  },
  {
    id: 'startFrost',
    name: '霜結+1',
    desc: '開始デッキに霜結を追加',
    cost: 5,
    effect(m) { m.startExtra.push('frost'); },
  },
  {
    id: 'ashBonus',
    name: '初期灰ボーナス',
    desc: 'Flashover 後 Ash +2',
    cost: 4,
    effect(m) { m.ashBonus += 2; },
  },
  {
    id: 'draftFour',
    name: 'ドラフト4択',
    desc: 'ドラフトが4枚提示に',
    cost: 7,
    effect(m) { m.draftCount = 4; },
  },
];

export const INITIAL_META: MetaState = {
  ash: 0,
  flashoverCount: 0,
  bonusN: 0,
  bonusV0: 0,
  airCapBoost: false,
  startExtra: [],
  ashBonus: 0,
  draftCount: 3,
  purchasedUpgrades: new Set(),
};
