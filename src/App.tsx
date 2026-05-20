import { useCallback, useEffect, useRef, useState } from 'react';
import type { CardInstance, GamePhase, LogEntry, MetaState, Snapshot } from './game/types';
import { CARD_DEFS, makeCardInstance } from './game/cards';
import {
  calcAshReward,
  coolValue,
  createSimState,
  reignite,
  tick,
} from './game/simulation';
import type { SimState } from './game/types';
import { INITIAL_META, HEARTH_UPGRADES } from './game/meta';
import { getRandomDraftChoices } from './game/draft';
import { loadMeta, saveMeta } from './game/persistence';
import { GRAPH_LEN, MAX_FRAME_ELAPSED, MAX_TICKS_PER_FRAME } from './game/constants';

import Header from './components/Header';
import Furnace from './components/Furnace';
import Graph from './components/Graph';
import RaceInfo from './components/RaceInfo';
import DraftPanel from './components/DraftPanel';
import Hearth from './components/Hearth';
import Log from './components/Log';
import FlashoverScreen from './components/FlashoverScreen';

// ---------------------------------------------------------------------------
// Starting deck factory
// ---------------------------------------------------------------------------
function buildStartDeck(meta: MetaState): CardInstance[] {
  const ids = ['kindling', 'kindling', 'furnace', 'bellows', 'draft', ...meta.startExtra];
  return ids.map(makeCardInstance);
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  // ── React state (drives rendering) ───────────────────────────────────────
  const [phase, setPhaseState] = useState<GamePhase>('idle');
  const [meta, setMetaState] = useState<MetaState>(() => loadMeta() ?? { ...INITIAL_META, purchasedUpgrades: new Set() });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [draftChoices, setDraftChoices] = useState<string[]>([]);
  const [flashData, setFlashData] = useState<{ peakPH: number; ash: number } | null>(null);

  // ── Mutable refs (game engine — no re-renders) ────────────────────────────
  const simRef = useRef<SimState | null>(null);
  const phaseRef = useRef<GamePhase>('idle');
  const metaRef = useRef<MetaState>(meta);
  const rafRef = useRef<number | null>(null);
  const accumRef = useRef(0);
  const lastTRef = useRef(0);
  const graphPHRef = useRef<number[]>(new Array(GRAPH_LEN).fill(0));
  const graphCoolRef = useRef<number[]>(new Array(GRAPH_LEN).fill(0));
  let _logId = useRef(0);

  // ── "Latest-ref" handlers (capture fresh state each render) ──────────────
  // The rAF loop calls through these so it never has stale closures.
  const handlersRef = useRef({
    onFlash: (_peakPH: number, _ash: number) => {},
    onReign: () => {},
  });

  // Sync refs on every render
  useEffect(() => { phaseRef.current = phase; });
  useEffect(() => {
    metaRef.current = meta;
    saveMeta(meta);
  });

  handlersRef.current = {
    onFlash(peakPH, ash) {
      setFlashData({ peakPH, ash });
      setMetaState(prev => ({
        ...prev,
        ash: prev.ash + ash,
        flashoverCount: prev.flashoverCount + 1,
      }));
      addLog(`⚡ FLASHOVER! PH=${peakPH.toExponential(2)} Ash+${ash}`, 'flash');
      setPhase('flashover');
    },
    onReign() {
      const state = simRef.current!;
      addLog(`冷却に敗北… 再点火 #${state.reignCount + 1}`, 'important');
      reignite(state, metaRef.current);
      const choices = getRandomDraftChoices(metaRef.current);
      setDraftChoices(choices);
      setPhase('draft');
    },
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const setPhase = useCallback((p: GamePhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const addLog = useCallback((msg: string, kind: LogEntry['kind'] = 'normal') => {
    const entry: LogEntry = {
      id: _logId.current++,
      time: new Date().toLocaleTimeString(),
      msg,
      kind,
    };
    setLogs(prev => [entry, ...prev].slice(0, 60));
  }, []);

  const takeSnapshot = useCallback(() => {
    const state = simRef.current;
    if (!state) return;
    setSnap({
      PH: state.PH,
      cool: coolValue(state),
      passiveOutput: state.passiveOutput,
      v: state.v,
      t: state.t,
      mult: state.mult,
      k_eff: state.k_eff,
      n_eff: state.n_eff,
      belowTimer: state.belowTimer,
      head: state.head,
      deck: [...state.deck],
      reignCount: state.reignCount,
      reignMult: state.reignMult,
      graphPH: [...graphPHRef.current],
      graphCool: [...graphCoolRef.current],
    });
  }, []);

  // ── Game loop (stable — never recreated) ──────────────────────────────────
  const loop = useCallback(
    (timestamp: number) => {
      if (phaseRef.current !== 'running') return;
      const state = simRef.current;
      if (!state) return;

      const elapsed = Math.min((timestamp - lastTRef.current) / 1000, MAX_FRAME_ELAPSED);
      lastTRef.current = timestamp;
      accumRef.current += elapsed;

      let result: 'OK' | 'FLASH' | 'REIGN' = 'OK';
      let ticksDone = 0;

      while (result === 'OK' && ticksDone < MAX_TICKS_PER_FRAME) {
        const dt = 1 / state.v;
        if (accumRef.current < dt) break;
        accumRef.current -= dt;
        result = tick(state);
        ticksDone++;
      }

      // Push to graph buffers
      graphPHRef.current.push(state.PH);
      graphCoolRef.current.push(coolValue(state));
      if (graphPHRef.current.length > GRAPH_LEN) graphPHRef.current.shift();
      if (graphCoolRef.current.length > GRAPH_LEN) graphCoolRef.current.shift();

      takeSnapshot();

      if (result === 'FLASH') {
        const hasShackle = state.deck.some(c => c.defId === 'shackle');
        const ash = calcAshReward(state.peakPH, hasShackle, metaRef.current.ashBonus);
        handlersRef.current.onFlash(state.peakPH, ash);
        return;
      }
      if (result === 'REIGN') {
        handlersRef.current.onReign();
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    },
    [takeSnapshot], // stable — takeSnapshot is also stable
  );

  // Start/stop rAF when phase changes to/from 'running'
  useEffect(() => {
    if (phase === 'running') {
      lastTRef.current = performance.now();
      rafRef.current = requestAnimationFrame(loop);
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [phase, loop]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const startRun = useCallback(() => {
    const m = metaRef.current;
    const deck = buildStartDeck(m);
    simRef.current = createSimState(deck, m);
    graphPHRef.current = new Array(GRAPH_LEN).fill(0);
    graphCoolRef.current = new Array(GRAPH_LEN).fill(0);
    accumRef.current = 0;
    addLog('Run 開始', 'important');
    setPhase('running');
  }, [addLog, setPhase]);

  const pauseResume = useCallback(() => {
    if (phaseRef.current === 'running') {
      setPhase('paused');
    } else if (phaseRef.current === 'paused') {
      accumRef.current = 0;
      setPhase('running');
    }
  }, [setPhase]);

  const abortRun = useCallback(() => {
    simRef.current = null;
    graphPHRef.current = new Array(GRAPH_LEN).fill(0);
    graphCoolRef.current = new Array(GRAPH_LEN).fill(0);
    setSnap(null);
    addLog('Run 中断');
    setPhase('idle');
  }, [addLog, setPhase]);

  const pickDraftCard = useCallback((defId: string) => {
    const state = simRef.current;
    if (!state) return;
    state.deck.push(makeCardInstance(defId));
    addLog(`ドラフト: ${CARD_DEFS[defId]?.name ?? defId} を追加`, 'important');
    addLog(`再点火 #${state.reignCount} — ×${state.reignMult.toFixed(2)}`, 'important');
    setPhase('running');
  }, [addLog, setPhase]);

  const refineCard = useCallback((instanceId: string) => {
    const state = simRef.current;
    if (!state) return;
    const idx = state.deck.findIndex(c => c.instanceId === instanceId);
    if (idx < 0) return;
    const [removed] = state.deck.splice(idx, 1);
    if (state.head >= state.deck.length) state.head = 0;
    addLog(`精錬: ${CARD_DEFS[removed.defId]?.name ?? removed.defId} を除去`, 'important');
    addLog(`再点火 #${state.reignCount} — ×${state.reignMult.toFixed(2)}`, 'important');
    setPhase('running');
  }, [addLog, setPhase]);

  const skipDraft = useCallback(() => {
    const state = simRef.current;
    if (!state) return;
    state.skipBonus += 10;
    addLog('ドラフト スキップ（PH+10）');
    addLog(`再点火 #${state.reignCount} — ×${state.reignMult.toFixed(2)}`, 'important');
    setPhase('running');
  }, [addLog, setPhase]);

  const continueAfterFlashover = useCallback(() => {
    simRef.current = null;
    setSnap(null);
    setFlashData(null);
    addLog(`炉床へ。Flashover #${metaRef.current.flashoverCount}`, 'important');
    setPhase('idle');
  }, [addLog, setPhase]);

  const purchaseHearth = useCallback((upgradeId: string) => {
    const upg = HEARTH_UPGRADES.find(u => u.id === upgradeId);
    if (!upg) return;
    setMetaState(prev => {
      if (prev.ash < upg.cost || prev.purchasedUpgrades.has(upgradeId)) return prev;
      const next: MetaState = {
        ...prev,
        ash: prev.ash - upg.cost,
        purchasedUpgrades: new Set(prev.purchasedUpgrades),
      };
      next.purchasedUpgrades.add(upgradeId);
      upg.effect(next);
      return next;
    });
    addLog(`炉床: ${upg.name} を購入`, 'important');
  }, [addLog]);

  // ── Render ────────────────────────────────────────────────────────────────
  const showDraft = phase === 'draft' || phase === 'refine';

  return (
    <div className="app">
      <Header meta={meta} reignMult={snap?.reignMult ?? 1} />

      <div className="main">
        {/* Left column */}
        <div className="left-panel">
          <Furnace snap={snap} />
          <Graph graphPH={snap?.graphPH ?? []} graphCool={snap?.graphCool ?? []} />
          <RaceInfo snap={snap} phase={phase} />
          <div className="controls">
            <button className="primary" onClick={startRun} disabled={phase !== 'idle'}>
              ▶ START RUN
            </button>
            <button onClick={pauseResume} disabled={phase !== 'running' && phase !== 'paused'}>
              {phase === 'paused' ? '▶ RESUME' : '⏸ PAUSE'}
            </button>
            <button onClick={abortRun} disabled={phase === 'idle'}>
              ↺ ABORT RUN
            </button>
          </div>
        </div>

        {/* Right column */}
        <div className="right-panel">
          {showDraft && (
            <DraftPanel
              choices={draftChoices}
              deck={simRef.current?.deck ?? []}
              phase={phase}
              onPick={pickDraftCard}
              onRefine={refineCard}
              onSkip={skipDraft}
              onShowRefine={() => setPhase('refine')}
              onCancelRefine={() => setPhase('draft')}
            />
          )}
          <Log entries={logs} />
          <Hearth meta={meta} onPurchase={purchaseHearth} />
        </div>
      </div>

      {phase === 'flashover' && flashData && (
        <FlashoverScreen
          peakPH={flashData.peakPH}
          ash={flashData.ash}
          onContinue={continueAfterFlashover}
        />
      )}
    </div>
  );
}
